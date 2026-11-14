// Train physics. Pure functions + plain objects: no React, no Three.js.
//
// Model (all forces in kN, masses in tonnes → a = F / m gives m/s²):
//   traction  = lever × min(322 kN, 4500 kW / v)       WAP-7 tractive-effort curve
//   regen     = −lever × min(260 kN, 4500 kW / v)       electric braking, fades < 10 km/h
//   resistance= RDSO Davis-type formulas + curve resistance
//   air brake = A9 handle → brake pipe (BP) pressure → brake cylinder (BC)
//               pressure (with propagation delay) → braking force
//   gradient  = m · g · grade (1 in 37 → 26.5 kN per 100 t), helps downhill
//   a = (traction − regen − resistance − airBrake ± gradient) / (mass × rotating-mass factor)
// No roll-back: a train stopped on a rising gradient is held (as if braked).
// Speed is always ≥ 0; `direction` (the reverser) says which way we move.

export const DIRECTION = { FORWARD: 1, NEUTRAL: 0, REVERSE: -1 };
export const DIRECTION_LABEL = { 1: 'Forward', 0: 'Neutral', '-1': 'Reverse' };

const G = 9.81;
const KGF_PER_T_TO_KN_PER_T = G / 1000; // 1 kgf/t = 0.00981 kN/t
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function trainMass(cfg, coachCount) {
  const locoT = cfg.loco.massT + (cfg.bankerMassT ?? 0); // banking locos at the rear count as loco mass
  const coachT = cfg.coach.massT * coachCount;
  return {
    locoT,
    coachT,
    staticT: locoT + coachT,
    effectiveT: locoT * cfg.loco.rotFactor + coachT * cfg.coach.rotFactor,
  };
}

export function createTrainState({ startDistance, minDistance, maxDistance, coachCount, cfg }) {
  return {
    speedMps: 0,
    direction: DIRECTION.FORWARD,
    routeDistance: startDistance, // locomotive front, metres along the route
    previousRouteDistance: startDistance,
    minDistance,
    maxDistance,
    mass: trainMass(cfg, coachCount),
    // driver's controls
    lever: 0, // TE/BE lever: +1 full traction … 0 … −1 full regen braking
    leverZeroDwell: 0,
    brakeHandle: 1, // A9: 0 = release … 1 = full service; starts applied
    emergency: false,
    // equipment state
    teActual: 0, // kN, +traction / −regen (ramps towards the lever)
    bp: cfg.bpFullService, // brake pipe pressure, kg/cm²
    brakeSignal: cfg.bcServiceMax, // BC demand after propagation delay
    bc: cfg.bcServiceMax, // brake cylinder pressure, kg/cm²
    tractionCut: false,
    // forces for the HUD (kN)
    forces: { traction: 0, regen: 0, resistance: 0, airBrake: 0, gradient: 0 },
    grade: 0, // average gradient under the train (rise per metre, + = uphill ahead)
    // stats
    maxSpeedReachedMps: 0,
    distanceTravelled: 0,
    hitBufferStop: false,
    slipping: false, // wheels slipping (adhesion model)
    // compatibility helpers for HUD/audio (0..1)
    get throttle() {
      return Math.max(this.lever, 0);
    },
    get brake() {
      return this.emergency ? 1 : this.brakeHandle;
    },
    get brakeEffective() {
      return clamp(this.bc / cfg.bcEmergencyMax, 0, 1);
    },
  };
}

/** Resistance to motion in kN (always opposes motion). curveRadius in m or Infinity. */
export function resistanceKN(train, cfg, curveRadius = Infinity) {
  const V = train.speedMps * 3.6;
  const { locoT, coachT } = train.mass;
  const formula = (c) => c[0] + c[1] * V + c[2] * V * V;
  let locoKgpt = formula(cfg.locoRes);
  let coachKgpt = formula(cfg.coachRes);
  // Starting resistance (bearings, grease) blends into the formula by 8 km/h
  const blend = clamp(V / 8, 0, 1);
  locoKgpt = cfg.startResLoco_kgpt * (1 - blend) + locoKgpt * blend;
  coachKgpt = cfg.startResCoach_kgpt * (1 - blend) + coachKgpt * blend;
  const curveKgpt = Number.isFinite(curveRadius) ? cfg.curveRes_kgpt_R / curveRadius : 0;
  return ((locoKgpt + curveKgpt) * locoT + (coachKgpt + curveKgpt) * coachT) * KGF_PER_T_TO_KN_PER_T;
}

/** Maximum available tractive effort (kN) at speed v (m/s). */
export function maxTractiveEffort(v, cfg) {
  return Math.min(cfg.startingTE_kN, cfg.power_kW / Math.max(v, 0.1));
}
export function maxRegenEffort(v, cfg) {
  const fade = clamp((v * 3.6) / cfg.regenFadeBelowKmh, 0, 1);
  return Math.min(cfg.regenMax_kN, cfg.power_kW / Math.max(v, 0.1)) * fade;
}

/** BP target for the current A9 handle position. */
function bpTarget(train, cfg, extraBrake = 0) {
  if (train.emergency) return 0;
  const handle = Math.max(train.brakeHandle, extraBrake); // Kavach can apply the brake on its own
  if (handle < 0.04) return cfg.bpNormal; // Release
  const t = (handle - 0.04) / 0.96; // Minimum reduction … Full service
  return cfg.bpMinReduction + (cfg.bpFullService - cfg.bpMinReduction) * t;
}

/** Human label for the A9 handle position. */
export function brakeHandleLabel(train) {
  if (train.emergency) return 'Emergency';
  if (train.brakeHandle < 0.04) return 'Release';
  if (train.brakeHandle < 0.2) return 'Min. reduction';
  if (train.brakeHandle < 0.95) return 'Service';
  return 'Full service';
}

/**
 * Advance the train by one fixed step.
 * input: { leverUp, leverDown, brakeApply, brakeRelease } (held keys)
 * env:   { curveRadius, grade, bankerTE_kN, mu, extraBrake, cutTraction } at the train's position.
 *        mu = wheel–rail adhesion (omit for no slip model); extraBrake = brake
 *        demand 0…1 applied by Kavach/VCD; cutTraction = traction interlock.
 *        grade = average rise per metre under the train (+ = climbing in the
 *        +s direction); bankerTE_kN = extra push from banking locos at the rear.
 */
export function stepTrain(train, input, dt, cfg, env = {}) {
  // --- 1. Driver's controls -------------------------------------------------
  if (input.leverUp || input.leverDown) {
    const dir = input.leverUp ? 1 : -1;
    const next = train.lever + dir * cfg.leverRate * dt;
    // Like the real lever, it pauses at 0 (the "off" detent) before regen/traction
    if (Math.sign(train.lever) !== 0 && Math.sign(next) !== Math.sign(train.lever)) {
      train.lever = 0;
      train.leverZeroDwell = 0.35;
    } else if (train.lever === 0 && train.leverZeroDwell > 0) {
      train.leverZeroDwell -= dt;
    } else {
      train.lever = clamp(next, -1, 1);
    }
  } else {
    train.leverZeroDwell = 0;
  }
  if (input.brakeApply) train.brakeHandle += cfg.brakeHandleRate * dt;
  if (input.brakeRelease) train.brakeHandle -= cfg.brakeHandleRate * dt;
  train.brakeHandle = clamp(train.brakeHandle, 0, 1);

  // --- 2. Air brake: BP → (propagation) → BC ---------------------------------
  const bpT = bpTarget(train, cfg, env.extraBrake ?? 0);
  const rate = train.emergency ? cfg.bpEmergencyRate : bpT > train.bp ? cfg.bpChargeRate : cfg.bpServiceRate;
  const dBp = bpT - train.bp;
  train.bp += clamp(dBp, -rate * dt, rate * dt);
  const bcDemand = train.emergency
    ? cfg.bcEmergencyMax
    : clamp(cfg.bcPerBpDrop * (cfg.bpNormal - train.bp - 0.1), 0, cfg.bcServiceMax);
  train.brakeSignal += (bcDemand - train.brakeSignal) * Math.min(1, dt / cfg.signalTau);
  const tau = train.brakeSignal > train.bc ? cfg.bcApplyTau : cfg.bcReleaseTau;
  train.bc += (train.brakeSignal - train.bc) * Math.min(1, dt / tau);

  // --- 3. Traction / regen (with interlocks) ---------------------------------
  const v = train.speedMps;
  train.tractionCut = train.emergency || train.bp < cfg.tractionCutBp || !!env.cutTraction;
  let teTarget = 0;
  if (train.direction !== DIRECTION.NEUTRAL) {
    // traction also cuts out above the loco's maximum speed (WAG-9: 100 km/h)
    const overMax = cfg.locoMaxKmh && v * 3.6 >= cfg.locoMaxKmh;
    if (train.lever > 0 && !train.tractionCut && !overMax) teTarget = train.lever * maxTractiveEffort(v, cfg);
    if (train.lever < 0) teTarget = train.lever * maxRegenEffort(v, cfg);
  }
  const ramp = cfg.teRamp_kNps * dt * (teTarget === 0 ? 2 : 1);
  train.teActual += clamp(teTarget - train.teActual, -ramp, ramp);
  if (train.lever > 0 && train.teActual < 0) train.teActual = 0;
  // regen can never exceed what is available at this speed
  if (train.teActual < 0) train.teActual = Math.max(train.teActual, -maxRegenEffort(v, cfg));

  // --- 3b. Adhesion (optional): wheel–rail grip limits traction and regen ----
  // F_adh = µ × loco weight. Beyond it the wheels slip (or slide under regen):
  // the slip control cuts effort back below the limit. Sand raises µ.
  train.slipping = false;
  if (env.mu) {
    const fAdh = env.mu * cfg.loco.massT * G;
    if (train.teActual > fAdh) {
      train.slipping = true;
      train.teActual = fAdh * 0.85;
    } else if (train.teActual < -fAdh) {
      train.slipping = true;
      train.teActual = -fAdh * 0.85;
    }
  }

  // --- 4. Forces → acceleration ----------------------------------------------
  const banker = train.lever > 0 && !train.tractionCut && train.direction !== DIRECTION.NEUTRAL ? Math.max(0, env.bankerTE_kN ?? 0) * train.lever : 0;
  const traction = Math.max(train.teActual, 0) + banker;
  const regen = Math.max(-train.teActual, 0);
  const resistance = resistanceKN(train, cfg, env.curveRadius);
  const airBrake = (train.bc / cfg.bcEmergencyMax) * cfg.decelAtEmergency * train.mass.staticT; // kN (t·m/s²)
  // gravity along the direction of travel: + helps (downhill), − holds back (uphill)
  train.grade = env.grade ?? 0;
  const travelSign = train.direction === DIRECTION.REVERSE ? -1 : 1;
  const gradient = -train.mass.staticT * G * train.grade * travelSign;
  train.forces.traction = traction;
  train.forces.regen = regen;
  train.forces.resistance = resistance;
  train.forces.airBrake = airBrake;
  train.forces.gradient = gradient;

  const driving = traction + Math.max(gradient, 0);
  const retarding = regen + resistance + airBrake + Math.max(-gradient, 0);
  let newV;
  if (v === 0 && driving <= retarding) {
    newV = 0; // static: brakes/resistance hold the train
  } else {
    newV = v + ((driving - retarding) / train.mass.effectiveT) * dt;
  }
  if (newV < 0) newV = 0;
  if (newV < cfg.stopSnapSpeed && driving <= retarding) newV = 0;
  if (train.emergency && newV === 0 && train.brakeHandle < 0.04) train.emergency = false; // reset once stopped & handle released

  // --- 5. Move along the route ------------------------------------------------
  const moveSign = train.direction === DIRECTION.REVERSE ? -1 : 1;
  const ds = ((v + newV) / 2) * dt;
  train.previousRouteDistance = train.routeDistance;
  train.routeDistance += moveSign * ds;
  train.distanceTravelled += ds;
  train.speedMps = newV;

  train.hitBufferStop = false;
  if (train.routeDistance > train.maxDistance) {
    train.routeDistance = train.maxDistance;
    train.speedMps = 0;
    train.hitBufferStop = true;
  } else if (train.routeDistance < train.minDistance) {
    train.routeDistance = train.minDistance;
    train.speedMps = 0;
    train.hitBufferStop = true;
  }
  if (train.speedMps > train.maxSpeedReachedMps) train.maxSpeedReachedMps = train.speedMps;
  return train;
}

/** Emergency brake: vents the brake pipe and cuts traction. */
export function applyEmergency(train) {
  train.emergency = true;
  train.brakeHandle = 1;
  train.lever = 0;
}

/**
 * Reverser: Forward → Neutral → Reverse. Only when stopped with the lever at 0,
 * exactly like the real interlock.
 */
export function cycleDirection(train, cfg) {
  if (train.speedMps > cfg.directionChangeMaxSpeed) {
    return { ok: false, message: 'Stop the train before changing direction' };
  }
  if (train.lever > 0.02) {
    return { ok: false, message: 'Bring the TE/BE lever to 0 before using the reverser' };
  }
  const order = [DIRECTION.FORWARD, DIRECTION.NEUTRAL, DIRECTION.REVERSE];
  const next = order[(order.indexOf(train.direction) + 1) % order.length];
  train.direction = next;
  return { ok: true, message: `Reverser: ${DIRECTION_LABEL[next]}` };
}

/**
 * Distance needed to stop from the current speed with full-service air brake
 * (+ current regen), including the time for the brakes to build up. Shown in
 * the HUD so the player can plan station stops like a real driver.
 */
export function estimateStoppingDistance(train, cfg) {
  const v = train.speedMps;
  if (v < 0.1) return 0;
  const travelSign = train.direction === DIRECTION.REVERSE ? -1 : 1;
  const gradeDecel = (G * (train.grade ?? 0) * travelSign * train.mass.staticT) / train.mass.effectiveT; // + uphill helps stop
  const decel = Math.max(0.05, (cfg.bcServiceMax / cfg.bcEmergencyMax) * cfg.decelAtEmergency + resistanceKN(train, cfg) / train.mass.effectiveT + gradeDecel);
  const buildUp = Math.max(0, (cfg.bcServiceMax - train.bc) / cfg.bcServiceMax) * 3; // seconds until brakes are fully on
  return v * buildUp * 0.6 + (v * v) / (2 * decel);
}

/** Fixed-timestep driver (see SimulationDriver). */
export function createFixedStepper(fixedDt, maxFrameDelta) {
  let accumulator = 0;
  return {
    advance(frameDelta, step) {
      accumulator += Math.min(Math.max(frameDelta, 0), maxFrameDelta);
      let steps = 0;
      while (accumulator >= fixedDt) {
        step(fixedDt);
        accumulator -= fixedDt;
        steps++;
      }
      return { alpha: accumulator / fixedDt, steps };
    },
    reset() {
      accumulator = 0;
    },
  };
}

/** Speed limit (km/h) that applies to a train spanning [rear, front]. */
export function speedLimitFor(limits, rear, front) {
  let limit = Infinity;
  for (const l of limits) if (l.to > rear && l.from < front) limit = Math.min(limit, l.kmh);
  return limit;
}

/** Next lower restriction ahead of the front, for HUD warnings. */
export function nextSpeedLimit(limits, front, currentLimit) {
  for (const l of limits) if (l.from > front && l.kmh < currentLimit) return { kmh: l.kmh, distance: l.from - front, reason: l.reason };
  return null;
}

/**
 * Wheel–rail adhesion µ (game model — no official Indian Railways design
 * figures were found). Dry ≈ 0.40: the WAG-9's 460 kN starting effort on 123 t
 * needs ~0.38, and three-phase locos with slip control reach that. Wet rail
 * ≈ 0.25; morning dew/fog a little lower than dry; sand adds ~0.08.
 */
export const ADHESION = { dry: 0.4, wet: 0.25, damp: 0.33, sand: 0.08 };
export function adhesionMu({ rain = 0, fog = 0, sanding = false } = {}) {
  let mu = ADHESION.dry - (ADHESION.dry - ADHESION.wet) * Math.min(1, rain) - (ADHESION.dry - ADHESION.damp) * Math.min(1, fog) * (1 - Math.min(1, rain));
  if (sanding) mu = Math.min(ADHESION.dry + 0.02, mu + ADHESION.sand);
  return mu;
}

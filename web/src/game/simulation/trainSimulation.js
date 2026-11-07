// Simplified train motion. Pure functions + plain objects: no React, no Three.js.
//
// How it works (per fixed time step dt):
//   1. Move the throttle/brake handles according to held keys.
//   2. The *effective* brake slowly follows the brake handle (air brakes take
//      time to build up and release pressure).
//   3. acceleration = traction − resistance − braking
//   4. speed += acceleration·dt, never below 0 and never above the speed cap.
//   5. routeDistance += speed·dt in the travel direction.
// Speed is always a positive number; `direction` says which way we move.

export const DIRECTION = { FORWARD: 1, NEUTRAL: 0, REVERSE: -1 };
export const DIRECTION_LABEL = { 1: 'Forward', 0: 'Neutral', '-1': 'Reverse' };

export function createTrainState({ startDistance, minDistance, maxDistance }) {
  return {
    speedMps: 0,
    throttle: 0,
    brake: 1, // start with brakes fully applied
    brakeEffective: 1,
    direction: DIRECTION.FORWARD,
    routeDistance: startDistance, // locomotive front, metres along the route
    previousRouteDistance: startDistance,
    minDistance,
    maxDistance,
    maxSpeedReachedMps: 0,
    distanceTravelled: 0,
    hitBufferStop: false,
  };
}

export function speedKmh(train) {
  return train.speedMps * 3.6;
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/**
 * Advance the train by exactly one fixed step.
 * @param {object} train   state from createTrainState (mutated)
 * @param {object} input   { throttleUp, throttleDown, brakeApply, brakeRelease } booleans
 * @param {number} dt      seconds
 * @param {object} cfg     TRAIN config
 */
export function stepTrain(train, input, dt, cfg) {
  // 1. Handles
  if (input.throttleUp) train.throttle += cfg.throttleRate * dt;
  if (input.throttleDown) train.throttle -= cfg.throttleRate * dt;
  if (input.brakeApply) train.brake += cfg.brakeRate * dt;
  if (input.brakeRelease) train.brake -= cfg.brakeRate * dt;
  train.throttle = clamp(train.throttle, 0, 1);
  train.brake = clamp(train.brake, 0, 1);

  // 2. Brake lag (first-order "chase" towards the handle position)
  const k = Math.min(1, dt / cfg.brakeResponseTime);
  train.brakeEffective += (train.brake - train.brakeEffective) * k;

  // 3. Forces expressed directly as accelerations (mass is folded in)
  const maxSpeed = cfg.maxSpeedKmh / 3.6;
  const v = train.speedMps;
  let traction = 0;
  if (train.direction !== DIRECTION.NEUTRAL && v < maxSpeed) {
    traction = train.throttle * cfg.maxTractionAccel * (1 - cfg.tractionFadeAtMaxSpeed * (v / maxSpeed));
  }
  const resistance = v > 0 ? cfg.rollingResistance + cfg.airResistance * v * v : 0;
  const braking = train.brakeEffective * cfg.maxBrakeDecel;
  const accel = traction - resistance - braking;

  // 4. Integrate speed, with limits
  let newV = v + accel * dt;
  if (newV < 0) newV = 0; // brakes/drag can stop the train but never push it backwards
  if (newV > maxSpeed) newV = maxSpeed;
  if (newV < cfg.stopSnapSpeed && traction <= braking + resistance) newV = 0; // settle at rest

  // 5. Move along the route (average of old & new speed = trapezoid rule)
  const moveSign = train.direction === DIRECTION.REVERSE ? -1 : 1;
  const ds = ((v + newV) / 2) * dt;
  train.previousRouteDistance = train.routeDistance;
  train.routeDistance += moveSign * ds;
  train.distanceTravelled += ds;
  train.speedMps = newV;

  // End of track: stop dead at the limits instead of leaving the rails
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

/**
 * Cycle Forward → Neutral → Reverse → Forward. Only allowed when (nearly)
 * stationary — otherwise the request is refused with a message.
 */
export function cycleDirection(train, cfg) {
  if (train.speedMps > cfg.directionChangeMaxSpeed) {
    return { ok: false, message: 'Stop the train before changing direction' };
  }
  const order = [DIRECTION.FORWARD, DIRECTION.NEUTRAL, DIRECTION.REVERSE];
  const next = order[(order.indexOf(train.direction) + 1) % order.length];
  train.direction = next;
  return { ok: true, message: `Direction: ${DIRECTION_LABEL[next]}` };
}

/**
 * Fixed-timestep driver. Browsers deliver frames at uneven intervals; running
 * the physics in equal small steps keeps it deterministic, and capping the
 * frame delta stops the train "teleporting" after a stall or tab switch.
 */
export function createFixedStepper(fixedDt, maxFrameDelta) {
  let accumulator = 0;
  return {
    /** Runs `step(fixedDt)` zero or more times; returns interpolation alpha 0..1. */
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

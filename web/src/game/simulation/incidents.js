// Incidents (ENHANCEMENTS_PLAN B5): occasional events a loco pilot has to
// handle by the rulebook. Pure (no Three.js / React) — incidents.test.js.
//
// 1. CAUTION ORDER / TEMPORARY SPEED RESTRICTION for permanent-way work.
//    GR 15.09(1)(d) (restriction lasting more than a day, train not required
//    to stop): a speed indicator 30 m before the place of obstruction, a
//    caution indicator at least 800 m before it, and termination indicators
//    where the driver may resume normal speed. Drivers are told in advance on
//    a caution order (form T/409) at the starting station.
//    The termination indicators T/P and T/G stand beyond the end of the
//    restriction by the length of the longest passenger / goods train, so
//    the rear has cleared when the engine passes them (IRFCA signalling FAQ
//    pt 5). GAME ASSUMPTIONS: the 30 km/h figure (from the plan), the work
//    site length 250–550 m, and 600 m (T/P) / 700 m (T/G) as "the longest
//    train" (a 24-coach rake ≈ 600 m; a 58-wagon BOXN rake + loco + van ≈ 700 m).
//
// 2. AUTOMATIC SIGNAL FAILED AT 'ON' — GR 9.02 (double line):
//    stop in rear of the signal, wait 1 min by day / 2 min by night, give
//    the prescribed whistle code ('-----', IRFCA) and proceed "exercising
//    great caution so as to stop short of any obstruction" up to the next
//    stop signal, acting on that signal only after reaching it (9.02(5)).
//    Where the line ahead cannot be seen clearly (curvature, fog, rain, dust
//    storm…) the speed "shall under no circumstances exceed 8 km/h" (9.02(3)).
//    GAME ASSUMPTION: 15 km/h when the view is clear — GR 9.02 gives no
//    figure there, only "great caution".
//
// 3. ALARM CHAIN PULLING (ACP): the chain opens a vent valve on the coach,
//    the brake pipe pressure falls (the loco pilot sees it on the BP gauge)
//    and the brakes apply; the cab lamp and buzzer stay on until the device
//    on that coach is reset by hand (CAMTECH coaching-stock handbook;
//    indiarailinfo FAQ 1949). Whistle code 'o o --' = sudden loss of brake
//    pressure (IRFCA). GAME ASSUMPTIONS: the vent rate (in trainSimulation)
//    and 120 s for the crew to find the coach and reset it.
import { speedLimitFor } from './trainSimulation.js';

export const INCIDENT_RULES = {
  tsrKmh: 30,
  tsrLength: [250, 550],
  cautionBefore: 800, // GR 15.09(1)(d): at least 800 m before the obstruction
  speedBoardBefore: 30, // GR 15.09(1)(d)
  terminationP: 600, // beyond the end: longest passenger train (assumption)
  terminationG: 700, // longest goods train (assumption)
  autoWaitDay: 60, // GR 9.02(1)
  autoWaitNight: 120,
  autoKmhObscured: 8, // GR 9.02(3)
  autoKmhClear: 15, // game assumption
  acpResetSeconds: 120, // game assumption
  occasionalChance: 0.5,
};

export const INCIDENT_MODES = ['off', 'occasional', 'always'];

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function nearStation(stations, a, b, margin) {
  return stations.some((st) => b > st.platformStart - margin && a < st.platformEnd + margin);
}

/** Pick a site for a temporary restriction; null when the route has no room. */
function planTsr(route, rand, blocked) {
  const R = INCIDENT_RULES;
  const start = route.journey.startDistance;
  const end = route.journey.stopMarker;
  for (let i = 0; i < 80; i++) {
    const len = R.tsrLength[0] + rand() * (R.tsrLength[1] - R.tsrLength[0]);
    const from = start + 900 + R.cautionBefore + rand() * (end - start);
    const to = from + len;
    const boardsTo = to + R.terminationG;
    if (boardsTo > end - 400) continue;
    if (nearStation(route.stations, from - R.cautionBefore, boardsTo, 250)) continue;
    if (speedLimitFor(route.speedLimits, from - R.cautionBefore, to) < R.tsrKmh + 20) continue;
    const boardS = [from - R.cautionBefore, from - R.speedBoardBefore, to + R.terminationP, to + R.terminationG];
    if (boardS.some((s) => blocked(s))) continue;
    return { from: Math.round(from), to: Math.round(to), kmh: R.tsrKmh, reason: 'Caution order: P-way work' };
  }
  return null;
}

/** Boards for a restriction: caution indicator, speed indicator, T/P and T/G. */
export function tsrBoards(tsr) {
  if (!tsr) return [];
  const R = INCIDENT_RULES;
  return [
    { s: tsr.from - R.cautionBefore, kind: 'caution', label: '' },
    { s: tsr.from - R.speedBoardBefore, kind: 'tsrSpeed', label: String(tsr.kmh) },
    { s: tsr.to + R.terminationP, kind: 'termination', label: 'T/P' },
    { s: tsr.to + R.terminationG, kind: 'termination', label: 'T/G' },
  ];
}

/**
 * Decide this run's incidents.
 * @param route   built route ({ journey, stations, speedLimits, double })
 * @param opts    { seed, mode: 'off'|'occasional'|'always', passenger (bool),
 *                  coachCount, night (bool), autoSignals: [{ s, name }],
 *                  blocked(s) → true where no board can stand (tunnel/bridge) }
 */
export function planIncidents(route, { seed = 1, mode = 'off', passenger = true, coachCount = 12, night = false, autoSignals = [], blocked = () => false } = {}) {
  const st = createIncidentState();
  if (!INCIDENT_MODES.includes(mode) || mode === 'off') return st;
  const rand = seeded(seed);
  const R = INCIDENT_RULES;
  const start = route.journey.startDistance;
  const end = route.journey.stopMarker;

  const kinds = [];
  const tsr = planTsr(route, rand, blocked);
  if (tsr) kinds.push('tsr');
  // an automatic signal well clear of the start, so its approach aspects are seen
  const autos = route.double ? autoSignals.filter((sg) => sg.s > start + 1800 && sg.s < end - 600) : [];
  if (autos.length) kinds.push('signal');
  // alarm chain: passenger trains only, mid-section, off bridges and out of tunnels
  let acpS = null;
  if (passenger) {
    for (let i = 0; i < 60 && acpS === null; i++) {
      const s = start + 1200 + rand() * (end - start - 2400);
      if (!nearStation(route.stations, s - 900, s + 1500, 0) && !blocked(s) && !blocked(s - 400)) acpS = Math.round(s);
    }
    if (acpS !== null) kinds.push('acp');
  }

  let chosen = kinds;
  if (mode === 'occasional') chosen = rand() < R.occasionalChance && kinds.length ? [kinds[Math.floor(rand() * kinds.length)]] : [];

  if (chosen.includes('tsr')) {
    st.tsr = { ...tsr, maxOverKmh: 0 };
    st.boards = tsrBoards(tsr);
  }
  if (chosen.includes('signal')) {
    const sg = autos[Math.floor(rand() * autos.length)];
    st.failedSignal = { s: sg.s, name: sg.name, waitS: night ? R.autoWaitNight : R.autoWaitDay, codeSounded: false, passed: false };
  }
  if (chosen.includes('acp')) {
    st.acp = { s: acpS, coach: 1 + Math.floor(rand() * Math.max(1, coachCount)), phase: 'pending', resetLeft: R.acpResetSeconds, codeSounded: false };
  }
  return st;
}

export function createIncidentState() {
  return { tsr: null, boards: [], failedSignal: null, acp: null, restriction: null };
}

/** The route's speed restrictions plus this run's caution order. */
export function runSpeedLimits(base, st) {
  return st?.tsr ? [...base, st.tsr] : base;
}

/** Extra speed ceiling (km/h) at the front after passing a failed automatic signal. */
export function incidentLimitAt(st, front) {
  const r = st?.restriction;
  return r && front < r.to ? r.kmh : Infinity;
}

/** Inputs the incidents give the physics: the alarm-chain vent valve. */
export function incidentInputs(st) {
  const p = st?.acp?.phase;
  return { ventBp: p === 'venting' || p === 'resetting' };
}

/**
 * The train passed the failed automatic signal with authority (after the wait).
 * nextStopSignalS = the next stop signal ahead; the restriction ends there.
 */
export function startCautiousRun(st, { signalS, nextStopSignalS, obscured }) {
  const R = INCIDENT_RULES;
  if (st.failedSignal) st.failedSignal.passed = true;
  st.restriction = { from: signalS, to: nextStopSignalS ?? signalS + 1500, kmh: obscured ? R.autoKmhObscured : R.autoKmhClear };
  return st.restriction;
}

/**
 * Advance one step.
 * ctx: { front, rear, speed (m/s), dt, hornCode (finished code or null),
 *        waitingAtFailed (bool: stopped in rear of the failed signal) }
 * Returns events: [{ type: 'acpPulled' | 'acpStopped' | 'acpReset' | 'restrictionEnded' | 'acpCode' | 'signalCode' }]
 */
export function updateIncidents(st, ctx) {
  const ev = [];
  const { front, rear = front, speed, dt, hornCode } = ctx;
  if (st.tsr) {
    const inZone = speedLimitFor([st.tsr], rear, front) < Infinity;
    if (inZone) st.tsr.maxOverKmh = Math.max(st.tsr.maxOverKmh, speed * 3.6 - st.tsr.kmh);
  }
  const a = st.acp;
  if (a) {
    if (a.phase === 'pending' && front >= a.s && speed > 4) {
      a.phase = 'venting';
      ev.push({ type: 'acpPulled' });
    } else if (a.phase === 'venting' && speed < 0.1) {
      a.phase = 'resetting';
      ev.push({ type: 'acpStopped' });
    } else if (a.phase === 'resetting') {
      a.resetLeft = Math.max(0, a.resetLeft - dt);
      if (a.resetLeft === 0) {
        a.phase = 'done';
        ev.push({ type: 'acpReset' });
      }
    }
    if (hornCode && (a.phase === 'venting' || a.phase === 'resetting') && /o o --/.test(hornCode) && !a.codeSounded) {
      a.codeSounded = true;
      ev.push({ type: 'acpCode' });
    }
  }
  const f = st.failedSignal;
  if (f && !f.passed && hornCode && /-----/.test(hornCode) && ctx.waitingAtFailed && !f.codeSounded) {
    f.codeSounded = true;
    ev.push({ type: 'signalCode' });
  }
  if (st.restriction && front >= st.restriction.to) {
    st.restriction = null;
    ev.push({ type: 'restrictionEnded' });
  }
  return ev;
}

/** For the run card. */
export function summarizeIncidents(st) {
  if (!st) return [];
  const out = [];
  if (st.tsr) {
    const over = st.tsr.maxOverKmh;
    out.push({ kind: 'tsr', title: `Caution order · ${st.tsr.kmh} km/h at km ${(st.tsr.from / 1000).toFixed(1)}`, ok: over <= 1, note: over > 1 ? `exceeded by ${Math.round(over)} km/h` : 'observed' });
  }
  if (st.failedSignal) {
    const f = st.failedSignal;
    out.push({ kind: 'signal', title: `${f.name} failed at 'On' (GR 9.02)`, ok: f.passed, note: f.passed ? (f.codeSounded ? "waited, whistled '-----', passed with authority" : 'waited and passed with authority (no whistle code)') : 'not passed with authority' });
  }
  if (st.acp && st.acp.phase !== 'pending') {
    out.push({ kind: 'acp', title: `Alarm chain pulled · coach ${st.acp.coach}`, ok: st.acp.phase === 'done', note: st.acp.codeSounded ? "stopped, whistled 'o o --'" : 'stopped (no whistle code)' });
  }
  return out;
}

// Where the rail joints are and where every axle of the train is.
// Pure functions (no Web Audio, no Three.js) so they're unit-tested.
//
// Why this matters: the famous Indian Railways "dhak-dhak … dhak-dhak" is not
// a recording played on a loop. It is every wheelset of the train hitting
// every rail joint, so its rhythm depends on speed AND on the bogie geometry:
//   • WAP-7 Co-Co bogie: three axles 1.85 m apart → "da-da-dak"
//   • LHB FIAT bogie:    two axles 2.56 m apart  → "da-dak"
//   • ICF bogie:         two axles 2.896 m apart
//   • 13 m rails (fishplated) vs. long welded rail (joints only every ~250 m)
// The audio engine asks this module "when does each axle reach its next
// joint?" and schedules a single wheel-impact sample for each, sample-exact.
import { FORMATION, COACH_TYPES } from '../config/gameConfig.js';
import { onRouteChange } from '../routes/activeRoute.js';

/**
 * Rail joints along the player's line (route.railJoints):
 * - Fishplated 13 m rails everywhere by default (the classic sound).
 * - Long-welded-rail (LWR) stretches only have a joint (switch expansion
 *   joint / glued joint) every `lwrSpacing` metres.
 * - Turnouts at station throats add a heel joint and a much heavier frog
 *   (crossing-nose) impact.
 */
export let RAIL_JOINTS = null; // the active route's joints (built in routes/buildRoute.js)
onRouteChange((r) => {
  RAIL_JOINTS = r.railJoints;
});

/** Every special (non-grid) joint, sorted: { s, kind: 'heel' | 'frog' | 'lc' }. */
export function specialJoints(cfg = RAIL_JOINTS) {
  if (!cfg) return [];
  const list = [];
  for (const [heel, frog] of cfg.turnouts) {
    list.push({ s: heel, kind: 'heel' }, { s: frog, kind: 'frog' });
  }
  for (const s of cfg.levelCrossings) list.push({ s: s - 4, kind: 'lc' }, { s: s + 4, kind: 'lc' });
  return list.sort((a, b) => a.s - b.s);
}

function lwrAt(s, cfg) {
  for (const r of cfg.lwr) if (s >= r.from && s < r.to) return r;
  return null;
}

/**
 * The first joint strictly beyond `s` in direction `dir` (+1 forward, −1 back).
 * Returns { s, kind } where kind is 'joint' for ordinary rail joints.
 */
export function nextJoint(s, dir, cfg = RAIL_JOINTS, specials = specialJoints(cfg)) {
  cfg ??= RAIL_JOINTS;
  const eps = 1e-6;
  // periodic grid (13 m, or sparse inside LWR stretches)
  const r = lwrAt(s, cfg);
  const sp = r ? cfg.lwrSpacing : cfg.spacing;
  const anchor = r ? r.from : 0;
  let grid = dir > 0 ? anchor + (Math.floor((s - anchor) / sp + eps) + 1) * sp : anchor + (Math.ceil((s - anchor) / sp - eps) - 1) * sp;
  // don't skip over the edge of an LWR stretch: the grid changes there
  for (const lr of cfg.lwr) {
    if (dir > 0 && s < lr.from && grid > lr.from) grid = lr.from;
    if (dir > 0 && r === lr && grid > lr.to) grid = Math.ceil(lr.to / cfg.spacing) * cfg.spacing;
    if (dir < 0 && s > lr.to && grid < lr.to) grid = lr.to;
    if (dir < 0 && r === lr && grid < lr.from) grid = Math.floor(lr.from / cfg.spacing) * cfg.spacing;
  }
  let best = { s: grid, kind: 'joint' };
  for (const j of specials) {
    if (dir > 0 && j.s > s + eps && j.s < best.s) best = j;
    if (dir < 0 && j.s < s - eps && j.s > best.s) best = j;
  }
  return best;
}

/**
 * Every axle of the player's train as a distance behind the locomotive front.
 * Returns [{ offset, vehicle, bogie, axle, kind: 'loco' | 'coach', vehicleCenter }].
 */
export function trainAxles(coachType = 'lhb', coachCount = FORMATION.coachCount) {
  const axles = [];
  const loco = FORMATION.locomotive;
  const add = (vehicle, center, spec, kind) => {
    for (const [bogie, sign] of [
      [0, 1],
      [1, -1],
    ]) {
      const bogieCenter = center - (sign * spec.bogieSpacing) / 2; // offsets grow towards the rear
      // front-most axle of each bogie first
      const offs = [...spec.axleOffsets].sort((a, b) => b - a);
      offs.forEach((ax, axle) => axles.push({ offset: bogieCenter - ax, vehicle, bogie, axle, kind, vehicleCenter: center }));
    }
  };
  add(0, loco.length / 2, loco, 'loco');
  const ct = COACH_TYPES[coachType] ?? COACH_TYPES.lhb;
  const gap = ct.gap ?? FORMATION.couplingGap;
  let back = loco.length;
  for (let i = 0; i < coachCount; i++) {
    back += gap;
    add(i + 1, back + ct.length / 2, ct, 'coach');
    back += ct.length;
  }
  return axles.sort((a, b) => a.offset - b.offset);
}

/**
 * Seconds until an axle currently at `axleS` (moving at v m/s in direction dir)
 * reaches `jointS`. Infinity when stopped or the joint is behind.
 */
export function timeToJoint(axleS, jointS, v, dir) {
  if (v <= 0.05) return Infinity;
  const d = (jointS - axleS) * dir;
  return d < 0 ? Infinity : d / v;
}

/**
 * WAP-7 traction converter tone. The three-phase drive switches its pulse
 * pattern as the motor frequency rises, so the whine climbs and then drops
 * back in steps — the "singing" of Indian three-phase locos when they start.
 * Returns { freq (Hz), pulses } for a train speed in m/s.
 */
export function inverterTone(v) {
  const motorHz = 2.2 + v * 3.1; // stator frequency ≈ proportional to speed (+ slip)
  const modes = [
    [0, 27],
    [12, 21],
    [22, 15],
    [36, 9],
    [56, 5],
    [80, 3],
  ];
  let pulses = 1;
  for (const [hz, n] of modes) if (motorHz >= hz) pulses = n;
  return { freq: motorHz * pulses, pulses, motorHz };
}

/** Equal-power weights for speed bands (log-speed interpolation between neighbours). */
export function bandWeights(bands, kmh) {
  const w = bands.map(() => 0);
  if (bands.length === 1) {
    w[0] = 1;
    return w;
  }
  if (kmh <= bands[0].speed) {
    w[0] = 1;
    return w;
  }
  if (kmh >= bands.at(-1).speed) {
    w[bands.length - 1] = 1;
    return w;
  }
  for (let i = 0; i < bands.length - 1; i++) {
    const a = bands[i].speed;
    const b = bands[i + 1].speed;
    if (kmh >= a && kmh <= b) {
      const t = b > a ? (Math.log(kmh) - Math.log(a)) / (Math.log(b) - Math.log(a)) : 1;
      w[i] = Math.cos((t * Math.PI) / 2);
      w[i + 1] = Math.sin((t * Math.PI) / 2);
    }
  }
  return w;
}


// ------------------------------------------------------------- Doppler
export const SPEED_OF_SOUND = 343; // m/s in air at 20 °C

/**
 * Doppler pitch factor for a moving source and a moving listener (classical
 * formula f' = f · (c + v_listener→source) / (c − v_source→listener)).
 * Positions {x, z} in metres, velocities {x, z} in m/s. The factor is > 1
 * while the two approach and < 1 while they separate.
 */
export function dopplerFactor(srcPos, srcVel, lisPos, lisVel, c = SPEED_OF_SOUND) {
  const dx = lisPos.x - srcPos.x;
  const dz = lisPos.z - srcPos.z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-6) return 1;
  const ux = dx / d;
  const uz = dz / d; // unit vector source → listener
  const vs = srcVel.x * ux + srcVel.z * uz; // source speed towards the listener
  const vl = -(lisVel.x * ux + lisVel.z * uz); // listener speed towards the source
  const f = (c + vl) / (c - Math.min(vs, c * 0.9));
  return Math.min(2, Math.max(0.5, f));
}

/**
 * The point of a train occupying [sMin, sMax] (route distance) nearest to a
 * listener at route distance s — where most of its rolling noise comes from.
 */
export function nearestOnSpan(s, sMin, sMax) {
  return Math.min(sMax, Math.max(sMin, s));
}

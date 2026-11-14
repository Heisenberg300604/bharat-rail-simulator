// Central place for tunable numbers. Change values here, not inside components.
// All distances are metres, speeds m/s unless the name says Kmh, times seconds.

export const KMH_PER_MPS = 3.6;

// ---------------------------------------------------------------------------
// Route data lives in src/game/routes/ (one file per route). These are LIVE
// re-exports of the active route: they change when the player picks another
// route, and every importer sees the new values (ES-module live bindings).
// ---------------------------------------------------------------------------
export { ROUTE, ROUTE_SEGMENTS, STATIONS, JOURNEY, SPEED_LIMITS, AI_TRAINS, PARKED_TRAINS, ROAD, LEVEL_CROSSINGS, SIGNALS, BRIDGES, TUNNELS, DOUBLE_LINE } from '../routes/activeRoute.js';
export { DOWN_LINE_OFFSET } from '../routes/stationLayouts.js';
export { YARD_TRANSITION } from '../routes/buildRoute.js';
import ndlsGzb from '../routes/ndls-gzb.js';
/** The original LC-42 on the Delhi route (kept for the unit tests). */
export const LEVEL_CROSSING = { ...ndlsGzb.levelCrossings[1], farLateral: -150 };

// ---------------------------------------------------------------------------
// Train physics — based on published Indian Railways / RDSO figures
// (WAP-7 + LHB rake). Values are approximate; see docs/SIMULATION.md.
// Units: kN, tonnes, m/s, kg/cm² (brake pressures), seconds.
// ---------------------------------------------------------------------------
export const TRAIN = {
  loco: { massT: 123, rotFactor: 1.15, axles: 6 },
  coach: { massT: 50, rotFactor: 1.04 }, // LHB AC 3-tier tare ≈45 t + passengers
  // Traction: TE(v) = lever × min(322 kN, power / v)
  startingTE_kN: 322,
  power_kW: 4500,
  teRamp_kNps: 50, // how fast actual effort follows the lever
  leverRate: 0.45, // TE/BE lever travel per second while W/S held
  // Regenerative (electric) braking on the same lever, fading below 10 km/h
  regenMax_kN: 260,
  regenFadeBelowKmh: 10,
  // RDSO resistance (kgf per tonne, V in km/h)
  coachRes: [0.6855, 0.02112, 0.000082],
  locoRes: [0.647 + 13.17 / 20.5, 0.00933, 0.057 / (20.5 * 6)],
  startResCoach_kgpt: 4,
  startResLoco_kgpt: 6,
  curveRes_kgpt_R: 700, // curve resistance = 700 / radius(m) kgf/t
  // A9 automatic air brake (brake pipe BP, brake cylinder BC, kg/cm²)
  bpNormal: 5.0,
  bpMinReduction: 4.4,
  bpFullService: 3.4,
  bpChargeRate: 1.5,
  bpServiceRate: 0.7,
  bpEmergencyRate: 8,
  bcServiceMax: 3.0,
  bcEmergencyMax: 3.8,
  bcPerBpDrop: 2.14, // BC ≈ 2.14 × (5.0 − BP − 0.1)
  signalTau: 0.7, // brake signal propagation down the train (s)
  bcApplyTau: 1.5,
  bcReleaseTau: 5,
  decelAtEmergency: 0.7, // m/s² on level track at full emergency BC
  brakeHandleRate: 0.55, // A9 handle travel per second while Space/X held
  tractionCutBp: 4.75, // traction interlock: no power while BP below this
  // Limits
  sectionalSpeedKmh: 110,
  designMaxKmh: 140,
  locoMaxKmh: 140, // traction cuts off above the loco's maximum service speed
  directionChangeMaxSpeed: 0.1,
  stopSnapSpeed: 0.03,
};

// Locomotives the player can drive. Both are Indian three-phase electric
// locos built by CLW on the same body (21 m, 123 t, Co-Co); they differ in
// gearing: the WAP-7 is geared for 140 km/h passenger work, the WAG-9 for
// heavy freight (much more pulling force, but only 100 km/h).
// `physics` overrides values in TRAIN.
export const LOCOMOTIVES = {
  wap7: {
    label: 'WAP-7 · passenger',
    model: 'wap7.glb',
    horn: null, // default horn id from public/assets/audio/horns/horns.json
    physics: {},
  },
  wag9: {
    label: 'WAG-9 · freight',
    model: 'wag9.glb',
    horn: null,
    physics: { startingTE_kN: 460, power_kW: 4350, regenMax_kN: 260, locoMaxKmh: 100, teRamp_kNps: 70 },
  },
};

/**
 * What the player's locomotive hauls (the "Coaches" picker). `massT` is per
 * vehicle, loaded: a BOXN full of coal weighs ~81 t against ~50 t for a
 * passenger coach, so the freight train is three times heavier.
 */
export const CONSISTS = {
  icfBlue: { label: 'Classic Blue ICF (Mail/Express)', type: 'icf', livery: 'icfBlue', count: 8, massT: 50, passenger: true },
  red: { label: 'Red-grey LHB (standard)', type: 'lhb', livery: 'lhb', count: 8, massT: 50, passenger: true },
  freight: { label: 'Freight: BOXN coal wagons', type: 'boxn', livery: 'boxn', count: 20, massT: 81, passenger: false },
};
/** The consist for a picker value; unknown/retired values (e.g. old 'blue') fall back to LHB. */
export function consistFor(id) {
  return CONSISTS[id] ?? CONSISTS.red;
}

/** TRAIN with the chosen locomotive's figures (and the consist's vehicle mass) applied. */
export function trainConfigFor(locoId, consistId) {
  const cfg = { ...TRAIN, ...(LOCOMOTIVES[locoId]?.physics ?? {}) };
  if (consistId) cfg.coach = { ...cfg.coach, massT: consistFor(consistId).massT };
  return cfg;
}

export const FIXED_TIMESTEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.1; // ignore larger browser hiccups

// ---------------------------------------------------------------------------
// Train formation (dimensions approximate a WAP-7 locomotive and LHB coaches)
// ---------------------------------------------------------------------------
export const FORMATION = {
  locomotive: { length: 20.56, width: 3.15, bogieSpacing: 12.0, wheelRadius: 0.546, axleOffsets: [-1.85, 0, 1.85] },
  coach: { length: 23.54, width: 3.24, bogieSpacing: 14.9, wheelRadius: 0.4575, axleOffsets: [-1.28, 1.28] },
  coachCount: 8,
  couplingGap: 0.5, // LHB: 23.54 m body, 24.0 m between coupler faces → ~0.46 m
};

// Coach types. LHB: modern (Germany-designed, 2000s+). ICF: the classic
// Integral Coach Factory design, still common in blue livery.
export const COACH_TYPES = {
  lhb: { length: 23.54, bogieSpacing: 14.9, wheelRadius: 0.4575, axleOffsets: [-1.28, 1.28], gap: 0.5 },
  icf: { length: 21.337, bogieSpacing: 14.783, wheelRadius: 0.4575, axleOffsets: [-1.448, 1.448], gap: 0.7 },
  // BOXN open wagon (bulk coal/ore), CASNUB bogies, centre-buffer couplers
  boxn: { length: 10.713, bogieSpacing: 6.524, wheelRadius: 0.5, axleOffsets: [-1.0, 1.0], gap: 0.3 },
};

// Livery colours (primary body, secondary band). Applied per vehicle instance,
// so one coach model serves every scheme.
export const LIVERIES = {
  wap7: { paint: '#f2f2ee', paint2: '#d8232a' }, // white body, red waist band (procedural fallback only)
  lhb: { paint: '#d8262b', paint2: '#b9bdc1' }, // standard red-grey LHB scheme
  lhbBlue: { paint: '#1f4f9a', paint2: '#b9bdc1' }, // blue-grey (Shatabdi-style)
  icfBlue: { paint: '#24448f', paint2: '#a9d3e0' }, // classic ICF: dark blue body, pale-blue window band
};

// ---------------------------------------------------------------------------
// Track geometry. Indian broad gauge = 1676 mm.
// ---------------------------------------------------------------------------
export const TRACK = {
  gauge: 1.676,
  ballastTop: 0.35,
  sleeperTop: 0.5,
  railHeight: 0.16,
  sleeperSpacing: 0.7,
  get railTop() {
    return this.sleeperTop + this.railHeight;
  },
};

// Graphics presets. "low" targets Intel UHD/Iris laptops (i5/i7 integrated
// graphics); "high" targets Apple Silicon and discrete GPUs. Resolution is
// additionally adjusted automatically at runtime to hold the frame rate.
export const QUALITY_PRESETS = {
  low: {
    label: 'Low (integrated GPUs)',
    maxDpr: 1,
    minDpr: 0.6,
    antialias: false,
    shadows: false,
    shadowMapSize: 1024,
    environment: false,
    fogFar: 1000,
    cameraFar: 1300,
    sceneryDensity: 0.45,
    crowdDensity: 0.45,
    detailDistance: 450, // sleepers/small props drawn within this distance
    sceneryDistance: 1000,
  },
  medium: {
    label: 'Medium',
    maxDpr: 1.25,
    minDpr: 0.7,
    antialias: true,
    shadows: true,
    shadowMapSize: 1024,
    environment: true,
    fogFar: 1500,
    cameraFar: 1900,
    sceneryDensity: 0.75,
    crowdDensity: 0.75,
    detailDistance: 650,
    sceneryDistance: 1500,
  },
  high: {
    label: 'High',
    maxDpr: 1.5, // spec: pixel ratio capped at 1.5
    minDpr: 0.8,
    antialias: true,
    shadows: true,
    shadowMapSize: 2048,
    environment: true,
    fogFar: 2200,
    cameraFar: 2600,
    sceneryDensity: 1,
    crowdDensity: 1,
    detailDistance: 900,
    sceneryDistance: 2200,
  },
};

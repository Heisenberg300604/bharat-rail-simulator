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
  bpAlarmVentRate: 0.5, // kg/cm²/s through an alarm-chain vent valve (game assumption: slower than an emergency application)
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
  // Wave 3 fleet. Figures from the IRFCA electric-loco FAQ and Wikipedia (see
  // docs/ASSET_CREDITS.md). `standIn`: no licensed model in the repo yet, so
  // the pickers hide them until the GLB is dropped into
  // public/assets/models/locomotive/ — or the player ticks "show stand-in
  // locos", which drives them with the procedural body in their livery.
  wap5: {
    label: 'WAP-5 · 160 km/h',
    model: 'wap5.glb',
    standIn: true, // hidden from the pickers until wap5.glb exists (or the player opts in)
    livery: 'wap5',
    horn: null,
    // Bo-Bo, 78 t, 258 kN starting TE, 4,474 kW, 160 km/h, regen 160 kN
    physics: { loco: { massT: 78, rotFactor: 1.15, axles: 4 }, startingTE_kN: 258, power_kW: 4474, regenMax_kN: 160, locoMaxKmh: 160, teRamp_kNps: 45 },
  },
  wap4: {
    label: 'WAP-4 · classic DC, no regen',
    model: 'wap4.glb', // "WAP-4 | Indian Electric Engine Locomotive" by Prabhu Ram (virtualmakes), CC BY 4.0
    livery: 'wap4',
    length: 18.75, // model scaled to the real 18,794 mm over buffers
    ownRunningGear: true, // the model has its own bogies and wheels
    horn: null,
    // Co-Co, 112.8 t, 302 kN starting TE, 3,766 kW, 140 km/h, no regenerative braking
    physics: { loco: { massT: 112.8, rotFactor: 1.15, axles: 6 }, startingTE_kN: 302, power_kW: 3766, regenMax_kN: 0, locoMaxKmh: 140, teRamp_kNps: 35 },
  },
  // Heritage dual-current loco (1500 V DC / 25 kV AC, CLW 1973–79, withdrawn 2015),
  // driven here in AC mode. Figures: Wikipedia "Indian locomotive class WCAM-1".
  wcam1: {
    label: 'WCAM-1 · heritage dual-current (AC mode)',
    model: 'wcam1.glb', // "WAM-4 | Indian Electric Engine Locomotive" (actually a WCAM-1) by Prabhu Ram (virtualmakes), CC BY 4.0
    length: 18.28, // the artist's model is short for its width: scaled to the real width (3.055 m), so ~18.3 m vs 20.95 m over couplers
    ownRunningGear: true,
    horn: null,
    // Co-Co, 112.8 t; AC: 331.9 kN starting TE, 2,714 kW continuous, 120 km/h; no dynamic brakes
    physics: { loco: { massT: 112.8, rotFactor: 1.15, axles: 6 }, startingTE_kN: 331.9, power_kW: 2714, regenMax_kN: 0, locoMaxKmh: 120, teRamp_kNps: 35 },
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
  freight: { label: 'Freight: BOXN coal wagons + BVZI brake van', type: 'boxn', livery: 'boxn', count: 20, massT: 81, passenger: false, brakeVan: 'bvzi' },
  // BCNA loaded: tare 24.55 t + payload 56.73 t = 81.28 t gross (IRIMEE wagon notes)
  freightBcna: { label: 'Freight: BCNA covered wagons + BVZI brake van', type: 'bcna', livery: 'bcna', count: 20, massT: 81.28, passenger: false, brakeVan: 'bvzi' },
  // BTPN petrol tank wagons, loaded: gross 81.28 t each (IRIMEE: tare 27.0 t + payload 54.28 t)
  freightBtpn: { label: 'Freight: BTPN petrol tank wagons + BVZI brake van', type: 'btpn', livery: 'bcna', count: 20, massT: 81.28, passenger: false, brakeVan: 'bvzi' },
  // new, additive: ICF rakes with a luggage-cum-guard's van (SLR) at the rear
  icfBrick: { label: 'Heritage brick-red ICF (1955–1990s) + SLR', type: 'icf', livery: 'icfBrick', count: 8, massT: 50, passenger: true, slr: true },
  icfUtkrisht: { label: 'Utkrisht ICF, beige & maroon (2018) + SLR', type: 'icf', livery: 'icfUtkrisht', count: 8, massT: 50, passenger: true, slr: true },
};
/** Length of a locomotive (its model's real length; the default body otherwise). */
export function locoLength(id) {
  return LOCOMOTIVES[id]?.length ?? FORMATION.locomotive.length;
}

/** Locos the pickers offer: every loco with its model, plus stand-ins if the player opted in. */
export function pickableLocos(available = {}, showStandIns = false) {
  return Object.entries(LOCOMOTIVES).filter(([id, l]) => !l.standIn || available[id] || showStandIns);
}

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

/**
 * Difficulty presets: one object of flags, so the same routes serve a first-
 * time visitor and a sim driver. "pilot" is the default and is today's game.
 *   stopZoneHalf  ± metres of the stop zone (null = the route's own, 30 m)
 *   spad          passing a signal at danger: 'warn' | 'penalty' | 'end'
 *   kavach        Kavach (ATP) when the player's setting is 'auto'
 *   vcd           vigilance control device must be acknowledged
 *   adhesion      wheel slip on poor rail (wet / gradient) — sand to recover
 *   stoppingHud   show the full-service stopping distance readout
 *   hints         one-line guidance on the HUD
 */
export const DIFFICULTY = {
  trainee: {
    label: 'Trainee',
    blurb: 'Kavach guides you and brakes for you, a generous stop zone, and a red signal only warns.',
    stopZoneHalf: 45,
    spad: 'warn',
    kavach: true,
    vcd: false,
    adhesion: false,
    stoppingHud: true,
    hints: true,
  },
  pilot: {
    label: 'Loco Pilot',
    blurb: 'The standard game. Passing a red signal costs 25 points.',
    stopZoneHalf: null,
    spad: 'penalty',
    kavach: false,
    vcd: false,
    adhesion: false,
    stoppingHud: true,
    hints: true,
  },
  realistic: {
    label: 'Realistic',
    blurb: 'Tight stop zone, vigilance device, wheel slip on wet rail, no stopping-distance readout. A SPAD ends the run.',
    stopZoneHalf: 15,
    spad: 'end',
    kavach: false,
    vcd: true,
    adhesion: true,
    stoppingHud: false,
    hints: false,
  },
};
export function difficultyFor(id) {
  return DIFFICULTY[id] ?? DIFFICULTY.pilot;
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
  // BVZI brake van (guard's van at the rear of goods trains): "BVZI_ Brake_ Van_indian_train" by
  // GameChangz (krupesh2736), CC BY 4.0 — public/assets/models/stock/bvzi.glb (length from the model)
  bvzi: { length: 10.34, bogieSpacing: 5.5, wheelRadius: 0.5, axleOffsets: [-0.9, 0.9], gap: 0.3, model: 'bvzi.glb' },
  // BCNA covered wagon (bagged cement, grain, fertiliser): "Train Freight Compartment" by Prabhu Ram
  // (virtualmakes), CC BY 4.0 — stock/bcna.glb. Real (IRIMEE): 14,450 mm over couplers, 3,200 wide,
  // 4,017 high, bogie centres 9,500 mm. The model is long for its height: scaled to the real height,
  // it is 16.9 m long, and the formation uses that so wagons never overlap.
  bcna: { length: 16.89, bogieSpacing: 11.1, wheelRadius: 0.5, axleOffsets: [-1.0, 1.0], gap: 0.3, model: 'bcna.glb' },
  // BTPN bogie petrol tank wagon: "Authentic 3D Indian Petrol-Wagon Train Model" by
  // lakshyasharma11052002, CC BY 4.0 — stock/btpn.glb (3.04M → 38.6k triangles). Real (IRIMEE
  // BTPN notes): 12,420 mm over couplers, barrel 2,850 mm inside dia × 11,458 mm. The model's
  // proportions match: scaled to 12.42 m its barrel is ~2.8 m. Bogie centres measured on the
  // model (8.43 m); the length already includes the couplers, hence the small gap.
  btpn: { length: 12.42, bogieSpacing: 8.43, wheelRadius: 0.5, axleOffsets: [-1.0, 1.0], gap: 0.1, model: 'btpn.glb' },
};

// Livery colours (primary body, secondary band). Applied per vehicle instance,
// so one coach model serves every scheme.
export const LIVERIES = {
  wap7: { paint: '#f2f2ee', paint2: '#d8232a' }, // white body, red waist band (procedural fallback only)
  wap5: { paint: '#ecebe6', paint2: '#e0552d' }, // off-white body, red-orange bands (Ghaziabad shed scheme)
  wap4: { paint: '#7a1f22', paint2: '#e9d27a' }, // deep red/maroon body, yellow-cream waist band
  lhb: { paint: '#d8262b', paint2: '#b9bdc1' }, // standard red-grey LHB scheme
  lhbBlue: { paint: '#1f4f9a', paint2: '#b9bdc1' }, // blue-grey (Shatabdi-style)
  icfBlue: { paint: '#24448f', paint2: '#a9d3e0' }, // classic ICF: dark blue body, pale-blue window band
  // Historic ICF brick red (1955–1990s) and the 2018 "Utkrisht" beige & maroon
  // (colours per Wikipedia "ICF coach" / Business Standard 2018; the exact
  // stripe layout of Utkrisht is approximated as a maroon window band).
  icfBrick: { paint: '#8a3726', paint2: '#7d3022' },
  icfUtkrisht: { paint: '#d8c39a', paint2: '#6b1f26' },
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

// Central place for tunable numbers. Change values here, not inside components.
// All distances are metres, speeds m/s unless the name says Kmh, times seconds.

export const KMH_PER_MPS = 3.6;

// ---------------------------------------------------------------------------
// Route: built from straight lines and circular curves, like a real railway
// alignment. "length" is measured along the track centre line.
// This is a SHORT, FICTIONAL test route — not the real New Delhi–Ghaziabad line.
// ---------------------------------------------------------------------------
export const ROUTE_SEGMENTS = [
  { type: 'straight', length: 900 },
  { type: 'arc', length: 600, radius: 1500, turn: 'left' },
  { type: 'straight', length: 1800 },
  { type: 'arc', length: 700, radius: 2000, turn: 'right' },
  { type: 'straight', length: 1600 },
  { type: 'arc', length: 500, radius: 1800, turn: 'left' },
  { type: 'straight', length: 1900 },
]; // total 8000 m

export const STATIONS = [
  {
    id: 'ndls',
    name: 'New Delhi',
    hindi: 'नई दिल्ली',
    code: 'NDLS',
    platformStart: 30,
    platformEnd: 440,
    side: 1, // +1 = platform 1 on the left of the direction of travel
  },
  {
    id: 'gzb',
    name: 'Ghaziabad',
    hindi: 'गाज़ियाबाद',
    code: 'GZB',
    platformStart: 7240,
    platformEnd: 7660,
    side: 1,
  },
];

// Station yards: extra parallel tracks beside the main line (lateral offset in
// metres, + = left). They branch off the main line with a smooth S-curve.
// Layout (left → right): PF1 | UP main | DOWN main | island PF2/PF3 | T3 | T4 | PF4
// The line is double track: our train runs on the UP main (offset 0); trains
// in the opposite direction use the DOWN main, 5.3 m to the right.
export const DOWN_LINE_OFFSET = -5.3;
export const STATION_TRACKS = [
  { id: 'T3', offset: -17.86 },
  { id: 'T4', offset: -23.16 },
];
export const PLATFORMS = [
  // lateral range [from, to] across the track, plus which tracks it serves
  { id: '1', lat: [1.78, 10.78] },
  { id: '2 3', lat: [-7.08, -16.08] },
  { id: '4', lat: [-24.94, -32.94] },
];
export const YARD_TRANSITION = 260; // metres over which yard tracks fan out

export const JOURNEY = {
  originId: 'ndls',
  destinationId: 'gzb',
  startDistance: 410, // locomotive front position at the start
  stopMarker: 7635, // ideal locomotive front position at the destination
  stopZoneHalfLength: 30, // stop zone = marker ± this
  approachDistance: 2000, // "approaching" state begins this far before the marker
  stopHoldSeconds: 3, // must stay stopped in the zone this long
  bufferStop: 7960, // end of track at the destination
};

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
  directionChangeMaxSpeed: 0.1,
  stopSnapSpeed: 0.03,
};

// Permanent speed restrictions (route distance ranges). Like the real railway,
// a restriction applies until the REAR of the train has passed it.
export const SPEED_LIMITS = [
  { from: 0, to: 900, kmh: 30, reason: 'New Delhi yard turnouts' },
  { from: 900, to: 6650, kmh: 110, reason: 'Sectional speed' },
  { from: 6650, to: 7150, kmh: 60, reason: 'Ghaziabad approach' },
  { from: 7150, to: 8000, kmh: 30, reason: 'Ghaziabad platform' },
];

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
};

// Trains on the DOWN main (running towards New Delhi). They depart Ghaziabad
// out of the player's sight and stop at New Delhi platform 2, so the player
// meets them on the way. `departAt` = seconds after the journey starts.
export const AI_TRAINS = [
  { id: 'icf-express', type: 'icf', livery: 'icfBlue', coaches: 10, departAt: 12, startFront: 7880, stopFront: 120, maxKmh: 100 },
  { id: 'lhb-rajdhani', type: 'lhb', livery: 'lhb', coaches: 9, departAt: 230, startFront: 7880, stopFront: 520, maxKmh: 110 },
];

// Road beside the line (left side) and a manned level crossing over both tracks.
export const ROAD = { lateral: 32, from: 1250, to: 6350, width: 7 };
// Manned level crossings (Indian Railways "LC gates"): lifting booms, a
// gateman's lodge (gumti), whistle boards 600 m before each side, check rails
// through the crossing, and a cross road with traffic that queues while the
// booms are down. Gates close when a train is `closeAhead` metres away.
export const LEVEL_CROSSINGS = [
  { id: 'LC-41', s: 1120, closeAhead: 650, whistleBoard: 600 }, // just outside New Delhi
  { id: 'LC-42', s: 4200, closeAhead: 650, whistleBoard: 600 }, // open country
  { id: 'LC-43', s: 6760, closeAhead: 650, whistleBoard: 600 }, // Ghaziabad approach
];
export const LEVEL_CROSSING = { ...LEVEL_CROSSINGS[1], farLateral: -150 }; // the original one (kept for tests)

// Livery colours (primary body, secondary band). Applied per vehicle instance,
// so one coach model serves every scheme.
export const LIVERIES = {
  wap7: { paint: '#f2f2ee', paint2: '#d8232a' }, // white body, red waist band (procedural fallback only)
  lhb: { paint: '#d8262b', paint2: '#b9bdc1' }, // standard red-grey LHB scheme
  lhbBlue: { paint: '#1f4f9a', paint2: '#b9bdc1' }, // blue-grey (Shatabdi-style)
  icfBlue: { paint: '#24448f', paint2: '#a9d3e0' }, // classic ICF: dark blue body, pale-blue window band
};

// Stationary trains standing at other platforms (for atmosphere).
export const PARKED_TRAINS = [
  { line: 'ndls-T3', frontS: 430, coaches: 8, livery: 'icfBlue', type: 'icf' }, // classic blue ICF rake
  { line: 'gzb-T4', frontS: 7640, coaches: 8, livery: 'contrast', type: 'lhb' }, // opposite of the player's coach colour
];

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

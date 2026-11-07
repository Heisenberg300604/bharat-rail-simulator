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
    platformStart: 60,
    platformEnd: 330,
    side: 1, // +1 = left of the direction of travel, -1 = right
  },
  {
    id: 'gzb',
    name: 'Ghaziabad',
    hindi: 'गाज़ियाबाद',
    platformStart: 7380,
    platformEnd: 7660,
    side: 1,
  },
];

export const JOURNEY = {
  originId: 'ndls',
  destinationId: 'gzb',
  startDistance: 300, // locomotive front position at the start
  stopMarker: 7635, // ideal locomotive front position at the destination
  stopZoneHalfLength: 30, // stop zone = marker ± this
  approachDistance: 1500, // "approaching" state begins this far before the marker
  stopHoldSeconds: 3, // must stay stopped in the zone this long
  bufferStop: 7960, // end of track at the destination
};

// ---------------------------------------------------------------------------
// Train physics (a gameplay approximation, not real traction engineering)
// ---------------------------------------------------------------------------
export const TRAIN = {
  maxSpeedKmh: 100,
  maxTractionAccel: 0.5, // m/s² at full throttle from standstill
  tractionFadeAtMaxSpeed: 0.5, // traction falls to 50% at max speed
  rollingResistance: 0.008, // m/s² constant drag while moving
  airResistance: 0.00005, // × v² (m/s²)
  maxBrakeDecel: 0.9, // m/s² at full brake
  brakeResponseTime: 1.0, // seconds for the brakes to "catch up" with the handle
  throttleRate: 0.5, // throttle change per second while W/S held
  brakeRate: 0.8, // brake change per second while Space/X held
  stopSnapSpeed: 0.05, // below this (and no traction) the train is at rest
  directionChangeMaxSpeed: 0.1, // direction can only change below this speed
};

export const FIXED_TIMESTEP = 1 / 60;
export const MAX_FRAME_DELTA = 0.1; // ignore larger browser hiccups

// ---------------------------------------------------------------------------
// Train formation (dimensions approximate a WAP-7 locomotive and LHB coaches)
// ---------------------------------------------------------------------------
export const FORMATION = {
  locomotive: { length: 20.7, width: 3.1, bogieSpacing: 10.6, wheelRadius: 0.546 },
  coach: { length: 23.54, width: 3.24, bogieSpacing: 14.9, wheelRadius: 0.457 },
  coachCount: 3,
  couplingGap: 1.0,
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

export const QUALITY_PRESETS = {
  high: { label: 'High', dpr: [1, 1.5], shadows: true, fogFar: 1800, cameraFar: 2400 },
  low: { label: 'Performance', dpr: [1, 1], shadows: false, fogFar: 1100, cameraFar: 1400 },
};

// New Delhi → Ghaziabad: the original 8 km test segment. Busy double line
// across the flat Gangetic plain, a highway alongside and three manned level
// crossings. A SHORT, FICTIONAL segment — not the real alignment.
export default {
  id: 'ndls-gzb',
  meta: {
    name: 'New Delhi → Ghaziabad',
    shortName: 'Delhi Mainline',
    tagline: 'The classic: busy double line, highway and three level crossings',
    inspiredBy: 'Delhi–Howrah main line (Northern Railway)',
    region: 'Delhi NCR · Gangetic plain',
    difficulty: 'Easy',
    features: ['3 level crossings', 'Highway alongside', 'Busy traffic'],
    accent: '#d8262b',
  },
  double: true,
  segments: [
    { type: 'straight', length: 900 },
    { type: 'arc', length: 600, radius: 1500, turn: 'left' },
    { type: 'straight', length: 1800 },
    { type: 'arc', length: 700, radius: 2000, turn: 'right' },
    { type: 'straight', length: 1600 },
    { type: 'arc', length: 500, radius: 1800, turn: 'left' },
    { type: 'straight', length: 1900 },
  ], // total 8000 m
  profile: [], // flat
  theme: { stationStyle: 'delhi' },
  stations: [
    { id: 'ndls', name: 'New Delhi', hindi: 'नई दिल्ली', code: 'NDLS', platformStart: 30, platformEnd: 440, layout: 'terminal', crowd: 1.25, sound: 'city' },
    { id: 'gzb', name: 'Ghaziabad', hindi: 'गाज़ियाबाद', code: 'GZB', platformStart: 7240, platformEnd: 7660, layout: 'terminal', stopMarker: 7635 },
  ],
  journey: { startDistance: 410, approachDistance: 2000 },
  speedLimits: [
    { from: 0, to: 900, kmh: 30, reason: 'New Delhi yard turnouts' },
    { from: 900, to: 6650, kmh: 110, reason: 'Sectional speed' },
    { from: 6650, to: 7150, kmh: 60, reason: 'Ghaziabad approach' },
    { from: 7150, to: 8000, kmh: 30, reason: 'Ghaziabad platform' },
  ],
  signals: [
    { s: 460, lat: 3.8, aspect: 'green' },
    { s: 920, lat: 3.8, aspect: 'green' },
    { s: 2600, lat: 3.8, aspect: 'green' },
    { s: 4120, lat: 3.8, aspect: 'green' },
    { s: 6550, lat: 3.8, aspect: 'yellow' },
    { s: 7120, lat: 3.8, aspect: 'yellow' },
    { s: 7100, lat: -9.2, rev: true, aspect: 'green' },
    { s: 4300, lat: -9.2, rev: true, aspect: 'green' },
    { s: 2500, lat: -9.2, rev: true, aspect: 'green' },
    { s: 950, lat: -9.2, rev: true, aspect: 'green' },
  ],
  // Trains on the DOWN main (towards New Delhi). They depart Ghaziabad out of
  // the player's sight and stop at New Delhi; `departAt` = s after the start.
  aiTrains: [
    { id: 'icf-express', type: 'icf', livery: 'icfBlue', coaches: 10, departAt: 12, startFront: 7880, stopFront: 120, maxKmh: 100 },
    { id: 'lhb-rajdhani', type: 'lhb', livery: 'lhb', coaches: 9, departAt: 230, startFront: 7880, stopFront: 520, maxKmh: 110 },
    // A goods train held at New Delhi's outer signal (it can't take a platform)
    { id: 'goods-boxn', type: 'boxn', livery: 'boxn', loco: 'wag9', coaches: 28, departAt: 330, startFront: 7880, stopFront: 960, maxKmh: 65 },
  ],
  parkedTrains: [
    { line: 'ndls-T3', frontS: 430, coaches: 8, livery: 'icfBlue', type: 'icf' },
    { line: 'gzb-T4', frontS: 7640, coaches: 8, livery: 'contrast', type: 'lhb' },
  ],
  road: { lateral: 32, from: 1250, to: 6350, width: 7 },
  levelCrossings: [
    { id: 'LC-41', s: 1120, closeAhead: 650, whistleBoard: 600 },
    { id: 'LC-42', s: 4200, closeAhead: 650, whistleBoard: 600 },
    { id: 'LC-43', s: 6760, closeAhead: 650, whistleBoard: 600 },
  ],
  railJoints: {
    lwr: [{ from: 2300, to: 3800 }],
    turnouts: [
      [470, 492],
      [540, 562],
      [612, 634],
      [6860, 6882],
      [6930, 6952],
      [7010, 7032],
    ],
  },
  terrain: { noise: 0, zones: [] },
  scenery: { biome: 'plains', villages: [1700, 6400] },
};

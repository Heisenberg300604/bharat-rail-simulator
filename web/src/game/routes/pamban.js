// Mandapam → Rameswaram over the Pamban Bridge: India's sea bridge across the
// Palk Strait, with its vertical-lift navigation span, the old cantilever
// bridge alongside and the road bridge beyond. Inspired by the real line;
// condensed to 12 km and FICTIONAL in its detail.
export default {
  id: 'pamban',
  meta: {
    name: 'Mandapam → Rameswaram',
    shortName: 'Pamban Bridge',
    tagline: 'Two kilometres over open sea on the Pamban bridge, then across the island',
    inspiredBy: 'Mandapam–Rameswaram line and the Pamban bridges (Southern Railway)',
    region: 'Tamil Nadu · Palk Strait',
    difficulty: 'Easy',
    features: ['2.1 km sea bridge', 'Vertical-lift span', 'Single line', 'Halt at Pamban'],
    suggested: { timeOfDay: 'morning' },
    accent: '#2d6f8c',
  },
  double: false,
  segments: [
    { type: 'straight', length: 900 },
    { type: 'arc', length: 600, radius: 1200, turn: 'right' },
    { type: 'straight', length: 1100 },
    { type: 'arc', length: 300, radius: 3000, turn: 'left' },
    { type: 'straight', length: 2300 },
    { type: 'arc', length: 500, radius: 1000, turn: 'left' },
    { type: 'straight', length: 900 },
    { type: 'arc', length: 700, radius: 1500, turn: 'right' },
    { type: 'straight', length: 2000 },
    { type: 'arc', length: 600, radius: 2000, turn: 'left' },
    { type: 'straight', length: 2100 },
  ], // 12 000 m
  profile: [
    { s: 0, z: 3 },
    { s: 2300, z: 3 },
    { s: 2750, z: 6.5 },
    { s: 4950, z: 6.5 },
    { s: 5400, z: 3 },
    { s: 12000, z: 3 },
  ],
  theme: { stationStyle: 'coastal' },
  stations: [
    { id: 'mmm', name: 'Mandapam', hindi: 'मंडपम', regional: 'மண்டபம்', regionalScript: 'taml', code: 'MMM', platformStart: 40, platformEnd: 420, layout: 'crossing' },
    { id: 'pbm', name: 'Pamban', hindi: 'पांबन', regional: 'பாம்பன்', regionalScript: 'taml', code: 'PBM', platformStart: 5780, platformEnd: 6080, layout: 'crossing', dwell: 20 },
    { id: 'rmm', name: 'Rameswaram', hindi: 'रामेश्वरम', regional: 'இராமேஸ்வரம்', regionalScript: 'taml', code: 'RMM', platformStart: 11100, platformEnd: 11520, layout: 'terminalSingle' },
  ],
  speedLimits: [
    { from: 0, to: 900, kmh: 30, reason: 'Mandapam yard' },
    { from: 900, to: 2600, kmh: 80, reason: 'Sectional speed' },
    { from: 2600, to: 5100, kmh: 50, reason: 'Pamban bridge' },
    { from: 5100, to: 5600, kmh: 60, reason: 'Bridge approach' },
    { from: 5600, to: 6300, kmh: 30, reason: 'Pamban station' },
    { from: 6300, to: 10600, kmh: 80, reason: 'Sectional speed' },
    { from: 10600, to: 11000, kmh: 60, reason: 'Rameswaram approach' },
    { from: 11000, to: 12000, kmh: 30, reason: 'Rameswaram platform' },
  ],
  bridges: [
    { from: 2800, to: 4900, type: 'sea', span: 18.3, liftSpan: { at: 3850, length: 72.5 } },
    // the old 1914 bridge alongside (no longer used) and the road bridge beyond
    { from: 2780, to: 4920, type: 'old', span: 12.2, track: false, lat: 34, deckY: 4.2, scherzerAt: 3840 },
    { from: 2600, to: 5150, type: 'road', span: 45, track: false, lat: 420, deckY: 12, arch: 24 },
  ],
  terrain: {
    noise: 0.8,
    baseLevel: -6,
    sea: {
      level: 0,
      bed: -6,
      zones: [
        { from: -2000, to: 2300, left: 900, right: 380 },
        { from: 2550, to: 5050, left: 0, right: 0 },
        { from: 5300, to: 13500, left: 520, right: 430 },
      ],
    },
  },
  scenery: { biome: 'coastal', villages: [1300, 6600, 9000] },
  landmarks: [
    { type: 'gopuram', s: 11750, lat: 240, scale: 1 },
    { type: 'lighthouse', s: 5450, lat: -330, scale: 1 },
    { type: 'boats', s: 3850, lat: 0, count: 26, spread: 900 },
    { type: 'boats', s: 8000, lat: -700, count: 12, spread: 500 },
  ],
  parkedTrains: [
    { line: 'mmm-L', frontS: 410, coaches: 10, livery: 'icfBlue', type: 'icf' },
    { line: 'rmm-T3', frontS: 11500, coaches: 12, livery: 'lhb', type: 'lhb' },
  ],
  railJoints: { lwr: [{ from: 6400, to: 10400 }] },
  ambience: { sea: 1 },
};

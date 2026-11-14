// Mathura → Agra Cantt on the Delhi–Agra corridor of the Gatimaan Express:
// long fenced double-line straights, automatic signals, a 130 km/h line speed,
// the Yamuna bridge and the Taj Mahal on the horizon. Inspired by the real
// route; condensed to 22 km and FICTIONAL in its detail.
export default {
  id: 'gatimaan',
  meta: {
    name: 'Mathura → Agra Cantt',
    shortName: 'Gatimaan Corridor',
    tagline: 'Flat-out at 130 km/h: braking distances, automatic signals, the Yamuna and the Taj',
    inspiredBy: 'Delhi–Agra corridor of the Gatimaan Express (North Central Railway)',
    region: 'Uttar Pradesh · Braj',
    difficulty: 'Medium',
    features: ['130 km/h', 'Automatic signals', 'Yamuna bridge', 'Taj Mahal view', 'Highway alongside'],
    suggested: { weather: 'fog', timeOfDay: 'morning' },
    accent: '#3b5ba5',
  },
  double: true,
  segments: [
    { type: 'straight', length: 1400 },
    { type: 'arc', length: 900, radius: 3000, turn: 'left' },
    { type: 'straight', length: 4200 },
    { type: 'arc', length: 1000, radius: 4000, turn: 'right' },
    { type: 'straight', length: 5000 },
    { type: 'arc', length: 1200, radius: 3500, turn: 'left' },
    { type: 'straight', length: 3000 },
    { type: 'arc', length: 800, radius: 2500, turn: 'right' },
    { type: 'straight', length: 2500 },
    { type: 'arc', length: 600, radius: 1500, turn: 'left' },
    { type: 'straight', length: 1400 },
  ], // 22 000 m
  profile: [
    { s: 0, z: 170 },
    { s: 17000, z: 170 },
    { s: 17600, z: 175 },
    { s: 18700, z: 175 },
    { s: 19300, z: 170 },
    { s: 22000, z: 170 },
  ],
  theme: { stationStyle: 'agra' },
  stations: [
    { id: 'mtj', name: 'Mathura Jn', hindi: 'मथुरा जंक्शन', code: 'MTJ', platformStart: 40, platformEnd: 460, layout: 'terminal', crowd: 1.1 },
    { id: 'agc', name: 'Agra Cantt', hindi: 'आगरा छावनी', code: 'AGC', platformStart: 21100, platformEnd: 21520, layout: 'terminal', crowd: 1.2 },
  ],
  journey: { approachDistance: 3000 },
  speedLimits: [
    { from: 0, to: 1000, kmh: 30, reason: 'Mathura yard' },
    { from: 1000, to: 1700, kmh: 75, reason: 'Mathura outer' },
    { from: 1700, to: 17300, kmh: 130, reason: 'Sectional speed (Gatimaan corridor)' },
    { from: 17300, to: 18900, kmh: 100, reason: 'Yamuna bridge' },
    { from: 18900, to: 20200, kmh: 130, reason: 'Sectional speed' },
    { from: 20200, to: 20900, kmh: 60, reason: 'Agra Cantt approach' },
    { from: 20900, to: 22000, kmh: 30, reason: 'Agra Cantt platform' },
  ],
  bridges: [{ from: 17800, to: 18500, type: 'truss', span: 76, river: { level: 166, name: 'Yamuna', sandbanks: true } }],
  terrain: { noise: 1.2, zones: [{ from: 16000, to: 20000, left: { rel: -2 }, right: { rel: -2 }, ramp: 500 }] },
  scenery: { biome: 'plains', fields: 'mustard', villages: [3000, 6800, 10200, 14100] },
  landmarks: [
    { type: 'taj', s: 18700, lat: 820, scale: 1 },
    { type: 'fort', s: 20600, lat: -620, scale: 1 },
  ],
  road: { lateral: 46, from: 2600, to: 16400, width: 9 },
  aiTrains: [
    { id: 'shatabdi', type: 'lhb', livery: 'lhbBlue', coaches: 14, departAt: 60, startFront: 21880, stopFront: 150, maxKmh: 130 },
    { id: 'agra-goods', type: 'boxn', livery: 'boxn', loco: 'wag9', coaches: 36, departAt: 250, startFront: 21880, stopFront: 1100, maxKmh: 75 },
    { id: 'mail', type: 'icf', livery: 'icfBlue', coaches: 16, departAt: 420, startFront: 21880, stopFront: 540, maxKmh: 110 },
  ],
  parkedTrains: [
    { line: 'mtj-T3', frontS: 450, coaches: 10, livery: 'icfBlue', type: 'icf' },
    { line: 'agc-T4', frontS: 21500, coaches: 12, livery: 'contrast', type: 'lhb' },
  ],
  railJoints: { lwr: [{ from: 2000, to: 9000 }, { from: 10500, to: 17200 }] },
};

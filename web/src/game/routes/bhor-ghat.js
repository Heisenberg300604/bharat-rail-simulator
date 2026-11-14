// Karjat → Lonavala, "Bhor Ghat": the Mumbai–Pune climb up the Western Ghats
// (Sahyadri). Inspired by the real ghat — 1 in 37 gradients, a string of
// tunnels and tall viaducts, Khandala halt at the top — but condensed to 14 km
// and FICTIONAL in its detail. Heavy freight gets two WAG-9 bankers.
export default {
  id: 'bhor-ghat',
  meta: {
    name: 'Karjat → Lonavala',
    shortName: 'Bhor Ghat',
    tagline: 'Climb the Western Ghats at 1 in 37 through tunnels and over viaducts',
    inspiredBy: 'Mumbai–Pune line, Bhor Ghat (Central Railway)',
    region: 'Maharashtra · Western Ghats',
    difficulty: 'Hard',
    features: ['1 in 37 climb', '5 tunnels', '3 viaducts', 'Halt at Khandala', 'Bankers for freight'],
    suggested: { weather: 'rain', timeOfDay: 'morning' },
    accent: '#2f7d4f',
  },
  double: true,
  segments: [
    { type: 'straight', length: 1100 },
    { type: 'arc', length: 500, radius: 1200, turn: 'right' },
    { type: 'straight', length: 900 },
    { type: 'arc', length: 700, radius: 700, turn: 'left' },
    { type: 'straight', length: 450 },
    { type: 'arc', length: 650, radius: 650, turn: 'right' },
    { type: 'straight', length: 650 },
    { type: 'arc', length: 800, radius: 800, turn: 'left' },
    { type: 'straight', length: 500 },
    { type: 'arc', length: 600, radius: 650, turn: 'right' },
    { type: 'straight', length: 650 },
    { type: 'arc', length: 700, radius: 700, turn: 'left' },
    { type: 'straight', length: 500 },
    { type: 'arc', length: 500, radius: 900, turn: 'right' },
    { type: 'straight', length: 1500 },
    { type: 'arc', length: 600, radius: 1100, turn: 'left' },
    { type: 'straight', length: 2700 },
  ], // 14 000 m
  // elevation (m): the ghat proper climbs 1 in 37 from 2.4 km to 9.8 km
  profile: [
    { s: 0, z: 60 },
    { s: 1000, z: 60 },
    { s: 2400, z: 67 },
    { s: 5600, z: 153.5 },
    { s: 6000, z: 155.5 },
    { s: 9800, z: 258 },
    { s: 10400, z: 259 },
    { s: 12700, z: 274 },
    { s: 14000, z: 274 },
  ],
  theme: { stationStyle: 'stone' },
  stations: [
    { id: 'kjt', name: 'Karjat', hindi: 'कर्जत', code: 'KJT', platformStart: 40, platformEnd: 460, layout: 'terminal' },
    { id: 'khi', name: 'Khandala', hindi: 'खंडाला', regional: 'खंडाळा', regionalScript: 'deva', code: 'KHI', platformStart: 9960, platformEnd: 10240, layout: 'halt', dwell: 20 },
    { id: 'lnl', name: 'Lonavala', hindi: 'लोनावला', regional: 'लोणावळा', regionalScript: 'deva', code: 'LNL', platformStart: 13300, platformEnd: 13720, layout: 'terminal' },
  ],
  speedLimits: [
    { from: 0, to: 900, kmh: 30, reason: 'Karjat yard' },
    { from: 900, to: 2300, kmh: 80, reason: 'Sectional speed' },
    { from: 2300, to: 9700, kmh: 45, reason: 'Ghat section (1 in 37)' },
    { from: 9700, to: 10400, kmh: 30, reason: 'Khandala' },
    { from: 10400, to: 12900, kmh: 70, reason: 'Sectional speed' },
    { from: 12900, to: 14000, kmh: 30, reason: 'Lonavala platform' },
  ],
  tunnels: [
    { from: 3280, to: 3580, name: 'Tunnel 3' },
    { from: 4450, to: 5150, name: 'Monkey Hill tunnel' },
    { from: 6920, to: 7320, name: 'Tunnel 18' },
    { from: 8260, to: 8520, name: 'Tunnel 23' },
    { from: 9300, to: 9480, name: 'Tunnel 26' },
  ],
  bridges: [
    { from: 3800, to: 4120, type: 'viaduct', depth: 34, span: 32 },
    { from: 6330, to: 6700, type: 'viaduct', depth: 55, span: 36 },
    { from: 7700, to: 7900, type: 'viaduct', depth: 24, span: 28 },
  ],
  terrain: {
    noise: 7,
    baseLevel: 55,
    zones: [
      { from: -1500, to: 2300, left: { rel: 30 }, right: { rel: 12 }, ramp: 420 },
      { from: 2300, to: 9800, left: { rel: 120 }, right: { abs: 62 }, ramp: 240 },
      { from: 9800, to: 15500, left: { rel: 35 }, right: { rel: -10 }, ramp: 420 },
    ],
  },
  scenery: { biome: 'ghats', villages: [1500, 12000] },
  landmarks: [
    { type: 'pinnacle', s: 9050, lat: 520, scale: 1.2 }, // a "Duke's Nose"-like rock spire
    { type: 'waterfall', s: 3000, lat: 120, height: 45 },
    { type: 'waterfall', s: 5600, lat: 150, height: 60 },
    { type: 'waterfall', s: 8000, lat: 140, height: 50 },
  ],
  aiTrains: [
    { id: 'deccan', type: 'lhb', livery: 'lhbBlue', coaches: 12, departAt: 45, startFront: 13900, stopFront: 150, maxKmh: 45 },
    { id: 'ghat-goods', type: 'boxn', livery: 'boxn', loco: 'wag9', coaches: 30, departAt: 320, startFront: 13900, stopFront: 1000, maxKmh: 40 },
  ],
  parkedTrains: [
    { line: 'kjt-T3', frontS: 440, coaches: 8, livery: 'icfBlue', type: 'icf' },
    { line: 'lnl-T4', frontS: 13700, coaches: 8, livery: 'contrast', type: 'lhb', loco: 'wag9' },
  ],
  // Real practice on the ghat: banking locomotives push heavy trains up.
  banker: { count: 2, loco: 'wag9', from: 0, to: 10400, minTrainMassT: 900 },
  railJoints: { lwr: [{ from: 10600, to: 12600 }] },
  ambience: { sea: 0 },
};

// Howrah → Bandel, the Bengal suburban line along the Hooghly: short runs
// between crowded halts, ponds and paddy, banana and coconut groves, level
// crossings and the Grand Trunk Road. Inspired by the real line; condensed to
// 13 km and FICTIONAL in its detail.
export default {
  id: 'howrah-bandel',
  meta: {
    name: 'Howrah → Bandel',
    shortName: 'Bengal Suburban',
    tagline: 'Stop-and-go along the Hooghly: three busy halts, ponds, paddy and level crossings',
    inspiredBy: 'Howrah–Bardhaman main line, Howrah–Bandel section (Eastern Railway)',
    region: 'West Bengal · Hooghly',
    difficulty: 'Medium',
    features: ['3 halts', 'Dwell & punctuality', 'Level crossings', 'Hooghly river'],
    suggested: { timeOfDay: 'evening' },
    accent: '#a8432f',
  },
  double: true,
  segments: [
    { type: 'straight', length: 1000 },
    { type: 'arc', length: 700, radius: 1200, turn: 'right' },
    { type: 'straight', length: 1800 },
    { type: 'arc', length: 600, radius: 1500, turn: 'left' },
    { type: 'straight', length: 2600 },
    { type: 'arc', length: 500, radius: 1300, turn: 'right' },
    { type: 'straight', length: 2500 },
    { type: 'arc', length: 600, radius: 1600, turn: 'left' },
    { type: 'straight', length: 2700 },
  ], // 13 000 m
  profile: [{ s: 0, z: 8 }],
  theme: { stationStyle: 'bengal' },
  stations: [
    { id: 'hwh', name: 'Howrah', hindi: 'हावड़ा', regional: 'হাওড়া', regionalScript: 'beng', code: 'HWH', platformStart: 40, platformEnd: 460, layout: 'terminal', crowd: 1.4, sound: 'city' },
    { id: 'bly', name: 'Belur', hindi: 'बेलूड़', regional: 'বেলুড়', regionalScript: 'beng', code: 'BEQ', platformStart: 2900, platformEnd: 3160, layout: 'halt', crowd: 1.3 },
    { id: 'srp', name: 'Shrirampur', hindi: 'श्रीरामपुर', regional: 'শ্রীরামপুর', regionalScript: 'beng', code: 'SRP', platformStart: 6150, platformEnd: 6410, layout: 'halt', crowd: 1.3 },
    { id: 'cgr', name: 'Chandannagar', hindi: 'चंदननगर', regional: 'চন্দননগর', regionalScript: 'beng', code: 'CGR', platformStart: 9150, platformEnd: 9410, layout: 'halt', crowd: 1.2 },
    { id: 'bdc', name: 'Bandel Jn', hindi: 'बंडेल जंक्शन', regional: 'ব্যান্ডেল জংশন', regionalScript: 'beng', code: 'BDC', platformStart: 12300, platformEnd: 12720, layout: 'terminal', crowd: 1.2 },
  ],
  journey: { approachDistance: 1500 },
  speedLimits: [
    { from: 0, to: 900, kmh: 30, reason: 'Howrah yard' },
    { from: 900, to: 11700, kmh: 90, reason: 'Sectional speed (suburban)' },
    { from: 11700, to: 12200, kmh: 60, reason: 'Bandel approach' },
    { from: 12200, to: 13000, kmh: 30, reason: 'Bandel platform' },
  ],
  road: { lateral: 38, from: 3700, to: 10600, width: 7.5 },
  levelCrossings: [
    { id: 'LC-5', s: 4650, closeAhead: 600, whistleBoard: 600 },
    { id: 'LC-9', s: 7800, closeAhead: 600, whistleBoard: 600 },
    { id: 'LC-12', s: 10900, closeAhead: 600, whistleBoard: 600 },
  ],
  terrain: {
    noise: 1.2,
    // the Hooghly runs parallel, a few hundred metres to the right
    sea: { level: 2, bed: -3, zones: [{ from: -2000, to: 15000, left: Infinity, right: 470 }] },
  },
  scenery: { biome: 'bengal', villages: [1700, 4500, 7600, 10500] },
  landmarks: [
    { type: 'temple', s: 3200, lat: -390, scale: 1 }, // a riverside math/temple
    { type: 'church', s: 12900, lat: 320, scale: 0.8 },
    { type: 'boats', s: 6500, lat: -700, count: 18, spread: 4000 },
  ],
  aiTrains: [
    { id: 'down-local', type: 'icf', livery: 'icfBlue', coaches: 12, departAt: 30, startFront: 12880, stopFront: 520, maxKmh: 80 },
    { id: 'down-goods', type: 'boxn', livery: 'boxn', loco: 'wag9', coaches: 30, departAt: 280, startFront: 12880, stopFront: 1050, maxKmh: 60 },
  ],
  parkedTrains: [
    { line: 'hwh-T3', frontS: 440, coaches: 10, livery: 'icfBlue', type: 'icf' },
    { line: 'hwh-T4', frontS: 450, coaches: 8, livery: 'contrast', type: 'lhb' },
    { line: 'bdc-T4', frontS: 12700, coaches: 12, livery: 'icfBlue', type: 'icf' },
  ],
  railJoints: { lwr: [] },
  ambience: { sea: 0 },
};

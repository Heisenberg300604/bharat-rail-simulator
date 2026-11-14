// Station layout presets. Lateral offsets in metres, + = left of the direction
// of travel. Our train always runs on the main line (offset 0). On double
// lines the down main is at −5.3; on single lines the station's loop line is
// at −5.3 instead (that's where a train waits for a crossing).
//
// platforms: [{ id, lat: [edge nearest the tracks… far edge] }]
// tracks:    extra station tracks that fan out from the running line
// canopy:    platform shelter length (m)
// building:  'grand' (big terminus block) | 'small' (wayside station)
export const DOWN_LINE_OFFSET = -5.3;

export const STATION_LAYOUTS = {
  // Big station: PF1 | UP main | DOWN main | island PF2/3 | T3 | T4 | PF4
  terminal: {
    platforms: [
      { id: '1', lat: [1.78, 10.78] },
      { id: '2 3', lat: [-7.08, -16.08] },
      { id: '4', lat: [-24.94, -32.94] },
    ],
    tracks: [
      { id: 'T3', offset: -17.86 },
      { id: 'T4', offset: -23.16 },
    ],
    canopy: 260,
    building: 'grand',
    fob: true,
  },
  // Wayside halt on a double line: a side platform for each direction
  halt: {
    platforms: [
      { id: '1', lat: [1.78, 7.78] },
      { id: '2', lat: [-7.08, -13.08] },
    ],
    tracks: [],
    canopy: 110,
    building: 'small',
    fob: true,
  },
  // Single-line crossing station: main + loop (−5.3), a platform on each side
  crossing: {
    platforms: [
      { id: '1', lat: [1.78, 7.78] },
      { id: '2', lat: [-7.08, -13.08] },
    ],
    tracks: [{ id: 'L', offset: -5.3 }],
    canopy: 130,
    building: 'small',
    fob: true,
  },
  // Single-line terminus: main, loop and two more tracks with an island platform
  terminalSingle: {
    platforms: [
      { id: '1', lat: [1.78, 10.78] },
      { id: '2 3', lat: [-7.08, -16.08] },
      { id: '4', lat: [-24.94, -32.94] },
    ],
    tracks: [
      { id: 'L', offset: -5.3 },
      { id: 'T3', offset: -17.86 },
      { id: 'T4', offset: -23.16 },
    ],
    canopy: 220,
    building: 'grand',
    fob: true,
  },
  // Single-line halt: one platform, no loop
  haltSingle: {
    platforms: [{ id: '1', lat: [1.78, 7.78] }],
    tracks: [],
    canopy: 70,
    building: 'small',
    fob: false,
  },
};

/** Building/canopy colours. Routes override per region. */
export const STATION_STYLES = {
  delhi: { building: '#b4573f', trim: '#efe4c8', canopy: '#a33a2c', roof: '#8d9894', dome: '#efe4c8' },
  stone: { building: '#8e8a80', trim: '#e9e2d0', canopy: '#2f5d7c', roof: '#7b8a8f', dome: '#e9e2d0' },
  konkan: { building: '#b8553a', trim: '#f3ead6', canopy: '#7a3b2a', roof: '#a4492f', dome: '#f3ead6' },
  coastal: { building: '#e7c66b', trim: '#fbf4dc', canopy: '#2d6f8c', roof: '#8d9894', dome: '#fbf4dc' },
  agra: { building: '#c9785a', trim: '#f2ead8', canopy: '#8a2f2a', roof: '#8d9894', dome: '#f6f2ea' },
  bengal: { building: '#a8432f', trim: '#efe2c4', canopy: '#2e5a3a', roof: '#7d8a86', dome: '#efe2c4' },
};

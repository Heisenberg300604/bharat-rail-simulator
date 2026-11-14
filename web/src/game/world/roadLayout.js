// Where the roads are, in route coordinates (s along the line, lateral +left).
// Shared by the road builder (Road.jsx) and the scenery placer, so trees,
// buildings and fields are never put on a road.
import { ROAD, LEVEL_CROSSINGS, STATIONS } from '../config/gameConfig.js';

export const ROAD_END_VEER = 420; // metres over which the highway curves away at each end
export const CROSS_FROM = 300; // cross roads: village side (lateral +)
export const CROSS_TO = -260; // far side
export const CROSS_HALF_WIDTH = 3.8;

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Highway centre-line offset from the track: 32 m, curving away at the ends. */
export function highwayOffset(s) {
  if (!ROAD) return Infinity;
  return ROAD.lateral + 360 * (smoothstep(ROAD.from, ROAD.from - ROAD_END_VEER, s) + smoothstep(ROAD.to, ROAD.to + ROAD_END_VEER, s));
}

/** Lateral span [lo, hi] of a level crossing's cross road, clipped away from station platforms. */
export function crossRoadSpan(lc) {
  const nearStation = STATIONS.some((st) => lc.s > st.platformStart - 120 && lc.s < st.platformEnd + 120);
  return nearStation ? [CROSS_TO * 0.5, CROSS_FROM * 0.5] : [CROSS_TO, CROSS_FROM];
}

/**
 * Clearance (metres) between a round object of `radius` at (s, lat) and the
 * nearest road edge. Negative → it would sit on a road.
 */
export function roadClearance(s, lat, radius = 0) {
  let best = Infinity;
  if (ROAD && s > ROAD.from - ROAD_END_VEER && s < ROAD.to + ROAD_END_VEER) {
    best = Math.min(best, Math.abs(lat - highwayOffset(s)) - ROAD.width / 2 - radius);
  }
  for (const lc of LEVEL_CROSSINGS) {
    const [lo, hi] = crossRoadSpan(lc);
    if (lat > lo - radius && lat < hi + radius) best = Math.min(best, Math.abs(s - lc.s) - CROSS_HALF_WIDTH - radius);
  }
  return best;
}

/** True if a footprint of `radius` (plus a verge) at (s, lat) would touch a road. */
export function onRoad(s, lat, radius = 0, verge = 2.5) {
  return roadClearance(s, lat, radius) < verge;
}

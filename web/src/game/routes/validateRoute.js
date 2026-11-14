// Sanity checks for a built route. Run as a unit test for every route, so a
// typo in a route file fails `npm test` instead of producing a broken world.
// Returns a list of problems (empty = valid).
import { yardTrackSpans } from './buildRoute.js';

/** Elevation of the road network (highway + level crossings). */
export function roadBaseHeight(r) {
  const s = r.road ? (r.road.from + r.road.to) / 2 : r.levelCrossings[0]?.s ?? 0;
  return r.geometry.heightAt(s);
}

export function validateRoute(r) {
  const errors = [];
  const err = (m) => errors.push(`${r.id}: ${m}`);
  const L = r.length;
  const j = r.journey;

  if (!(L >= 3000 && L <= 30000)) err(`length ${L} m outside 3–30 km`);
  if (!r.meta?.name) err('missing meta.name');
  if (r.stations.length < 2) err('needs at least two stations');

  // stations in order, inside the route, not overlapping, on level track
  r.stations.forEach((st, i) => {
    if (!(st.platformEnd > st.platformStart)) err(`${st.id}: platformEnd must be after platformStart`);
    if (st.platformStart < 0 || st.platformEnd > j.bufferStop) err(`${st.id}: platform outside the route`);
    if (i > 0 && st.platformStart < r.stations[i - 1].platformEnd + 800) err(`${st.id}: too close to ${r.stations[i - 1].id}`);
    const g = Math.max(Math.abs(r.geometry.gradeAt(st.platformStart)), Math.abs(r.geometry.gradeAt(st.platformEnd)), Math.abs(r.geometry.gradeAt(st.centerS)));
    if (g > 1 / 400) err(`${st.id}: platform must be on level track (grade 1 in ${Math.round(1 / g)})`);
    if (!st.name || !st.hindi || !st.code) err(`${st.id}: needs name, hindi and code`);
  });

  // journey
  if (!(j.startDistance > 250 && j.startDistance < r.stations[0].platformEnd + 1)) err('start position must be at the first platform');
  let prev = j.startDistance;
  for (const stop of j.stops) {
    const st = r.stations.find((s) => s.id === stop.stationId);
    if (!st) err(`stop at unknown station ${stop.stationId}`);
    else if (stop.marker < st.platformStart + 200 || stop.marker > st.platformEnd) err(`${st.id}: stop marker must let the train stand along the platform`);
    if (stop.marker <= prev + 500) err(`${stop.stationId}: stops must be in order and ≥ 500 m apart`);
    if (!(stop.scheduled > 0)) err(`${stop.stationId}: no scheduled time`);
    prev = stop.marker;
  }
  if (j.bufferStop <= j.stopMarker + 60) err('buffer stop must be beyond the final stop marker');

  // speed limits: contiguous cover of the whole route
  const lim = [...r.speedLimits].sort((a, b) => a.from - b.from);
  if (lim[0].from > 0) err('speed limits must start at 0');
  if (lim[lim.length - 1].to < L) err('speed limits must cover the whole route');
  for (let i = 1; i < lim.length; i++) if (Math.abs(lim[i].from - lim[i - 1].to) > 1e-6) err(`speed limit gap/overlap at ${lim[i].from}`);

  // structures: inside the route, not on stations, not overlapping each other
  const structures = [...r.tunnels.map((t) => ({ ...t, kind: 'tunnel' })), ...r.bridges.filter((b) => b.track !== false).map((b) => ({ ...b, kind: 'bridge' }))].sort((a, b) => a.from - b.from);
  for (const s of structures) {
    if (!(s.to > s.from)) err(`${s.kind} at ${s.from}: to must be after from`);
    if (s.from < 0 || s.to > L) err(`${s.kind} at ${s.from}: outside the route`);
    for (const st of r.stations) if (s.to > st.platformStart - 300 && s.from < st.platformEnd + 300) err(`${s.kind} at ${s.from} is too close to ${st.id}`);
  }
  for (let i = 1; i < structures.length; i++) if (structures[i].from < structures[i - 1].to + 100) err(`structures overlap near ${structures[i].from}`);

  // gradients: never steeper than 1 in 30 (Indian broad gauge ruling gradients go to 1 in 37)
  for (let s = 0; s <= L; s += 25) {
    if (Math.abs(r.geometry.gradeAt(s)) > 1 / 30) {
      err(`gradient steeper than 1 in 30 at ${s}`);
      break;
    }
  }

  // roads and level crossings stay on flat ground near the formation level
  for (const lc of r.levelCrossings) {
    if (r.tunnels.some((t) => Math.abs(lc.s - (t.from + t.to) / 2) < (t.to - t.from) / 2 + 400)) err(`${lc.id} too close to a tunnel`);
    if (Math.abs(r.geometry.gradeAt(lc.s)) > 1 / 300) err(`${lc.id} must be on level track`);
  }
  // the road network is drawn at one base height, so it needs level ground
  const roadBase = roadBaseHeight(r);
  const flat = (s) => Math.abs(r.geometry.heightAt(s) - roadBase) < 0.3;
  if (r.road) for (let s = r.road.from - 450; s <= r.road.to + 450; s += 50) if (!flat(s)) { err(`the road needs level track (at ${s})`); break; }
  for (const lc of r.levelCrossings) if (!flat(lc.s)) err(`${lc.id} is not at the road base height`);

  // parked trains on lines that exist
  const lineIds = new Set(['main', ...(r.double ? ['down'] : []), ...yardTrackSpans(r).map((sp) => `${sp.station.id}-${sp.track.id}`)]);
  for (const pt of r.parkedTrains) if (!lineIds.has(pt.line)) err(`parked train on unknown line ${pt.line}`);

  // AI trains run on the down main towards s = 0
  for (const ai of r.aiTrains) {
    if (!(ai.startFront <= j.bufferStop + 10 && ai.stopFront > 0 && ai.stopFront < ai.startFront)) err(`AI train ${ai.id}: bad start/stop`);
  }
  return errors;
}

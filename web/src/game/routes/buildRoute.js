// Turns a route definition (routes/*.js: plain data) into the full route the
// game uses: geometry, journey with stops, timetable, signals, rail joints…
// Everything a definition leaves out gets a sensible default here, so route
// files stay short. Pure JS (no Three.js / React) so it is unit-tested.
import { createRoute } from '../simulation/routeMath.js';
import { STATION_LAYOUTS, STATION_STYLES, DOWN_LINE_OFFSET } from './stationLayouts.js';
import { computeTimetable } from './timetable.js';

export const YARD_TRANSITION = 260; // metres over which yard tracks fan out
export const STOP_ZONE_HALF = 30;

const sum = (a) => a.reduce((n, x) => n + x, 0);

export function buildRoute(def) {
  const length = sum(def.segments.map((s) => s.length));
  const geometry = createRoute(def.segments, def.start ?? {}, def.profile ?? []);
  const double = def.double !== false;
  const bufferStop = def.bufferStop ?? length - 40;
  const style = STATION_STYLES[def.theme?.stationStyle] ?? STATION_STYLES.delhi;

  // ---- stations
  const stations = def.stations.map((st, i) => {
    const preset = st.layout ?? (double ? (i === 0 || i === def.stations.length - 1 ? 'terminal' : 'halt') : i === 0 || i === def.stations.length - 1 ? 'terminalSingle' : 'crossing');
    const layout = STATION_LAYOUTS[preset];
    if (!layout) throw new Error(`Unknown station layout "${preset}" at ${st.id}`);
    return {
      side: 1,
      size: layout.building === 'grand' ? 'major' : 'halt',
      dwell: 20,
      stop: true,
      ...st,
      layoutId: preset,
      layout,
      style: { ...style, ...(st.style ?? {}) },
      centerS: (st.platformStart + st.platformEnd) / 2,
      elevation: geometry.heightAt((st.platformStart + st.platformEnd) / 2),
    };
  });

  // ---- journey: start at the first station, stop at every later station marked `stop`
  const origin = stations[0];
  const destination = stations[stations.length - 1];
  const stops = stations
    .slice(1)
    .filter((st) => st.stop || st === destination)
    .map((st) => ({
      stationId: st.id,
      name: st.name,
      marker: st.stopMarker ?? st.platformEnd - 25,
      halfLength: st.stopZoneHalfLength ?? STOP_ZONE_HALF,
      dwell: st === destination ? 0 : st.dwell,
      final: st === destination,
    }));
  const finalStop = stops[stops.length - 1];
  const journey = {
    originId: origin.id,
    destinationId: destination.id,
    startDistance: def.journey?.startDistance ?? origin.platformEnd - 30,
    stopMarker: finalStop.marker,
    stopZoneHalfLength: finalStop.halfLength,
    approachDistance: def.journey?.approachDistance ?? 2000,
    stopHoldSeconds: 3,
    bufferStop,
    stops,
  };

  const speedLimits = def.speedLimits;
  const sectionalKmh = Math.max(...speedLimits.map((l) => l.kmh));

  const route = {
    id: def.id,
    meta: {
      difficulty: 'Medium',
      features: [],
      ...def.meta,
      lengthKm: length / 1000,
      maxKmh: sectionalKmh,
      stopsCount: stops.length,
    },
    segments: def.segments,
    profile: def.profile ?? [],
    geometry,
    length,
    double,
    stations,
    journey,
    speedLimits,
    road: def.road ?? null,
    levelCrossings: def.levelCrossings ?? [],
    aiTrains: double ? def.aiTrains ?? [] : [], // single line: opposing trains wait in loops (parked)
    parkedTrains: def.parkedTrains ?? [],
    bridges: (def.bridges ?? []).map((b) => ({ type: 'girder', span: 30, ...b })),
    tunnels: def.tunnels ?? [],
    terrain: { noise: 2, zones: [], ...(def.terrain ?? {}) },
    scenery: { biome: 'plains', ...(def.scenery ?? {}) },
    landmarks: def.landmarks ?? [],
    banker: def.banker ?? null,
    ambience: { sea: 0, ...(def.ambience ?? {}) },
    theme: def.theme ?? {},
  };
  route.signals = def.signals ?? autoSignals(route);
  route.railJoints = buildRailJoints(route, def.railJoints);
  route.timetable = computeTimetable(route, { maxKmh: Math.min(sectionalKmh, 120) });
  route.timetable.forEach((row, i) => (stops[i].scheduled = row.arrive));
  return route;
}

/** Where each station's yard tracks fan out from / merge into the running line. */
export function yardTrackSpans(route) {
  const spans = [];
  for (const st of route.stations) {
    st.layout.tracks.forEach((t, i) => {
      const stagger = i * 70;
      const fanStart = st.platformStart - 60 - stagger - YARD_TRANSITION; // starts diverging
      const fanEnd = st.platformEnd + 60 + stagger + YARD_TRANSITION; // fully merged again
      spans.push({
        station: st,
        track: t,
        index: i,
        base: route.double && t.offset < 0 ? DOWN_LINE_OFFSET : 0,
        fanStart,
        fanEnd,
        atStart: fanStart < 0, // terminus at the route start: track begins at s = 0
        atEnd: fanEnd > route.journey.bufferStop, // terminus at the end: runs to the buffer
      });
    });
  }
  return spans;
}

/**
 * Colour-light signals for the player's direction (left of the line, lat 3.8)
 * and a few for the opposite direction. Aspects are static: the line ahead is
 * always clear, caution (yellow) before a stop, red at the end of the line.
 */
function autoSignals(route) {
  const sigs = [];
  const revLat = route.double ? -9.2 : -3.8;
  const { stops, bufferStop } = route.journey;
  const stopsAt = new Set(stops.map((s) => s.stationId));
  for (const st of route.stations) {
    const stopping = stopsAt.has(st.id);
    const isFirst = st === route.stations[0];
    const isLast = st === route.stations[route.stations.length - 1];
    if (!isFirst) {
      if (st.platformStart - 1400 > 0) sigs.push({ s: st.platformStart - 1400, lat: 3.8, aspect: stopping ? 'yellow' : 'green' });
      sigs.push({ s: st.platformStart - 380, lat: 3.8, aspect: stopping ? 'yellow' : 'green' });
    }
    if (!isLast) {
      sigs.push({ s: st.platformEnd + 30, lat: 3.8, aspect: 'green' });
      sigs.push({ s: st.platformStart - 30, lat: revLat, rev: true, aspect: 'green' });
    } else {
      sigs.push({ s: Math.min(bufferStop - 20, st.platformEnd + 30), lat: 3.8, aspect: 'red' });
    }
    if (!isFirst) sigs.push({ s: st.platformEnd + 380, lat: revLat, rev: true, aspect: 'green' });
  }
  // automatic block signals on long double-line sections
  if (route.double) {
    for (let i = 0; i < route.stations.length - 1; i++) {
      const a = route.stations[i].platformEnd + 900;
      const b = route.stations[i + 1].platformStart - 1900;
      for (let s = a; s < b; s += 1600) {
        sigs.push({ s, lat: 3.8, aspect: 'green' });
        sigs.push({ s: s + 500, lat: revLat, rev: true, aspect: 'green' });
      }
    }
  }
  // signals never stand inside a tunnel or on a bridge
  return sigs
    .filter((g) => g.s > 5 && g.s < bufferStop)
    .filter((g) => !route.tunnels.some((t) => g.s > t.from - 15 && g.s < t.to + 15) && !route.bridges.some((b) => g.s > b.from - 10 && g.s < b.to + 10));
}

/**
 * Rail joints for the wheel-on-rail sound: fishplated 13 m rails by default,
 * long-welded stretches, and turnouts at every station throat.
 */
function buildRailJoints(route, override = {}) {
  const turnouts = [];
  if (override.turnouts) turnouts.push(...override.turnouts);
  else {
    for (const sp of yardTrackSpans(route)) {
      if (!sp.atStart) turnouts.push([sp.fanStart + 10, sp.fanStart + 32]);
      if (!sp.atEnd) turnouts.push([sp.fanEnd - 32, sp.fanEnd - 10]);
    }
    // a crossover at each double-line station throat
    if (route.double) {
      for (const st of route.stations) {
        if (st.platformStart > 600) turnouts.push([st.platformStart - 200, st.platformStart - 178]);
        if (st.platformEnd < route.journey.bufferStop - 600) turnouts.push([st.platformEnd + 160, st.platformEnd + 182]);
      }
    }
    turnouts.sort((a, b) => a[0] - b[0]);
  }
  return {
    spacing: 13,
    lwr: override.lwr ?? [],
    lwrSpacing: 260,
    turnouts,
    levelCrossings: route.levelCrossings.map((lc) => lc.s),
    bridges: route.bridges.filter((b) => b.track !== false).map((b) => [b.from, b.to]),
  };
}

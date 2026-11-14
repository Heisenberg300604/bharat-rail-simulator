// All tracks in the world: the main line, the down main (double-line routes)
// and every station's yard/loop tracks. A "line" follows the route at a
// lateral offset that may change smoothly, which is how yard tracks fan out
// from (and merge back into) the running line. Lines expose the same
// sample() API as the route (incl. elevation y), so every geometry helper
// works on both. Rebuilt whenever the active route changes.
import { route, onRouteChange } from '../routes/activeRoute.js';
import { yardTrackSpans, YARD_TRANSITION } from '../routes/buildRoute.js';
import { DOWN_LINE_OFFSET } from '../routes/stationLayouts.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function createLine(id, offsetFn, from, to, geo = route) {
  const base = {};
  function sample(s, out = {}) {
    geo.sample(s, base);
    const o = offsetFn(s);
    const slope = offsetFn(s + 0.5) - offsetFn(s - 0.5); // lateral change per metre
    out.offset = o;
    out.heading = base.heading - Math.atan(slope);
    out.x = base.x + base.lx * o;
    out.z = base.z + base.lz * o;
    out.y = base.y;
    out.lx = Math.sin(out.heading);
    out.lz = -Math.cos(out.heading);
    return out;
  }
  return { id, from, to, length: geo.length, sample, offsetAt: offsetFn };
}

function buildLines(r) {
  const geo = r.geometry;
  const end = r.journey.bufferStop + 10;
  const list = [createLine('main', () => 0, 0, geo.length, geo)];
  if (r.double) list.push(createLine('down', () => DOWN_LINE_OFFSET, 0, end, geo));
  for (const sp of yardTrackSpans(r)) {
    const { base, track, fanStart, fanEnd } = sp;
    const o = track.offset;
    const a1 = fanStart + YARD_TRANSITION; // fully diverged
    const b0 = fanEnd - YARD_TRANSITION; // starts merging back
    const offsetFn = (s) => {
      const out = sp.atStart ? 1 : smoothstep(fanStart, a1, s);
      const back = sp.atEnd ? 1 : 1 - smoothstep(b0, fanEnd, s);
      return base + (o - base) * Math.min(out, back);
    };
    list.push(createLine(`${sp.station.id}-${track.id}`, offsetFn, sp.atStart ? 0 : Math.max(0, fanStart), sp.atEnd ? end : Math.min(end, fanEnd), geo));
  }
  return list;
}

export let lines = [];
export let mainLine = null;
export let downLine = null; // null on single-line routes

onRouteChange((r) => {
  lines = buildLines(r);
  mainLine = lines[0];
  downLine = lines.find((l) => l.id === 'down') ?? null;
});

// All tracks in the world: the main line plus station yard tracks.
// A "line" follows the route at a lateral offset that may change smoothly,
// which is how yard tracks fan out from (and merge back into) the main line.
// Lines expose the same sample() API as the route, so every geometry helper
// works on both.
import { route } from '../state/gameStore.js';
import { STATIONS, STATION_TRACKS, YARD_TRANSITION, JOURNEY, DOWN_LINE_OFFSET } from '../config/gameConfig.js';

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export function createLine(id, offsetFn, from, to) {
  const base = {};
  function sample(s, out = {}) {
    route.sample(s, base);
    const o = offsetFn(s);
    const slope = offsetFn(s + 0.5) - offsetFn(s - 0.5); // lateral change per metre
    out.offset = o;
    out.heading = base.heading - Math.atan(slope);
    out.x = base.x + base.lx * o;
    out.z = base.z + base.lz * o;
    out.lx = Math.sin(out.heading);
    out.lz = -Math.cos(out.heading);
    return out;
  }
  return { id, from, to, length: route.length, sample, offsetAt: offsetFn };
}

function buildLines() {
  const lines = [createLine('main', () => 0, 0, route.length), createLine('down', () => DOWN_LINE_OFFSET, 0, JOURNEY.bufferStop + 10)];
  const D = DOWN_LINE_OFFSET; // yard tracks branch off the down main
  for (const st of STATIONS) {
    const atStart = st.platformEnd < route.length / 2; // terminus at the route start?
    STATION_TRACKS.forEach((t, i) => {
      const stagger = i * 70;
      if (atStart) {
        const a = st.platformEnd + 60 + stagger;
        const b = a + YARD_TRANSITION;
        lines.push(createLine(`${st.id}-${t.id}`, (s) => D + (t.offset - D) * (1 - smoothstep(a, b, s)), 0, b));
      } else {
        const b = st.platformStart - 60 - stagger;
        const a = b - YARD_TRANSITION;
        lines.push(createLine(`${st.id}-${t.id}`, (s) => D + (t.offset - D) * smoothstep(a, b, s), a, JOURNEY.bufferStop + 10));
      }
    });
  }
  return lines;
}

export const lines = buildLines();
export const mainLine = lines[0];
export const downLine = lines[1];

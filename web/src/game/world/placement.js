// Where scenery may stand, in route coordinates (s along the line, lat +left).
// Shared by the classic scenery (Scenery.jsx) and the rich scenery
// (richScenery.js) so both keep off yards, bridges, tunnel mouths and water.
import { STATIONS, TUNNELS, BRIDGES } from '../config/gameConfig.js';
import { route } from '../state/gameStore.js';
import { terrain } from './terrain.js';

export const inStationYard = (s, lat) => STATIONS.some((st) => s > st.platformStart - 450 && s < st.platformEnd + 450 && lat < 55 && lat > -60);

/** 1 inside a town (around big stations), smaller for halts, 0 in the country. */
export const townAt = (s) => {
  let t = 0;
  for (const st of STATIONS) {
    const r = st.size === 'major' ? 1400 : 600;
    if (Math.abs(s - st.centerS) < r) t = Math.max(t, st.size === 'major' ? 1 : 0.6);
  }
  return t;
};

export const onBridgeOrPortal = (s, lat) =>
  BRIDGES.some((b) => s > b.from - 30 && s < b.to + 30 && Math.abs(lat - (b.lat ?? 0)) < 26) || TUNNELS.some((t) => (Math.abs(s - t.from) < 40 || Math.abs(s - t.to) < 40) && Math.abs(lat) < 30);

/** True if (s, lat) is over a tunnel bore or on a track-carrying bridge (no lineside clutter there). */
export const overTunnelOrBridge = (s) => TUNNELS.some((t) => s > t.from - 60 && s < t.to + 60) || BRIDGES.some((b) => b.track !== false && s > b.from - 40 && s < b.to + 40);

const _p = {};
/** World position + the yaw that lines an object up with the track there. */
export function place(s, lat) {
  route.sample(s, _p);
  return { x: _p.x + _p.lx * lat, z: _p.z + _p.lz * lat, yaw: -_p.heading };
}

/** Ground under a w (along s) × d (across) footprint: { min, max }, or null if any corner is wet. */
export function footprint(s, lat, w, d) {
  let min = Infinity;
  let max = -Infinity;
  for (const [i, j] of [
    [0, 0],
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const ss = s + (i * w) / 2;
    const ll = lat + (j * d) / 2;
    if (terrain.underwater(ss, ll)) return null;
    const h = terrain.groundY(ss, ll);
    min = Math.min(min, h);
    max = Math.max(max, h);
  }
  return { min, max };
}

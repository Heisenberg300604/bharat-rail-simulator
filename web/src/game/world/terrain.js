// Terrain height as a function of ROUTE coordinates (s along the line,
// lat = lateral offset, + = left). Using route coordinates instead of world
// x/z makes everything cheap and exact: the formation under the track is
// always level with the rails, cuttings and embankments form automatically
// where the natural ground is above/below the line, and scenery placed at
// (s, lat) knows its ground height without any search.
//
//   natural(s, lat)  hills/valleys per zone + noise, tunnel hills, ravines
//                    under viaducts, river channels, sea and beaches, and
//                    flat ground around stations and roads
//   groundY(s, lat)  natural ground clamped to the railway formation:
//                    level under the tracks, 1:0.7 cutting walls,
//                    1:1.5 embankment slopes; untouched on bridges/in tunnels
//
// Pure JS (no Three.js). Rebuilt when the route changes.
import { onRouteChange } from '../routes/activeRoute.js';
import { highwayOffset, crossRoadSpan, ROAD_END_VEER } from './roadLayout.js';
import { roadBaseHeight } from '../routes/validateRoute.js';

export const CORRIDOR = 1800; // terrain half-width either side of the line (m)
/** Tunnel bore (route-lateral centre c, half-width hw, wall top and crown above formation). */
export const BORE = {
  single: { c: 0, hw: 3.8, wall: 4.6, crown: 8.3 },
  double: { c: -2.65, hw: 6.7, wall: 4.4, crown: 9.4 },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const lerp = (a, b, t) => a + (b - a) * t;

/** Smooth 2D value noise in −1…1 (deterministic). */
function makeNoise(seed = 1) {
  const hash = (i, j) => {
    let h = (i * 374761393 + j * 668265263 + seed * 2246822519) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  };
  const vnoise = (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    const a = hash(xi, yi);
    const b = hash(xi + 1, yi);
    const c = hash(xi, yi + 1);
    const d = hash(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v) * 2 - 1;
  };
  return (x, y) => 0.72 * vnoise(x / 260, y / 210) + 0.28 * vnoise(x / 110 + 17.3, y / 95 - 4.1);
}

export function createTerrain(r) {
  const g = r.geometry;
  const t = r.terrain;
  const L = g.length;
  const noise = makeNoise(r.id.length * 31 + 7);
  const amp = t.noise ?? 0;
  const bore = r.double ? BORE.double : BORE.single;
  const formation = r.double ? [-5.3 - 4.2, 4.2] : [-4.2, 4.2];
  const sea = t.sea ?? null;
  const minTrack = Math.min(...[0, 0.25, 0.5, 0.75, 1].map((f) => g.heightAt(f * L)), ...g.segments.map((sg) => g.heightAt(sg.startS)));
  const baseLevel = t.baseLevel ?? (sea ? sea.bed : minTrack - 8);
  const roadBase = roadBaseHeight(r);
  const rivers = r.bridges.filter((b) => b.river);
  const viaducts = r.bridges.filter((b) => b.depth);
  const trackBridges = r.bridges.filter((b) => b.track !== false);

  // arcs: inner side clamp so the corridor never folds over itself
  const arcs = g.segments.filter((sg) => sg.curvature !== 0).map((sg) => ({ from: sg.startS, to: sg.startS + sg.length, R: 1 / Math.abs(sg.curvature), inner: sg.curvature < 0 ? 1 : -1 }));
  function corridorLimit(s, side) {
    let lim = CORRIDOR;
    for (const a of arcs) if (a.inner === side) lim = Math.min(lim, 0.85 * a.R + Math.max(0, a.from - s, s - a.to));
    return lim;
  }

  // ---- per-row context: everything that depends only on s (cached while building meshes)
  function row(s) {
    const ty = g.heightAt(s);
    const c = { s, ty, zones: null, ramp: 300, farL: ty, farR: ty, tunnelH: 0, valley: 0, valleyD: 0, river: 0, riverBed: 0, flat: 0, flatY: ty, shoreL: 1e9, shoreR: 1e9, road: null, lcs: null, onBridge: false, inTunnel: false };
    // zones (blended with a 400 m taper)
    let wSum = 0;
    let farL = 0;
    let farR = 0;
    let ramp = 0;
    for (const z of t.zones) {
      const w = smoothstep(z.from - 200, z.from + 200, s) * (1 - smoothstep(z.to - 200, z.to + 200, s));
      if (w <= 0) continue;
      const tgt = (side) => (side?.abs !== undefined ? side.abs : ty + (side?.rel ?? 0));
      farL += w * tgt(z.left);
      farR += w * tgt(z.right);
      ramp += w * (z.ramp ?? 300);
      wSum += w;
    }
    if (wSum > 1) {
      farL /= wSum;
      farR /= wSum;
      ramp /= wSum;
      wSum = 1;
    }
    c.farL = farL + (1 - wSum) * ty;
    c.farR = farR + (1 - wSum) * ty;
    c.ramp = ramp + (1 - wSum) * 300;
    // tunnel hills
    for (const tn of r.tunnels) {
      // a hill over every tunnel: low over the portals (just above the arch),
      // rising to full cover a little way inside, and falling away outside
      const full = 17 + Math.min(28, (tn.to - tn.from) * 0.03);
      const portal = bore.crown + 4;
      const inside = Math.min(s - tn.from, tn.to - s);
      let h;
      if (inside >= 0) h = portal + (full - portal) * smoothstep(0, 140, inside);
      else h = portal * (1 - smoothstep(0, 170, -inside)) + 3 * (1 - smoothstep(0, 60, -inside));
      if (h > c.tunnelH) c.tunnelH = h;
      if (inside >= 0) c.inTunnel = true;
    }
    // ravines under viaducts
    for (const b of viaducts) {
      const len = b.to - b.from;
      const f = smoothstep(b.from - 20, b.from + len * 0.38, s) * (1 - smoothstep(b.to - len * 0.38, b.to + 20, s));
      if (f > c.valley) {
        c.valley = f;
        c.valleyD = b.depth;
      }
    }
    // river channels
    for (const b of rivers) {
      const f = smoothstep(b.from + 10, b.from + 70, s) * (1 - smoothstep(b.to - 70, b.to - 10, s));
      if (f > c.river) {
        c.river = f;
        c.riverBed = b.river.level - (b.river.sandbanks ? 2 : 3.5);
        c.sandbanks = !!b.river.sandbanks;
      }
    }
    for (const b of trackBridges) if (s > b.from - 4 && s < b.to + 4) c.onBridge = true;
    // flat ground around stations
    for (const st of r.stations) {
      const f = smoothstep(st.platformStart - 700, st.platformStart - 380, s) * (1 - smoothstep(st.platformEnd + 380, st.platformEnd + 700, s));
      if (f > c.flat) {
        c.flat = f;
        c.flatY = st.elevation;
      }
    }
    // sea shores (distance from the track to the water's edge on each side)
    if (sea) {
      let wS = 0;
      let sl = 0;
      let sr = 0;
      for (const z of sea.zones) {
        const w = smoothstep(z.from - 150, z.from + 150, s) * (1 - smoothstep(z.to - 150, z.to + 150, s));
        if (w <= 0) continue;
        sl += w * Math.min(z.left ?? 5000, 5000);
        sr += w * Math.min(z.right ?? 5000, 5000);
        wS += w;
      }
      if (wS > 0) {
        c.shoreL = sl / Math.max(wS, 1) + (1 - Math.min(wS, 1)) * 5000;
        c.shoreR = sr / Math.max(wS, 1) + (1 - Math.min(wS, 1)) * 5000;
      }
    }
    // roads (a band of level ground at the road base height)
    if (r.road && s > r.road.from - ROAD_END_VEER - 60 && s < r.road.to + ROAD_END_VEER + 60) c.road = highwayOffset(s);
    for (const lc of r.levelCrossings) {
      if (Math.abs(s - lc.s) < 40) (c.lcs ??= []).push({ d: Math.abs(s - lc.s), span: crossRoadSpan(lc) });
    }
    return c;
  }

  // ---- natural ground for a row context and lateral offset
  function naturalAt(c, lat) {
    const a = Math.abs(lat);
    const far = lat >= 0 ? c.farL : c.farR;
    let h = c.ty + (far - c.ty) * smoothstep(25, 25 + c.ramp, a);
    h += amp * noise(c.s, lat) * smoothstep(18, 80, a);
    if (c.tunnelH > 0) {
      const hill = c.ty + c.tunnelH * (1 - 0.5 * smoothstep(90, 520, a)) + amp * 0.4 * noise(c.s + 999, lat);
      h = Math.max(h, hill);
    }
    if (c.valley > 0) {
      const f = c.valley * (1 - smoothstep(160, 700, a));
      h = lerp(h, Math.min(h, c.ty - c.valleyD + a * 0.03), f);
    }
    if (c.river > 0) h = lerp(h, Math.min(h, c.riverBed + (c.sandbanks ? 1.6 * Math.max(0, noise(c.s * 2.2, lat * 1.4)) : 0)), c.river);
    if (sea) {
      const shore = lat >= 0 ? c.shoreL : c.shoreR;
      const beach = clamp(shore * 0.35, 0, 80); // open sea (shore ≈ 0, under a bridge) has no beach
      if (shore < 20) h = sea.bed + amp * 0.3 * noise(c.s, lat); // open sea right up to the bridge piers
      else if (a > shore - beach - 1) {
        if (beach > 2) h = lerp(h, sea.level + 0.5, smoothstep(shore - beach, shore - beach * 0.1, a)); // the beach
        h = lerp(h, sea.bed + amp * 0.3 * noise(c.s, lat), smoothstep(shore, shore + Math.max(8, beach), a)); // under water
      }
    }
    if (c.flat > 0) h = lerp(h, c.flatY - 0.05, c.flat * (1 - smoothstep(75, 170, a)));
    if (c.road !== null) h = lerp(h, roadBase - 0.05, 1 - smoothstep(14, 40, Math.abs(lat - c.road)));
    if (c.lcs) {
      for (const lc of c.lcs) {
        if (lat > lc.span[0] - 30 && lat < lc.span[1] + 30) h = lerp(h, roadBase - 0.05, 1 - smoothstep(8, 30, lc.d));
      }
    }
    return h;
  }

  // ---- ground: natural clamped to the formation
  function groundAt(c, lat) {
    const n = naturalAt(c, lat);
    const [lo, hi] = formation;
    if (c.inTunnel) return Math.max(n, c.ty + bore.crown + 2.5);
    if (c.onBridge) return lat > lo - 4 && lat < hi + 4 ? Math.min(n, c.ty - 3) : n;
    const d = lat > hi ? lat - hi : lat < lo ? lo - lat : 0;
    const base = c.ty - 0.05;
    if (d === 0) return base;
    return base + clamp(n - base, -d * 0.66, d * 1.45);
  }

  /**
   * The rendered surface: ground clamped to the corridor (inner side of tight
   * curves) and blended into the far plane towards the corridor edge. Scenery
   * and the terrain mesh both use this, so nothing floats or sinks.
   */
  function surfaceAt(c, lat, lim = corridorLimit(c.s, lat >= 0 ? 1 : -1)) {
    const l = clamp(lat, -lim, lim);
    const h = groundAt(c, l);
    return h + (baseLevel - h) * smoothstep(Math.min(lim * 0.45, lim - 380), lim, Math.abs(l)); // a gentle slope, never a cliff
  }

  return {
    row,
    naturalAt,
    groundAt,
    surfaceAt,
    /** Ground height at route coordinates (s, lat), exactly as rendered. */
    groundY: (s, lat) => surfaceAt(row(s), lat),
    corridorLimit,
    formation,
    bore,
    baseLevel,
    roadBase,
    sea,
    waterLevel: sea ? sea.level : null,
    hasWater: !!sea || rivers.length > 0,
    /** Like route.sample but continues straight beyond both ends of the line. */
    extSample(s, out = {}) {
      const cs = clamp(s, 0, L);
      g.sample(cs, out);
      const over = s - cs;
      if (over !== 0) {
        out.x += Math.cos(out.heading) * over;
        out.z += Math.sin(out.heading) * over;
      }
      return out;
    },
    /** Is (s, lat) under water (sea or river)? */
    underwater(s, lat) {
      const c = row(s);
      const h = naturalAt(c, lat);
      if (sea && h < sea.level - 0.3) return true;
      return c.river > 0.5 && h < c.riverBed + 2.5;
    },
  };
}

/** The active route's terrain (live binding). */
export let terrain = null;
onRouteChange((r) => {
  terrain = createTerrain(r);
});

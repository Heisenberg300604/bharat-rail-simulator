// Rich scenery ("Scenery: Rich" setting): turns the classic, sparse lineside
// into a populous Indian landscape — real village clusters, dense towns round
// the big stations, apartment skylines, bazaars at level crossings, shops along
// the highway, slums on railway land in the cities, boundary walls with painted
// ads, electric poles and wires, mobile towers, brick kilns, haystacks, dung
// stacks, shrines and temples, region-specific trees, grazing animals and
// villagers.
//
// It builds on the classic scenery (Scenery.jsx → generate()): classic houses
// and trees are converted into richer models where they stand, and everything
// new avoids them. All parts of a 600 m patch merge into ONE mesh (kit.js), in
// two layers: "far" (houses, trees, towers — drawn to the scenery distance) and
// "near" (animals, small props, bushes, wires — drawn to the detail distance).
// Placement is seeded: the same world every run.
import { ROUTE, STATIONS, ROAD, LEVEL_CROSSINGS } from '../config/gameConfig.js';
import { route } from '../state/gameStore.js';
import { terrain } from './terrain.js';
import { onRoad, highwayOffset, crossRoadSpan, CROSS_HALF_WIDTH } from './roadLayout.js';
import { inStationYard, townAt, onBridgeOrPortal, overTunnelOrBridge, place, footprint } from './placement.js';
import { biomeFor } from './biomes.js';
import { seededRandom } from './geometry.js';
import { Kit } from './kit.js';
import { Occupancy } from './occupancy.js';
import { HOUSES } from './models/houses.js';
import * as P from './models/props.js';
import { PLANTS } from './models/plants.js';
import * as A from './models/animals.js';
import { randomPerson, ANIM } from './models/people.js';

export const RICH_CELL = 600;

// Which houses each region builds (relative weights).
const MIX = {
  plains: { village: { flat: 0.4, brick: 0.35, hut: 0.15, shack: 0.1 }, town: { flat: 0.6, brick: 0.25, apartment: 0.15 } },
  ghats: { village: { tiled: 0.45, flat: 0.35, hut: 0.1, brick: 0.1 }, town: { flat: 0.55, tiled: 0.25, apartment: 0.2 } },
  konkan: { village: { tiled: 0.65, flat: 0.25, hut: 0.1 }, town: { flat: 0.5, tiled: 0.3, apartment: 0.2 } },
  coastal: { village: { flat: 0.45, hut: 0.3, tiled: 0.2, shack: 0.05 }, town: { flat: 0.7, tiled: 0.15, apartment: 0.15 } },
  bengal: { village: { brick: 0.35, flat: 0.3, hut: 0.3, shack: 0.05 }, town: { flat: 0.45, brick: 0.35, apartment: 0.2 } },
};
// Classic round / palm trees converted to regional species (share of each).
const TREE_MIX = {
  plains: { round: { peepal: 0.18, banyan: 0.06, mango: 0.18, neem: 0.18 }, palm: {} },
  ghats: { round: { mango: 0.3, peepal: 0.1, banyan: 0.05 }, palm: { areca: 0.3 } },
  konkan: { round: { mango: 0.35, peepal: 0.08, banyan: 0.04 }, palm: { areca: 0.35 } },
  coastal: { round: { neem: 0.15, scrub: 0.3, banyan: 0.05 }, palm: { palmyra: 0.5 } },
  bengal: { round: { mango: 0.3, peepal: 0.1, banyan: 0.06, bamboo: 0.15 }, palm: {} },
};
const WORSHIP = {
  plains: { temple: 0.7, mosque: 0.3 },
  ghats: { temple: 0.85, mosque: 0.15 },
  konkan: { chapel: 0.5, temple: 0.5 },
  coastal: { templeSouth: 0.6, chapel: 0.2, mosque: 0.2 },
  bengal: { temple: 0.6, mosque: 0.4 },
};
const HERD = {
  plains: { cow: 0.5, buffalo: 0.35, goat: 0.15 },
  ghats: { cow: 0.7, buffalo: 0.2, goat: 0.1 },
  konkan: { cow: 0.7, buffalo: 0.2, goat: 0.1 },
  coastal: { goat: 0.5, cow: 0.5 },
  bengal: { cow: 0.5, buffalo: 0.3, goat: 0.2 },
};

function pickWeighted(rand, weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((n, [, w]) => n + w, 0);
  let r = rand() * total;
  for (const [k, w] of entries) if ((r -= w) <= 0) return k;
  return entries[0][0];
}
const pick = (rand, a) => a[Math.floor(rand() * a.length)];

/**
 * Build the rich scenery for the active route.
 * classic: the output of Scenery.jsx generate() (items carry s/lat).
 * density: the quality preset's sceneryDensity (0.45 Low … 1 High).
 * Returns { far: Map<cell, Kit>, near: Map<cell, Kit>, removed: Set<classic item>, people: [] }.
 */
export function buildRichScenery(classic, density = 1) {
  const rand = seededRandom(9001);
  const biomeKey = ROUTE.scenery?.biome ?? 'plains';
  const biome = biomeFor(ROUTE);
  const mix = MIX[biomeKey] ?? MIX.plains;
  const L = route.length;
  const occ = new Occupancy(2);
  const far = new Map();
  const near = new Map();
  const removed = new Set();
  const people = [];
  const villageHouses = [];
  const shops = [];
  const T = terrain;
  const urban = biomeKey === 'plains' || biomeKey === 'bengal';

  const kitAt = (layer, x, z) => {
    const map = layer === 'near' ? near : far;
    const k = `${Math.floor(x / RICH_CELL)},${Math.floor(z / RICH_CELL)}`;
    let kit = map.get(k);
    if (!kit) map.set(k, (kit = new Kit(2048)));
    return kit;
  };
  const _p = {};
  const heading = (s) => route.sample(s, _p).heading;
  /** yaw for a front (local −z) facing 'track' | 'lat+' | 'lat-' | 's+' | 's-'. */
  const faceYaw = (s, lat, face) => {
    const h = heading(s);
    const f = face === 'track' ? (lat > 0 ? 'lat-' : 'lat+') : face;
    if (f === 'lat-') return -h + Math.PI;
    if (f === 'lat+') return -h;
    if (f === 's-') return -h + Math.PI / 2;
    return -h - Math.PI / 2;
  };
  const personYaw = (dx, dz) => Math.atan2(-dz, dx); // crowd figures face their local +X

  /** Corners and centre of a rectangle clear of every road (no radius fudge, so shops can line a road). */
  const clearOfRoads = (s, lat, ws, dl, verge = 1) => {
    for (const [i, j] of [
      [0, 0],
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ]) {
      if (onRoad(s + (i * ws) / 2, lat + (j * dl) / 2, 0, verge)) return false;
    }
    return true;
  };
  /** Ground under the rectangle if something may be built there, else null. */
  const fits = (s, lat, ws, dl, { pad = 0.8, slope = 2.5, level = 1, trackClear = 14 } = {}) => {
    if (s < -250 || s > L + 250) return null;
    if (Math.abs(lat) - dl / 2 < trackClear) return null;
    const nearEdge = lat - Math.sign(lat) * (dl / 2);
    if (inStationYard(s, lat) || inStationYard(s, nearEdge) || inStationYard(s - ws / 2, nearEdge) || inStationYard(s + ws / 2, nearEdge)) return null;
    if (onBridgeOrPortal(s, lat) || onBridgeOrPortal(s, nearEdge)) return null;
    if (!occ.free(s, lat, ws, dl, pad, level)) return null;
    if (!clearOfRoads(s, lat, ws, dl)) return null;
    const fp = footprint(s, lat, ws, dl);
    if (!fp || fp.max - fp.min > slope) return null;
    return fp;
  };

  /**
   * A house of `kind` centred at (s, lat). w = frontage, d = depth. face: see faceYaw.
   * Returns the placed record or null.
   */
  const house = (kind, s, lat, w, d, floors, opts = {}) => {
    const face = opts.face ?? 'track';
    const alongS = face === 's+' || face === 's-';
    const ws = alongS ? d : w;
    const dl = alongS ? w : d;
    const extra = kind === 'tiled' ? 2.4 : 0; // verandah in front
    const fp = opts.fp ?? fits(s, lat, ws + (alongS ? extra : 0), dl + (alongS ? 0 : extra), { pad: opts.pad ?? 0.8, slope: opts.slope ?? 2.5, trackClear: opts.trackClear ?? 14 });
    if (!fp) return null;
    const base = fp.min - 0.3;
    const plinth = fp.max - base;
    const pos = place(s, lat);
    const kit = kitAt('far', pos.x, pos.z);
    kit.seed = rand();
    kit.place(pos.x, base, pos.z, faceYaw(s, lat, face));
    const color = opts.color ?? pick(rand, biome.plaster);
    HOUSES[kind](kit, { w, d, floors, color, plinth, rand, shop: opts.shop, grille: rand() < 0.4, laterite: biomeKey === 'konkan' && rand() < 0.3, roof: biomeKey === 'bengal' || biomeKey === 'coastal' ? (rand() < 0.55 ? 'thatch' : 'tin') : rand() < 0.4 ? 'tin' : 'thatch' });
    occ.mark(s, lat, ws + (alongS ? extra : 0), dl + (alongS ? 0 : extra), 2);
    return { s, lat, w, d, face, kind, x: pos.x, z: pos.z, y: fp.max, yaw: faceYaw(s, lat, face) };
  };
  const floorsFor = (kind, town = false) => {
    if (kind === 'apartment') return 5 + Math.floor(rand() * 5);
    if (kind === 'flat') return town ? 2 + Math.floor(rand() * 3) : 1 + Math.floor(rand() * 2);
    if (kind === 'brick') return 1 + Math.floor(rand() * (town ? 3 : 2));
    if (kind === 'tiled') return rand() < 0.15 ? 2 : 1;
    return 1;
  };
  /** A prop at (s, lat) built by fn(kit); level-2 occupancy of w × d. */
  const prop = (layer, s, lat, w, d, fn, { face = null, yaw = null, mark = true, check = true, slope = 3, trackClear = 12 } = {}) => {
    let fp;
    if (check) {
      fp = fits(s, lat, w, d, { pad: 0.3, slope, trackClear });
      if (!fp) return null;
    } else fp = { min: T.groundY(s, lat), max: T.groundY(s, lat) };
    const pos = place(s, lat);
    const kit = kitAt(layer, pos.x, pos.z);
    kit.seed = rand();
    kit.place(pos.x, fp.min, pos.z, yaw ?? (face ? faceYaw(s, lat, face) : rand() * Math.PI * 2));
    fn(kit);
    if (mark) occ.mark(s, lat, w, d, 2);
    return { s, lat, x: pos.x, z: pos.z, y: fp.min };
  };
  const addPerson = (s, lat, kind, anim = ANIM.stand, faceDir = null, extra = {}) => {
    if (inStationYard(s, lat) || T.underwater(s, lat) || onRoad(s, lat, 0, 0.3)) return;
    const pos = place(s, lat);
    let yaw;
    if (faceDir) yaw = personYaw(faceDir[0], faceDir[1]);
    else {
      route.sample(s, _p);
      yaw = personYaw(-_p.lx * Math.sign(lat || 1), -_p.lz * Math.sign(lat || 1)) + (rand() - 0.5) * 1.2; // roughly towards the track
    }
    people.push({ x: pos.x, y: T.groundY(s, lat), z: pos.z, yaw, person: randomPerson(rand, kind), anim, phase: rand(), ...extra });
  };
  const animal = (s, lat, build, pose) => {
    if (T.underwater(s, lat) || onRoad(s, lat, 1, 0.5) || inStationYard(s, lat)) return;
    const pos = place(s, lat);
    const kit = kitAt('near', pos.x, pos.z);
    kit.seed = rand();
    kit.place(pos.x, T.groundY(s, lat), pos.z, rand() * Math.PI * 2);
    build(kit, pose);
  };
  const herdAnimal = (kind, s, lat) => {
    const pose = rand() < 0.7 ? 'graze' : rand() < 0.5 ? 'stand' : 'lie';
    if (kind === 'cow') animal(s, lat, (k) => A.cow(k, pick(rand, A.COW_COLOURS), pose));
    else if (kind === 'buffalo') animal(s, lat, (k) => A.buffalo(k, pose));
    else animal(s, lat, (k) => A.goat(k, pick(rand, A.GOAT_COLOURS), pose === 'lie' ? 'stand' : pose));
  };

  // ---- 0. what's already there: classic fields and ponds (soft), houses (solid)
  for (const f of classic.fields) occ.mark(f.s, f.lat, f.sx, f.sz, 1);
  for (const pd of classic.ponds) occ.mark(pd.s, pd.lat, pd.rad * 2.2, pd.rad * 2.2, 2);

  // ---- 1. classic houses become Indian houses where they stand
  const tankOf = new Map(classic.tanks.map((t) => [t.building, t]));
  for (const b of classic.buildings) {
    const town = townAt(b.s);
    const keepBox = b.big ? rand() < 0.3 : rand() < 0.2;
    const kind = b.big && b.floors >= 3 ? (rand() < 0.5 ? 'apartment' : 'flat') : pickWeighted(rand, town ? mix.town : mix.village);
    if (keepBox || b.r >= density) {
      occ.mark(b.s, b.lat, b.sx, b.sz, 2);
      continue;
    }
    removed.add(b);
    const t = tankOf.get(b);
    if (t) removed.add(t);
    const fp = { min: b.base + 0.3, max: b.base + 0.3 + (b.sy - b.floors * 3 - 0.6) };
    const floors = kind === 'apartment' ? Math.max(b.floors, 4) : kind === 'tiled' || kind === 'hut' || kind === 'shack' ? 1 : b.floors;
    const w = kind === 'hut' || kind === 'shack' ? Math.min(b.sx, 6) : b.sx;
    const d = kind === 'hut' || kind === 'shack' ? Math.min(b.sz, 5) : b.sz;
    house(kind, b.s, b.lat, w, d, floors, { color: b.color, fp, shop: kind === 'flat' && town >= 1 && rand() < 0.3 });
  }

  // ---- 2. railway boundary walls with painted ads near the big stations
  for (const st of STATIONS) {
    if (st.size !== 'major') continue;
    for (const [from, to] of [
      [st.platformEnd + 455, st.platformEnd + 1500],
      [st.platformStart - 1500, st.platformStart - 455],
    ]) {
      for (const side of [1, -1]) {
        const lat = side * 19;
        let k = 0;
        for (let s = Math.max(-200, from); s < Math.min(L + 200, to); ) {
          const ad = k % 9 === 4 ? Math.floor(rand() * 4) : -1;
          const len = ad >= 0 ? 6 : 3;
          const sc = s + len / 2;
          k++;
          s += len;
          if (overTunnelOrBridge(sc) || onBridgeOrPortal(sc, lat) || onRoad(sc, lat, len / 2, 1) || T.underwater(sc, lat)) continue;
          if (Math.abs(T.groundY(sc, lat) - T.groundY(sc, side * 8)) > 2.5) continue; // cutting / embankment
          const pos = place(sc, lat);
          const kit = kitAt('far', pos.x, pos.z);
          kit.seed = rand();
          kit.place(pos.x, T.groundY(sc, lat), pos.z, faceYaw(sc, lat, 'track'));
          P.boundaryWall(kit, len, 2.1, ad);
          occ.mark(sc, lat, len, 1.2, 2);
        }
      }
    }
  }

  // ---- 3. towns round the big stations: streets of shops and houses, a skyline, slums
  for (const st of STATIONS) {
    if (st.size !== 'major') continue;
    const dens = 0.42 * density * Math.min(1.3, biome.buildingDensity);
    for (const side of [1, -1]) {
      for (let row = 0; row < 7; row++) {
        const lat = side * (34 + row * 24);
        const face = row % 2 ? (side > 0 ? 'lat+' : 'lat-') : 'track';
        for (let s = st.centerS - 1150; s < st.centerS + 1150; ) {
          const w = 7 + rand() * 7;
          const d = 9 + rand() * 4;
          if (rand() < dens) {
            const kind = pickWeighted(rand, mix.town);
            const shop = kind !== 'apartment' && kind !== 'tiled' && rand() < 0.3;
            const h = house(kind === 'brick' && shop ? 'flat' : kind, s + w / 2, lat, w, d, floorsFor(kind, true), { face, shop, pad: 0.4 });
            if (h && shop) shops.push(h);
          }
          s += w + 0.6 + rand() * 2;
        }
      }
    }
    if (urban) {
      for (let k = 0; k < 26 * density; k++) {
        const side = rand() < 0.5 ? 1 : -1;
        house('apartment', st.centerS + (rand() - 0.5) * 2600, side * (230 + rand() * 420), 16 + rand() * 10, 13 + rand() * 5, 7 + Math.floor(rand() * 8), { slope: 3 });
      }
      // slums on railway land just outside the yard
      for (const [from, to] of [
        [st.platformEnd + 470, st.platformEnd + 1050],
        [st.platformStart - 1050, st.platformStart - 470],
      ]) {
        for (const side of [1, -1]) {
          if (rand() < 0.35) continue;
          const a = from + rand() * 120;
          const b = Math.min(to, a + 250 + rand() * 300);
          for (let row = 0; row < 3; row++) {
            for (let s = a; s < b; s += 3.4 + rand() * 0.8) {
              if (rand() > 0.85 * density + 0.1) continue;
              const h = house('shack', s, side * (22.5 + row * 4.2), 2.8 + rand() * 0.8, 3 + rand() * 0.5, 1, { pad: 0.15, trackClear: 18, face: row % 2 ? (side > 0 ? 'lat+' : 'lat-') : 'track' });
              if (h && rand() < 0.12) addPerson(s, side * (20.4 + row * 4.2), rand() < 0.5 ? 'child' : 'woman', rand() < 0.4 ? ANIM.wave : ANIM.stand);
            }
          }
        }
      }
    }
    // a temple / mosque / chapel and a couple of mobile towers in each town
    for (let k = 0; k < 2; k++) {
      const side = rand() < 0.5 ? 1 : -1;
      prop('far', st.centerS + (rand() - 0.5) * 2000, side * (60 + rand() * 180), 13, 13, (kit) => P.worship(kit, pickWeighted(rand, WORSHIP[biomeKey]), rand), { face: 'track' });
      prop('far', st.centerS + (rand() - 0.5) * 2200, side * (80 + rand() * 300), 9, 6, (kit) => P.mobileTower(kit, 30 + rand() * 12, rand), { face: 'track' });
    }
  }

  // ---- 4. the highway: a ribbon of shops, dhabas and houses, with an electric line
  if (ROAD) {
    let lastPole = null;
    for (let s = ROAD.from + 20; s < ROAD.to - 20; ) {
      const off = highwayOffset(s);
      const sg = Math.sign(off) || 1;
      const town = townAt(s);
      const nearVillage = (ROUTE.scenery.villages ?? []).some((v) => Math.abs(v - s) < 400);
      const w = 6 + rand() * 6;
      const d = 7 + rand() * 4;
      const p = (town >= 1 ? 0.8 : nearVillage || town ? 0.5 : 0.16) * density;
      for (const sideOfRoad of [1, -1]) {
        if (rand() > p) continue;
        const lat = off + sg * sideOfRoad * (ROAD.width / 2 + 3 + d / 2);
        if (sideOfRoad < 0 && Math.abs(lat) - d / 2 < 15) continue;
        const face = sg * sideOfRoad > 0 ? 'lat-' : 'lat+';
        if (rand() < 0.08) {
          prop('far', s, lat, 3, 3, (kit) => P.chaiStall(kit), { face });
          addPerson(s, lat - sg * sideOfRoad * 2.2, 'man', ANIM.stand);
          continue;
        }
        const shop = rand() < (town ? 0.6 : 0.4);
        const kind = shop ? 'flat' : pickWeighted(rand, town ? mix.town : mix.village);
        const h = house(kind === 'apartment' ? 'flat' : kind, s + w / 2, lat, w, d, floorsFor(kind, town >= 1), { face, shop, pad: 0.5 });
        if (h && shop) shops.push(h);
      }
      s += w + 1 + rand() * 6;
    }
    // poles on the far verge, 40 m apart, three wires
    for (let s = ROAD.from; s < ROAD.to; s += 40) {
      const off = highwayOffset(s);
      const lat = off + (Math.sign(off) || 1) * (ROAD.width / 2 + 1.6);
      if (inStationYard(s, lat) || onRoad(s, lat, 0, 0.5) || T.underwater(s, lat)) {
        lastPole = null;
        continue;
      }
      const pos = place(s, lat);
      const y = T.groundY(s, lat);
      const kit = kitAt('far', pos.x, pos.z);
      kit.place(pos.x, y, pos.z, faceYaw(s, lat, 's+'));
      const top = P.psc(kit);
      const h = heading(s);
      const ends = [-0.8, 0, 0.8].map((o) => [pos.x + Math.cos(h + Math.PI / 2) * o * 0 + Math.sin(h) * o, y + top, pos.z - Math.cos(h) * o]);
      if (lastPole) {
        const wk = kitAt('near', pos.x, pos.z);
        wk.place(0, 0, 0, 0);
        for (let i = 0; i < 3; i++) P.wire(wk, lastPole[i], ends[i], 0.6);
      }
      lastPole = ends;
      occ.mark(s, lat, 1, 1, 2);
    }
  }

  // ---- 5. level-crossing bazaars along the cross road
  for (const lc of LEVEL_CROSSINGS) {
    if (inStationYard(lc.s, 30) && inStationYard(lc.s, -30)) continue;
    const [lo, hi] = crossRoadSpan(lc);
    for (const latSide of [1, -1]) {
      const limit = latSide > 0 ? Math.min(hi - 4, 140) : Math.max(lo + 4, -140);
      for (const sSide of [1, -1]) {
        for (let a = 17; a < Math.abs(limit); ) {
          const w = 5 + rand() * 5;
          const d = 7 + rand() * 3;
          const lat = latSide * (a + w / 2);
          const s = lc.s + sSide * (CROSS_HALF_WIDTH + 2.6 + d / 2);
          if (rand() < (a < 60 ? 0.85 : 0.5) * density) {
            const shop = rand() < (a < 60 ? 0.7 : 0.35);
            const kind = shop ? 'flat' : pickWeighted(rand, mix.village);
            const h = house(kind === 'apartment' ? 'flat' : kind, s, lat, w, d, kind === 'flat' ? 1 + Math.floor(rand() * 2) : floorsFor(kind), { face: sSide > 0 ? 's-' : 's+', shop, pad: 0.4, trackClear: 15 });
            if (h && shop) shops.push(h);
          }
          a += w + 0.5 + rand() * 1.5;
        }
      }
      // walkers on the cross road: they start near the gate and pace AWAY from the
      // line and back, so they can never walk onto the track or through a train
      const room = Math.abs(limit) - 45;
      for (let k = 0; k < 2 && room > 10; k++) {
        const lat = latSide * (20 + rand() * 15);
        route.sample(lc.s, _p);
        const away = [_p.lx * latSide, _p.lz * latSide];
        addPerson(lc.s + (k ? 1 : -1) * (CROSS_HALF_WIDTH + 0.8), lat, undefined, ANIM.walk, away, { speed: 1.1 + rand() * 0.3, range: Math.min(room, 25 + rand() * 40) });
      }
    }
  }

  // ---- 6. villages: lanes of houses, a place of worship, a water tank, a tower,
  //         a peepal with its shrine, hay, dung cakes, hand pumps, cots, animals
  const villageMix = mix.village;
  const outskirts = [];
  for (const vs of ROUTE.scenery.villages ?? []) {
    const side = rand() < 0.5 ? 1 : -1;
    const lat0 = side * (55 + rand() * 110);
    const lanes = 4 + Math.floor(rand() * 3);
    for (let row = 0; row < lanes; row++) {
      const lat = lat0 + side * row * 22;
      const face = row % 2 ? (side > 0 ? 'lat-' : 'lat+') : side > 0 ? 'lat+' : 'lat-';
      for (let s = vs - 120 - rand() * 30; s < vs + 120; ) {
        const kind = pickWeighted(rand, villageMix);
        const small = kind === 'hut' || kind === 'shack';
        const w = small ? 4 + rand() * 2 : 6 + rand() * 6;
        const d = small ? 4 + rand() : 7 + rand() * 4;
        if (rand() < 0.85 * Math.min(1.2, density + 0.15)) {
          const h = house(kind, s + w / 2, lat, w, d, floorsFor(kind), { face, pad: 0.6 });
          if (h) villageHouses.push(h);
        }
        s += w + 1.5 + rand() * 4;
      }
    }
    const edge = lat0 + side * (lanes * 22 + 18);
    prop('far', vs + 140 + rand() * 30, lat0 + side * 30, 13, 13, (kit) => P.worship(kit, pickWeighted(rand, WORSHIP[biomeKey]), rand), { face: 'track' });
    if (rand() < 0.6) prop('far', vs - 150, lat0 + side * 40, 10, 10, (kit) => P.waterTower(kit, rand));
    if (rand() < 0.6) prop('far', vs + (rand() - 0.5) * 200, edge + side * 20, 9, 6, (kit) => P.mobileTower(kit, 28 + rand() * 12, rand), { face: 'track' });
    // the village peepal and its shrine
    const ps = vs - 135 - rand() * 20;
    const pl = lat0 + side * (10 + rand() * 30);
    if (prop('far', ps, pl, 10, 10, (kit) => PLANTS.peepal(kit, rand, 1.1))) prop('far', ps + 3.5, pl - side * 4, 2.2, 2.2, (kit) => P.shrine(kit, biomeKey === 'coastal' ? 'south' : 'north', rand), { face: 'track', check: false, mark: false });
    outskirts.push({ s: vs, lat: edge, side, lat0 });
    // a transformer and a feeder line from the village towards the line
    prop('far', vs - 100, lat0 - side * 6, 3, 2, (kit) => P.transformer(kit), { face: 'track' });
  }

  // ---- 7. hamlets: a few houses, a haystack, a tethered cow, every so often
  for (let s = 500; s < L - 400; s += 600 + rand() * 300) {
    if (townAt(s) > 0 || (ROUTE.scenery.villages ?? []).some((v) => Math.abs(v - s) < 450) || overTunnelOrBridge(s)) continue;
    if (rand() > 0.5 * Math.min(1.2, biome.buildingDensity + 0.3)) continue;
    const side = rand() < 0.5 ? 1 : -1;
    const lat0 = side * (40 + rand() * 220);
    const n = 3 + Math.floor(rand() * 5 * density + 1);
    for (let k = 0; k < n; k++) {
      const kind = pickWeighted(rand, villageMix);
      const small = kind === 'hut' || kind === 'shack';
      const h = house(kind, s + (rand() - 0.5) * 70, lat0 + (rand() - 0.5) * 40, small ? 4 + rand() * 2 : 6 + rand() * 5, small ? 4 + rand() : 7 + rand() * 3, floorsFor(kind), { face: rand() < 0.6 ? 'track' : side > 0 ? 'lat+' : 'lat-' });
      if (h) villageHouses.push(h);
    }
    outskirts.push({ s, lat: lat0 + side * 30, side, lat0 });
  }

  // haystacks, dung stacks, bananas and bamboo on village outskirts; pumps and cots by houses
  for (const o of outskirts) {
    const nHay = biomeKey === 'coastal' ? 1 : 3 + Math.floor(rand() * 4);
    for (let k = 0; k < nHay; k++) prop('far', o.s + (rand() - 0.5) * 220, o.lat + o.side * rand() * 30, 6, 6, (kit) => P.haystack(kit, rand));
    if (urban || biomeKey === 'ghats') for (let k = 0; k < 3 + rand() * 4; k++) prop('far', o.s + (rand() - 0.5) * 200, o.lat + o.side * (rand() - 0.3) * 30, 3.5, 3.5, (kit) => P.dungStack(kit, rand));
    if (biomeKey === 'bengal' || biomeKey === 'konkan' || biomeKey === 'coastal') for (let k = 0; k < 4 + rand() * 5; k++) prop('far', o.s + (rand() - 0.5) * 240, o.lat0 + o.side * (rand() * 90 - 15), 3, 3, (kit) => PLANTS.banana(kit, rand, 0.9 + rand() * 0.3));
    if (biomeKey !== 'coastal') for (let k = 0; k < 1 + rand() * 3; k++) prop('far', o.s + (rand() - 0.5) * 260, o.lat + o.side * rand() * 40, 8, 8, (kit) => PLANTS.bamboo(kit, rand));
  }
  for (const h of villageHouses) {
    const fwd = h.face === 'lat+' ? 1 : h.face === 'lat-' ? -1 : h.lat > 0 ? -1 : 1; // front direction in lat
    const fl = h.lat + fwd * (h.d / 2 + 2.2);
    const r = rand();
    if (r < 0.1) prop('near', h.s + (rand() - 0.5) * h.w, fl, 2, 2, (kit) => P.handPump(kit), { check: false });
    else if (r < 0.28) prop('near', h.s + (rand() - 0.5) * h.w, fl, 2.2, 1.2, (kit) => P.charpai(kit, rand), { check: false, face: 'track' });
    if (rand() < 0.2) herdAnimal(rand() < 0.6 ? 'cow' : 'buffalo', h.s + h.w / 2 + 2, h.lat + (rand() - 0.5) * h.d);
    if (rand() < 0.07) animal(h.s + (rand() - 0.5) * h.w, fl + fwd * 1.5, (k) => A.dog(k, pick(rand, A.DOG_COLOURS), 'lie'));
    if (rand() < 0.22 * density) addPerson(h.s + (rand() - 0.5) * h.w, fl + fwd * rand() * 2, rand() < 0.25 ? 'child' : rand() < 0.55 ? 'woman' : 'man', rand() < 0.3 ? ANIM.sit : ANIM.stand);
  }
  for (const h of shops) {
    const fwd = h.face === 'lat+' ? [1, 0] : h.face === 'lat-' ? [-1, 0] : h.face === 's+' ? [0, 1] : h.face === 's-' ? [0, -1] : [h.lat > 0 ? -1 : 1, 0];
    const fs = h.s + fwd[1] * (h.d / 2 + 0.9);
    const fl = h.lat + fwd[0] * (h.d / 2 + 0.9);
    if (rand() < 0.6 * density) addPerson(fs, fl, rand() < 0.6 ? 'man' : 'woman', ANIM.stand);
    if (rand() < 0.4 * density) addPerson(fs + (rand() - 0.5) * 3, fl + fwd[0] * 1.2, undefined, ANIM.stand);
    if (rand() < 0.06) animal(fs + 2, fl + fwd[0] * 1.5, (k) => A.dog(k, pick(rand, A.DOG_COLOURS), rand() < 0.6 ? 'lie' : 'stand'));
  }

  // ---- 8. rural electric lines across the fields, mobile towers, brick kilns
  for (let k = 0; k < 2; k++) {
    const side = rand() < 0.5 ? 1 : -1;
    const lat = side * (70 + rand() * 150);
    const s0 = 600 + rand() * Math.max(1, L - 2400);
    let last = null;
    for (let s = s0; s < Math.min(L - 300, s0 + 800 + rand() * 700); s += 50) {
      if (!fits(s, lat, 1.2, 1.2, { pad: 0, level: 2, trackClear: 8, slope: 4 })) {
        last = null;
        continue;
      }
      const pos = place(s, lat);
      const y = T.groundY(s, lat);
      const kit = kitAt('far', pos.x, pos.z);
      kit.place(pos.x, y, pos.z, faceYaw(s, lat, 's+'));
      const top = P.psc(kit, 8.5);
      const h = heading(s);
      const ends = [-0.8, 0, 0.8].map((o) => [pos.x + Math.sin(h) * o, y + top, pos.z - Math.cos(h) * o]);
      if (last) {
        const wk = kitAt('near', pos.x, pos.z);
        wk.place(0, 0, 0, 0);
        for (let i = 0; i < 3; i++) P.wire(wk, last[i], ends[i], 0.8);
      }
      last = ends;
      occ.mark(s, lat, 1.2, 1.2, 2);
    }
  }
  if (urban) {
    for (let s = 1500 + rand() * 800; s < L - 900; s += 3000 + rand() * 1600) {
      if (townAt(s) >= 1) continue;
      const side = rand() < 0.5 ? 1 : -1;
      for (let t = 0; t < 4; t++) {
        const lat = side * (240 + rand() * 300);
        if (prop('far', s + (rand() - 0.5) * 200, lat, 92, 58, (kit) => P.brickKiln(kit, rand), { face: 'track', slope: 2 })) break;
      }
    }
  }
  for (let s = 900 + rand() * 600; s < L - 500; s += 2200 + rand() * 1500) {
    const side = rand() < 0.5 ? 1 : -1;
    prop('far', s, side * (90 + rand() * 300), 9, 6, (kit) => P.mobileTower(kit, 30 + rand() * 10, rand), { face: 'track', slope: 2 });
  }

  // ---- 9. regional trees: convert classic ones, then fill in
  const tm = TREE_MIX[biomeKey] ?? TREE_MIX.plains;
  const convert = (t, kind) => {
    removed.add(t);
    if (t.r >= density) return;
    const kit = kitAt('far', t.x, t.z);
    kit.seed = rand();
    kit.place(t.x, t.y, t.z, t.yaw ?? rand() * 6.28);
    PLANTS[kind](kit, rand, kind === 'banyan' ? 0.8 + rand() * 0.4 : t.sx);
  };
  for (const t of classic.roundTrees) {
    const r = rand();
    let acc = 0;
    for (const [kind, share] of Object.entries(tm.round)) {
      acc += share;
      if (r < acc) {
        convert(t, kind);
        break;
      }
    }
  }
  for (const t of classic.palms) {
    if (t.short) {
      if (biomeKey === 'bengal') convert(t, 'banana'); // the squashed "banana-like" palms become real bananas
      continue;
    }
    const r = rand();
    let acc = 0;
    for (const [kind, share] of Object.entries(tm.palm)) {
      acc += share;
      if (r < acc) {
        convert(t, kind);
        break;
      }
    }
  }
  // clumps of areca / palmyra / bamboo / scrub along the line
  const extra = { ghats: ['bamboo', 'mango'], konkan: ['areca', 'areca', 'bamboo'], coastal: ['palmyra', 'scrub', 'scrub'], bengal: ['bamboo', 'banana', 'mango'], plains: ['scrub', 'neem', 'peepal'] }[biomeKey] ?? ['neem'];
  for (let s = -200; s < L + 200; s += 70) {
    if (rand() > 0.45 * density) continue;
    const side = rand() < 0.5 ? 1 : -1;
    const lat = side * (18 + rand() * rand() * 320);
    const kind = pick(rand, extra);
    const n = kind === 'areca' || kind === 'palmyra' ? 2 + Math.floor(rand() * 5) : 1;
    for (let k = 0; k < n; k++) prop('far', s + (rand() - 0.5) * 12 * n, lat + (rand() - 0.5) * 10 * n, kind === 'bamboo' ? 8 : 4, kind === 'bamboo' ? 8 : 4, (kit) => PLANTS[kind](kit, rand, 0.85 + rand() * 0.35), { slope: 2.5, trackClear: 15 });
  }

  // ---- 10. bushes and grass by the line (near layer)
  const grassCol = { bengal: '#7d9a45', konkan: '#7f9b48', ghats: '#6f8f40', coastal: '#a8a067', plains: '#9a9a5a' }[biomeKey] ?? '#8a9a52';
  for (let s = -100; s < L + 100; s += 5) {
    if (rand() > 0.55 * density || overTunnelOrBridge(s)) continue;
    const side = rand() < 0.5 ? 1 : -1;
    const lat = side * (8.5 + rand() * rand() * 40);
    if (inStationYard(s, lat) || onRoad(s, lat, 1, 0.5) || T.underwater(s, lat) || occ.at(s, lat) >= 2) continue;
    const pos = place(s, lat);
    const kit = kitAt('near', pos.x, pos.z);
    kit.seed = rand();
    kit.place(pos.x, T.groundY(s, lat), pos.z, rand() * 6.28);
    if (rand() < 0.3) PLANTS.bush(kit, rand, 0.7 + rand() * 0.6);
    else PLANTS.grass(kit, rand, 0.8 + rand() * 0.6, grassCol);
  }

  // ---- 11. herds in the fields (with egrets and a herder), farmers at work, cows on the verge
  const herdMix = HERD[biomeKey] ?? HERD.plains;
  for (const f of classic.fields) {
    if (f.r >= density) continue;
    const r = rand();
    if (r < (biomeKey === 'coastal' ? 0.05 : 0.12)) {
      const n = 2 + Math.floor(rand() * 5);
      const kind = pickWeighted(rand, herdMix);
      for (let k = 0; k < n; k++) herdAnimal(rand() < 0.8 ? kind : pickWeighted(rand, herdMix), f.s + (rand() - 0.5) * f.sx * 0.7, f.lat + (rand() - 0.5) * f.sz * 0.7);
      if (biomeKey !== 'coastal') for (let k = 0; k < 2 + rand() * 4; k++) animal(f.s + (rand() - 0.5) * f.sx * 0.7, f.lat + (rand() - 0.5) * f.sz * 0.7, (kit) => A.egret(kit));
      if (rand() < 0.7) addPerson(f.s + f.sx * 0.4, f.lat + (rand() - 0.5) * f.sz * 0.5, 'man', ANIM.stand);
    } else if (r < 0.2) {
      for (let k = 0; k < 1 + rand() * 3; k++) addPerson(f.s + (rand() - 0.5) * f.sx * 0.7, f.lat + (rand() - 0.5) * f.sz * 0.7, rand() < 0.5 ? 'woman' : 'man', ANIM.stand);
    }
  }
  if (ROAD) {
    for (let s = ROAD.from + 100; s < ROAD.to - 100; s += 180) {
      if (rand() > 0.3) continue;
      const off = highwayOffset(s);
      const lat = off + (Math.sign(off) || 1) * (rand() < 0.5 ? 1 : -1) * (ROAD.width / 2 + 1.9);
      herdAnimal('cow', s, lat);
      // and somebody walking along the road
      route.sample(s, _p);
      const dir = rand() < 0.5 ? [Math.cos(_p.heading), Math.sin(_p.heading)] : [-Math.cos(_p.heading), -Math.sin(_p.heading)];
      addPerson(s + 8, off + (Math.sign(off) || 1) * (ROAD.width / 2 + 1.2), undefined, ANIM.walk, dir, { speed: 1.1 + rand() * 0.3, range: 60 + rand() * 60 });
    }
  }

  // ---- 12. classic trees now standing inside a building are removed
  for (const list of [classic.roundTrees, classic.tallTrees, classic.palms]) {
    for (const t of list) if (!removed.has(t) && occ.at(t.s, t.lat) >= 2) removed.add(t);
  }
  return { far, near, removed, people };
}

// The villagers list is read by Crowds.jsx (people are drawn by the crowd shader).
let richPeople = [];
const listeners = new Set();
export function setRichPeople(list) {
  richPeople = list;
  for (const cb of listeners) cb();
}
export function getRichPeople() {
  return richPeople;
}
export function subscribeRichPeople(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

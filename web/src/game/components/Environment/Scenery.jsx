// Trackside scenery from the route's biome kit (world/biomes.js): trees
// (round neem/peepal, tall eucalyptus, coconut palms), crop fields and ponds,
// basalt/laterite boulders, towns around the big stations, villages along the
// line, and km posts. Everything stands on the terrain (world/terrain.js) and
// keeps off roads, platforms, water, steep slopes and bridges. Placement is
// seeded-random (identical every run) and thinned out on lower presets.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { route, useQuality } from '../../state/gameStore.js';
import { STATIONS, ROUTE, TUNNELS, BRIDGES } from '../../config/gameConfig.js';
import { seededRandom } from '../../world/geometry.js';
import { onRoad } from '../../world/roadLayout.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { makeFacadeTexture } from '../../world/textures.js';
import { onEnvironmentChange } from '../../world/environment.js';
import { terrain } from '../../world/terrain.js';
import { biomeFor } from '../../world/biomes.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';

const CELL = 600;

const inStationYard = (s, lat) => STATIONS.some((st) => s > st.platformStart - 450 && s < st.platformEnd + 450 && lat < 55 && lat > -60);
/** 1 inside a town (around big stations), smaller for halts, 0 in the country. */
const townAt = (s) => {
  let t = 0;
  for (const st of STATIONS) {
    const r = st.size === 'major' ? 1400 : 600;
    if (Math.abs(s - st.centerS) < r) t = Math.max(t, st.size === 'major' ? 1 : 0.6);
  }
  return t;
};
const onBridgeOrPortal = (s, lat) =>
  BRIDGES.some((b) => s > b.from - 30 && s < b.to + 30 && Math.abs(lat - (b.lat ?? 0)) < 26) || TUNNELS.some((t) => (Math.abs(s - t.from) < 40 || Math.abs(s - t.to) < 40) && Math.abs(lat) < 30);

function pickWeighted(rand, weights) {
  const total = Object.values(weights).reduce((n, w) => n + w, 0);
  let r = rand() * total;
  for (const [k, w] of Object.entries(weights)) if ((r -= w) <= 0) return k;
  return Object.keys(weights)[0];
}

function generate() {
  const rand = seededRandom(2024);
  const biome = biomeFor(ROUTE);
  const T = terrain;
  const L = route.length;
  const p = {};
  const out = { roundTrees: [], tallTrees: [], palms: [], fields: [], ponds: [], buildings: [], tanks: [], kmPosts: [], rocks: [] };
  const place = (s, lat) => {
    route.sample(s, p);
    return { x: p.x + p.lx * lat, z: p.z + p.lz * lat, yaw: -p.heading };
  };
  /** Ground under a footprint: { min, max } of the corners, or null if it is wet. */
  const footprint = (s, lat, w, d) => {
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
      if (T.underwater(ss, ll)) return null;
      const h = T.groundY(ss, ll);
      min = Math.min(min, h);
      max = Math.max(max, h);
    }
    return { min, max };
  };
  const leafTints = ['#ffffff', '#e8f5d8', '#f4ffe6', '#dbe9c8', '#fff8e0'];

  // trees
  const treeStep = 8;
  for (let s = -400; s < L + 400; s += treeStep) {
    const town = townAt(s);
    for (const side of [1, -1]) {
      if (rand() > biome.treeDensity * (town ? 0.4 : 0.6)) continue;
      const lat = side * (14 + rand() * rand() * 360);
      const ts = s + rand() * treeStep;
      if (inStationYard(ts, lat) || onRoad(ts, lat, 3.2) || onBridgeOrPortal(ts, lat)) continue;
      const fp = footprint(ts, lat, 2, 2);
      if (!fp || fp.max - fp.min > 2.2) continue; // no trees in water or on cliff faces
      const pos = place(ts, lat);
      const kind = pickWeighted(rand, biome.trees);
      const scale = 0.75 + rand() * 0.6;
      const list = kind === 'palm' ? out.palms : kind === 'tall' ? out.tallTrees : out.roundTrees;
      const short = kind === 'palm' && ROUTE.scenery.biome === 'bengal' && rand() < 0.35; // banana-like
      list.push({
        ...pos,
        y: fp.min,
        yaw: rand() * Math.PI * 2,
        sx: scale,
        sy: scale * (short ? 0.35 : 0.85 + rand() * 0.3),
        sz: scale,
        color: leafTints[Math.floor(rand() * leafTints.length)],
        r: rand(),
      });
    }
  }

  // fields and ponds on level ground away from towns
  for (let s = -300; s < L + 300; s += 55) {
    if (townAt(s) >= 1) continue;
    for (const side of [1, -1]) {
      if (rand() > biome.fieldDensity) continue;
      const w = 40 + rand() * 90;
      const d = 30 + rand() * 80;
      const lat = side * (24 + d / 2 + rand() * 230);
      let blocked = inStationYard(s, lat) || onBridgeOrPortal(s, lat);
      for (let i = -2; i <= 2 && !blocked; i++) for (let j = -2; j <= 2 && !blocked; j++) blocked = onRoad(s + (i * w) / 4, lat + (j * d) / 4, 0, 4);
      if (blocked) continue;
      const fp = footprint(s, lat, w, d);
      if (!fp || fp.max - fp.min > 1.4) continue;
      const pond = rand() < biome.ponds;
      if (pond) {
        const r = Math.min(w, d) * 0.35;
        out.ponds.push({ ...place(s, lat), y: fp.max + 0.04, sx: r, sy: 1, sz: r * (0.7 + rand() * 0.5), r: rand() });
      } else {
        out.fields.push({ ...place(s, lat), y: (fp.min + fp.max) / 2 + 0.02, sx: w, sy: fp.max - fp.min + 0.12, sz: d, color: biome.fields[Math.floor(rand() * biome.fields.length)], r: rand() });
      }
    }
  }

  const addBuilding = (s, lat, big) => {
    if (inStationYard(s, lat) || onBridgeOrPortal(s, lat)) return;
    const floors = big ? 2 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 2);
    const h = floors * 3 + 0.6;
    const w = 4 * (2 + Math.floor(rand() * (big ? 3 : 2)));
    const d = 6 + rand() * 8;
    if (onRoad(s, lat, Math.hypot(w, d) / 2, 3)) return; // never build on a road
    const fp = footprint(s, lat, w, d);
    if (!fp || fp.max - fp.min > 2.5) return;
    const pos = place(s, lat);
    const base = fp.min - 0.3;
    const hh = h + (fp.max - base);
    out.buildings.push({ ...pos, y: base + hh / 2, sx: w, sy: hh, sz: d, color: biome.plaster[Math.floor(rand() * biome.plaster.length)], r: rand() });
    if (rand() < 0.6) {
      // the ubiquitous black plastic water tank on the roof
      route.sample(s, p);
      const off = (rand() - 0.5) * (w * 0.5);
      out.tanks.push({ x: pos.x + Math.cos(p.heading) * off, y: base + hh + 0.75, z: pos.z + Math.sin(p.heading) * off, r: rand() });
    }
  };
  // towns around stations
  for (let s = 0; s < L; s += 13) {
    const town = townAt(s);
    if (!town) continue;
    for (const side of [1, -1]) if (rand() < 0.75 * town * biome.buildingDensity) addBuilding(s, side * (26 + rand() * 280 * town), town >= 1);
  }
  // villages along the line
  for (const vs of ROUTE.scenery.villages ?? []) {
    for (let k = 0; k < 2; k++) {
      const side = rand() < 0.5 ? 1 : -1;
      const lat0 = 60 + rand() * 200;
      const n = Math.round((6 + Math.floor(rand() * 10)) * Math.min(1.4, biome.buildingDensity + 0.2));
      for (let j = 0; j < n; j++) addBuilding(vs + (rand() - 0.5) * 160, side * (lat0 + rand() * 80), false);
    }
  }

  // boulders on hillsides (basalt in the ghats, laterite in the Konkan)
  if (biome.rocks > 0) {
    const rockCols = ROUTE.scenery.biome === 'konkan' ? ['#8a4a32', '#9b5a3c', '#7a4330'] : ['#5b5850', '#6a665c', '#4f4c45'];
    for (let s = 0; s < L; s += 14) {
      if (rand() > biome.rocks) continue;
      const side = rand() < 0.5 ? 1 : -1;
      const lat = side * (10 + rand() * 260);
      if (inStationYard(s, lat) || onRoad(s, lat, 3) || onBridgeOrPortal(s, lat)) continue;
      const fp = footprint(s, lat, 3, 3);
      if (!fp) continue;
      const sc = 0.8 + rand() * rand() * 4;
      out.rocks.push({ ...place(s, lat), y: fp.min + sc * 0.3, yaw: rand() * 6.3, sx: sc * (0.8 + rand() * 0.6), sy: sc * (0.5 + rand() * 0.5), sz: sc, color: rockCols[Math.floor(rand() * rockCols.length)], r: rand() });
    }
  }

  for (let s = 1000; s < L; s += 1000) {
    if (TUNNELS.some((t) => s > t.from - 5 && s < t.to + 5) || BRIDGES.some((b) => b.track !== false && s > b.from - 5 && s < b.to + 5)) continue;
    out.kmPosts.push({ ...place(s, 3.4), y: route.heightAt(s) + 0.6, sx: 0.25, sy: 1.2, sz: 0.25 });
  }
  return out;
}

function buildTreeGeometries() {
  const round = new ModelBuilder();
  round.cylinder({ radiusTop: 0.22, radiusBottom: 0.35, length: 3.2, segments: 6, position: [0, 1.6, 0], color: '#5b4633' });
  round.add(new THREE.IcosahedronGeometry(2.6, 0), { color: '#4d7a32', position: [0, 4.6, 0], scale: [1, 0.8, 1] });
  round.add(new THREE.IcosahedronGeometry(1.9, 0), { color: '#5a8a3a', position: [1.4, 5.2, 0.6], scale: [1, 0.8, 1] });
  round.add(new THREE.IcosahedronGeometry(1.8, 0), { color: '#44702c', position: [-1.2, 5.0, -0.9], scale: [1, 0.8, 1] });
  const tall = new ModelBuilder();
  tall.cylinder({ radiusTop: 0.12, radiusBottom: 0.25, length: 9, segments: 5, position: [0, 4.5, 0], color: '#cfc4b0' });
  tall.add(new THREE.IcosahedronGeometry(1.7, 0), { color: '#6b8b4a', position: [0, 9.5, 0], scale: [1, 1.9, 1] });
  tall.add(new THREE.IcosahedronGeometry(1.2, 0), { color: '#7a9a55', position: [0.6, 7.6, 0.3], scale: [1, 1.5, 1] });
  // coconut palm: a slender, slightly leaning trunk and a crown of drooping fronds
  const palm = new ModelBuilder();
  const segs = 5;
  let px = 0;
  for (let k = 0; k < segs; k++) {
    const y0 = (k * 11) / segs;
    const lean = 0.18 * k * k;
    palm.cylinder({ radiusTop: 0.17, radiusBottom: 0.21, length: 11 / segs + 0.05, segments: 6, position: [lean, y0 + 11 / segs / 2, 0], color: '#8a7a62' });
    px = lean;
  }
  for (let f = 0; f < 8; f++) {
    const a = (f / 8) * Math.PI * 2;
    const frond = new THREE.BoxGeometry(4.2, 0.06, 0.75);
    frond.translate(2.1, 0, 0);
    palm.add(frond, { color: f % 2 ? '#4f7f2e' : '#5d8d36', position: [px, 11, 0], rotation: [0, a, -0.45] });
  }
  palm.add(new THREE.IcosahedronGeometry(0.55, 0), { color: '#6e5a2e', position: [px, 10.7, 0] });
  return { round: round.build().body, tall: tall.build().body, palm: palm.build().body };
}

/**
 * Buildings: one instanced unit box; the shader scales UVs by instance size so
 * windows never stretch. At night a per-window hash (window cell + building
 * position) decides which windows are lit, warm bulbs or cool tube lights —
 * thousands of individually lit windows for zero extra draw calls.
 */
const windowGlow = { value: 0 };
function makeBuildingMaterial() {
  const map = makeFacadeTexture();
  const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.95 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindowGlow = windowGlow;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec2 vWinUv;
        varying float vRoof;
        varying float vSeed;`,
      )
      .replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
      #if defined(USE_INSTANCING) && defined(USE_MAP)
        vec3 bs = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
        vSeed = dot(instanceMatrix[3].xz, vec2(0.0123, 0.0371));
        vRoof = abs(normal.y) > 0.5 ? 1.0 : 0.0;
        if (abs(normal.y) > 0.5) {
          vMapUv = vec2(0.05, 0.95);
        } else {
          vec2 dims = abs(normal.x) > 0.5 ? vec2(bs.z, bs.y) : vec2(bs.x, bs.y);
          vMapUv = uv * dims / vec2(4.0, 3.0);
        }
        vWinUv = vMapUv;
      #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uWindowGlow;
        varying vec2 vWinUv;
        varying float vRoof;
        varying float vSeed;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uWindowGlow > 0.0) {
          vec2 cellId = floor(vWinUv);
          vec2 f = fract(vWinUv);
          float inWin = step(0.29, f.x) * step(f.x, 0.71) * step(0.34, f.y) * step(f.y, 0.74);
          float h = fract(sin(dot(cellId + vSeed * 57.0, vec2(12.9898, 78.233))) * 43758.5453);
          float lit = step(0.55, h);
          vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(0.8, 0.92, 1.0), step(0.82, h));
          totalEmissiveRadiance += warm * inWin * lit * uWindowGlow * (1.0 - vRoof) * (0.7 + 0.6 * fract(h * 13.7));
        }`,
      );
  };
  return mat;
}

export default function Scenery() {
  const quality = useQuality();
  const all = useMemo(generate, []);
  const data = useMemo(() => {
    // Lower presets keep a deterministic subset (each item has a random r in 0..1)
    const keep = (list) => list.filter((it) => it.r === undefined || it.r < quality.sceneryDensity);
    return Object.fromEntries(Object.entries(all).map(([k, v]) => [k, keep(v)]));
  }, [all, quality.sceneryDensity]);

  const assets = useMemo(() => {
    const trees = buildTreeGeometries();
    const vc = (opts) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, ...opts });
    return {
      roundTree: trees.round,
      tallTree: trees.tall,
      palm: trees.palm,
      treeMat: vc({ flatShading: true }),
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      disc: new THREE.CylinderGeometry(1, 1, 0.1, 18),
      rock: new THREE.IcosahedronGeometry(1, 0),
      rockMat: new THREE.MeshStandardMaterial({ roughness: 1, flatShading: true }),
      pondMat: new THREE.MeshStandardMaterial({ color: biomeFor(ROUTE).water, roughness: 0.12, metalness: 0.05 }),
      fieldMat: new THREE.MeshStandardMaterial({ roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      buildingMat: makeBuildingMaterial(),
      tank: new THREE.CylinderGeometry(0.75, 0.75, 1.5, 10),
      tankMat: new THREE.MeshStandardMaterial({ color: '#1c1c1c', roughness: 0.6 }),
      postMat: new THREE.MeshStandardMaterial({ color: '#f4f1e8' }),
    };
  }, []);
  useEffect(
    () => () => {
      for (const a of Object.values(assets)) {
        a.map?.dispose();
        a.dispose?.();
      }
    },
    [assets],
  );

  useEffect(
    () =>
      onEnvironmentChange((env) => {
        windowGlow.value = 1.4 * env.lamps * env.night;
      }),
    [],
  );

  const far = quality.sceneryDistance;
  return (
    <group>
      <ChunkedInstances items={data.fields} geometry={assets.unitBox} material={assets.fieldMat} cellSize={CELL} maxDistance={far} receiveShadow />
      {data.ponds.length > 0 && <ChunkedInstances items={data.ponds} geometry={assets.disc} material={assets.pondMat} cellSize={CELL} maxDistance={far} />}
      <ChunkedInstances items={data.roundTrees} geometry={assets.roundTree} material={assets.treeMat} cellSize={CELL} maxDistance={far} />
      <ChunkedInstances items={data.tallTrees} geometry={assets.tallTree} material={assets.treeMat} cellSize={CELL} maxDistance={far} />
      {data.palms.length > 0 && <ChunkedInstances items={data.palms} geometry={assets.palm} material={assets.treeMat} cellSize={CELL} maxDistance={far} />}
      {data.rocks.length > 0 && <ChunkedInstances items={data.rocks} geometry={assets.rock} material={assets.rockMat} cellSize={CELL} maxDistance={far} />}
      <ChunkedInstances items={data.buildings} geometry={assets.unitBox} material={assets.buildingMat} cellSize={CELL} maxDistance={far} />
      <ChunkedInstances items={data.tanks} geometry={assets.tank} material={assets.tankMat} cellSize={CELL} maxDistance={quality.detailDistance} />
      <ChunkedInstances items={data.kmPosts} geometry={assets.unitBox} material={assets.postMat} cellSize={CELL} maxDistance={quality.detailDistance} />
    </group>
  );
}

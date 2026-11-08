// Trackside scenery: trees (round neem/peepal + tall eucalyptus), crop fields
// (incl. yellow mustard), multi-storey town buildings with black rooftop water
// tanks, and km posts. Placement is seeded-random (identical every run) and
// thinned out on lower quality presets.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { route, useQuality } from '../../state/gameStore.js';
import { STATIONS } from '../../config/gameConfig.js';
import { seededRandom } from '../../world/geometry.js';
import { onRoad } from '../../world/roadLayout.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { makeFacadeTexture } from '../../world/textures.js';
import { onEnvironmentChange } from '../../world/environment.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';

const CITY_RADIUS = 1400;
const CELL = 600;

const inStationYard = (s, lat) => STATIONS.some((st) => s > st.platformStart - 450 && s < st.platformEnd + 450 && lat < 55 && lat > -60);
const inCity = (s) => STATIONS.some((st) => Math.abs(s - (st.platformStart + st.platformEnd) / 2) < CITY_RADIUS);

function generate() {
  const rand = seededRandom(2024);
  const p = {};
  const out = { roundTrees: [], tallTrees: [], fields: [], buildings: [], tanks: [], kmPosts: [] };
  const place = (s, lat) => {
    route.sample(s, p);
    return { x: p.x + p.lx * lat, z: p.z + p.lz * lat, yaw: -p.heading };
  };
  const leafTints = ['#ffffff', '#e8f5d8', '#f4ffe6', '#dbe9c8', '#fff8e0'];
  const fieldColours = ['#d9c037', '#cfb52e', '#7aa03e', '#6b9136', '#8c6f49', '#9fad55', '#5f8a33'];
  const plaster = ['#f4ead2', '#f6d6c8', '#d6e6ee', '#f3e7a6', '#ececec', '#e3c39f', '#d3e2c0', '#f6dcdc', '#e9e0f0'];

  for (let s = 0; s < route.length; s += 8) {
    const city = inCity(s);
    for (const side of [1, -1]) {
      if (rand() > (city ? 0.25 : 0.6)) continue;
      const lat = side * (14 + rand() * rand() * 340);
      const ts = s + rand() * 8;
      if (inStationYard(ts, lat) || onRoad(ts, lat, 3.2)) continue; // keep canopies off the roads
      const pos = place(ts, lat);
      const scale = 0.75 + rand() * 0.6;
      const tall = rand() < 0.3;
      (tall ? out.tallTrees : out.roundTrees).push({
        ...pos,
        yaw: rand() * Math.PI * 2,
        sx: scale,
        sy: scale * (0.85 + rand() * 0.3),
        sz: scale,
        color: leafTints[Math.floor(rand() * leafTints.length)],
        r: rand(),
      });
    }
  }

  for (let s = 0; s < route.length; s += 55) {
    if (inCity(s)) continue;
    for (const side of [1, -1]) {
      if (rand() > 0.7) continue;
      const w = 40 + rand() * 90;
      const d = 30 + rand() * 80;
      const lat = side * (24 + d / 2 + rand() * 230);
      // a field must not be painted over a road: test a grid of points across it
      let blocked = false;
      for (let i = -2; i <= 2 && !blocked; i++) for (let j = -2; j <= 2 && !blocked; j++) blocked = onRoad(s + (i * w) / 4, lat + (j * d) / 4, 0, 4);
      if (blocked) continue;
      out.fields.push({ ...place(s, lat), y: 0.06, sx: w, sy: 0.1, sz: d, color: fieldColours[Math.floor(rand() * fieldColours.length)], r: rand() });
    }
  }

  const addBuilding = (s, lat, big) => {
    if (inStationYard(s, lat)) return;
    const floors = big ? 2 + Math.floor(rand() * 4) : 1 + Math.floor(rand() * 2);
    const h = floors * 3 + 0.6;
    const w = 4 * (2 + Math.floor(rand() * (big ? 3 : 2)));
    const d = 6 + rand() * 8;
    if (onRoad(s, lat, Math.hypot(w, d) / 2, 3)) return; // never build on a road
    const pos = place(s, lat);
    out.buildings.push({ ...pos, y: h / 2, sx: w, sy: h, sz: d, color: plaster[Math.floor(rand() * plaster.length)], r: rand() });
    if (rand() < 0.6) {
      // the ubiquitous black plastic water tank on the roof
      route.sample(s, p);
      const off = (rand() - 0.5) * (w * 0.5);
      out.tanks.push({ x: pos.x + Math.cos(p.heading) * off, y: h + 0.75, z: pos.z + Math.sin(p.heading) * off, r: rand() });
    }
  };
  for (let s = 0; s < route.length; s += 13) {
    if (!inCity(s)) continue;
    for (const side of [1, -1]) if (rand() < 0.75) addBuilding(s, side * (26 + rand() * 280), true);
  }
  for (let i = 0; i < 10; i++) {
    const s = 1700 + rand() * 4700;
    const side = rand() < 0.5 ? 1 : -1;
    const lat0 = 60 + rand() * 220;
    const n = 6 + Math.floor(rand() * 10);
    for (let j = 0; j < n; j++) addBuilding(s + (rand() - 0.5) * 130, side * (lat0 + rand() * 70), false);
  }
  for (let s = 1000; s < route.length; s += 1000) out.kmPosts.push({ ...place(s, 3.4), y: 0.6, sx: 0.25, sy: 1.2, sz: 0.25 });
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
  return { round: round.build().body, tall: tall.build().body };
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
      treeMat: vc({ flatShading: true }),
      unitBox: new THREE.BoxGeometry(1, 1, 1),
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
      <ChunkedInstances items={data.roundTrees} geometry={assets.roundTree} material={assets.treeMat} cellSize={CELL} maxDistance={far} />
      <ChunkedInstances items={data.tallTrees} geometry={assets.tallTree} material={assets.treeMat} cellSize={CELL} maxDistance={far} />
      <ChunkedInstances items={data.buildings} geometry={assets.unitBox} material={assets.buildingMat} cellSize={CELL} maxDistance={far} />
      <ChunkedInstances items={data.tanks} geometry={assets.tank} material={assets.tankMat} cellSize={CELL} maxDistance={quality.detailDistance} />
      <ChunkedInstances items={data.kmPosts} geometry={assets.unitBox} material={assets.postMat} cellSize={CELL} maxDistance={quality.detailDistance} />
    </group>
  );
}

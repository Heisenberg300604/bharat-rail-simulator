// The ground: a corridor of terrain swept along the line (route coordinates
// s × lat, see world/terrain.js), a big far plane beyond it, and water (sea,
// rivers). The corridor is split into ~500 m chunks so the GPU culls what is
// behind the camera; normals come from the whole grid so chunks never show
// seams. At each tunnel portal a hole is left in the ground for the bore.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROUTE } from '../../config/gameConfig.js';
import { terrain, CORRIDOR } from '../../world/terrain.js';
import { biomeFor } from '../../world/biomes.js';
import { makeNoiseTexture } from '../../world/textures.js';
import { onEnvironmentChange } from '../../world/environment.js';
import { mainLine } from '../../world/trackLayout.js';

const CHUNK_ROWS = 40;
const EXTEND = 1600; // terrain continues this far beyond both ends of the line
// dense near the line (cuttings, embankments, scenery), coarser towards the horizon
const COLS = [0, 1.5, 3, 4.2, 5.6, 7.2, 9, 11.5, 14, 17, 21, 26, 32, 40, 50, 62, 76, 92, 110, 130, 152, 176, 202, 230, 262, 298, 338, 384, 436, 496, 566, 650, 750, 870, 1010, 1180, 1380, 1590, CORRIDOR];

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

function buildColumns(T) {
  const set = [...COLS, ...COLS.map((c) => -c), T.formation[0], T.formation[1]];
  if (ROUTE.tunnels.length) {
    const { c, hw } = T.bore;
    set.push(c - hw, c + hw, c - hw - 1.4, c + hw + 1.4);
  }
  const sorted = set.sort((a, b) => b - a); // left (+) to right (−)
  return sorted.filter((v, i) => i === 0 || Math.abs(v - sorted[i - 1]) > 0.35);
}

function buildRows() {
  const L = ROUTE.length;
  const rows = [];
  for (let s = -EXTEND; s < 0; s += 40) rows.push(s);
  for (let s = 0; s <= L; s += 12) rows.push(s);
  for (let s = L + 40; s <= L + EXTEND; s += 40) rows.push(s);
  for (const t of ROUTE.tunnels) rows.push(t.from - 0.6, t.from, t.to, t.to + 0.6);
  for (const b of ROUTE.bridges) if (b.track !== false) rows.push(b.from, b.to);
  rows.sort((a, b) => a - b);
  return rows.filter((v, i) => i === 0 || v - rows[i - 1] > 0.2);
}

function buildTerrain() {
  const T = terrain;
  const biome = biomeFor(ROUTE);
  const pal = Object.fromEntries(Object.entries(biome.ground).map(([k, v]) => [k, new THREE.Color(v)]));
  const rows = buildRows();
  const cols = buildColumns(T);
  const nr = rows.length;
  const nc = cols.length;
  const pos = new Float32Array(nr * nc * 3);
  const lats = new Float32Array(nr * nc);
  const tyRow = new Float32Array(nr);
  const p = {};
  for (let i = 0; i < nr; i++) {
    const s = rows[i];
    const ctx = T.row(Math.min(Math.max(s, 0), ROUTE.length));
    ctx.s = s; // noise keeps varying beyond the ends
    T.extSample(s, p);
    tyRow[i] = ctx.ty;
    const limL = T.corridorLimit(s, 1);
    const limR = T.corridorLimit(s, -1);
    for (let j = 0; j < nc; j++) {
      const lim = cols[j] >= 0 ? limL : limR;
      const lat = Math.max(-lim, Math.min(lim, cols[j]));
      const h = T.surfaceAt(ctx, lat, lim); // the same surface scenery stands on
      const k = i * nc + j;
      pos[k * 3] = p.x + p.lx * lat;
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = p.z + p.lz * lat;
      lats[k] = lat;
    }
  }

  // normals from the whole grid (central differences) → no seams between chunks
  const nrm = new Float32Array(nr * nc * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const n = new THREE.Vector3();
  const P = (i, j, v) => v.set(pos[(i * nc + j) * 3], pos[(i * nc + j) * 3 + 1], pos[(i * nc + j) * 3 + 2]);
  const pa = new THREE.Vector3();
  const pb = new THREE.Vector3();
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      P(Math.min(nr - 1, i + 1), j, pa);
      P(Math.max(0, i - 1), j, pb);
      a.subVectors(pa, pb); // along the line
      P(i, Math.max(0, j - 1), pa);
      P(i, Math.min(nc - 1, j + 1), pb);
      b.subVectors(pa, pb); // towards the left
      n.crossVectors(b, a).normalize();
      if (n.y < 0) n.negate();
      if (!Number.isFinite(n.y)) n.set(0, 1, 0);
      nrm.set([n.x, n.y, n.z], (i * nc + j) * 3);
    }
  }

  // vertex colours: grass/dust patches, rock on steep faces, sand by the water
  const col = new Float32Array(nr * nc * 3);
  const c = new THREE.Color();
  const water = T.waterLevel;
  for (let i = 0; i < nr; i++) {
    for (let j = 0; j < nc; j++) {
      const k = i * nc + j;
      const h = pos[k * 3 + 1];
      const ny = nrm[k * 3 + 1];
      const lat = lats[k];
      const patch = 0.5 + 0.5 * Math.sin(pos[k * 3] * 0.0071 + Math.cos(pos[k * 3 + 2] * 0.0053) * 2.1) * Math.cos(pos[k * 3 + 2] * 0.0047);
      c.copy(pal.grass).lerp(pal.dust, patch * 0.8);
      // bare rock on cutting walls and steep hillsides near the line; grass further out
      const steep = smoothstep(0.86, 0.6, ny) * (1 - smoothstep(250, 450, Math.abs(lat)));
      if (steep > 0) c.lerp(Math.abs(lat) < 40 && Math.abs(h - tyRow[i]) < 25 ? pal.cut : pal.rock, steep * 0.85);
      if (water !== null) {
        c.lerp(pal.sand, smoothstep(water + 2.2, water + 0.3, h));
        if (h < water - 0.2) c.copy(pal.bed);
      }
      if (Math.abs(lat) < 5 && Math.abs(h - tyRow[i] + 0.05) < 0.02) c.lerp(pal.dust, 0.5); // trodden cess beside the track
      c.lerp(pal.far, smoothstep(900, CORRIDOR, Math.abs(lat)) * 0.8);
      col.set([c.r, c.g, c.b], k * 3);
    }
  }
  // river beds (non-sea routes): sand where the ground dips under the river level
  for (const br of ROUTE.bridges) {
    if (!br.river || T.sea) continue;
    for (let i = 0; i < nr; i++) {
      if (rows[i] < br.from - 120 || rows[i] > br.to + 120) continue;
      for (let j = 0; j < nc; j++) {
        const k = i * nc + j;
        const h = pos[k * 3 + 1];
        const t = smoothstep(br.river.level + 2.5, br.river.level + 0.4, h);
        if (t > 0) {
          c.setRGB(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]).lerp(h < br.river.level - 0.3 ? pal.bed : pal.sand, t);
          col.set([c.r, c.g, c.b], k * 3);
        }
      }
    }
  }

  // tunnel portals: leave the ground open in front of the bore
  const holeRow = new Uint8Array(nr);
  for (const t of ROUTE.tunnels) {
    for (let i = 0; i < nr - 1; i++) {
      if ((rows[i] >= t.from - 0.7 && rows[i + 1] <= t.from + 0.01) || (rows[i] >= t.to - 0.01 && rows[i + 1] <= t.to + 0.7)) holeRow[i] = 1;
    }
  }
  const { c: bc, hw } = T.bore;
  const inBore = (j) => cols[j] <= bc + hw + 0.01 && cols[j + 1] >= bc - hw - 0.01;

  const chunks = [];
  for (let r0 = 0; r0 < nr - 1; r0 += CHUNK_ROWS) {
    const r1 = Math.min(nr - 1, r0 + CHUNK_ROWS);
    const count = (r1 - r0 + 1) * nc;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos.slice(r0 * nc * 3, (r1 + 1) * nc * 3), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm.slice(r0 * nc * 3, (r1 + 1) * nc * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col.slice(r0 * nc * 3, (r1 + 1) * nc * 3), 3));
    const uv = new Float32Array(count * 2);
    for (let k = 0; k < count; k++) {
      uv[k * 2] = pos[(r0 * nc + k) * 3] / 24;
      uv[k * 2 + 1] = pos[(r0 * nc + k) * 3 + 2] / 24;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    const idx = [];
    for (let i = r0; i < r1; i++) {
      for (let j = 0; j < nc - 1; j++) {
        if (holeRow[i] && inBore(j)) continue;
        const A = (i - r0) * nc + j;
        const B = A + 1;
        const C = A + nc;
        const D = C + 1;
        idx.push(A, B, C, B, D, C); // counter-clockwise seen from above → faces point up
      }
    }
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    chunks.push(geo);
  }

  // far plane under/around everything
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (let k = 0; k < nr * nc; k += 7) {
    minX = Math.min(minX, pos[k * 3]);
    maxX = Math.max(maxX, pos[k * 3]);
    minZ = Math.min(minZ, pos[k * 3 + 2]);
    maxZ = Math.max(maxZ, pos[k * 3 + 2]);
  }
  const size = Math.max(maxX - minX, maxZ - minZ) + 9000;
  const far = new THREE.PlaneGeometry(size, size, 1, 1);
  far.rotateX(-Math.PI / 2);
  far.translate((minX + maxX) / 2, T.baseLevel - 0.25, (minZ + maxZ) / 2);
  return { chunks, far, farColor: pal.far, bounds: { minX, maxX, minZ, maxZ, size } };
}

/** Water surfaces: the sea (one big plane) and a strip for every river under a bridge. */
function buildWater(bounds) {
  const out = [];
  const T = terrain;
  if (T.sea) {
    const g = new THREE.PlaneGeometry(bounds.size, bounds.size, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.translate((bounds.minX + bounds.maxX) / 2, T.sea.level, (bounds.minZ + bounds.maxZ) / 2);
    out.push(g);
  }
  const p = {};
  for (const b of ROUTE.bridges) {
    if (!b.river || (T.sea && Math.abs(b.river.level - T.sea.level) < 0.5)) continue;
    mainLine.sample((b.from + b.to) / 2, p);
    const g = new THREE.PlaneGeometry(b.to - b.from + 220, CORRIDOR * 2, 1, 1);
    g.rotateX(-Math.PI / 2);
    g.rotateY(-p.heading);
    g.translate(p.x, b.river.level, p.z);
    out.push(g);
  }
  return out;
}

const waterTime = { value: 0 };
function makeWaterMaterial(color) {
  const m = new THREE.MeshStandardMaterial({ color, roughness: 0.14, metalness: 0.05, transparent: true, opacity: 0.93, envMapIntensity: 1.2 });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = waterTime;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nvarying vec3 vWPos;')
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        {
          vec2 q = vWPos.xz;
          float t = uTime;
          vec3 wn = normalize(vec3(
            sin(q.x * 0.21 + t * 1.3) * 0.05 + sin(q.y * 0.37 - t * 0.9) * 0.035 + sin((q.x - q.y) * 0.9 + t * 2.1) * 0.02,
            1.0,
            cos(q.y * 0.18 + t) * 0.05 + sin((q.x + q.y) * 0.5 + t * 1.7) * 0.03));
          normal = normalize((viewMatrix * vec4(wn, 0.0)).xyz);
        }`,
      );
  };
  return m;
}

export default function Terrain() {
  const built = useMemo(buildTerrain, []);
  const water = useMemo(() => buildWater(built.bounds), [built]);
  const mats = useMemo(() => {
    const tex = makeNoiseTexture({ base: '#d9d9d0', speckles: ['#bfc4a6', '#e8e2c9', '#a9b38a', '#cfc7a3', '#9aa37c'], density: 2.5, seed: 11 });
    tex.repeat.set(1, 1);
    const farTex = tex.clone();
    farTex.repeat.set(built.bounds.size / 24, built.bounds.size / 24);
    farTex.needsUpdate = true;
    return {
      ground: new THREE.MeshStandardMaterial({ map: tex, vertexColors: true, roughness: 1 }),
      far: new THREE.MeshStandardMaterial({ map: farTex, color: built.farColor, roughness: 1 }),
      water: makeWaterMaterial(biomeFor(ROUTE).water),
    };
  }, [built]);

  // Rain darkens the soil a little (wet look) without any extra shader work.
  useEffect(
    () =>
      onEnvironmentChange((env) => {
        mats.ground.color.setScalar(1 - env.rain * 0.28);
        mats.far.color.copy(built.farColor).multiplyScalar(1 - env.rain * 0.28);
      }),
    [mats, built],
  );
  useFrame((state) => {
    if (water.length) waterTime.value = state.clock.elapsedTime;
  });
  useEffect(
    () => () => {
      built.chunks.forEach((g) => g.dispose());
      built.far.dispose();
      water.forEach((g) => g.dispose());
      for (const m of Object.values(mats)) {
        m.map?.dispose();
        m.dispose();
      }
    },
    [built, water, mats],
  );

  return (
    <group>
      {built.chunks.map((g, i) => (
        <mesh key={i} geometry={g} material={mats.ground} receiveShadow />
      ))}
      <mesh geometry={built.far} material={mats.far} receiveShadow />
      {water.map((g, i) => (
        <mesh key={`w${i}`} geometry={g} material={mats.water} renderOrder={1} />
      ))}
    </group>
  );
}

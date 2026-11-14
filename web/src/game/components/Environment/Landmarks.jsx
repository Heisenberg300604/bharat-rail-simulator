// Route landmarks: original, low-poly procedural models of famous sights seen
// from the line (a Taj-like mausoleum by the Yamuna, a red sandstone fort,
// white Goan churches, a South-Indian gopuram, a lighthouse, a ghat rock
// spire), monsoon waterfalls on the ghat and fishing boats on the water.
// All static models merge into one draw call; waterfalls and boats add one each.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROUTE } from '../../config/gameConfig.js';
import { route } from '../../state/gameStore.js';
import { terrain } from '../../world/terrain.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { seededRandom } from '../../world/geometry.js';
import { createGlowMaterial, makeGlowMesh, disposeGlowMaterial } from '../../world/glow.js';

const MARBLE = '#f2eee4';
const SANDSTONE = '#a64b37';

function dome(b, r, y, x, z, color, m, squash = 1.15) {
  b.add(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.62), { color, position: [x, y, z], scale: [1, squash, 1], matrix: m });
  b.cylinder({ radius: r * 0.08, length: r * 0.9, position: [x, y + r * squash + r * 0.3, z], color: '#d7b25a', segments: 6, matrix: m });
}

const MODELS = {
  taj(b, m) {
    b.box([-48, 48], [0, 6], [-48, 48], MARBLE, { matrix: m });
    b.cylinder({ radius: 31, length: 26, segments: 8, position: [0, 19, 0], color: MARBLE, matrix: m });
    b.box([-9, 9], [8, 31], [-31.5, -29], '#e3ddd0', { matrix: m }); // iwan facing the river side
    b.cylinder({ radius: 12.5, length: 8, segments: 16, position: [0, 36, 0], color: MARBLE, matrix: m });
    dome(b, 14.5, 40, 0, 0, MARBLE, m, 1.3);
    for (const [x, z] of [
      [-17, -17],
      [17, -17],
      [-17, 17],
      [17, 17],
    ]) {
      b.cylinder({ radius: 4, length: 5, segments: 8, position: [x, 34.5, z], color: MARBLE, matrix: m });
      dome(b, 4.2, 37, x, z, MARBLE, m);
    }
    for (const [x, z] of [
      [-44, -44],
      [44, -44],
      [-44, 44],
      [44, 44],
    ]) {
      b.cylinder({ radiusTop: 1.9, radiusBottom: 2.6, length: 40, segments: 10, position: [x, 26, z], color: MARBLE, matrix: m });
      b.cylinder({ radius: 3.1, length: 0.6, segments: 10, position: [x, 34, z], color: '#e6e0d2', matrix: m });
      dome(b, 2.4, 46, x, z, MARBLE, m);
    }
    // red sandstone mosque and its twin either side
    for (const x of [-95, 95]) {
      b.box([x - 28, x + 28], [0, 13], [-12, 12], SANDSTONE, { matrix: m });
      for (const dx of [-14, 0, 14]) dome(b, dx === 0 ? 6 : 4.5, 13, x + dx, 0, MARBLE, m);
    }
  },
  fort(b, m) {
    for (let x = -300; x <= 300; x += 75) {
      b.box([x - 37.5, x + 37.5], [0, 20], [-5, 5], SANDSTONE, { matrix: m });
      b.box([x - 37.5, x + 37.5], [20, 22], [-5.5, 5.5], '#8f3f2e', { matrix: m });
      b.cylinder({ radius: 9, length: 25, segments: 12, position: [x - 37.5, 12.5, 0], color: '#9d4532', matrix: m });
    }
    b.box([-14, 14], [0, 30], [-9, 9], '#b05540', { matrix: m }); // gate
    for (const x of [-14, 14]) b.cylinder({ radius: 6, length: 34, segments: 8, position: [x, 17, -2], color: '#a64b37', matrix: m });
    for (const [x, z] of [
      [-120, 60],
      [40, 70],
      [160, 55],
    ]) {
      b.box([x - 20, x + 20], [0, 26], [z - 15, z + 15], MARBLE, { matrix: m });
      dome(b, 7, 26, x, z, MARBLE, m);
    }
  },
  church(b, m) {
    const w = '#f6f4ee';
    b.box([-14, 14], [0, 24], [-2, 2], w, { matrix: m }); // facade
    b.box([-7, 7], [24, 30], [-1.6, 1.6], w, { matrix: m }); // gable
    for (const x of [-12, 12]) {
      b.box([x - 4, x + 4], [0, 33], [-3, 4], w, { matrix: m }); // towers
      b.box([x - 4.6, x + 4.6], [33, 34], [-3.6, 4.6], '#e2ddd2', { matrix: m });
      dome(b, 3.2, 34, x, 0.5, w, m, 0.9);
    }
    b.box([-10, 10], [0, 18], [2, 52], w, { matrix: m }); // nave
    for (const [z0, z1, tilt] of [
      [2, 52, 0.42],
      [2, 52, -0.42],
    ])
      b.add(new THREE.BoxGeometry(12.5, 0.4, z1 - z0), { color: '#a4492f', position: [tilt > 0 ? -4.6 : 4.6, 20.4, (z0 + z1) / 2], rotation: [0, 0, tilt], matrix: m });
    b.box([-1, 1], [26, 33], [-1.8, -1.6], '#d2b057', { matrix: m }); // cross on the gable
    b.box([-2.6, 2.6], [30.6, 31.4], [-1.8, -1.6], '#d2b057', { matrix: m });
  },
  temple(b, m) {
    const c = '#efe3c5';
    b.box([-30, 30], [0, 3], [-22, 22], '#d9cba8', { matrix: m });
    b.box([-22, 22], [3, 15], [-15, 15], c, { matrix: m });
    b.cylinder({ radius: 11, length: 9, segments: 12, position: [0, 19.5, 0], color: c, matrix: m });
    dome(b, 11, 24, 0, 0, '#f4ead2', m, 1.05);
    for (const [x, z] of [
      [-18, -12],
      [18, -12],
      [-18, 12],
      [18, 12],
    ]) {
      b.box([x - 3, x + 3], [15, 20], [z - 3, z + 3], c, { matrix: m });
      dome(b, 3, 20, x, z, '#f4ead2', m);
    }
    b.box([-30, 30], [0, 0.6], [-40, -22], '#cfc3a5', { matrix: m }); // ghat steps to the river
  },
  gopuram(b, m) {
    const tiers = 9;
    let w = 32;
    let d = 18;
    let y = 0;
    b.box([-w / 2, w / 2], [0, 12], [-d / 2, d / 2], '#d8c6a0', { matrix: m });
    y = 12;
    const cols = ['#e7c28a', '#d79a6a', '#e9d39a', '#c98a5e', '#efd8a6', '#dba273', '#e7c28a', '#d79a6a', '#efd8a6'];
    for (let k = 0; k < tiers; k++) {
      const h = 4.2;
      b.box([-w / 2, w / 2], [y, y + h], [-d / 2, d / 2], cols[k], { matrix: m });
      b.box([-w / 2 - 0.4, w / 2 + 0.4], [y + h - 0.5, y + h], [-d / 2 - 0.4, d / 2 + 0.4], '#f2e6c8', { matrix: m });
      y += h;
      w *= 0.86;
      d *= 0.84;
    }
    b.add(new THREE.CylinderGeometry(w * 0.3, w * 0.55, d * 0.9, 12, 1, false, 0, Math.PI), { color: '#d79a6a', position: [0, y + d * 0.2, 0], rotation: [0, 0, Math.PI / 2], scale: [1, 1, 1], matrix: m });
    for (let k = -2; k <= 2; k++) b.cylinder({ radius: 0.35, length: 2.2, segments: 6, position: [k * w * 0.18, y + d * 0.55 + 1, 0], color: '#d7b25a', matrix: m });
    // temple walls around the gopuram
    b.box([-90, 90], [0, 7], [10, 13], '#e2d3b0', { matrix: m });
    b.box([-90, -87], [0, 7], [13, 160], '#e2d3b0', { matrix: m });
    b.box([87, 90], [0, 7], [13, 160], '#e2d3b0', { matrix: m });
  },
  lighthouse(b, m) {
    for (let k = 0; k < 6; k++) b.cylinder({ radiusTop: 3.2 - (k + 1) * 0.25, radiusBottom: 3.2 - k * 0.25, length: 5, segments: 14, position: [0, 2.5 + k * 5, 0], color: k % 2 ? '#c8322b' : '#f6f2ea', matrix: m });
    b.cylinder({ radius: 2.4, length: 3, segments: 12, position: [0, 31.5, 0], color: '#2a3a40', matrix: m });
    b.add(new THREE.ConeGeometry(2.6, 2.4, 12), { color: '#7b2a24', position: [0, 34.2, 0], matrix: m });
    b.box([-6, 6], [0, 4], [-8, 0], '#f1ece0', { matrix: m });
  },
  pinnacle(b, m, rand) {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * (0.85 + rand() * 0.3), pos.getY(i), pos.getZ(i) * (0.85 + rand() * 0.3));
    b.add(g, { color: '#4f4a43', position: [0, 55, 0], scale: [22, 70, 18], matrix: m });
    b.add(new THREE.IcosahedronGeometry(1, 0), { color: '#5d574e', position: [24, 18, 10], scale: [30, 28, 26], matrix: m });
    b.add(new THREE.IcosahedronGeometry(1, 0), { color: '#5a5a48', position: [-20, 10, -6], scale: [34, 22, 30], matrix: m });
  },
};

function buildLandmarks() {
  const b = new ModelBuilder();
  const glows = [];
  const waterfalls = [];
  const boats = [];
  const p = {};
  const rand = seededRandom(512);
  for (const lm of ROUTE.landmarks) {
    route.sample(lm.s, p);
    const x = p.x + p.lx * lm.lat;
    const z = p.z + p.lz * lm.lat;
    if (lm.type === 'waterfall') {
      // a white cascade down the hillside, facing the track
      const top = terrain.groundY(lm.s, lm.lat);
      const bottom = terrain.groundY(lm.s, Math.sign(lm.lat) * 22);
      const h = Math.min(lm.height ?? 50, top - bottom + 6);
      waterfalls.push({ x, z, yTop: top + 3, h, yaw: -p.heading + (lm.lat > 0 ? 0 : Math.PI), lat: lm.lat, s: lm.s });
      continue;
    }
    if (lm.type === 'boats') {
      const level = terrain.waterLevel ?? ROUTE.bridges.find((br) => br.river)?.river.level ?? 0;
      let tries = 0;
      while (boats.filter((bt) => bt.group === lm).length < lm.count && tries++ < lm.count * 30) {
        const s = lm.s + (rand() - 0.5) * Math.min(lm.spread, 1400);
        const lat = lm.lat + (rand() - 0.5) * 2 * lm.spread;
        if (Math.abs(lat) < 50 || !terrain.underwater(s, lat)) continue;
        route.sample(s, p);
        boats.push({ group: lm, x: p.x + p.lx * lat, y: level + 0.15, z: p.z + p.lz * lat, yaw: rand() * Math.PI * 2, sx: 0.8 + rand() * 0.6, sy: 1, sz: 0.8 + rand() * 0.4, color: ['#c0392b', '#2c7fb8', '#e8b33d', '#2e8b57', '#f2efe6'][Math.floor(rand() * 5)] });
      }
      continue;
    }
    const build = MODELS[lm.type];
    if (!build) continue;
    const y = lm.type === 'pinnacle' ? terrain.groundY(lm.s, lm.lat) - 8 : terrain.groundY(lm.s, lm.lat) - 0.2;
    // models face the railway: local −z points towards the track
    const yaw = -p.heading + (lm.lat < 0 ? Math.PI : 0);
    const sc = lm.scale ?? 1;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), new THREE.Vector3(sc, sc, sc));
    build(b, m, rand);
    if (lm.type === 'lighthouse') glows.push({ x, y: y + 31.5 * sc, z, size: 9, color: '#fff2c4' });
  }
  return { geos: b.groups.size ? b.build() : {}, glows, waterfalls, boats };
}

/** Scrolling streaks of falling water (canvas texture, offset animated). */
function makeWaterfallTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(235,242,245,0.55)';
  g.fillRect(0, 0, 64, 256);
  const rand = seededRandom(9);
  for (let i = 0; i < 90; i++) {
    g.fillStyle = `rgba(255,255,255,${0.35 + rand() * 0.6})`;
    g.fillRect(rand() * 64, rand() * 256, 1 + rand() * 3, 18 + rand() * 60);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildBoatGeometry() {
  const b = new ModelBuilder();
  const hull = new THREE.CylinderGeometry(0.9, 0.5, 7, 8, 1, false, 0, Math.PI);
  b.add(hull, { color: '#ffffff', rotation: [0, 0, Math.PI / 2], position: [0, 0.5, 0], scale: [1, 1, 1] });
  b.box([-3, 3], [0.45, 0.55], [-0.85, 0.85], '#6b4a2e');
  b.box([-0.06, 0.06], [0.5, 5], [-0.06, 0.06], '#5a4632');
  return b.build().body;
}

export default function Landmarks() {
  const built = useMemo(buildLandmarks, []);
  const res = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const fallTex = built.waterfalls.length ? makeWaterfallTexture() : null;
    const fallMat = fallTex ? new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }) : null;
    const falls = built.waterfalls.map((w) => {
      const geo = new THREE.PlaneGeometry(9, w.h, 1, 1);
      geo.translate(0, -w.h / 2, 0);
      const mesh = new THREE.Mesh(geo, fallMat);
      mesh.position.set(w.x, w.yTop, w.z);
      mesh.rotation.set(0.18 * Math.sign(w.lat), w.yaw, 0, 'YXZ');
      fallTex.repeat.set(1, w.h / 30);
      return mesh;
    });
    let boats = null;
    if (built.boats.length) {
      const geo = buildBoatGeometry();
      boats = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), built.boats.length);
      const mtx = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const c = new THREE.Color();
      built.boats.forEach((bt, i) => {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), bt.yaw);
        boats.setMatrixAt(i, mtx.compose(new THREE.Vector3(bt.x, bt.y, bt.z), q, new THREE.Vector3(bt.sx, bt.sy, bt.sz)));
        boats.setColorAt(i, c.set(bt.color));
      });
      boats.computeBoundingSphere();
    }
    const glow = built.glows.length ? makeGlowMesh(built.glows, createGlowMaterial({ day: 0, night: 1.3 })) : null;
    return { mat, fallTex, fallMat, falls, boats, glow };
  }, [built]);

  useFrame((state) => {
    if (res.fallTex) res.fallTex.offset.y = (state.clock.elapsedTime * 0.9) % 1;
  });
  useEffect(
    () => () => {
      Object.values(built.geos).forEach((g) => g.dispose());
      res.mat.dispose();
      res.falls.forEach((f) => f.geometry.dispose());
      res.fallTex?.dispose();
      res.fallMat?.dispose();
      if (res.boats) {
        res.boats.geometry.dispose();
        res.boats.material.dispose();
        res.boats.dispose();
      }
      if (res.glow) {
        disposeGlowMaterial(res.glow.material);
        res.glow.dispose();
      }
    },
    [built, res],
  );

  return (
    <group>
      {Object.entries(built.geos).map(([k, g]) => (
        <mesh key={k} geometry={g} material={res.mat} castShadow receiveShadow />
      ))}
      {res.falls.map((f, i) => (
        <primitive key={i} object={f} />
      ))}
      {res.boats && <primitive object={res.boats} />}
      {res.glow && <primitive object={res.glow} />}
    </group>
  );
}

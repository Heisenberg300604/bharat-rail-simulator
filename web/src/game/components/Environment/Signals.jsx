// Colour-light signals with live aspects (simulation/signalling.js).
// Indian four-aspect head, top to bottom: yellow (the upper lamp of double
// yellow), green, yellow, red — so a double yellow shows two separated lamps.
// Automatic signals carry the white "A" marker plate, distant signals a "P"
// (permissive) marker (Signal Engineering Manual §7.1.12, §7.1.14).
//
// Draw calls for every signal on the route: posts 1 (chunked), lamp faces 1,
// glows 1, "A" plates 1 — instead of two meshes per signal.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { ROUTE } from '../../config/gameConfig.js';
import { game, useQuality } from '../../state/gameStore.js';
import { mainLine } from '../../world/trackLayout.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { makePlateTexture } from '../../world/textures.js';
import { createGlowMaterial, makeGlowMesh, setGlow, disposeGlowMaterial } from '../../world/glow.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';

const LAMP_Y = { topYellow: 4.7, green: 4.3, yellow: 3.9, red: 3.5 };
const COLOR = { red: '#ff2414', yellow: '#ffb000', green: '#19e676' };
const FACE_X = 0.27; // in front of the hoods (local +x faces the approaching train)

function buildSignalPost() {
  const b = new ModelBuilder();
  b.box([-0.4, 0.4], [0, 0.6], [-0.4, 0.4], '#8c8880'); // concrete base
  b.cylinder({ radius: 0.1, length: 4.8, axis: 'y', position: [0, 2.9, 0], color: '#5c636a' }); // mast
  b.cylinder({ radius: 0.45, length: 0.08, axis: 'x', position: [0.12, 4.1, 0], color: '#1a1a1a' }); // target board
  b.box([0.08, 0.16], [3.2, 5.0], [-0.35, 0.35], '#1a1a1a');
  for (const y of Object.values(LAMP_Y)) b.cylinder({ radius: 0.1, length: 0.15, axis: 'x', position: [0.18, y, 0], color: '#2a2d30' }); // hoods
  for (const z of [-0.18, 0.18]) b.cylinder({ radius: 0.015, length: 4.6, axis: 'y', position: [-0.25, 2.8, z], color: '#7a828a' }); // ladder
  for (let y = 0.8; y <= 4.8; y += 0.4) b.cylinder({ radius: 0.012, length: 0.36, axis: 'z', position: [-0.25, y, 0], color: '#7a828a' });
  return b.build().body;
}

/** Lamps lit for an aspect: [y, colour] pairs. */
function litLamps(aspect) {
  if (aspect === 'red') return [[LAMP_Y.red, COLOR.red]];
  if (aspect === 'yellow') return [[LAMP_Y.yellow, COLOR.yellow]];
  if (aspect === 'yy') return [
    [LAMP_Y.yellow, COLOR.yellow],
    [LAMP_Y.topYellow, COLOR.yellow],
  ];
  return [[LAMP_Y.green, COLOR.green]];
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _up = new THREE.Vector3(0, 1, 0);

export default function Signals() {
  const quality = useQuality();
  // where each signal stands (route data); aspects come from game.signalling by id
  const posts = useMemo(() => {
    const p = {};
    return ROUTE.signals.map((def, id) => {
      mainLine.sample(def.s, p);
      // face the train that reads it: player's signals face back down the line
      const yaw = -p.heading + (def.rev ? 0 : Math.PI);
      return { id, x: p.x + p.lx * def.lat, y: p.y, z: p.z + p.lz * def.lat, yaw };
    });
  }, []);
  const res = useMemo(() => {
    const n = Math.max(1, posts.length);
    const faceMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
    const faces = new THREE.InstancedMesh(new THREE.SphereGeometry(0.085, 10, 8), faceMat, n * 2);
    faces.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 2 * 3), 3);
    faces.frustumCulled = false;
    const glows = makeGlowMesh([], createGlowMaterial({ day: 0.45, night: 1.5 }), { maxCount: n * 2 });
    glows.frustumCulled = false;
    const plateTex = makePlateTexture('A', { bg: '#f2f2ee', fg: '#111', width: 128, height: 128, font: 'bold 96px Helvetica, Arial, sans-serif' });
    const plateMat = new THREE.MeshStandardMaterial({ map: plateTex });
    const pTex = makePlateTexture('P', { bg: '#f2f2ee', fg: '#111', width: 128, height: 128, font: 'bold 96px Helvetica, Arial, sans-serif' });
    const pMat = new THREE.MeshStandardMaterial({ map: pTex });
    return { faces, faceMat, glows, plateTex, plateMat, pTex, pMat, post: buildSignalPost(), postMat: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), plateGeo: new THREE.BoxGeometry(0.03, 0.34, 0.34) };
  }, [posts]);
  useEffect(
    () => () => {
      res.faces.geometry.dispose();
      res.faces.dispose();
      res.faceMat.dispose();
      disposeGlowMaterial(res.glows.material);
      res.glows.dispose();
      res.plateTex.dispose();
      res.plateMat.dispose();
      res.pTex.dispose();
      res.pMat.dispose();
      res.post.dispose();
      res.postMat.dispose();
      res.plateGeo.dispose();
    },
    [res],
  );

  // marker plates below the head: "A" on automatic signals, "P" on distant signals
  const plates = useMemo(() => {
    const out = { A: [], P: [] };
    posts.forEach((p) => {
      const d = ROUTE.signals[p.id];
      if (d.rev) return;
      const kind = signalKind(d);
      if (kind !== 'auto' && kind !== 'distant') return;
      const c = Math.cos(p.yaw);
      const s = -Math.sin(p.yaw);
      out[kind === 'auto' ? 'A' : 'P'].push({ x: p.x + c * 0.2, y: p.y + 2.75, z: p.z + s * 0.2, yaw: p.yaw });
    });
    return out;
  }, [posts]);

  const seen = useRef({ obj: null, version: -1 });
  useFrame(() => {
    const st = game.signalling;
    if (!st) return;
    if (seen.current.obj === st && seen.current.version === st.version) return;
    seen.current.obj = st;
    seen.current.version = st.version;
    const byId = new Map([...st.up, ...st.down].map((x) => [x.id, x]));
    let k = 0;
    for (const p of posts) {
      const sig = byId.get(p.id);
      const lamps = litLamps(sig?.aspect ?? 'green');
      _q.setFromAxisAngle(_up, p.yaw);
      const c = Math.cos(p.yaw);
      const s = -Math.sin(p.yaw); // local +x in world = (cos yaw, 0, −sin yaw)
      for (let slot = 0; slot < 2; slot++) {
        const lamp = lamps[slot];
        if (lamp) {
          const [y, col] = lamp;
          _p.set(p.x + c * FACE_X, p.y + y, p.z + s * FACE_X);
          res.faces.setMatrixAt(k, _m.compose(_p, _q, _s.set(1, 1, 1)));
          res.faces.setColorAt(k, _c.set(col));
          setGlow(res.glows, k, _p.x + c * 0.05, _p.y, _p.z + s * 0.05, 1.3, col);
        } else {
          res.faces.setMatrixAt(k, _m.makeScale(0, 0, 0));
          setGlow(res.glows, k, p.x, -1000, p.z, 0.0001, '#000000');
        }
        k++;
      }
    }
    res.faces.count = k;
    res.faces.instanceMatrix.needsUpdate = true;
    res.faces.instanceColor.needsUpdate = true;
    res.glows.count = k;
    res.glows.instanceMatrix.needsUpdate = true;
    res.glows.instanceColor.needsUpdate = true;
  });

  const far = quality.sceneryDistance;
  return (
    <group>
      <ChunkedInstances items={posts} geometry={res.post} material={res.postMat} cellSize={600} maxDistance={far} />
      {plates.A.length > 0 && <ChunkedInstances items={plates.A} geometry={res.plateGeo} material={res.plateMat} cellSize={600} maxDistance={far} />}
      {plates.P.length > 0 && <ChunkedInstances items={plates.P} geometry={res.plateGeo} material={res.pMat} cellSize={600} maxDistance={far} />}
      <primitive object={res.faces} />
      <primitive object={res.glows} />
    </group>
  );
}

/** Same classification as simulation/signalling.js (player's direction). */
function signalKind(def) {
  for (const st of ROUTE.stations) {
    if (def.s < st.platformStart && def.s > st.platformStart - 700) return 'home';
    if (def.s <= st.platformStart - 700 && def.s > st.platformStart - 2200) return 'distant';
    if (def.s >= st.platformEnd - 5 && def.s < st.platformEnd + 400) return 'starter';
  }
  return 'auto';
}

// The railway: ballast, sleepers, rails (with polished rail heads) and the
// overhead electrification (OHE) for the main line and the station yards.
// All lines are merged into a few meshes, so the whole railway costs only a
// handful of draw calls no matter how many tracks there are.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { TRACK, JOURNEY, STATIONS, PLATFORMS } from '../../config/gameConfig.js';
import { buildRibbonGeometry, mergeGeometries } from '../../world/geometry.js';
import { makeBallastTexture } from '../../world/textures.js';
import { lines, mainLine } from '../../world/trackLayout.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';
import { useQuality } from '../../state/gameStore.js';

const OHE_SPACING = 60;
const MAST_LAT = -3.6; // single masts on the right of the main line
export const CONTACT_WIRE_HEIGHT = TRACK.railTop + 5.5;
const MESSENGER_HEIGHT = CONTACT_WIRE_HEIGHT + 1.2;
const half = TRACK.gauge / 2;

const ballastProfile = (top) => [
  [3.0, 0],
  [1.85, top],
  [-1.85, top],
  [-3.0, 0],
];
const railProfile = (c) => [
  [c + 0.045, TRACK.sleeperTop],
  [c + 0.032, TRACK.railTop - 0.005],
  [c - 0.032, TRACK.railTop - 0.005],
  [c - 0.045, TRACK.sleeperTop],
];
const railHeadProfile = (c) => [
  [c + 0.034, TRACK.railTop],
  [c - 0.034, TRACK.railTop],
];
const wireProfile = (y) => [
  [0.015, y + 0.015],
  [-0.015, y + 0.015],
  [-0.015, y - 0.015],
  [0.015, y - 0.015],
  [0.015, y + 0.015],
];

/** Station zones where the yard exists (used for OHE portals). */
function stationZones() {
  return STATIONS.map((st) => {
    const yard = lines.filter((l) => l.id.startsWith(st.id));
    return { from: Math.max(0, Math.min(...yard.map((l) => l.from))), to: Math.max(...yard.map((l) => l.to)) };
  });
}

export default function TrackRoute() {
  const quality = useQuality();

  const meshes = useMemo(() => {
    const ballast = [];
    const rails = [];
    const heads = [];
    const wires = [];
    for (const line of lines) {
      const isMain = line === mainLine;
      const opts = { from: line.from, to: line.to };
      ballast.push(buildRibbonGeometry(line, ballastProfile(isMain ? TRACK.ballastTop : TRACK.ballastTop - 0.03), { ...opts, step: 5, uvScale: 3 }));
      rails.push(buildRibbonGeometry(line, railProfile(half), { ...opts, step: 3 }));
      rails.push(buildRibbonGeometry(line, railProfile(-half), { ...opts, step: 3 }));
      heads.push(buildRibbonGeometry(line, railHeadProfile(half), { ...opts, step: 3 }));
      heads.push(buildRibbonGeometry(line, railHeadProfile(-half), { ...opts, step: 3 }));
      wires.push(buildRibbonGeometry(line, wireProfile(CONTACT_WIRE_HEIGHT), { ...opts, step: 10 }));
      wires.push(buildRibbonGeometry(line, wireProfile(MESSENGER_HEIGHT), { ...opts, step: 10 }));
    }
    return {
      ballast: mergeGeometries(ballast),
      rails: mergeGeometries(rails),
      heads: mergeGeometries(heads),
      wires: mergeGeometries(wires),
    };
  }, []);

  const materials = useMemo(
    () => ({
      ballast: new THREE.MeshStandardMaterial({ map: makeBallastTexture(), roughness: 1 }),
      rail: new THREE.MeshStandardMaterial({ color: '#5e5650', metalness: 0.5, roughness: 0.7 }),
      head: new THREE.MeshStandardMaterial({ color: '#d6d4d0', metalness: 0.9, roughness: 0.25 }),
      wire: new THREE.MeshStandardMaterial({ color: '#3a302a', metalness: 0.6, roughness: 0.5 }),
      sleeper: new THREE.MeshStandardMaterial({ color: '#a29d93', roughness: 0.95 }),
      steel: new THREE.MeshStandardMaterial({ color: '#79808a', metalness: 0.5, roughness: 0.55 }),
      buffer: new THREE.MeshStandardMaterial({ color: '#c4161c', roughness: 0.6 }),
      unitBox: new THREE.BoxGeometry(1, 1, 1),
      sleeperBox: new THREE.BoxGeometry(0.26, 0.2, 2.75),
    }),
    [],
  );
  useEffect(
    () => () => {
      Object.values(meshes).forEach((g) => g.dispose());
      Object.values(materials).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    },
    [meshes, materials],
  );

  // Sleepers for every line (instanced + chunked, drawn only near the camera)
  const sleepers = useMemo(() => {
    const items = [];
    const p = {};
    for (const line of lines) {
      for (let s = line.from + 0.4; s < line.to; s += TRACK.sleeperSpacing) {
        line.sample(s, p);
        items.push({ x: p.x, y: TRACK.sleeperTop - 0.1, z: p.z, yaw: -p.heading });
      }
    }
    return items;
  }, []);

  // OHE steel: single cantilever masts on open line, portal frames over station yards
  const ohe = useMemo(() => {
    const items = [];
    const zones = stationZones();
    const p = {};
    const farLat = Math.min(...PLATFORMS.map((pf) => Math.min(...pf.lat))) - 1.5;
    const nearLat = Math.max(...PLATFORMS.map((pf) => Math.max(...pf.lat))) + 0.8;
    const at = (s, lat, y, sx, sy, sz) => {
      mainLine.sample(s, p);
      return { x: p.x + p.lx * lat, y, z: p.z + p.lz * lat, yaw: -p.heading, sx, sy, sz };
    };
    for (let s = 20; s < mainLine.length; s += OHE_SPACING) {
      const inStation = zones.some((z) => s >= z.from && s <= z.to);
      if (inStation) {
        const span = nearLat - farLat;
        items.push(at(s, nearLat, 4.6, 0.45, 9.2, 0.45));
        items.push(at(s, farLat, 4.6, 0.45, 9.2, 0.45));
        items.push(at(s, (nearLat + farLat) / 2, MESSENGER_HEIGHT + 0.9, 0.35, 0.6, span));
      } else {
        items.push(at(s, MAST_LAT, 4.15, 0.32, 8.3, 0.32));
        items.push(at(s, MAST_LAT / 2, MESSENGER_HEIGHT + 0.3, 0.12, 0.12, Math.abs(MAST_LAT) + 0.6));
        items.push(at(s, 0, (MESSENGER_HEIGHT + CONTACT_WIRE_HEIGHT) / 2, 0.05, MESSENGER_HEIGHT - CONTACT_WIRE_HEIGHT, 0.05));
      }
    }
    return items;
  }, []);

  // Buffer stops at the end of every line that ends
  const buffers = useMemo(() => {
    const items = [];
    const p = {};
    for (const line of lines) {
      const ends = [];
      if (line.from <= 1) ends.push(2);
      if (line.to >= JOURNEY.bufferStop) ends.push(JOURNEY.bufferStop + 1.5);
      for (const s of ends) {
        line.sample(s, p);
        items.push({ x: p.x, y: TRACK.railTop + 0.6, z: p.z, yaw: -p.heading, sx: 0.7, sy: 1.2, sz: 2.6 });
      }
    }
    return items;
  }, []);

  return (
    <group>
      <mesh geometry={meshes.ballast} material={materials.ballast} receiveShadow />
      <mesh geometry={meshes.rails} material={materials.rail} receiveShadow />
      <mesh geometry={meshes.heads} material={materials.head} />
      <mesh geometry={meshes.wires} material={materials.wire} />
      <ChunkedInstances items={sleepers} geometry={materials.sleeperBox} material={materials.sleeper} cellSize={150} maxDistance={quality.detailDistance} receiveShadow />
      <ChunkedInstances items={ohe} geometry={materials.unitBox} material={materials.steel} maxDistance={quality.sceneryDistance} />
      <ChunkedInstances items={buffers} geometry={materials.unitBox} material={materials.buffer} />
    </group>
  );
}

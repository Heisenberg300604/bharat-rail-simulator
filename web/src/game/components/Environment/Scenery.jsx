// Trackside scenery: trees, crop fields (incl. yellow mustard), low-rise
// buildings with the ubiquitous black rooftop water tanks, and km posts.
// Everything is instanced (one draw call per object type) and placed with a
// seeded random generator, so the world looks the same every time.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { route } from '../../state/gameStore.js';
import { STATIONS } from '../../config/gameConfig.js';
import { fillInstances, seededRandom } from '../../world/geometry.js';

const CITY_RADIUS = 1300; // metres of "town" around each station

function nearStation(s, extra = 0) {
  return STATIONS.some((st) => s > st.platformStart - 120 - extra && s < st.platformEnd + 120 + extra);
}
function inCity(s) {
  return STATIONS.some((st) => Math.abs(s - (st.platformStart + st.platformEnd) / 2) < CITY_RADIUS);
}

function generate() {
  const rand = seededRandom(2024);
  const p = {};
  const trunks = [];
  const crowns = [];
  const fields = [];
  const buildings = [];
  const tanks = [];
  const kmPosts = [];
  const place = (s, lateral) => {
    route.sample(s, p);
    return { x: p.x + p.lx * lateral, z: p.z + p.lz * lateral, yaw: -p.heading };
  };
  const greens = ['#4f7a35', '#5d8a3c', '#3f6a2e', '#6b8f3e', '#557d3a'];
  const fieldColours = ['#d8bf33', '#d8bf33', '#7a9e3d', '#6a8f35', '#8a6e48', '#9caa52'];
  const buildingColours = ['#e8d9b5', '#f0c9b8', '#cfe0e8', '#f2e6a0', '#e6e6e6', '#d9b48f', '#c9d8b6', '#f3d7d7'];

  for (let s = 0; s < route.length; s += 9) {
    const city = inCity(s);
    for (const side of [1, -1]) {
      // Trees: sparser in towns, never on platforms
      if (rand() < (city ? 0.25 : 0.55) && !nearStation(s, 40)) {
        const lat = side * (14 + rand() * rand() * 320);
        const pos = place(s + rand() * 9, lat);
        const h = 4 + rand() * 6;
        trunks.push({ ...pos, y: h * 0.25, sx: 1, sy: h * 0.5, sz: 1 });
        const r = 2 + rand() * 2.6;
        crowns.push({ ...pos, y: h * 0.5 + r * 0.6, sx: r, sy: r * (0.75 + rand() * 0.35), sz: r, color: greens[Math.floor(rand() * greens.length)] });
      }
    }
  }

  // Crop fields outside towns
  for (let s = 0; s < route.length; s += 55) {
    if (inCity(s)) continue;
    for (const side of [1, -1]) {
      if (rand() < 0.65) {
        const w = 40 + rand() * 90;
        const d = 30 + rand() * 80;
        const lat = side * (22 + d / 2 + rand() * 220);
        const pos = place(s, lat);
        fields.push({ ...pos, y: 0.1, sx: w, sy: 0.1, sz: d, color: fieldColours[Math.floor(rand() * fieldColours.length)] });
      }
    }
  }

  const addBuilding = (s, lat, scale) => {
    const pos = place(s, lat);
    const w = (7 + rand() * 12) * scale;
    const d = (7 + rand() * 10) * scale;
    const h = (3.5 + rand() * (scale > 1 ? 14 : 4)) * 1;
    buildings.push({ ...pos, y: h / 2, sx: w, sy: h, sz: d, color: buildingColours[Math.floor(rand() * buildingColours.length)] });
    if (rand() < 0.55) tanks.push({ ...pos, y: h + 0.7, sx: 1, sy: 1, sz: 1 });
  };

  // Towns around stations
  for (let s = 0; s < route.length; s += 14) {
    if (!inCity(s)) continue;
    for (const side of [1, -1]) {
      if (rand() < 0.7) {
        const minLat = nearStation(s, 60) ? 55 : 24;
        addBuilding(s, side * (minLat + rand() * 260), 1.3);
      }
    }
  }
  // A few villages along the way
  for (let i = 0; i < 9; i++) {
    const s = 1500 + rand() * 5000;
    const side = rand() < 0.5 ? 1 : -1;
    const lat0 = 60 + rand() * 200;
    const n = 6 + Math.floor(rand() * 10);
    for (let j = 0; j < n; j++) addBuilding(s + (rand() - 0.5) * 120, side * (lat0 + rand() * 70), 0.7);
  }

  for (let s = 1000; s < route.length; s += 1000) kmPosts.push({ ...place(s, -2.9), y: 0.5 });

  return { trunks, crowns, fields, buildings, tanks, kmPosts };
}

function Instances({ items, children, castShadow = false }) {
  const ref = useRef();
  useLayoutEffect(() => fillInstances(ref.current, items), [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow} receiveShadow>
      {children}
    </instancedMesh>
  );
}

export default function Scenery() {
  const data = useMemo(generate, []);
  return (
    <group>
      <Instances items={data.fields}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={1} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-2} />
      </Instances>
      <Instances items={data.trunks}>
        <cylinderGeometry args={[0.18, 0.28, 1, 6]} />
        <meshStandardMaterial color="#5a4632" roughness={1} />
      </Instances>
      <Instances items={data.crowns}>
        <icosahedronGeometry args={[1, 1]} />
        <meshStandardMaterial roughness={0.95} flatShading />
      </Instances>
      <Instances items={data.buildings}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.95} />
      </Instances>
      <Instances items={data.tanks}>
        <cylinderGeometry args={[0.7, 0.7, 1.4, 10]} />
        <meshStandardMaterial color="#1c1c1c" roughness={0.7} />
      </Instances>
      <Instances items={data.kmPosts}>
        <boxGeometry args={[0.25, 1, 0.25]} />
        <meshStandardMaterial color="#f4f1e8" />
      </Instances>
    </group>
  );
}

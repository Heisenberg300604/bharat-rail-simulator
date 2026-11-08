// People: passengers waiting on every platform face, walkers pacing the
// platforms, people on the benches, red-shirted porters with head-loads,
// customers at the chai stall, bystanders waiting at the level-crossing gates,
// and village children who wave when the train goes by.
//
// Each group is a single InstancedMesh animated on the GPU (see
// world/models/people.js). The CPU only updates three uniforms per frame and
// hides groups that are far from the camera.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game, route, useGameValue, useQuality } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { STATIONS, PLATFORMS, DOWN_LINE_OFFSET, STATION_TRACKS, LEVEL_CROSSING } from '../../config/gameConfig.js';
import { mainLine } from '../../world/trackLayout.js';
import { seededRandom } from '../../world/geometry.js';
import { onEnvironmentChange } from '../../world/environment.js';
import { buildPersonGeometry, createPeopleMaterial, makeCrowdMesh, randomPerson, ANIM } from '../../world/models/people.js';
import { PLATFORM_TOP } from '../Stations/Station.jsx';

const zOf = (lat) => -lat; // station-local frame: x along the track, z to the right
const TRACK_Z = [0, DOWN_LINE_OFFSET, ...STATION_TRACKS.map((t) => t.offset)].map(zOf);
const faceZ = (dir) => (dir > 0 ? -Math.PI / 2 : Math.PI / 2); // yaw that turns local +X towards ±Z

function stationPeople(station, density, seed) {
  const rand = seededRandom(seed);
  const L = station.platformEnd - station.platformStart;
  const canopy = Math.min(260, L - 60);
  const busy = station.id === 'ndls' ? 1.25 : 0.95;
  const out = [];
  const y = PLATFORM_TOP;

  for (const pf of PLATFORMS) {
    const z0 = Math.min(zOf(pf.lat[0]), zOf(pf.lat[1]));
    const z1 = Math.max(zOf(pf.lat[0]), zOf(pf.lat[1]));
    const zm = (z0 + z1) / 2;
    const edges = [z0, z1].filter((e) => TRACK_Z.some((tz) => Math.abs(tz - e) < 2.5));

    // 1. Waiting passengers in little groups behind the yellow line, facing the track
    for (const edge of edges) {
      const inward = edge === z0 ? 1 : -1;
      const groups = Math.round(18 * density * busy);
      for (let g = 0; g < groups; g++) {
        const cx = (rand() - 0.5) * canopy * 1.15;
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const person = randomPerson(rand);
          const chatting = n > 1 && rand() < 0.35;
          out.push({
            x: cx + (rand() - 0.5) * 2.2,
            y,
            z: edge + inward * (1.15 + rand() * 0.95),
            yaw: chatting ? rand() * Math.PI * 2 : faceZ(-inward) + (rand() - 0.5) * 0.7,
            person,
            anim: person.scale < 0.75 && rand() < 0.6 ? ANIM.wave : ANIM.stand,
            phase: rand(),
          });
        }
      }
    }

    // 2. Walkers (and porters) pacing up and down between the canopy posts and the edge
    const walkers = Math.round(13 * density * busy);
    for (let i = 0; i < walkers; i++) {
      const person = randomPerson(rand, rand() < 0.18 ? 'porter' : undefined);
      const range = 18 + rand() * 60;
      const forward = rand() < 0.5;
      const lo = -L / 2 + 12;
      const hi = L / 2 - 12;
      const x = forward ? lo + rand() * Math.max(1, hi - lo - range) : hi - rand() * Math.max(1, hi - lo - range);
      out.push({
        x,
        y,
        z: zm + (rand() < 0.5 ? -1 : 1) * (1.5 + rand() * 0.55),
        yaw: forward ? 0 : Math.PI,
        person,
        anim: ANIM.walk,
        speed: person.headLoad ? 0.75 + rand() * 0.25 : 0.85 + rand() * 0.6,
        range,
        phase: rand(),
      });
    }

    // 3. People sitting on the back-to-back benches
    for (let x = -canopy / 2 + 15; x < canopy / 2; x += 28) {
      for (const side of [1, -1]) {
        if (rand() > 0.6 * Math.min(1, density + 0.3)) continue;
        const n = rand() < 0.4 ? 2 : 1;
        for (let k = 0; k < n; k++) {
          const person = randomPerson(rand, rand() < 0.5 ? 'woman' : 'man');
          person.headLoad = 0;
          person.bag = 0;
          out.push({ x: x + (n === 2 ? (k - 0.5) * 0.9 : (rand() - 0.5) * 0.8), y, z: zm + side * 0.22, yaw: faceZ(side), person, anim: ANIM.sit, phase: rand() });
        }
      }
    }

    // 4. Chai stall: vendor behind the counter, a few customers
    out.push({ x: -28, y, z: zm, yaw: faceZ(1), person: randomPerson(rand, 'man'), anim: ANIM.stand, phase: rand() });
    for (let k = 0; k < Math.round(3 * density + 0.5); k++) {
      const side = rand() < 0.5 ? 1 : -1;
      out.push({ x: -28 + (rand() - 0.5) * 3.2, y, z: zm + side * (1.8 + rand() * 0.4), yaw: faceZ(-side), person: randomPerson(rand), anim: ANIM.stand, phase: rand() });
    }
  }
  return out;
}

/** Route positions of waving children (the audio plays their shouts as the train passes). */
export const KID_SPOTS = [];

/** World-space people beside the line: level-crossing bystanders and waving village kids. */
function tracksidePeople(density) {
  const rand = seededRandom(404);
  const out = [];
  const p = {};
  const at = (s, lat, person, anim) => {
    mainLine.sample(s, p);
    const x = p.x + p.lx * lat;
    const z = p.z + p.lz * lat;
    // face the track: local +X → towards lateral 0
    const dx = -p.lx * Math.sign(lat);
    const dz = -p.lz * Math.sign(lat);
    out.push({ x, y: 0, z, yaw: Math.atan2(-dz, dx) + (rand() - 0.5) * 0.5, person, anim, phase: rand() });
  };
  // waiting at both gates of the level crossing, on both sides of the road
  for (const lat of [8.5, -14]) {
    for (const ds of [-5.5, 5.5]) {
      const n = 1 + Math.floor(rand() * 2 * density + 0.5);
      for (let k = 0; k < n; k++) at(LEVEL_CROSSING.s + ds + (rand() - 0.5) * 2, lat + Math.sign(lat) * rand() * 2.5, randomPerson(rand), ANIM.stand);
    }
    at(LEVEL_CROSSING.s + 7.5, lat, randomPerson(rand, 'child'), ANIM.wave);
  }
  // village children by the line
  const spots = Math.round(7 * Math.max(0.5, density));
  for (let i = 0; i < spots; i++) {
    const s = 1500 + rand() * 5000;
    if (STATIONS.some((st) => s > st.platformStart - 500 && s < st.platformEnd + 500)) continue;
    const lat = (rand() < 0.5 ? 1 : -1) * (13 + rand() * 10);
    const n = 2 + Math.floor(rand() * 3);
    if (!KID_SPOTS.includes(Math.round(s))) KID_SPOTS.push(Math.round(s));
    for (let k = 0; k < n; k++) at(s + (rand() - 0.5) * 6, lat + (rand() - 0.5) * 3, randomPerson(rand, rand() < 0.75 ? 'child' : undefined), ANIM.wave);
  }
  return out;
}

export default function Crowds() {
  const quality = useQuality();
  const enabled = useGameValue((s) => s.settings.crowd);
  const geometry = useMemo(buildPersonGeometry, []);
  const material = useMemo(createPeopleMaterial, []);
  useEffect(
    () =>
      onEnvironmentChange((env) => {
        material.userData.uniforms.uFill.value = 0.06 + 0.3 * env.lamps * env.night;
      }),
    [material],
  );
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  const groups = useMemo(() => {
    const density = quality.crowdDensity;
    const list = STATIONS.map((st, i) => {
      const centerS = (st.platformStart + st.platformEnd) / 2;
      const pose = route.sample(centerS, {});
      const g = new THREE.Group();
      g.position.set(pose.x, 0, pose.z);
      g.rotation.set(0, -pose.heading, 0);
      g.add(makeCrowdMesh(stationPeople(st, density, 100 + i), geometry, material));
      g.userData.center = new THREE.Vector3(pose.x, 0, pose.z);
      g.userData.radius = 900;
      return g;
    });
    const t = new THREE.Group();
    t.add(makeCrowdMesh(tracksidePeople(density), geometry, material));
    t.userData.radius = Infinity;
    list.push(t);
    return list;
  }, [quality.crowdDensity, geometry, material]);
  useEffect(
    () => () => {
      for (const g of groups) for (const m of g.children) m.geometry.dispose(); // per-crowd geometry copies
    },
    [groups],
  );

  useFrame((state) => {
    const u = material.userData.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    const loco = sceneRefs.locomotive;
    if (loco) u.uTrainPos.value.copy(loco.position);
    u.uTrainMoving.value = game.train.speedMps > 2 ? 1 : 0;
    const cam = state.camera.position;
    for (const g of groups) g.visible = enabled && (g.userData.radius === Infinity || cam.distanceTo(g.userData.center) < g.userData.radius);
  });

  return groups.map((g, i) => <primitive key={i} object={g} />);
}

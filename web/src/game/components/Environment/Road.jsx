// Roadside world:
// 1. A highway beside the line (veering away at both ends so traffic enters
//    and leaves out of sight), with sodium streetlights.
// 2. A cross road through manned level crossing LC-42 — boom gates, flashers,
//    gatekeeper's gumti, whistle boards ("W/L", "सी/फा").
// 3. Indian road traffic — hatchbacks, SUVs, CNG autos, motorbikes, state
//    buses, painted trucks and tractor-trolleys — driven by the IDM
//    car-following model (simulation/roadTraffic.js): they keep their gaps,
//    queue at the closed gates and pull away when the booms lift.
// 4. Multi-aspect colour-light signals beside the line.
// Performance: one InstancedMesh per vehicle type for bodies (per-vehicle paint
// colour via a shader mask) + one for lamps; streetlights are chunked
// instances; night headlights are one dynamic glow layer.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game, useQuality } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { mainLine } from '../../world/trackLayout.js';
import { ROAD, LEVEL_CROSSINGS, TRACK, STATIONS, PLATFORMS } from '../../config/gameConfig.js';
import { highwayOffset, crossRoadSpan, ROAD_END_VEER } from '../../world/roadLayout.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { seededRandom } from '../../world/geometry.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';
import { VEHICLE_TYPES, createVehicleMaterial } from '../../world/models/roadVehicles.js';
import { createTraffic, stepTraffic, placeAlongLane } from '../../simulation/roadTraffic.js';
import { createGlowMaterial, createPoolMaterial, makeGlowMesh, setGlow, disposeGlowMaterial } from '../../world/glow.js';
import { envState, onEnvironmentChange } from '../../world/environment.js';

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _qRot = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _zero = new THREE.Vector3(0, 0, 0);
const _up = new THREE.Vector3(0, 1, 0);
const _zAxis = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();

const LANE = 1.8;
const GATE_UP = 4.6; // boom post lateral on the up (left) side
const GATE_DOWN = -10.2; // and beyond the down line

/** A polyline with cumulative length and fast sampling. */
function makePath(points) {
  const n = points.length;
  const x = new Float64Array(n);
  const z = new Float64Array(n);
  const cum = new Float64Array(n);
  points.forEach((p, i) => {
    x[i] = p[0];
    z[i] = p[1];
    if (i) cum[i] = cum[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  });
  const length = cum[n - 1];
  function sample(d, out) {
    d = Math.min(Math.max(d, 0), length);
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const t = (d - cum[lo]) / Math.max(1e-9, cum[hi] - cum[lo]);
    out.x = x[lo] + (x[hi] - x[lo]) * t;
    out.z = z[lo] + (z[hi] - z[lo]) * t;
    out.yaw = Math.atan2(-(z[hi] - z[lo]), x[hi] - x[lo]); // rotation that turns local +X along the path
    return out;
  }
  return { length, sample, points };
}

/** Offset a polyline sideways (positive = to the left of its direction of travel). */
function offsetPath(points, off) {
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    // left of travel direction (dx, dz) is (dz, −dx)/len
    return [p[0] + (dz / len) * off, p[1] + (-dx / len) * off];
  });
}

function ribbon(points, halfWidth, yFn) {
  const left = offsetPath(points, halfWidth);
  const right = offsetPath(points, -halfWidth);
  const pos = [];
  const idx = [];
  points.forEach((p, i) => {
    const y = yFn ? yFn(i) : 0.05;
    pos.push(left[i][0], y, left[i][1], right[i][0], y, right[i][1]);
    if (i) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  // make sure faces point up whatever the winding
  const n = geo.attributes.normal;
  if (n.count && n.getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    geo.setIndex(idx);
    geo.computeVertexNormals();
  }
  return geo;
}

/** Dashed centre line as thin quads. */
function dashes(points, dash = 3, gap = 6) {
  const path = makePath(points);
  const geos = [];
  const o = {};
  for (let d = 0; d < path.length - dash; d += dash + gap) {
    const seg = [];
    for (let k = 0; k <= 2; k++) {
      path.sample(d + (dash * k) / 2, o);
      seg.push([o.x, o.z]);
    }
    geos.push(ribbon(seg, 0.07, () => 0.065));
  }
  return geos;
}

function buildStreetlight() {
  const b = new ModelBuilder();
  b.cylinder({ radius: 0.09, radiusTop: 0.06, length: 8, position: [0, 4, 0], color: '#8a9096', segments: 8 });
  b.add(new THREE.BoxGeometry(2.6, 0.08, 0.08), { color: '#8a9096', position: [1.2, 7.9, 0], rotation: [0, 0, 0.08] });
  b.box([2.2, 2.9], [7.72, 7.9], [-0.18, 0.18], '#5c6167');
  b.box([2.25, 2.85], [7.7, 7.73], [-0.15, 0.15], '#ffd18a', { mat: 'lamp' });
  b.box([-0.25, 0.25], [0, 0.4], [-0.25, 0.25], '#9c978d');
  return b.build();
}

// ---------------------------------------------------------------- Level crossing models
function buildGateCabin() {
  const b = new ModelBuilder();
  // Gatekeeper's gumti (cabin)
  b.box([-2.2, 2.2], [0, 3.2], [-1.8, 1.8], '#f2ecd8'); // cream walls
  b.box([-2.3, 2.3], [0, 0.6], [-1.9, 1.9], '#8a2c20'); // red base skirting
  b.box([-2.6, 2.6], [3.2, 3.65], [-2.1, 2.1], '#b8422e'); // terracotta tiled sloping roof
  // Observation window facing the track
  b.box([-1.2, 1.2], [1.2, 2.4], [-1.84, -1.78], '#1a242c');
  // Yellow board with black lettering: "LC-42 / फाटक ४२"
  b.box([-1.0, 1.0], [2.55, 2.95], [-1.84, -1.8], '#f3c623');
  return b.build().body;
}

function buildGateBoom() {
  const b = new ModelBuilder();
  // Striped level crossing boom barrier (red and white stripes, 9.5m long)
  const len = 9.5;
  const nStripes = 12;
  const segLen = len / nStripes;
  for (let i = 0; i < nStripes; i++) {
    const c = i % 2 === 0 ? '#cc1b1b' : '#ffffff';
    b.cylinder({ radius: 0.075, length: segLen, axis: 'x', position: [segLen * (i + 0.5), 0, 0], color: c, segments: 10 });
  }
  // Round red STOP sign in the middle
  b.cylinder({ radius: 0.32, length: 0.03, axis: 'z', position: [len * 0.5, 0, 0], color: '#cc1b1b' });
  b.cylinder({ radius: 0.12, length: 0.04, axis: 'z', position: [len * 0.5, 0, 0], color: '#ffffff' });
  return b.build().body;
}

function buildGatePost() {
  const b = new ModelBuilder();
  // Steel pivot post
  b.box([-0.3, 0.3], [0, 1.35], [-0.3, 0.3], '#33373b');
  b.cylinder({ radius: 0.12, length: 0.5, axis: 'z', position: [0, 1.2, 0], color: '#555b62' });
  // Twin flasher hood & red lamps
  b.box([-0.1, 0.1], [1.35, 2.2], [-0.08, 0.08], '#33373b');
  b.box([-0.5, 0.5], [2.15, 2.35], [-0.15, 0.15], '#1f2224');
  for (const z of [-0.35, 0.35]) {
    b.cylinder({ radius: 0.11, length: 0.08, axis: 'x', position: [0.08, 2.25, z], color: '#ff1744', mat: 'lamp' });
  }
  return b.build().body;
}

function buildWhistleBoard() {
  const b = new ModelBuilder();
  // Striped post
  b.cylinder({ radius: 0.06, length: 2.2, axis: 'y', position: [0, 1.1, 0], color: '#f0ece0' });
  b.cylinder({ radius: 0.062, length: 0.35, axis: 'y', position: [0, 0.7, 0], color: '#1a1a1a' });
  b.cylinder({ radius: 0.062, length: 0.35, axis: 'y', position: [0, 1.4, 0], color: '#1a1a1a' });
  // Yellow diamond plate
  b.box([-0.03, 0.03], [1.7, 2.5], [-0.4, 0.4], '#f2c222');
  b.box([-0.04, 0.04], [1.9, 2.3], [-0.2, 0.2], '#111111'); // "W/L" symbol
  return b.build().body;
}

// ---------------------------------------------------------------- MACLS Signal
function buildSignalPost() {
  const b = new ModelBuilder();
  // Concrete base
  b.box([-0.4, 0.4], [0, 0.6], [-0.4, 0.4], '#8c8880');
  // Tubular steel mast
  b.cylinder({ radius: 0.1, length: 4.8, axis: 'y', position: [0, 2.9, 0], color: '#5c636a' });
  // Target board (circular shield with 4 aspect hoods)
  b.cylinder({ radius: 0.45, length: 0.08, axis: 'x', position: [0.12, 4.2, 0], color: '#1a1a1a' });
  b.box([0.08, 0.16], [3.2, 5.0], [-0.35, 0.35], '#1a1a1a');
  // Hoods (visors)
  for (const y of [3.5, 3.9, 4.3, 4.7]) {
    b.cylinder({ radius: 0.1, length: 0.15, axis: 'x', position: [0.18, y, 0], color: '#2a2d30' });
  }
  // Ladder on the back
  for (const z of [-0.18, 0.18]) {
    b.cylinder({ radius: 0.015, length: 4.6, axis: 'y', position: [-0.25, 2.8, z], color: '#7a828a' });
  }
  for (let y = 0.8; y <= 4.8; y += 0.4) {
    b.cylinder({ radius: 0.012, length: 0.36, axis: 'z', position: [-0.25, y, 0], color: '#7a828a' });
  }
  return b.build().body;
}

/** Lanes (India drives on the left) and the road surfaces built from them. */
function buildRoadNetwork() {
  const p = {};
  const centre = [];
  for (let s = ROAD.from - ROAD_END_VEER; s <= ROAD.to + ROAD_END_VEER; s += 8) {
    mainLine.sample(s, p);
    const o = highwayOffset(s);
    centre.push([p.x + p.lx * o, p.z + p.lz * o]);
  }
  const lanes = {
    up: makePath(offsetPath(centre, LANE)),
    down: makePath(offsetPath([...centre].reverse(), LANE)),
  };
  const surfaces = [ribbon(centre, ROAD.width / 2)];
  const markings = [...dashes(centre)];
  const stops = {};
  const crossings = LEVEL_CROSSINGS.map((lc, i) => {
    const [lo, hi] = crossRoadSpan(lc);
    mainLine.sample(lc.s, p);
    const pts = [];
    const lats = [];
    for (let lat = hi; lat >= lo; lat -= 4) {
      pts.push([p.x + p.lx * lat, p.z + p.lz * lat]);
      lats.push(lat);
    }
    const a = `x${i}A`; // from the village side (hi) across the tracks
    const b = `x${i}B`;
    lanes[a] = makePath(offsetPath(pts, LANE));
    lanes[a].crossing = { lo, hi, dir: -1 };
    lanes[b] = makePath(offsetPath([...pts].reverse(), LANE));
    lanes[b].crossing = { lo, hi, dir: 1 };
    surfaces.push(ribbon(pts, 3.8, (k) => crossingY(lats[k])));
    markings.push(...dashes(pts.filter((_, k) => Math.abs(lats[k]) > 14)));
    // stop lines in front of each boom while the gates are down
    stops[a] = [hi - (GATE_UP + 3.2)];
    stops[b] = [-(GATE_DOWN - 3.2) + lo];
    return { ...lc, index: i, x: p.x, z: p.z, lx: p.lx, lz: p.lz, heading: p.heading };
  });
  // streetlights on the track side of the highway, arm reaching over the road
  const lights = [];
  for (let s = ROAD.from + 20; s <= ROAD.to; s += 45) {
    if (LEVEL_CROSSINGS.some((lc) => Math.abs(lc.s - s) < 10)) continue;
    mainLine.sample(s, p);
    const lat = highwayOffset(s) - ROAD.width / 2 - 1.1;
    lights.push({ x: p.x + p.lx * lat, z: p.z + p.lz * lat, yaw: Math.atan2(-p.lz, p.lx), lx: p.lx, lz: p.lz });
  }
  return { lanes, surfaces, markings, stops, lights, crossings };
}

/** Road height across a level crossing: ramps up so the road meets the rail tops. */
function crossingY(lat) {
  if (lat < 3.5 && lat > -9) return TRACK.railTop - 0.01;
  if (lat < 6 && lat > -11.5) return 0.35;
  return 0.06;
}

function buildFleet(lanes, density) {
  const rand = seededRandom(91);
  const types = Object.entries(VEHICLE_TYPES);
  const total = types.reduce((n, [, t]) => n + t.weight, 0);
  const pickType = () => {
    let r = rand() * total;
    for (const [id, t] of types) if ((r -= t.weight) <= 0) return id;
    return 'car';
  };
  const vehicles = [];
  const add = (lane, count) => {
    for (const d of placeAlongLane(lanes[lane].length, count, rand)) {
      const type = pickType();
      const t = VEHICLE_TYPES[type];
      vehicles.push({
        lane,
        d,
        type,
        length: t.length,
        v0: (t.speed[0] + rand() * (t.speed[1] - t.speed[0])) / 3.6,
        color: t.colors[Math.floor(rand() * t.colors.length)],
      });
    }
  };
  add('up', Math.round(44 * density));
  add('down', Math.round(44 * density));
  for (const id of Object.keys(lanes)) {
    if (!lanes[id].crossing) continue;
    const short = lanes[id].length < 400;
    add(id, Math.max(3, Math.round((short ? 6 : 10) * density)));
  }
  return createTraffic(
    Object.entries(lanes).map(([id, l]) => ({ id, length: l.length })),
    vehicles,
  );
}

/** Static parts of every level crossing: lodge, whistle boards, boom posts. */
function crossingFurniture(crossings) {
  const p = {};
  const onPlatform = (s, lat) =>
    STATIONS.some((st) => s > st.platformStart - 5 && s < st.platformEnd + 5 && PLATFORMS.some((pf) => lat <= Math.max(...pf.lat) + 1 && lat >= Math.min(...pf.lat) - 1));
  return crossings.map((lc) => {
    mainLine.sample(lc.s - 14, p);
    const cabin = { x: p.x + p.lx * 10.5, z: p.z + p.lz * 10.5, yaw: -p.heading + Math.PI / 2 };
    const boards = [];
    if (!onPlatform(lc.s - lc.whistleBoard, 3.8)) {
      mainLine.sample(lc.s - lc.whistleBoard, p);
      boards.push({ x: p.x + p.lx * 3.8, z: p.z + p.lz * 3.8, yaw: -p.heading });
    }
    if (!onPlatform(lc.s + lc.whistleBoard, -9.2)) {
      mainLine.sample(lc.s + lc.whistleBoard, p);
      boards.push({ x: p.x + p.lx * -9.2, z: p.z + p.lz * -9.2, yaw: -p.heading + Math.PI });
    }
    const fx = Math.cos(lc.heading);
    const fz = Math.sin(lc.heading);
    const postUp = { x: lc.x + lc.lx * GATE_UP + fx * 3.5, z: lc.z + lc.lz * GATE_UP + fz * 3.5, yaw: -lc.heading };
    const postDown = { x: lc.x + lc.lx * GATE_DOWN - fx * 3.5, z: lc.z + lc.lz * GATE_DOWN - fz * 3.5, yaw: -lc.heading + Math.PI };
    return { cabin, boards, postUp, postDown };
  });
}

export default function Road() {
  const quality = useQuality();

  const assets = useMemo(() => {
    const vc = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, ...o });
    const mats = {
      road: new THREE.MeshStandardMaterial({ color: '#2f3134', roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
      marking: new THREE.MeshStandardMaterial({ color: '#ece8dc', roughness: 0.8, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
      vc: vc(),
      vehicle: createVehicleMaterial(),
      lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
      greenSignal: new THREE.MeshStandardMaterial({ emissive: '#00e676', emissiveIntensity: 3.5, color: '#00e676' }),
      yellowSignal: new THREE.MeshStandardMaterial({ emissive: '#ffab00', emissiveIntensity: 3.5, color: '#ffab00' }),
      redSignal: new THREE.MeshStandardMaterial({ emissive: '#ff1744', emissiveIntensity: 3.5, color: '#ff1744' }),
    };
    const vehicles = Object.fromEntries(Object.entries(VEHICLE_TYPES).map(([id, t]) => [id, t.build()]));
    return {
      mats,
      vehicles,
      streetlight: buildStreetlight(),
      gateCabin: buildGateCabin(),
      gateBoom: buildGateBoom(),
      gatePost: buildGatePost(),
      whistleBoard: buildWhistleBoard(),
      signalPost: buildSignalPost(),
    };
  }, []);

  const net = useMemo(buildRoadNetwork, []);
  const furniture = useMemo(() => crossingFurniture(net.crossings), [net]);
  const traffic = useMemo(() => buildFleet(net.lanes, quality.sceneryDensity), [net, quality.sceneryDensity]);

  // per-type instance slots + paint colours
  const fleet = useMemo(() => {
    const byType = {};
    traffic.vehicles.forEach((veh) => {
      byType[veh.type] ??= [];
      veh.slot = byType[veh.type].length;
      byType[veh.type].push(veh);
    });
    const meshes = {};
    const c = new THREE.Color();
    for (const [type, list] of Object.entries(byType)) {
      const geos = assets.vehicles[type];
      const body = new THREE.InstancedMesh(geos.body, assets.mats.vehicle, list.length);
      list.forEach((veh, i) => body.setColorAt(i, c.set(veh.color)));
      body.instanceColor.needsUpdate = true;
      body.castShadow = true;
      body.receiveShadow = true;
      body.frustumCulled = false;
      const lamp = geos.lamp ? new THREE.InstancedMesh(geos.lamp, assets.mats.lamp, list.length) : null;
      if (lamp) lamp.frustumCulled = false;
      meshes[type] = { body, lamp, list };
    }
    return meshes;
  }, [traffic, assets]);

  // night: streetlight glows + pools, flashing LC lamps, vehicle lamps
  const night = useMemo(() => {
    const glowItems = [];
    const poolItems = [];
    for (const l of net.lights) {
      const hx = l.x + l.lx * 2.55;
      const hz = l.z + l.lz * 2.55;
      glowItems.push({ x: hx, y: 7.6, z: hz, size: 4.5, color: '#ffb766' });
      poolItems.push({ x: hx, y: 0.08, z: hz, size: 16, color: '#ffb05a' });
    }
    // twin red flashers on each boom post (visible by day too)
    const flashItems = [];
    for (const f of furniture) {
      for (const post of [f.postUp, f.postDown]) {
        const c = Math.cos(post.yaw);
        const sn = -Math.sin(post.yaw);
        for (const z of [-0.35, 0.35]) flashItems.push({ x: post.x + sn * 0 + Math.sin(post.yaw) * z, y: 2.25, z: post.z + Math.cos(post.yaw) * z, size: 1.4, color: '#ff2a1a' });
        void c;
      }
    }
    const flashMat = createGlowMaterial({ manual: true });
    return {
      glows: makeGlowMesh(glowItems, createGlowMaterial()),
      pools: makeGlowMesh(poolItems, createPoolMaterial({ strength: 0.6 }), { ground: true }),
      veh: makeGlowMesh([], createGlowMaterial({ day: 0.0, night: 1.1 }), { maxCount: traffic.vehicles.length * 4 }),
      flash: makeGlowMesh(flashItems, flashMat),
    };
  }, [net, traffic, furniture]);

  useEffect(
    () =>
      onEnvironmentChange((env) => {
        // lamps look "off" by day and blaze at night
        assets.mats.lamp.color.setScalar(0.55 + 1.9 * env.lamps);
      }),
    [assets],
  );

  useEffect(
    () => () => {
      for (const m of Object.values(assets.mats)) m.dispose();
      for (const g of Object.values(assets.vehicles)) Object.values(g).forEach((x) => x.dispose());
      Object.values(assets.streetlight).forEach((x) => x.dispose());
      [assets.gateCabin, assets.gateBoom, assets.gatePost, assets.whistleBoard, assets.signalPost].forEach((g) => g.dispose());
    },
    [assets],
  );
  useEffect(
    () => () => {
      net.surfaces.forEach((g) => g.dispose());
      net.markings.forEach((g) => g.dispose());
    },
    [net],
  );
  useEffect(
    () => () => {
      for (const m of Object.values(night)) {
        disposeGlowMaterial(m.material);
        m.dispose();
      }
    },
    [night],
  );
  useEffect(
    () => () => {
      for (const f of Object.values(fleet)) {
        f.body.dispose();
        f.lamp?.dispose();
      }
    },
    [fleet],
  );

  const signals = useMemo(() => {
    const p = {};
    const defs = [
      { s: 460, lat: 3.8, rev: false },
      { s: 920, lat: 3.8, rev: false },
      { s: 2600, lat: 3.8, rev: false },
      { s: 4120, lat: 3.8, rev: false },
      { s: 6550, lat: 3.8, rev: false },
      { s: 7120, lat: 3.8, rev: false },
      { s: 7100, lat: -9.2, rev: true },
      { s: 4300, lat: -9.2, rev: true },
      { s: 2500, lat: -9.2, rev: true },
      { s: 950, lat: -9.2, rev: true },
    ];
    return defs.map((def) => {
      mainLine.sample(def.s, p);
      return { s: def.s, x: p.x + p.lx * def.lat, y: 0, z: p.z + p.lz * def.lat, yaw: -p.heading + (def.rev ? Math.PI : 0), rev: def.rev };
    });
  }, []);
  const lightItems = useMemo(() => net.lights.map((l) => ({ x: l.x, y: 0, z: l.z, yaw: l.yaw })), [net]);

  const booms = useRef([]);
  const gates = useRef(net.crossings.map(() => ({ angle: 1.35, closing: false })));
  const o = useMemo(() => ({}), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const playerS = game.renderDistance;
    const lcState = [];
    let anyShut = false;
    const stops = {};
    net.crossings.forEach((lc, i) => {
      // Is any train approaching or on this level crossing?
      let closing = false;
      const playerDist = lc.s - playerS;
      if (playerDist > -40 && playerDist < lc.closeAhead) closing = true;
      if (game.aiTrains) {
        for (const ai of game.aiTrains) {
          if (ai.state !== 'running') continue;
          const aiDist = ai.front - lc.s;
          if (aiDist > -ai.length - 30 && aiDist < lc.closeAhead) closing = true;
        }
      }
      const g = gates.current[i];
      g.closing = closing;
      g.angle += ((closing ? 0 : 1.35) - g.angle) * Math.min(1, dt * 1.8);
      lcState.push({ s: lc.s, closing });
      // gates count as a red light for road traffic from the moment they start to close
      if (closing || g.angle < 1.2) {
        anyShut = true;
        stops[`x${i}A`] = net.stops[`x${i}A`];
        stops[`x${i}B`] = net.stops[`x${i}B`];
      }
      const fx = Math.cos(lc.heading);
      const fz = Math.sin(lc.heading);
      const up = booms.current[i * 2];
      if (up) {
        up.position.set(lc.x + lc.lx * GATE_UP + fx * 3.5, 1.25, lc.z + lc.lz * GATE_UP + fz * 3.5);
        _quat.setFromAxisAngle(_up, -lc.heading + Math.PI);
        _qRot.setFromAxisAngle(_zAxis, g.angle);
        up.quaternion.copy(_quat).multiply(_qRot);
      }
      const down = booms.current[i * 2 + 1];
      if (down) {
        down.position.set(lc.x + lc.lx * GATE_DOWN - fx * 3.5, 1.25, lc.z + lc.lz * GATE_DOWN - fz * 3.5);
        _quat.setFromAxisAngle(_up, -lc.heading);
        _qRot.setFromAxisAngle(_zAxis, -g.angle);
        down.quaternion.copy(_quat).multiply(_qRot);
      }
    });
    sceneRefs.lcState = lcState; // the audio engine rings the nearest crossing's bell
    // alternating red flashers while any gate is closing/closed
    const blink = Math.floor(state.clock.elapsedTime * 2.5) % 2;
    night.flash.material.uniforms.uIntensity.value = 0;
    if (anyShut) {
      // per-crossing on/off by scaling the sprites (cheap: few instances)
      let k = 0;
      net.crossings.forEach((lc, i) => {
        const on = gates.current[i].closing || gates.current[i].angle < 1.2;
        for (let j = 0; j < 4; j++) {
          night.flash.getMatrixAt(k, _mat);
          _mat.decompose(_pos, _quat, _v);
          const lit = on && (j % 2 === blink);
          _v.setScalar(lit ? 1.4 : 0.0001);
          night.flash.setMatrixAt(k++, _mat.compose(_pos, _quat, _v));
        }
      });
      night.flash.instanceMatrix.needsUpdate = true;
      night.flash.material.uniforms.uIntensity.value = 0.9 + 1.2 * envState.lamps;
    }

    stepTraffic(traffic, dt, anyShut ? stops : undefined);

    // Draw every vehicle; lamps glow at night
    const lit = envState.lamps > 0.05;
    let gi = 0;
    const cam = state.camera.position;
    for (const f of Object.values(fleet)) {
      for (const veh of f.list) {
        const lane = net.lanes[veh.lane];
        const visible = veh.active && veh.d - veh.length / 2 <= lane.length;
        lane.sample(veh.d, o);
        let y = 0.05;
        if (lane.crossing) {
          const cr = lane.crossing;
          y = crossingY(cr.dir < 0 ? cr.hi - veh.d : cr.lo + veh.d);
        }
        _pos.set(o.x, y, o.z);
        _quat.setFromAxisAngle(_up, o.yaw);
        _mat.compose(_pos, _quat, visible ? _scale : _zero);
        f.body.setMatrixAt(veh.slot, _mat);
        f.lamp?.setMatrixAt(veh.slot, _mat);
        if (lit && visible && gi < night.veh.instanceMatrix.count - 4 && Math.abs(o.x - cam.x) + Math.abs(o.z - cam.z) < 1400) {
          const half = veh.length / 2;
          const c = Math.cos(o.yaw);
          const sn = -Math.sin(o.yaw); // local +X in world = (cos yaw, 0, −sin yaw)
          const sideX = -sn; // local +Z in world = (sin yaw, 0, cos yaw)
          const sideZ = c;
          const wide = veh.type === 'bike' || veh.type === 'auto' ? 0 : 0.7;
          for (const side of wide ? [-1, 1] : [0]) {
            setGlow(night.veh, gi++, o.x + c * (half + 0.1) + sideX * side * wide, y + 0.8, o.z + sn * (half + 0.1) + sideZ * side * wide, 1.6, '#fff1cf');
            setGlow(night.veh, gi++, o.x - c * (half + 0.1) + sideX * side * wide, y + 0.85, o.z - sn * (half + 0.1) + sideZ * side * wide, 0.7, '#ff2a14');
          }
        }
      }
      f.body.instanceMatrix.needsUpdate = true;
      if (f.lamp) f.lamp.instanceMatrix.needsUpdate = true;
    }
    if (lit || night.veh.count) {
      night.veh.count = gi;
      night.veh.instanceMatrix.needsUpdate = true;
      night.veh.instanceColor.needsUpdate = true;
      night.veh.frustumCulled = false;
    }
  });

  const far = quality.sceneryDistance;
  return (
    <group>
      {net.surfaces.map((geo, i) => (
        <mesh key={`road${i}`} geometry={geo} material={assets.mats.road} receiveShadow />
      ))}
      {net.markings.map((geo, i) => (
        <mesh key={`mk${i}`} geometry={geo} material={assets.mats.marking} />
      ))}
      <ChunkedInstances items={lightItems} geometry={assets.streetlight.body} material={assets.mats.vc} cellSize={600} maxDistance={far} />
      <ChunkedInstances items={lightItems} geometry={assets.streetlight.lamp} material={assets.mats.lamp} cellSize={600} maxDistance={far} />
      {Object.values(night).map((m, i) => (
        <primitive key={`n${i}`} object={m} />
      ))}

      {furniture.map((f, i) => (
        <group key={`lc${i}`}>
          <mesh position={[f.cabin.x, 0, f.cabin.z]} rotation={[0, f.cabin.yaw, 0]} geometry={assets.gateCabin} material={assets.mats.vc} receiveShadow castShadow />
          {f.boards.map((wb, k) => (
            <mesh key={k} position={[wb.x, 0, wb.z]} rotation={[0, wb.yaw, 0]} geometry={assets.whistleBoard} material={assets.mats.vc} />
          ))}
          <mesh position={[f.postUp.x, 0, f.postUp.z]} rotation={[0, f.postUp.yaw, 0]} geometry={assets.gatePost} material={assets.mats.vc} castShadow />
          <mesh position={[f.postDown.x, 0, f.postDown.z]} rotation={[0, f.postDown.yaw, 0]} geometry={assets.gatePost} material={assets.mats.vc} castShadow />
          {[0, 1].map((k) => (
            <group key={`b${k}`} ref={(el) => (booms.current[i * 2 + k] = el)}>
              <mesh geometry={assets.gateBoom} material={assets.mats.vc} castShadow />
            </group>
          ))}
        </group>
      ))}

      {signals.map((sig, i) => (
        <group key={`sig_${i}`} position={[sig.x, sig.y, sig.z]} rotation={[0, sig.yaw, 0]}>
          <mesh geometry={assets.signalPost} material={assets.mats.vc} />
          <mesh position={[0.22, sig.s > 7500 ? 3.5 : sig.s === 6550 || sig.s === 7120 ? 3.9 : 4.7, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <primitive object={sig.s > 7500 ? assets.mats.redSignal : sig.s === 6550 || sig.s === 7120 ? assets.mats.yellowSignal : assets.mats.greenSignal} attach="material" />
          </mesh>
        </group>
      ))}

      {Object.entries(fleet).map(([type, f]) => (
        <group key={type}>
          <primitive object={f.body} />
          {f.lamp && <primitive object={f.lamp} />}
        </group>
      ))}
    </group>
  );
}

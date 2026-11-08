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
import { ROAD, LEVEL_CROSSING, TRACK } from '../../config/gameConfig.js';
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

const ROAD_END_VEER = 420; // metres over which the highway curves away at each end
const CROSS_FROM = 300; // cross road: village side (lateral +)
const CROSS_TO = -260; // far side
const LANE = 1.8;

const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Highway centre-line offset from the track: 32 m, curving away at the ends. */
function highwayOffset(s) {
  return ROAD.lateral + 360 * (smoothstep(ROAD.from, ROAD.from - ROAD_END_VEER, s) + smoothstep(ROAD.to, ROAD.to + ROAD_END_VEER, s));
}

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
  mainLine.sample(LEVEL_CROSSING.s, p);
  const cross = [];
  for (let lat = CROSS_FROM; lat >= CROSS_TO; lat -= 4) cross.push([p.x + p.lx * lat, p.z + p.lz * lat]);
  const crossLat = (i) => CROSS_FROM - i * 4;
  const lanes = {
    up: makePath(offsetPath(centre, LANE)),
    down: makePath(offsetPath([...centre].reverse(), LANE)),
    xA: makePath(offsetPath(cross, LANE)), // village side → across the tracks
    xB: makePath(offsetPath([...cross].reverse(), LANE)),
  };
  // Over the tracks the road rises to rail level
  const crossY = (i) => {
    const lat = crossLat(i);
    return lat < 3.5 && lat > -9 ? TRACK.railTop - 0.01 : lat < 6 && lat > -11.5 ? 0.35 : 0.06;
  };
  const surfaces = [ribbon(centre, ROAD.width / 2), ribbon(cross, 3.8, crossY)];
  const markings = [...dashes(centre), ...dashes(cross.filter((_, i) => Math.abs(crossLat(i)) > 14))];
  // where traffic must wait while the gates are down
  const stops = {
    xA: [CROSS_FROM - (4.6 + 3.2)],
    xB: [-(10.2 + 3.2) - CROSS_TO],
  };
  // streetlights on the track side of the highway, arm reaching over the road
  const lights = [];
  for (let s = ROAD.from + 20; s <= ROAD.to; s += 45) {
    mainLine.sample(s, p);
    const lat = highwayOffset(s) - ROAD.width / 2 - 1.1;
    lights.push({ x: p.x + p.lx * lat, z: p.z + p.lz * lat, yaw: Math.atan2(-p.lz, p.lx), lx: p.lx, lz: p.lz });
  }
  return { lanes, surfaces, markings, stops, lights };
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
  add('xA', Math.max(4, Math.round(10 * density)));
  add('xB', Math.max(4, Math.round(10 * density)));
  return createTraffic(
    Object.entries(lanes).map(([id, l]) => ({ id, length: l.length })),
    vehicles,
  );
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
    const streetlight = buildStreetlight();
    return {
      mats,
      vehicles,
      streetlight,
      gateCabin: buildGateCabin(),
      gateBoom: buildGateBoom(),
      gatePost: buildGatePost(),
      whistleBoard: buildWhistleBoard(),
      signalPost: buildSignalPost(),
    };
  }, []);

  const net = useMemo(buildRoadNetwork, []);
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

  // night: streetlight glows + pools, and one dynamic glow layer for vehicle lamps
  const night = useMemo(() => {
    const glowMat = createGlowMaterial();
    const poolMat = createPoolMaterial({ strength: 0.6 });
    const glowItems = [];
    const poolItems = [];
    for (const l of net.lights) {
      const hx = l.x + l.lx * 2.55;
      const hz = l.z + l.lz * 2.55;
      glowItems.push({ x: hx, y: 7.6, z: hz, size: 4.5, color: '#ffb766' });
      poolItems.push({ x: hx, y: 0.08, z: hz, size: 16, color: '#ffb05a' });
    }
    const vehMat = createGlowMaterial({ day: 0.0, night: 1.1 });
    return {
      glows: makeGlowMesh(glowItems, glowMat),
      pools: makeGlowMesh(poolItems, poolMat, { ground: true }),
      veh: makeGlowMesh([], vehMat, { maxCount: traffic.vehicles.length * 4 }),
    };
  }, [net, traffic]);

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
      for (const m of [night.glows, night.pools, night.veh]) {
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

  const staticItems = useMemo(() => {
    const p = {};
    mainLine.sample(LEVEL_CROSSING.s - 14, p);
    const cabin = { x: p.x + p.lx * 10.5, y: 0, z: p.z + p.lz * 10.5, yaw: -p.heading + Math.PI / 2 };
    mainLine.sample(LEVEL_CROSSING.s - LEVEL_CROSSING.whistleBoard, p);
    const wbUp = { x: p.x + p.lx * 3.8, y: 0, z: p.z + p.lz * 3.8, yaw: -p.heading };
    mainLine.sample(LEVEL_CROSSING.s + LEVEL_CROSSING.whistleBoard, p);
    const wbDown = { x: p.x + p.lx * -9.2, y: 0, z: p.z + p.lz * -9.2, yaw: -p.heading + Math.PI };
    const signalDefs = [
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
    const signals = signalDefs.map((def) => {
      mainLine.sample(def.s, p);
      return { s: def.s, x: p.x + p.lx * def.lat, y: 0, z: p.z + p.lz * def.lat, yaw: -p.heading + (def.rev ? Math.PI : 0), rev: def.rev };
    });
    mainLine.sample(LEVEL_CROSSING.s, p);
    const lc = { ...p };
    const lights = net.lights.map((l) => ({ x: l.x, y: 0, z: l.z, yaw: l.yaw }));
    return { cabin, wbUp, wbDown, signals, lc, lights };
  }, [net]);

  const boomUpRef = useRef();
  const boomDownRef = useRef();
  const gate = useRef({ angle: 1.35 });
  const o = useMemo(() => ({}), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const playerS = game.renderDistance;

    // Is any train approaching or on the level crossing?
    let trainClosing = false;
    const playerDist = LEVEL_CROSSING.s - playerS;
    if (playerDist > -40 && playerDist < LEVEL_CROSSING.closeAhead) trainClosing = true;
    if (game.aiTrains) {
      for (const ai of game.aiTrains) {
        if (ai.state !== 'running') continue;
        const aiDist = ai.front - LEVEL_CROSSING.s;
        if (aiDist > -ai.length - 30 && aiDist < LEVEL_CROSSING.closeAhead) trainClosing = true;
      }
    }
    sceneRefs.lcClosing = trainClosing; // the audio engine rings the crossing bell
    const g = gate.current;
    g.angle += ((trainClosing ? 0 : 1.35) - g.angle) * Math.min(1, dt * 1.8);
    const lc = staticItems.lc;
    if (boomUpRef.current) {
      _pos.set(lc.x + lc.lx * 4.6, 1.25, lc.z + lc.lz * 4.6);
      // boom pivots on the post beside the cross road, swinging across it
      _quat.setFromAxisAngle(_up, -lc.heading + Math.PI / 2 + Math.PI / 2);
      _qRot.setFromAxisAngle(_zAxis, g.angle);
      boomUpRef.current.position.copy(_pos).addScaledVector(_v.set(Math.cos(lc.heading), 0, Math.sin(lc.heading)), 3.5);
      boomUpRef.current.quaternion.copy(_quat).multiply(_qRot);
    }
    if (boomDownRef.current) {
      _pos.set(lc.x + lc.lx * -10.2, 1.25, lc.z + lc.lz * -10.2);
      _quat.setFromAxisAngle(_up, -lc.heading - Math.PI / 2 + Math.PI / 2);
      _qRot.setFromAxisAngle(_zAxis, -g.angle);
      boomDownRef.current.position.copy(_pos).addScaledVector(_v.set(Math.cos(lc.heading), 0, Math.sin(lc.heading)), -3.5);
      boomDownRef.current.quaternion.copy(_quat).multiply(_qRot);
    }

    // Traffic: gates count as a red light from the moment they start closing
    const gatesShut = trainClosing || g.angle < 1.2;
    stepTraffic(traffic, dt, gatesShut ? net.stops : undefined);

    // Draw every vehicle; lamps glow at night
    const lit = envState.lamps > 0.05;
    let gi = 0;
    const cam = state.camera.position;
    for (const f of Object.values(fleet)) {
      for (const veh of f.list) {
        const lane = net.lanes[veh.lane];
        const visible = veh.active && veh.d - veh.length / 2 <= lane.length;
        lane.sample(veh.d, o);
        const y = veh.lane.startsWith('x') && o.x !== undefined ? crossingHeight(veh, lane, o) : 0.05;
        _pos.set(o.x, y, o.z);
        _quat.setFromAxisAngle(_up, o.yaw);
        _mat.compose(_pos, _quat, visible ? _scale : _zero);
        f.body.setMatrixAt(veh.slot, _mat);
        f.lamp?.setMatrixAt(veh.slot, _mat);
        if (lit && visible && gi < night.veh.instanceMatrix.count - 4 && Math.abs(o.x - cam.x) + Math.abs(o.z - cam.z) < 1400) {
          const half = veh.length / 2;
          const c = Math.cos(o.yaw);
          const sn = -Math.sin(o.yaw); // local +X in world = (cos yaw, 0, -sin yaw)
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

  const { cabin, wbUp, wbDown, signals, lc } = staticItems;
  const far = quality.sceneryDistance;

  return (
    <group>
      {net.surfaces.map((geo, i) => (
        <mesh key={`road${i}`} geometry={geo} material={assets.mats.road} receiveShadow />
      ))}
      {net.markings.map((geo, i) => (
        <mesh key={`mk${i}`} geometry={geo} material={assets.mats.marking} />
      ))}
      <ChunkedInstances items={staticItems.lights} geometry={assets.streetlight.body} material={assets.mats.vc} cellSize={600} maxDistance={far} />
      <ChunkedInstances items={staticItems.lights} geometry={assets.streetlight.lamp} material={assets.mats.lamp} cellSize={600} maxDistance={far} />
      <primitive object={night.glows} />
      <primitive object={night.pools} />
      <primitive object={night.veh} />

      <mesh position={[cabin.x, cabin.y, cabin.z]} rotation={[0, cabin.yaw, 0]} geometry={assets.gateCabin} material={assets.mats.vc} receiveShadow castShadow />
      <mesh position={[wbUp.x, wbUp.y, wbUp.z]} rotation={[0, wbUp.yaw, 0]} geometry={assets.whistleBoard} material={assets.mats.vc} />
      <mesh position={[wbDown.x, wbDown.y, wbDown.z]} rotation={[0, wbDown.yaw, 0]} geometry={assets.whistleBoard} material={assets.mats.vc} />
      <group ref={boomUpRef}>
        <mesh geometry={assets.gateBoom} material={assets.mats.vc} castShadow />
      </group>
      <group ref={boomDownRef}>
        <mesh geometry={assets.gateBoom} material={assets.mats.vc} castShadow />
      </group>
      <mesh position={[lc.x + lc.lx * 4.6 + Math.cos(lc.heading) * 3.5, 0, lc.z + lc.lz * 4.6 + Math.sin(lc.heading) * 3.5]} rotation={[0, -lc.heading, 0]} geometry={assets.gatePost} material={assets.mats.vc} />
      <mesh position={[lc.x + lc.lx * -10.2 - Math.cos(lc.heading) * 3.5, 0, lc.z + lc.lz * -10.2 - Math.sin(lc.heading) * 3.5]} rotation={[0, -lc.heading + Math.PI, 0]} geometry={assets.gatePost} material={assets.mats.vc} />

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

/** Height of a cross-road vehicle: up the ramp and over the rails at the crossing. */
function crossingHeight(veh, lane, o) {
  const lat = veh.lane === 'xA' ? CROSS_FROM - veh.d : CROSS_TO + veh.d;
  if (lat < 3.5 && lat > -9) return TRACK.railTop - 0.01;
  if (lat < 6 && lat > -11.5) return 0.35;
  return 0.05;
}

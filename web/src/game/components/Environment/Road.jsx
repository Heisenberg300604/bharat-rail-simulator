// Indian Railways roadside environment:
// 1. Parallel asphalt highway with lane markings and streetlights
// 2. Dynamic Indian road traffic: Auto-rickshaws, Buses, Trucks, and Passenger Cars
// 3. Manned Indian Railways level crossing (LC-42) with animated boom gates,
//    warning flashers, gatekeeper cabin (gumti), and whistle boards ("W/L", "सी/फा")
// 4. Trackside Multi-Aspect Colour Light Signals (MACLS) with glowing LED lamps
// All rendered with merged geometries and InstancedMeshes for 60 FPS performance.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game, route, useQuality, currentSpeedLimit } from '../../state/gameStore.js';
import { mainLine } from '../../world/trackLayout.js';
import { ROAD, LEVEL_CROSSING, TRACK } from '../../config/gameConfig.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { seededRandom } from '../../world/geometry.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';

const _mat = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- Road models
function buildAutoRickshaw() {
  const b = new ModelBuilder();
  // Lower body (classic green)
  b.box([-1.2, 1.2], [0.35, 1.0], [-0.65, 0.65], '#1d7335');
  b.box([0.5, 1.3], [0.4, 0.95], [-0.4, 0.4], '#1d7335'); // front tapered nose
  // Yellow upper frame & canvas canopy
  b.box([-1.22, 0.6], [1.0, 1.72], [-0.65, 0.65], '#f0be18');
  b.cylinder({ radius: 0.65, length: 0.6, axis: 'x', position: [0.9, 1.15, 0], color: '#f0be18' });
  // Windscreen
  b.box([0.7, 0.74], [1.05, 1.55], [-0.5, 0.5], '#152028', { mat: 'glass' });
  // Black canvas roof top
  b.box([-1.25, 0.8], [1.72, 1.78], [-0.68, 0.68], '#222528');
  // Wheels (1 front, 2 rear)
  b.cylinder({ radius: 0.24, length: 0.12, axis: 'z', position: [0.9, 0.24, 0], color: '#1a1a1a' });
  for (const z of [-0.6, 0.6]) {
    b.cylinder({ radius: 0.24, length: 0.12, axis: 'z', position: [-0.65, 0.24, z], color: '#1a1a1a' });
  }
  // Headlamp
  b.cylinder({ radius: 0.08, length: 0.06, axis: 'x', position: [1.32, 0.75, 0], color: '#fffbe6', mat: 'lamp' });
  return b.build();
}

function buildBus() {
  const b = new ModelBuilder();
  const L = 10.2;
  const W = 2.5;
  const H = 3.1;
  const HL = L / 2;
  const HW = W / 2;

  // Body: Indian State Transport red/orange with cream upper
  b.box([-HL, HL], [0.55, 1.8], [-HW, HW], '#b8321d');
  b.box([-HL, HL], [1.8, 2.7], [-HW, HW], '#e8dfcc');
  b.box([-HL, HL], [2.7, H], [-HW, HW], '#d5cdb8'); // roof
  // Window strip along both sides (dark tinted glass)
  for (const z of [-HW - 0.01, HW + 0.01]) {
    b.box([-HL + 0.8, HL - 0.8], [1.85, 2.55], [z - 0.01, z + 0.01], '#19242d', { mat: 'glass' });
    // Passenger window pillars
    for (let x = -HL + 1.8; x <= HL - 1.8; x += 1.4) {
      b.box([x - 0.06, x + 0.06], [1.85, 2.55], [z - 0.02, z + 0.02], '#b8321d');
    }
  }
  // Front split windscreen & destination board
  b.box([HL - 0.02, HL + 0.02], [1.75, 2.55], [-HW + 0.1, HW - 0.1], '#19242d', { mat: 'glass' });
  b.box([HL - 0.03, HL + 0.03], [2.62, 2.88], [-0.8, 0.8], '#f3c623'); // yellow destination board
  // Bumper
  b.box([HL, HL + 0.12], [0.45, 0.75], [-HW, HW], '#33373b');
  // Wheels (4 large bus wheels)
  for (const x of [-HL + 2.2, HL - 2.4]) {
    for (const z of [-HW + 0.1, HW - 0.1]) {
      b.cylinder({ radius: 0.48, length: 0.28, axis: 'z', position: [x, 0.48, z], color: '#1a1a1a' });
    }
  }
  // Headlights
  for (const z of [-0.85, 0.85]) {
    b.cylinder({ radius: 0.12, length: 0.06, axis: 'x', position: [HL + 0.05, 0.85, z], color: '#fffbe6', mat: 'lamp' });
  }
  return b.build();
}

function buildTruck() {
  const b = new ModelBuilder();
  const L = 8.4;
  const HL = L / 2;
  // Chassis
  b.box([-HL, HL], [0.55, 0.95], [-1.05, 1.05], '#25272a');
  // Driver's Cabin (Tata 1613 style, colourful painted front)
  b.box([HL - 2.4, HL], [0.95, 2.85], [-1.15, 1.15], '#1d6aa3');
  b.box([HL - 0.1, HL + 0.05], [0.95, 1.45], [-1.2, 1.2], '#e8aa12'); // yellow decorative bumper
  // Cab windscreen
  b.box([HL - 0.4, HL + 0.02], [1.85, 2.55], [-1.05, 1.05], '#19242d', { mat: 'glass' });
  // High wooden cargo bed (green/yellow painted slats)
  b.box([-HL, HL - 2.5], [0.95, 2.75], [-1.22, 1.22], '#2e7a48');
  b.box([-HL - 0.02, HL - 2.48], [1.75, 1.85], [-1.24, 1.24], '#f0c018'); // yellow waist stripe
  // Wheels (6 wheels: 2 front, 4 rear dual)
  for (const z of [-1.1, 1.1]) {
    b.cylinder({ radius: 0.48, length: 0.26, axis: 'z', position: [HL - 1.2, 0.48, z], color: '#1a1a1a' });
    b.cylinder({ radius: 0.48, length: 0.45, axis: 'z', position: [-HL + 1.8, 0.48, z], color: '#1a1a1a' });
  }
  // Headlamps
  for (const z of [-0.8, 0.8]) {
    b.cylinder({ radius: 0.11, length: 0.06, axis: 'x', position: [HL + 0.03, 1.05, z], color: '#fffbe6', mat: 'lamp' });
  }
  return b.build();
}

function buildCar() {
  const b = new ModelBuilder();
  // Lower body
  b.box([-1.9, 1.9], [0.32, 0.85], [-0.85, 0.85], '#d8dde2');
  // Cabin greenhouse
  b.box([-0.9, 0.8], [0.85, 1.45], [-0.75, 0.75], '#d8dde2');
  b.box([-0.85, 0.75], [0.88, 1.4], [-0.78, 0.78], '#152028', { mat: 'glass' });
  // Wheels
  for (const x of [-1.15, 1.15]) {
    for (const z of [-0.82, 0.82]) {
      b.cylinder({ radius: 0.3, length: 0.18, axis: 'z', position: [x, 0.3, z], color: '#1a1a1a' });
    }
  }
  // Lights
  for (const z of [-0.6, 0.6]) {
    b.cylinder({ radius: 0.08, length: 0.05, axis: 'x', position: [1.92, 0.65, z], color: '#fffbe6', mat: 'lamp' });
    b.cylinder({ radius: 0.07, length: 0.05, axis: 'x', position: [-1.92, 0.65, z], color: '#d21a1a' });
  }
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

export default function Road() {
  const quality = useQuality();

  // Create road geometries & materials
  const assets = useMemo(() => {
    const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
    const mats = {
      road: new THREE.MeshStandardMaterial({ color: '#2b2d30', roughness: 0.95 }),
      whiteMarking: new THREE.MeshStandardMaterial({ color: '#f0ece2', roughness: 0.8 }),
      yellowMarking: new THREE.MeshStandardMaterial({ color: '#e6af1a', roughness: 0.8 }),
      woodPanel: new THREE.MeshStandardMaterial({ color: '#524538', roughness: 0.9 }),
      lamp: new THREE.MeshStandardMaterial({ emissive: '#fff6dd', emissiveIntensity: 0.8 }),
      greenSignal: new THREE.MeshStandardMaterial({ emissive: '#00e676', emissiveIntensity: 3.5, color: '#00e676' }),
      yellowSignal: new THREE.MeshStandardMaterial({ emissive: '#ffab00', emissiveIntensity: 3.5, color: '#ffab00' }),
      redSignal: new THREE.MeshStandardMaterial({ emissive: '#ff1744', emissiveIntensity: 3.5, color: '#ff1744' }),
    };

    return {
      mats,
      auto: buildAutoRickshaw(),
      bus: buildBus(),
      truck: buildTruck(),
      car: buildCar(),
      gateCabin: buildGateCabin(),
      gateBoom: buildGateBoom(),
      gatePost: buildGatePost(),
      whistleBoard: buildWhistleBoard(),
      signalPost: buildSignalPost(),
      unitBox: new THREE.BoxGeometry(1, 1, 1),
    };
  }, []);

  useEffect(
    () => () => {
      Object.values(assets.mats).forEach((m) => m.dispose());
      assets.unitBox.dispose();
      assets.gateCabin.dispose();
      assets.gateBoom.dispose();
      assets.gatePost.dispose();
      assets.whistleBoard.dispose();
      assets.signalPost.dispose();
    },
    [assets],
  );

  // Parallel road surface & markings
  const roadRibbon = useMemo(() => {
    const pts = [];
    const step = 20;
    const p = {};
    for (let s = ROAD.from; s <= ROAD.to; s += step) {
      mainLine.sample(s, p);
      pts.push({
        s,
        x: p.x + p.lx * ROAD.lateral,
        z: p.z + p.lz * ROAD.lateral,
        heading: p.heading,
        lx: p.lx,
        lz: p.lz,
      });
    }

    // Build road quad strip
    const geom = new THREE.BufferGeometry();
    const pos = [];
    const halfW = ROAD.width / 2;
    for (const pt of pts) {
      pos.push(pt.x + pt.lx * halfW, 0.05, pt.z + pt.lz * halfW);
      pos.push(pt.x - pt.lx * halfW, 0.05, pt.z - pt.lz * halfW);
    }
    const idx = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    return geom;
  }, []);

  // Level crossing cross-road geometry
  const crossingRoadGeom = useMemo(() => {
    const p = {};
    mainLine.sample(LEVEL_CROSSING.s, p);
    const geom = new THREE.BufferGeometry();
    const W = 8;
    const HW = W / 2;
    const latStart = ROAD.lateral + 3.5;
    const latEnd = LEVEL_CROSSING.farLateral;
    const steps = 30;
    const pos = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const lat = latStart + (latEnd - latStart) * t;
      const cx = p.x + p.lx * lat;
      const cz = p.z + p.lz * lat;
      // perpendicular to road = along track direction (cos/sin heading)
      const dx = Math.cos(p.heading) * HW;
      const dz = Math.sin(p.heading) * HW;
      const y = Math.abs(lat) < 8 ? TRACK.railTop - 0.01 : 0.06;
      pos.push(cx - dx, y, cz - dz);
      pos.push(cx + dx, y, cz + dz);
    }
    const idx = [];
    for (let i = 0; i < steps; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      idx.push(a, b, c, b, d, c);
    }
    geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geom.setIndex(idx);
    geom.computeVertexNormals();
    return geom;
  }, []);

  // Static roadside items: gatekeeper cabin, gate posts, whistle boards, signals
  const staticItems = useMemo(() => {
    const p = {};
    // Level crossing cabin
    mainLine.sample(LEVEL_CROSSING.s - 14, p);
    const cabin = {
      x: p.x + p.lx * 10.5,
      y: 0,
      z: p.z + p.lz * 10.5,
      yaw: -p.heading + Math.PI / 2,
    };

    // Whistle boards
    mainLine.sample(LEVEL_CROSSING.s - LEVEL_CROSSING.whistleBoard, p);
    const wbUp = { x: p.x + p.lx * 3.8, y: 0, z: p.z + p.lz * 3.8, yaw: -p.heading };
    mainLine.sample(LEVEL_CROSSING.s + LEVEL_CROSSING.whistleBoard, p);
    const wbDown = { x: p.x + p.lx * -9.2, y: 0, z: p.z + p.lz * -9.2, yaw: -p.heading + Math.PI };

    // Signals along the line
    const signalDefs = [
      { s: 460, lat: 3.8, rev: false },
      { s: 920, lat: 3.8, rev: false },
      { s: 2600, lat: 3.8, rev: false },
      { s: 4120, lat: 3.8, rev: false },
      { s: 6550, lat: 3.8, rev: false },
      { s: 7120, lat: 3.8, rev: false },
      // Down line signals (opposing direction)
      { s: 7100, lat: -9.2, rev: true },
      { s: 4300, lat: -9.2, rev: true },
      { s: 2500, lat: -9.2, rev: true },
      { s: 950, lat: -9.2, rev: true },
    ];
    const signals = signalDefs.map((def) => {
      mainLine.sample(def.s, p);
      return {
        s: def.s,
        x: p.x + p.lx * def.lat,
        y: 0,
        z: p.z + p.lz * def.lat,
        yaw: -p.heading + (def.rev ? Math.PI : 0),
        rev: def.rev,
      };
    });

    return { cabin, wbUp, wbDown, signals };
  }, []);

  // Road vehicles state pool (16 parallel vehicles + 4 crossing vehicles)
  const traffic = useRef(null);
  if (!traffic.current) {
    const rand = seededRandom(77);
    const vehicles = [];
    const types = ['car', 'auto', 'bus', 'truck'];

    // 16 parallel road vehicles
    for (let i = 0; i < 16; i++) {
      const isUp = i % 2 === 0;
      const type = types[Math.floor(rand() * types.length)];
      const speedKmh = 35 + rand() * 30; // 35 - 65 km/h
      const s = ROAD.from + rand() * (ROAD.to - ROAD.from);
      vehicles.push({
        id: i,
        type,
        mode: 'parallel',
        isUp,
        s,
        speedMps: (speedKmh / 3.6) * (isUp ? 1 : -1),
        lat: ROAD.lateral + (isUp ? 1.8 : -1.8),
      });
    }

    // 4 crossing vehicles
    for (let i = 0; i < 4; i++) {
      const type = i % 2 === 0 ? 'auto' : 'car';
      const dir = i < 2 ? 1 : -1; // 1 = approaching from far lateral towards road, -1 = towards far lateral
      const lat = dir > 0 ? -120 + i * 25 : 25 - i * 15;
      vehicles.push({
        id: 16 + i,
        type,
        mode: 'crossing',
        dir,
        lat,
        speedMps: 9 * dir, // ~32 km/h
        currentSpeed: 9 * dir,
      });
    }

    traffic.current = { vehicles, gateAngle: 1.35, flasherOn: false };
  }

  // Refs for animated gate booms & flashers
  const boomUpRef = useRef();
  const boomDownRef = useRef();
  const flasherRef = useRef();
  const vehicleRefs = useRef({});

  const registerVeh = (name) => (el) => {
    if (el) vehicleRefs.current[name] = el;
    else delete vehicleRefs.current[name];
  };

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    const tr = traffic.current;
    const playerS = game.renderDistance;

    // Check if any train is approaching the level crossing
    let trainClosing = false;
    // 1. Player train
    const playerDist = LEVEL_CROSSING.s - playerS;
    if (playerDist > -40 && playerDist < LEVEL_CROSSING.closeAhead) {
      trainClosing = true;
    }
    // 2. AI trains
    if (game.aiTrains) {
      for (const ai of game.aiTrains) {
        if (ai.state !== 'running') continue;
        const aiDist = ai.front - LEVEL_CROSSING.s;
        if (aiDist > -ai.length - 30 && aiDist < LEVEL_CROSSING.closeAhead) {
          trainClosing = true;
        }
      }
    }

    // Animate gate boom angle: 0 = closed (horizontal), 1.35 = open (upright)
    const targetGate = trainClosing ? 0.0 : 1.35;
    tr.gateAngle += (targetGate - tr.gateAngle) * Math.min(1, dt * 1.8);
    const gatesClosed = tr.gateAngle < 0.25;

    // Twin red flasher timer
    tr.flasherOn = trainClosing && Math.floor(state.clock.elapsedTime * 3) % 2 === 0;

    // Update gate boom transforms
    const p = {};
    if (boomUpRef.current) {
      mainLine.sample(LEVEL_CROSSING.s + 3.5, p);
      _pos.set(p.x + p.lx * 4.6, 1.25, p.z + p.lz * 4.6);
      _quat.setFromAxisAngle(_up, -p.heading + Math.PI / 2);
      const qRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), tr.gateAngle);
      _quat.multiply(qRot);
      boomUpRef.current.position.copy(_pos);
      boomUpRef.current.quaternion.copy(_quat);
    }
    if (boomDownRef.current) {
      mainLine.sample(LEVEL_CROSSING.s - 3.5, p);
      _pos.set(p.x + p.lx * -10.2, 1.25, p.z + p.lz * -10.2);
      _quat.setFromAxisAngle(_up, -p.heading - Math.PI / 2);
      const qRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -tr.gateAngle);
      _quat.multiply(qRot);
      boomDownRef.current.position.copy(_pos);
      boomDownRef.current.quaternion.copy(_quat);
    }

    // Update vehicles
    const counts = { car: 0, auto: 0, bus: 0, truck: 0 };
    for (const v of tr.vehicles) {
      if (v.mode === 'parallel') {
        v.s += v.speedMps * dt;
        // Loop when reaching ends of road
        if (v.s > ROAD.to) v.s = ROAD.from;
        if (v.s < ROAD.from) v.s = ROAD.to;

        mainLine.sample(v.s, p);
        const vx = p.x + p.lx * v.lat;
        const vz = p.z + p.lz * v.lat;
        const yaw = -p.heading + (v.isUp ? 0 : Math.PI);

        _pos.set(vx, 0.05, vz);
        _quat.setFromAxisAngle(_up, yaw);
        _mat.compose(_pos, _quat, _scale);

        const mesh = vehicleRefs.current[v.type];
        if (mesh) {
          mesh.setMatrixAt(counts[v.type]++, _mat);
        }
      } else {
        // Crossing vehicle: stops at gates if closed/closing
        const nearStop = v.dir > 0 ? (v.lat > -18 && v.lat < -10) : (v.lat < 14 && v.lat > 5);
        if (nearStop && (trainClosing || !gatesClosed && tr.gateAngle < 1.1)) {
          v.currentSpeed += (0 - v.currentSpeed) * Math.min(1, dt * 3);
        } else {
          v.currentSpeed += (v.speedMps - v.currentSpeed) * Math.min(1, dt * 1.5);
        }

        v.lat += v.currentSpeed * dt;
        if (v.dir > 0 && v.lat > ROAD.lateral + 2) v.lat = LEVEL_CROSSING.farLateral + 5;
        if (v.dir < 0 && v.lat < LEVEL_CROSSING.farLateral) v.lat = ROAD.lateral;

        mainLine.sample(LEVEL_CROSSING.s, p);
        const vx = p.x + p.lx * v.lat;
        const vz = p.z + p.lz * v.lat;
        // Travelling across tracks = along lx, lz vector
        const yaw = -p.heading + (v.dir > 0 ? Math.PI / 2 : -Math.PI / 2);

        _pos.set(vx, Math.abs(v.lat) < 8 ? TRACK.railTop : 0.06, vz);
        _quat.setFromAxisAngle(_up, yaw);
        _mat.compose(_pos, _quat, _scale);

        const mesh = vehicleRefs.current[v.type];
        if (mesh) {
          mesh.setMatrixAt(counts[v.type]++, _mat);
        }
      }
    }

    for (const type of ['car', 'auto', 'bus', 'truck']) {
      const mesh = vehicleRefs.current[type];
      if (mesh) {
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  });

  const { cabin, wbUp, wbDown, signals } = staticItems;
  const p = {};
  mainLine.sample(LEVEL_CROSSING.s, p);

  return (
    <group>
      {/* Parallel highway road surface */}
      <mesh geometry={roadRibbon} material={assets.mats.road} receiveShadow />

      {/* Level crossing perpendicular cross-road */}
      <mesh geometry={crossingRoadGeom} material={assets.mats.road} receiveShadow />

      {/* Gatekeeper Cabin (Gumti) */}
      <mesh position={[cabin.x, cabin.y, cabin.z]} rotation={[0, cabin.yaw, 0]} geometry={assets.gateCabin} material={assets.mats.road} receiveShadow castShadow />

      {/* Whistle Boards ("W/L" / "सी/फा") */}
      <mesh position={[wbUp.x, wbUp.y, wbUp.z]} rotation={[0, wbUp.yaw, 0]} geometry={assets.whistleBoard} material={assets.mats.yellowMarking} />
      <mesh position={[wbDown.x, wbDown.y, wbDown.z]} rotation={[0, wbDown.yaw, 0]} geometry={assets.whistleBoard} material={assets.mats.yellowMarking} />

      {/* Animated Level Crossing Barrier Booms */}
      <group ref={boomUpRef}>
        <mesh geometry={assets.gateBoom} material={assets.mats.road} />
      </group>
      <group ref={boomDownRef}>
        <mesh geometry={assets.gateBoom} material={assets.mats.road} />
      </group>

      {/* Gate Posts */}
      <mesh position={[p.x + p.lx * 4.6, 0, p.z + p.lz * 4.6]} rotation={[0, -p.heading, 0]} geometry={assets.gatePost} material={assets.mats.road} />
      <mesh position={[p.x + p.lx * -10.2, 0, p.z + p.lz * -10.2]} rotation={[0, -p.heading + Math.PI, 0]} geometry={assets.gatePost} material={assets.mats.road} />

      {/* Trackside Multi-Aspect Colour Light Signals (MACLS) */}
      {signals.map((sig, i) => (
        <group key={`sig_${i}`} position={[sig.x, sig.y, sig.z]} rotation={[0, sig.yaw, 0]}>
          <mesh geometry={assets.signalPost} material={assets.mats.road} />
          {/* Signal Aspect Light: Green when line is clear, Double Yellow approaching turnouts, Red near buffer */}
          <mesh position={[0.22, sig.s > 7500 ? 3.5 : sig.s === 6550 || sig.s === 7120 ? 3.9 : 4.7, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <primitive object={sig.s > 7500 ? assets.mats.redSignal : sig.s === 6550 || sig.s === 7120 ? assets.mats.yellowSignal : assets.mats.greenSignal} attach="material" />
          </mesh>
        </group>
      ))}

      {/* Road traffic vehicle instances */}
      <instancedMesh ref={registerVeh('auto')} args={[assets.auto.body, assets.mats.road, 8]} castShadow receiveShadow />
      <instancedMesh ref={registerVeh('bus')} args={[assets.bus.body, assets.mats.road, 6]} castShadow receiveShadow />
      <instancedMesh ref={registerVeh('truck')} args={[assets.truck.body, assets.mats.road, 6]} castShadow receiveShadow />
      <instancedMesh ref={registerVeh('car')} args={[assets.car.body, assets.mats.road, 8]} castShadow receiveShadow />
    </group>
  );
}


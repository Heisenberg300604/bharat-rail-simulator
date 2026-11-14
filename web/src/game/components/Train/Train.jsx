// Draws every rail vehicle in the world: our train (WAP-7 + 8 coaches),
// the dynamic AI trains on the DOWN line, and stationary parked trains.
//
// Performance design:
// - Each model is merged into one geometry per material (see ModelBuilder).
// - All coaches share InstancedMeshes per material, all bogies one, all
//   wheelsets one → the whole railway network is ~20 draw calls, independent of rake lengths.
// - Bogies and wheelsets are placed at their OWN position on the rails, so on
//   curves the wheels stay on the track while the body forms a chord.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game, formation, useGameValue } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { FORMATION, COACH_TYPES, LIVERIES, PARKED_TRAINS, AI_TRAINS, TRACK, LOCOMOTIVES, consistFor } from '../../config/gameConfig.js';
import { vehiclePose } from '../../simulation/routeMath.js';
import { lines, mainLine, downLine } from '../../world/trackLayout.js';
import { buildLocomotive, buildBogieFrame, buildWheelset, buildCoachExtras, buildRearEndIndicators, tailLampPosition } from '../../world/models/trainModels.js';
import { getCoachVariants, coachVariantKey } from '../../world/models/coaches.js';
import { buildCabInterior } from './CabInterior.jsx';
import { buildCoachInterior, createInteriorMaterials, coachEye, COACH_LAYOUTS, INTERIOR_FLOOR, buildDoorway, doorEye } from './CoachInterior.jsx';
import { buildPersonGeometry, createPeopleMaterial, makeCrowdMesh, randomPerson, ANIM } from '../../world/models/people.js';
import { seededRandom } from '../../world/geometry.js';
import { loadMergedModel, measureLampAnchors } from '../../world/models/loadGlbModel.js';
import { createGlowMaterial, createBeamMesh, makeGlowMesh, setGlow, disposeGlowMaterial } from '../../world/glow.js';
import { envState } from '../../world/environment.js';

// Lamp positions in the locomotive's local frame (x forward, y up, z right)
// for the procedural stand-in; loaded models get their own (measureLampAnchors).
const HEADLAMP = [10.3, 4.05, 0];
const MARKERS = [
  [10.32, 2.35, 1.05],
  [10.32, 2.35, -1.05],
];
const DEFAULT_ANCHORS = { head: HEADLAMP, markers: MARKERS };
const _v = new THREE.Vector3();

/** Retro-reflective paint (the X and the LV board): a little glow in its own colour. */
function makeReflectiveMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, emissive: '#ffffff', emissiveIntensity: 0 });
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= diffuseColor.rgb;');
  };
  return m;
}

// Licensed WAP-7 model (CC-BY-4.0, see docs/ASSET_CREDITS.md). Until it has
// loaded — or if it fails — the procedural locomotive is shown instead.
const locoUrl = (id) => `${import.meta.env.BASE_URL}assets/models/locomotive/${LOCOMOTIVES[id].model}`;

export const FRAME_PRIORITY_TRAIN = -2; // after the simulation (-3), before cameras (-1)

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();
const _qp = new THREE.Quaternion();
/** Yaw about +Y, then pitch about the vehicle's own Z (nose up on a rising gradient). */
function orient(q, yaw, pitch) {
  q.setFromAxisAngle(_up, yaw);
  if (pitch) q.multiply(_qp.setFromAxisAngle(_axis, pitch));
  return q;
}

/**
 * Builds the list of all rail vehicles:
 * 1. Player train (locomotive + 8 coaches on UP main)
 * 2. Stationary parked trains at station platforms
 * 3. Dynamic AI trains operating on the DOWN main line
 */
function buildVehicleList(coachSetting, playerLoco = 'wap7') {
  const list = [];
  const consist = consistFor(coachSetting);
  const playerType = consist.type;
  const playerLivery = consist.livery;

  // 1. Player train on main line (locomotive + coaches with proper spacing per coach type)
  const L = FORMATION.locomotive.length;
  list.push({
    kind: 'locomotive',
    type: 'locomotive',
    line: mainLine,
    offset: L / 2,
    dynamic: true,
    isPlayer: true,
    livery: 'wap7',
    model: playerLoco,
    reverseHeading: false,
  });

  const playerSpec = COACH_TYPES[playerType] || COACH_TYPES.lhb;
  const playerGap = playerSpec.gap ?? FORMATION.couplingGap;
  let playerBack = L;
  for (let i = 0; i < consist.count; i++) {
    playerBack += playerGap;
    list.push({
      kind: 'coach',
      type: playerType,
      line: mainLine,
      offset: playerBack + playerSpec.length / 2,
      dynamic: true,
      isPlayer: true,
      livery: playerLivery,
      reverseHeading: false,
    });
    playerBack += playerSpec.length;
  }

  // 2. Parked trains at station yards
  for (const pt of PARKED_TRAINS) {
    const line = lines.find((l) => l.id === pt.line);
    if (!line) continue;
    let back = 0;
    const L = FORMATION.locomotive.length;
    list.push({ kind: 'locomotive', type: 'locomotive', line, centerS: pt.frontS - L / 2, livery: 'wap7', model: pt.loco ?? 'wap7', reverseHeading: false });
    back = L;
    const ptType = pt.type || 'lhb';
    const ct = COACH_TYPES[ptType] || COACH_TYPES.lhb;
    const gap = ct.gap ?? FORMATION.couplingGap;
    for (let i = 0; i < pt.coaches; i++) {
      back += gap;
      let livery = pt.livery;
      if (livery === 'contrast') livery = playerLivery === 'lhb' ? 'lhbBlue' : 'lhb';
      list.push({
        kind: 'coach',
        type: ptType,
        line,
        centerS: pt.frontS - back - ct.length / 2,
        livery,
        reverseHeading: false,
      });
      back += ct.length;
    }
  }

  // 3. AI Trains on the DOWN main line (running towards the route start)
  if (!downLine) return list;
  AI_TRAINS.forEach((def, aiIdx) => {
    const ct = COACH_TYPES[def.type] || COACH_TYPES.lhb;
    const gap = ct.gap ?? 0.5;
    const L = FORMATION.locomotive.length;

    // AI Locomotive (leading end)
    list.push({
      kind: 'locomotive',
      type: 'locomotive',
      line: downLine,
      dynamic: true,
      isAi: true,
      aiIndex: aiIdx,
      offsetFromFront: L / 2,
      livery: 'wap7',
      model: def.loco ?? 'wap7',
      reverseHeading: true,
    });

    let back = L;
    for (let i = 0; i < def.coaches; i++) {
      back += gap;
      list.push({
        kind: 'coach',
        type: def.type,
        line: downLine,
        dynamic: true,
        isAi: true,
        aiIndex: aiIdx,
        offsetFromFront: back + ct.length / 2,
        livery: def.livery,
        reverseHeading: true,
      });
      back += ct.length;
    }
  });

  return list;
}

function makeMaterials() {
  const std = (o) => new THREE.MeshStandardMaterial({ vertexColors: true, ...o });
  return {
    paint: std({ roughness: 0.42, metalness: 0.15 }),
    paint2: std({ roughness: 0.45, metalness: 0.15 }),
    body: std({ roughness: 0.75, metalness: 0.2 }),
    glass: std({ roughness: 0.06, metalness: 0.75, envMapIntensity: 1.4 }),
    lamp: std({ emissive: '#fff3c4', emissiveIntensity: 0 }),
    running: std({ roughness: 0.6, metalness: 0.45 }),
    display: std({ emissive: '#58c8e8', emissiveIntensity: 0.35 }),
  };
}

export default function Train() {
  const coachLivery = useGameValue((s) => s.settings.coachLivery);
  const playerLoco = useGameValue((s) => s.settings.locomotive) ?? 'wap7';
  const routeId = useGameValue((s) => s.routeId);
  const vehicles = useMemo(() => buildVehicleList(coachLivery, playerLoco), [coachLivery, playerLoco, routeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const assets = useMemo(() => {
    const loco = buildLocomotive();
    return {
      loco,
      cab: buildCabInterior(),
      interiors: { lhb: buildCoachInterior('lhb'), icf: buildCoachInterior('icf') },
      interiorMaterials: createInteriorMaterials(),
      personGeo: buildPersonGeometry(),
      personMat: createPeopleMaterial(),
      locoBogie: buildBogieFrame('loco'),
      lhbBogie: buildBogieFrame('coach'),
      icfBogie: buildBogieFrame('icf'),
      locoWheel: buildWheelset(FORMATION.locomotive.wheelRadius),
      coachWheel: buildWheelset(COACH_TYPES.lhb.wheelRadius),
      lhbExtras: buildCoachExtras(COACH_TYPES.lhb.gap, COACH_TYPES.lhb.length, 'lhb'),
      icfExtras: buildCoachExtras(COACH_TYPES.icf.gap, COACH_TYPES.icf.length, 'icf'),
      rearEnds: { lhb: buildRearEndIndicators('lhb'), icf: buildRearEndIndicators('icf'), boxn: buildRearEndIndicators('boxn') },
      doorways: { lhb: buildDoorway('lhb'), icf: buildDoorway('icf') },
      reflectMat: makeReflectiveMaterial(),
      mats: makeMaterials(),
      locoMats: makeMaterials(),
      interiorMats: makeMaterials(),
    };
  }, []);

  // Night lighting: glow sprites + headlight beam for our loco, a flashing tail
  // lamp, and one dynamic glow layer for every other train's lamps.
  const lamps = useMemo(() => {
    const headMat = createGlowMaterial({ manual: true });
    const head = makeGlowMesh(
      [
        { x: HEADLAMP[0], y: HEADLAMP[1], z: HEADLAMP[2], size: 2.2, color: '#fff6e0' },
        ...MARKERS.map(([x, y, z]) => ({ x, y, z, size: 0.8, color: '#fff2d0' })),
      ],
      headMat,
    );
    head.frustumCulled = false;
    const tailMat = createGlowMaterial({ manual: true });
    const tail = makeGlowMesh([{ x: -0.1, y: 1.98, z: -0.8, size: 1.1, color: '#ff2a1a' }], tailMat);
    tail.frustumCulled = false;
    const beam = createBeamMesh(75, 10);
    beam.position.set(HEADLAMP[0] + 0.1, HEADLAMP[1] - 0.05, 0);
    beam.rotation.z = -0.05; // aimed slightly down at the track
    const othersMat = createGlowMaterial({ day: 0.15, night: 1.2 });
    const others = makeGlowMesh([], othersMat, { maxCount: 64 });
    return { head, tail, beam, others };
  }, []);
  useEffect(
    () => () => {
      for (const m of [lamps.head, lamps.tail, lamps.others]) {
        disposeGlowMaterial(m.material);
        m.dispose();
      }
      lamps.beam.geometry.dispose();
      lamps.beam.material.dispose();
    },
    [lamps],
  );

  useEffect(
    () => () => {
      const all = [
        assets.lhbExtras,
        assets.icfExtras,
        assets.locoBogie,
        assets.lhbBogie,
        assets.icfBogie,
        assets.locoWheel,
        assets.coachWheel,
        ...Object.values(assets.loco),
        ...Object.values(assets.cab),
        ...Object.values(assets.interiors.lhb),
        ...Object.values(assets.interiors.icf),
        assets.personGeo,
        ...Object.values(assets.rearEnds.lhb),
        ...Object.values(assets.rearEnds.icf),
        ...Object.values(assets.rearEnds.boxn),
        ...Object.values(assets.doorways.lhb),
        ...Object.values(assets.doorways.icf),
      ];
      all.forEach((g) => g.dispose());
      [...Object.values(assets.mats), ...Object.values(assets.locoMats), ...Object.values(assets.interiorMats)].forEach((m) => m.dispose());
      const im = assets.interiorMaterials;
      [im.body, im.glass, im.lamp, assets.personMat, assets.reflectMat].forEach((m) => m.dispose());
      im.dispose();
    },
    [assets],
  );

  // Licensed GLB locomotives (see docs/ASSET_CREDITS.md). Until one has loaded
  // — or if it fails — the procedural locomotive stands in for it.
  const [glbModels, setGlbModels] = useState({});
  useEffect(() => {
    let alive = true;
    for (const id of Object.keys(LOCOMOTIVES)) {
      loadMergedModel(locoUrl(id), { forwardAxis: 'z' })
        .then((m) => alive && setGlbModels((prev) => ({ ...prev, [id]: m })))
        .catch((err) => console.warn(`${id} model failed to load, using procedural loco:`, err));
    }
    return () => {
      alive = false;
    };
  }, []);
  const allLocosLoaded = Object.keys(LOCOMOTIVES).every((id) => glbModels[id]);
  // lamps sit on each model's real nose, so the glows never float in front of the cab
  const anchors = useMemo(() => Object.fromEntries(Object.entries(glbModels).map(([id, m]) => [id, measureLampAnchors(m.parts)])), [glbModels]);
  const playerAnchors = anchors[playerLoco] ?? DEFAULT_ANCHORS;
  useLayoutEffect(() => {
    const [hx, hy, hz] = playerAnchors.head;
    setGlow(lamps.head, 0, hx, hy, hz, 2.2, '#fff6e0');
    playerAnchors.markers.forEach(([x, y, z], i) => setGlow(lamps.head, i + 1, x, y, z, 0.8, '#fff2d0'));
    lamps.head.instanceMatrix.needsUpdate = true;
    lamps.head.computeBoundingSphere();
    lamps.beam.position.set(hx + 0.1, hy - 0.05, hz);
    light.current?.position.set(hx + 0.1, hy - 0.05, hz);
  }, [playerAnchors, lamps]);

  const coachVariants = useMemo(getCoachVariants, []);

  // Inside the first coach: the interior for the chosen coach type, with
  // passengers sitting on the berths around you.
  const consist = consistFor(coachLivery);
  const playerCoachType = consist.type === 'icf' ? 'icf' : 'lhb'; // which passenger interior to build
  const lastVehicleType = consist.type; // what the X / LV board / tail lamp mount on
  const passengers = useMemo(() => {
    const c = COACH_LAYOUTS[playerCoachType];
    const rand = seededRandom(playerCoachType === 'icf' ? 71 : 72);
    const people = [];
    const seat = (x, z, yaw) => {
      const person = randomPerson(rand, rand() < 0.45 ? 'woman' : rand() < 0.15 ? 'child' : 'man');
      person.headLoad = 0;
      person.bag = 0;
      people.push({ x, y: INTERIOR_FLOOR, z, yaw, person, anim: ANIM.sit, phase: rand() });
    };
    for (let k = 0; k < c.bays; k++) {
      const xb = c.bayStart + k * c.bayPitch;
      const xf = xb + c.bayPitch;
      const mine = k === c.eye.bay;
      for (const z of [-1.1, -0.62, -0.15]) {
        // rear berth: in our bay the window seat is ours (and we keep some elbow room)
        if (mine ? z > -0.4 : rand() < 0.55) seat(xb + 0.32, z, 0);
        // the berth facing us is always occupied in our bay
        if (mine || rand() < 0.55) seat(xf - 0.32, z, Math.PI);
      }
      if (rand() < 0.6) seat(xb + 0.32, 1.12, 0);
      if (rand() < 0.5) seat(xf - 0.32, 1.12, Math.PI);
    }
    const mesh = makeCrowdMesh(people, assets.personGeo, assets.personMat);
    return mesh;
  }, [playerCoachType, assets]);
  useEffect(() => () => passengers.geometry.dispose(), [passengers]);
  useLayoutEffect(() => {
    sceneRefs.coachEye = coachEye(playerCoachType);
    sceneRefs.doorEye = doorEye(playerCoachType);
    const [tx, ty, tz] = tailLampPosition(lastVehicleType);
    setGlow(lamps.tail, 0, tx - 0.05, ty, tz, 1.1, '#ff2a1a');
    lamps.tail.instanceMatrix.needsUpdate = true;
    if (tailLampRef.current) tailLampRef.current.position.set(tx + 0.03, ty, tz);
  }, [playerCoachType, lastVehicleType, lamps]);

  // Parts to draw for each locomotive model: GLB parts if loaded, else procedural groups
  const partsByModel = useMemo(() => {
    const out = {};
    for (const id of Object.keys(LOCOMOTIVES)) {
      const glb = glbModels[id];
      out[id] = glb
        ? glb.parts.map((p, i) => ({ key: `g${i}`, geometry: p.geometry, material: p.material, shared: p.material }))
        : Object.entries(assets.loco).map(([key, geometry]) => ({ key, geometry, material: assets.locoMats[key], shared: assets.mats[key] }));
    }
    return out;
  }, [glbModels, assets]);
  const locoParts = partsByModel[playerLoco] ?? partsByModel.wap7;

  const counts = useMemo(() => {
    const coaches = vehicles.filter((v) => v.kind === 'coach');
    const lhbCoaches = coaches.filter((v) => v.type === 'lhb');
    const icfCoaches = coaches.filter((v) => v.type === 'icf');
    const boxnWagons = coaches.filter((v) => v.type === 'boxn');

    const variantCounts = {};
    for (const v of coaches) {
      v.variantKey = coachVariantKey(v.type, v.livery);
      v.variant = `${v.variantKey}${v.dynamic ? '' : '-parked'}`;
      variantCounts[v.variant] = variantCounts[v.variant] ?? 0;
      v.variantIndex = variantCounts[v.variant]++;
    }

    // Index coaches per type for extras and bogies
    const typeIdx = { lhb: 0, icf: 0, boxn: 0 };
    for (const v of coaches) v.typeIndex = typeIdx[v.type in typeIdx ? v.type : 'lhb']++;

    const locos = vehicles.filter((v) => v.kind === 'locomotive');
    const otherLocos = locos.filter((v) => !v.isPlayer);
    const modelCounts = {};
    otherLocos.forEach((v, i) => {
      v.locoIndex = i; // running gear slot (all locos share bogies/wheels)
      modelCounts[v.model] = modelCounts[v.model] ?? 0;
      v.modelIndex = modelCounts[v.model]++; // slot within this model's body meshes
    });

    return { coaches, lhbCoaches, icfCoaches, boxnWagons, locos, otherLocos, modelCounts, variantCounts };
  }, [vehicles]);

  const locoGroup = useRef();
  const cabGroup = useRef();
  const coachInteriorGroup = useRef();
  const rearEndGroup = useRef();
  const doorGroup = useRef();
  const tailLampRef = useRef();
  const exteriorGroup = useRef();
  const light = useRef();
  const refs = useRef({}); // instanced meshes by name

  const lightTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(90, 0, 0);
    return o;
  }, []);

  useLayoutEffect(() => {
    sceneRefs.locomotive = locoGroup.current;
    sceneRefs.coachInterior = coachInteriorGroup.current;
    sceneRefs.rearEnd = rearEndGroup.current;
    sceneRefs.doorway = doorGroup.current;
    light.current.target = lightTarget;
    assets.locoMats.paint.color.set(LIVERIES.wap7.paint);
    assets.locoMats.paint2.color.set(LIVERIES.wap7.paint2);
    return () => {
      sceneRefs.locomotive = null;
      sceneRefs.coachInterior = null;
      sceneRefs.rearEnd = null;
      sceneRefs.doorway = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const r = refs.current;
    for (const v of counts.otherLocos) {
      if (glbModels[v.model]) continue; // procedural stand-in: paint it
      r[`ploco_${v.model}_paint`]?.setColorAt(v.modelIndex, _c.set(LIVERIES[v.livery].paint));
      r[`ploco_${v.model}_paint2`]?.setColorAt(v.modelIndex, _c.set(LIVERIES[v.livery].paint2));
    }
    for (const id of Object.keys(LOCOMOTIVES)) for (const key of ['paint', 'paint2']) if (r[`ploco_${id}_${key}`]?.instanceColor) r[`ploco_${id}_${key}`].instanceColor.needsUpdate = true;
    updateAll(true);
  }, [partsByModel, coachVariants, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pose = {};
  const pt = {};

  function placeRunningGear(v, centerS, distance, bogieMesh, bogieIndex, wheelMesh, wheelIndex, spec, reverseHeading = false, pitch = 0) {
    if (!bogieMesh) return;
    const rp = reverseHeading ? -pitch : pitch;
    for (let b = 0; b < 2; b++) {
      const bOffset = (b === 0 ? spec.bogieSpacing / 2 : -spec.bogieSpacing / 2) * (reverseHeading ? -1 : 1);
      const bs = centerS + bOffset;
      v.line.sample(bs, pt);
      orient(_q, -pt.heading + (reverseHeading ? Math.PI : 0), rp);
      bogieMesh.setMatrixAt(bogieIndex + b, _m.compose(_p.set(pt.x, TRACK.railTop + pt.y, pt.z), _q, _one));

      if (wheelMesh) {
        spec.axleOffsets.forEach((ax, a) => {
          const axOffset = ax * (reverseHeading ? -1 : 1);
          v.line.sample(bs + axOffset, pt);
          orient(_q, -pt.heading + (reverseHeading ? Math.PI : 0), rp);
          _qs.setFromAxisAngle(_axis, (-distance / spec.wheelRadius) * (reverseHeading ? -1 : 1));
          _q.multiply(_qs);
          wheelMesh.setMatrixAt(wheelIndex + b * spec.axleOffsets.length + a, _m.compose(_p.set(pt.x, TRACK.railTop + spec.wheelRadius + pt.y, pt.z), _q, _one));
        });
      }
    }
  }

  /** Running AI locos show their headlight; parked ones only red marker lamps. Uses _m. */
  function addLocoGlows(v, idx) {
    if (idx > 60) return idx;
    const a = anchors[v.model] ?? DEFAULT_ANCHORS;
    if (v.isAi) {
      _v.set(...a.head).applyMatrix4(_m);
      setGlow(lamps.others, idx++, _v.x, _v.y, _v.z, 2.4, '#fff4dc');
    }
    for (const mk of a.markers) {
      _v.set(...mk).applyMatrix4(_m);
      setGlow(lamps.others, idx++, _v.x, _v.y, _v.z, 0.7, v.isAi ? '#fff2d0' : '#ff3b2a');
    }
    return idx;
  }

  function updateAll(includeParked) {
    const r = refs.current;
    const d = game.renderDistance;
    let coachWheelIdx = 0;
    let glowIdx = 0;
    const lit = envState.lamps > 0.02;

    for (const v of vehicles) {
      const isLoco = v.kind === 'locomotive';
      const spec = isLoco ? FORMATION.locomotive : COACH_TYPES[v.type] || COACH_TYPES.lhb;

      if (!v.dynamic && !includeParked) {
        // parked locos never move, but their marker lamps still need a glow slot
        if (isLoco && lit) {
          vehiclePose(v.line, v.centerS, spec.bogieSpacing, pose);
          orient(_q, v.reverseHeading ? pose.yaw + Math.PI : pose.yaw, v.reverseHeading ? -pose.pitch : pose.pitch);
          _m.compose(_p.set(pose.x, TRACK.railTop + pose.y, pose.z), _q, _one);
          glowIdx = addLocoGlows(v, glowIdx);
        }
        continue;
      }

      let centerS;
      let dist;

      if (v.isAi) {
        const aiTrain = game.aiTrains?.[v.aiIndex];
        const front = aiTrain ? aiTrain.front : AI_TRAINS[v.aiIndex]?.startFront ?? 0;
        centerS = front + v.offsetFromFront;
        dist = front;
      } else if (v.dynamic) {
        centerS = d - v.offset;
        dist = d;
      } else {
        centerS = v.centerS;
        dist = v.centerS;
      }

      vehiclePose(v.line, centerS, spec.bogieSpacing, pose);
      const yaw = v.reverseHeading ? pose.yaw + Math.PI : pose.yaw;
      const pitch = v.reverseHeading ? -pose.pitch : pose.pitch;
      orient(_q, yaw, pitch);
      _m.compose(_p.set(pose.x, TRACK.railTop + pose.y, pose.z), _q, _one);

      if (v.isPlayer && isLoco) {
        const g = locoGroup.current;
        g.position.set(pose.x, TRACK.railTop + pose.y, pose.z);
        g.rotation.set(0, yaw, pitch);
        g.updateMatrixWorld();
        if (r.locoBogie) placeRunningGear(v, centerS, dist, r.locoBogie, 0, r.locoWheel, 0, spec, false, pose.pitch);
      } else if (isLoco) {
        const pli = v.locoIndex;
        for (const part of partsByModel[v.model]) r[`ploco_${v.model}_${part.key}`]?.setMatrixAt(v.modelIndex, _m);
        if (lit) glowIdx = addLocoGlows(v, glowIdx);
        if (r.locoBogie) placeRunningGear(v, centerS, dist, r.locoBogie, (pli + 1) * 2, r.locoWheel, (pli + 1) * 6, spec, v.reverseHeading, pose.pitch);
      } else {
        const variantKey = v.variantKey;
        const parts = coachVariants[variantKey] || coachVariants['lhb-red'];
        parts.forEach((_, k) => r[`cv_${v.variant}_${k}`]?.setMatrixAt(v.variantIndex, _m));

        const isIcf = v.type === 'icf';
        const isBoxn = v.type === 'boxn';
        const extrasMesh = isBoxn ? null : isIcf ? r.icfCoachExtras : r.lhbCoachExtras;
        const bogieMesh = isBoxn ? r.boxnBogie : isIcf ? r.icfCoachBogie : r.lhbCoachBogie;

        extrasMesh?.setMatrixAt(v.typeIndex, _m);
        placeRunningGear(v, centerS, dist, bogieMesh, v.typeIndex * 2, r.coachWheel, coachWheelIdx * 4, spec, v.reverseHeading, pose.pitch);
        coachWheelIdx++;
      }
    }

    // Place passenger coach interior inside the first coach of the player train
    if (coachInteriorGroup.current && vehicles[1]) {
      const firstCoach = vehicles[1];
      const coachSpec = COACH_TYPES[firstCoach.type] || COACH_TYPES.lhb;
      const coachS = d - firstCoach.offset;
      vehiclePose(mainLine, coachS, coachSpec.bogieSpacing, pose);
      coachInteriorGroup.current.position.set(pose.x, TRACK.railTop + pose.y, pose.z);
      coachInteriorGroup.current.rotation.set(0, pose.yaw, pose.pitch);
      coachInteriorGroup.current.updateMatrixWorld();
    }

    // The doorway view stands at the front door of the second coach
    if (doorGroup.current && vehicles[2]) {
      const c2 = vehicles[2];
      const spec2 = COACH_TYPES[c2.type] || COACH_TYPES.lhb;
      vehiclePose(mainLine, d - c2.offset, spec2.bogieSpacing, pose);
      doorGroup.current.position.set(pose.x, TRACK.railTop + pose.y, pose.z);
      doorGroup.current.rotation.set(0, pose.yaw, pose.pitch);
      doorGroup.current.updateMatrixWorld();
    }

    // Place LV board and flashing red tail lamp on the rear wall of the player train
    if (rearEndGroup.current && vehicles[consist.count]) {
      const lastCoach = vehicles[consist.count];
      const coachSpec = COACH_TYPES[lastCoach.type] || COACH_TYPES.lhb;
      const rearS = d - (lastCoach.offset + coachSpec.length / 2);
      vehiclePose(mainLine, rearS, coachSpec.bogieSpacing, pose);
      rearEndGroup.current.position.set(pose.x, TRACK.railTop + pose.y, pose.z);
      rearEndGroup.current.rotation.set(0, pose.yaw, pose.pitch);
      rearEndGroup.current.updateMatrixWorld();
    }

    if (lit || lamps.others.count) {
      lamps.others.count = lit ? glowIdx : 0;
      lamps.others.instanceMatrix.needsUpdate = true;
      lamps.others.instanceColor.needsUpdate = true;
      lamps.others.frustumCulled = false;
    }

    for (const mesh of Object.values(r)) {
      if (!mesh || !mesh.parent) continue;
      if (!includeParked && !mesh.userData.dynamic && mesh.frustumCulled) continue;
      mesh.instanceMatrix.needsUpdate = true;
      if (includeParked || mesh.userData.dynamic) mesh.computeBoundingSphere();
    }
  }

  useFrame((state) => {
    updateAll(false);
    const mode = game.cameraMode;
    const isPlaying = game.screen !== 'title' && game.screen !== 'loading';
    const isCab = mode === 'cab' && isPlaying;
    const isInterior = mode === 'interior' && isPlaying;

    exteriorGroup.current.visible = !isCab;
    cabGroup.current.visible = isCab;
    if (coachInteriorGroup.current) coachInteriorGroup.current.visible = isInterior;
    if (doorGroup.current) doorGroup.current.visible = mode === 'door' && isPlaying;
    // retro-reflective X and LV board light up in headlights / station lights at night
    assets.reflectMat.emissiveIntensity = 0.12 + 0.55 * envState.lamps * envState.night;
    if (isInterior) {
      const u = assets.personMat.userData.uniforms;
      u.uTime.value = state.clock.elapsedTime;
      u.uFill.value = 0.3 + 0.25 * envState.night;
    }

    light.current.intensity = game.headlight ? 70 + 90 * envState.night : 0;
    assets.locoMats.lamp.emissiveIntensity = game.headlight ? 4 : 0;

    // Indian Railways tail lamp standard: 75 flashes per minute = 1.25 Hz
    const flash = Math.sin(state.clock.getElapsedTime() * 7.85) > 0.15;
    if (tailLampRef.current) tailLampRef.current.material.emissiveIntensity = flash ? 3.5 : 0.05;
    const dark = envState.lamps;
    lamps.tail.material.uniforms.uIntensity.value = flash ? 0.35 + 1.3 * dark : 0;
    const hl = game.headlight ? 1 : 0;
    lamps.head.material.uniforms.uIntensity.value = hl * (0.25 + 1.4 * dark);
    lamps.head.visible = !isCab;
    // The beam is a scattering effect: strongest in fog/rain, subtle on clear nights
    const scatter = Math.min(1, envState.night * 0.45 + (1 - envState.sunVisible) * 0.8 * (0.35 + 0.65 * dark));
    lamps.beam.material.uniforms.uIntensity.value = hl * scatter * (isCab ? 0.35 : 0.6);
    lamps.beam.visible = hl * scatter > 0.01;
  }, FRAME_PRIORITY_TRAIN);

  const register = (name, dynamic = false) => (el) => {
    if (el) {
      el.userData.dynamic = dynamic;
      el.frustumCulled = !/Bogie|Wheel/.test(name);
      refs.current[name] = el;
    } else {
      delete refs.current[name];
    }
  };

  const nLocoAll = counts.locos.length;
  const nLhb = counts.lhbCoaches.length;
  const nIcf = counts.icfCoaches.length;
  const nBoxn = counts.boxnWagons.length;
  const nCoachAll = counts.coaches.length;

  return (
    <group>
      {/* Player locomotive: regular meshes (for cab view and headlight) */}
      <group ref={locoGroup}>
        <group ref={exteriorGroup}>
          {locoParts.map((p) => (
            <mesh key={p.key} geometry={p.geometry} material={p.material} castShadow={!p.material.transparent && p.key !== 'glass'} receiveShadow />
          ))}
        </group>
        <group ref={cabGroup} visible={false}>
          {Object.entries(assets.cab).map(([key, geo]) => (
            <mesh key={key} geometry={geo} material={assets.locoMats[key] ?? assets.locoMats.body} />
          ))}
        </group>
        <spotLight ref={light} position={[10.4, 4.0, 0]} angle={0.2} penumbra={0.6} distance={320} decay={1} color="#fff6dd" />
        <primitive object={lightTarget} />
        <primitive object={lamps.head} />
        <primitive object={lamps.beam} />
      </group>

      {/* Passenger Coach Interior (visible in 'interior' camera mode) */}
      <group ref={coachInteriorGroup} visible={false}>
        {Object.entries(assets.interiors[playerCoachType]).map(([key, geo]) => (
          <mesh
            key={`${playerCoachType}${key}`}
            geometry={geo}
            material={assets.interiorMaterials[key] ?? assets.interiorMaterials.body}
            castShadow={key === 'body'}
            receiveShadow={key === 'body'}
          />
        ))}
        <primitive object={passengers} />
      </group>

      {/* Player train rear: iconic yellow 'LV' board & flashing red tail LED */}
      <group ref={doorGroup} visible={false}>
        {Object.entries(assets.doorways[playerCoachType]).map(([key, geo]) => (
          <mesh key={`${playerCoachType}${key}`} geometry={geo} material={assets.interiorMaterials.body} />
        ))}
      </group>

      <group ref={rearEndGroup}>
        {Object.entries(assets.rearEnds[lastVehicleType]).map(([key, geo]) => (
          <mesh key={`${lastVehicleType}${key}`} geometry={geo} material={key === 'reflect' ? assets.reflectMat : assets.interiorMats.body} castShadow />
        ))}
        <primitive object={lamps.tail} />
        <mesh ref={tailLampRef} position={[-0.04, 1.98, -0.8]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#ff1111" emissive="#ff1111" emissiveIntensity={3.5} roughness={0.1} />
        </mesh>
      </group>

      <primitive object={lamps.others} />

      {/* Instanced meshes for all other locomotives (AI + parked) */}
      {Object.entries(counts.modelCounts).flatMap(([model, n]) =>
        partsByModel[model].map((p) => (
          <instancedMesh key={`${model}${p.key}`} ref={register(`ploco_${model}_${p.key}`, true)} args={[p.geometry, p.shared, n]} receiveShadow />
        )),
      )}

      {/* Instanced meshes for coach body shells by variant */}
      {Object.entries(counts.variantCounts).flatMap(([variant, n]) => {
        const variantKey = variant.replace('-parked', '');
        const parts = coachVariants[variantKey] || coachVariants['lhb-red'];
        return parts.map((p, k) => (
          <instancedMesh
            key={`${variant}${k}`}
            ref={register(`cv_${variant}_${k}`, !variant.endsWith('parked'))}
            args={[p.geometry, p.material, n]}
            castShadow={!variant.endsWith('parked')}
            receiveShadow
          />
        ));
      })}

      {/* LHB coach extras (bellows, water tanks, CBC couplers) */}
      {nLhb > 0 && <instancedMesh ref={register('lhbCoachExtras', true)} args={[assets.lhbExtras, assets.mats.body, nLhb]} castShadow receiveShadow />}

      {/* ICF coach extras (buffers, screw couplers, battery boxes, brake hoses) */}
      {nIcf > 0 && <instancedMesh ref={register('icfCoachExtras', true)} args={[assets.icfExtras, assets.mats.body, nIcf]} castShadow receiveShadow />}

      {/* Bogies */}
      {nLhb > 0 && <instancedMesh ref={register('lhbCoachBogie')} args={[assets.lhbBogie, assets.mats.running, nLhb * 2]} castShadow />}
      {nIcf > 0 && <instancedMesh ref={register('icfCoachBogie')} args={[assets.icfBogie, assets.mats.running, nIcf * 2]} castShadow />}
      {nBoxn > 0 && <instancedMesh ref={register('boxnBogie')} args={[assets.icfBogie, assets.mats.running, nBoxn * 2]} castShadow />}
      <instancedMesh ref={register('locoBogie')} args={[assets.locoBogie, assets.mats.running, nLocoAll * 2]} castShadow />

      {/* Wheels */}
      {!allLocosLoaded && <instancedMesh ref={register('locoWheel')} args={[assets.locoWheel, assets.mats.running, nLocoAll * 6]} />}
      <instancedMesh ref={register('coachWheel')} args={[assets.coachWheel, assets.mats.running, nCoachAll * 4]} />
    </group>
  );
}

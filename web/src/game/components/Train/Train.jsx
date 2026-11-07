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
import { FORMATION, COACH_TYPES, LIVERIES, PARKED_TRAINS, AI_TRAINS, TRACK } from '../../config/gameConfig.js';
import { vehiclePose } from '../../simulation/routeMath.js';
import { lines, mainLine, downLine } from '../../world/trackLayout.js';
import { buildLocomotive, buildBogieFrame, buildWheelset, buildCoachExtras, buildRearEndIndicators } from '../../world/models/trainModels.js';
import { getCoachVariants, coachVariantKey } from '../../world/models/coaches.js';
import { buildCabInterior } from './CabInterior.jsx';
import { buildCoachInterior } from './CoachInterior.jsx';
import { loadMergedModel } from '../../world/models/loadGlbModel.js';

// Licensed WAP-7 model (CC-BY-4.0, see docs/ASSET_CREDITS.md). Until it has
// loaded — or if it fails — the procedural locomotive is shown instead.
const WAP7_URL = `${import.meta.env.BASE_URL}assets/models/locomotive/wap7.glb`;

export const FRAME_PRIORITY_TRAIN = -2; // after the simulation (-3), before cameras (-1)

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _up = new THREE.Vector3(0, 1, 0);
const _axis = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();

/**
 * Builds the list of all rail vehicles:
 * 1. Player train (locomotive + 8 coaches on UP main)
 * 2. Stationary parked trains at station platforms
 * 3. Dynamic AI trains operating on the DOWN main line
 */
function buildVehicleList(coachSetting) {
  const list = [];
  const playerType = coachSetting === 'icfBlue' ? 'icf' : 'lhb';
  const playerLivery = coachSetting === 'icfBlue' ? 'icfBlue' : coachSetting === 'blue' ? 'lhbBlue' : 'lhb';

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
    reverseHeading: false,
  });

  const playerSpec = COACH_TYPES[playerType] || COACH_TYPES.lhb;
  const playerGap = playerSpec.gap ?? FORMATION.couplingGap;
  let playerBack = L;
  for (let i = 0; i < FORMATION.coachCount; i++) {
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
    list.push({ kind: 'locomotive', type: 'locomotive', line, centerS: pt.frontS - L / 2, livery: 'wap7', reverseHeading: false });
    back = L;
    const ptType = pt.type || 'lhb';
    const ct = COACH_TYPES[ptType] || COACH_TYPES.lhb;
    const gap = ct.gap ?? FORMATION.couplingGap;
    for (let i = 0; i < pt.coaches; i++) {
      back += gap;
      let livery = pt.livery;
      if (livery === 'contrast') livery = playerLivery === 'lhbBlue' ? 'lhb' : 'lhbBlue';
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

  // 3. AI Trains on the DOWN main line (running towards New Delhi)
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
  const vehicles = useMemo(() => buildVehicleList(coachLivery), [coachLivery]);

  const assets = useMemo(() => {
    const loco = buildLocomotive();
    return {
      loco,
      cab: buildCabInterior(),
      coachInterior: buildCoachInterior(),
      locoBogie: buildBogieFrame('loco'),
      lhbBogie: buildBogieFrame('coach'),
      icfBogie: buildBogieFrame('icf'),
      locoWheel: buildWheelset(FORMATION.locomotive.wheelRadius),
      coachWheel: buildWheelset(COACH_TYPES.lhb.wheelRadius),
      lhbExtras: buildCoachExtras(COACH_TYPES.lhb.gap, COACH_TYPES.lhb.length, 'lhb'),
      icfExtras: buildCoachExtras(COACH_TYPES.icf.gap, COACH_TYPES.icf.length, 'icf'),
      rearEnd: buildRearEndIndicators(),
      mats: makeMaterials(),
      locoMats: makeMaterials(),
      interiorMats: makeMaterials(),
    };
  }, []);

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
        ...Object.values(assets.coachInterior),
        ...Object.values(assets.rearEnd),
      ];
      all.forEach((g) => g.dispose());
      [...Object.values(assets.mats), ...Object.values(assets.locoMats), ...Object.values(assets.interiorMats)].forEach((m) => m.dispose());
    },
    [assets],
  );

  const [glbLoco, setGlbLoco] = useState(null);
  useEffect(() => {
    let alive = true;
    loadMergedModel(WAP7_URL, { forwardAxis: 'z' })
      .then((m) => alive && setGlbLoco(m))
      .catch((err) => console.warn('WAP-7 model failed to load, using procedural loco:', err));
    return () => {
      alive = false;
    };
  }, []);

  const coachVariants = useMemo(getCoachVariants, []);

  // Parts to draw for locomotives: GLB parts if loaded, else procedural groups
  const locoParts = useMemo(
    () =>
      glbLoco
        ? glbLoco.parts.map((p, i) => ({ key: `g${i}`, geometry: p.geometry, material: p.material, shared: p.material }))
        : Object.entries(assets.loco).map(([key, geometry]) => ({ key, geometry, material: assets.locoMats[key], shared: assets.mats[key] })),
    [glbLoco, assets],
  );

  const counts = useMemo(() => {
    const coaches = vehicles.filter((v) => v.kind === 'coach');
    const lhbCoaches = coaches.filter((v) => v.type === 'lhb');
    const icfCoaches = coaches.filter((v) => v.type === 'icf');

    const variantCounts = {};
    for (const v of coaches) {
      v.variantKey = coachVariantKey(v.type, v.livery);
      v.variant = `${v.variantKey}${v.dynamic ? '' : '-parked'}`;
      variantCounts[v.variant] = variantCounts[v.variant] ?? 0;
      v.variantIndex = variantCounts[v.variant]++;
    }

    // Index coaches per type for extras and bogies
    let lhbIdx = 0;
    let icfIdx = 0;
    for (const v of coaches) {
      if (v.type === 'icf') v.typeIndex = icfIdx++;
      else v.typeIndex = lhbIdx++;
    }

    const locos = vehicles.filter((v) => v.kind === 'locomotive');
    const otherLocos = locos.filter((v) => !v.isPlayer);
    otherLocos.forEach((v, i) => {
      v.locoIndex = i;
    });

    return { coaches, lhbCoaches, icfCoaches, locos, otherLocos, variantCounts };
  }, [vehicles]);

  const locoGroup = useRef();
  const cabGroup = useRef();
  const coachInteriorGroup = useRef();
  const rearEndGroup = useRef();
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
    light.current.target = lightTarget;
    assets.locoMats.paint.color.set(LIVERIES.wap7.paint);
    assets.locoMats.paint2.color.set(LIVERIES.wap7.paint2);
    return () => {
      sceneRefs.locomotive = null;
      sceneRefs.coachInterior = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const r = refs.current;
    if (!glbLoco) {
      counts.otherLocos.forEach((v, i) => {
        r.ploco_paint?.setColorAt(i, _c.set(LIVERIES[v.livery].paint));
        r.ploco_paint2?.setColorAt(i, _c.set(LIVERIES[v.livery].paint2));
      });
      for (const key of ['ploco_paint', 'ploco_paint2']) if (r[key]?.instanceColor) r[key].instanceColor.needsUpdate = true;
    }
    updateAll(true);
  }, [locoParts, coachVariants, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pose = {};
  const pt = {};

  function placeRunningGear(v, centerS, distance, bogieMesh, bogieIndex, wheelMesh, wheelIndex, spec, reverseHeading = false) {
    if (!bogieMesh) return;
    for (let b = 0; b < 2; b++) {
      const bOffset = (b === 0 ? spec.bogieSpacing / 2 : -spec.bogieSpacing / 2) * (reverseHeading ? -1 : 1);
      const bs = centerS + bOffset;
      v.line.sample(bs, pt);
      _q.setFromAxisAngle(_up, -pt.heading + (reverseHeading ? Math.PI : 0));
      bogieMesh.setMatrixAt(bogieIndex + b, _m.compose(_p.set(pt.x, TRACK.railTop, pt.z), _q, _one));

      if (wheelMesh) {
        spec.axleOffsets.forEach((ax, a) => {
          const axOffset = ax * (reverseHeading ? -1 : 1);
          v.line.sample(bs + axOffset, pt);
          _q.setFromAxisAngle(_up, -pt.heading + (reverseHeading ? Math.PI : 0));
          _qs.setFromAxisAngle(_axis, (-distance / spec.wheelRadius) * (reverseHeading ? -1 : 1));
          _q.multiply(_qs);
          wheelMesh.setMatrixAt(wheelIndex + b * spec.axleOffsets.length + a, _m.compose(_p.set(pt.x, TRACK.railTop + spec.wheelRadius, pt.z), _q, _one));
        });
      }
    }
  }

  function updateAll(includeParked) {
    const r = refs.current;
    const d = game.renderDistance;
    let coachWheelIdx = 0;

    for (const v of vehicles) {
      const isLoco = v.kind === 'locomotive';
      const spec = isLoco ? FORMATION.locomotive : COACH_TYPES[v.type] || COACH_TYPES.lhb;

      if (!v.dynamic && !includeParked) continue;

      let centerS;
      let dist;

      if (v.isAi) {
        const aiTrain = game.aiTrains?.[v.aiIndex];
        const front = aiTrain ? aiTrain.front : 7880;
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
      _q.setFromAxisAngle(_up, yaw);
      _m.compose(_p.set(pose.x, TRACK.railTop, pose.z), _q, _one);

      if (v.isPlayer && isLoco) {
        const g = locoGroup.current;
        g.position.set(pose.x, TRACK.railTop, pose.z);
        g.rotation.set(0, yaw, 0);
        g.updateMatrixWorld();
        if (r.locoBogie) placeRunningGear(v, centerS, dist, r.locoBogie, 0, r.locoWheel, 0, spec, false);
      } else if (isLoco) {
        const pli = v.locoIndex;
        for (const part of locoParts) r[`ploco_${part.key}`]?.setMatrixAt(pli, _m);
        if (r.locoBogie) placeRunningGear(v, centerS, dist, r.locoBogie, (pli + 1) * 2, r.locoWheel, (pli + 1) * 6, spec, v.reverseHeading);
      } else {
        const variantKey = v.variantKey;
        const parts = coachVariants[variantKey] || coachVariants['lhb-red'];
        parts.forEach((_, k) => r[`cv_${v.variant}_${k}`]?.setMatrixAt(v.variantIndex, _m));

        const isIcf = v.type === 'icf';
        const extrasMesh = isIcf ? r.icfCoachExtras : r.lhbCoachExtras;
        const bogieMesh = isIcf ? r.icfCoachBogie : r.lhbCoachBogie;

        extrasMesh?.setMatrixAt(v.typeIndex, _m);
        placeRunningGear(v, centerS, dist, bogieMesh, v.typeIndex * 2, r.coachWheel, coachWheelIdx * 4, spec, v.reverseHeading);
        coachWheelIdx++;
      }
    }

    // Place passenger coach interior inside the first coach of the player train
    if (coachInteriorGroup.current && vehicles[1]) {
      const firstCoach = vehicles[1];
      const coachSpec = COACH_TYPES[firstCoach.type] || COACH_TYPES.lhb;
      const coachS = d - firstCoach.offset;
      vehiclePose(mainLine, coachS, coachSpec.bogieSpacing, pose);
      coachInteriorGroup.current.position.set(pose.x, TRACK.railTop, pose.z);
      coachInteriorGroup.current.rotation.set(0, pose.yaw, 0);
      coachInteriorGroup.current.updateMatrixWorld();
    }

    // Place LV board and flashing red tail lamp on the rear wall of the player train
    if (rearEndGroup.current && vehicles[FORMATION.coachCount]) {
      const lastCoach = vehicles[FORMATION.coachCount];
      const coachSpec = COACH_TYPES[lastCoach.type] || COACH_TYPES.lhb;
      const rearS = d - (lastCoach.offset + coachSpec.length / 2);
      vehiclePose(mainLine, rearS, coachSpec.bogieSpacing, pose);
      rearEndGroup.current.position.set(pose.x, TRACK.railTop, pose.z);
      rearEndGroup.current.rotation.set(0, pose.yaw, 0);
      rearEndGroup.current.updateMatrixWorld();
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

    light.current.intensity = game.headlight ? 80 : 0;
    assets.locoMats.lamp.emissiveIntensity = game.headlight ? 4 : 0;

    if (tailLampRef.current) {
      // Indian Railways tail lamp standard: 75 flashes per minute = 1.25 Hz
      const flash = Math.sin(state.clock.getElapsedTime() * 7.85) > 0.15;
      tailLampRef.current.material.emissiveIntensity = flash ? 3.5 : 0.05;
    }
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
  const nOtherLocos = counts.otherLocos.length;
  const nLhb = counts.lhbCoaches.length;
  const nIcf = counts.icfCoaches.length;
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
      </group>

      {/* Passenger Coach Interior (visible in 'interior' camera mode) */}
      <group ref={coachInteriorGroup} visible={false}>
        {Object.entries(assets.coachInterior).map(([key, geo]) => (
          <mesh key={key} geometry={geo} material={assets.interiorMats[key] ?? assets.interiorMats.body} />
        ))}
      </group>

      {/* Player train rear: iconic yellow 'LV' board & flashing red tail LED */}
      <group ref={rearEndGroup}>
        {Object.entries(assets.rearEnd).map(([key, geo]) => (
          <mesh key={key} geometry={geo} material={assets.interiorMats[key] ?? assets.interiorMats.body} />
        ))}
        <mesh ref={tailLampRef} position={[-0.04, 1.98, -0.8]}>
          <sphereGeometry args={[0.045, 12, 12]} />
          <meshStandardMaterial color="#ff1111" emissive="#ff1111" emissiveIntensity={3.5} roughness={0.1} />
        </mesh>
      </group>

      {/* Instanced meshes for all other locomotives (AI + parked) */}
      {nOtherLocos > 0 &&
        locoParts.map((p) => (
          <instancedMesh key={p.key} ref={register(`ploco_${p.key}`, true)} args={[p.geometry, p.shared, nOtherLocos]} receiveShadow />
        ))}

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
      <instancedMesh ref={register('locoBogie')} args={[assets.locoBogie, assets.mats.running, nLocoAll * 2]} castShadow />

      {/* Wheels */}
      {!glbLoco && <instancedMesh ref={register('locoWheel')} args={[assets.locoWheel, assets.mats.running, nLocoAll * 6]} />}
      <instancedMesh ref={register('coachWheel')} args={[assets.coachWheel, assets.mats.running, nCoachAll * 4]} />
    </group>
  );
}

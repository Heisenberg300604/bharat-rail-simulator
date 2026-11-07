// Draws every rail vehicle in the world: our train (WAP-7 + 8 LHB coaches)
// and the stationary trains at other platforms.
//
// Performance design:
// - Each model is merged into one geometry per material (see ModelBuilder).
// - All coaches share ONE InstancedMesh per material, all bogies one, all
//   wheelsets one → the whole consist is ~15 draw calls, independent of length.
// - Bogies and wheelsets are placed at their OWN position on the rails, so on
//   curves the wheels stay on the track while the body forms a chord.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game, formation, useGameValue } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { FORMATION, LIVERIES, PARKED_TRAINS, TRACK } from '../../config/gameConfig.js';
import { vehiclePose } from '../../simulation/routeMath.js';
import { lines, mainLine } from '../../world/trackLayout.js';
import { buildLocomotive, buildBogieFrame, buildWheelset, buildCoachExtras } from '../../world/models/trainModels.js';
import { getLhbCoachVariants } from '../../world/models/lhbCoach.js';
import { buildCabInterior } from './CabInterior.jsx';
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

/** Every vehicle: { kind, line, centerS (fn or number), dynamic, livery } */
function buildVehicleList(playerLivery) {
  const list = [];
  for (const v of formation.vehicles) {
    list.push({ kind: v.kind, line: mainLine, offset: v.centerOffset, dynamic: true, livery: v.kind === 'locomotive' ? 'wap7' : playerLivery });
  }
  for (const pt of PARKED_TRAINS) {
    const line = lines.find((l) => l.id === pt.line);
    if (!line) continue;
    let back = 0;
    const L = FORMATION.locomotive.length;
    list.push({ kind: 'locomotive', line, centerS: pt.frontS - L / 2, livery: 'wap7' });
    back = L;
    for (let i = 0; i < pt.coaches; i++) {
      back += FORMATION.couplingGap;
      const livery = pt.livery === 'contrast' ? (playerLivery === 'lhbBlue' ? 'lhb' : 'lhbBlue') : pt.livery;
      list.push({ kind: 'coach', line, centerS: pt.frontS - back - FORMATION.coach.length / 2, livery });
      back += FORMATION.coach.length;
    }
  }
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
  const vehicles = useMemo(() => buildVehicleList(coachLivery === 'blue' ? 'lhbBlue' : 'lhb'), [coachLivery]);
  const assets = useMemo(() => {
    const loco = buildLocomotive();
    return {
      loco,
      cab: buildCabInterior(),
      locoBogie: buildBogieFrame('loco'),
      coachBogie: buildBogieFrame('coach'),
      locoWheel: buildWheelset(FORMATION.locomotive.wheelRadius),
      coachWheel: buildWheelset(FORMATION.coach.wheelRadius),
      coachExtras: buildCoachExtras(FORMATION.couplingGap),
      mats: makeMaterials(),
      // the moving loco gets its own material copies so its headlight can switch on
      locoMats: makeMaterials(),
    };
  }, []);
  useEffect(
    () => () => {
      const all = [assets.coachExtras, assets.locoBogie, assets.coachBogie, assets.locoWheel, assets.coachWheel, ...Object.values(assets.loco), ...Object.values(assets.cab)];
      all.forEach((g) => g.dispose());
      [...Object.values(assets.mats), ...Object.values(assets.locoMats)].forEach((m) => m.dispose());
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
  // LHB coaches: built to real dimensions, red-grey and blue-grey liveries
  const coachVariants = useMemo(getLhbCoachVariants, []);

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
    // Group coaches by livery AND by moving/parked, so each group gets a tight
    // bounding sphere (for culling) and parked rakes can skip shadow casting.
    const variantCounts = {};
    for (const v of coaches) {
      v.colour = v.livery === 'lhbBlue' ? 'blue' : 'red';
      v.variant = `${v.colour}${v.dynamic ? '' : '-parked'}`;
      variantCounts[v.variant] = variantCounts[v.variant] ?? 0;
      v.variantIndex = variantCounts[v.variant]++;
    }
    const locos = vehicles.filter((v) => v.kind === 'locomotive');
    return { coaches, locos, parkedLocos: locos.filter((v) => !v.dynamic), variantCounts };
  }, [vehicles]);

  const locoGroup = useRef();
  const cabGroup = useRef();
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
    light.current.target = lightTarget;
    // Fallback (procedural) loco livery; coach liveries live in their own materials
    assets.locoMats.paint.color.set(LIVERIES.wap7.paint);
    assets.locoMats.paint2.color.set(LIVERIES.wap7.paint2);
    return () => {
      sceneRefs.locomotive = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // (Re)place parked vehicles and set parked-loco livery whenever the loco parts change
  useLayoutEffect(() => {
    const r = refs.current;
    if (!glbLoco) {
      counts.parkedLocos.forEach((v, i) => {
        r.ploco_paint?.setColorAt(i, _c.set(LIVERIES[v.livery].paint));
        r.ploco_paint2?.setColorAt(i, _c.set(LIVERIES[v.livery].paint2));
      });
      for (const key of ['ploco_paint', 'ploco_paint2']) if (r[key]?.instanceColor) r[key].instanceColor.needsUpdate = true;
    }
    updateAll(true);
  }, [locoParts, coachVariants, counts]); // eslint-disable-line react-hooks/exhaustive-deps

  const pose = {};
  const pt = {};
  function placeRunningGear(v, centerS, distance, bogieMesh, bogieIndex, wheelMesh, wheelIndex, spec) {
    for (let b = 0; b < 2; b++) {
      const bs = centerS + (b === 0 ? spec.bogieSpacing / 2 : -spec.bogieSpacing / 2);
      v.line.sample(bs, pt);
      _q.setFromAxisAngle(_up, -pt.heading);
      bogieMesh.setMatrixAt(bogieIndex + b, _m.compose(_p.set(pt.x, TRACK.railTop, pt.z), _q, _one));
      spec.axleOffsets.forEach((ax, a) => {
        v.line.sample(bs + ax, pt);
        _q.setFromAxisAngle(_up, -pt.heading);
        _qs.setFromAxisAngle(_axis, -distance / spec.wheelRadius);
        _q.multiply(_qs);
        wheelMesh.setMatrixAt(wheelIndex + b * spec.axleOffsets.length + a, _m.compose(_p.set(pt.x, TRACK.railTop + spec.wheelRadius, pt.z), _q, _one));
      });
    }
  }

  function updateAll(includeParked) {
    const r = refs.current;
    const d = game.renderDistance;
    let ci = 0;
    let pli = 0;
    for (const v of vehicles) {
      const isLoco = v.kind === 'locomotive';
      const spec = isLoco ? FORMATION.locomotive : FORMATION.coach;
      if (!v.dynamic && !includeParked) {
        if (isLoco) pli++;
        else ci++;
        continue;
      }
      const centerS = v.dynamic ? d - v.offset : v.centerS;
      const dist = v.dynamic ? d : v.centerS;
      vehiclePose(v.line, centerS, spec.bogieSpacing, pose);
      _q.setFromAxisAngle(_up, pose.yaw);
      _m.compose(_p.set(pose.x, TRACK.railTop, pose.z), _q, _one);
      if (isLoco && v.dynamic) {
        const g = locoGroup.current;
        g.position.set(pose.x, TRACK.railTop, pose.z);
        g.rotation.set(0, pose.yaw, 0);
        g.updateMatrixWorld(); // cameras read this matrix in the same frame
        if (r.locoBogie) placeRunningGear(v, centerS, dist, r.locoBogie, 0, r.locoWheel, 0, spec);
      } else if (isLoco) {
        for (const part of locoParts) r[`ploco_${part.key}`]?.setMatrixAt(pli, _m);
        if (r.locoBogie) placeRunningGear(v, centerS, dist, r.locoBogie, (pli + 1) * 2, r.locoWheel, (pli + 1) * 6, spec);
        pli++;
      } else {
        coachVariants[v.colour].forEach((_, k) => r[`cv_${v.variant}_${k}`]?.setMatrixAt(v.variantIndex, _m));
        r.coachExtras?.setMatrixAt(ci, _m);
        placeRunningGear(v, centerS, dist, r.coachBogie, ci * 2, r.coachWheel, ci * 4, spec);
        ci++;
      }
    }
    for (const mesh of Object.values(r)) {
      if (!mesh.parent) continue; // unmounted (e.g. procedural parts after GLB swap)
      if (!includeParked && !mesh.userData.dynamic && mesh.frustumCulled) continue; // parked: nothing changed
      mesh.instanceMatrix.needsUpdate = true;
      if (includeParked || mesh.userData.dynamic) mesh.computeBoundingSphere();
    }
  }

  useFrame(() => {
    updateAll(false);
    const cab = game.cameraMode === 'cab' && game.screen !== 'title' && game.screen !== 'loading';
    exteriorGroup.current.visible = !cab;
    cabGroup.current.visible = cab;
    light.current.intensity = game.headlight ? 80 : 0;
    assets.locoMats.lamp.emissiveIntensity = game.headlight ? 4 : 0;
  }, FRAME_PRIORITY_TRAIN);

  // `dynamic` meshes move every frame: their bounding sphere is recomputed each
  // frame so the GPU can skip them when off-screen (and in the shadow pass).
  // Bogies/wheels mix moving and parked vehicles, so they are never culled.
  const register = (name, dynamic = false) => (el) => {
    if (el) {
      el.userData.dynamic = dynamic;
      el.frustumCulled = !/Bogie|Wheel/.test(name);
      refs.current[name] = el;
    } else {
      delete refs.current[name];
    }
  };
  const nCoach = counts.coaches.length;
  const nLocoAll = counts.locos.length;
  const nParkedLoco = counts.parkedLocos.length;

  return (
    <group>
      {/* our locomotive: regular meshes (needed for the cab view and headlight) */}
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

      {nParkedLoco > 0 &&
        locoParts.map((p) => (
          <instancedMesh key={p.key} ref={register(`ploco_${p.key}`)} args={[p.geometry, p.shared, nParkedLoco]} receiveShadow />
        ))}
      {Object.entries(counts.variantCounts).flatMap(([variant, n]) =>
        coachVariants[variant.split('-')[0]].map((p, k) => (
          <instancedMesh
            key={`${variant}${k}`}
            ref={register(`cv_${variant}_${k}`, !variant.endsWith('parked'))}
            args={[p.geometry, p.material, n]}
            castShadow={!variant.endsWith('parked')}
            receiveShadow
          />
        )),
      )}
      <instancedMesh ref={register('coachExtras', true)} args={[assets.coachExtras, assets.mats.body, nCoach]} castShadow receiveShadow />
      <instancedMesh ref={register('coachBogie')} args={[assets.coachBogie, assets.mats.running, nCoach * 2]} castShadow />
      {!glbLoco && <instancedMesh ref={register('locoWheel')} args={[assets.locoWheel, assets.mats.running, nLocoAll * 6]} />}
      <instancedMesh ref={register('coachWheel')} args={[assets.coachWheel, assets.mats.running, nCoach * 4]} />
    </group>
  );
}

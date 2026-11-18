// Derailment site (Incidents → "Derailment site", simulation/incidents.js):
// a loop line laid beside the running line, on which a blue ICF passenger
// rake has derailed. The front coaches still stand on the rails; five coaches
// are off the track — one on its side, one jack-knifed. The Accident Relief
// Train's breakdown crane is lifting a coach, staff in orange work round it,
// officials and the RPF stand by, the evacuated passengers wait clear of the
// line with their bags, and floodlights light the site at night. No injuries
// are depicted. Everything is original procedural geometry (the coaches are
// the game's own ICF model) — about 8 draw calls, only while within 2.5 km.
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { game, useGameValue } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { mainLine } from '../../world/trackLayout.js';
import { terrain } from '../../world/terrain.js';
import { TRACK, COACH_TYPES } from '../../config/gameConfig.js';
import { buildRibbonGeometry, seededRandom } from '../../world/geometry.js';
import { onRoad } from '../../world/roadLayout.js';
import { makeBallastTexture } from '../../world/textures.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { getCoachVariants } from '../../world/models/coaches.js';
import { buildBogieFrame, buildWheelset } from '../../world/models/trainModels.js';
import { buildPersonGeometry, createPeopleMaterial, makeCrowdMesh, randomPerson, ANIM } from '../../world/models/people.js';
import { createGlowMaterial, makeGlowMesh, disposeGlowMaterial } from '../../world/glow.js';

const ICF = COACH_TYPES.icf;
const PITCH = ICF.length + ICF.gap;
const HALF = TRACK.gauge / 2;
const ORANGE = '#f26b1d';
const _p = {};
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);

/** World matrix for a thing at (s, lat) on the loop: yaw/roll/pitch relative to the line, dy above rail top. */
function matrixAt(s, lat, dy, yaw = 0, roll = 0, pitch = 0) {
  mainLine.sample(s, _p);
  const qYaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -_p.heading + yaw);
  const qRoll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), roll);
  const qPitch = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), pitch);
  _q.copy(qYaw).multiply(qPitch).multiply(qRoll);
  _v.set(_p.x + _p.lx * lat, (_p.y ?? 0) + TRACK.railTop + dy, _p.z + _p.lz * lat);
  return new THREE.Matrix4().compose(_v, _q, _one);
}

function buildSite(site) {
  const rand = seededRandom(site.seed || 7);
  const L = site.lat;
  const c = site.s;
  /** The first lateral offset from `prefs` (then further out) that keeps r metres off every road. */
  const offRoad = (s, prefs, r = 3) => {
    for (const lat of [...prefs, ...prefs.map((x) => x + 30), ...prefs.map((x) => x + 60)]) if (!onRoad(s, lat, r, 1)) return lat;
    return prefs[0] + 90;
  };
  const variants = getCoachVariants();
  const parts = variants['icf-blue'];

  // ---- the loop line: ballast and sleepers along its whole length, rails except where torn up
  const torn = [c - 2.2 * PITCH, c + 3.3 * PITCH];
  const ballast = buildRibbonGeometry(
    mainLine,
    [
      [L + 3.0, 0],
      [L + 1.85, TRACK.ballastTop - 0.03],
      [L - 1.85, TRACK.ballastTop - 0.03],
      [L - 3.0, 0],
    ],
    { from: site.from, to: site.to, step: 5, uvScale: 3 },
  );
  const railProfile = (x) => [
    [x + 0.045, TRACK.sleeperTop],
    [x + 0.032, TRACK.railTop],
    [x - 0.032, TRACK.railTop],
    [x - 0.045, TRACK.sleeperTop],
  ];
  const rails = [];
  for (const [a, b] of [
    [site.from, torn[0]],
    [torn[1], site.to],
  ]) {
    for (const x of [L + HALF, L - HALF]) rails.push(buildRibbonGeometry(mainLine, railProfile(x), { from: a, to: b, step: 3 }));
  }

  // sleepers: in line, then thrown about where the coaches went over
  const sleepers = [];
  for (let s = site.from + 0.4; s < site.to; s += TRACK.sleeperSpacing) {
    const inTorn = s > torn[0] && s < torn[1];
    if (inTorn && rand() < 0.25) continue;
    const yaw = inTorn ? (rand() - 0.5) * 0.9 : 0;
    const dl = inTorn ? (rand() - 0.3) * 2.5 : 0;
    sleepers.push(matrixAt(s, L + dl, TRACK.sleeperTop - 0.1 - TRACK.railTop - (inTorn ? 0.05 : 0), yaw, inTorn ? (rand() - 0.5) * 0.3 : 0));
  }

  // ---- the coaches: per material, all copies merged
  const poses = [
    // [index along the rake, lat offset, drop, yaw, roll, derailed?]
    [0, 0, 0, 0, 0, false],
    [1, 0, 0, 0, 0, false],
    [2, 0.35, -0.22, 0.03, 0.04, true],
    [3, 2.6, -0.55, 0.2, -0.13, true],
    [4, 6.6, -0.7, 0.32, -1.52, true], // on its side, fallen away from the running line
    [5, 3.6, -0.45, -0.42, -0.22, true], // jack-knifed
    [6, 1.0, 1.4, -0.12, 0.05, true], // being lifted by the crane
  ];
  const perPart = parts.map(() => []);
  const gear = [];
  const bogieGeo = buildBogieFrame('icf');
  const wheelGeo = buildWheelset(ICF.wheelRadius);
  const lifted = { s: 0, lat: 0 };
  for (const [i, dl, dy, yaw, roll, derailed] of poses) {
    const s = c + (i - 3) * PITCH;
    const m = matrixAt(s, L + dl, dy, yaw, roll);
    parts.forEach((part, k) => perPart[k].push(part.geometry.clone().applyMatrix4(m)));
    if (i === 6) {
      lifted.s = s;
      lifted.lat = L + dl;
    }
    for (const e of [-1, 1]) {
      const bx = (e * ICF.bogieSpacing) / 2;
      let bm;
      if (!derailed || (i === 2 && e > 0)) bm = matrixAt(s + bx, L + dl, 0, yaw, 0);
      else if (i === 4) bm = matrixAt(s + bx * 0.9, L + dl + 3.4, -0.2, yaw + 0.3 * e, -1.4); // torn off, lying on its side
      else bm = matrixAt(s + bx * 0.95, L + dl + (rand() - 0.5) * 1.4, -0.35, yaw + (rand() - 0.5) * 0.5, (rand() - 0.5) * 0.25);
      if (i === 6) bm = matrixAt(s + bx, L + dl - 0.3, -0.25, yaw + 0.1 * e, 0); // the bogies stay on the ground
      gear.push(bogieGeo.clone().applyMatrix4(bm));
      for (const ax of ICF.axleOffsets) {
        const wm = new THREE.Matrix4().makeTranslation(ax, ICF.wheelRadius, 0);
        gear.push(wheelGeo.clone().applyMatrix4(bm.clone().multiply(wm)));
      }
    }
  }
  bogieGeo.dispose();
  wheelGeo.dispose();

  // ---- the breakdown crane, the relief train, tents, jeeps, flags, floodlights, debris
  const b = new ModelBuilder();
  const at = (s, lat, dy, yaw = 0, roll = 0) => matrixAt(s, lat, dy, yaw, roll);
  const craneS = c + 4.4 * PITCH;
  {
    const m = at(craneS, L, 0);
    const Y = '#e8b21c';
    const K = '#1f1f1f';
    b.box([-7, 7], [1.0, 2.0], [-1.45, 1.45], Y, { matrix: m }); // carriage
    for (let x = -7; x < 7; x += 1.4) b.box([x, x + 0.7], [1.0, 2.0], [-1.47, -1.45], K, { matrix: m }); // hazard stripes
    for (const x of [-4.8, 4.8]) b.box([-1.6 + x, 1.6 + x], [0.45, 1.0], [-1.1, 1.1], '#2a2c2f', { matrix: m }); // bogies
    b.cylinder({ radius: 1.7, length: 0.4, position: [-1, 2.2, 0], color: '#3a3a3a', matrix: m }); // slewing ring
    b.box([-4.2, 1.6], [2.4, 5.4], [-1.55, 1.55], Y, { matrix: m }); // superstructure
    b.box([-1.0, 1.6], [3.2, 5.0], [-1.6, -1.2], '#2b3a44', { matrix: m }); // cab glass
    b.box([-6.2, -4.2], [2.4, 4.6], [-1.5, 1.5], '#3b3b3b', { matrix: m }); // counterweight
    for (const x of [-7, 7]) for (const z of [-1, 1]) b.box([x - 0.25, x + 0.25], [0.2, 1.1], [z * 2.6 - 0.25, z * 2.6 + 0.25], K, { matrix: m }); // outrigger pads
    for (const x of [-7, 7]) b.box([x - 0.2, x + 0.2], [0.9, 1.1], [-2.6, 2.6], Y, { matrix: m }); // outrigger beams
    // boom: two lattice chords rising towards the lifted coach
    const boomBase = new THREE.Vector3(1.6, 4.2, 0).applyMatrix4(m);
    mainLine.sample(lifted.s, _p);
    const tip = new THREE.Vector3(_p.x + _p.lx * (lifted.lat - 0.4), (_p.y ?? 0) + TRACK.railTop + 13.5, _p.z + _p.lz * (lifted.lat - 0.4));
    const dir = tip.clone().sub(boomBase);
    const len = dir.length();
    const mid = boomBase.clone().add(tip).multiplyScalar(0.5);
    const qb = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
    for (const z of [-0.55, 0.55]) {
      const mm = new THREE.Matrix4().compose(mid, qb, _one).multiply(new THREE.Matrix4().makeTranslation(0, 0, z));
      b.box([-len / 2, len / 2], [-0.25, 0.25], [-0.12, 0.12], Y, { matrix: mm });
      for (let x = -len / 2; x < len / 2 - 1; x += 1.6) b.box([x, x + 0.12], [-0.25, 0.25], [-0.55, 0.55], Y, { matrix: new THREE.Matrix4().compose(mid, qb, _one) });
    }
    // hook block and slings down to the coach roof
    const hook = tip.clone();
    hook.y -= 6.5;
    const cable = (a, z, t) => {
      const d = z.clone().sub(a);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
      b.box([-t, t], [-d.length() / 2, d.length() / 2], [-t, t], '#222', { matrix: new THREE.Matrix4().compose(a.clone().add(z).multiplyScalar(0.5), q, _one) });
    };
    cable(tip, hook, 0.04);
    b.box([-0.3, 0.3], [-0.5, 0.3], [-0.3, 0.3], Y, { matrix: new THREE.Matrix4().makeTranslation(hook.x, hook.y, hook.z) });
    mainLine.sample(lifted.s, _p);
    for (const e of [-1, 1]) {
      const end = new THREE.Vector3(_p.x + _p.lx * lifted.lat + Math.cos(_p.heading) * e * 6, (_p.y ?? 0) + TRACK.railTop + 1.4 + 3.9, _p.z + _p.lz * lifted.lat + Math.sin(_p.heading) * e * 6);
      cable(hook, end, 0.03);
    }
    // relief train vans behind the crane
    for (let k = 0; k < 2; k++) {
      const mv = at(craneS + 12 + k * PITCH * 0.95, L, 0);
      b.box([-10, 10], [1.1, 3.9], [-1.5, 1.5], '#d9c26a', { matrix: mv });
      b.box([-10, 10], [2.2, 2.5], [-1.52, 1.52], '#b3261e', { matrix: mv }); // red band
      b.box([-10.1, 10.1], [3.9, 4.2], [-1.4, 1.4], '#8f8a80', { matrix: mv });
      for (const x of [-7.2, 7.2]) b.box([x - 1.6, x + 1.6], [0.45, 1.1], [-1.1, 1.1], '#2a2c2f', { matrix: mv });
      for (let x = -8; x <= 8; x += 2.6) b.box([x - 0.5, x + 0.5], [2.65, 3.35], [-1.53, 1.53], '#2b3036', { matrix: mv });
    }
  }
  // twisted rails and broken track in the torn section
  for (let k = 0; k < 7; k++) {
    const s = torn[0] + rand() * (torn[1] - torn[0]);
    const m = at(s, L + (rand() - 0.5) * 4, -0.45, (rand() - 0.5) * 0.9, 0, (rand() - 0.5) * 0.25);
    b.box([-6.5, 6.5], [0, 0.16], [-0.04, 0.04], '#5e5650', { matrix: m });
  }
  // ballast thrown up, broken glass and luggage near the wreck
  for (let k = 0; k < 14; k++) {
    const s = torn[0] + rand() * (torn[1] - torn[0]);
    b.add(new THREE.IcosahedronGeometry(1, 0), { color: '#8b8579', matrix: at(s, L + 1 + rand() * 6, -0.5, rand() * 6), scale: [0.6 + rand() * 0.8, 0.18 + rand() * 0.15, 0.5 + rand() * 0.7] });
  }
  // the control tent, an ART tool tent and a first-aid post's table (empty), all blue tarpaulin
  for (const [ds, lat0, w] of [
    [-1.2 * PITCH, 15.2, 7],
    [1.0 * PITCH, 15.2, 9],
    [2.2 * PITCH, 15.2, 5],
  ]) {
    const lat = offRoad(c + ds, [lat0], w / 2 + 1);
    const m = at(c + ds, lat, terrainDy(c + ds, lat));
    for (const x of [-w / 2, w / 2]) for (const z of [-2, 2]) b.box([x - 0.05, x + 0.05], [0, 2.6], [z - 0.05, z + 0.05], '#999', { matrix: m });
    b.add(new THREE.BoxGeometry(w + 0.6, 0.05, 4.8), { color: '#2f6db3', matrix: m, position: [0, 2.75, 0], rotation: [0.12, 0, 0] });
    b.box([-1.2, 1.2], [0.75, 0.8], [-0.5, 0.5], '#e9e4d8', { matrix: m });
  }
  // railway jeeps and an RPF vehicle on the cess
  for (const [ds, col] of [
    [-2.1 * PITCH, '#f2f2ee'],
    [-1.6 * PITCH, '#f2f2ee'],
    [0.3 * PITCH, '#3c4f6b'],
  ]) {
    const lat = offRoad(c + ds, [16.3 + rand() * 0.8, 26 + rand() * 3], 2.5);
    const m = at(c + ds, lat, terrainDy(c + ds, lat), Math.PI / 2 + (rand() - 0.5) * 0.4);
    b.box([-2, 2], [0.5, 1.5], [-0.85, 0.85], col, { matrix: m });
    b.box([-1.2, 1.4], [1.5, 2.1], [-0.82, 0.82], col, { matrix: m });
    b.box([-1.15, 1.35], [1.55, 2.0], [-0.84, 0.84], '#2b3036', { matrix: m });
    for (const x of [-1.3, 1.3]) for (const z of [-0.85, 0.85]) b.cylinder({ radius: 0.36, length: 0.25, axis: 'z', position: [x, 0.36, z], color: '#161616', matrix: m });
    b.box([-0.2, 0.2], [2.1, 2.25], [-0.3, 0.3], '#d32f2f', { matrix: m }); // beacon
  }
  // red danger flags protecting the loop at both ends of the obstruction
  for (const ds of [-3.6 * PITCH, 4.4 * PITCH + 2 * PITCH]) {
    const m = at(c + ds, L, -0.1);
    b.box([-0.03, 0.03], [0, 1.6], [-0.03, 0.03], '#6b4a2e', { matrix: m });
    b.box([0.03, 0.6], [1.15, 1.6], [-0.01, 0.01], '#d50000', { matrix: m });
  }
  // portable floodlight towers
  const lamps = [];
  for (const [ds, lat0] of [
    [-1.6 * PITCH, 13.8],
    [0.6 * PITCH, 13.8],
    [2.6 * PITCH, 13.8],
  ]) {
    const lat = offRoad(c + ds, [lat0], 2);
    const m = at(c + ds, lat, terrainDy(c + ds, lat));
    b.box([-1.2, 1.2], [0, 0.9], [-0.7, 0.7], '#e8b21c', { matrix: m }); // generator trailer
    b.box([-0.08, 0.08], [0.9, 7.5], [-0.08, 0.08], '#bbb', { matrix: m });
    b.box([-1, 1], [7.3, 8.0], [-0.25, 0.25], '#333', { matrix: m });
    const lp = new THREE.Vector3(0, 7.6, -0.3).applyMatrix4(m);
    lamps.push({ x: lp.x, y: lp.y, z: lp.z, size: 7, color: '#fff6dc' });
  }
  const props = b.build().body;
  const wreck = mergeGeometries([props, ...gear.map((g) => g.index ? g.toNonIndexed() : g)], false);
  gear.forEach((g) => g.dispose());
  props.dispose();

  const coachGeos = perPart.map((list) => {
    const g = mergeGeometries(list, false);
    list.forEach((x) => x.dispose());
    return g;
  });

  // ---- people: staff in orange, officials, RPF, evacuated passengers with bags
  const people = [];
  const P = (s, lat0, person, anim = ANIM.stand, extra = {}) => {
    const lat = offRoad(s, [lat0], 1.2);
    mainLine.sample(s, _p);
    const x = _p.x + _p.lx * lat;
    const z = _p.z + _p.lz * lat;
    people.push({ x, y: terrain.groundY(s, lat), z, yaw: rand() * 6.28, person, anim, phase: rand(), ...extra });
  };
  const staff = () => ({ ...randomPerson(rand, 'man'), top: ORANGE, bottom: '#24324d' });
  for (let k = 0; k < 22; k++) {
    const s = torn[0] - 10 + rand() * (torn[1] - torn[0] + 40);
    P(s, L + 3 + rand() * 8, staff(), rand() < 0.3 ? ANIM.walk : ANIM.stand, { speed: 0.9, range: 6 + rand() * 10 });
  }
  for (let k = 0; k < 6; k++) P(craneS + (rand() - 0.5) * 16, L + 3.2 + rand() * 2, staff()); // crane crew
  for (let k = 0; k < 5; k++) P(c - 1.2 * PITCH + (rand() - 0.5) * 8, 14 + rand() * 3, { ...randomPerson(rand, 'man'), top: '#f4f4f0', bottom: '#2b2f3a' }); // officials at the control tent
  for (let k = 0; k < 4; k++) P(c + (rand() - 0.5) * 80, 13.5 + rand() * 3, { ...randomPerson(rand, 'man'), top: '#b5a77a', bottom: '#b5a77a' }); // RPF
  for (let k = 0; k < 30; k++) {
    const per = randomPerson(rand);
    per.bag = 1;
    P(c - 2.5 * PITCH + rand() * 5 * PITCH, 42 + rand() * 18, per, rand() < 0.2 ? ANIM.sit : ANIM.stand);
  }
  mainLine.sample(c, _p);
  return { ballast, rails: mergeGeometries(rails, false), sleepers, wreck, coachGeos, parts, people, lamps, center: new THREE.Vector3(_p.x + _p.lx * L, _p.y ?? 0, _p.z + _p.lz * L) };

  function terrainDy(s, lat) {
    mainLine.sample(s, _p);
    return terrain.groundY(s, lat) - (_p.y ?? 0) - TRACK.railTop;
  }
}

export default function DerailmentSite() {
  const version = useGameValue((s) => s.incidentsVersion);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const site = useMemo(() => game.incidents?.derailment ?? null, [version]);
  const built = useMemo(() => (site ? buildSite(site) : null), [site]);

  const res = useMemo(() => {
    if (!built) return null;
    const group = new THREE.Group();
    const ballastMat = new THREE.MeshStandardMaterial({ map: makeBallastTexture(), roughness: 1 });
    const railMat = new THREE.MeshStandardMaterial({ color: '#5e5650', metalness: 0.5, roughness: 0.7 });
    const wreckMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.15 });
    const sleeperGeo = new THREE.BoxGeometry(0.25, 0.2, 2.75);
    const sleeperMat = new THREE.MeshStandardMaterial({ color: '#8d877d', roughness: 0.95 });
    group.add(new THREE.Mesh(built.ballast, ballastMat));
    group.add(new THREE.Mesh(built.rails, railMat));
    const sl = new THREE.InstancedMesh(sleeperGeo, sleeperMat, built.sleepers.length);
    built.sleepers.forEach((m, i) => sl.setMatrixAt(i, m));
    sl.computeBoundingSphere();
    group.add(sl);
    const wreck = new THREE.Mesh(built.wreck, wreckMat);
    wreck.castShadow = true;
    group.add(wreck);
    built.coachGeos.forEach((g, k) => {
      const mesh = new THREE.Mesh(g, built.parts[k].material); // the coach materials are shared with the rakes — never disposed here
      mesh.castShadow = true;
      group.add(mesh);
    });
    const personGeo = buildPersonGeometry();
    const personMat = createPeopleMaterial();
    const crowd = makeCrowdMesh(built.people, personGeo, personMat);
    group.add(crowd);
    const glowMat = createGlowMaterial({ day: 0, night: 1.4 });
    const glow = makeGlowMesh(built.lamps, glowMat);
    group.add(glow);
    return { group, ballastMat, railMat, wreckMat, sleeperGeo, sleeperMat, personGeo, personMat, crowd, glow, glowMat, sl };
  }, [built]);

  useEffect(
    () => () => {
      if (!built || !res) return;
      built.ballast.dispose();
      built.rails.dispose();
      built.wreck.dispose();
      built.coachGeos.forEach((g) => g.dispose());
      res.ballastMat.map?.dispose();
      for (const m of [res.ballastMat, res.railMat, res.wreckMat, res.sleeperMat, res.personMat]) m.dispose();
      res.sleeperGeo.dispose();
      res.sl.dispose();
      res.personGeo.dispose();
      res.crowd.geometry.dispose();
      disposeGlowMaterial(res.glowMat);
      res.glow.dispose();
    },
    [built, res],
  );

  useFrame((state) => {
    if (!res) return;
    const near = state.camera.position.distanceTo(built.center) < 2500;
    res.group.visible = near;
    if (!near) return;
    const u = res.personMat.userData.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    if (sceneRefs.locomotive) u.uTrainPos.value.copy(sceneRefs.locomotive.position);
    u.uTrainMoving.value = game.train.speedMps > 2 ? 1 : 0;
  });

  return res ? <primitive object={res.group} /> : null;
}

// Low-poly people, animated entirely on the GPU.
//
// One merged geometry (~450 triangles) contains every optional part: sari
// skirt, porter's head-load, suitcase. Each vertex carries a "part" (which
// colour) and a "limb" (how it moves) id, packed into its vertex colour.
// Per-instance attributes then pick clothes/skin colours, the animation
// (stand, walk, sit, wave), walking speed/range and which optional parts show.
// The vertex shader does the rest — legs swing with knees, arms counter-swing,
// walkers pace up and down the platform and turn round — so a crowd of 200
// costs ONE draw call and no per-frame JavaScript at all.
import * as THREE from 'three';
import { ModelBuilder } from '../modelBuilder.js';

// part ids → colour source
const P = { skin: 0, top: 1, bottom: 2, hair: 3, shoes: 4, load: 5, shadow: 6, skirt: 7 };
// limb ids → motion
const L = { none: 0, lThigh: 1, rThigh: 2, lArm: 3, rArm: 4, skirt: 5, headLoad: 6, bag: 7, head: 8, lShin: 9, rShin: 10 };

export const ANIM = { stand: 0, walk: 1, sit: 2, wave: 3 };

const code = (part, limb) => new THREE.Color(part / 10, limb / 10, 0); // linear, not colour-managed

export function buildPersonGeometry() {
  const b = new ModelBuilder();
  const add = (geo, part, limb, position, rotation) => b.add(geo, { color: code(part, limb), position, rotation });
  // contact shadow (moves with the person, never lit)
  add(new THREE.CircleGeometry(0.3, 12).rotateX(-Math.PI / 2), P.shadow, L.none, [0, 0.012, 0]);
  for (const side of [-1, 1]) {
    const z = side * 0.1;
    const thigh = side < 0 ? L.lThigh : L.rThigh;
    const shin = side < 0 ? L.lShin : L.rShin;
    add(new THREE.BoxGeometry(0.14, 0.44, 0.15), P.bottom, thigh, [0, 0.69, z]);
    add(new THREE.BoxGeometry(0.12, 0.44, 0.13), P.bottom, shin, [0, 0.26, z]);
    add(new THREE.BoxGeometry(0.25, 0.07, 0.12), P.shoes, shin, [0.05, 0.035, z]);
    // arm: sleeve + forearm/hand
    const arm = side < 0 ? L.lArm : L.rArm;
    const az = side * 0.235;
    add(new THREE.BoxGeometry(0.1, 0.3, 0.1), P.top, arm, [0, 1.29, az]);
    add(new THREE.BoxGeometry(0.08, 0.3, 0.08), P.skin, arm, [0, 0.99, az]);
  }
  add(new THREE.BoxGeometry(0.22, 0.14, 0.34), P.bottom, L.none, [0, 0.89, 0]); // hips
  add(new THREE.BoxGeometry(0.24, 0.5, 0.38), P.top, L.none, [0, 1.2, 0]); // torso
  add(new THREE.CylinderGeometry(0.05, 0.055, 0.1, 8), P.skin, L.head, [0, 1.49, 0]); // neck
  add(new THREE.IcosahedronGeometry(0.11, 1), P.skin, L.head, [0.01, 1.6, 0]);
  // hair: a cap pushed back so the face shows, plus a fuller back of the head
  add(new THREE.SphereGeometry(0.117, 10, 5, 0, Math.PI * 2, 0, Math.PI * 0.4), P.hair, L.head, [-0.022, 1.622, 0]);
  add(new THREE.BoxGeometry(0.08, 0.13, 0.2), P.hair, L.head, [-0.075, 1.6, 0]);
  // eyes and brows, so faces read at close range (in the coach)
  for (const ez of [-0.038, 0.038]) {
    add(new THREE.BoxGeometry(0.012, 0.016, 0.022), P.hair, L.head, [0.108, 1.615, ez]);
    add(new THREE.BoxGeometry(0.012, 0.008, 0.034), P.hair, L.head, [0.106, 1.64, ez]);
  }
  // sari / long skirt (shown per instance)
  add(new THREE.CylinderGeometry(0.2, 0.31, 0.86, 12, 1, true), P.skirt, L.skirt, [0, 0.46, 0]);
  add(new THREE.CircleGeometry(0.31, 12).rotateX(Math.PI / 2), P.skirt, L.skirt, [0, 0.03, 0]);
  // porter's head-load (bundle + suitcase) and a hand-carried suitcase
  add(new THREE.BoxGeometry(0.5, 0.26, 0.36), P.load, L.headLoad, [0, 1.86, 0]);
  add(new THREE.BoxGeometry(0.4, 0.2, 0.3), P.load, L.headLoad, [0.02, 2.09, 0]);
  add(new THREE.BoxGeometry(0.38, 0.44, 0.13), P.load, L.bag, [0, 0.58, 0.33]);
  const geo = b.build().body;
  geo.computeBoundingSphere();
  return geo;
}

const vertexCommon = /* glsl */ `
  attribute vec3 aTop;
  attribute vec3 aBottom;
  attribute vec3 aSkin;
  attribute vec4 aAnim;   // speed (m/s), range (m), phase (0..1), mode
  attribute vec3 aFlags;  // sari, head-load, suitcase
  uniform float uTime;
  uniform vec3 uTrainPos;
  uniform float uTrainMoving;
  mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
  mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
  mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
`;

// Runs first in main(): picks the colour and builds this vertex's transform
// p' = pR * p + pT, reused for the normal (pR only).
const vertexSetup = /* glsl */ `
  float part = floor(color.r * 10.0 + 0.5);
  float limb = floor(color.g * 10.0 + 0.5);
  vec3 pc = aSkin;
  if (part == 1.0) pc = aTop;
  else if (part == 2.0 || part == 7.0) pc = aBottom;
  else if (part == 3.0) pc = vec3(0.012, 0.01, 0.009);
  else if (part == 4.0) pc = vec3(0.03, 0.025, 0.02);
  else if (part == 5.0) pc = aFlags.y > 0.5 ? vec3(0.48, 0.36, 0.2) : vec3(0.12, 0.06, 0.03);
  else if (part == 6.0) pc = vec3(0.0);
  vColor = vec4(pc, 1.0); // three r18x declares vColor as vec4

  float speed = aAnim.x;
  float range = aAnim.y;
  float ph = aAnim.z;
  float mode = aAnim.w;
  float t = uTime + ph * 37.0;
  float travel = 0.0;
  float facing = 1.0;
  float legA = 0.0;
  float kneeA = 0.0;
  float armA = 0.0;
  float bob = 0.0;
  float headA = 0.35 * sin(t * 0.23 + ph * 9.0);
  if (mode == 1.0) {
    float per = 2.0 * range;
    float m = mod(t * speed, per);
    travel = m < range ? m : per - m;
    facing = m < range ? 1.0 : -1.0;
    float stride = t * speed * 4.4; // ~1.4 m per stride cycle
    legA = 0.42 * sin(stride);
    kneeA = -0.55 * max(0.0, sin(stride + 1.7));
    armA = -0.32 * sin(stride);
    bob = abs(cos(stride)) * 0.03;
    headA = 0.0;
  } else {
    armA = 0.05 * sin(t * 0.7);
  }
  bool sitting = mode == 2.0;
  vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  bool waving = mode == 3.0 && uTrainMoving > 0.5 && distance(iPos, uTrainPos) < 160.0;

  mat3 pR = mat3(1.0);
  vec3 pT = vec3(0.0);
  vec3 hip = vec3(0.0, 0.9, 0.0);
  vec3 knee = vec3(0.0, 0.47, 0.0);
  if (limb == 1.0 || limb == 2.0 || limb == 9.0 || limb == 10.0) {
    bool left = limb == 1.0 || limb == 9.0;
    float a = left ? legA : -legA;
    float k = (left ? kneeA : -0.55 * max(0.0, sin(t * speed * 4.4 + 1.7 + 3.14159)));
    if (mode != 1.0) k = 0.0;
    if (sitting) { a = 1.5; k = -1.5; }
    mat3 Rh = rotZ(a);
    if (limb == 1.0 || limb == 2.0) {
      pR = Rh;
      pT = hip - Rh * hip;
    } else {
      mat3 Rk = rotZ(k);
      pR = Rh * Rk;
      pT = Rh * (knee - Rk * knee - hip) + hip;
    }
  } else if (limb == 3.0 || limb == 4.0) {
    bool left = limb == 3.0;
    vec3 sh = vec3(0.0, 1.43, left ? -0.235 : 0.235);
    mat3 Ra = rotZ(left ? armA : -armA);
    if (!left && aFlags.z > 0.5) Ra = mat3(1.0);                       // hand on the suitcase
    if (aFlags.y > 0.5) Ra = rotX(left ? 2.8 : -2.8);                  // both hands steadying the head-load
    if (!left && waving) Ra = rotX(-2.55 + 0.4 * sin(uTime * 9.0 + ph * 6.0));
    if (sitting) Ra = rotZ(0.5);                                       // hands on the lap
    pR = Ra;
    pT = sh - Ra * sh;
  } else if (limb == 8.0) {
    vec3 neck = vec3(0.0, 1.48, 0.0);
    mat3 Ry = rotY(headA);
    pR = Ry;
    pT = neck - Ry * neck;
  }
  if (sitting && part != 6.0) pT.y -= 0.42;
  pT.y += bob;
  // walkers turn round at the end of their beat
  mat3 F = mat3(facing, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, facing);
  pR = F * pR;
  pT = F * pT;
  pT.x += travel;
  // optional parts collapse to a point when this person doesn't have them
  if ((limb == 5.0 && aFlags.x < 0.5) || (limb == 6.0 && aFlags.y < 0.5) || (limb == 7.0 && aFlags.z < 0.5)) {
    pR = mat3(0.0);
    pT = vec3(0.0);
  }
`;

export function createPeopleMaterial() {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const uniforms = {
    uTime: { value: 0 },
    uTrainPos: { value: new THREE.Vector3() },
    uTrainMoving: { value: 0 },
    uFill: { value: 0.12 }, // ambient fill so people never turn into black silhouettes
  };
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${vertexCommon}`)
      .replace('#include <color_vertex>', vertexSetup)
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = pR * vec3(normal);')
      .replace('#include <begin_vertex>', 'vec3 transformed = pR * vec3(position) + pT;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFill;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uFill;');
  };
  // all instances share one program; cache key keeps it separate from plain Lambert
  mat.customProgramCacheKey = () => 'brs-people-v2';
  return mat;
}

const SKIN = ['#8d5524', '#a0662f', '#c68642', '#7a4a26', '#b5835a', '#6b4226', '#9a6a44'];
const MEN_TOP = ['#f4f1ea', '#bcd3e6', '#e8e1d0', '#3c5a8a', '#7a2e2e', '#2f6b4f', '#d9a441', '#9aa3ad', '#f2f2f2', '#c8b28a', '#5b4e7a'];
const MEN_BOTTOM = ['#2b2f3a', '#4a4f5a', '#7d6a50', '#efe9dc', '#1f2a44', '#2a2a2a', '#5e5545'];
const SARI = ['#c2185b', '#e65100', '#2e7d32', '#6a1b9a', '#f9a825', '#00838f', '#d84315', '#ad1457', '#1565c0', '#ef6c00'];
const KAMEEZ = ['#e91e63', '#ff7043', '#26a69a', '#7e57c2', '#ffca28', '#ec407a', '#42a5f5', '#8d6e63'];

/**
 * Pick a random person. kind: 'man' | 'woman' | 'porter' | 'child' | undefined (random).
 * Returns { top, bottom, skin, sari, headLoad, bag, scale }.
 */
export function randomPerson(rand, kind) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  const k = kind ?? (rand() < 0.08 ? 'porter' : rand() < 0.12 ? 'child' : rand() < 0.5 ? 'woman' : 'man');
  const skin = pick(SKIN);
  if (k === 'porter') return { top: '#c4161c', bottom: '#efe9dc', skin, sari: 0, headLoad: 1, bag: 0, scale: 0.97 + rand() * 0.06 };
  if (k === 'woman') {
    const sari = rand() < 0.6;
    const c = sari ? pick(SARI) : pick(KAMEEZ);
    return { top: sari ? c : c, bottom: sari ? c : rand() < 0.5 ? '#f3efe6' : pick(KAMEEZ), skin, sari: sari ? 1 : 0, headLoad: 0, bag: rand() < 0.15 ? 1 : 0, scale: 0.92 + rand() * 0.07 };
  }
  if (k === 'child') return { top: pick([...KAMEEZ, ...MEN_TOP]), bottom: pick(MEN_BOTTOM), skin, sari: 0, headLoad: 0, bag: 0, scale: 0.58 + rand() * 0.12 };
  return { top: pick(MEN_TOP), bottom: pick(MEN_BOTTOM), skin, sari: 0, headLoad: 0, bag: rand() < 0.25 ? 1 : 0, scale: 0.97 + rand() * 0.08 };
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Build an InstancedMesh crowd.
 * people: [{ x, y, z, yaw, person (from randomPerson), anim, speed, range, phase }]
 * Walkers move along their local +X (after yaw) for `range` metres and back.
 */
export function makeCrowdMesh(people, geometry, material) {
  const n = Math.max(1, people.length);
  const mesh = new THREE.InstancedMesh(geometry, material, n);
  const top = new Float32Array(n * 3);
  const bottom = new Float32Array(n * 3);
  const skin = new Float32Array(n * 3);
  const anim = new Float32Array(n * 4);
  const flags = new Float32Array(n * 3);
  people.forEach((pp, i) => {
    const per = pp.person;
    _p.set(pp.x, pp.y, pp.z);
    _q.setFromAxisAngle(UP, pp.yaw ?? 0);
    _s.setScalar(per.scale);
    mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    _c.set(per.top).toArray(top, i * 3);
    _c.set(per.bottom).toArray(bottom, i * 3);
    _c.set(per.skin).toArray(skin, i * 3);
    anim.set([pp.speed ?? 0, pp.range ?? 0, pp.phase ?? 0, pp.anim ?? ANIM.stand], i * 4);
    flags.set([per.sari, per.headLoad, per.bag], i * 3);
  });
  geometry = mesh.geometry;
  mesh.geometry = geometry.clone(); // instance attributes live on a per-crowd copy (shares no buffers to dispose twice)
  mesh.geometry.setAttribute('aTop', new THREE.InstancedBufferAttribute(top, 3));
  mesh.geometry.setAttribute('aBottom', new THREE.InstancedBufferAttribute(bottom, 3));
  mesh.geometry.setAttribute('aSkin', new THREE.InstancedBufferAttribute(skin, 3));
  mesh.geometry.setAttribute('aAnim', new THREE.InstancedBufferAttribute(anim, 4));
  mesh.geometry.setAttribute('aFlags', new THREE.InstancedBufferAttribute(flags, 3));
  mesh.count = people.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false; // walkers roam; the owner culls by distance instead
  return mesh;
}

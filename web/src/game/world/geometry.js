// Geometry helpers that turn the route into Three.js meshes.
import * as THREE from 'three';

/**
 * Sweep a 2D cross-section ("profile") along the route, like an extrusion.
 * profile: array of [lateral, height] points ordered from LEFT to RIGHT
 * (lateral > 0 is left of the direction of travel). Each profile edge becomes
 * a long strip of quads; vertices are not shared between edges so the
 * corners stay crisp.
 */
export function buildRibbonGeometry(route, profile, { step = 4, from = 0, to = route.length, uvScale = 4 } = {}) {
  const count = Math.max(2, Math.ceil((to - from) / step) + 1);
  const edges = profile.length - 1;
  const positions = new Float32Array(count * edges * 2 * 3);
  const uvs = new Float32Array(count * edges * 2 * 2);
  const indices = [];
  const p = {};

  for (let i = 0; i < count; i++) {
    const s = Math.min(from + i * step, to);
    route.sample(s, p);
    for (let e = 0; e < edges; e++) {
      for (let k = 0; k < 2; k++) {
        const [lat, y] = profile[e + k];
        const v = (i * edges + e) * 2 + k;
        positions[v * 3] = p.x + p.lx * lat;
        positions[v * 3 + 1] = y;
        positions[v * 3 + 2] = p.z + p.lz * lat;
        uvs[v * 2] = s / uvScale;
        uvs[v * 2 + 1] = k;
      }
    }
  }
  for (let i = 0; i < count - 1; i++) {
    for (let e = 0; e < edges; e++) {
      const a = (i * edges + e) * 2;
      const d = a + 1;
      const b = ((i + 1) * edges + e) * 2;
      const c = b + 1;
      indices.push(a, d, b, d, c, b); // winding chosen so faces point outward
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Fill an InstancedMesh with one transform per item.
 * items: [{ x, y, z, yaw, sx, sy, sz, color? }]
 * Instancing draws hundreds or thousands of copies of one mesh in ONE draw
 * call — the main trick for cheap sleepers, trees and poles.
 */
export function fillInstances(mesh, items) {
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const color = new THREE.Color();
  items.forEach((it, i) => {
    pos.set(it.x, it.y ?? 0, it.z);
    q.setFromAxisAngle(up, it.yaw ?? 0);
    scale.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
    m.compose(pos, q, scale);
    mesh.setMatrixAt(i, m);
    if (it.color !== undefined) mesh.setColorAt(i, color.set(it.color));
  });
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

/** Small deterministic random generator so the scenery is identical every run. */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Join several indexed BufferGeometries (position/normal/uv) into one mesh = one draw call. */
export function mergeGeometries(geos) {
  const total = (name) => geos.reduce((n, g) => n + g.attributes[name].array.length, 0);
  const position = new Float32Array(total('position'));
  const normal = new Float32Array(total('normal'));
  const uv = new Float32Array(total('uv'));
  const index = new Uint32Array(geos.reduce((n, g) => n + g.index.count, 0));
  let pOff = 0;
  let uvOff = 0;
  let iOff = 0;
  let vertexOffset = 0;
  for (const g of geos) {
    position.set(g.attributes.position.array, pOff);
    normal.set(g.attributes.normal.array, pOff);
    uv.set(g.attributes.uv.array, uvOff);
    const src = g.index.array;
    for (let i = 0; i < src.length; i++) index[iOff + i] = src[i] + vertexOffset;
    pOff += g.attributes.position.array.length;
    uvOff += g.attributes.uv.array.length;
    iOff += src.length;
    vertexOffset += g.attributes.position.count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setIndex(new THREE.BufferAttribute(index, 1));
  return merged;
}

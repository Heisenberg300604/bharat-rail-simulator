// ModelBuilder: build a 3D model out of many simple shapes, then MERGE them
// into one geometry per material.
//
// Why: the GPU cost of a scene is dominated by the number of "draw calls"
// (one per mesh). A locomotive made of 60 separate boxes = 60 draw calls
// (120 with shadows). Merged, it is 1–3 draw calls. Each part keeps its own
// colour via per-vertex colours, so we don't need a material per colour.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();

export class ModelBuilder {
  constructor() {
    /** @type {Map<string, THREE.BufferGeometry[]>} */
    this.groups = new Map();
  }

  /**
   * Add any geometry. Options: color, mat (material key), position [x,y,z],
   * rotation [x,y,z] (radians), scale [x,y,z], matrix (Matrix4, applied last).
   */
  add(geometry, { color = '#ffffff', mat = 'body', position, rotation, scale, matrix } = {}) {
    let g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    tmpEuler.set(...(rotation ?? [0, 0, 0]));
    tmpQuat.setFromEuler(tmpEuler);
    tmpMatrix.compose(new THREE.Vector3(...(position ?? [0, 0, 0])), tmpQuat, new THREE.Vector3(...(scale ?? [1, 1, 1])));
    g.applyMatrix4(tmpMatrix);
    if (matrix) g.applyMatrix4(matrix);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    // Keep only the attributes every part has, so they can be merged.
    for (const name of Object.keys(g.attributes)) {
      if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    }
    tmpColor.set(color); // sRGB hex → linear (what the shader expects)
    const count = g.attributes.position.count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = tmpColor.r;
      colors[i * 3 + 1] = tmpColor.g;
      colors[i * 3 + 2] = tmpColor.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    if (!this.groups.has(mat)) this.groups.set(mat, []);
    this.groups.get(mat).push(g);
    return this;
  }

  /** Box by extents: x/y/z are [min, max]. `uvScale` (metres per texture tile) gives world-scaled UVs. */
  box(x, y, z, color, opts = {}) {
    const w = x[1] - x[0];
    const h = y[1] - y[0];
    const d = z[1] - z[0];
    const geo = new THREE.BoxGeometry(w, h, d);
    if (opts.uvScale) scaleBoxUVs(geo, w, h, d, opts.uvScale);
    return this.add(geo, { ...opts, color, position: [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2] });
  }

  /** Cylinder whose axis runs along X, Y or Z. */
  cylinder({ radius, radiusTop = radius, radiusBottom = radius, length, axis = 'y', segments = 12, position, color, ...opts }) {
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, length, segments);
    const rotation = axis === 'x' ? [0, 0, Math.PI / 2] : axis === 'z' ? [Math.PI / 2, 0, 0] : [0, 0, 0];
    return this.add(geo, { ...opts, color, position, rotation });
  }

  /**
   * Prism: a 2D outline in the X/Y plane extruded along Z from z0 to z1.
   * Great for side profiles (e.g. a locomotive's sloped cab front).
   */
  prism(points, z0, z1, color, opts = {}) {
    const shape = new THREE.Shape(points.map(([px, py]) => new THREE.Vector2(px, py)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: z1 - z0, bevelEnabled: false });
    return this.add(geo, { ...opts, color, position: [0, 0, z0] });
  }

  /**
   * Cross-section in the Y/Z plane extruded along X (e.g. a curved coach roof).
   * points: [z, y] pairs.
   */
  sweepX(points, x0, x1, color, opts = {}) {
    const shape = new THREE.Shape(points.map(([pz, py]) => new THREE.Vector2(pz, py)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: x1 - x0, bevelEnabled: false, curveSegments: 6 });
    // Extrude goes along +Z. Rotating −90° about Y maps shape-x → world z and
    // extrusion depth → world −x, so we then shift it to span [x0, x1].
    geo.rotateY(-Math.PI / 2);
    return this.add(geo, { ...opts, color, position: [x1, 0, 0] });
  }

  /** Returns { [matKey]: BufferGeometry } with one merged geometry per material. */
  build() {
    const out = {};
    for (const [key, list] of this.groups) {
      const merged = mergeGeometries(list, false);
      list.forEach((g) => g.dispose());
      merged.computeBoundingSphere();
      merged.computeBoundingBox();
      out[key] = merged;
    }
    this.groups.clear();
    return out;
  }
}

/** Rescale a BoxGeometry's UVs so 1 texture tile = `tile` metres on every face. */
function scaleBoxUVs(geo, w, h, d, tile) {
  const uv = geo.attributes.uv;
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z (4 vertices each)
  const dims = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, (uv.getX(i) * dims[f][0]) / tile, (uv.getY(i) * dims[f][1]) / tile);
    }
  }
}

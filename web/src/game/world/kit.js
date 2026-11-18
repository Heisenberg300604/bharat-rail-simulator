// Kit: builds a big, static, merged mesh out of thousands of small parts
// (houses, walls, trees, animals…) — one draw call for a whole patch of land.
//
// Why not instancing? Instancing needs one draw call per *kind* of object per
// chunk. The rich scenery has dozens of kinds; merging every part of a chunk
// into one geometry keeps the whole lot at one draw call per chunk.
//
// Every triangle is flat-shaded (its normal comes from its own corners), the
// same low-poly look as the existing trees. Each vertex carries:
//   color — the part's colour (multiplies the atlas texel)
//   uv    — texture repeats (e.g. one window per 4 m × 3 m of wall)
//   aTile — which atlas tile (see sceneryAtlas.js); its fraction is a per-object
//           seed the shader uses to decide which windows are lit at night
import * as THREE from 'three';

const colorCache = new Map();
/** sRGB hex → linear [r, g, b] (what the shader expects for vertex colours). */
function lin(hex) {
  let c = colorCache.get(hex);
  if (!c) {
    const t = new THREE.Color(hex);
    c = [t.r, t.g, t.b];
    colorCache.set(hex, c);
  }
  return c;
}

// Unit shapes as flat triangle lists (non-indexed positions + uvs), built once.
const SHAPES = {};
function shape(key) {
  if (SHAPES[key]) return SHAPES[key];
  let g;
  const [kind, n] = key.split(':');
  const segs = Number(n) || 6;
  if (kind === 'cyl') g = new THREE.CylinderGeometry(1, 1, 1, segs, 1, false); // radius 1, height 1 (centred)
  else if (kind === 'tube') g = new THREE.CylinderGeometry(1, 1, 1, segs, 1, true); // open ended
  else if (kind === 'cone') g = new THREE.ConeGeometry(1, 1, segs, 1, true);
  else if (kind === 'ico') g = new THREE.IcosahedronGeometry(1, segs === 6 ? 0 : segs);
  else if (kind === 'dome') g = new THREE.SphereGeometry(1, segs, Math.max(2, segs >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
  else if (kind === 'sphere') g = new THREE.SphereGeometry(1, segs, Math.max(3, segs >> 1));
  else throw new Error('unknown shape ' + key);
  const ni = g.index ? g.toNonIndexed() : g;
  SHAPES[key] = { pos: ni.attributes.position.array.slice(), uv: ni.attributes.uv.array.slice() };
  g.dispose();
  if (ni !== g) ni.dispose();
  return SHAPES[key];
}

/** A rigid frame: 3×3 rotation (columns = local x, y, z axes) + translation. */
function frameFrom(x, y, z, yaw = 0, pitch = 0, roll = 0) {
  // R = Ry(yaw) · Rx(pitch) · Rz(roll)
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const cp = Math.cos(pitch), sp = Math.sin(pitch);
  const cr = Math.cos(roll), sr = Math.sin(roll);
  // columns of Rx·Rz
  const xr = [cr, cp * sr, sp * sr];
  const yr = [-sr, cp * cr, sp * cr];
  const zr = [0, -sp, cp];
  // apply Ry to each column: (x, y, z) → (cy*x + sy*z, y, -sy*x + cy*z)
  const ry = (v) => [cy * v[0] + sy * v[2], v[1], -sy * v[0] + cy * v[2]];
  const X = ry(xr), Y = ry(yr), Z = ry(zr);
  return { m: [X[0], X[1], X[2], Y[0], Y[1], Y[2], Z[0], Z[1], Z[2]], t: [x, y, z] };
}
function compose(P, C) {
  const m = new Array(9);
  for (let c = 0; c < 3; c++) {
    const vx = C.m[c * 3], vy = C.m[c * 3 + 1], vz = C.m[c * 3 + 2];
    m[c * 3] = P.m[0] * vx + P.m[3] * vy + P.m[6] * vz;
    m[c * 3 + 1] = P.m[1] * vx + P.m[4] * vy + P.m[7] * vz;
    m[c * 3 + 2] = P.m[2] * vx + P.m[5] * vy + P.m[8] * vz;
  }
  const [tx, ty, tz] = C.t;
  return { m, t: [P.m[0] * tx + P.m[3] * ty + P.m[6] * tz + P.t[0], P.m[1] * tx + P.m[4] * ty + P.m[7] * tz + P.t[1], P.m[2] * tx + P.m[5] * ty + P.m[8] * tz + P.t[2]] };
}

export class Kit {
  constructor(capacity = 4096) {
    this.n = 0; // vertices
    this.cap = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.nor = new Float32Array(capacity * 3);
    this.col = new Float32Array(capacity * 3);
    this.uvs = new Float32Array(capacity * 2);
    this.til = new Float32Array(capacity);
    this.frame = frameFrom(0, 0, 0);
    this.stack = [];
    this.seed = 0.5;
  }

  /** Put the following parts at world (x, y, z) turned by yaw (radians about +Y). */
  place(x, y, z, yaw = 0) {
    this.frame = frameFrom(x, y, z, yaw);
    this.stack.length = 0;
    return this;
  }
  /** Run fn with a child frame (local offset + rotation) pushed on top of the current one. */
  sub(x, y, z, yaw, pitch, roll, fn) {
    this.stack.push(this.frame);
    this.frame = compose(this.frame, frameFrom(x, y, z, yaw, pitch, roll));
    fn();
    this.frame = this.stack.pop();
    return this;
  }

  _grow(extra) {
    if (this.n + extra <= this.cap) return;
    let cap = this.cap * 2;
    while (cap < this.n + extra) cap *= 2;
    const g = (a, k) => {
      const b = new Float32Array(cap * k);
      b.set(a);
      return b;
    };
    this.pos = g(this.pos, 3);
    this.nor = g(this.nor, 3);
    this.col = g(this.col, 3);
    this.uvs = g(this.uvs, 2);
    this.til = g(this.til, 1);
    this.cap = cap;
  }

  /** One triangle in local coordinates (counter-clockwise seen from the front). */
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, color, tile = 0, uv = null) {
    this._grow(3);
    const { m, t } = this.frame;
    const T = (x, y, z, o) => {
      this.pos[o] = m[0] * x + m[3] * y + m[6] * z + t[0];
      this.pos[o + 1] = m[1] * x + m[4] * y + m[7] * z + t[1];
      this.pos[o + 2] = m[2] * x + m[5] * y + m[8] * z + t[2];
    };
    const o = this.n * 3;
    T(ax, ay, az, o);
    T(bx, by, bz, o + 3);
    T(cx, cy, cz, o + 6);
    const p = this.pos;
    const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2];
    const vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;
    const c = typeof color === 'string' ? lin(color) : color;
    const tv = tile + 0.05 + this.seed * 0.9;
    for (let k = 0; k < 3; k++) {
      this.nor[o + k * 3] = nx;
      this.nor[o + k * 3 + 1] = ny;
      this.nor[o + k * 3 + 2] = nz;
      this.col[o + k * 3] = c[0];
      this.col[o + k * 3 + 1] = c[1];
      this.col[o + k * 3 + 2] = c[2];
      this.til[this.n + k] = tv;
    }
    const q = this.n * 2;
    if (uv) for (let k = 0; k < 6; k++) this.uvs[q + k] = uv[k];
    else for (let k = 0; k < 6; k++) this.uvs[q + k] = 0.5;
    this.n += 3;
    return this;
  }

  /** Quad p0..p3 counter-clockwise from the front (p0 bottom-left); texture repeats uw × uh times. */
  quad(p0, p1, p2, p3, color, tile = 0, uw = 1, uh = 1, u0 = 0, v0 = 0) {
    this.tri(...p0, ...p1, ...p2, color, tile, [u0, v0, u0 + uw, v0, u0 + uw, v0 + uh]);
    this.tri(...p0, ...p2, ...p3, color, tile, [u0, v0, u0 + uw, v0 + uh, u0, v0 + uh]);
    return this;
  }

  /**
   * Axis-aligned box in the current frame. opts:
   *   tile (walls), top (tile for the top face), topColor,
   *   tw/th (metres per texture repeat on walls; 0 = stretch once),
   *   faces: string of faces to draw from 'xXyYzZ' (x = −x … Z = +z; default all but the bottom)
   *   front: tile for the −z face only
   */
  box(x0, x1, y0, y1, z0, z1, color, opts = {}) {
    const { tile = 0, top = tile, topColor = color, tw = 0, th = 0, faces = 'xXYzZ', front = tile, frontColor = color } = opts;
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    const rep = (len, unit) => (unit ? Math.max(len / unit, 0.0001) : 1);
    const vh = rep(h, th);
    if (faces.includes('z')) this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], frontColor, front, rep(w, tw), vh);
    if (faces.includes('Z')) this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], color, tile, rep(w, tw), vh);
    if (faces.includes('X')) this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], color, tile, rep(d, tw), vh);
    if (faces.includes('x')) this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], color, tile, rep(d, tw), vh);
    if (faces.includes('Y')) this.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], topColor, top, tw ? rep(w, tw) : 1, tw ? rep(d, tw) : 1);
    if (faces.includes('y')) this.quad([x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], color, tile);
    return this;
  }

  /** Box by centre + size, rotated (yaw, pitch, roll) about its centre. */
  obox(cx, cy, cz, sx, sy, sz, yaw, pitch, roll, color, opts) {
    return this.sub(cx, cy, cz, yaw, pitch, roll, () => this.box(-sx / 2, sx / 2, -sy / 2, sy / 2, -sz / 2, sz / 2, color, opts));
  }

  /**
   * Pitched roof, ridge along local x, over [x0,x1] × [z0,z1] (overhang included
   * by the caller), eaves at y0, ridge at y1. Gable ends filled with `endColor`.
   */
  gable(x0, x1, y0, y1, z0, z1, color, tile = 0, endColor = null, endTile = 0, tw = 0) {
    const zm = (z0 + z1) / 2;
    const slope = Math.hypot(zm - z0, y1 - y0);
    const uw = tw ? (x1 - x0) / tw : 1;
    const uh = tw ? slope / tw : 1;
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, zm], [x1, y1, zm], color, tile, uw, uh);
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, zm], [x0, y1, zm], color, tile, uw, uh);
    if (endColor) {
      this.tri(x1, y0, z1, x1, y0, z0, x1, y1, zm, endColor, endTile);
      this.tri(x0, y0, z0, x0, y0, z1, x0, y1, zm, endColor, endTile);
    }
    return this;
  }

  /** Hipped (four-sided) roof over [x0,x1] × [z0,z1] with the ridge shortened by `inset`. */
  hip(x0, x1, y0, y1, z0, z1, color, tile = 0, tw = 0) {
    const zm = (z0 + z1) / 2;
    const inset = Math.min((x1 - x0) / 2 - 0.01, (z1 - z0) / 2);
    const rx0 = x0 + inset, rx1 = x1 - inset;
    const uw = tw ? (x1 - x0) / tw : 1;
    const uh = tw ? Math.hypot(zm - z0, y1 - y0) / tw : 1;
    this.quad([x1, y0, z0], [x0, y0, z0], [rx0, y1, zm], [rx1, y1, zm], color, tile, uw, uh);
    this.quad([x0, y0, z1], [x1, y0, z1], [rx1, y1, zm], [rx0, y1, zm], color, tile, uw, uh);
    this.tri(x1, y0, z1, x1, y0, z0, rx1, y1, zm, color, tile, [0, 0, uh, 0, uh / 2, uh]);
    this.tri(x0, y0, z0, x0, y0, z1, rx0, y1, zm, color, tile, [0, 0, uh, 0, uh / 2, uh]);
    return this;
  }

  /** Mono-pitch (lean-to) sheet from front edge (z0, y0) up to back edge (z1, y1). */
  slope(x0, x1, z0, y0, z1, y1, color, tile = 0, tw = 0) {
    const uw = tw ? (x1 - x0) / tw : 1;
    const uh = tw ? Math.hypot(z1 - z0, y1 - y0) / tw : 1;
    return this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z1], [x1, y1, z1], color, tile, uw, uh);
  }

  /**
   * A unit shape ('cyl:8', 'tube:6', 'cone:6', 'ico', 'ico:1', 'dome:8', 'sphere:8')
   * scaled to (sx, sy, sz), rotated, at (x, y, z) in the current frame.
   * Cylinders/cones are 1 tall and centred on y = 0 before scaling.
   * jitter > 0 roughens it (for foliage and rocks), consistently per corner.
   */
  shape(key, x, y, z, sx, sy, sz, color, { yaw = 0, pitch = 0, roll = 0, tile = 0, jitter = 0, uvScale = 1 } = {}) {
    const s = shape(key);
    const P = s.pos;
    const U = s.uv;
    const js = this.seed * 97.13;
    const jit = (vx, vy, vz) => {
      if (!jitter) return 1;
      const h = Math.sin(vx * 12.9898 + vy * 78.233 + vz * 37.719 + js) * 43758.5453;
      return 1 + (h - Math.floor(h) - 0.5) * 2 * jitter;
    };
    this.sub(x, y, z, yaw, pitch, roll, () => {
      for (let i = 0; i < P.length; i += 9) {
        const v = [];
        for (let k = 0; k < 3; k++) {
          const px = P[i + k * 3], py = P[i + k * 3 + 1], pz = P[i + k * 3 + 2];
          const j = jit(px, py, pz);
          v.push(px * sx * j, py * sy * j, pz * sz * j);
        }
        const ui = (i / 3) * 2;
        const uv = tile ? [U[ui] * uvScale, U[ui + 1] * uvScale, U[ui + 2] * uvScale, U[ui + 3] * uvScale, U[ui + 4] * uvScale, U[ui + 5] * uvScale] : null;
        this.tri(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7], v[8], color, tile, uv);
      }
    });
    return this;
  }

  /** Cylinder standing on y0 up to y1 (radius r0 at the bottom, r1 at the top). */
  cyl(x, y0, z, r0, r1, y1, color, segs = 8, opts = {}) {
    // a cone/cylinder blend: scale a unit cylinder, then taper by re-emitting
    if (r0 === r1) return this.shape(`${opts.open ? 'tube' : 'cyl'}:${segs}`, x, (y0 + y1) / 2, z, r0, y1 - y0, r0, color, opts);
    const n = segs;
    const h = y1 - y0;
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quad([x + r0 * s0, y0, z + r0 * c0], [x + r0 * s1, y0, z + r0 * c1], [x + r1 * s1, y0 + h, z + r1 * c1], [x + r1 * s0, y0 + h, z + r1 * c0], color, opts.tile ?? 0);
      if (!opts.open && r1 > 0) this.tri(x, y1, z, x + r1 * s0, y1, z + r1 * c0, x + r1 * s1, y1, z + r1 * c1, opts.capColor ?? color, opts.tile ?? 0);
    }
    return this;
  }

  /** A thin straight member (pole, rod, wire) from point a to point b, square section `t`. */
  rod(ax, ay, az, bx, by, bz, t, color) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return this;
    // orient local +y along (dx, dy, dz)
    const yaw = Math.atan2(dx, dz);
    const pitch = Math.acos(Math.max(-1, Math.min(1, dy / len)));
    return this.sub((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2, yaw, pitch, 0, () => this.box(-t / 2, t / 2, -len / 2, len / 2, -t / 2, t / 2, color, { faces: 'xXzZ' }));
  }

  get vertexCount() {
    return this.n;
  }

  /** Finished BufferGeometry (or null if nothing was added). */
  build() {
    if (!this.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.slice(0, this.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.slice(0, this.n * 3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.slice(0, this.n * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uvs.slice(0, this.n * 2), 2));
    g.setAttribute('aTile', new THREE.BufferAttribute(this.til.slice(0, this.n), 1));
    g.computeBoundingSphere();
    return g;
  }
}

/** yaw that makes an object's local −z (its front) face the world direction (dx, dz). */
export function yawFacing(dx, dz) {
  return Math.atan2(-dx, -dz);
}

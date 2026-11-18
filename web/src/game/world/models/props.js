// Things beside an Indian line that aren't houses: boundary walls with painted
// ads, PSC electric poles, mobile towers, brick kilns, haystacks, dung-cake
// stacks, shrines and village temples, overhead water tanks, hand pumps, rope
// cots, chai stalls. Original procedural models built into a Kit (world/kit.js),
// local origin on the ground, front = −z.
import { TILE, AD_COUNT } from '../sceneryAtlas.js';

const CONC = '#b9b3a8';

/** One straight run of railway boundary wall, `len` long along local x. ad: index or −1. */
export function boundaryWall(kb, len, h, ad, color = '#ffffff') {
  const t = 0.23;
  const tile = ad >= 0 ? TILE.AD + (ad % AD_COUNT) : TILE.WALL;
  kb.box(-len / 2, len / 2, -0.6, h, -t / 2, t / 2, color, { tile: TILE.WALL, tw: ad >= 0 ? 0 : 3, th: ad >= 0 ? 0 : h + 0.6, front: tile, top: TILE.CONCRETE, topColor: '#a9a39a', faces: 'zZY' });
  kb.box(-len / 2 - 0.15, -len / 2 + 0.15, -0.6, h + 0.12, -t / 2 - 0.05, t / 2 + 0.05, '#cfc9be', { tile: TILE.CONCRETE }); // pillar
}

/** Pre-stressed concrete (PSC) distribution pole with a cross-arm and insulators. Returns wire attach heights. */
export function psc(kb, h = 9) {
  kb.cyl(0, -0.3, 0, 0.16, 0.09, h, '#a7a39b', 4);
  kb.box(-0.9, 0.9, h - 0.6, h - 0.5, -0.06, 0.06, '#5d5a55');
  for (const x of [-0.8, 0, 0.8]) kb.cyl(x, h - 0.5, 0, 0.05, 0.04, h - 0.3, '#e8e2d6', 5);
  return h - 0.32;
}

/** Sagging wire between two world points (kit must be placed at the origin, yaw 0). */
export function wire(kb, a, b, sag = 0.7, color = '#262626') {
  const n = 4;
  let prev = a;
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    const p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - sag * 4 * t * (1 - t), a[2] + (b[2] - a[2]) * t];
    kb.rod(prev[0], prev[1], prev[2], p[0], p[1], p[2], 0.035, color);
    prev = p;
  }
}

/** Pole-mounted village transformer (two poles, a platform and the tank). */
export function transformer(kb) {
  for (const x of [-1.2, 1.2]) kb.cyl(x, -0.3, 0, 0.15, 0.09, 9, '#a7a39b', 4);
  kb.box(-1.4, 1.4, 3.6, 3.75, -0.5, 0.5, '#4a4a48');
  kb.box(-0.55, 0.55, 3.75, 5.0, -0.45, 0.45, '#6f7b6c');
  for (const x of [-0.3, 0, 0.3]) kb.cyl(x, 5.0, -0.1, 0.06, 0.05, 5.5, '#c79a5b', 5);
  kb.box(-1.4, 1.4, 8.4, 8.5, -0.06, 0.06, '#5d5a55');
}

/** Lattice mobile tower with antenna panels and a dish, plus its equipment shelter. */
export function mobileTower(kb, h, rand) {
  const b = h * 0.09;
  const levels = 6;
  const half = (y) => b * (1 - (y / h) * 0.75);
  for (const [sx, sz] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) kb.rod(sx * half(0), 0, sz * half(0), sx * half(h), h, sz * half(h), 0.18, '#8e9498');
  for (let l = 1; l <= levels; l++) {
    const y0 = ((l - 1) / levels) * h, y1 = (l / levels) * h;
    const a = half(y0), c = half(y1);
    for (const [x0, z0, x1, z1] of [
      [-1, -1, 1, -1],
      [1, -1, 1, 1],
      [1, 1, -1, 1],
      [-1, 1, -1, -1],
    ]) {
      kb.rod(x0 * c, y1, z0 * c, x1 * c, y1, z1 * c, 0.08, '#8e9498');
      kb.rod(x0 * a, y0, z0 * a, x1 * c, y1, z1 * c, 0.06, '#8e9498');
    }
  }
  const t = half(h);
  for (let k = 0; k < 6; k++) {
    const ang = (k / 6) * Math.PI * 2;
    kb.obox(Math.sin(ang) * (t + 0.4), h - 1.6 - (k % 2) * 2.2, Math.cos(ang) * (t + 0.4), 0.45, 1.8, 0.14, ang, 0, 0, '#f1f1ee');
  }
  kb.shape('cyl:10', t + 0.3, h - 6, 0, 0.6, 0.12, 0.6, '#e8e8e4', { roll: Math.PI / 2, yaw: rand() * 6.28 });
  kb.cyl(0, h, 0, 0.05, 0.05, h + 1.2, '#c62828', 4); // aviation-light mast
  kb.box(b + 1, b + 4.2, 0, 2.7, -1.6, 1.6, '#e7e3da', { top: TILE.CONCRETE });
}

/** Fixed-chimney brick kiln (bhatta): an oval brick mound, a tall chimney, stacks of bricks around. */
export function brickKiln(kb, rand) {
  const L = 55 + rand() * 25, W = 22 + rand() * 6;
  kb.box(-L / 2, L / 2, -0.5, 3.6, -W / 2, W / 2, '#ffffff', { tile: TILE.BRICK, tw: 4, th: 3, top: TILE.PLAIN, topColor: '#5d4a3d' });
  kb.box(-L / 2 + 3, L / 2 - 3, 3.6, 4.4, -W / 2 + 3, W / 2 - 3, '#4b3d33'); // ash cover on top
  const cx = (rand() - 0.5) * L * 0.4;
  kb.cyl(cx, 0, W / 2 + 6, 2.6, 1.3, 33 + rand() * 6, '#ffffff', 10, { tile: TILE.BRICK });
  kb.cyl(cx, 32, W / 2 + 6, 1.45, 1.45, 34 + rand() * 6, '#2a2522', 10);
  // green bricks drying / fired bricks stacked in long rows
  for (let k = 0; k < 6; k++) {
    const x = -L / 2 + 6 + k * (L / 6);
    kb.box(x - 3.5, x + 3.5, -0.2, 1.4, -W / 2 - 14, -W / 2 - 10, k % 2 ? '#c49a76' : '#ffffff', { tile: k % 2 ? TILE.PLAIN : TILE.BRICK, tw: 4, th: 3 });
  }
  kb.box(L / 2 + 3, L / 2 + 7, 0, 2.4, -3, 3, '#2a2522'); // coal heap
}

/** Haystack: straw stacked round a pole, conical top. */
export function haystack(kb, rand) {
  const r = 1.6 + rand() * 1.4;
  const h = 2.4 + rand() * 1.6;
  kb.cyl(0, -0.2, 0, r, r * 1.05, h * 0.55, '#ffffff', 8, { tile: TILE.HAY });
  kb.shape('cone:8', 0, h * 0.55 + h * 0.25, 0, r * 1.08, h * 0.5, r * 1.08, '#ffffff', { tile: TILE.HAY, uvScale: 3 });
  kb.cyl(0, h * 0.9, 0, 0.07, 0.04, h + 0.6, '#6b4a2e', 4);
}

/** Dung cakes stacked into a beehive to dry and store (a "bitaura"). */
export function dungStack(kb, rand) {
  const r = 1.1 + rand() * 0.8;
  kb.cyl(0, -0.1, 0, r, r * 0.92, 1.3, '#ffffff', 8, { tile: TILE.DUNG });
  kb.shape('dome:8', 0, 1.3, 0, r * 0.92, r * 0.9, r * 0.92, '#ffffff', { tile: TILE.DUNG, uvScale: 3 });
}

/** India Mark II style hand pump on a little concrete apron. */
export function handPump(kb) {
  kb.box(-0.9, 0.9, -0.1, 0.12, -0.9, 0.9, '#a9a49b', { tile: TILE.CONCRETE });
  kb.cyl(0, 0.12, 0, 0.09, 0.09, 1.0, '#2f5aa0', 6);
  kb.box(-0.13, 0.13, 0.95, 1.25, -0.13, 0.13, '#2f5aa0');
  kb.rod(0, 0.75, -0.12, 0, 0.75, -0.5, 0.05, '#2f5aa0'); // spout
  kb.rod(0, 1.15, 0.1, 0, 1.4, 1.0, 0.05, '#2f5aa0'); // handle
}

/** Rope cot (charpai) leaning or standing outside a hut. */
export function charpai(kb, rand) {
  const c = '#7a5634';
  if (rand() < 0.5) {
    for (const [x, z] of [
      [-0.9, -0.42],
      [0.9, -0.42],
      [-0.9, 0.42],
      [0.9, 0.42],
    ]) kb.box(x - 0.05, x + 0.05, 0, 0.45, z - 0.05, z + 0.05, c);
    kb.box(-0.95, 0.95, 0.4, 0.46, -0.45, 0.45, '#cdbb92');
  } else {
    kb.obox(0, 0.85, 0, 1.9, 0.08, 0.9, 0, 0, 1.25, '#cdbb92'); // stood on its side against a wall
  }
}

/** Small roadside shrine: a whitewashed niche with a saffron spire and flag. style: 'north' | 'south'. */
export function shrine(kb, style, rand) {
  kb.box(-0.9, 0.9, -0.1, 0.4, -0.9, 0.9, '#d8d2c6', { tile: TILE.CONCRETE });
  kb.box(-0.6, 0.6, 0.4, 1.6, -0.6, 0.6, style === 'south' ? '#ffffff' : '#f2ede2', { tile: style === 'south' ? TILE.STRIPES : TILE.PLAIN, tw: 1.2, th: 1.2 });
  kb.box(-0.3, 0.3, 0.6, 1.3, -0.63, -0.6, '#2a1e16', { faces: 'z' });
  kb.shape('cone:6', 0, 2.1, 0, 0.62, 1.0, 0.62, '#e8701a');
  kb.cyl(0.7, 0, 0.7, 0.03, 0.03, 4.2, '#6b4a2e', 4);
  kb.tri(0.7, 4.2, 0.7, 0.7, 3.6, 0.7, 1.6 + rand() * 0.2, 3.95, 0.7, '#ff7a00');
  kb.tri(0.7, 3.6, 0.7, 0.7, 4.2, 0.7, 1.6, 3.95, 0.7, '#ff7a00');
}

/** Village place of worship. kind: 'temple' | 'templeSouth' | 'mosque' | 'chapel'. Footprint ≈ 10 × 10 m. */
export function worship(kb, kind, rand) {
  if (kind === 'temple') {
    kb.box(-5, 5, -0.3, 0.9, -5, 5, '#d9d2c4', { tile: TILE.CONCRETE, top: TILE.CONCRETE });
    kb.box(-2.6, 2.6, 0.9, 5, -2.6, 2.6, '#f4efe4', { top: TILE.PLAIN });
    kb.box(-1.8, 1.8, 0.9, 4, -5, -2.6, '#f4efe4'); // mandapa porch
    kb.box(-0.6, 0.6, 0.9, 2.8, -5.03, -5, '#3b2a1d', { faces: 'z' });
    // curvilinear shikhara as stacked tapering tiers
    for (let k = 0; k < 6; k++) {
      const r = 2.5 - k * 0.36;
      kb.box(-r, r, 5 + k * 1.1, 5 + (k + 1) * 1.1, -r, r, k % 2 ? '#f0e6cf' : '#f6efde', { top: TILE.PLAIN });
    }
    kb.shape('ico', 0, 12, 0, 0.55, 0.4, 0.55, '#d6a640');
    kb.cyl(0, 12.2, 0, 0.04, 0.04, 15.2, '#6b4a2e', 4);
    kb.tri(0, 15.2, 0, 0, 14.3, 0, 1.6, 14.75, 0, '#ff6f00');
    kb.tri(0, 14.3, 0, 0, 15.2, 0, 1.6, 14.75, 0, '#ff6f00');
  } else if (kind === 'templeSouth') {
    kb.box(-6, 6, -0.4, 3.2, -6, 6, '#ffffff', { tile: TILE.STRIPES, tw: 2, th: 3.6, faces: 'xXzZ' }); // striped compound wall
    let w = 4.2, d = 3, y = 3.2;
    kb.box(-w, w, -0.2, y, -6.3, -6 + d, '#efe0c0', { top: TILE.PLAIN });
    for (let k = 0; k < 4; k++) {
      kb.box(-w, w, y, y + 1.6, -6.3, -6 + d, ['#e7c28a', '#d79a6a', '#efd8a6', '#dba273'][k], { top: TILE.PLAIN });
      y += 1.6;
      w *= 0.82;
      d *= 0.82;
    }
    kb.gable(-w, w, y, y + 1.4, -6.3, -6 + d, '#d79a6a', TILE.PLAIN, '#d79a6a');
    kb.box(-2.5, 2.5, 0, 4, -1, 4, '#f3ead6', { top: TILE.PLAIN });
  } else if (kind === 'mosque') {
    kb.box(-5, 5, -0.3, 0.6, -5, 5, '#d9d2c4', { tile: TILE.CONCRETE, top: TILE.CONCRETE });
    kb.box(-4, 4, 0.6, 5, -3, 4, '#f4f2ec', { top: TILE.PLAIN });
    for (let k = -1; k <= 1; k++) kb.box(k * 2.6 - 0.8, k * 2.6 + 0.8, 0.6, 3.2, -3.03, -3, '#2f6f4f', { faces: 'z' });
    kb.shape('dome:10', 0, 5, 0.5, 2.6, 2.9, 2.6, '#f4f2ec');
    kb.shape('cone:6', 0, 8.4, 0.5, 0.15, 0.8, 0.15, '#d6a640');
    for (const x of [-4.4, 4.4]) {
      kb.cyl(x, 0.6, -3.4, 0.45, 0.35, 10, '#f4f2ec', 8);
      kb.shape('dome:8', x, 10, -3.4, 0.5, 0.7, 0.5, '#2f8f5f');
    }
  } else {
    // chapel (Konkan / coast): white gable front, red tiled roof, cross
    kb.box(-3.5, 3.5, 0, 6, -6, 6, '#f6f4ee', { top: TILE.PLAIN });
    kb.gable(-3.9, 3.9, 6, 8.6, -6.3, 6.3, '#ffffff', TILE.ROOF_TILES, '#f6f4ee', TILE.PLAIN, 2);
    kb.box(-3.6, 3.6, 0, 9.5, -6.4, -5.9, '#f6f4ee');
    kb.box(-0.12, 0.12, 9.5, 11.3, -6.25, -6.0, '#d2b057');
    kb.box(-0.55, 0.55, 10.5, 10.75, -6.25, -6.0, '#d2b057');
    kb.box(-0.9, 0.9, 0, 3.2, -6.43, -6.4, '#4a3020', { faces: 'z' });
  }
}

/** Village overhead water tank on concrete columns. */
export function waterTower(kb, rand) {
  const h = 13 + rand() * 6;
  const legs = 6;
  for (let k = 0; k < legs; k++) {
    const a = (k / legs) * Math.PI * 2;
    kb.cyl(Math.sin(a) * 2.6, -0.3, Math.cos(a) * 2.6, 0.28, 0.28, h, CONC, 5);
  }
  for (const y of [h * 0.35, h * 0.7]) kb.cyl(0, y, 0, 2.9, 2.9, y + 0.3, CONC, 8, { open: true });
  kb.cyl(0, h, 0, 2.2, 4.2, h + 2.2, '#c8c2b6', 10, { tile: TILE.CONCRETE });
  kb.cyl(0, h + 2.2, 0, 4.2, 4.2, h + 5.5, '#d6d0c4', 10, { tile: TILE.CONCRETE });
  kb.shape('cone:10', 0, h + 6.1, 0, 4.3, 1.2, 4.3, '#bdb7ab');
}

/** Chai stall: a little wooden counter under a tin roof, a kettle, a bench. */
export function chaiStall(kb) {
  kb.box(-1.2, 1.2, 0, 1.05, -0.6, 0.6, '#7a5634');
  kb.box(-1.25, 1.25, 1.05, 1.12, -0.65, 0.65, '#bfa27a');
  kb.cyl(-0.6, 1.12, 0, 0.2, 0.2, 1.25, '#3a3a3a', 6);
  kb.cyl(-0.6, 1.25, 0, 0.16, 0.12, 1.5, '#b8b8b0', 6); // kettle
  for (const x of [-1.15, 1.15]) for (const z of [-0.55, 0.55]) kb.box(x - 0.05, x + 0.05, 0, 2.3, z - 0.05, z + 0.05, '#6b4a2e');
  kb.slope(-1.5, 1.5, -1.3, 2.2, 0.9, 2.5, '#ffffff', TILE.TIN, 2);
  kb.slope(1.5, -1.5, 0.9, 2.5, -1.3, 2.2, '#6d7275');
  kb.box(-1.3, 1.3, 2.25, 2.65, -1.32, -1.28, '#ffffff', { tile: TILE.SIGN + 1, faces: 'z' }); // "CHAI" board
  kb.box(-1.0, 1.0, 0.42, 0.5, -2.1, -1.8, '#6b4a2e'); // bench
  for (const x of [-0.9, 0.9]) kb.box(x - 0.05, x + 0.05, 0, 0.42, -2.0, -1.9, '#6b4a2e');
}

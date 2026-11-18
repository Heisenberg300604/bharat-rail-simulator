// Trees and plants of the Indian countryside, low-poly and original:
// peepal, banyan (with aerial roots), mango, neem, areca and palmyra palms,
// banana, bamboo, thorny scrub (babool / prosopis), bushes and grass tufts.
// Built into a Kit at the current frame (origin on the ground). `sc` scales
// the whole plant; foliage uses the LEAVES tile tinted by its colour.
import { TILE } from '../sceneryAtlas.js';

const LEAF = { tile: TILE.LEAVES, uvScale: 2 };
const shade = (rand, cols) => cols[Math.floor(rand() * cols.length)];

function trunk(kb, x0, z0, x1, y1, z1, r0, r1, color = '#6a5440') {
  // a slightly bent trunk: two tapering segments
  const mx = (x0 + x1) / 2 + 0.2, mz = (z0 + z1) / 2, my = y1 * 0.5;
  kb.rod(x0, 0, z0, mx, my, mz, r0 * 2, color);
  kb.rod(mx, my - 0.1, mz, x1, y1, z1, (r0 + r1), color);
}

function crown(kb, rand, n, cx, cy, cz, rx, ry, cols, jitter = 0.18) {
  for (let k = 0; k < n; k++) {
    const a = rand() * Math.PI * 2;
    const d = k === 0 ? 0 : 0.35 + rand() * 0.45;
    const s = k === 0 ? 1 : 0.55 + rand() * 0.35;
    kb.shape('ico', cx + Math.cos(a) * rx * d, cy + (rand() - 0.3) * ry * 0.5, cz + Math.sin(a) * rx * d, rx * 0.62 * s, ry * 0.62 * s, rx * 0.62 * s, shade(rand, cols), { ...LEAF, jitter, yaw: rand() * 6 });
  }
}

/** Peepal (sacred fig): a broad, airy, light-green crown on a thick pale trunk. */
export function peepal(kb, rand, sc = 1) {
  const h = 7 * sc;
  trunk(kb, 0, 0, 0.3, h * 0.6, 0.2, 0.55 * sc, 0.35 * sc, '#8a7d6b');
  kb.rod(0.3, h * 0.55, 0.2, -1.8 * sc, h * 0.8, 0.6, 0.35 * sc, '#8a7d6b');
  kb.rod(0.3, h * 0.55, 0.2, 2.2 * sc, h * 0.85, -0.5, 0.35 * sc, '#8a7d6b');
  crown(kb, rand, 6, 0, h, 0, 6.5 * sc, 4.5 * sc, ['#6f9a3c', '#7aa647', '#628f35', '#86b052']);
}

/** Banyan: very wide dark crown, several trunks, aerial roots dropping to the ground. */
export function banyan(kb, rand, sc = 1) {
  const h = 8 * sc;
  for (let k = 0; k < 3; k++) trunk(kb, (k - 1) * 1.4 * sc, (rand() - 0.5) * 1.2, (k - 1) * 2.4 * sc, h * 0.7, (rand() - 0.5) * 2, 0.6 * sc, 0.4 * sc, '#7d7061');
  const R = 10 * sc;
  crown(kb, rand, 8, 0, h + 1, 0, R, 5 * sc, ['#3f6a2a', '#466f2e', '#365e24', '#4d7a33'], 0.15);
  const roots = 10 + Math.floor(rand() * 8);
  for (let k = 0; k < roots; k++) {
    const a = rand() * Math.PI * 2;
    const d = R * (0.3 + rand() * 0.55);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    const thick = rand() < 0.3;
    kb.rod(x, thick ? 0 : 1.5 + rand() * 2.5, z, x + (rand() - 0.5) * 0.4, h * 0.85, z, thick ? 0.28 * sc : 0.07, '#8a7a66');
  }
}

/** Mango: dense, dark, rounded dome on a short trunk. */
export function mango(kb, rand, sc = 1) {
  const h = 4.5 * sc;
  trunk(kb, 0, 0, 0.1, h * 0.7, 0, 0.35 * sc, 0.25 * sc, '#5b4633');
  crown(kb, rand, 5, 0, h + 1.2 * sc, 0, 4.6 * sc, 4.4 * sc, ['#2f5a24', '#36632a', '#2a5220', '#3c6a2e'], 0.12);
}

/** Neem: a lighter, feathery crown made of many small clumps. */
export function neem(kb, rand, sc = 1) {
  const h = 6 * sc;
  trunk(kb, 0, 0, -0.2, h * 0.7, 0.1, 0.3 * sc, 0.2 * sc, '#4f4034');
  for (let k = 0; k < 9; k++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 3.2 * sc;
    kb.shape('ico', Math.cos(a) * d, h + (rand() - 0.2) * 2.2 * sc, Math.sin(a) * d, 1.7 * sc, 1.3 * sc, 1.7 * sc, shade(rand, ['#5d8a35', '#6c983f', '#557f30', '#7aa249']), { ...LEAF, jitter: 0.25, yaw: rand() * 6 });
  }
}

/** Areca nut palm: very slender, straight, a small tuft of fronds. */
export function areca(kb, rand, sc = 1) {
  const h = (11 + rand() * 5) * sc;
  const lean = (rand() - 0.5) * 0.6;
  kb.rod(0, 0, 0, lean, h, 0, 0.2, '#9c9484');
  for (let f = 0; f < 7; f++) {
    const a = (f / 7) * Math.PI * 2 + rand();
    kb.sub(lean, h, 0, a, 0, 0, () => kb.obox(1.1, -0.35, 0, 2.4, 0.05, 0.5, 0, 0, -0.5, f % 2 ? '#5f8f33' : '#6c9c3b'));
  }
  kb.shape('ico', lean, h - 0.4, 0, 0.35, 0.6, 0.35, '#4f7a2c');
}

/** Palmyra (Borassus) palm: thick straight dark trunk, a ball of stiff fan leaves. */
export function palmyra(kb, rand, sc = 1) {
  const h = (12 + rand() * 6) * sc;
  kb.cyl(0, -0.2, 0, 0.42, 0.3, h, '#3d3530', 6, { tile: TILE.BARK });
  for (let f = 0; f < 18; f++) {
    const a = rand() * Math.PI * 2;
    const tilt = -0.6 + rand() * 1.6;
    kb.sub(0, h + 0.3, 0, a, 0, 0, () =>
      kb.sub(0.2, 0, 0, 0, 0, tilt, () => {
        // a fan: a few wedge triangles
        const col = f % 3 ? '#4f6b3a' : '#5e7a45';
        kb.rod(0, 0, 0, 1.0, 0.1, 0, 0.06, '#4a4a35'); // stalk
        for (let k = 0; k < 6; k++) {
          const t0 = -1.0 + k * 0.34, t1 = t0 + 0.34;
          kb.tri(1, 0, 0, 1 + 2.6 * Math.cos(t0), 0.3, 2.6 * Math.sin(t0), 1 + 2.6 * Math.cos(t1), 0.3, 2.6 * Math.sin(t1), col);
          kb.tri(1, 0, 0, 1 + 2.6 * Math.cos(t1), 0.3, 2.6 * Math.sin(t1), 1 + 2.6 * Math.cos(t0), 0.3, 2.6 * Math.sin(t0), col);
        }
      }),
    );
  }
  kb.shape('ico', 0, h + 0.2, 0, 0.8, 0.7, 0.8, '#3b3a2a');
}

/** Banana: a short pseudo-stem and broad drooping leaves; usually in clumps. */
export function banana(kb, rand, sc = 1) {
  const h = (2.4 + rand()) * sc;
  kb.cyl(0, -0.1, 0, 0.18, 0.12, h, '#7f9a4c', 6);
  const n = 6 + Math.floor(rand() * 3);
  for (let f = 0; f < n; f++) {
    const a = (f / n) * Math.PI * 2 + rand() * 0.5;
    const torn = rand() < 0.3;
    kb.sub(0, h, 0, a, 0, 0, () => kb.obox(1.0 * sc, -0.1, 0, 2.2 * sc, 0.04, torn ? 0.45 : 0.75, 0, 0, -0.35 - rand() * 0.5, f % 2 ? '#78a83a' : '#8bbb45'));
  }
}

/** Bamboo clump: many tall culms leaning outwards with feathery tops. */
export function bamboo(kb, rand, sc = 1) {
  const n = 22 + Math.floor(rand() * 14);
  for (let k = 0; k < n; k++) {
    const a = rand() * Math.PI * 2;
    const r0 = rand() * 1.0;
    const h = (8 + rand() * 6) * sc;
    const lean = 0.8 + rand() * 2.6;
    const x0 = Math.cos(a) * r0, z0 = Math.sin(a) * r0;
    const x1 = Math.cos(a) * (r0 + lean), z1 = Math.sin(a) * (r0 + lean);
    kb.rod(x0, 0, z0, x1, h, z1, 0.09, k % 3 ? '#8fa04e' : '#a3a95a');
    // feathery foliage along the upper third, drooping outwards
    for (let j = 0; j < 3; j++) {
      const t = 0.62 + j * 0.15;
      const ox = x0 + (x1 - x0) * t + Math.cos(a) * 0.6, oz = z0 + (z1 - z0) * t + Math.sin(a) * 0.6;
      kb.shape('ico', ox, h * t, oz, 0.75, 0.45, 0.75, j % 2 ? '#86ad4c' : '#9cbf5c', { ...LEAF, jitter: 0.35, yaw: a + j });
    }
  }
}

/** Thorny scrub (babool / prosopis): crooked multi-stemmed, a flat dark-olive canopy. */
export function scrub(kb, rand, sc = 1) {
  const h = (2.6 + rand() * 1.4) * sc;
  for (let k = 0; k < 3; k++) {
    const a = rand() * Math.PI * 2;
    kb.rod(0, 0, 0, Math.cos(a) * 1.4 * sc, h, Math.sin(a) * 1.4 * sc, 0.12, '#4a3d30');
  }
  for (let k = 0; k < 4; k++) {
    const a = rand() * Math.PI * 2;
    const d = rand() * 1.8 * sc;
    kb.shape('ico', Math.cos(a) * d, h + 0.2, Math.sin(a) * d, 2.0 * sc, 0.7 * sc, 2.0 * sc, shade(rand, ['#56613a', '#4c5833', '#606b40']), { ...LEAF, jitter: 0.25 });
  }
}

/** Low bush. */
export function bush(kb, rand, sc = 1) {
  const n = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < n; k++) {
    kb.shape('ico', (rand() - 0.5) * 1.4 * sc, 0.6 * sc, (rand() - 0.5) * 1.4 * sc, 0.9 * sc, 0.7 * sc, 0.9 * sc, shade(rand, ['#4f7a2e', '#5c8536', '#6a8f3e', '#47702a']), { ...LEAF, jitter: 0.25, yaw: rand() * 6 });
  }
}

/** Tuft of tall grass (kans / sarkanda) — a cluster of thin blades. */
export function grass(kb, rand, sc = 1, color = '#8a9a52') {
  const n = 5 + Math.floor(rand() * 4);
  for (let k = 0; k < n; k++) {
    const a = rand() * Math.PI * 2;
    const h = (0.7 + rand() * 0.9) * sc;
    const x = Math.cos(a) * 0.35 * h, z = Math.sin(a) * 0.35 * h;
    kb.tri(-0.05, 0, 0, 0.05, 0, 0, x, h, z, color);
    kb.tri(0.05, 0, 0, -0.05, 0, 0, x, h, z, color);
  }
}

export const PLANTS = { peepal, banyan, mango, neem, areca, palmyra, banana, bamboo, scrub, bush, grass };

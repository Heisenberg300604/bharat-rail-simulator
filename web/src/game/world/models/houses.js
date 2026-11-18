// Indian houses, built into a Kit (world/kit.js). Original procedural models.
//
// Convention: the Kit's frame is already placed at the centre of the
// footprint on the ground; local x = width, local z = depth, the FRONT is the
// −z face (placement turns it towards the track or the road). `plinth` is how
// far the ground floor sits above the local origin (it absorbs sloping ground).
import { TILE, SIGN_COUNT } from '../sceneryAtlas.js';

const CONC = '#bdb6aa';
const SLAB = '#c9c2b5';
const REBAR = '#6b3f2a';
const TANK = '#1d1d1d';
const pick = (rand, a) => a[Math.floor(rand() * a.length)];

/** Black plastic roof tank on a little stand (the "Sintex" every roof has). */
export function roofTank(kb, x, y, z, rand) {
  const col = rand() < 0.8 ? TANK : rand() < 0.5 ? '#2f5f9e' : '#e4e1d8';
  kb.box(x - 0.55, x + 0.55, y, y + 0.35, z - 0.55, z + 0.55, CONC);
  kb.cyl(x, y + 0.35, z, 0.62, 0.62, y + 1.55, col, 8);
}

function rebar(kb, x0, x1, y, z0, z1) {
  for (const [x, z] of [
    [x0 + 0.15, z0 + 0.15],
    [x1 - 0.15, z0 + 0.15],
    [x0 + 0.15, z1 - 0.15],
    [x1 - 0.15, z1 - 0.15],
  ]) {
    kb.box(x - 0.15, x + 0.15, y, y + 0.35, z - 0.15, z + 0.15, CONC); // column stub
    for (const dx of [-0.07, 0.07]) kb.rod(x + dx, y + 0.3, z, x + dx * 1.6, y + 1.5, z + 0.04, 0.03, REBAR);
  }
}

function parapet(kb, x0, x1, y, z0, z1, color, h = 0.9) {
  const t = 0.15;
  kb.box(x0, x1, y, y + h, z0, z0 + t, color, { faces: 'xXYzZ' });
  kb.box(x0, x1, y, y + h, z1 - t, z1, color, { faces: 'xXYzZ' });
  kb.box(x0, x0 + t, y, y + h, z0 + t, z1 - t, color, { faces: 'xXY' });
  kb.box(x1 - t, x1, y, y + h, z0 + t, z1 - t, color, { faces: 'xXY' });
}

function clothesLine(kb, x0, x1, y, z, rand) {
  kb.rod(x0, y, z, x0, y + 1.6, z, 0.05, '#555');
  kb.rod(x1, y, z, x1, y + 1.6, z, 0.05, '#555');
  kb.rod(x0, y + 1.55, z, x1, y + 1.5, z, 0.015, '#333');
  const n = 2 + Math.floor(rand() * 4);
  for (let k = 0; k < n; k++) {
    const x = x0 + ((k + 0.5) / n) * (x1 - x0);
    const w = 0.4 + rand() * 0.7;
    const c = pick(rand, ['#c2185b', '#f9a825', '#1565c0', '#2e7d32', '#ffffff', '#e65100', '#6a1b9a']);
    kb.quad([x - w / 2, y + 0.75, z], [x + w / 2, y + 0.75, z], [x + w / 2, y + 1.5, z], [x - w / 2, y + 1.5, z], c);
    kb.quad([x + w / 2, y + 0.75, z], [x - w / 2, y + 0.75, z], [x - w / 2, y + 1.5, z], [x + w / 2, y + 1.5, z], c);
  }
}

function dish(kb, x, y, z, rand) {
  kb.rod(x, y, z, x, y + 0.7, z, 0.04, '#777');
  kb.shape('cyl:8', x, y + 0.8, z - 0.05, 0.35, 0.04, 0.35, '#e8e8e8', { pitch: -1.0, yaw: rand() * 6.28 });
}

/** Shop front on the ground floor's −z face: shutter or open shop, signboard, maybe an awning. */
function shopFront(kb, w, d, plinth, rand) {
  const z = -d / 2;
  kb.box(-w / 2, w / 2, plinth, plinth + 3, -d / 2, d / 2, '#e9e3d6', { tile: TILE.WIN, tw: 4, th: 3, front: rand() < 0.55 ? TILE.SHOP : TILE.SHUTTER, faces: 'xXzZ' });
  const sign = TILE.SIGN + Math.floor(rand() * SIGN_COUNT);
  kb.box(-w / 2 + 0.2, w / 2 - 0.2, plinth + 2.45, plinth + 3.25, z - 0.18, z - 0.02, '#ffffff', { tile: sign, faces: 'z' });
  if (rand() < 0.55) {
    const c = pick(rand, ['#2f6db3', '#c62828', '#2e7d32', '#f9a825', '#e0e0e0']);
    kb.slope(-w / 2, w / 2, z - 1.7, plinth + 2.25, z - 0.02, plinth + 2.45, c, rand() < 0.5 ? TILE.TARP : TILE.PLAIN);
    kb.slope(w / 2, -w / 2, z - 0.02, plinth + 2.45, z - 1.7, plinth + 2.25, c); // underside
  }
}

/**
 * Flat-roofed RCC house: the house of north-Indian towns and villages.
 * o: { w, d, floors, color, plinth, rand, shop, unfinished, grille }
 */
export function flatHouse(kb, o) {
  const { w, d, floors, color, plinth, rand } = o;
  const tile = o.grille ? TILE.WIN_GRILLE : TILE.WIN;
  kb.box(-w / 2 - 0.15, w / 2 + 0.15, 0, plinth + 0.2, -d / 2 - 0.15, d / 2 + 0.15, CONC, { faces: 'xXzZ' });
  const y0 = plinth;
  let first = 0;
  if (o.shop) {
    shopFront(kb, w, d, y0, rand);
    first = 1;
  }
  const top = y0 + floors * 3;
  if (floors > first) kb.box(-w / 2, w / 2, y0 + first * 3, top, -d / 2, d / 2, color, { tile, tw: 4, th: 3, top: TILE.CONCRETE, topColor: SLAB });
  else kb.box(-w / 2, w / 2, top - 0.01, top, -d / 2, d / 2, color, { tile: TILE.CONCRETE, topColor: SLAB, faces: 'Y' });
  // floor slabs projecting a little: the horizontal lines of every Indian street
  for (let f = 1; f <= floors; f++) kb.box(-w / 2 - 0.12, w / 2 + 0.12, y0 + f * 3 - 0.14, y0 + f * 3 + 0.02, -d / 2 - 0.3, d / 2 + 0.12, SLAB, { tile: TILE.CONCRETE });
  // front balconies on upper floors
  if (floors >= 2 && rand() < 0.45) {
    for (let f = 1; f < floors; f++) {
      const bw = Math.min(w - 1, 3 + rand() * 3);
      const bx = (rand() - 0.5) * (w - bw - 0.5);
      kb.box(bx - bw / 2, bx + bw / 2, y0 + f * 3 - 0.15, y0 + f * 3 + 0.05, -d / 2 - 1.2, -d / 2, SLAB, { tile: TILE.CONCRETE });
      kb.box(bx - bw / 2, bx + bw / 2, y0 + f * 3 + 0.05, y0 + f * 3 + 1.0, -d / 2 - 1.2, -d / 2 - 1.1, rand() < 0.5 ? color : '#5f6a6e', { faces: 'zZY' });
    }
  }
  // roof: parapet, stair room (mumty), tank, rebar, washing, dish
  parapet(kb, -w / 2, w / 2, top, -d / 2, d / 2, color);
  const sx = (rand() < 0.5 ? -1 : 1) * (w / 2 - 1.7);
  if (rand() < 0.75) {
    kb.box(sx - 1.5, sx + 1.5, top, top + 2.6, d / 2 - 3.2, d / 2, color, { tile: TILE.PLAIN, top: TILE.CONCRETE, topColor: SLAB });
    roofTank(kb, sx, top + 2.6, d / 2 - 1.6, rand);
  } else roofTank(kb, -sx * 0.6, top, 0, rand);
  if (o.unfinished ?? rand() < 0.35) rebar(kb, -w / 2, w / 2, top + 0.9, -d / 2, d / 2);
  if (rand() < 0.35) clothesLine(kb, -w / 2 + 0.8, Math.min(w / 2 - 0.8, -w / 2 + 5), top, -d / 2 + 1.2, rand);
  if (rand() < 0.3) dish(kb, w / 2 - 0.6, top + 0.9, -d / 2 + 0.4, rand);
}

/** Exposed-brick house: unplastered, often with the ground floor plastered and painted. */
export function brickHouse(kb, o) {
  const { w, d, floors, color, plinth, rand } = o;
  kb.box(-w / 2 - 0.12, w / 2 + 0.12, 0, plinth + 0.15, -d / 2 - 0.12, d / 2 + 0.12, CONC, { faces: 'xXzZ' });
  const y0 = plinth;
  const top = y0 + floors * 3;
  const plasteredGround = floors >= 2 && rand() < 0.5;
  if (plasteredGround) kb.box(-w / 2, w / 2, y0, y0 + 3, -d / 2, d / 2, color, { tile: TILE.WIN, tw: 4, th: 3, faces: 'xXzZ' });
  kb.box(-w / 2, w / 2, plasteredGround ? y0 + 3 : y0, top, -d / 2, d / 2, '#ffffff', { tile: TILE.BRICK_WIN, tw: 4, th: 3, top: TILE.CONCRETE, topColor: SLAB });
  for (let f = 1; f <= floors; f++) kb.box(-w / 2 - 0.08, w / 2 + 0.08, y0 + f * 3 - 0.14, y0 + f * 3 + 0.02, -d / 2 - 0.08, d / 2 + 0.08, SLAB, { tile: TILE.CONCRETE });
  // a half-built room on the roof, raw brick
  if (rand() < 0.5) {
    const hw = Math.min(w - 1, 3.5 + rand() * 2);
    kb.box(-w / 2, -w / 2 + hw, top, top + 1.4 + rand() * 1.4, d / 2 - 3.5, d / 2, '#ffffff', { tile: TILE.BRICK, tw: 4, th: 3 });
  } else parapet(kb, -w / 2, w / 2, top, -d / 2, d / 2, '#ffffff', 0.7);
  rebar(kb, -w / 2, w / 2, top, -d / 2, d / 2);
  if (rand() < 0.6) roofTank(kb, w / 4, top, -d / 4, rand);
  if (rand() < 0.4) clothesLine(kb, 0, Math.min(w / 2 - 0.5, 4), top, 0, rand);
}

/** Tiled-roof house (Konkan, Goa, Kerala, the ghats): bright walls or laterite, verandah. */
export function tiledHouse(kb, o) {
  const { w, d, floors, color, plinth, rand } = o;
  const laterite = o.laterite;
  const wallCol = laterite ? '#b5603d' : color;
  const wallTile = laterite ? TILE.STONE : TILE.WIN;
  kb.box(-w / 2 - 0.2, w / 2 + 0.2, 0, plinth + 0.45, -d / 2 - 2.0, d / 2 + 0.2, '#9a8f80', { tile: TILE.CONCRETE, top: TILE.CONCRETE }); // plinth + verandah floor
  const y0 = plinth + 0.45;
  const h = floors * 3;
  kb.box(-w / 2, w / 2, y0, y0 + h, -d / 2, d / 2, wallCol, { tile: wallTile, tw: laterite ? 2 : 4, th: laterite ? 1 : 3, faces: 'xXzZ' });
  if (laterite) {
    // a window or two cut in the laterite
    for (const x of [-w / 4, w / 4]) kb.box(x - 0.55, x + 0.55, y0 + 1, y0 + 2.1, -d / 2 - 0.03, -d / 2, '#2b2620', { faces: 'z' });
  }
  const ov = 0.8;
  const ridge = y0 + h + Math.max(1.6, d * 0.32);
  const roofCol = rand() < 0.15 ? '#8a8f92' : '#ffffff';
  const roofTile = roofCol === '#ffffff' ? TILE.ROOF_TILES : TILE.TIN;
  if (rand() < 0.5) kb.hip(-w / 2 - ov, w / 2 + ov, y0 + h - 0.2, ridge, -d / 2 - ov, d / 2 + ov, roofCol, roofTile, 2);
  else kb.gable(-w / 2 - ov, w / 2 + ov, y0 + h - 0.2, ridge, -d / 2 - ov, d / 2 + ov, roofCol, roofTile, wallCol, wallTile, 2);
  // verandah: lean-to roof on posts across the front
  const vz = -d / 2 - 2.2;
  kb.slope(-w / 2, w / 2, vz, y0 + 2.3, -d / 2, y0 + h - 0.3, roofCol, roofTile, 2);
  for (const x of [-w / 2 + 0.3, 0, w / 2 - 0.3]) kb.box(x - 0.12, x + 0.12, y0, y0 + 2.3, vz + 0.2, vz + 0.44, rand() < 0.5 ? '#f1ece0' : '#6b4a2e');
}

/** Hut: mud walls, thatch or tin roof. Villages in Bengal, the coast, the plains. */
export function hut(kb, o) {
  const { w, d, plinth, rand } = o;
  const h = 2.3 + rand() * 0.4;
  kb.box(-w / 2 - 0.2, w / 2 + 0.2, 0, plinth + 0.3, -d / 2 - 0.2, d / 2 + 0.2, '#8a6a48', { tile: TILE.MUD });
  const y0 = plinth + 0.3;
  kb.box(-w / 2, w / 2, y0, y0 + h, -d / 2, d / 2, rand() < 0.3 ? '#d9c7a0' : '#ffffff', { tile: TILE.MUD, tw: 3, th: 3, faces: 'xXzZ' });
  kb.box(-0.45, 0.45, y0, y0 + 1.7, -d / 2 - 0.03, -d / 2, '#3a2a1c', { faces: 'z' }); // doorway
  const ov = 0.6;
  if (o.roof === 'tin') {
    kb.slope(-w / 2 - ov, w / 2 + ov, -d / 2 - ov, y0 + h - 0.1, d / 2 + ov, y0 + h + 0.7, '#ffffff', TILE.TIN, 2);
    kb.slope(w / 2 + ov, -w / 2 - ov, d / 2 + ov, y0 + h + 0.7, -d / 2 - ov, y0 + h - 0.1, '#6d7275');
    kb.box(-w / 2, w / 2, y0 + h, y0 + h + 0.6, d / 2 - 0.1, d / 2, '#ffffff', { tile: TILE.MUD, faces: 'Z' });
  } else {
    const ridge = y0 + h + Math.max(1.4, d * 0.42);
    kb.gable(-w / 2 - ov, w / 2 + ov, y0 + h - 0.3, ridge, -d / 2 - ov, d / 2 + ov, '#ffffff', TILE.THATCH, '#ffffff', TILE.MUD, 2.5);
  }
}

/** Slum shack: brick / tin / board walls, tin or blue tarpaulin roof weighed down with bricks and tyres. */
export function shack(kb, o) {
  const { w, d, plinth, rand } = o;
  const h = 2.1 + rand() * 0.6;
  const wall = rand();
  const wallTile = wall < 0.45 ? TILE.BRICK : wall < 0.75 ? TILE.TIN : TILE.MUD;
  kb.box(-w / 2, w / 2, 0, plinth + h, -d / 2, d / 2, '#ffffff', { tile: wallTile, tw: 3, th: 3, faces: 'xXzZ' });
  kb.box(-0.4, 0.4, plinth, plinth + 1.7, -d / 2 - 0.03, -d / 2, rand() < 0.5 ? '#3a2a1c' : pick(rand, ['#c2185b', '#1565c0', '#f9a825']), { faces: 'z' }); // door / curtain
  const tarp = rand() < 0.55;
  const y = plinth + h;
  kb.slope(-w / 2 - 0.25, w / 2 + 0.25, -d / 2 - 0.4, y, d / 2 + 0.2, y + 0.35, '#ffffff', tarp ? TILE.TARP : TILE.TIN, 2);
  kb.slope(w / 2 + 0.25, -w / 2 - 0.25, d / 2 + 0.2, y + 0.35, -d / 2 - 0.4, y, '#555b5e');
  const weights = 1 + Math.floor(rand() * 3);
  for (let k = 0; k < weights; k++) {
    const x = (rand() - 0.5) * (w - 0.6);
    const z = (rand() - 0.5) * (d - 0.6);
    const yy = y + 0.2 + ((z + d / 2) / d) * 0.2;
    if (rand() < 0.5) kb.cyl(x, yy, z, 0.32, 0.32, yy + 0.18, '#1b1b1b', 8);
    else kb.box(x - 0.12, x + 0.12, yy, yy + 0.08, z - 0.06, z + 0.06, '#9c4a32');
  }
}

/** Apartment block near big stations: grilled windows, balconies on every floor, tanks on the roof. */
export function apartment(kb, o) {
  const { w, d, floors, color, plinth, rand } = o;
  kb.box(-w / 2 - 0.2, w / 2 + 0.2, 0, plinth + 0.2, -d / 2 - 0.2, d / 2 + 0.2, CONC, { faces: 'xXzZ' });
  const y0 = plinth;
  const top = y0 + floors * 3;
  kb.box(-w / 2, w / 2, y0, top, -d / 2, d / 2, color, { tile: TILE.WIN_GRILLE, tw: 4, th: 3, top: TILE.CONCRETE, topColor: SLAB });
  // a contrasting vertical band (stairwell) on the front
  const band = rand() < 0.6;
  if (band) kb.box(-1.6, 1.6, y0, top + 2.8, -d / 2 - 0.25, -d / 2 + 2.5, pick(rand, ['#c9b48f', '#a65d4e', '#8d9aa6', '#e8e2d6']), { tile: TILE.WIN, tw: 3.2, th: 3, top: TILE.CONCRETE, topColor: SLAB });
  for (let f = 1; f < floors; f++) {
    const y = y0 + f * 3;
    kb.box(-w / 2 + 0.4, w / 2 - 0.4, y - 0.15, y + 0.05, -d / 2 - 1.1, -d / 2, SLAB, { tile: TILE.CONCRETE });
    kb.box(-w / 2 + 0.4, w / 2 - 0.4, y + 0.05, y + 1.0, -d / 2 - 1.1, -d / 2 - 1.0, color, { faces: 'zZY' });
  }
  parapet(kb, -w / 2, w / 2, top, -d / 2, d / 2, color, 1.0);
  if (!band) kb.box(-1.6, 1.6, top, top + 2.8, d / 2 - 4, d / 2 - 0.5, color, { top: TILE.CONCRETE, topColor: SLAB });
  const tanks = 2 + Math.floor(rand() * 4);
  for (let k = 0; k < tanks; k++) roofTank(kb, -w / 2 + 1.2 + (k * (w - 2.4)) / Math.max(1, tanks - 1), top, d / 2 - 1.3, rand);
  if (rand() < 0.5) {
    // mobile antenna mast on the roof
    kb.rod(w / 2 - 1.5, top, -d / 2 + 1.5, w / 2 - 1.5, top + 6, -d / 2 + 1.5, 0.14, '#9aa0a3');
    for (let a = 0; a < 3; a++) kb.obox(w / 2 - 1.5 + Math.sin(a * 2.1) * 0.3, top + 5.2, -d / 2 + 1.5 + Math.cos(a * 2.1) * 0.3, 0.3, 1.2, 0.12, a * 2.1, 0, 0, '#eeeeee');
  }
}

/** The house kinds placement can ask for. */
export const HOUSES = { flat: flatHouse, brick: brickHouse, tiled: tiledHouse, hut, shack, apartment };

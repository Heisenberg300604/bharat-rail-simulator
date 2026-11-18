// Animals of the Indian countryside, low-poly and original: humped zebu cows,
// water buffalo, goats, pariah dogs and cattle egrets. Static (grazing,
// standing, lying) and built into a Kit at the current frame; the animal faces
// local −z, origin on the ground.

const leg = (kb, x, z, h, t, c) => kb.box(x - t / 2, x + t / 2, 0, h, z - t / 2, z + t / 2, c, { faces: 'xXzZ' });

/** Zebu cow: hump, dewlap, short horns. pose: 'graze' | 'stand' | 'lie'. */
export function cow(kb, color, pose = 'stand') {
  const dark = '#3b3631';
  const lie = pose === 'lie';
  const y = lie ? 0.15 : 0.78;
  if (!lie) for (const [x, z] of [[-0.22, -0.55], [0.22, -0.55], [-0.22, 0.55], [0.22, 0.55]]) leg(kb, x, z, 0.85, 0.14, color);
  kb.shape('sphere:8', 0, y + 0.42, 0, 0.36, 0.38, 0.85, color);
  kb.shape('ico', 0, y + 0.8, -0.45, 0.22, 0.2, 0.25, color); // hump
  const graze = pose === 'graze';
  const hy = graze ? y + 0.05 : y + 0.75, hz = graze ? -1.15 : -1.05;
  kb.rod(0, y + 0.55, -0.7, 0, hy + 0.05, hz + 0.1, 0.28, color); // neck
  kb.obox(0, hy, hz, 0.24, 0.26, 0.5, 0, graze ? 1.1 : 0.2, 0, color); // head
  kb.obox(0, hy - (graze ? 0.22 : 0.08), hz - (graze ? 0.1 : 0.24), 0.18, 0.14, 0.14, 0, 0, 0, dark); // muzzle
  for (const s of [-1, 1]) kb.rod(s * 0.08, hy + 0.12, hz + 0.15, s * 0.2, hy + 0.35, hz + 0.2, 0.05, '#c9bba0'); // horns
  kb.rod(0, y + 0.7, 0.8, 0, y - 0.15, 0.95, 0.05, color); // tail
}

/** Water buffalo: black, heavy, swept-back horns. */
export function buffalo(kb, pose = 'stand') {
  const c = '#262422';
  const lie = pose === 'lie';
  const y = lie ? 0.15 : 0.72;
  if (!lie) for (const [x, z] of [[-0.25, -0.6], [0.25, -0.6], [-0.25, 0.6], [0.25, 0.6]]) leg(kb, x, z, 0.8, 0.17, c);
  kb.shape('sphere:8', 0, y + 0.45, 0, 0.46, 0.45, 0.95, c);
  const graze = pose === 'graze';
  const hy = graze ? y + 0.05 : y + 0.55, hz = graze ? -1.2 : -1.15;
  kb.rod(0, y + 0.5, -0.8, 0, hy + 0.05, hz + 0.1, 0.34, c);
  kb.obox(0, hy, hz, 0.3, 0.3, 0.55, 0, graze ? 1.1 : 0.3, 0, c);
  for (const s of [-1, 1]) {
    kb.rod(s * 0.12, hy + 0.15, hz + 0.1, s * 0.45, hy + 0.18, hz + 0.35, 0.07, '#4a453e');
    kb.rod(s * 0.45, hy + 0.18, hz + 0.35, s * 0.35, hy + 0.35, hz + 0.6, 0.06, '#4a453e');
  }
}

/** Goat. */
export function goat(kb, color, pose = 'graze') {
  for (const [x, z] of [[-0.1, -0.25], [0.1, -0.25], [-0.1, 0.25], [0.1, 0.25]]) leg(kb, x, z, 0.45, 0.06, '#3a332c');
  kb.shape('sphere:6', 0, 0.62, 0, 0.18, 0.2, 0.4, color);
  const graze = pose === 'graze';
  kb.obox(0, graze ? 0.32 : 0.82, -0.5, 0.13, 0.15, 0.28, 0, graze ? 1.2 : 0.4, 0, color);
  for (const s of [-1, 1]) kb.rod(s * 0.05, graze ? 0.45 : 0.95, -0.42, s * 0.12, graze ? 0.55 : 1.08, -0.3, 0.025, '#5a5048'); // horns
}

/** Pariah dog, standing or curled up asleep. */
export function dog(kb, color, pose = 'lie') {
  if (pose === 'lie') {
    kb.shape('sphere:6', 0, 0.2, 0, 0.32, 0.2, 0.45, color);
    kb.shape('sphere:6', 0.15, 0.22, -0.4, 0.13, 0.12, 0.17, color);
    return;
  }
  for (const [x, z] of [[-0.08, -0.25], [0.08, -0.25], [-0.08, 0.25], [0.08, 0.25]]) leg(kb, x, z, 0.38, 0.06, color);
  kb.shape('sphere:6', 0, 0.48, 0, 0.14, 0.15, 0.36, color);
  kb.obox(0, 0.65, -0.42, 0.13, 0.13, 0.25, 0, 0.2, 0, color);
  for (const s of [-1, 1]) kb.tri(s * 0.04, 0.72, -0.38, s * 0.1, 0.72, -0.4, s * 0.07, 0.84, -0.39, color);
  kb.rod(0, 0.55, 0.33, 0, 0.72, 0.5, 0.04, color);
}

/** Cattle egret: small white heron that follows grazing cattle and ploughs. */
export function egret(kb) {
  const w = '#f4f2ea';
  kb.rod(-0.03, 0, 0, -0.03, 0.32, 0.02, 0.015, '#3a3a30');
  kb.rod(0.03, 0, 0, 0.03, 0.32, 0.02, 0.015, '#3a3a30');
  kb.shape('sphere:6', 0, 0.42, 0.02, 0.09, 0.1, 0.17, w);
  kb.rod(0, 0.45, -0.1, 0, 0.6, -0.14, 0.035, w);
  kb.obox(0, 0.62, -0.19, 0.05, 0.05, 0.1, 0, 0, 0, w);
  kb.obox(0, 0.61, -0.27, 0.02, 0.02, 0.08, 0, 0, 0, '#e3b13d');
}

export const COW_COLOURS = ['#ece9e0', '#d9d3c6', '#bcb5a8', '#8c6a4a', '#a0805c', '#e6e0d2'];
export const GOAT_COLOURS = ['#2a2522', '#7b5636', '#e7e2d6', '#4a3a2c', '#a07850'];
export const DOG_COLOURS = ['#b78a55', '#c9a06a', '#2a2522', '#8a6a48', '#d8c3a0'];

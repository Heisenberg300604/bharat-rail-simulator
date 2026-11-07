// Procedural textures drawn on a 2D <canvas> — original artwork, no downloads.
import * as THREE from 'three';
import { seededRandom } from './geometry.js';

function canvasTexture(canvas, { repeat = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

/** Speckled noise: used for ground and ballast so flat colours look less plastic. */
export function makeNoiseTexture({ size = 256, base = '#888', speckles = [], density = 0.5, seed = 1 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const rand = seededRandom(seed);
  const n = size * size * density * 0.1;
  for (let i = 0; i < n; i++) {
    g.fillStyle = speckles[Math.floor(rand() * speckles.length)];
    const r = 1 + rand() * 2.5;
    g.fillRect(rand() * size, rand() * size, r, r);
  }
  return canvasTexture(c);
}

// macOS fonts first, then Windows (Nirmala UI / Mangal), then Linux/Android (Noto)
const DEVANAGARI = "'Kohinoor Devanagari','Devanagari Sangam MN','Nirmala UI','Mangal','Noto Sans Devanagari',sans-serif";

/**
 * Yellow station name board in the familiar Indian style (Hindi + English).
 * Generic style only — no official logos.
 */
export function makeStationBoardTexture(hindi, english) {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#f5c518';
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#111';
  g.lineWidth = 14;
  g.strokeRect(10, 10, c.width - 20, c.height - 20);
  g.fillStyle = '#111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold 100px ${DEVANAGARI}`;
  g.fillText(hindi, c.width / 2, 105);
  g.font = 'bold 96px Helvetica, Arial, sans-serif';
  g.fillText(english.toUpperCase(), c.width / 2, 225);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Simple text plate (e.g. the "STOP" board for the locomotive). */
export function makePlateTexture(text, { bg = '#fff', fg = '#111', width = 256, height = 256, font = 'bold 120px Helvetica, Arial, sans-serif' } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, width, height);
  g.strokeStyle = fg;
  g.lineWidth = 12;
  g.strokeRect(6, 6, width - 12, height - 12);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font;
  g.fillText(text, width / 2, height / 2 + 6);
  const tex = canvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Coach side: window band with dark glazing, drawn once and tiled along the body. */
export function makeWindowStripTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e8dcc0';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#1f2a33';
  g.beginPath();
  g.roundRect(28, 10, 200, 44, 8);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(36, 14, 70, 10);
  return canvasTexture(c);
}

/** Ballast: dense grey-brown stones with darker oily centre strip (from trains). */
export function makeBallastTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = '#6f6860';
  g.fillRect(0, 0, size, size);
  const rand = seededRandom(5);
  const tones = ['#5a544d', '#857d73', '#9a9288', '#4c4742', '#7a7168', '#a69f95', '#635b52'];
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = tones[Math.floor(rand() * tones.length)];
    const x = rand() * size;
    const y = rand() * size;
    const r = 1.2 + rand() * 2.8;
    g.beginPath();
    g.ellipse(x, y, r, r * (0.6 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
    g.fill();
  }
  // V coordinate runs across the ballast profile edge; darken the middle (rust/oil stain)
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, 'rgba(60,40,25,0.0)');
  grad.addColorStop(0.5, 'rgba(70,45,25,0.18)');
  grad.addColorStop(1, 'rgba(60,40,25,0.0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return canvasTexture(c);
}

/**
 * Building facade: rows of windows with sunshades and floor bands, on a white
 * base so per-instance colours can tint the plaster (pink, yellow, blue…).
 * One tile = one floor (3 m) × one bay (4 m).
 */
export function makeFacadeTexture() {
  const w = 128;
  const h = 96;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#f2efe8';
  g.fillRect(0, 0, w, h);
  const rand = seededRandom(9);
  for (let i = 0; i < 500; i++) {
    g.fillStyle = `rgba(80,70,60,${rand() * 0.08})`;
    g.fillRect(rand() * w, rand() * h, 2 + rand() * 6, 2 + rand() * 6);
  }
  g.fillStyle = '#d8d2c6';
  g.fillRect(0, h - 8, w, 8); // floor band
  g.fillStyle = '#2b3036';
  g.fillRect(36, 24, 56, 40); // window
  g.fillStyle = '#5d6a73';
  g.fillRect(40, 28, 22, 32);
  g.fillStyle = '#bdb6a8';
  g.fillRect(30, 16, 68, 7); // chajja (sunshade)
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.fillRect(30, 23, 68, 3);
  return canvasTexture(c);
}

/**
 * LHB coach side, drawn in real metres from reference photos of LHB AC 3-tier
 * coaches: red upper body, grey lower band from the body bottom (1.05 m above
 * rail) to 1.79 m, eight rounded windows (1.36 × 0.86 m, one per bay, 2.16 m
 * pitch), doors and toilet windows at both ends, yellow destination boards.
 * Texture spans the whole side: 23.54 m long × 2.6 m (1.05 → 3.65 m above rail).
 */
export const LHB_SIDE = { length: 23.54, bottom: 1.05, top: 3.65 };

export function makeLhbSideTexture({ primary, secondary = '#b9bdc1', label = 'AC 3 TIER', hindi = 'वातानुकूलित 3-टियर', route = ['NEW DELHI', 'GHAZIABAD'] }) {
  const W = 4096;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const L = LHB_SIDE.length;
  const sx = W / L;
  const sy = H / (LHB_SIDE.top - LHB_SIDE.bottom);
  // helpers in metres: x from the coach's left end (as seen from outside), y above rail
  const X = (m) => m * sx;
  const Y = (m) => (LHB_SIDE.top - m) * sy;
  const rect = (x0, y0, x1, y1) => [X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1)];
  const rrect = (x0, y0, x1, y1, r) => {
    g.beginPath();
    g.roundRect(X(x0), Y(y1), X(x1) - X(x0), Y(y0) - Y(y1), [r * sx]);
  };

  // livery
  g.fillStyle = primary;
  g.fillRect(...rect(0, 1.79, L, 3.65));
  g.fillStyle = secondary;
  g.fillRect(...rect(0, 1.05, L, 1.79));
  // soft shading: lighter near the top (sun), grime towards the bottom
  let grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, 'rgba(255,255,255,0.10)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0)');
  grad.addColorStop(0.8, 'rgba(0,0,0,0.04)');
  grad.addColorStop(1, 'rgba(40,30,20,0.22)');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // panel seams along the body
  g.fillStyle = 'rgba(0,0,0,0.12)';
  g.fillRect(...rect(0, 1.785, L, 1.80));
  g.fillRect(...rect(0, 3.6, L, 3.615));
  g.fillStyle = 'rgba(255,255,255,0.18)';
  g.fillRect(...rect(0, 3.62, L, 3.65));

  const drawWindow = (x0, x1, y0, y1, r, frosted = false) => {
    g.fillStyle = '#0d0f11';
    rrect(x0 - 0.05, y0 - 0.05, x1 + 0.05, y1 + 0.05, r + 0.04);
    g.fill(); // black rubber frame
    g.fillStyle = '#9aa1a6';
    rrect(x0 - 0.012, y0 - 0.012, x1 + 0.012, y1 + 0.012, r + 0.01);
    g.fill(); // thin grey seal
    if (frosted) {
      g.fillStyle = '#d7dcdf';
      rrect(x0, y0, x1, y1, r);
      g.fill();
      return;
    }
    const gg = g.createLinearGradient(X(x0), Y(y1), X(x1), Y(y0));
    gg.addColorStop(0, '#46606f');
    gg.addColorStop(0.5, '#22323c');
    gg.addColorStop(1, '#151e25');
    g.fillStyle = gg;
    rrect(x0, y0, x1, y1, r);
    g.fill();
    // curtains / berth hint and a sky reflection streak
    g.save();
    rrect(x0, y0, x1, y1, r);
    g.clip();
    g.fillStyle = 'rgba(120,150,170,0.25)';
    g.fillRect(...rect(x0, y1 - 0.18, x1, y1));
    g.fillStyle = 'rgba(255,255,255,0.13)';
    g.beginPath();
    g.moveTo(X(x0 + 0.15), Y(y1));
    g.lineTo(X(x0 + 0.5), Y(y1));
    g.lineTo(X(x0 + 0.2), Y(y0));
    g.lineTo(X(x0 - 0.15), Y(y0));
    g.fill();
    g.restore();
  };

  // eight passenger windows, one per bay, between the toilets at each end
  const pitch = 2.16;
  const first = L / 2 - pitch * 3.5;
  for (let i = 0; i < 8; i++) {
    const cx = first + pitch * i;
    drawWindow(cx - 0.68, cx + 0.68, 2.08, 2.94, 0.13);
  }
  // doors near both ends (hinged doors with a small window), toilet windows inboard
  for (const end of [0, 1]) {
    const d0 = end === 0 ? 0.85 : L - 1.75;
    g.strokeStyle = 'rgba(0,0,0,0.55)';
    g.lineWidth = 3;
    g.strokeRect(...rect(d0, 1.08, d0 + 0.9, 3.35));
    drawWindow(d0 + 0.25, d0 + 0.65, 2.45, 3.05, 0.05);
    g.fillStyle = '#d9d9d9';
    g.fillRect(...rect(d0 + 0.78, 1.6, d0 + 0.81, 2.3)); // handle
    const t0 = end === 0 ? 2.05 : L - 2.65;
    drawWindow(t0, t0 + 0.6, 2.5, 2.95, 0.06, true);
  }
  // yellow destination boards above the windows
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const [i, cx] of [L / 2 - 6.3, L / 2, L / 2 + 6.3].entries()) {
    g.fillStyle = '#2b2b2b';
    g.fillRect(...rect(cx - 1.32, 3.17, cx + 1.32, 3.43));
    g.fillStyle = '#f3c623';
    g.fillRect(...rect(cx - 1.28, 3.2, cx + 1.28, 3.4));
    g.fillStyle = '#121212';
    g.font = `bold ${Math.round(0.13 * sy)}px Helvetica, Arial, sans-serif`;
    const text = i === 1 ? `${route[0]}  ⇄  ${route[1]}` : i === 0 ? 'नई दिल्ली ⇄ गाज़ियाबाद' : `${route[0]}  ⇄  ${route[1]}`;
    if (i === 0) g.font = `bold ${Math.round(0.14 * sy)}px 'Kohinoor Devanagari','Devanagari Sangam MN','Nirmala UI','Mangal','Noto Sans Devanagari',sans-serif`;
    g.fillText(text, X(cx), Y(3.3));
  }
  // class lettering (Hindi at one end, English at the other) and coach plate
  g.fillStyle = 'rgba(30,40,90,0.9)';
  g.textAlign = 'left';
  g.font = `bold ${Math.round(0.2 * sy)}px 'Kohinoor Devanagari','Devanagari Sangam MN','Nirmala UI','Mangal','Noto Sans Devanagari',sans-serif`;
  g.fillText(hindi, X(2.0), Y(3.3));
  g.textAlign = 'right';
  g.font = `bold ${Math.round(0.17 * sy)}px Helvetica, Arial, sans-serif`;
  g.fillText(label, X(L - 2.0), Y(3.3));
  g.fillStyle = '#f2f2f2';
  g.fillRect(...rect(L / 2 - 0.08, 2.75, L / 2 + 0.08, 3.02)); // coach number plate between the middle windows
  g.fillStyle = '#b3141a';
  g.textAlign = 'center';
  g.font = `bold ${Math.round(0.14 * sy)}px Helvetica, Arial, sans-serif`;
  g.fillText('B', X(L / 2), Y(2.885));

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

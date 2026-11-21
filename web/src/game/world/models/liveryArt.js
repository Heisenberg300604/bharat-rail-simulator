// Livery artwork for coach sides, painted once on a canvas and sampled by the coach
// shader (coachLiveries.js) from the position on the body. One texture fetch per pixel
// instead of evaluating noise or ornaments in the shader, and it is built only when a
// coach of that livery first appears.
//
// The canvas spans the body side: u = 0 → 1 along the coach (left → right as seen from
// outside), v = 0 → 1 from the bottom of the side to the cant rail. 2048 × 256 px over
// 23.5 m × 2.3 m ≈ 9 cm per texel along the coach, ~1 cm up it.
//
// Both are game approximations after the owner's reference photos (2026-11-21), not the
// official vinyl artwork: Tejas (golden-orange gradient, wavy guilloche lines, mandala
// ornaments, name) and Duronto (a painted meadow of green, yellow, orange and red).
import * as THREE from 'three';
import { seededRandom } from '../geometry.js';

const W = 2048;
const H = 256;

function canvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return [c, c.getContext('2d')];
}

function toTexture(c) {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Cheap smooth 2D value noise in [0, 1] (seeded lattice, smoothstep blend). */
function valueNoise(seed) {
  const rand = seededRandom(seed);
  const N = 64;
  const grid = Float32Array.from({ length: N * N }, () => rand());
  const at = (i, j) => grid[(((j % N) + N) % N) * N + (((i % N) + N) % N)];
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const i = Math.floor(x);
    const j = Math.floor(y);
    const fx = s(x - i);
    const fy = s(y - j);
    const a = at(i, j) + (at(i + 1, j) - at(i, j)) * fx;
    const b = at(i, j + 1) + (at(i + 1, j + 1) - at(i, j + 1)) * fx;
    return a + (b - a) * fy;
  };
}

/** A mandala-like rosette (rings, petals and a lotus centre), stroked in `color`. */
function rosette(g, cx, cy, r, color) {
  g.save();
  g.translate(cx, cy);
  g.scale(1, 1.25); // canvas pixels are not square on the body (taller than wide in metres)
  g.strokeStyle = color;
  g.lineWidth = 2;
  for (const k of [1, 0.78, 0.55, 0.3]) {
    g.beginPath();
    g.arc(0, 0, r * k, 0, Math.PI * 2);
    g.stroke();
  }
  // petals between the rings
  for (const [ring, n] of [
    [0.9, 24],
    [0.66, 16],
    [0.42, 10],
  ]) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      g.beginPath();
      g.ellipse(Math.cos(a) * r * ring, Math.sin(a) * r * ring, r * 0.11, r * 0.045, a, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // outer flourishes
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    g.quadraticCurveTo(Math.cos(a + 0.2) * r * 1.35, Math.sin(a + 0.2) * r * 1.35, Math.cos(a + 0.35) * r * 1.15, Math.sin(a + 0.35) * r * 1.15);
    g.stroke();
  }
  g.restore();
}

/** Tejas: golden yellow at the top deepening to orange, guilloche waves, rosettes, name. */
function drawTejas() {
  const [c, g] = canvas();
  const grad = g.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#f8bd2e');
  grad.addColorStop(0.45, '#f6a326');
  grad.addColorStop(1, '#ec7a1b');
  g.fillStyle = grad;
  g.fillRect(0, 0, W, H);
  // soft brighter glow patches, as in the vinyl
  const rand = seededRandom(17);
  for (let i = 0; i < 9; i++) {
    const x = rand() * W;
    const rg = g.createRadialGradient(x, H * 0.35, 4, x, H * 0.35, 220);
    rg.addColorStop(0, 'rgba(255,214,90,0.35)');
    rg.addColorStop(1, 'rgba(255,214,90,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, W, H);
  }
  // guilloche: many fine wavy lines across the side
  g.lineWidth = 1;
  for (let k = -4; k < H / 5 + 4; k++) {
    g.strokeStyle = k % 2 ? 'rgba(214,105,18,0.30)' : 'rgba(255,220,120,0.22)';
    g.beginPath();
    for (let x = 0; x <= W; x += 8) {
      const y = k * 5 + 4 * Math.sin(x * 0.012 + k * 0.35) + 2.5 * Math.sin(x * 0.031 - k * 0.2);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  // rosettes beside each door and mid-coach (doors sit ~2 m in from each end)
  const ink = 'rgba(214,96,20,0.42)';
  for (const u of [0.04, 0.155, 0.5, 0.845, 0.96]) rosette(g, u * W, H * 0.5, H * 0.33, ink);
  // the name, in gold with a darker edge
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'bold 34px Georgia, "Times New Roman", serif';
  g.lineWidth = 3;
  g.strokeStyle = 'rgba(170,70,10,0.8)';
  g.fillStyle = '#ffd34a';
  // below the windows (the window band spans canvas y ≈ 0.23–0.57 H on lhb-red.glb)
  for (const u of [0.38, 0.62]) {
    g.strokeText('TEJAS', u * W, H * 0.76);
    g.fillText('TEJAS', u * W, H * 0.76);
  }
  g.font = 'bold 28px "Noto Sans Devanagari", "Kohinoor Devanagari", sans-serif';
  for (const u of [0.27, 0.73]) {
    g.strokeText('तेजस', u * W, H * 0.76);
    g.fillText('तेजस', u * W, H * 0.76);
  }
  // darker foot line
  g.fillStyle = 'rgba(190,80,15,0.9)';
  g.fillRect(0, H - 5, W, 5);
  return toTexture(c);
}

/** Duronto: a dense painted meadow (brush strokes), with a grey strip along the foot. */
function drawDuronto() {
  const [c, g] = canvas();
  const n1 = valueNoise(31);
  const n2 = valueNoise(47);
  const rand = seededRandom(5);
  // under-painting: broad colour fields
  const img = new ImageData(W / 4, H / 4);
  const field = (x, y) => {
    const a = 0.65 * n1(x / 110, y / 70) + 0.35 * n1(x / 40, y / 28); // green ↔ yellow
    const b = 0.45 * n2(x / 70, y / 50) + 0.55 * n2(x / 14, y / 10); // flowers (orange/red): small, scattered
    return [a, b];
  };
  const mix = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t);
  const GREEN = [62, 150, 40];
  const LIME = [150, 196, 52];
  const YELLOW = [242, 206, 44];
  const ORANGE = [238, 138, 30];
  const RED = [205, 52, 34];
  const colourAt = (x, y) => {
    const [a, b] = field(x, y);
    let col = a < 0.45 ? mix(GREEN, LIME, a / 0.45) : mix(LIME, YELLOW, Math.min(1, (a - 0.45) / 0.3));
    if (b > 0.62) col = mix(col, b > 0.73 ? RED : ORANGE, Math.min(1, (b - 0.62) / 0.08));
    return col;
  };
  // computed at quarter resolution and scaled up smoothly: the strokes add the detail
  const q = 4;
  for (let y = 0; y < H / q; y++) {
    for (let x = 0; x < W / q; x++) {
      const [r, gg, bb] = colourAt(x * q, y * q);
      const i = (y * (W / q) + x) * 4;
      img.data[i] = r;
      img.data[i + 1] = gg;
      img.data[i + 2] = bb;
      img.data[i + 3] = 255;
    }
  }
  const small = document.createElement('canvas');
  small.width = W / q;
  small.height = H / q;
  small.getContext('2d').putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(small, 0, 0, W, H);
  // brush strokes in the local colour, lightened or darkened, mostly leaning one way
  g.lineCap = 'round';
  for (let i = 0; i < 14000; i++) {
    const x = rand() * W;
    const y = rand() * H;
    const [r, gg, bb] = colourAt(x, y);
    const k = 0.7 + rand() * 0.6;
    g.strokeStyle = `rgb(${Math.min(255, r * k) | 0},${Math.min(255, gg * k) | 0},${Math.min(255, bb * k) | 0})`;
    g.lineWidth = 1.5 + rand() * 3;
    const len = 5 + rand() * 14;
    const ang = -0.9 + (rand() - 0.5) * 0.9;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    g.stroke();
  }
  // the grey strip along the bottom of the side
  g.fillStyle = '#b9bcbe';
  g.fillRect(0, H - 24, W, 24);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(0, H - 25, W, 2);
  return toTexture(c);
}

const DRAW = { tejas: drawTejas, duronto: drawDuronto };
const cache = new Map();

/** The artwork texture for a livery (built on first use, then shared). */
export function liveryArt(name) {
  if (!DRAW[name]) return null;
  if (!cache.has(name)) cache.set(name, DRAW[name]());
  return cache.get(name);
}

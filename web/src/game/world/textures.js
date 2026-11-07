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

const DEVANAGARI = "'Kohinoor Devanagari','Devanagari Sangam MN','Noto Sans Devanagari','Mangal',sans-serif";

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

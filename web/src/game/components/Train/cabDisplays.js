// Live instruments of the WAP-7 / WAG-9 cab, drawn on ONE canvas (one texture,
// one draw call for every panel face). Layout after the IRFCA "Under the hood –
// WAP7" album captions (K. Kagzi, 2009; items 332225, 332733, 332189, 332177)
// and RDSO report RM/0197 (Kavach DMI above Panel B):
//   Panel B  (left)   parking-brake "AR PR" gauge, BC bogie 1/2 duplex, MR/FP
//                     duplex, BP gauge, air-flow indicator
//   Panel A  (centre) battery + OHE voltmeters, TE/BE meters, lamps LSDJ LSHO
//                     LSP LSAF / LSVW LSCE, switches ZPT BLDJ BLCP BLHO ZBAN ZTEL
//                     BPVR BPPB BPCS, EMERGENCY STOP (3D, in CabInterior.jsx)
//   Panel C  (right)  DDU (green LCD + keypad), headlight/marker/cab-light
//                     switches, LSFI lamp, BPFA button, BZ V-O-F buzzer grille
//   speedometer box on the centre pillar (analog dial, digital window, keypad)
//   Kavach DMI, ALP Panel D (ZLDA, BPVR, hand-lamp socket), pedal labels,
//   A9 plate with its application zones, TE/BE throttle plate.
// GAME APPROXIMATIONS: the DDU text (the real DDU is a menu-driven diagnostic
// display), MR / feed-pipe / parking-brake pressures, the OHE and battery
// voltages and the exact positions of switches on each panel.
//
// Regions are in canvas pixels (1024 × 512); CabInterior.jsx maps them onto
// the panel quads at 610 px per metre.

export const CANVAS_W = 1024;
export const CANVAS_H = 512;
export const PX_PER_M = 610;
export const REGIONS = {
  B: [0, 0, 281, 299],
  A: [285, 0, 675, 299],
  C: [679, 0, 935, 299],
  SPEEDO: [0, 305, 183, 512],
  DMI: [190, 305, 373, 439],
  D: [380, 305, 685, 488],
  ARPR: [690, 305, 788, 403],
  PEDALS: [795, 305, 1020, 342],
  A9: [795, 345, 929, 479],
  TEBE: [935, 330, 1020, 512],
};

const FONT = 'Helvetica, Arial, sans-serif';

function dial(g, cx, cy, r, { min = 0, max = 10, major = 1, label = '', unit = 'kg/cm²', needles = [], face = '#101214', ink = '#f2f2ee', start = -225, sweep = 270 }) {
  g.save();
  g.fillStyle = '#2a2d30';
  g.beginPath();
  g.arc(cx, cy, r + 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = face;
  g.beginPath();
  g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fill();
  const toAng = (v) => ((start + (sweep * (Math.min(max, Math.max(min, v)) - min)) / (max - min)) * Math.PI) / 180;
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 1.5;
  g.font = `${Math.round(r * 0.22)}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (let v = min; v <= max + 1e-6; v += major) {
    const a = toAng(v);
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * r * 0.78, cy + Math.sin(a) * r * 0.78);
    g.lineTo(cx + Math.cos(a) * r * 0.95, cy + Math.sin(a) * r * 0.95);
    g.stroke();
    g.fillText(String(Math.round(v)), cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6);
    const half = toAng(v + major / 2);
    if (v + major / 2 <= max) {
      g.beginPath();
      g.moveTo(cx + Math.cos(half) * r * 0.86, cy + Math.sin(half) * r * 0.86);
      g.lineTo(cx + Math.cos(half) * r * 0.95, cy + Math.sin(half) * r * 0.95);
      g.stroke();
    }
  }
  g.font = `bold ${Math.round(r * 0.17)}px ${FONT}`;
  g.fillText(label, cx, cy + r * 0.42);
  g.font = `${Math.round(r * 0.13)}px ${FONT}`;
  g.fillText(unit, cx, cy + r * 0.62);
  for (const n of needles) {
    const a = toAng(n.v);
    g.strokeStyle = n.color ?? '#ffffff';
    g.lineWidth = n.w ?? 2.5;
    g.beginPath();
    g.moveTo(cx - Math.cos(a) * r * 0.12, cy - Math.sin(a) * r * 0.12);
    g.lineTo(cx + Math.cos(a) * r * 0.82, cy + Math.sin(a) * r * 0.82);
    g.stroke();
  }
  g.fillStyle = '#555';
  g.beginPath();
  g.arc(cx, cy, r * 0.08, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function lamp(g, x, y, r, color, on, label) {
  g.fillStyle = '#3a3a3a';
  g.beginPath();
  g.arc(x, y, r + 2.5, 0, Math.PI * 2);
  g.fill();
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 1, x, y, r);
  grad.addColorStop(0, on ? '#ffffff' : shade(color, 0.55));
  grad.addColorStop(0.35, on ? color : shade(color, 0.35));
  grad.addColorStop(1, on ? shade(color, 0.75) : shade(color, 0.2));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (label) {
    g.fillStyle = '#d8d8d2';
    g.font = `8px ${FONT}`;
    g.textAlign = 'center';
    g.fillText(label, x, y + r + 9);
  }
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * k), gg = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
  return `rgb(${r},${gg},${b})`;
}
function plate(g, [x0, y0, x1, y1], color = '#17191b') {
  g.fillStyle = color;
  g.fillRect(x0, y0, x1 - x0, y1 - y0);
  g.strokeStyle = '#2c2f33';
  g.lineWidth = 3;
  g.strokeRect(x0 + 1.5, y0 + 1.5, x1 - x0 - 3, y1 - y0 - 3);
  g.fillStyle = '#6d7176';
  for (const [x, y] of [
    [x0 + 7, y0 + 7],
    [x1 - 7, y0 + 7],
    [x0 + 7, y1 - 7],
    [x1 - 7, y1 - 7],
  ]) {
    g.beginPath();
    g.arc(x, y, 2.2, 0, Math.PI * 2);
    g.fill();
  }
}
function label(g, text, x, y, size = 9, color = '#cfcfc8', align = 'center') {
  g.fillStyle = color;
  g.font = `${size}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.fillText(text, x, y);
}
function toggle(g, x, y, name, up = false) {
  g.fillStyle = '#9a9ea3';
  g.beginPath();
  g.arc(x, y, 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e1e3e5';
  g.fillRect(x - 2, up ? y - 15 : y, 4, 15);
  label(g, name, x, y + 22, 8);
}

/** Where the 3D switches / buttons sit (canvas px) — CabInterior.jsx mirrors these. */
export const PANEL_A_TOGGLES = ['ZPT', 'BLDJ', 'BLCP', 'BLHO', 'ZBAN', 'ZTEL'].map((n, i) => ({ name: n, x: 305 + i * 34, y: 205 }));
export const EMERGENCY_STOP = { x: 610, y: 225, r: 26 };

/**
 * Draws everything. v = live values:
 * { speedKmh, bp, bc, mr, fp, parking, airflow, te, oheKv, battV, lamps: {LSDJ,LSHO,LSP,LSAF,LSVW,LSCE,LSFI},
 *   ddu: [lines], kavach: { on, state, permitted, targetDist, targetKmh, speed }, direction, brake, emergency, night }
 */
export function drawCab(g, v) {
  g.fillStyle = '#0e0f10';
  g.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // ---------------- Panel B: pneumatic gauges
  plate(g, REGIONS.B);
  dial(g, 70, 75, 54, { min: 0, max: 6, label: 'BC  BOGIE 1/2', needles: [{ v: v.bc, color: '#e23b2e' }, { v: v.bc * 0.98, color: '#f5f5f5', w: 2 }] });
  dial(g, 205, 75, 54, { min: 0, max: 12, major: 2, label: 'MR / FP', needles: [{ v: v.mr, color: '#e23b2e' }, { v: v.fp, color: '#f5f5f5', w: 2 }] });
  dial(g, 70, 210, 54, { min: 0, max: 10, label: 'BP', needles: [{ v: v.bp, color: '#ffffff' }] });
  dial(g, 205, 210, 54, { min: 0, max: 10, label: 'AIR FLOW', unit: 'indication', needles: [{ v: v.airflow * 10, color: '#ffffff' }] });

  // ---------------- Panel A: meters, lamps, switches
  plate(g, REGIONS.A);
  const ax = REGIONS.A[0];
  // square battery voltmeter and OHE voltmeter
  const meter = (x, y, w, h, val, max, title, unit) => {
    g.fillStyle = '#e9e6dc';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#111';
    g.lineWidth = 1;
    for (let k = 0; k <= 5; k++) {
      const a = Math.PI * (1.2 + (k / 5) * 0.6);
      g.beginPath();
      g.moveTo(x + w / 2 + Math.cos(a) * w * 0.42, y + h * 0.82 + Math.sin(a) * w * 0.42);
      g.lineTo(x + w / 2 + Math.cos(a) * w * 0.36, y + h * 0.82 + Math.sin(a) * w * 0.36);
      g.stroke();
    }
    const a = Math.PI * (1.2 + Math.min(1, Math.max(0, val / max)) * 0.6);
    g.strokeStyle = '#111';
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(x + w / 2, y + h * 0.82);
    g.lineTo(x + w / 2 + Math.cos(a) * w * 0.44, y + h * 0.82 + Math.sin(a) * w * 0.44);
    g.stroke();
    label(g, title, x + w / 2, y + h + 9, 8);
    label(g, unit, x + w / 2, y + h * 0.55, 7, '#333');
  };
  meter(ax + 18, 22, 46, 46, v.battV, 150, 'BATTERY', 'V');
  meter(ax + 72, 22, 46, 46, v.oheKv, 30, 'OHE', 'kV');
  // TE/BE meters: a white-bordered pair (bogie 1 / bogie 2), centre zero
  for (let k = 0; k < 2; k++) {
    const x = ax + 130 + k * 42;
    g.fillStyle = '#f2f0e8';
    g.fillRect(x, 16, 36, 60);
    g.fillStyle = '#1b1d20';
    g.fillRect(x + 4, 20, 28, 52);
    const mid = 46;
    const h = Math.max(-24, Math.min(24, (v.te / 2 / 230) * 24));
    g.fillStyle = h >= 0 ? '#7ed957' : '#f0a330';
    g.fillRect(x + 10, h >= 0 ? mid - h : mid, 16, Math.abs(h));
    g.fillStyle = '#ddd';
    g.fillRect(x + 6, mid, 24, 1);
    label(g, 'TE', x + 18, 26, 7);
    label(g, 'BE', x + 18, 67, 7);
    label(g, `BOGIE ${k + 1}`, x + 18, 86, 7);
  }
  label(g, 'kN', ax + 172, 98, 8);
  // lamps (top row) and the second row
  const L = v.lamps;
  [
    ['LSDJ', '#e3261f'],
    ['LSHO', '#ff8a1c'],
    ['LSP', '#ffb21c'],
    ['LSAF', '#e3261f'],
  ].forEach(([n, c], i) => lamp(g, ax + 245 + i * 34, 30, 11, c, !!L[n], n));
  [
    ['LSVW', '#ffb21c'],
    ['LSCE', '#ffb21c'],
  ].forEach(([n, c], i) => lamp(g, ax + 262 + i * 46, 82, 10, c, !!L[n], n));
  // switch rows (the 3D levers in CabInterior.jsx sit on these)
  for (const t of PANEL_A_TOGGLES) toggle(g, t.x, t.y, t.name, t.name === 'ZPT' || t.name === 'BLDJ' || t.name === 'BLCP');
  // push buttons: BPVR (vigilance reset), BPPB (parking brake), BPCS (constant speed)
  [
    ['BPVR', '#2f9e4f', v.lamps.LSVW],
    ['BPPB', '#c76a8a', false],
    ['BPCS', '#f0a330', false],
  ].forEach(([n, c, on], i) => lamp(g, ax + 30 + i * 40, 265, 11, c, on, n));
  // the yellow surround of the EMERGENCY STOP (the red mushroom itself is 3D)
  g.fillStyle = '#f2c230';
  g.beginPath();
  g.arc(EMERGENCY_STOP.x, EMERGENCY_STOP.y, EMERGENCY_STOP.r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#1b1b1b';
  g.font = `bold 7px ${FONT}`;
  g.textAlign = 'center';
  g.save();
  g.translate(EMERGENCY_STOP.x, EMERGENCY_STOP.y);
  for (const [ch, k] of [...'EMERGENCY STOP'].map((c, i) => [c, i])) {
    g.save();
    g.rotate(-1.55 + k * 0.24);
    g.fillText(ch, 0, -EMERGENCY_STOP.r + 6);
    g.restore();
  }
  g.restore();

  // ---------------- Panel C: DDU, switches, fault lamp, buzzer
  plate(g, REGIONS.C);
  const cx0 = REGIONS.C[0];
  g.fillStyle = '#2a2c2e';
  g.fillRect(cx0 + 14, 20, 160, 112);
  g.fillStyle = v.night ? '#5fbf4a' : '#7fd65e';
  g.fillRect(cx0 + 22, 28, 144, 66);
  g.fillStyle = '#0f2a0c';
  g.font = `bold 10px Menlo, Consolas, monospace`;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  v.ddu.slice(0, 5).forEach((line, i) => g.fillText(line, cx0 + 27, 31 + i * 12.4));
  // cursor keypad
  g.fillStyle = '#c9cbcd';
  for (const [dx, dy] of [
    [0, -9],
    [-9, 0],
    [9, 0],
    [0, 9],
  ])
    g.fillRect(cx0 + 70 + dx - 3.5, 113 + dy - 3.5, 7, 7);
  for (const dy of [-9, 0, 9]) g.fillRect(cx0 + 140, 113 + dy - 3.5, 7, 7);
  // switches: headlight, marker, cab light (and a couple of spares)
  ['HL', 'MKR', 'CAB L', 'FLR', 'PNL'].forEach((n, i) => toggle(g, cx0 + 30 + i * 40, 170, n, i === 0 ? !!v.headlight : i === 2 ? !!v.cabLight : false));
  lamp(g, cx0 + 205, 160, 9, '#e3261f', !!L.LSFI, 'LSFI');
  lamp(g, cx0 + 205, 205, 9, '#ffd21c', !!L.LSFI, 'BPFA');
  // BZ V-O-F buzzer grille
  g.fillStyle = '#1a1b1c';
  g.fillRect(cx0 + 186, 22, 56, 56);
  g.strokeStyle = '#4a4c4f';
  g.lineWidth = 2;
  for (const r of [8, 15, 22]) {
    g.beginPath();
    g.arc(cx0 + 214, 50, r, 0, Math.PI * 2);
    g.stroke();
  }
  label(g, 'BZ V-O-F', cx0 + 214, 90, 8);

  // ---------------- speedometer box face (centre pillar)
  const [sx0, sy0, sx1, sy1] = REGIONS.SPEEDO;
  g.fillStyle = '#1a1c1e';
  g.fillRect(sx0, sy0, sx1 - sx0, sy1 - sy0);
  dial(g, (sx0 + sx1) / 2, sy0 + 72, 62, { min: 0, max: 160, major: 20, label: 'km/h', unit: '', face: '#f4f3ee', ink: '#151515', needles: [{ v: v.speedKmh, color: '#1a1a1a', w: 3 }], start: -225, sweep: 270 });
  g.fillStyle = '#0f2a0c';
  g.fillRect(sx0 + 52, sy0 + 142, 80, 20);
  g.fillStyle = '#7fd65e';
  g.font = `bold 15px Menlo, Consolas, monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(Math.round(v.speedKmh)).padStart(3, '0'), (sx0 + sx1) / 2, sy0 + 153);
  g.fillStyle = '#e7c21c';
  for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) g.fillRect(sx0 + 40 + c * 18, sy0 + 172 + r * 13, 13, 9);

  // ---------------- Kavach DMI (RDSO RM/0197: above Panel B)
  const [kx0, ky0, kx1, ky1] = REGIONS.DMI;
  g.fillStyle = '#26282a';
  g.fillRect(kx0, ky0, kx1 - kx0, ky1 - ky0);
  g.fillStyle = v.kavach.on ? '#0a1424' : '#060708';
  g.fillRect(kx0 + 8, ky0 + 8, kx1 - kx0 - 16, ky1 - ky0 - 26);
  if (v.kavach.on) {
    const k = v.kavach;
    const col = k.state === 'normal' ? '#e8e8e8' : k.state === 'warn' ? '#ffd21c' : '#ff4a3a';
    const dcx = kx0 + 52, dcy = ky0 + 64, r = 40;
    g.strokeStyle = '#3a4a62';
    g.lineWidth = 7;
    g.beginPath();
    g.arc(dcx, dcy, r, Math.PI * 0.75, Math.PI * 2.25);
    g.stroke();
    if (Number.isFinite(k.permitted)) {
      g.strokeStyle = '#3fbf5f';
      g.beginPath();
      g.arc(dcx, dcy, r, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * Math.min(1, k.permitted / 160)));
      g.stroke();
    }
    const a = Math.PI * (0.75 + 1.5 * Math.min(1, v.speedKmh / 160));
    g.strokeStyle = col;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(dcx, dcy);
    g.lineTo(dcx + Math.cos(a) * (r - 6), dcy + Math.sin(a) * (r - 6));
    g.stroke();
    label(g, String(Math.round(v.speedKmh)), dcx, dcy + 22, 15, col);
    label(g, 'KAVACH', kx0 + 135, ky0 + 20, 10, '#9fb4d8');
    label(g, Number.isFinite(k.permitted) ? `${Math.round(k.permitted)}` : '--', kx0 + 135, ky0 + 46, 18, '#3fbf5f');
    label(g, 'permitted', kx0 + 135, ky0 + 62, 8, '#9fb4d8');
    if (k.targetDist != null) {
      label(g, `${Math.round(k.targetKmh ?? 0)} @ ${Math.round(k.targetDist)} m`, kx0 + 135, ky0 + 84, 9, '#e8e8e8');
    }
    if (k.state !== 'normal') label(g, k.state.toUpperCase(), kx0 + 135, ky0 + 100, 10, col);
  } else {
    label(g, 'KAVACH', (kx0 + kx1) / 2, (ky0 + ky1) / 2 - 6, 11, '#3a3d42');
  }
  for (let i = 0; i < 6; i++) {
    g.fillStyle = '#4a4d52';
    g.fillRect(kx0 + 12 + i * 27, ky1 - 14, 20, 8); // soft keys
  }

  // ---------------- ALP Panel D
  plate(g, REGIONS.D);
  const dx0 = REGIONS.D[0];
  toggle(g, dx0 + 50, 380, 'ZLDA');
  lamp(g, dx0 + 120, 380, 14, '#2f9e4f', !!L.LSVW, 'BPVR');
  g.fillStyle = '#1d4fb8';
  g.beginPath();
  g.arc(dx0 + 190, 380, 12, 0, Math.PI * 2);
  g.fill();
  label(g, 'HAND LAMP', dx0 + 190, 405, 8);
  toggle(g, dx0 + 250, 380, 'HL SOCKET');
  label(g, 'ALP', dx0 + 152, 455, 11, '#8a8d92');

  // ---------------- AR PR (parking brake) gauge plate
  const [px0, py0, px1, py1] = REGIONS.ARPR;
  g.fillStyle = '#c9cbc7';
  g.fillRect(px0, py0, px1 - px0, py1 - py0);
  label(g, 'AR', px0 + 14, py0 + 10, 9, '#222');
  label(g, 'PR', px1 - 14, py0 + 10, 9, '#222');
  dial(g, (px0 + px1) / 2, (py0 + py1) / 2 + 4, 36, { min: 0, max: 10, major: 2, label: 'PARKING', unit: '', face: '#f4f3ee', ink: '#151515', needles: [{ v: v.parking, color: '#1a1a1a', w: 2 }] });

  // ---------------- pedal labels (SANDING · PVEF · VIGILANCE)
  const [lx0, ly0, lx1, ly1] = REGIONS.PEDALS;
  g.fillStyle = '#8f9396';
  g.fillRect(lx0, ly0, lx1 - lx0, ly1 - ly0);
  ['SANDING', 'PVEF', 'VIGILANCE'].forEach((n, i) => {
    const x = lx0 + 38 + i * 75;
    g.fillStyle = '#111';
    g.fillRect(x - 32, ly0 + 6, 64, 24);
    label(g, n, x, ly0 + 18, 10, '#f0f0f0');
  });

  // ---------------- A9 plate with its application zones
  const [ax0, ay0, ax1, ay1] = REGIONS.A9;
  g.fillStyle = '#1b1d1f';
  g.fillRect(ax0, ay0, ax1 - ax0, ay1 - ay0);
  const acx = (ax0 + ax1) / 2, acy = (ay0 + ay1) / 2;
  const zones = [
    ['REL', '#3a8f4a', -2.4, -1.85],
    ['RUN', '#cfcfcf', -1.85, -1.35],
    ['MIN', '#e0b020', -1.35, -1.05],
    ['SERVICE', '#e08a20', -1.05, -0.2],
    ['FULL', '#d24a2a', -0.2, 0.05],
    ['EMERG', '#b01e1e', 0.15, 0.6],
  ];
  for (const [n, c, a0, a1] of zones) {
    g.strokeStyle = c;
    g.lineWidth = 9;
    g.beginPath();
    g.arc(acx, acy, 52, a0, a1);
    g.stroke();
    const am = (a0 + a1) / 2;
    label(g, n, acx + Math.cos(am) * 35, acy + Math.sin(am) * 35, 7, '#e8e8e8');
  }
  g.fillStyle = '#5a5d60';
  g.beginPath();
  g.arc(acx, acy, 13, 0, Math.PI * 2);
  g.fill();
  label(g, 'A9', acx, ay1 - 10, 9, '#d8d8d2');

  // ---------------- TE/BE throttle plate (TE forward, BE back — direction is a game assumption)
  const [tx0, ty0, tx1, ty1] = REGIONS.TEBE;
  g.fillStyle = '#1b1d1f';
  g.fillRect(tx0, ty0, tx1 - tx0, ty1 - ty0);
  g.fillStyle = '#060606';
  g.fillRect((tx0 + tx1) / 2 - 5, ty0 + 22, 10, ty1 - ty0 - 44);
  label(g, 'TE', (tx0 + tx1) / 2, ty0 + 11, 11, '#7ed957');
  label(g, '0', (tx0 + tx1) / 2 + 20, (ty0 + ty1) / 2, 10, '#e8e8e8');
  label(g, 'BE', (tx0 + tx1) / 2, ty1 - 11, 11, '#f0a330');
  label(g, 'F', tx0 + 10, ty0 + 40, 9, '#e8e8e8');
  label(g, '0', tx0 + 10, (ty0 + ty1) / 2, 9, '#e8e8e8');
  label(g, 'R', tx0 + 10, ty1 - 40, 9, '#e8e8e8');
}

/** The DDU's lines (game approximation of the status page). */
export function dduLines({ speedKmh, te, oheKv, bp, bc, mr, slipping, vcdWarn, tractionCut, emergency }) {
  const msg = emergency ? '** EMERGENCY BRAKE **' : vcdWarn ? '** VIGILANCE: ACK **' : slipping ? '** WHEEL SLIP **' : tractionCut ? 'TRACTION CUT: BP LOW' : 'NO FAULT';
  const sign = te >= 0 ? '+' : '-';
  return [
    `SPEED  ${String(Math.round(speedKmh)).padStart(3, ' ')} km/h`,
    `TE/BE ${sign}${String(Math.round(Math.abs(te))).padStart(3, ' ')} kN`,
    `OHE ${oheKv.toFixed(1)}kV MR ${mr.toFixed(1)}`,
    `BP ${bp.toFixed(1)}  BC ${bc.toFixed(1)}`,
    msg,
  ];
}

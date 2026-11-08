// Passenger coach interiors, one per coach type, built to the same dimensions
// as the exterior shells (see world/models/coaches.js and textures.js):
//   LHB AC 3-tier — 8 bays at 2.16 m pitch, sealed tinted windows with
//                   curtains, LED light strip, folding middle berths as backrests
//   ICF Sleeper   — 9 bays at 1.8 m pitch, open windows with steel bars,
//                   ceiling fans and tube lights, blue rexine berths
//
// The side walls have real openings exactly where the windows are painted on
// the exterior, so you can look out at the platform and the countryside. (The
// exterior side panels are one-sided planes facing outward, so they are
// invisible from inside — the interior walls are what you see.)
//
// Coach local frame: x along the coach (+x = forward), y up (0 = rail top),
// z to the right; the main berth bays are on the LEFT (−z), side berths on the
// right (+z), aisle in between.
import * as THREE from 'three';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { onEnvironmentChange } from '../../world/environment.js';

const FLOOR = 1.28; // coach floor above rail top
export const INTERIOR_FLOOR = FLOOR;
const WALL_IN = 1.5; // inner face of the side walls (exterior skin is at 1.62)
const WALL_OUT = 1.585;
const MAIN_Z = [-1.47, 0.12]; // main berths: window wall → aisle
const SIDE_Z = [0.76, 1.47]; // side berths
const AISLE_Z = 0.44;

export const COACH_LAYOUTS = {
  lhb: {
    ceil: 3.56,
    bayPitch: 2.16,
    bayStart: -8.64,
    bays: 8,
    endX: 8.95,
    windows: Array.from({ length: 8 }, (_, i) => (i - 3.5) * 2.16),
    winHalf: 0.68,
    winY: [2.08, 2.94],
    glazed: true,
    berth: '#2f4473',
    berthEdge: '#1d2b4d',
    wall: '#dcd7cb',
    trim: '#9aa1a8',
    curtain: '#304f86',
    eye: { bay: 4, height: 1.2, yawDeg: 38 },
  },
  icf: {
    ceil: 3.5,
    bayPitch: 1.8,
    bayStart: -8.55,
    bays: 9,
    endX: 9.0,
    windows: Array.from({ length: 19 }, (_, i) => (i - 9) * 0.9),
    winHalf: 0.31,
    winY: [2.13, 2.67],
    glazed: false,
    berth: '#2a5291',
    berthEdge: '#183460',
    wall: '#d6d2bd',
    trim: '#6b5434',
    curtain: null,
    eye: { bay: 4, height: 1.12, yawDeg: 40 },
  },
};

/** Seated passenger's eye in the coach frame, beside the window on the rear lower berth. */
export function coachEye(type) {
  const c = COACH_LAYOUTS[type] ?? COACH_LAYOUTS.lhb;
  const xb = c.bayStart + c.eye.bay * c.bayPitch;
  return { eye: [xb + 0.36, FLOOR + c.eye.height, -1.0], yawDeg: c.eye.yawDeg };
}
// Back-compat exports (default = LHB)
export const COACH_EYE = coachEye('lhb').eye;
export const COACH_LOOK_PITCH_DEG = -3;
export const COACH_DEFAULT_YAW_DEG = COACH_LAYOUTS.lhb.eye.yawDeg;

const STEEL = '#a9b0b6';
const DARK = '#3a3d42';
const FLOOR_VINYL = '#4b4f55';

/** Side wall from xA to xB with rectangular openings at the windows. */
function sideWall(b, side, c, color) {
  const z = side < 0 ? [-WALL_OUT, -WALL_IN] : [WALL_IN, WALL_OUT];
  const [y0, y1] = c.winY;
  const xA = -c.endX;
  const xB = c.endX;
  b.box([xA, xB], [FLOOR, y0], z, color);
  b.box([xA, xB], [y1, c.ceil], z, color);
  let x = xA;
  for (const wx of c.windows) {
    const x0 = wx - c.winHalf;
    const x1 = wx + c.winHalf;
    if (x0 > x + 0.001) b.box([x, x0], [y0, y1], z, color);
    x = x1;
  }
  if (x < xB) b.box([x, xB], [y0, y1], z, color);
}

function windowDetail(b, side, wx, c) {
  const s = side;
  const [y0, y1] = c.winY;
  const h = c.winHalf;
  const zi = s * WALL_IN; // inner face
  const zr = (d) => (s < 0 ? [zi, zi + d] : [zi - d, zi]); // a box d deep, sticking into the room
  // frame around the opening (reveal), sill ledge
  b.box([wx - h - 0.05, wx + h + 0.05], [y1, y1 + 0.05], zr(0.06), c.trim);
  b.box([wx - h - 0.05, wx - h], [y0, y1], zr(0.06), c.trim);
  b.box([wx + h, wx + h + 0.05], [y0, y1], zr(0.06), c.trim);
  b.box([wx - h - 0.08, wx + h + 0.08], [y0 - 0.04, y0], zr(0.13), c.trim);
  if (c.glazed) {
    // sealed double glazing, set back in the wall
    b.box([wx - h, wx + h], [y0, y1], s < 0 ? [-WALL_OUT + 0.005, -WALL_OUT + 0.015] : [WALL_OUT - 0.015, WALL_OUT - 0.005], '#a9c1cc', { mat: 'glass' });
    if (c.curtain) {
      // curtains tied back at both sides of the window
      for (const cx of [wx - h - 0.12, wx + h + 0.12]) {
        b.box([cx - 0.1, cx + 0.1], [y0 - 0.15, y1 + 0.08], zr(0.08), c.curtain);
        b.box([cx - 0.11, cx + 0.11], [y0 + 0.25, y0 + 0.29], zr(0.09), '#c9a54a'); // tie band
      }
      b.cylinder({ radius: 0.012, length: 2 * h + 0.6, axis: 'x', position: [wx, y1 + 0.1, s * (WALL_IN - 0.06)], color: STEEL });
    }
  } else {
    // ICF: open window with four horizontal steel bars and the raised louvre shutter
    for (let k = 1; k <= 4; k++) {
      const by = y0 + ((y1 - y0) * k) / 5;
      b.cylinder({ radius: 0.011, length: 2 * h, axis: 'x', position: [wx, by, s * (WALL_IN + 0.03)], color: '#c3c8cc' });
    }
    b.box([wx - h, wx + h], [y1 + 0.02, y1 + 0.24], zr(0.03), '#b9bec2');
  }
}

/** One berth cushion slab with a darker edge band. */
function cushion(b, x, y, z, c) {
  b.box(x, y, z, c.berth);
  b.box(x, [y[0] - 0.015, y[0]], [z[0] + 0.01, z[1] - 0.01], c.berthEdge);
}

export function buildCoachInterior(type = 'lhb') {
  const c = COACH_LAYOUTS[type] ?? COACH_LAYOUTS.lhb;
  const b = new ModelBuilder();
  const F = FLOOR;
  const P = c.bayPitch;
  const xA = -c.endX;
  const xB = c.endX;

  // shell: floor, ceiling, side walls with window openings, end walls
  b.box([xA, xB], [F - 0.05, F], [-WALL_IN, WALL_IN], FLOOR_VINYL);
  b.box([xA, xB], [F, F + 0.004], [MAIN_Z[1] + 0.02, SIDE_Z[0] - 0.02], '#5d6168'); // aisle runner
  b.box([xA, xB], [c.ceil, c.ceil + 0.05], [-WALL_IN, WALL_IN], '#ecebe6');
  // sloping cove panels where the ceiling meets the walls
  for (const s of [-1, 1]) {
    b.add(new THREE.BoxGeometry(2 * c.endX, 0.03, 0.42), { color: '#e3e1da', position: [0, c.ceil - 0.12, s * (WALL_IN - 0.18)], rotation: [s * 0.62, 0, 0] });
  }
  sideWall(b, -1, c, c.wall);
  sideWall(b, 1, c, c.wall);
  for (const wx of c.windows) {
    windowDetail(b, -1, wx, c);
    windowDetail(b, 1, wx, c);
  }
  for (const end of [-1, 1]) {
    const x = end * c.endX;
    const xr = end > 0 ? [x, x + 0.06] : [x - 0.06, x];
    b.box(xr, [F, c.ceil], [-WALL_IN, AISLE_Z - 0.5], c.wall);
    b.box(xr, [F, c.ceil], [AISLE_Z + 0.5, WALL_IN], c.wall);
    b.box(xr, [F + 2.05, c.ceil], [AISLE_Z - 0.5, AISLE_Z + 0.5], c.wall);
    // vestibule door (glazed sliding door on AC coaches)
    const dx = end > 0 ? [x + 0.01, x + 0.03] : [x - 0.03, x - 0.01];
    b.box(dx, [F, F + 2.05], [AISLE_Z - 0.5, AISLE_Z + 0.5], c.glazed ? '#6f7c84' : '#8b8f86', c.glazed ? { mat: 'glass' } : {});
    b.box(end > 0 ? [x - 0.02, x] : [x, x + 0.02], [F + 2.0, F + 2.08], [AISLE_Z - 0.56, AISLE_Z + 0.56], c.trim);
    // fire extinguisher and a sign over the door
    b.cylinder({ radius: 0.075, length: 0.5, position: [x - end * 0.12, F + 0.6, AISLE_Z + 0.75], color: '#c4161c' });
    b.box(end > 0 ? [x - 0.02, x] : [x, x + 0.02], [F + 2.2, F + 2.38], [AISLE_Z - 0.35, AISLE_Z + 0.35], '#1d4f91');
  }

  // bays
  for (let k = 0; k < c.bays; k++) {
    const xb = c.bayStart + k * P; // rear partition of this bay
    const xf = xb + P; // front partition
    // partition behind the rear berths (main side) and a short screen on the side-berth side
    b.box([xb - 0.035, xb + 0.035], [F, c.ceil - 0.12], [-WALL_IN, MAIN_Z[1] + 0.02], c.wall);
    b.box([xb - 0.045, xb + 0.045], [F, c.ceil - 0.12], [MAIN_Z[1] - 0.02, MAIN_Z[1] + 0.05], c.trim); // aisle edge pillar
    b.box([xb - 0.03, xb + 0.03], [F, F + 1.95], [SIDE_Z[0], WALL_IN], c.wall);
    if (k === c.bays - 1) b.box([xf - 0.035, xf + 0.035], [F, c.ceil - 0.12], [-WALL_IN, MAIN_Z[1] + 0.02], c.wall);

    for (const dir of [1, -1]) {
      // dir = 1: rear berth facing forward (against xb); −1: front berth facing back (against xf)
      const wallX = dir > 0 ? xb : xf;
      const near = wallX + dir * 0.04;
      const far = wallX + dir * 0.66;
      const bx = [Math.min(near, far), Math.max(near, far)];
      // lower berth: storage base + cushion
      b.box(bx, [F, F + 0.37], [MAIN_Z[0], MAIN_Z[1] - 0.06], DARK);
      cushion(b, bx, [F + 0.37, F + 0.47], MAIN_Z, c);
      // backrest = the folded-down middle berth
      const back = [Math.min(wallX + dir * 0.04, wallX + dir * 0.13), Math.max(wallX + dir * 0.04, wallX + dir * 0.13)];
      cushion(b, back, [F + 0.52, F + 1.12], [MAIN_Z[0] + 0.02, MAIN_Z[1] - 0.02], c);
      // middle-berth chains hanging from the upper berth
      for (const cz of [MAIN_Z[0] + 0.12, MAIN_Z[1] - 0.06]) {
        b.cylinder({ radius: 0.01, length: 0.72, position: [wallX + dir * 0.6, F + 1.48, cz], color: STEEL });
      }
      // upper berth with an aisle-side guard rail
      cushion(b, bx, [F + 1.86, F + 1.95], MAIN_Z, c);
      b.box(bx, [F + 1.95, F + 2.12], [MAIN_Z[1] - 0.05, MAIN_Z[1] - 0.02], STEEL);
      // side berths: two seats facing each other (lower side berth by day)
      const sx = [Math.min(wallX + dir * 0.05, wallX + dir * 0.62), Math.max(wallX + dir * 0.05, wallX + dir * 0.62)];
      b.box(sx, [F, F + 0.37], [SIDE_Z[0] + 0.03, SIDE_Z[1]], DARK);
      cushion(b, sx, [F + 0.37, F + 0.47], SIDE_Z, c);
      cushion(b, [Math.min(wallX + dir * 0.05, wallX + dir * 0.13), Math.max(wallX + dir * 0.05, wallX + dir * 0.13)], [F + 0.52, F + 1.05], SIDE_Z, c);
    }
    // side upper berth across the whole bay
    cushion(b, [xb + 0.06, xf - 0.06], [F + 1.78, F + 1.87], SIDE_Z, c);
    b.box([xb + 0.06, xf - 0.06], [F + 1.87, F + 2.0], [SIDE_Z[0], SIDE_Z[0] + 0.03], STEEL);
    // ladder at the aisle end of the rear berths
    for (const lx of [xb + 0.42, xb + 0.62]) b.cylinder({ radius: 0.013, length: 1.86, position: [lx, F + 0.93, MAIN_Z[1] + 0.03], color: STEEL });
    for (let ry = F + 0.62; ry < F + 1.8; ry += 0.3) b.cylinder({ radius: 0.011, length: 0.2, axis: 'x', position: [xb + 0.52, ry, MAIN_Z[1] + 0.03], color: STEEL });
    // fold-down window table between the facing lower berths
    const xm = (xb + xf) / 2;
    b.box([xm - 0.24, xm + 0.24], [F + 0.7, F + 0.735], [-WALL_IN, -WALL_IN + 0.34], c.glazed ? '#8a9097' : '#6b4a2d');
    b.box([xm - 0.03, xm + 0.03], [F + 0.4, F + 0.7], [-WALL_IN, -WALL_IN + 0.04], STEEL);
    // berth number plate + charging socket + reading lamp on the partition
    b.box([xb + 0.035, xb + 0.05], [F + 1.4, F + 1.5], [MAIN_Z[1] - 0.32, MAIN_Z[1] - 0.08], '#f2f2f2');
    b.box([xb + 0.035, xb + 0.05], [F + 0.82, F + 0.92], [MAIN_Z[0] + 0.12, MAIN_Z[0] + 0.24], '#ececec');
    b.box([xb + 0.04, xb + 0.1], [F + 1.7, F + 1.74], [MAIN_Z[0] + 0.5, MAIN_Z[0] + 0.62], '#fff4d8', { mat: 'lamp' });
    // privacy curtain bunched at the aisle (AC coaches)
    if (c.curtain) {
      b.box([xb + 0.07, xb + 0.2], [F + 0.55, F + 2.3], [MAIN_Z[1] + 0.04, MAIN_Z[1] + 0.12], c.curtain);
      b.box([xb + 0.07, xb + 0.18], [F + 0.55, F + 1.8], [SIDE_Z[0] - 0.08, SIDE_Z[0]], c.curtain);
    }
    // luggage: a suitcase under the berth, bags on an upper berth
    const bagColors = ['#7a2a24', '#2d3b52', '#5a4632', '#2e4d3a', '#46385e'];
    const bc = bagColors[k % bagColors.length];
    b.box([xb + 0.15, xb + 0.55], [F, F + 0.3], [MAIN_Z[0] + 0.2, MAIN_Z[0] + 0.8], bc);
    if (k % 2 === 0) b.box([xf - 0.6, xf - 0.15], [F + 1.95, F + 2.2], [MAIN_Z[0] + 0.3, MAIN_Z[0] + 0.75], bagColors[(k + 2) % bagColors.length]);

    // ceiling: AC diffuser slots (LHB) or a fan per bay (ICF)
    if (c.glazed) {
      b.box([xb + 0.1, xf - 0.1], [c.ceil - 0.015, c.ceil], [-0.95, -0.8], '#8e959c');
      b.box([xb + 0.1, xf - 0.1], [c.ceil - 0.015, c.ceil], [1.0, 1.12], '#8e959c');
    } else {
      for (const fz of [-0.55, 1.05]) {
        const fx = xm;
        b.cylinder({ radius: 0.018, length: 0.18, position: [fx, c.ceil - 0.09, fz], color: '#2a2c2e' });
        b.cylinder({ radius: 0.075, length: 0.1, position: [fx, c.ceil - 0.22, fz], color: '#2a2c2e' });
        b.cylinder({ radius: 0.22, length: 0.05, position: [fx, c.ceil - 0.27, fz], color: '#4e5357' });
        b.box([fx - 0.2, fx + 0.2], [c.ceil - 0.285, c.ceil - 0.265], [fz - 0.035, fz + 0.035], '#6c727a');
        b.box([fx - 0.035, fx + 0.035], [c.ceil - 0.285, c.ceil - 0.265], [fz - 0.2, fz + 0.2], '#6c727a');
      }
      b.box([xm - 0.6, xm + 0.6], [c.ceil - 0.05, c.ceil], [AISLE_Z - 0.06, AISLE_Z + 0.06], '#f4f2ea', { mat: 'lamp' });
    }
  }
  // continuous LED light strip down the aisle (AC coaches)
  if (c.glazed) b.box([xA + 0.3, xB - 0.3], [c.ceil - 0.025, c.ceil], [AISLE_Z - 0.09, AISLE_Z + 0.09], '#fbf8ee', { mat: 'lamp' });

  return b.build();
}

/** Interior materials. A soft "fill" keeps the inside readable whatever the sun does. */
export function createInteriorMaterials() {
  const fill = { value: 0.35 };
  const body = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  body.onBeforeCompile = (shader) => {
    shader.uniforms.uFill = fill;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uFill;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * uFill;');
  };
  const glass = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.04,
    metalness: 0.1,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    envMapIntensity: 1.5,
  });
  const lamp = new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#fff6e2', emissiveIntensity: 1.2 });
  const unsubscribe = onEnvironmentChange((env) => {
    // daylight through the windows by day, warm lighting at night
    fill.value = 0.22 + 0.2 * (1 - env.night) + 0.28 * env.night;
    lamp.emissiveIntensity = 0.8 + 1.6 * env.lamps;
  });
  return { body, glass, lamp, dispose: unsubscribe };
}

// ------------------------------------------------------------------ door view
// The classic Indian train "door view": standing in the open doorway at the
// front end of a coach (left side), looking along the train. Door position
// matches the exterior textures (LHB 0.85–1.75 m, ICF 0.45–1.2 m from the end).
const DOORS = {
  lhb: { length: 23.54, from: 1.75, to: 0.85, leaf: '#c3c7cb' },
  icf: { length: 21.337, from: 1.2, to: 0.45, leaf: '#24448f' },
};

/** Doorway frame, grab rails, step and the door leaf folded back against the body. */
export function buildDoorway(type = 'lhb') {
  const d = DOORS[type] ?? DOORS.lhb;
  const HL = d.length / 2;
  const d0 = HL - d.from;
  const d1 = HL - d.to;
  const b = new ModelBuilder();
  const Z = -1.62; // outer skin, left side
  b.box([d0, d1], [FLOOR - 0.16, FLOOR], [Z, Z + 0.32], '#5a5f66'); // floor + step edge
  b.box([d0 + 0.05, d1 - 0.05], [FLOOR - 0.45, FLOOR - 0.38], [Z - 0.12, Z + 0.02], '#3c4046'); // footstep below
  for (const x of [d0, d1]) {
    const xr = x === d0 ? [x - 0.05, x] : [x, x + 0.05];
    b.box(xr, [FLOOR - 0.15, 3.4], [Z, Z + 0.1], '#1d1f22'); // door frame
  }
  b.box([d0, d1], [3.32, 3.42], [Z, Z + 0.1], '#1d1f22');
  b.box([d0, d1], [FLOOR, 3.32], [Z + 0.25, Z + 0.29], '#3b3f44'); // vestibule wall behind the doorway
  // vertical grab rails beside the doorway (yellow on ICF, steel on LHB)
  const rail = type === 'icf' ? '#e8b400' : '#c9ced3';
  for (const x of [d0 - 0.07, d1 + 0.07]) {
    b.cylinder({ radius: 0.018, length: 1.55, position: [x, 2.35, Z - 0.07], color: rail, segments: 8 });
    for (const y of [1.6, 3.1]) b.box([x - 0.012, x + 0.012], [y - 0.012, y + 0.012], [Z - 0.07, Z], rail);
  }
  // door leaf swung open and latched flat against the body, behind the doorway
  const lw = d1 - d0;
  b.box([d0 - lw - 0.03, d0 - 0.03], [FLOOR - 0.12, 3.32], [Z - 0.06, Z - 0.02], d.leaf);
  b.box([d0 - lw + 0.2, d0 - 0.23], [2.35, 2.95], [Z - 0.065, Z - 0.055], '#1b252d');
  return b.build();
}

/** Eye of someone standing in the doorway, leaning out a little. */
export function doorEye(type = 'lhb') {
  const d = DOORS[type] ?? DOORS.lhb;
  const HL = d.length / 2;
  return { eye: [HL - (d.from + d.to) / 2, FLOOR + 1.62, -1.78], yawDeg: 12 };
}

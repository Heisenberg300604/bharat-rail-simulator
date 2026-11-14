// Procedural rolling-stock models (original work, no third-party assets).
// Each builder returns { [materialKey]: BufferGeometry } built by ModelBuilder:
//   paint  – primary livery colour (white here; real colour comes per instance)
//   paint2 – secondary livery colour (stripes / window band), also per instance
//   body   – fixed-colour parts (roof, underframe, doors…), vertex coloured
//   glass  – windows (glossy)
//   lamp   – lights (emissive when switched on)
// Vehicle local frame: x = forward, y = up (0 = rail top), z = right.
import * as THREE from 'three';
import { ModelBuilder } from '../modelBuilder.js';
import { TRACK } from '../../config/gameConfig.js';

const W = '#ffffff';
const DARK = '#232527';
const GREY = '#5d6268';

// ---------------------------------------------------------------- locomotive
export const LOCO_DIM = { halfLength: 10.28, halfWidth: 1.576, roof: 4.05 };

/** Side profile of the body (x, y): vertical lower front, raked windscreen, rounded roof edge. */
function locoProfile(HL) {
  return [
    [-HL, 1.3],
    [HL, 1.3],
    [HL, 2.62],
    [HL - 0.42, 3.72],
    [HL - 0.62, 3.92],
    [HL - 0.9, 4.0],
    [-(HL - 0.9), 4.0],
    [-(HL - 0.62), 3.92],
    [-(HL - 0.42), 3.72],
    [-HL, 2.62],
  ];
}

export function buildLocomotive() {
  const b = new ModelBuilder();
  const { halfLength: HL, halfWidth: HW } = LOCO_DIM;
  const slope = Math.atan2(0.42, 1.1); // windscreen rake

  // underframe + body shell
  b.box([-HL + 0.15, HL - 0.15], [0.95, 1.3], [-1.5, 1.5], DARK);
  b.prism(locoProfile(HL), -HW, HW, W, { mat: 'paint' });

  // livery bands (secondary colour) on both sides and both ends
  b.box([-HL - 0.006, HL + 0.006], [1.95, 2.35], [-HW - 0.006, HW + 0.006], W, { mat: 'paint2' });
  b.box([-HL - 0.004, HL + 0.004], [1.3, 1.62], [-HW - 0.004, HW + 0.004], '#6e7378'); // grey skirt

  // machine-room louvres along both sides
  for (const x of [-6.3, -3.4, -0.5, 2.4, 5.3]) {
    for (const z of [HW, -HW]) {
      const zz = z > 0 ? [HW, HW + 0.025] : [-HW - 0.025, -HW];
      b.box([x - 1.2, x + 1.2], [2.75, 3.6], zz, '#3a3e43');
      for (let k = 0; k < 6; k++) b.box([x - 1.15, x + 1.15], [2.8 + k * 0.13, 2.84 + k * 0.13], z > 0 ? [HW + 0.025, HW + 0.035] : [-HW - 0.035, -HW - 0.025], '#5a5f66');
    }
  }

  for (const end of [1, -1]) {
    const fx = end * HL; // front face x
    const out = (d) => fx + end * d;
    const xr = (a, c) => (end > 0 ? [a, c] : [-c, -a]);

    // raked windscreen: two panes split by a centre pillar
    for (const z of [-0.68, 0.68]) {
      b.add(new THREE.BoxGeometry(0.04, 1.02, 1.2), {
        mat: 'glass',
        color: '#10181f',
        position: [fx - end * 0.215, 3.16, z],
        rotation: [0, 0, end * slope],
      });
    }
    b.add(new THREE.BoxGeometry(0.06, 1.05, 0.12), { color: DARK, position: [fx - end * 0.2, 3.16, 0], rotation: [0, 0, end * slope] });
    // wiper arms
    for (const z of [-0.68, 0.68]) b.add(new THREE.BoxGeometry(0.03, 0.7, 0.03), { color: '#111', position: [fx - end * 0.12, 2.95, z + 0.2], rotation: [end * 0.5, 0, end * slope] });

    // roof-front headlamp housing + lamp (WAP-7 style central headlight)
    b.box(xr(HL - 1.0, HL - 0.55), [3.95, 4.18], [-0.32, 0.32], '#2c2f33');
    b.cylinder({ radius: 0.17, length: 0.06, axis: 'x', segments: 16, position: [fx - end * 0.53, 4.065, 0], color: '#fffbe8', mat: end > 0 ? 'lamp' : 'body' });
    // marker / tail lamps at the lower front corners
    for (const z of [-1.12, 1.12]) {
      b.cylinder({ radius: 0.09, length: 0.05, axis: 'x', segments: 12, position: [out(0.02), 2.35, z], color: end > 0 ? '#fffbe8' : '#c81b1b', mat: end > 0 ? 'lamp' : 'body' });
      b.cylinder({ radius: 0.07, length: 0.05, axis: 'x', segments: 10, position: [out(0.02), 2.12, z], color: '#d23a1a' });
    }
    // headstock: black lower front, buffers, centre-buffer coupler, cowcatcher
    b.box(xr(HL - 0.05, HL + 0.04), [0.95, 1.3], [-1.5, 1.5], '#1b1c1e');
    for (const z of [-0.98, 0.98]) {
      b.cylinder({ radius: 0.11, length: 0.45, axis: 'x', segments: 10, position: [out(0.25), 1.105, z], color: '#333' });
      b.cylinder({ radius: 0.24, length: 0.06, axis: 'x', segments: 16, position: [out(0.48), 1.105, z], color: '#2b2b2b' });
    }
    b.box(xr(HL, HL + 0.62), [0.98, 1.22], [-0.17, 0.17], '#2a2a2a');
    b.add(new THREE.BoxGeometry(0.08, 0.75, 2.7), { color: '#2b2b2b', position: [out(0.3), 0.55, 0], rotation: [0, 0, -end * 0.35] });
    // cab side windows & doors (driver's door near each cab)
    for (const z of [1, -1]) {
      const zz = z > 0 ? [HW + 0.004, HW + 0.02] : [-HW - 0.02, -HW - 0.004];
      b.box(xr(HL - 1.45, HL - 0.6), [2.85, 3.55], zz, '#10181f', { mat: 'glass' });
      b.box(xr(HL - 2.55, HL - 1.7), [1.45, 3.6], zz, '#7d1414');
      b.box(xr(HL - 2.4, HL - 1.85), [2.95, 3.45], z > 0 ? [HW + 0.02, HW + 0.03] : [-HW - 0.03, -HW - 0.02], '#10181f', { mat: 'glass' });
      // grab handles
      for (const hx of [HL - 2.65, HL - 1.6]) b.box(xr(hx - 0.025, hx + 0.025), [1.6, 3.3], z > 0 ? [HW + 0.03, HW + 0.08] : [-HW - 0.08, -HW - 0.03], '#cfcfcf');
      // steps under the door
      b.box(xr(HL - 2.55, HL - 1.7), [0.75, 0.82], z > 0 ? [HW - 0.2, HW + 0.05] : [-HW - 0.05, -HW + 0.2], '#3a3a3a');
    }
  }

  // roof: raised central hatches, equipment, two pantographs on insulators
  b.box([-7.6, 7.6], [4.0, 4.22], [-1.05, 1.05], '#6e7378');
  b.box([-2.5, 2.5], [4.22, 4.42], [-0.7, 0.7], '#4e5358');
  for (const x of [-1.6, 0, 1.6]) b.cylinder({ radius: 0.09, length: 0.35, position: [x, 4.6, 0], color: '#8a4b2a' });
  b.box([-3.6, 3.6], [4.74, 4.8], [-0.05, 0.05], '#9aa0a6'); // roof bus bar
  for (const px of [-5.4, 5.4]) addPantograph(b, px, px < 0);

  return b.build();
}

/** Single-arm pantograph; raised one reaches the contact wire (5.5 m above rail). */
function addPantograph(b, x, raised) {
  const base = 4.42;
  b.box([x - 0.9, x + 0.9], [base - 0.2, base], [-0.75, 0.75], '#3d4045');
  for (const z of [-0.6, 0.6]) for (const dx of [-0.75, 0.75]) b.cylinder({ radius: 0.07, length: 0.22, position: [x + dx, base - 0.31 + 0.2, z], color: '#8a4b2a' });
  const knee = raised ? [x + 1.05, 5.05] : [x + 1.35, 4.62];
  const head = raised ? [x + 0.1, 5.5] : [x + 0.1, 4.7];
  const strut = (from, to, z, t) => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    b.add(new THREE.BoxGeometry(len, t, t), {
      color: '#2f3235',
      position: [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z],
      rotation: [0, 0, Math.atan2(to[1] - from[1], to[0] - from[0])],
    });
  };
  for (const z of [-0.32, 0.32]) {
    strut([x - 0.55, base + 0.05], knee, z, 0.07);
    strut(knee, head, z * 0.5, 0.05);
  }
  b.box([head[0] - 0.12, head[0] + 0.12], [head[1] - 0.02, head[1] + 0.03], [-0.95, 0.95], '#b5b8bb');
}

// ---------------------------------------------------------------- LHB coach
export const COACH_DIM = { halfLength: 11.77, halfWidth: 1.62 };
/** Height of the coach body's underside above rail top (the bogie air springs reach up to it). */
export const COACH_BODY_LIFT = 1.05; // LHB body side bottom, measured from reference photos

/**
 * Everything under and between LHB coach bodies that the GLB body doesn't
 * include: sole bars, underslung equipment, headstocks, centre-buffer
 * couplers and the rubber gangway bellows that join coach to coach.
 * Shares the coach's transform (one instanced mesh for all coaches).
 */
export function buildCoachExtras(gap, length = COACH_DIM.halfLength * 2, type = 'lhb') {
  const b = new ModelBuilder();
  const HL = length / 2;
  const icf = type === 'icf';
  const L = COACH_BODY_LIFT;
  const reach = gap / 2 + 0.02; // bellows/couplers reach just past the midpoint → neighbours touch
  // underside plate + sole bars along both sides
  // kept inside the body's (tapered) lower edge so nothing sticks out sideways
  b.box([-HL + 0.2, HL - 0.2], [L - 0.06, L + 0.02], [-1.15, 1.15], '#2a2c2e');
  for (const z of [-1, 1]) b.box([-HL + 0.1, HL - 0.1], [L - 0.16, L + 0.02], z > 0 ? [1.05, 1.18] : [-1.18, -1.05], '#33363a');
  // underslung equipment between the bogies
  b.cylinder({ radius: 0.36, length: 3.6, axis: 'x', position: [-3.2, L - 0.42, 0.55], color: '#3a3d40', segments: 12 }); // water tank
  b.cylinder({ radius: 0.36, length: 3.6, axis: 'x', position: [2.4, L - 0.42, -0.5], color: '#3a3d40', segments: 12 });
  b.box([0.2, 1.6], [L - 0.62, L - 0.08], [0.1, 1.15], '#303336'); // battery box
  b.box([-1.2, -0.1], [L - 0.5, L - 0.08], [-1.2, -0.3], '#2d3033'); // brake equipment
  b.box([4.2, 5.4], [L - 0.45, L - 0.08], [-1.1, 1.1], '#34373a'); // AC control box
  b.box([-5.6, -4.6], [L - 0.4, L - 0.08], [-0.9, 0.9], '#2f3134');
  for (const end of [1, -1]) {
    const x0 = end * HL;
    const span = (a, c) => (end > 0 ? [x0 + a, x0 + c] : [x0 - c, x0 - a]);
    b.box(span(-0.2, 0), [L - 0.15, L + 0.32], [-1.45, 1.45], '#232527'); // headstock
    if (icf) {
      // ICF: side buffers + screw coupling + brake hoses
      for (const z of [-0.95, 0.95]) {
        b.cylinder({ radius: 0.09, length: reach, axis: 'x', position: [x0 + end * (reach / 2), 1.105, z], color: '#2a2a2a', segments: 10 });
        b.cylinder({ radius: 0.2, length: 0.05, axis: 'x', position: [x0 + end * (reach - 0.025), 1.105, z], color: '#333', segments: 14 });
      }
      b.box(span(0, reach), [1.04, 1.12], [-0.05, 0.05], '#1f2022');
      b.cylinder({ radius: 0.03, length: 0.5, position: [x0 + end * 0.12, 0.95, 0.35], color: '#b02020', segments: 6 });
      b.cylinder({ radius: 0.03, length: 0.5, position: [x0 + end * 0.12, 0.95, -0.35], color: '#2d7a2d', segments: 6 });
    } else {
      b.box(span(-0.1, reach), [L + 0.03, L + 0.23], [-0.16, 0.16], '#1f2022'); // CBC coupler
      b.box(span(reach - 0.06, reach), [L - 0.02, L + 0.28], [-0.24, 0.24], '#1f2022'); // coupler head
    }
    // gangway: rubber bellows with fold ridges, meeting the neighbouring coach
    const vw = icf ? 0.55 : 0.66; // vestibule half-width
    b.box(span(-0.05, reach), [L + 0.3, L + 2.45], [-vw, vw], '#151515');
    for (const k of [0.25, 0.5, 0.75]) b.box(span(reach * k - 0.02, reach * k + 0.02), [L + 0.27, L + 2.48], [-vw - 0.03, vw + 0.03], '#0e0e0e');
    b.box(span(-0.04, 0.02), [L + 0.25, L + 2.52], [-vw - 0.12, vw + 0.12], '#2a2a2a'); // gangway frame on the end wall
  }
  return b.build().body;
}

// ---------------------------------------------------------------- bogies & wheels
export function buildBogieFrame(kind) {
  const b = new ModelBuilder();
  const loco = kind === 'loco';
  if (kind === 'icf') return buildIcfBogie();
  const len = loco ? 4.6 : 3.4;
  const r = loco ? 0.546 : 0.4575;
  for (const z of [1, -1]) {
    const zc = z * 1.08;
    b.box([-len / 2, len / 2], [r + 0.05, r + 0.35], [zc - 0.12, zc + 0.12], '#2a2c2f');
    const axles = loco ? [-1.9, 0, 1.9] : [-1.28, 1.28];
    for (const ax of axles) {
      b.box([ax - 0.22, ax + 0.22], [r - 0.15, r + 0.15], [zc - 0.14, zc + 0.14], '#36393c'); // axle box
      // primary coil springs: tall on the loco bogie, low over the axle boxes on the LHB bogie
      if (loco) b.cylinder({ radius: 0.11, length: 0.35, position: [ax, r + 0.5, zc], color: '#8c2020', segments: 8 });
      else b.cylinder({ radius: 0.1, length: 0.18, position: [ax, r + 0.24, zc], color: '#3c3f42', segments: 8 });
    }
  }
  b.box([-0.35, 0.35], [r + 0.1, r + 0.4], [-1.08, 1.08], '#2a2c2f'); // transom
  if (!loco) {
    // LHB (FIAT) bogie: bolster beam + two large black air springs that carry the body
    b.box([-0.45, 0.45], [r + 0.35, r + 0.47], [-1.3, 1.3], '#2a2c2f');
    for (const z of [-1.0, 1.0]) b.cylinder({ radius: 0.26, length: 0.14, position: [0, COACH_BODY_LIFT - 0.05, z], color: '#1b1b1b', segments: 14 });
    // brake discs on each axle (LHB coaches have disc brakes)
    for (const ax of [-1.28, 1.28]) for (const z of [-0.35, 0.35]) b.cylinder({ radius: 0.3, length: 0.06, axis: 'z', position: [ax, r, z], color: '#4b4f53', segments: 14 });
  }
  if (loco) for (const ax of [-0.95, 0.95]) b.box([ax - 0.4, ax + 0.4], [0.25, 0.85], [-0.6, 0.6], '#232527'); // traction motors
  return b.build().body;
}

/** ICF all-coil bogie: big black dashpot springs at each axle box, bolster springs, tread brakes. */
function buildIcfBogie() {
  const b = new ModelBuilder();
  const r = 0.4575;
  const ax = 1.448;
  for (const z of [1, -1]) {
    const zc = z * 1.1;
    b.box([-ax - 0.45, ax + 0.45], [r + 0.08, r + 0.36], [zc - 0.11, zc + 0.11], '#2b2d30'); // side frame
    for (const x of [-ax, ax]) {
      b.box([x - 0.2, x + 0.2], [r - 0.14, r + 0.12], [zc - 0.13, zc + 0.13], '#34373a'); // axle box
      for (const dx of [-0.32, 0.32]) b.cylinder({ radius: 0.1, length: 0.32, position: [x + dx, r + 0.22, zc], color: '#1b1c1e', segments: 10 }); // dashpot springs
      b.box([x - 0.55, x - 0.42], [r - 0.25, r + 0.15], [zc - 0.25, zc - 0.05], '#3a3c3e'); // brake block
    }
    for (const dx of [-0.35, 0.35]) b.cylinder({ radius: 0.15, length: 0.42, position: [dx, COACH_BODY_LIFT - 0.27, zc - z * 0.15], color: '#1b1c1e', segments: 12 }); // bolster springs
  }
  b.box([-0.5, 0.5], [r + 0.2, r + 0.42], [-1.25, 1.25], '#2b2d30'); // bolster
  b.box([-ax + 0.3, ax - 0.3], [r + 0.15, r + 0.3], [-0.12, 0.12], '#2b2d30'); // transoms
  return b.build().body;
}

export function buildWheelset(radius) {
  const b = new ModelBuilder();
  const half = TRACK.gauge / 2;
  for (const z of [half, -half]) {
    b.cylinder({ radius, length: 0.13, axis: 'z', segments: 20, position: [0, 0, z], color: '#3b3836' });
    b.cylinder({ radius: radius * 1.06, length: 0.025, axis: 'z', segments: 20, position: [0, 0, z - Math.sign(z) * 0.07], color: '#2e2c2a' }); // flange
    b.box([-0.04, 0.04], [0, radius * 0.85], [z - 0.075, z + 0.075], '#8f8a82'); // marker so rotation is visible
  }
  b.cylinder({ radius: 0.08, length: TRACK.gauge, axis: 'z', segments: 8, color: '#222' });
  return b.build().body;
}

/**
 * Authentic Indian Railways rear-end vehicle markers:
 * 1. Bold Yellow reflective "LV" (Last Vehicle) circular board with black rim & letters
 * 2. Large yellow/red diagonal cross ("X") stripes across the rear wall
 * 3. Tail lamp bracket & housing for the 1.25 Hz pulsing red LED
 */
/**
 * Last-vehicle markings, as on every Indian Railways train: a big yellow
 * "X" (retro-reflective paint, white-bordered) on the closed rear gangway
 * door, the black-on-yellow "LV" (Last Vehicle) board, and the bracket for the
 * flashing red tail lamp. Origin = centre of the coach's rear end wall at rail
 * level; the coach body is towards +X.
 * keys: body (vertex colours), reflect (glows a little when lit at night)
 */
export function buildRearEndIndicators(type = 'lhb') {
  if (type === 'boxn') return buildWagonRearEnd();
  if (type === 'van') return buildWagonRearEnd({ withX: false }); // brake van: LV board + tail lamp, no X
  const b = new ModelBuilder();
  const icf = type === 'icf';
  const reach = (icf ? 0.7 : 0.5) / 2 + 0.02; // how far the gangway bellows stick out
  const vw = icf ? 0.55 : 0.66;
  const y0 = COACH_BODY_LIFT + 0.3;
  const y1 = COACH_BODY_LIFT + 2.45;
  const xf = -reach - 0.012; // face of the gangway door

  // 1. closed gangway door over the bellows
  b.box([-reach - 0.01, -reach + 0.02], [y0, y1], [-vw, vw], '#2c2f33');
  b.box([-reach - 0.012, -reach - 0.008], [y0 + 0.15, y1 - 0.15], [-vw + 0.12, vw - 0.12], '#34383d');

  // 2. the "X": two diagonal yellow bars with a white border, corner to corner
  const dy = y1 - y0 - 0.25;
  const dz = 2 * vw - 0.2;
  const len = Math.hypot(dy, dz);
  const ang = Math.atan2(dy, dz);
  const yc = (y0 + y1) / 2;
  for (const sgn of [1, -1]) {
    b.add(new THREE.BoxGeometry(0.008, 0.24, len + 0.06), { color: '#f4f2ea', mat: 'reflect', position: [xf - 0.004, yc, 0], rotation: [sgn * ang, 0, 0] });
    b.add(new THREE.BoxGeometry(0.008, 0.16, len), { color: '#f7c600', mat: 'reflect', position: [xf - 0.012, yc, 0], rotation: [sgn * ang, 0, 0] });
  }

  // 3. "LV" board on the end wall, right of the gangway (black letters on yellow)
  const lz = vw + 0.42;
  const ly = COACH_BODY_LIFT + 0.75;
  b.cylinder({ radius: 0.27, length: 0.02, axis: 'x', position: [-0.025, ly, lz], color: '#111', segments: 28 });
  b.cylinder({ radius: 0.25, length: 0.02, axis: 'x', position: [-0.035, ly, lz], color: '#f5c316', mat: 'reflect', segments: 28 });
  const lx = [-0.05, -0.044];
  // L
  b.box(lx, [ly - 0.11, ly + 0.11], [lz - 0.15, lz - 0.115], '#111');
  b.box(lx, [ly - 0.11, ly - 0.075], [lz - 0.15, lz - 0.04], '#111');
  // V (two slanted strokes)
  for (const sgn of [-1, 1]) {
    b.add(new THREE.BoxGeometry(0.006, 0.24, 0.035), { color: '#111', position: [-0.047, ly, lz + 0.075 + sgn * 0.03], rotation: [sgn * 0.27, 0, 0] });
  }

  // 4. tail lamp bracket + housing on the left of the gangway
  const tz = -(vw + 0.4);
  b.box([-0.05, 0.02], [1.9, 1.96], [tz - 0.05, tz + 0.05], '#1f2022');
  b.cylinder({ radius: 0.075, length: 0.08, axis: 'x', position: [-0.04, 1.98, tz], color: '#1a1a1a', segments: 16 });
  return b.build();
}

/**
 * Last BOXN wagon of a goods train: the X painted straight onto the wagon's
 * end wall (there's no gangway), the LV board and the tail lamp bracket.
 * The wall is 0.3 m in from the coupler face (the rear-end origin).
 */
function buildWagonRearEnd({ withX = true } = {}) {
  const b = new ModelBuilder();
  const xf = 0.215; // just proud of the end stanchions
  const y0 = 1.35;
  const y1 = 3.05;
  const hz = 1.3;
  const len = Math.hypot(y1 - y0, 2 * hz);
  const ang = Math.atan2(y1 - y0, 2 * hz);
  for (const sgn of withX ? [1, -1] : []) {
    b.add(new THREE.BoxGeometry(0.008, 0.24, len + 0.06), { color: '#f4f2ea', mat: 'reflect', position: [xf, (y0 + y1) / 2, 0], rotation: [sgn * ang, 0, 0] });
    b.add(new THREE.BoxGeometry(0.008, 0.16, len), { color: '#f7c600', mat: 'reflect', position: [xf - 0.008, (y0 + y1) / 2, 0], rotation: [sgn * ang, 0, 0] });
  }
  const lz = 0.95;
  const ly = 1.05;
  b.cylinder({ radius: 0.27, length: 0.02, axis: 'x', position: [xf - 0.01, ly, lz], color: '#111', segments: 28 });
  b.cylinder({ radius: 0.25, length: 0.02, axis: 'x', position: [xf - 0.02, ly, lz], color: '#f5c316', mat: 'reflect', segments: 28 });
  const lx = [xf - 0.036, xf - 0.03];
  b.box(lx, [ly - 0.11, ly + 0.11], [lz - 0.15, lz - 0.115], '#111');
  b.box(lx, [ly - 0.11, ly - 0.075], [lz - 0.15, lz - 0.04], '#111');
  for (const sgn of [-1, 1]) b.add(new THREE.BoxGeometry(0.006, 0.24, 0.035), { color: '#111', position: [xf - 0.033, ly, lz + 0.075 + sgn * 0.03], rotation: [sgn * 0.27, 0, 0] });
  b.box([xf - 0.07, xf], [1.9, 1.96], [-1.15, -1.05], '#1f2022');
  b.cylinder({ radius: 0.075, length: 0.08, axis: 'x', position: [xf - 0.04, 1.98, -1.1], color: '#1a1a1a', segments: 16 });
  return b.build();
}

/** Where the tail lamp sits on the rear end (matches buildRearEndIndicators). */
export function tailLampPosition(type = 'lhb') {
  if (type === 'boxn' || type === 'van') return [0.13, 1.98, -1.1];
  const vw = type === 'icf' ? 0.55 : 0.66;
  return [-0.09, 1.98, -(vw + 0.4)];
}

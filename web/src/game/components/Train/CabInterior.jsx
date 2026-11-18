// Driver's cab of a three-phase loco (WAP-7 / WAG-9), visible only in cab view
// (the exterior body is hidden then). Original procedural model; layout after
// the IRFCA "Under the hood – WAP7" album captions (K. Kagzi, 2009) and RDSO
// documents — see docs/ASSET_CREDITS.md "Cab interior" for every source:
//   · LP on the LEFT, assistant (ALP) on the right with his own truncated desk
//   · light-grey desk; black Panels B (gauges) · A (meters, lamps, switches,
//     red-on-yellow EMERGENCY STOP) · C (DDU, switches, buzzer), angled to the LP
//   · yellow SA9 independent-brake handle on a low pedestal at the far left,
//     the A9 train-brake plate with its zones, the black-ball TE/BE stick
//   · speedometer box on the centre pillar, Kavach DMI above Panel B (RM/0197)
//   · floor pedals SANDING · PVEF · VIGILANCE, blue high-back seats, corner fans,
//     back-wall door to the machine-room corridor, folding inspector's seat
//     75 cm above the floor (RDSO MS/0494)
// GAME APPROXIMATIONS: all dimensions (no cab drawing was found), the side of
// the corridor door, the TE/BE sense (TE forward) and the reverser's form.
//
// The panels' faces are ONE quad mesh textured by a live canvas
// (cabDisplays.js); the handles move with the controls. Draw calls in cab
// view: static cab 1, panels 1, handles 4, wipers 2, lamp 1.
import * as THREE from 'three';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { LOCO_DIM } from '../../world/models/trainModels.js';
import { CANVAS_W, CANVAS_H, PX_PER_M, REGIONS, PANEL_A_TOGGLES, EMERGENCY_STOP, drawCab, dduLines } from './cabDisplays.js';

const HL = LOCO_DIM.halfLength;
// Indian locos have the driver's desk on the LEFT (local -z).
export const CAB_EYE = [HL - 1.3, 3.12, -0.6];
export const CAB_LOOK_PITCH_DEG = -3;
export const SPEEDO_MAX_KMH = 160;

const WALL = '#c3c6c1';
const CEIL = '#dcd9cf';
const DESK = '#c9ccc8';
const TRIM = '#7d8388';
const BLACK = '#17191b';
const SEAT = '#3f5f8f';
const W = 1.48; // inner half width
const FLOOR = 1.2;

// the instrument band: from the desk's rear edge up to the ledge under the windscreen
const XB = HL - 0.46; // panel bottom edge (x)
const YB = 2.16; // desk top
const XT = HL - 0.25; // panel top edge (x)
const YT = 2.6;
const UP_AB = new THREE.Vector3(XT - XB, YT - YB, 0).normalize();
const C_ANGLE = (25 * Math.PI) / 180; // Panel C turned towards the LP
const UP_C = new THREE.Vector3((XT - XB) * Math.cos(C_ANGLE), YT - YB, (XT - XB) * Math.sin(C_ANGLE)).normalize();
const RIGHT_C = new THREE.Vector3(-Math.sin(C_ANGLE), 0, Math.cos(C_ANGLE));
const Z_B0 = -1.12; // left edge of Panel B

/** A panel frame: canvas pixel (px, py) → cab coordinates. */
function frame(origin, right, up, [rx0, , , ry1]) {
  const normal = new THREE.Vector3().crossVectors(right, up).normalize();
  return {
    origin,
    right,
    up,
    normal,
    at(px, py, out = 0) {
      return origin
        .clone()
        .addScaledVector(right, (px - rx0) / PX_PER_M)
        .addScaledVector(up, (ry1 - py) / PX_PER_M)
        .addScaledVector(normal, out);
    },
  };
}
function yawRight(theta) {
  return new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta)); // face normal (-cos θ, 0, -sin θ): towards the LP
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// where every textured face sits
const FRAMES = {
  B: frame(V(XB, YB, Z_B0), V(0, 0, 1), UP_AB, REGIONS.B),
  A: frame(V(XB, YB, Z_B0 + REGIONS.A[0] / PX_PER_M), V(0, 0, 1), UP_AB, REGIONS.A),
  C: frame(V(XB, YB, Z_B0 + REGIONS.C[0] / PX_PER_M), RIGHT_C, UP_C, REGIONS.C),
  D: frame(V(XB, YB, 0.8), V(0, 0, 1), UP_AB, REGIONS.D),
  // speedometer box on the centre pillar, turned ~30° towards the LP
  SPEEDO: frame(V(HL - 0.43, 2.78, -0.08), yawRight(0.52), V(0, 1, 0), REGIONS.SPEEDO),
  // Kavach DMI on a bracket above Panel B (RDSO RM/0197 Scheme-II)
  DMI: frame(V(XT - 0.03, 2.7, -1.07), yawRight(-0.18), V(0.17, 1, 0).normalize(), REGIONS.DMI),
  // flat plates on the desk top: canvas "up" = forward (+x)
  A9: frame(V(HL - 0.83, YB + 0.004, -1.11), V(0, 0, 1), V(1, 0, 0), REGIONS.A9),
  TEBE: frame(V(HL - 0.89, YB + 0.004, -0.22), V(0, 0, 1), V(1, 0, 0), REGIONS.TEBE),
  // AR PR gauge on a small plate angled up at the left end of the desk
  ARPR: frame(V(HL - 0.62, YB + 0.02, -1.42), V(0, 0, 1), V(0.5, 0.86, 0).normalize(), REGIONS.ARPR),
  // pedal labels on the knee-well's back plate
  PEDALS: frame(V(HL - 0.603, 1.5, -0.97), V(0, 0, 1), V(0, 1, 0), REGIONS.PEDALS),
};

/** Static cab: walls, desks, seats, fittings — merged into one vertex-coloured mesh. */
export function buildCabInterior() {
  const b = new ModelBuilder();
  const slope = Math.atan2(0.42, 1.1);
  const xs = (y) => HL - 0.08 - ((y - 2.62) / 1.1) * 0.42; // windscreen x at height y

  // ---- shell: floor, front wall, header, pillars, side walls with windows, back wall, ceiling
  b.box([HL - 2.6, HL - 0.05], [FLOOR - 0.05, FLOOR], [-W, W], '#3a3d40');
  b.box([HL - 2.55, HL - 1.0], [FLOOR, FLOOR + 0.01], [-1.2, 1.2], '#2c2f31'); // rubber mat
  b.box([HL - 0.08, HL], [FLOOR, 2.62], [-W, W], WALL);
  b.box([xs(3.72) - 0.5, xs(3.72) + 0.02], [3.72, 4.02], [-W, W], WALL);
  for (const [z, wd] of [
    [0, 0.14], // the wide centre pillar between the two panes
    [-W + 0.04, 0.08],
    [W - 0.04, 0.08],
  ]) {
    b.add(new THREE.BoxGeometry(0.06, 1.18, wd), { color: TRIM, position: [xs(3.17), 3.17, z], rotation: [0, 0, slope] });
  }
  b.add(new THREE.BoxGeometry(0.28, 0.02, 1.1), { color: '#22272b', position: [xs(3.65) - 0.2, 3.66, -0.7], rotation: [0, 0, -0.15] }); // sun visor
  for (const s of [1, -1]) {
    const z = s > 0 ? [W, W + 0.05] : [-W - 0.05, -W];
    b.box([HL - 2.6, HL - 0.05], [FLOOR, 2.82], z, WALL);
    b.box([HL - 2.6, HL - 0.05], [3.58, 4.02], z, WALL);
    b.box([HL - 2.6, HL - 1.5], [2.82, 3.58], z, WALL);
    // window frame and the sliding pane's mullion
    const zi = s > 0 ? [W - 0.03, W] : [-W, -W + 0.03];
    b.box([HL - 1.5, HL - 0.05], [2.8, 2.84], zi, TRIM);
    b.box([HL - 1.5, HL - 0.05], [3.56, 3.6], zi, TRIM);
    b.box([HL - 0.9, HL - 0.86], [2.84, 3.56], zi, TRIM);
  }
  b.box([HL - 2.66, HL - 2.6], [FLOOR, 4.02], [-W, W], WALL);
  b.box([HL - 2.66, HL], [4.02, 4.08], [-W - 0.05, W + 0.05], CEIL);
  // ceiling: an air duct along the cab and two light fittings
  b.box([HL - 2.6, HL - 0.6], [3.9, 4.02], [-0.16, 0.16], '#aeb1ad');
  for (const z of [-0.75, 0.75]) b.box([HL - 1.7, HL - 1.25], [3.98, 4.02], [z - 0.13, z + 0.13], '#f4f1e6');

  // ---- back wall: corridor door to the machine room, folding inspector's seat (MS/0494)
  b.box([HL - 2.6, HL - 2.57], [FLOOR, 3.15], [0.45, 1.2], '#b7bab5');
  b.box([HL - 2.57, HL - 2.56], [2.4, 2.95], [0.62, 1.03], '#2b3036'); // door window
  b.box([HL - 2.57, HL - 2.53], [2.0, 2.06], [1.05, 1.12], '#8a8d90'); // handle
  for (const z of [-0.62, -0.18]) b.box([HL - 2.6, HL - 2.56], [1.6, 2.4], [z - 0.025, z + 0.025], '#8a8d90'); // channels
  b.box([HL - 2.56, HL - 2.5], [1.95, 2.42], [-0.6, -0.2], '#3b4a5e'); // the seat, folded up

  // ---- LP desk: top, front with a knee-well, pedals
  b.box([HL - 1.02, XB + 0.02], [YB - 0.05, YB], [-1.12, 0.46], DESK, { topColor: '#d3d6d1' });
  b.box([HL - 0.75, XB + 0.02], [YB - 0.05, YB], [-W, -1.12], DESK); // left end, behind the SA9 pedestal
  for (const [z0, z1] of [
    [-1.12, -0.95],
    [-0.25, 0.46],
  ])
    b.box([HL - 1.0, HL - 0.47], [FLOOR, YB - 0.05], [z0, z1], DESK);
  b.box([HL - 1.0, HL - 0.47], [1.95, YB - 0.05], [-0.95, -0.25], DESK); // over the knee-well
  b.box([HL - 0.6, HL - 0.47], [FLOOR, 1.95], [-0.95, -0.25], '#b5b8b4'); // knee-well back plate
  for (let i = 0; i < 3; i++) {
    const z = -0.908 + i * 0.123;
    b.cylinder({ radius: 0.035, length: 0.06, axis: 'x', position: [HL - 0.62, 1.36, z], color: '#5c6064' });
    b.cylinder({ radius: 0.022, length: 0.03, axis: 'x', position: [HL - 0.665, 1.36, z], color: '#9a9ea2' });
  }
  // the ledge under the windscreen, above the panels
  b.box([XT - 0.005, HL - 0.08], [YT - 0.005, 2.625], [-W, W], DESK);
  // black band behind the panels where there is no instrument face (leans with the panels)
  const slab = (z0, z1) => {
    const n = V(-UP_AB.y, UP_AB.x, 0);
    const c = V((XB + XT) / 2, (YB + YT) / 2, (z0 + z1) / 2).addScaledVector(n, -0.008);
    b.add(new THREE.BoxGeometry(0.01, Math.hypot(XT - XB, YT - YB), z1 - z0), { color: BLACK, position: c.toArray(), rotation: [0, 0, -Math.atan2(XT - XB, YT - YB)] });
  };
  slab(-W, Z_B0);
  // left pedestal with the SA9 independent brake (yellow rotary handle)
  b.box([HL - 1.2, HL - 0.75], [FLOOR, 1.98], [-W, -1.12], DESK, { topColor: '#d3d6d1' });
  b.box([HL - 1.07, HL - 0.87], [1.98, 1.99], [-1.4, -1.2], '#1c1d1f');
  b.cylinder({ radius: 0.07, length: 0.05, position: [HL - 0.97, 2.015, -1.3], color: '#e8b51c' });
  b.cylinder({ radius: 0.035, length: 0.09, position: [HL - 0.97, 2.08, -1.3], color: '#e8b51c' });
  b.add(new THREE.BoxGeometry(0.16, 0.035, 0.04), { color: '#1b1b1b', position: [HL - 1.04, 2.12, -1.3], rotation: [0, 0.3, 0] });
  // AR PR plate support
  b.box([HL - 0.66, HL - 0.5], [YB, YB + 0.03], [-1.44, -1.26], '#a9aca8');
  // A9 and TE/BE plates sit on the desk (their faces come from the canvas)
  // emergency stop: a red mushroom on Panel A (the yellow ring is drawn on the canvas)
  {
    const f = FRAMES.A;
    const p = f.at(EMERGENCY_STOP.x, EMERGENCY_STOP.y, 0.012);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), f.normal);
    const m = new THREE.Matrix4().compose(p, q, V(1, 1, 1));
    b.add(new THREE.CylinderGeometry(0.018, 0.018, 0.025, 12), { color: '#2b2b2b', matrix: m });
    b.add(new THREE.SphereGeometry(0.03, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), { color: '#c81e1e', position: [0, 0.012, 0], scale: [1, 0.55, 1], matrix: m });
    // toggle levers on Panel A
    for (const t of PANEL_A_TOGGLES) {
      const up = t.name === 'ZPT' || t.name === 'BLDJ' || t.name === 'BLCP';
      const base = f.at(t.x, t.y, 0.004);
      const tip = base.clone().addScaledVector(f.normal, 0.022).addScaledVector(f.up, up ? 0.012 : -0.012);
      b.add(new THREE.CylinderGeometry(0.004, 0.003, base.distanceTo(tip), 6), {
        color: '#e1e3e5',
        matrix: new THREE.Matrix4().compose(base.clone().add(tip).multiplyScalar(0.5), new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), tip.clone().sub(base).normalize()), V(1, 1, 1)),
      });
    }
  }
  // speedometer box and its bracket
  {
    const f = FRAMES.SPEEDO;
    const w = (REGIONS.SPEEDO[2] - REGIONS.SPEEDO[0]) / PX_PER_M;
    const h = (REGIONS.SPEEDO[3] - REGIONS.SPEEDO[1]) / PX_PER_M;
    const c = f.at((REGIONS.SPEEDO[0] + REGIONS.SPEEDO[2]) / 2, (REGIONS.SPEEDO[1] + REGIONS.SPEEDO[3]) / 2);
    const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.normal).setPosition(c);
    b.add(new THREE.BoxGeometry(w + 0.04, h + 0.05, 0.17), { color: '#b9bcb8', position: [0, 0.01, -0.087], matrix: m });
    b.add(new THREE.BoxGeometry(w + 0.04, 0.03, 0.08), { color: '#8f9396', position: [0, h / 2 + 0.05, -0.05], rotation: [0.5, 0, 0], matrix: m }); // louvred hood
    b.box([HL - 0.36, HL - 0.3], [2.62, 2.79], [-0.04, 0.02], TRIM); // bracket to the pillar
  }
  // Kavach DMI housing
  {
    const f = FRAMES.DMI;
    const w = (REGIONS.DMI[2] - REGIONS.DMI[0]) / PX_PER_M;
    const h = (REGIONS.DMI[3] - REGIONS.DMI[1]) / PX_PER_M;
    const c = f.at((REGIONS.DMI[0] + REGIONS.DMI[2]) / 2, (REGIONS.DMI[1] + REGIONS.DMI[3]) / 2);
    const m = new THREE.Matrix4().makeBasis(f.right, f.up, f.normal).setPosition(c);
    b.add(new THREE.BoxGeometry(w + 0.03, h + 0.03, 0.06), { color: '#232527', position: [0, 0, -0.032], matrix: m });
    b.box([XT, XT + 0.04], [2.62, 2.72], [-0.94, -0.9], '#3a3d40'); // slim bracket on the ledge
  }
  // horn joystick (rubber boot) in front of Panel B
  b.cylinder({ radiusTop: 0.012, radiusBottom: 0.035, length: 0.05, position: [HL - 0.6, YB + 0.025, -0.82], color: '#1b1b1b', segments: 10 });
  b.cylinder({ radius: 0.05, length: 0.006, position: [HL - 0.6, YB + 0.003, -0.82], color: '#b9a46a', segments: 14 });

  // ---- ALP desk (truncated) with Panel D and a horn handle
  b.box([HL - 0.88, XB + 0.02], [FLOOR, YB], [0.62, W], DESK, { topColor: '#d3d6d1' });
  slab(0.46, W);
  b.add(new THREE.BoxGeometry(0.03, 0.2, 0.03), { color: '#1b1b1b', position: [HL - 0.7, YB + 0.1, 1.15], rotation: [0, 0, -0.35] });
  b.cylinder({ radius: 0.025, length: 0.04, position: [HL - 0.735, YB + 0.2, 1.15], color: '#c81e1e' });

  // ---- seats: blue fabric, high back, on a pedestal (LP and ALP)
  for (const z of [-0.6, 0.98]) {
    b.cylinder({ radius: 0.06, length: 0.42, position: [HL - 1.5, FLOOR + 0.21, z], color: '#2a2c2e' });
    b.box([HL - 1.75, HL - 1.25], [FLOOR + 0.42, FLOOR + 0.56], [z - 0.26, z + 0.26], SEAT);
    b.add(new THREE.BoxGeometry(0.12, 0.9, 0.5), { color: SEAT, position: [HL - 1.82, FLOOR + 1.0, z], rotation: [0, 0, 0.12] });
    b.add(new THREE.BoxGeometry(0.1, 0.16, 0.34), { color: SEAT, position: [HL - 1.9, FLOOR + 1.52, z], rotation: [0, 0, 0.12] }); // head rest
    for (const s of [-1, 1]) b.box([HL - 1.75, HL - 1.4], [FLOOR + 0.78, FLOOR + 0.82], [z + s * 0.27 - 0.03, z + s * 0.27 + 0.03], '#2a2c2e');
  }

  // ---- cab fans in the upper corners, LP and ALP side (110 V DC wire-cage fans)
  for (const z of [-1.25, 1.25]) {
    b.cylinder({ radius: 0.018, length: 0.16, axis: 'y', position: [HL - 1.1, 3.65, z], color: '#2a2d30' });
    b.cylinder({ radius: 0.14, length: 0.04, axis: 'x', position: [HL - 1.02, 3.55, z], color: '#3c4045' });
    b.box([HL - 1.04, HL - 1.0], [3.44, 3.66], [z - 0.01, z + 0.01], '#50565c');
  }
  return b.build();
}

/** The panel faces: one geometry, UV-mapped to the regions of the live canvas. */
function buildPanelFaces() {
  const geos = [];
  for (const [key, f] of Object.entries(FRAMES)) {
    const [x0, y0, x1, y1] = REGIONS[key];
    const p00 = f.at(x0, y1, 0.002);
    const p10 = f.at(x1, y1, 0.002);
    const p11 = f.at(x1, y0, 0.002);
    const p01 = f.at(x0, y0, 0.002);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([...p00.toArray(), ...p10.toArray(), ...p11.toArray(), ...p01.toArray()], 3));
    const u = (x) => x / CANVAS_W;
    const v = (y) => 1 - y / CANVAS_H;
    g.setAttribute('uv', new THREE.Float32BufferAttribute([u(x0), v(y1), u(x1), v(y1), u(x1), v(y0), u(x0), v(y0)], 2));
    g.setAttribute('normal', new THREE.Float32BufferAttribute([...f.normal.toArray(), ...f.normal.toArray(), ...f.normal.toArray(), ...f.normal.toArray()], 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    geos.push(g);
  }
  const positions = [];
  const uvs = [];
  const normals = [];
  const index = [];
  let base = 0;
  for (const g of geos) {
    positions.push(...g.attributes.position.array);
    uvs.push(...g.attributes.uv.array);
    normals.push(...g.attributes.normal.array);
    index.push(...g.index.array.map((i) => i + base));
    base += 4;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  out.setIndex(index);
  out.computeBoundingSphere();
  return out;
}

/**
 * Moving cab parts: the live instrument canvas, the TE/BE stick, the reverser,
 * the A9 handle, the horn joystick, two wipers and the ceiling lamp.
 * Train.jsx mounts `group` in the cab and calls update(dt, ctx) each frame.
 */
export function buildCabMoving() {
  const group = new THREE.Group();
  const mats = [];
  const mat = (o) => {
    const m = new THREE.MeshStandardMaterial(o);
    mats.push(m);
    return m;
  };
  const dark = mat({ color: '#141414', roughness: 0.6 });
  const handleMat = mat({ vertexColors: true, roughness: 0.45, metalness: 0.2 });

  // live instrument canvas on every panel face
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx2d = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const panelMat = mat({ map: tex, emissiveMap: tex, emissive: '#ffffff', emissiveIntensity: 0.32, roughness: 0.55 });
  const panels = new THREE.Mesh(buildPanelFaces(), panelMat);
  group.add(panels);

  const handle = (fn) => {
    const b = new ModelBuilder();
    fn(b);
    return new THREE.Mesh(b.build().body, handleMat);
  };
  // TE/BE stick: pivots in its slot (rotation about the cab's z axis)
  const tebeC = FRAMES.TEBE.at((REGIONS.TEBE[0] + REGIONS.TEBE[2]) / 2, (REGIONS.TEBE[1] + REGIONS.TEBE[3]) / 2);
  const throttle = new THREE.Group();
  throttle.position.copy(tebeC);
  throttle.add(
    handle((b) => {
      b.cylinder({ radiusTop: 0.008, radiusBottom: 0.03, length: 0.04, position: [0, 0.02, 0], color: '#111', segments: 10 });
      b.cylinder({ radius: 0.011, length: 0.19, position: [0, 0.115, 0], color: '#2a2a2a', segments: 8 });
      b.add(new THREE.SphereGeometry(0.035, 14, 10), { color: '#0d0d0d', position: [0, 0.225, 0] });
    }),
  );
  group.add(throttle);
  // reverser lever at the plate's left edge (F / 0 / R)
  const reverser = new THREE.Group();
  reverser.position.copy(FRAMES.TEBE.at(REGIONS.TEBE[0] + 10, (REGIONS.TEBE[1] + REGIONS.TEBE[3]) / 2)).add(V(0, 0, -0.02));
  reverser.add(
    handle((b) => {
      b.box([-0.008, 0.008], [0, 0.07], [-0.008, 0.008], '#3a3d40');
      b.box([-0.03, 0.03], [0.065, 0.085], [-0.01, 0.01], '#d6d6d0');
    }),
  );
  group.add(reverser);
  // A9 train-brake handle: a horizontal lever with a black knob, sweeping the zones
  const a9 = new THREE.Group();
  a9.position.copy(FRAMES.A9.at((REGIONS.A9[0] + REGIONS.A9[2]) / 2, (REGIONS.A9[1] + REGIONS.A9[3]) / 2));
  a9.add(
    handle((b) => {
      b.cylinder({ radius: 0.022, length: 0.05, position: [0, 0.025, 0], color: '#4a4d50', segments: 12 });
      b.box([-0.012, 0.012], [0.04, 0.06], [0, 0.2], '#9a9ea2');
      b.add(new THREE.SphereGeometry(0.028, 12, 8), { color: '#0d0d0d', position: [0, 0.055, 0.21] });
    }),
  );
  group.add(a9);
  // horn joystick
  const horn = new THREE.Group();
  horn.position.set(HL - 0.6, YB + 0.045, -0.82);
  horn.add(
    handle((b) => {
      b.cylinder({ radius: 0.006, length: 0.07, position: [0, 0.035, 0], color: '#2a2a2a', segments: 6 });
      b.add(new THREE.SphereGeometry(0.014, 10, 8), { color: '#0d0d0d', position: [0, 0.074, 0] });
    }),
  );
  group.add(horn);

  // wipers: pivot at the bottom of the windscreen, local +Y up along the glass, +X = glass normal
  const slope = Math.atan2(0.42, 1.1);
  const wipers = [-0.62, 0.55].map((z) => {
    const g = new THREE.Group();
    g.position.set(HL - 0.13, 2.7, z);
    g.rotation.set(0, 0, slope);
    const arm = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.62, 0.018), dark);
    blade.position.y = 0.31;
    arm.add(blade);
    g.add(arm);
    group.add(g);
    return { group: g, arm };
  });
  // cab ceiling lamp (a small glowing panel; the "light" is a warm emissive boost on the cab)
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.14), mat({ color: '#fff3d6', emissive: '#ffe2a8', emissiveIntensity: 0 }));
  lamp.position.set(HL - 1.4, 4.0, -0.2);
  group.add(lamp);

  const st = { speed: 0, wipe: 0, redraw: 1, t: 0, lastBp: null, flow: 0, flowLamp: false };
  return {
    group,
    lamp,
    /**
     * ctx: { train, kavach, kavachOn, vcd, headlight, cabLight, horn, env, hotelLoad }
     */
    update(dt, c) {
      const tr = c.train;
      st.t += dt;
      // speedometer needle lag, like a real gauge
      st.speed += (tr.speedMps * 3.6 - st.speed) * Math.min(1, dt / 0.35);
      // handles follow the controls
      throttle.rotation.z = -0.45 * Math.max(-1, Math.min(1, tr.lever));
      reverser.rotation.z = -0.45 * (tr.direction ?? 1);
      const ang = tr.emergency ? 0.38 : -2.12 + 2.05 * Math.max(0, Math.min(1, tr.brakeHandle)); // canvas zone angle
      a9.rotation.y = -ang; // lever built along +z; canvas angle a ↦ cab direction (x, z) = (−sin a, cos a)
      horn.rotation.x = c.horn ? 0.3 : 0;
      // wipers sweep while it rains, and park when it stops
      const raining = c.env.rain > 0.15;
      if (raining || Math.abs(Math.sin(st.wipe)) > 0.02) st.wipe += dt * (Math.PI / 0.75);
      const w = -1.25 + 1.15 * (0.5 - 0.5 * Math.cos(st.wipe));
      wipers.forEach((wp, i) => (wp.arm.rotation.x = i ? w : -w));
      // air flow: how fast the brake pipe is recharging (feeds the indicator and LSAF)
      if (st.lastBp !== null && dt > 0) {
        const rise = (tr.bp - st.lastBp) / dt;
        st.flow += (Math.max(0, Math.min(1, rise / 0.45)) - st.flow) * Math.min(1, dt * 3);
      }
      st.lastBp = tr.bp;
      // redraw the canvas ~8× a second
      st.redraw -= dt;
      if (st.redraw > 0) return;
      st.redraw = 0.12;
      const mr = 9.3 + 0.45 * Math.sin(st.t / 37) - 0.8 * st.flow; // GAME ASSUMPTION: compressor cycle 8.5–9.8 kg/cm²
      const oheKv = 25.0 + 0.35 * Math.sin(st.t * 0.13) + 0.12 * Math.sin(st.t * 0.71); // GAME ASSUMPTION
      const vcdWarn = c.vcd?.phase === 'warning';
      const lamps = {
        LSDJ: !!tr.emergency, // the emergency stop opens the VCB (IRFCA brakes doc)
        LSHO: !!c.hotelLoad,
        LSP: !!tr.slipping,
        LSAF: st.flow > 0.6 || !!tr.emergency,
        LSVW: vcdWarn,
        LSCE: false,
        LSFI: c.vcd?.phase === 'penalty',
      };
      const k = c.kavach ?? {};
      drawCab(ctx2d, {
        speedKmh: st.speed,
        bp: tr.bp,
        bc: tr.bc,
        mr,
        fp: 6.0, // GAME ASSUMPTION
        parking: 6.0, // spring parking brake held off by air (GAME ASSUMPTION for the figure)
        airflow: st.flow,
        te: tr.teActual,
        oheKv,
        battV: 110,
        lamps,
        headlight: c.headlight,
        cabLight: c.cabLight,
        night: c.env.night > 0.5,
        ddu: dduLines({ speedKmh: st.speed, te: tr.teActual, oheKv, bp: tr.bp, bc: tr.bc, mr, slipping: tr.slipping, vcdWarn, tractionCut: tr.tractionCut, emergency: tr.emergency }),
        kavach: { on: !!c.kavachOn, state: k.state ?? 'normal', permitted: k.permittedKmh, targetDist: k.target?.distance ?? null, targetKmh: k.target?.kmh ?? null },
      });
      tex.needsUpdate = true;
    },
    dispose() {
      group.traverse((m) => m.geometry?.dispose());
      tex.dispose();
      mats.forEach((m) => m.dispose());
    },
  };
}

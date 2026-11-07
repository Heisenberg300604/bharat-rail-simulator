// Driver's cab interior (visible only in cab view; the exterior body is hidden
// then, so the camera never sees the inside faces of the outer shell).
// Matches the raked windscreen of the locomotive model. Built with
// ModelBuilder → a few merged meshes.
import * as THREE from 'three';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { LOCO_DIM } from '../../world/models/trainModels.js';

const HL = LOCO_DIM.halfLength;
// Indian locos have the driver's desk on the LEFT (local -z).
export const CAB_EYE = [HL - 1.3, 3.12, -0.6];
export const CAB_LOOK_PITCH_DEG = -3;

const WALL = '#7b8790';
const TRIM = '#3c444b';
const DESK = '#56616a';
const W = 1.48; // inner half width

export function buildCabInterior() {
  const b = new ModelBuilder();
  const slope = Math.atan2(0.42, 1.1);
  const xs = (y) => HL - 0.08 - ((y - 2.62) / 1.1) * 0.42; // windscreen x at height y

  // desk under the windscreen, sloping control panel on top
  b.box([HL - 0.95, HL - 0.05], [1.2, 2.5], [-W, W], DESK);
  b.add(new THREE.BoxGeometry(0.6, 0.06, 1.5), { color: '#2b3137', position: [HL - 0.55, 2.58, -0.65], rotation: [0, 0, 0.35] });
  // speed/TE display screens on the driver's panel
  for (const z of [-0.95, -0.55]) {
    b.add(new THREE.BoxGeometry(0.03, 0.13, 0.2), { color: '#15191c', position: [HL - 0.6, 2.66, z], rotation: [0, 0, 0.6] });
    b.add(new THREE.BoxGeometry(0.01, 0.1, 0.17), { mat: 'display', color: '#0b1d24', position: [HL - 0.62, 2.665, z], rotation: [0, 0, 0.6] });
  }
  // round gauges (brake pipe / brake cylinder pressure)
  for (const z of [-1.3, 0.05, 0.25]) {
    b.add(new THREE.CylinderGeometry(0.045, 0.045, 0.02, 18), { color: '#ece6d6', position: [HL - 0.62, 2.63, z], rotation: [0, 0, Math.PI / 2 + 0.6] });
  }
  // TE/BE throttle (left hand) and A9 / SA9 brake handles
  b.box([HL - 0.95, HL - 0.75], [2.5, 2.6], [-1.32, -1.12], '#25292d');
  b.add(new THREE.BoxGeometry(0.05, 0.28, 0.05), { color: '#1b1e21', position: [HL - 0.85, 2.73, -1.22], rotation: [0, 0, -0.4] });
  b.cylinder({ radius: 0.05, length: 0.08, position: [HL - 0.91, 2.87, -1.22], color: '#d9a400' });
  for (const [z, c] of [
    [-0.05, '#b81d1d'],
    [0.2, '#1d4fb8'],
  ]) {
    b.cylinder({ radius: 0.06, length: 0.05, position: [HL - 0.85, 2.53, z], color: '#25292d' });
    b.add(new THREE.BoxGeometry(0.3, 0.035, 0.035), { color: c, position: [HL - 0.98, 2.58, z], rotation: [0, 0.4, 0] });
  }

  // front wall below the screen, header above, pillars following the rake
  b.box([HL - 0.08, HL], [1.2, 2.62], [-W, W], WALL);
  b.box([xs(3.72) - 0.5, xs(3.72) + 0.02], [3.72, 4.02], [-W, W], WALL);
  for (const z of [0, -W + 0.04, W - 0.04]) {
    b.add(new THREE.BoxGeometry(0.05, 1.18, z === 0 ? 0.07 : 0.08), { color: TRIM, position: [xs(3.17), 3.17, z], rotation: [0, 0, slope] });
  }
  b.add(new THREE.BoxGeometry(0.28, 0.02, 1.1), { color: '#22272b', position: [xs(3.65) - 0.2, 3.66, -0.7], rotation: [0, 0, -0.15] });

  // side walls with a window opening, then the cab back wall
  for (const s of [1, -1]) {
    const z = s > 0 ? [W, W + 0.05] : [-W - 0.05, -W];
    b.box([HL - 2.6, HL - 0.05], [1.2, 2.82], z, WALL);
    b.box([HL - 2.6, HL - 0.05], [3.58, 4.02], z, WALL);
    b.box([HL - 2.6, HL - 1.5], [2.82, 3.58], z, WALL);
  }
  b.box([HL - 2.66, HL - 2.6], [1.2, 4.02], [-W, W], WALL);
  b.box([HL - 2.66, HL], [4.02, 4.08], [-W - 0.05, W + 0.05], '#8f989f');
  b.box([HL - 2.6, HL - 0.05], [1.15, 1.2], [-W, W], '#2b2b2b');
  // driver's seat
  b.box([HL - 1.75, HL - 1.25], [1.2, 1.95], [-0.85, -0.35], '#33383d');
  b.box([HL - 1.8, HL - 1.7], [1.95, 2.7], [-0.85, -0.35], '#33383d');

  // Indian Railways cab fan (110V DC wire-cage pilot fan near driver's window)
  b.cylinder({ radius: 0.018, length: 0.16, axis: 'y', position: [HL - 1.1, 3.65, -1.25], color: '#2a2d30' });
  b.cylinder({ radius: 0.14, length: 0.04, axis: 'x', position: [HL - 1.02, 3.55, -1.25], color: '#3c4045' });
  b.box([HL - 1.04, HL - 1.0], [3.44, 3.66], [-1.26, -1.24], '#50565c');

  // VCD (Vigilance Control Device) yellow push button on control desk
  b.cylinder({ radius: 0.035, length: 0.04, axis: 'y', position: [HL - 0.72, 2.65, -0.3], color: '#e6a800' });
  // Emergency stop red mushroom button
  b.cylinder({ radius: 0.04, length: 0.05, axis: 'y', position: [HL - 0.72, 2.65, -0.15], color: '#cc2222' });
  return b.build();
}

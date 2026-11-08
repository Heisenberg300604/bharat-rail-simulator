// Indian road vehicles, built from simple shapes (original models).
//
// Paint mask: every part that should take the vehicle's own body colour is
// built in pure white (#ffffff). The material's shader multiplies ONLY those
// vertices by the per-instance colour, so a single InstancedMesh per type
// draws a whole fleet of differently coloured cars, with glass, tyres and
// trim untouched. Lamps are a second mesh (key 'lamp') that glows at night.
//
// Every model faces +X, sits on y = 0, and is centred on its wheelbase.
import * as THREE from 'three';
import { ModelBuilder } from '../modelBuilder.js';

const PAINT = '#ffffff';
const GLASS = '#1b252d';
const TYRE = '#161616';
const TRIM = '#2a2d31';
const CHROME = '#b9bfc5';
const HEAD = '#fff4d2';
const TAIL = '#d81d14';

function wheels(b, xs, zs, r, w) {
  for (const x of xs) {
    for (const z of zs) {
      b.cylinder({ radius: r, length: w, axis: 'z', position: [x, r, z], color: TYRE, segments: 12 });
      b.cylinder({ radius: r * 0.55, length: w + 0.01, axis: 'z', position: [x, r, z], color: '#8d949b', segments: 8 });
    }
  }
}
function lamps(b, x, y, zs, color, r = 0.08) {
  for (const z of zs) b.cylinder({ radius: r, length: 0.04, axis: 'x', position: [x, y, z], color, mat: 'lamp', segments: 10 });
}

/** Maruti-style hatchback (the most common car on Indian roads). */
function hatchback() {
  const b = new ModelBuilder();
  b.box([-1.85, 1.85], [0.3, 0.86], [-0.82, 0.82], PAINT);
  b.prism(
    [
      [-1.75, 0.86],
      [0.55, 0.86],
      [1.0, 0.86],
      [0.35, 1.42],
      [-1.55, 1.44],
      [-1.8, 1.0],
    ],
    -0.76,
    0.76,
    PAINT,
  );
  b.box([-1.5, 0.3], [0.92, 1.36], [-0.775, 0.775], GLASS); // side windows
  b.add(new THREE.BoxGeometry(0.03, 0.5, 1.38), { color: GLASS, position: [0.72, 1.12, 0], rotation: [0, 0, 0.88] }); // windscreen
  b.box([-1.82, -1.78], [0.98, 1.34], [-0.62, 0.62], GLASS);
  b.box([1.82, 1.9], [0.28, 0.5], [-0.84, 0.84], TRIM); // bumpers
  b.box([-1.9, -1.82], [0.28, 0.5], [-0.84, 0.84], TRIM);
  wheels(b, [-1.2, 1.2], [-0.78, 0.78], 0.3, 0.18);
  lamps(b, 1.86, 0.7, [-0.6, 0.6], HEAD, 0.09);
  lamps(b, -1.86, 0.78, [-0.66, 0.66], TAIL, 0.07);
  return b.build();
}

/** Compact SUV (Bolero/Scorpio-style boxy profile). */
function suv() {
  const b = new ModelBuilder();
  b.box([-2.15, 2.15], [0.42, 1.12], [-0.9, 0.9], PAINT);
  b.box([-2.05, 0.9], [1.12, 1.82], [-0.86, 0.86], PAINT);
  b.box([-1.9, 0.75], [1.2, 1.72], [-0.875, 0.875], GLASS);
  b.add(new THREE.BoxGeometry(0.03, 0.62, 1.5), { color: GLASS, position: [1.05, 1.45, 0], rotation: [0, 0, 0.3] });
  b.box([2.1, 2.2], [0.35, 0.62], [-0.92, 0.92], TRIM);
  b.box([2.12, 2.18], [0.7, 1.0], [-0.4, 0.4], CHROME); // grille
  b.box([-2.2, -2.1], [0.35, 0.62], [-0.92, 0.92], TRIM);
  b.cylinder({ radius: 0.34, length: 0.22, axis: 'x', position: [-2.25, 1.0, 0], color: TYRE }); // spare wheel
  b.box([-1.6, 0.5], [1.84, 1.88], [-0.7, 0.7], TRIM); // roof rails
  wheels(b, [-1.4, 1.35], [-0.84, 0.84], 0.36, 0.24);
  lamps(b, 2.16, 0.86, [-0.68, 0.68], HEAD, 0.11);
  lamps(b, -2.16, 1.0, [-0.78, 0.78], TAIL, 0.08);
  return b.build();
}

/** CNG auto-rickshaw: green body, yellow canopy (Delhi colours). */
function autoRickshaw() {
  const b = new ModelBuilder();
  b.box([-1.1, 1.0], [0.32, 0.95], [-0.66, 0.66], '#1d7a35');
  b.box([0.5, 1.32], [0.38, 0.92], [-0.42, 0.42], '#1d7a35');
  b.box([-1.15, 0.62], [0.95, 1.72], [-0.67, 0.67], '#f2c21a');
  b.cylinder({ radius: 0.66, length: 0.62, axis: 'x', position: [0.82, 1.12, 0], color: '#f2c21a', segments: 14 });
  b.box([-1.18, 0.82], [1.72, 1.78], [-0.69, 0.69], '#202326');
  b.box([0.66, 0.7], [1.0, 1.52], [-0.52, 0.52], GLASS);
  b.box([-0.9, 0.5], [0.95, 1.6], [-0.672, 0.672], '#141819'); // open sides
  b.box([-0.5, 0.2], [0.55, 0.95], [-0.3, 0.3], '#1a1a1a'); // seat
  b.cylinder({ radius: 0.24, length: 0.12, axis: 'z', position: [1.0, 0.24, 0], color: TYRE });
  wheels(b, [-0.7], [-0.6, 0.6], 0.24, 0.12);
  lamps(b, 1.34, 0.76, [0], HEAD, 0.09);
  lamps(b, -1.12, 0.6, [-0.56, 0.56], TAIL, 0.05);
  return b.build();
}

/** State transport bus: body colour from the instance (red/orange/green/blue). */
function bus() {
  const b = new ModelBuilder();
  const HL = 5.2;
  const HW = 1.27;
  b.box([-HL, HL], [0.55, 1.75], [-HW, HW], PAINT);
  b.box([-HL, HL], [1.75, 2.75], [-HW, HW], '#ebe4d2');
  b.box([-HL, HL], [2.75, 3.15], [-HW, HW], '#d9d1bd');
  for (const z of [-HW - 0.005, HW + 0.005]) {
    b.box([-HL + 0.7, HL - 1.1], [1.85, 2.6], [z - 0.01, z + 0.01], GLASS);
    for (let x = -HL + 1.6; x <= HL - 1.6; x += 1.35) b.box([x - 0.06, x + 0.06], [1.85, 2.6], [z - 0.015, z + 0.015], '#ebe4d2');
  }
  b.box([HL - 0.02, HL + 0.02], [1.7, 2.62], [-HW + 0.08, HW - 0.08], GLASS);
  b.box([HL - 0.03, HL + 0.035], [2.66, 2.92], [-0.85, 0.85], '#f3c623'); // destination board
  b.box([HL, HL + 0.12], [0.42, 0.78], [-HW, HW], TRIM);
  b.box([-HL - 0.1, -HL], [0.42, 0.78], [-HW, HW], TRIM);
  b.box([HL - 2.8, HL - 1.9], [0.6, 2.6], [HW, HW + 0.02], '#3a3f45'); // door
  wheels(b, [-HL + 2.3, HL - 2.3], [-HW + 0.12, HW - 0.12], 0.5, 0.3);
  lamps(b, HL + 0.06, 0.88, [-0.9, 0.9], HEAD, 0.13);
  lamps(b, -HL - 0.06, 0.95, [-1.0, 1.0], TAIL, 0.1);
  return b.build();
}

/** Tata-style goods truck: painted cab and tall wooden body. */
function truck() {
  const b = new ModelBuilder();
  const HL = 4.2;
  b.box([-HL, HL], [0.55, 0.95], [-1.05, 1.05], TRIM);
  b.box([HL - 2.3, HL], [0.95, 2.75], [-1.15, 1.15], PAINT); // cab in the instance colour
  b.box([HL - 0.08, HL + 0.04], [0.95, 1.4], [-1.18, 1.18], '#e8aa12'); // decorated bumper
  b.box([HL - 0.35, HL + 0.02], [1.8, 2.5], [-1.0, 1.0], GLASS);
  b.box([HL - 2.0, HL - 0.6], [1.85, 2.45], [-1.155, 1.155], GLASS);
  b.box([HL - 2.32, HL - 2.28], [2.75, 3.3], [-1.15, 1.15], PAINT); // painted crown over the cab
  b.box([-HL, HL - 2.42], [0.95, 2.85], [-1.22, 1.22], '#7d5a35'); // wooden body
  for (let x = -HL + 0.4; x < HL - 2.5; x += 0.7) b.box([x - 0.03, x + 0.03], [0.95, 2.85], [-1.235, 1.235], '#5b3f22');
  b.box([-HL - 0.02, HL - 2.4], [1.8, 1.92], [-1.24, 1.24], '#f0c018');
  b.box([-HL - 0.05, -HL], [0.95, 2.85], [-1.22, 1.22], '#6a4b2b'); // tailgate ("HORN OK PLEASE")
  b.box([-HL - 0.06, -HL - 0.05], [1.4, 1.75], [-0.85, 0.85], '#f2d64a');
  wheels(b, [HL - 1.25], [-1.08, 1.08], 0.5, 0.26);
  wheels(b, [-HL + 1.7], [-1.0, 1.0], 0.5, 0.42);
  lamps(b, HL + 0.05, 1.05, [-0.85, 0.85], HEAD, 0.12);
  lamps(b, -HL - 0.07, 0.85, [-1.0, 1.0], TAIL, 0.09);
  return b.build();
}

/** Motorcycle with a rider (helmet) — paint = fuel tank & panels. */
function motorcycle() {
  const b = new ModelBuilder();
  wheels(b, [-0.68, 0.68], [0], 0.31, 0.1);
  b.box([-0.55, 0.45], [0.35, 0.6], [-0.12, 0.12], TRIM);
  b.box([0.05, 0.55], [0.62, 0.86], [-0.17, 0.17], PAINT); // tank
  b.box([-0.62, 0.05], [0.7, 0.8], [-0.14, 0.14], '#111'); // seat
  b.box([-0.75, -0.45], [0.55, 0.72], [-0.18, 0.18], PAINT); // tail panel
  b.add(new THREE.BoxGeometry(0.05, 0.6, 0.05), { color: CHROME, position: [0.62, 0.62, 0], rotation: [0, 0, -0.35] }); // fork
  b.cylinder({ radius: 0.015, length: 0.66, axis: 'z', position: [0.5, 1.0, 0], color: '#222' }); // handlebar
  // rider
  b.box([-0.42, -0.08], [0.8, 1.42], [-0.2, 0.2], '#3b4a6b'); // torso (shirt)
  b.box([-0.35, 0.25], [0.66, 0.84], [-0.24, 0.24], '#2a2f3a'); // thighs
  b.add(new THREE.BoxGeometry(0.62, 0.08, 0.08), { color: '#3b4a6b', position: [0.18, 1.18, 0.2], rotation: [0, 0, -0.5] });
  b.add(new THREE.BoxGeometry(0.62, 0.08, 0.08), { color: '#3b4a6b', position: [0.18, 1.18, -0.2], rotation: [0, 0, -0.5] });
  b.add(new THREE.SphereGeometry(0.15, 10, 8), { color: '#222', position: [-0.22, 1.58, 0] }); // helmet
  lamps(b, 0.72, 0.92, [0], HEAD, 0.08);
  lamps(b, -0.78, 0.68, [0], TAIL, 0.05);
  return b.build();
}

/** Tractor (paint) pulling a trolley — slow, very common near villages. */
function tractor() {
  const b = new ModelBuilder();
  b.box([0.4, 2.0], [0.7, 1.35], [-0.42, 0.42], PAINT); // bonnet
  b.box([-0.4, 0.45], [0.6, 1.0], [-0.55, 0.55], PAINT);
  b.box([-0.45, -0.2], [1.0, 1.55], [-0.2, 0.2], '#222'); // seat back
  b.box([1.95, 2.05], [0.75, 1.25], [-0.32, 0.32], '#cfd4d8'); // grille
  b.cylinder({ radius: 0.04, length: 0.7, position: [1.6, 1.7, 0.25], color: '#333' }); // exhaust
  b.cylinder({ radius: 0.62, length: 0.38, axis: 'z', position: [-0.1, 0.62, 0.62], color: TYRE });
  b.cylinder({ radius: 0.62, length: 0.38, axis: 'z', position: [-0.1, 0.62, -0.62], color: TYRE });
  b.cylinder({ radius: 0.36, length: 0.2, axis: 'z', position: [1.6, 0.36, 0.5], color: TYRE });
  b.cylinder({ radius: 0.36, length: 0.2, axis: 'z', position: [1.6, 0.36, -0.5], color: TYRE });
  // trolley full of sugarcane / straw
  b.box([-4.6, -1.0], [0.75, 1.35], [-1.0, 1.0], '#3f6e8c');
  b.box([-4.5, -1.1], [1.35, 2.3], [-0.95, 0.95], '#c8a24e');
  b.box([-1.0, -0.4], [0.75, 0.82], [-0.06, 0.06], TRIM);
  b.cylinder({ radius: 0.42, length: 0.25, axis: 'z', position: [-2.8, 0.42, 1.0], color: TYRE });
  b.cylinder({ radius: 0.42, length: 0.25, axis: 'z', position: [-2.8, 0.42, -1.0], color: TYRE });
  lamps(b, 2.06, 1.1, [-0.3, 0.3], HEAD, 0.08);
  lamps(b, -4.62, 0.9, [-0.85, 0.85], TAIL, 0.06);
  return b.build();
}

/**
 * Vehicle catalogue. length = bumper to bumper (m) for spacing in traffic,
 * speed = typical cruising speed (km/h), weight = share of traffic,
 * colors = body colours picked per vehicle.
 */
export const VEHICLE_TYPES = {
  car: { build: hatchback, length: 3.9, speed: [45, 70], weight: 30, colors: ['#f2f2f0', '#c9ccd0', '#8f959b', '#b3242b', '#1f4f8f', '#2c2f33', '#e9e3d3', '#7a1f2a', '#d76a1e'] },
  suv: { build: suv, length: 4.5, speed: [45, 70], weight: 12, colors: ['#f2f2f0', '#2c2f33', '#8f959b', '#53361f', '#b3242b'] },
  auto: { build: autoRickshaw, length: 2.6, speed: [30, 45], weight: 18, colors: ['#ffffff'] },
  bike: { build: motorcycle, length: 2.0, speed: [40, 65], weight: 18, colors: ['#b3242b', '#1b1b1b', '#1f4f8f', '#e8e8e8', '#5a5f66'] },
  bus: { build: bus, length: 10.6, speed: [40, 55], weight: 6, colors: ['#b8321d', '#d2691e', '#2f7d3b', '#2459a3'] },
  truck: { build: truck, length: 8.6, speed: [30, 50], weight: 8, colors: ['#e3542a', '#2a6fb3', '#d63a8a', '#e3b01c', '#2f8a4a'] },
  tractor: { build: tractor, length: 6.8, speed: [18, 28], weight: 4, colors: ['#c4221a', '#2c6a3a', '#1f5aa8'] },
};

/** Body material: per-instance colour only on painted (white) vertices. */
export function createVehicleMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 });
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <color_vertex>',
      `vColor = vec4(1.0);
      vColor.rgb *= color;
      #ifdef USE_INSTANCING_COLOR
        float isPaint = step(2.995, color.r + color.g + color.b);
        vColor.rgb = mix(vColor.rgb, instanceColor.rgb, isPaint);
      #endif`,
    );
  };
  mat.customProgramCacheKey = () => 'brs-vehicle-paint';
  return mat;
}

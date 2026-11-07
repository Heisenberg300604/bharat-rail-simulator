// Passenger coaches built to real dimensions, with detail painted into
// canvas-drawn side textures (see textures.js). A coach is only a few hundred
// triangles, so dozens of them are cheap even on integrated laptop GPUs.
//   LHB: 23.54 m, roof 4.04 m, AC units on the roof, red-grey or blue-grey
//   ICF: 21.337 m, roof 4.02 m, ribbed roof with ventilators, classic blue
// getCoachVariants() → { 'lhb-red': parts, 'lhb-blue': parts, 'icf-blue': parts }
import * as THREE from 'three';
import { ModelBuilder } from '../modelBuilder.js';
import { makeLhbSideTexture, LHB_SIDE, makeIcfSideTexture, ICF_SIDE } from '../textures.js';
import { LIVERIES, COACH_TYPES } from '../../config/gameConfig.js';

const HW = 1.62;

function roofArc(top, rise) {
  const R = (HW * HW + rise * rise) / (2 * rise);
  const yc = top + rise - R;
  const a = Math.asin(HW / R);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = -a + (2 * a * i) / 12;
    pts.push([R * Math.sin(t), yc + R * Math.cos(t)]);
  }
  pts.push([HW, top - 0.01], [-HW, top - 0.01]);
  return pts;
}

/** Shared shell: textured side panels + painted body box + roof. */
function buildShell({ length, side, bandTop, rise, roofColor, roofDetails }) {
  const HL = length / 2;
  const { bottom, top } = side;
  const sideH = top - bottom;
  const midY = (bottom + top) / 2;

  const sides = new ModelBuilder();
  sides.add(new THREE.PlaneGeometry(length, sideH), { position: [0, midY, HW] });
  sides.add(new THREE.PlaneGeometry(length, sideH), { position: [0, midY, -HW], rotation: [0, Math.PI, 0] });

  const paint = new ModelBuilder(); // end walls, upper part (body colour)
  const paint2 = new ModelBuilder(); // end walls, lower part (second colour)
  for (const end of [1, -1]) {
    const ex = end * HL;
    const xr = end > 0 ? [ex - 0.04, ex] : [ex, ex + 0.04];
    paint.box(xr, [bandTop, top], [-HW + 0.005, HW - 0.005], '#ffffff');
    paint2.box(xr, [bottom, bandTop], [-HW + 0.005, HW - 0.005], '#ffffff');
  }

  const b = new ModelBuilder();
  b.sweepX(roofArc(top, rise), -HL, HL, roofColor);
  for (const z of [1, -1]) b.box([-HL, HL], [top - 0.015, top + 0.02], z > 0 ? [HW - 0.02, HW + 0.025] : [-HW - 0.025, -HW + 0.02], '#8f959a');
  roofDetails(b, HL, top + rise);
  for (const end of [1, -1]) {
    const ex = end * HL;
    for (const z of [-1.2, 1.2]) b.box(end > 0 ? [ex, ex + 0.04] : [ex - 0.04, ex], [1.3, 2.9], [z - 0.02, z + 0.02], '#d0d0d0');
    b.cylinder({ radius: 0.07, length: 0.05, axis: 'x', position: [end * (HL + 0.03), 1.45, 1.25], color: '#9e1b1b' });
  }
  return { side: sides.build().body, paint: paint.build().body, paint2: paint2.build().body, body: b.build().body };
}

function lhbGeometry() {
  return buildShell({
    length: COACH_TYPES.lhb.length,
    side: LHB_SIDE,
    bandTop: 1.79,
    rise: 0.39,
    roofColor: '#bcc1c5',
    roofDetails(b, HL, crown) {
      for (const x of [-HL + 3.0, HL - 3.0]) {
        b.box([x - 1.3, x + 1.3], [crown - 0.08, crown + 0.26], [-0.95, 0.95], '#d0d3d6'); // AC package (RMPU)
        for (let k = -3; k <= 3; k++) b.box([x + k * 0.32 - 0.1, x + k * 0.32 + 0.1], [crown + 0.26, crown + 0.28], [-0.7, 0.7], '#8b9095');
      }
      for (const x of [-4, -1.3, 1.3, 4]) b.box([x - 0.25, x + 0.25], [crown - 0.04, crown + 0.06], [-0.25, 0.25], '#a7acb1');
    },
  });
}

function icfGeometry() {
  return buildShell({
    length: COACH_TYPES.icf.length,
    side: ICF_SIDE,
    bandTop: 2.05,
    rise: 0.4,
    roofColor: '#c4c0b6', // weathered silver
    roofDetails(b, HL, crown) {
      for (let x = -HL + 1.6; x < HL - 1.2; x += 2.15) b.cylinder({ radius: 0.16, radiusTop: 0.2, length: 0.14, position: [x, crown + 0.04, 0], color: '#8f8c84', segments: 10 }); // ventilators
    },
  });
}

let shared = null;

export function getCoachVariants() {
  if (shared) return shared;
  const geo = { lhb: lhbGeometry(), icf: icfGeometry() };
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
  const make = (type, liveryKey, texture) => {
    const liv = LIVERIES[liveryKey];
    const g = geo[type];
    return [
      { geometry: g.side, material: new THREE.MeshStandardMaterial({ map: texture, roughness: type === 'icf' ? 0.6 : 0.42, metalness: 0.12 }) },
      { geometry: g.paint, material: new THREE.MeshStandardMaterial({ color: liv.paint, roughness: 0.5, metalness: 0.12 }) },
      { geometry: g.paint2, material: new THREE.MeshStandardMaterial({ color: liv.paint2, roughness: 0.5, metalness: 0.12 }) },
      { geometry: g.body, material: bodyMat },
    ];
  };
  shared = {
    'lhb-red': make('lhb', 'lhb', makeLhbSideTexture({ primary: LIVERIES.lhb.paint, secondary: LIVERIES.lhb.paint2, label: 'AC 3 TIER' })),
    'lhb-blue': make('lhb', 'lhbBlue', makeLhbSideTexture({ primary: LIVERIES.lhbBlue.paint, secondary: LIVERIES.lhbBlue.paint2, label: 'AC CHAIR CAR' })),
    'icf-blue': make('icf', 'icfBlue', makeIcfSideTexture({ primary: LIVERIES.icfBlue.paint, band: LIVERIES.icfBlue.paint2 })),
  };
  return shared;
}

/** Which variant key a vehicle uses. */
export function coachVariantKey(type, livery) {
  if (type === 'icf' || livery === 'icfBlue') return 'icf-blue';
  return livery === 'lhbBlue' || livery === 'blue' ? 'lhb-blue' : 'lhb-red';
}

/** Backward-compatibility helper for any legacy callers */
export function getLhbCoachVariants() {
  const vars = getCoachVariants();
  return {
    red: vars['lhb-red'],
    blue: vars['lhb-blue'],
  };
}

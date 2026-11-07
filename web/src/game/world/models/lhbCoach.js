// LHB coach built to real dimensions (23.54 m × 3.24 m, roof 4.04 m above rail)
// and proportions measured from reference photos. The detail (windows, doors,
// boards, lettering) lives in a canvas-drawn side texture, so the whole coach is
// only a few hundred triangles — cheap enough for 23 coaches on a laptop GPU.
// Returns livery variants: { red: parts, blue: parts }, parts = [{ geometry, material }].
import * as THREE from 'three';
import { ModelBuilder } from '../modelBuilder.js';
import { makeLhbSideTexture, LHB_SIDE } from '../textures.js';
import { COACH_DIM, COACH_BODY_LIFT } from './trainModels.js';
import { LIVERIES } from '../../config/gameConfig.js';

const ROOF_RISE = 0.39; // eave 3.65 m → roof crown 4.04 m

function buildGeometry() {
  const { halfLength: HL, halfWidth: HW } = COACH_DIM;
  const { bottom, top } = LHB_SIDE;
  const midY = (bottom + top) / 2;
  const sideH = top - bottom;

  // Textured side panels (both sides). PlaneGeometry faces +z; the left side is
  // turned round so its lettering reads correctly from outside.
  const side = new ModelBuilder();
  side.add(new THREE.PlaneGeometry(HL * 2, sideH), { position: [0, midY, HW] });
  side.add(new THREE.PlaneGeometry(HL * 2, sideH), { position: [0, midY, -HW], rotation: [0, Math.PI, 0] });

  // Body shell behind the panels: ends painted primary (upper) / grey (lower)
  const paint = new ModelBuilder();
  paint.box([-HL, HL], [1.79, top], [-HW + 0.005, HW - 0.005], '#ffffff', { mat: 'body' });
  const paint2 = new ModelBuilder();
  paint2.box([-HL, HL], [bottom, 1.79], [-HW + 0.005, HW - 0.005], '#ffffff', { mat: 'body' });

  // Roof, AC packages, end details (fixed colours)
  const b = new ModelBuilder();
  const R = (HW * HW + ROOF_RISE * ROOF_RISE) / (2 * ROOF_RISE);
  const yc = top + ROOF_RISE - R;
  const a = Math.asin(HW / R);
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = -a + (2 * a * i) / 12;
    pts.push([R * Math.sin(t), yc + R * Math.cos(t)]);
  }
  pts.push([HW, top - 0.01], [-HW, top - 0.01]);
  b.sweepX(pts, -HL, HL, '#bcc1c5');
  b.box([-HL, HL], [top - 0.015, top + 0.02], [HW - 0.02, HW + 0.025], '#9ca2a7'); // rain gutters
  b.box([-HL, HL], [top - 0.015, top + 0.02], [-HW - 0.025, -HW + 0.02], '#9ca2a7');
  for (const x of [-HL + 3.0, HL - 3.0]) {
    // roof-mounted AC unit (RMPU) with grille
    b.box([x - 1.3, x + 1.3], [top + ROOF_RISE - 0.08, top + ROOF_RISE + 0.26], [-0.95, 0.95], '#d0d3d6');
    for (let k = -3; k <= 3; k++) b.box([x + k * 0.32 - 0.1, x + k * 0.32 + 0.1], [top + ROOF_RISE + 0.26, top + ROOF_RISE + 0.28], [-0.7, 0.7], '#8b9095');
  }
  for (const x of [-4, -1.3, 1.3, 4]) b.box([x - 0.25, x + 0.25], [top + ROOF_RISE - 0.04, top + ROOF_RISE + 0.06], [-0.25, 0.25], '#a7acb1'); // roof vents
  // end walls: tail-lamp brackets and handrails
  for (const end of [1, -1]) {
    const ex = end * HL;
    const span = (d0, d1) => (end > 0 ? [ex + d0, ex + d1] : [ex - d1, ex - d0]);
    for (const z of [-1.2, 1.2]) b.box(span(0, 0.04), [1.3, 2.9], [z - 0.02, z + 0.02], '#d0d0d0');
    b.cylinder({ radius: 0.07, length: 0.05, axis: 'x', position: [end * (HL + 0.03), 1.45, 1.25], color: '#9e1b1b' });
  }
  return {
    side: side.build().body,
    paint: paint.build().body,
    paint2: paint2.build().body,
    body: b.build().body,
  };
}

let shared = null;

/** Build (once) the coach geometry plus red-grey and blue-grey material sets. */
export function getLhbCoachVariants() {
  if (shared) return shared;
  const geo = buildGeometry();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.25 });
  const variant = (liveryKey, label) => {
    const liv = LIVERIES[liveryKey];
    const sideMat = new THREE.MeshStandardMaterial({ map: makeLhbSideTexture({ primary: liv.paint, secondary: liv.paint2, label }), roughness: 0.42, metalness: 0.12 });
    const paintMat = new THREE.MeshStandardMaterial({ color: liv.paint, roughness: 0.45, metalness: 0.12 });
    const paint2Mat = new THREE.MeshStandardMaterial({ color: liv.paint2, roughness: 0.5, metalness: 0.12 });
    return [
      { geometry: geo.side, material: sideMat },
      { geometry: geo.paint, material: paintMat },
      { geometry: geo.paint2, material: paint2Mat },
      { geometry: geo.body, material: bodyMat },
    ];
  };
  shared = { red: variant('lhb', 'AC 3 TIER'), blue: variant('lhbBlue', 'AC CHAIR CAR') };
  return shared;
}

export { COACH_BODY_LIFT };

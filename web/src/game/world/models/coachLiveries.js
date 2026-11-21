// Liveries painted onto an uncoloured GLB coach body in the shader, from the
// position on the coach (vehicle frame: x along the coach, y up from the rail
// top, z across). Crisp bands on any triangulation, no texture to load, and one
// geometry serves every livery.
//
// Measurements are taken from stock/lhb.glb as the game loads it (see
// ASSET_CREDITS). Colours and band shapes follow the owner's reference photos
// (2026-11-21) of a red-grey LHB 3AC and a Humsafar coach; they are a game
// approximation, not an official colour specification.
import * as THREE from 'three';

/** stock/lhb.glb in the vehicle frame (metres). */
export const LHB_BODY = {
  sideBottom: 1.1, // bottom edge of the body side
  sideTop: 3.25, // cant rail: the roof starts above
  windowBottom: 1.9,
  doors: [
    [-10.11, -9.02],
    [8.8, 9.89],
  ],
  ends: [-11.66, 11.44], // body end walls
};

const vec3 = (hex) => {
  const c = new THREE.Color(hex); // linear, as the shader works
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const B = LHB_BODY;
// Shared helpers: p = position, n = normal (both object space)
const COMMON = /* glsl */ `
  bool livIsEnd(vec3 n) { return abs(n.x) > 0.65; }
  bool livInDoor(float x) {
    return (x > ${B.doors[0][0].toFixed(3)} && x < ${B.doors[0][1].toFixed(3)}) || (x > ${B.doors[1][0].toFixed(3)} && x < ${B.doors[1][1].toFixed(3)});
  }
  // 0 at the outer edge of the door, 1 at the end of the body; < 0 elsewhere
  float livEndZone(float x) {
    if (x < ${B.doors[0][0].toFixed(3)}) return (${B.doors[0][0].toFixed(3)} - x) / ${(B.doors[0][0] - B.ends[0]).toFixed(3)};
    if (x > ${B.doors[1][1].toFixed(3)}) return (x - ${B.doors[1][1].toFixed(3)}) / ${(B.ends[1] - B.doors[1][1]).toFixed(3)};
    return -1.0;
  }
`;

const LIVERIES = {
  // Red-grey LHB: red from the cant rail to below the windows, light grey under it,
  // red doors, and past each door the red ends on a diagonal (door's foot → body's top corner).
  lhbRed: /* glsl */ `
    vec3 liveryColor(vec3 p, vec3 n) {
      vec3 red = ${vec3('#d9252a')};
      vec3 grey = ${vec3('#c8cdd2')};
      vec3 roof = ${vec3('#c3c7cb')};
      vec3 endWall = ${vec3('#9ba3ab')};
      vec3 under = ${vec3('#3a3d40')};
      if (p.y > ${B.sideTop.toFixed(3)}) return roof;
      if (livIsEnd(n)) return endWall;
      if (p.y < ${B.sideBottom.toFixed(3)}) return under;
      if (livInDoor(p.x)) return red;
      float redBottom = 1.58;
      if (p.y < redBottom) return grey;
      float u = livEndZone(p.x);
      if (u >= 0.0) {
        float t = (p.y - redBottom) / (${B.sideTop.toFixed(3)} - redBottom);
        return u < t ? red : grey;
      }
      return red;
    }
  `,
  // Humsafar: white roof, turquoise body with a faint ornamental pattern, and along the
  // bottom an orange strip with yellow and green hills rising towards the windows.
  humsafar: /* glsl */ `
    vec3 liveryColor(vec3 p, vec3 n) {
      vec3 teal = ${vec3('#27b2d3')};
      vec3 tealDark = ${vec3('#1b93bd')};
      vec3 roof = ${vec3('#eef0ef')};
      vec3 endWall = ${vec3('#d9dcdc')};
      vec3 under = ${vec3('#3a3d40')};
      vec3 orange = ${vec3('#ea6a25')};
      vec3 yellow = ${vec3('#f3b232')};
      vec3 green = ${vec3('#7dbb3c')};
      if (p.y > ${B.sideTop.toFixed(3)}) return roof;
      if (livIsEnd(n)) return endWall;
      if (p.y < ${B.sideBottom.toFixed(3)}) return under;
      if (p.y < 1.33) return orange;
      float yellowTop = 1.33 + 0.36 * pow(0.5 + 0.5 * sin(p.x * 0.52 + 1.3), 1.6);
      float greenTop = 1.33 + 0.27 * pow(0.5 + 0.5 * sin(p.x * 0.83 - 0.6), 2.4);
      if (p.y < greenTop) return green;
      if (p.y < yellowTop) return yellow;
      // damask-like motif, low contrast
      vec2 q = vec2(p.x, p.y) * 9.0;
      float lace = abs(sin(q.x + sin(q.y * 0.5) * 1.6) * sin(q.y + sin(q.x * 0.5) * 1.6));
      return mix(teal, tealDark, smoothstep(0.82, 0.98, lace) * 0.35);
    }
  `,
};

/** A copy of `base` whose colour is the given livery (keeps its roughness/metalness). */
export function makeLiveryMaterial(base, livery) {
  const glsl = LIVERIES[livery];
  if (!glsl) throw new Error(`unknown coach livery ${livery}`);
  const m = base.clone();
  m.color.set('#ffffff');
  m.name = `${base.name}:${livery}`;
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLivPos;\nvarying vec3 vLivNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLivPos = position;\nvLivNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLivPos;\nvarying vec3 vLivNormal;\n${COMMON}\n${glsl}`)
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= liveryColor(vLivPos, normalize(vLivNormal));');
  };
  m.customProgramCacheKey = () => `coach-livery-${livery}`;
  return m;
}

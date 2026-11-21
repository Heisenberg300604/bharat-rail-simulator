// Liveries for GLB coaches that already have colours (palette textures). The
// game repaints chosen source colours in the shader:
//   - `recolour` colours are replaced by a livery painted from the position on the
//     coach (vehicle frame: x along the coach, y up from the rail top, z across),
//     so crisp bands and patterns need no texture and no second model;
//   - `swap` colours are replaced by a plain colour.
// Every other colour of the model is kept.
//
// The models' source colours are matched exactly: a palette texel is an 8-bit sRGB
// value, decoded to the same linear value every time, so a tight tolerance keeps
// near-identical greys (e.g. interior metal next to the body band) apart.
//
// Colours and shapes follow the owner's reference photos (2026-11-21) of Humsafar,
// Utkrisht, Tejas and Duronto coaches; they are a game approximation, not an official
// colour specification.
import * as THREE from 'three';
import { liveryArt } from './liveryArt.js';

/** stock/icf-blue.glb (owner's model) in the vehicle frame (metres). */
export const ICF_BODY = {
  sideBottom: 1.0,
  bandBottom: 1.98, // the pale-blue window band of the blue livery
  sideTop: 3.42,
};

/** stock/lhb-red.glb (owner's model) in the vehicle frame (metres). */
export const LHB_BODY = {
  sideBottom: 1.06,
  redBottom: 1.8, // bottom of the red band (grey below)
  windowBottom: 2.06,
  sideTop: 3.38, // top of the red band; the grey upper band curves into the roof above
  halfLength: 11.77, // body ends at x = ±11.77 (23.54 m)
};

const vec3 = (hex) => {
  const c = new THREE.Color(hex); // linear, as the shader works
  return `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
};

const COMMON = /* glsl */ `
  bool livIsEnd(vec3 n) { return abs(n.x) > 0.65; }
  bool livNear(vec3 a, vec3 b) { return all(lessThan(abs(a - b), vec3(0.0018))); }
`;

const I = ICF_BODY;
const L = LHB_BODY;

const LIVERIES = {
  // Utkrisht ICF (2018): cream body with a maroon stripe below the windows, over the blue
  // ICF's body and band. Stripe placed at the same proportion of the side as in the photo.
  icfUtkrisht: /* glsl */ `
    vec3 liveryColor(vec3 p, vec3 n) {
      vec3 cream = ${vec3('#e6d4a6')};
      vec3 creamEnd = ${vec3('#d6c497')};
      vec3 maroon = ${vec3('#9a1c22')};
      if (livIsEnd(n)) return creamEnd;
      float h = ${(I.bandBottom - I.sideBottom).toFixed(3)};
      if (p.y < ${I.bandBottom.toFixed(3)} - 0.33 * h && p.y > ${I.bandBottom.toFixed(3)} - 0.45 * h) return maroon;
      return cream;
    }
  `,
  // Humsafar on the LHB: white above the side, turquoise body with a faint lace motif, and
  // along the bottom an orange strip with yellow and green hills rising towards the windows.
  humsafar: /* glsl */ `
    vec3 liveryColor(vec3 p, vec3 n) {
      vec3 teal = ${vec3('#27b2d3')};
      vec3 tealDark = ${vec3('#1b93bd')};
      vec3 white = ${vec3('#eef0ef')};
      vec3 endWall = ${vec3('#d9dcdc')};
      vec3 orange = ${vec3('#ea6a25')};
      vec3 yellow = ${vec3('#f3b232')};
      vec3 green = ${vec3('#7dbb3c')};
      if (p.y > ${L.sideTop.toFixed(3)}) return white;
      if (livIsEnd(n)) return endWall;
      float foot = ${(L.sideBottom + 0.25).toFixed(3)};
      if (p.y < foot) return orange;
      float rise = ${(L.windowBottom - L.sideBottom - 0.25 - 0.18).toFixed(3)};
      float yellowTop = foot + rise * pow(0.5 + 0.5 * sin(p.x * 0.52 + 1.3), 1.6);
      float greenTop = foot + 0.75 * rise * pow(0.5 + 0.5 * sin(p.x * 0.83 - 0.6), 2.4);
      if (p.y < greenTop) return green;
      if (p.y < yellowTop) return yellow;
      vec2 q = vec2(p.x, p.y) * 9.0;
      float lace = abs(sin(q.x + sin(q.y * 0.5) * 1.6) * sin(q.y + sin(q.x * 0.5) * 1.6));
      return mix(teal, tealDark, smoothstep(0.82, 0.98, lace) * 0.35);
    }
  `,
};

/** Artwork liveries (liveryArt.js): the side samples a painted canvas, 1 texture fetch. */
function artLivery({ roof, endWall }) {
  return /* glsl */ `
    uniform sampler2D uLivArt;
    vec3 liveryColor(vec3 p, vec3 n) {
      if (p.y > ${L.sideTop.toFixed(3)}) return ${vec3(roof)};
      if (livIsEnd(n)) return ${vec3(endWall)};
      float u = clamp((p.x + ${L.halfLength.toFixed(3)}) / ${(2 * L.halfLength).toFixed(3)}, 0.0, 1.0);
      if (p.z < 0.0) u = 1.0 - u; // read left to right from either side
      float v = clamp((p.y - ${L.sideBottom.toFixed(3)}) / ${(L.sideTop - L.sideBottom).toFixed(3)}, 0.0, 1.0);
      return texture2D(uLivArt, vec2(u, v)).rgb;
    }
  `;
}
// Tejas: golden-orange artwork, silver roof. Duronto: painted meadow, grey roof.
LIVERIES.tejas = artLivery({ roof: '#c9ccce', endWall: '#9a9ea2' });
LIVERIES.duronto = artLivery({ roof: '#b8bbbd', endWall: '#9a9ea2' });

/**
 * A copy of `base` with some of its colours repainted (keeps roughness/metalness).
 * @param {{ livery?: string, recolour?: string[], swap?: [string, string][] }} spec
 *   livery + recolour: these source colours take the livery painted by position;
 *   swap: [[from, to], …] plain colour replacements.
 */
export function makeLiveryMaterial(base, { livery = null, recolour = [], swap = [] } = {}) {
  const glsl = livery ? LIVERIES[livery] : '';
  if (livery && !glsl) throw new Error(`unknown coach livery ${livery}`);
  const m = base.clone();
  m.name = `${base.name}:${livery ?? 'swap'}`;
  const lines = [];
  if (livery && recolour.length) lines.push(`if (${recolour.map((hex) => `livNear(diffuseColor.rgb, ${vec3(hex)})`).join(' || ')}) diffuseColor.rgb = liveryColor(vLivPos, normalize(vLivNormal));`);
  for (const [from, to] of swap) lines.push(`${lines.length ? 'else ' : ''}if (livNear(diffuseColor.rgb, ${vec3(from)})) diffuseColor.rgb = ${vec3(to)};`);
  m.onBeforeCompile = (shader) => {
    // artwork is painted on first compile, i.e. only once a coach in this livery is drawn
    if (liveryArt(livery)) shader.uniforms.uLivArt = { value: liveryArt(livery) };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLivPos;\nvarying vec3 vLivNormal;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLivPos = position;\nvLivNormal = normal;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vLivPos;\nvarying vec3 vLivNormal;\n${COMMON}\n${glsl}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${lines.join('\n')}`);
  };
  const key = `coach-livery-${livery}-${recolour.join('')}-${swap.flat().join('')}`;
  m.customProgramCacheKey = () => key;
  return m;
}

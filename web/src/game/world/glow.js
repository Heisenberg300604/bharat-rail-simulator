// Cheap night lighting.
//
// Real lights are expensive in a forward renderer: every light adds work to
// every lit pixel. So most "lights" in this game are fakes:
//   • Glow sprites — camera-facing quads with a soft radial falloff, drawn with
//     additive blending. Hundreds of them cost one draw call per layer.
//   • Light pools — flat additive discs on the ground under street/platform
//     lamps, so the platform looks lit without lighting maths.
// Both brighten automatically with the environment's `lamps` level, get
// bigger halos in fog/rain, and fade (rather than tint) into the fog.
import * as THREE from 'three';
import { onEnvironmentChange } from './environment.js';

const quad = new THREE.PlaneGeometry(1, 1);
const groundQuad = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

const glowVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  uniform float uHalo;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    vec4 center = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    float size = length(instanceMatrix[0].xyz) * uHalo;
    vec4 mv = center;
    mv.xy += position.xy * size;
    // nudge towards the camera so the sprite isn't swallowed by the lamp housing
    mv.xyz += normalize(-center.xyz) * min(0.35, size * 0.25);
    vUv = uv;
    vColor = instanceColor;
    vDepth = -center.z;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

const glowFragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uIntensity;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(vUv - 0.5) * 2.0;
    float core = exp(-d * d * 22.0);
    float halo = exp(-d * d * 4.0) * 0.32;
    float a = (core + halo) * (1.0 - smoothstep(0.8, 1.0, d));
    // lamps punch through fog much further than unlit objects
    float fogF = smoothstep(fogNear, fogFar * 1.6, vDepth);
    gl_FragColor = vec4(vColor * a * uIntensity * (1.0 - fogF * 0.85), 1.0);
  }`;

const poolVertex = /* glsl */ `
  #include <common>
  #include <logdepthbuf_pars_vertex>
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    vUv = uv;
    vColor = instanceColor;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }`;

const poolFragment = /* glsl */ `
  #include <logdepthbuf_pars_fragment>
  uniform float uIntensity;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vDepth;
  void main() {
    #include <logdepthbuf_fragment>
    float d = length(vUv - 0.5) * 2.0;
    float a = pow(max(0.0, 1.0 - d), 1.8);
    float fogF = smoothstep(fogNear, fogFar, vDepth);
    gl_FragColor = vec4(vColor * a * uIntensity * (1.0 - fogF), 1.0);
  }`;

function baseUniforms() {
  return {
    uIntensity: { value: 0 },
    uHalo: { value: 1 },
    fogNear: { value: 300 },
    fogFar: { value: 1500 },
    fogColor: { value: new THREE.Color() }, // required by three when fog: true
    fogDensity: { value: 0 },
  };
}

/**
 * Additive glow material. Brightness = lerp(day, night, env.lamps).
 * Signal lamps use day > 0 because they are visible in daylight too.
 */
export function createGlowMaterial({ day = 0, night = 1, manual = false } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: baseUniforms(),
    vertexShader: glowVertex,
    fragmentShader: glowFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
  });
  mat.userData.unsubscribe = onEnvironmentChange((env) => {
    // manual: the owner drives uIntensity itself (e.g. a flashing tail lamp)
    if (!manual) mat.uniforms.uIntensity.value = day + (night - day) * env.lamps;
    mat.uniforms.uHalo.value = env.halo;
  });
  return mat;
}

/**
 * Soft additive light cone (headlight beam), pointing along +X from the
 * origin. Most visible at night and in fog/rain, where real beams scatter.
 */
export function createBeamMesh(length = 70, radius = 9) {
  const geo = new THREE.ConeGeometry(radius, length, 24, 1, true);
  geo.rotateZ(Math.PI / 2); // tip → −X, base → +X
  geo.translate(length / 2, 0, 0); // tip at the origin
  const mat = new THREE.ShaderMaterial({
    uniforms: { uIntensity: { value: 0 }, uLength: { value: length } },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      uniform float uLength;
      varying float vT;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        vT = position.x / uLength;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal);
        vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform float uIntensity;
      varying float vT;
      varying vec3 vN;
      varying vec3 vView;
      void main() {
        #include <logdepthbuf_fragment>
        float edge = pow(abs(dot(normalize(vN), normalize(vView))), 1.5);
        // scattering builds up over the first metres (and keeps the cab view clean)
        float a = pow(1.0 - clamp(vT, 0.0, 1.0), 2.2) * smoothstep(0.03, 0.2, vT) * edge * uIntensity;
        gl_FragColor = vec4(vec3(1.0, 0.96, 0.86) * a, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 6;
  return mesh;
}

/** Additive ground light-pool material; only visible when it is actually dark. */
export function createPoolMaterial({ strength = 1 } = {}) {
  const mat = new THREE.ShaderMaterial({
    uniforms: baseUniforms(),
    vertexShader: poolVertex,
    fragmentShader: poolFragment,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: true,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  mat.userData.unsubscribe = onEnvironmentChange((env) => {
    mat.uniforms.uIntensity.value = strength * env.lamps * Math.max(env.night, env.weatherKey === 'clear' ? 0 : env.night * 0.5 + 0.15);
  });
  return mat;
}

export function disposeGlowMaterial(mat) {
  mat.userData.unsubscribe?.();
  mat.dispose();
}

const _m = new THREE.Matrix4();
const _c = new THREE.Color();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/**
 * Static glow sprites / pools. items: [{ x, y, z, size, color }].
 * For pools, size = diameter on the ground.
 */
export function makeGlowMesh(items, material, { ground = false, maxCount } = {}) {
  const count = Math.max(1, maxCount ?? items.length);
  const mesh = new THREE.InstancedMesh(ground ? groundQuad : quad, material, count);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
  items.forEach((it, i) => setGlow(mesh, i, it.x, it.y, it.z, it.size, it.color));
  mesh.count = items.length;
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor.needsUpdate = true;
  mesh.renderOrder = 5; // after opaque geometry
  if (items.length) mesh.computeBoundingSphere();
  else mesh.frustumCulled = false;
  return mesh;
}

/** Update one sprite (dynamic layers: vehicle lamps, signals). Call needsUpdate yourself. */
export function setGlow(mesh, i, x, y, z, size, color) {
  _p.set(x, y, z);
  _s.set(size, size, size);
  mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
  if (color !== undefined) {
    if (typeof color === 'number' || typeof color === 'string') _c.set(color);
    else _c.copy(color);
    mesh.instanceColor.setXYZ(i, _c.r, _c.g, _c.b);
  }
}

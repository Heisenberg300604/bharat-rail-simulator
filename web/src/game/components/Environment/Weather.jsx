// Rain and lightning.
//
// Rain is one LineSegments draw call. Each drop is a short streak whose
// position is computed entirely in the vertex shader from time and the camera
// position: drops fall, wrap around a box that follows the camera, and lean
// with the camera's own velocity (the slant you see from a moving train). The
// CPU does no per-drop work at all.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { game, useQuality } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { envState, onEnvironmentChange } from '../../world/environment.js';
import { seededRandom } from '../../world/geometry.js';
import { audioEngine } from '../../audio/audioEngine.js';

const BOX = 70; // metres around the camera (x/z)
const HEIGHT = 32;

function makeRain(count) {
  const rand = seededRandom(5);
  const offsets = new Float32Array(count * 2 * 3);
  const ends = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = rand() * BOX;
    const y = rand() * HEIGHT;
    const z = rand() * BOX;
    for (let k = 0; k < 2; k++) {
      offsets.set([x, y, z], (i * 2 + k) * 3);
      ends[i * 2 + k] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(offsets, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCam: { value: new THREE.Vector3() },
      uVel: { value: new THREE.Vector3() },
      uAmount: { value: 0 },
      uInner: { value: 0 },
      uColor: { value: new THREE.Color('#c9d4e0') },
    },
    vertexShader: /* glsl */ `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute float aEnd;
      uniform float uTime;
      uniform vec3 uCam;
      uniform vec3 uVel;
      uniform float uInner;
      varying float vAlpha;
      const float BOX = ${BOX.toFixed(1)};
      const float H = ${HEIGHT.toFixed(1)};
      const float FALL = 9.0; // m/s terminal velocity of a raindrop
      void main() {
        float seed = fract(position.x * 12.9898 + position.z * 78.233);
        vec3 p;
        p.x = uCam.x + mod(position.x - uCam.x, BOX) - BOX * 0.5;
        p.z = uCam.z + mod(position.z - uCam.z, BOX) - BOX * 0.5;
        p.y = uCam.y - H * 0.35 + mod(position.y - uTime * FALL * (0.85 + 0.3 * seed), H);
        // streak = motion during a ~35 ms "exposure", relative to the camera
        vec3 rel = vec3(-uVel.x, -FALL, -uVel.z);
        p += rel * 0.035 * aEnd;
        float d = distance(p, uCam);
        // no rain inside the cab/coach, fade far drops
        vAlpha = smoothstep(uInner, uInner + 1.5, d) * (1.0 - smoothstep(BOX * 0.3, BOX * 0.5, d)) * (0.55 + 0.45 * seed);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <logdepthbuf_pars_fragment>
      uniform float uAmount;
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        #include <logdepthbuf_fragment>
        gl_FragColor = vec4(uColor, vAlpha * uAmount * 0.42);
      }`,
    transparent: true,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  lines.renderOrder = 7;
  return lines;
}

export default function Weather() {
  const quality = useQuality();
  const count = quality.sceneryDensity >= 1 ? 9000 : quality.sceneryDensity >= 0.7 ? 6000 : 3200;
  const rain = useMemo(() => makeRain(count), [count]);
  const camera = useThree((s) => s.camera);
  const st = useRef({ last: new THREE.Vector3(), vel: new THREE.Vector3(), nextStrike: 8, strike: -1, flashes: 0 });

  useEffect(
    () => () => {
      rain.geometry.dispose();
      rain.material.dispose();
    },
    [rain],
  );
  useEffect(
    () =>
      onEnvironmentChange((env) => {
        rain.material.uniforms.uColor.value.set(env.night > 0.5 ? '#7d8796' : '#c9d4e0');
      }),
    [rain],
  );

  useFrame((state, delta) => {
    const s = st.current;
    const amount = envState.rain;
    rain.visible = amount > 0.01 && (sceneRefs.tunnelDark ?? 0) < 0.5; // no rain inside a tunnel
    if (!rain.visible) {
      envState.lightning = 0;
      return;
    }
    const dt = Math.min(delta, 0.1);
    const u = rain.material.uniforms;
    u.uTime.value = state.clock.elapsedTime;
    u.uCam.value.copy(camera.position);
    // camera velocity, smoothed (cab: the train's speed)
    if (dt > 0) {
      const v = s.last.sub(camera.position).multiplyScalar(-1 / dt);
      if (v.lengthSq() < 80 * 80) s.vel.lerp(v, 0.2);
    }
    s.last.copy(camera.position);
    u.uVel.value.copy(s.vel);
    u.uAmount.value = amount;
    const mode = game.cameraMode;
    u.uInner.value = mode === 'cab' || mode === 'interior' ? 4.2 : 0.5;

    // Lightning: a bright double flash, then thunder a few seconds later
    if (game.screen !== 'playing') return;
    s.nextStrike -= dt;
    if (s.nextStrike <= 0) {
      s.nextStrike = 12 + Math.random() * 22;
      s.strike = 0;
      s.flashes = 1 + (Math.random() < 0.6 ? 1 : 0);
      const distanceKm = 0.8 + Math.random() * 3.5;
      audioEngine.playThunder?.(distanceKm * 2.9, Math.min(1, 1.6 / distanceKm));
    }
    if (s.strike >= 0) {
      s.strike += dt;
      const k = s.strike;
      let f = Math.exp(-k * 14);
      if (s.flashes > 1) f = Math.max(f, k > 0.18 ? Math.exp(-(k - 0.18) * 10) * 0.8 : 0);
      envState.lightning = f;
      if (k > 1.2) {
        s.strike = -1;
        envState.lightning = 0;
      }
    }
  });

  return <primitive object={rain} />;
}

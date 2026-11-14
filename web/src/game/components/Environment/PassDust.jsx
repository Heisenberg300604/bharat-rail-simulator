// D4: dust lifted from the ballast by an opposing train going by at speed.
// Dry weather only (no dust in rain), not on bridges or in tunnels. One
// pooled Points object with a tiny shader (per-particle size and fade; it
// includes the logarithmic-depth chunks because the renderer uses a log depth buffer):
// ONE draw call, nothing drawn when no particle is alive.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { game, route } from '../../state/gameStore.js';
import { envState } from '../../world/environment.js';
import { terrain } from '../../world/terrain.js';
import { tunnelAt, bridgeAt } from '../../routes/activeRoute.js';

const MAX = 1200;
const DOWN = -5.3; // the down line's offset
const MIN_SPEED = 15; // m/s (54 km/h): slower trains don't raise visible dust (game assumption)

export default function PassDust() {
  const points = useRef();
  const sim = useMemo(
    () => ({
      pos: new Float32Array(MAX * 3),
      vel: new Float32Array(MAX * 3),
      age: new Float32Array(MAX).fill(1e9),
      life: new Float32Array(MAX).fill(1),
      next: 0,
      carry: 0,
    }),
    [],
  );
  const res = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(sim.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aFade', new THREE.BufferAttribute(new Float32Array(MAX), 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: true,
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), uColor: { value: new THREE.Color("#cdbfa6") }, uScale: { value: 300 } },
      vertexShader: /* glsl */ `
        attribute float aFade;
        varying float vFade;
        uniform float uScale;
        #include <common>
        #include <logdepthbuf_pars_vertex>
        #include <fog_pars_vertex>
        void main() {
          vFade = aFade;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          float grow = 1.0 + (1.0 - aFade) * 2.5;
          gl_PointSize = aFade > 0.0 ? uScale * 1.8 * grow / -mvPosition.z : 0.0;
          gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        varying float vFade;
        #include <logdepthbuf_pars_fragment>
        #include <fog_pars_fragment>
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = dot(c, c) * 4.0;
          if (r > 1.0) discard;
          #include <logdepthbuf_fragment>
          gl_FragColor = vec4(uColor, (1.0 - r) * vFade * 0.16);
          #include <colorspace_fragment>
          #include <fog_fragment>
        }`,
    });
    return { geo, mat };
  }, [sim]);
  useEffect(
    () => () => {
      res.geo.dispose();
      res.mat.dispose();
    },
    [res],
  );

  const p = useMemo(() => ({}), []);
  const q = useMemo(() => ({}), []);
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.1);
    if (dt <= 0) return;
    res.mat.uniforms.uScale.value = state.size.height * state.gl.getPixelRatio() * 0.5;
    const dry = (envState.rain ?? 0) < 0.2;
    // spawn along the part of each fast opposing train near our train (what the cameras see)
    const front = game.renderDistance;
    if (dry) {
      for (const tr of game.aiTrains ?? []) {
        if (tr.state !== 'running' || tr.speed < MIN_SPEED) continue;
        const a = Math.max(tr.front, front - 260);
        const b = Math.min(tr.front + tr.length, front + 80);
        if (b <= a) continue;
        sim.carry += (b - a) * 0.6 * (tr.speed / 25) * dt; // particles per second along the passing rake
        while (sim.carry >= 1) {
          sim.carry -= 1;
          const s = a + Math.random() * (b - a);
          if (tunnelAt(s, 5) || bridgeAt(s, 5)) continue;
          const side = Math.random() < 0.5 ? -1 : 1;
          const lat = DOWN + side * (1.6 + Math.random() * 0.8);
          route.sample(s, p);
          route.sample(s - 1, q); // the train runs towards lower s
          const i = sim.next;
          sim.next = (sim.next + 1) % MAX;
          sim.pos[i * 3] = p.x + p.lx * lat;
          sim.pos[i * 3 + 1] = terrain.groundY(s, lat) + 0.25 + Math.random() * 0.4;
          sim.pos[i * 3 + 2] = p.z + p.lz * lat;
          // slipstream drags the dust along with the train, and out to the side
          const drag = tr.speed * (0.12 + Math.random() * 0.1);
          const out = side * (0.8 + Math.random() * 1.6);
          sim.vel[i * 3] = (q.x - p.x) * drag + p.lx * out;
          sim.vel[i * 3 + 1] = 0.7 + Math.random() * 1.2;
          sim.vel[i * 3 + 2] = (q.z - p.z) * drag + p.lz * out;
          sim.age[i] = 0;
          sim.life[i] = 2.2 + Math.random() * 2;
        }
      }
    }
    const fade = res.geo.attributes.aFade.array;
    let alive = 0;
    const damp = Math.exp(-dt * 1.4);
    for (let i = 0; i < MAX; i++) {
      if (sim.age[i] >= sim.life[i]) {
        fade[i] = 0;
        continue;
      }
      alive++;
      sim.age[i] += dt;
      const k = i * 3;
      sim.vel[k] *= damp;
      sim.vel[k + 1] *= damp;
      sim.vel[k + 2] *= damp;
      sim.pos[k] += sim.vel[k] * dt;
      sim.pos[k + 1] += sim.vel[k + 1] * dt;
      sim.pos[k + 2] += sim.vel[k + 2] * dt;
      const t = sim.age[i] / sim.life[i];
      fade[i] = Math.max(0, Math.min(1, t * 6) * (1 - t));
    }
    points.current.visible = alive > 0;
    if (alive) {
      res.geo.attributes.position.needsUpdate = true;
      res.geo.attributes.aFade.needsUpdate = true;
    }
  });
  return <points ref={points} geometry={res.geo} material={res.mat} frustumCulled={false} visible={false} renderOrder={5} />;
}

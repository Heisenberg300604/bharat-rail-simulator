// Sky, fog, ground, lights and reflections.
// - Fog hides the edge of the world and makes distant objects cheap.
// - The sky is a gradient sphere that follows the camera; its horizon colour
//   equals the fog colour, so they blend into the hazy North-Indian sky.
// - One directional "sun" casts shadows only in a box near the camera (the
//   light follows the view), so the shadow map stays sharp and cheap.
// - A one-time "environment map" rendered from the sky gives glass and
//   paint believable reflections (skipped on the Low preset).
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { route } from '../../state/gameStore.js';
import { makeNoiseTexture } from '../../world/textures.js';
import { seededRandom } from '../../world/geometry.js';

export const HORIZON_COLOR = '#d9dccf';
const ZENITH_COLOR = '#6a9bd0';
const SUN_DIR = new THREE.Vector3(0.55, 0.78, 0.3).normalize();

function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      horizon: { value: new THREE.Color(HORIZON_COLOR) },
      zenith: { value: new THREE.Color(ZENITH_COLOR) },
      sunDir: { value: SUN_DIR.clone() },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 horizon;
      uniform vec3 zenith;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.5));
        float sun = max(dot(d, sunDir), 0.0);
        col += vec3(1.0, 0.92, 0.75) * (pow(sun, 600.0) * 4.0 + pow(sun, 12.0) * 0.18); // sun disc + glow
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

export function Sky({ radius }) {
  const ref = useRef();
  const camera = useThree((s) => s.camera);
  const material = useMemo(makeSkyMaterial, []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame(() => ref.current.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
}

/** Reflections: render the sky once into a PMREM environment map. */
export function EnvironmentLighting({ enabled }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (!enabled) {
      scene.environment = null;
      return undefined;
    }
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), makeSkyMaterial());
    const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 16), new THREE.MeshBasicMaterial({ color: '#7d7a5a' }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    envScene.add(sky, ground);
    const rt = pmrem.fromScene(envScene, 0.02);
    scene.environment = rt.texture;
    scene.environmentIntensity = 0.55;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      sky.geometry.dispose();
      sky.material.dispose();
      ground.geometry.dispose();
      ground.material.dispose();
    };
  }, [enabled, gl, scene]);
  return null;
}

/** Ground: one big plane, with gentle large-scale colour variation baked into vertex colours. */
export function Ground() {
  const { geometry, tex } = useMemo(() => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const p = {};
    for (let s = 0; s <= route.length; s += 50) {
      route.sample(s, p);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z);
      maxZ = Math.max(maxZ, p.z);
    }
    const size = Math.max(maxX - minX, maxZ - minZ) + 6000;
    const seg = 96;
    const geometry = new THREE.PlaneGeometry(size, size, seg, seg);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate((minX + maxX) / 2, -0.05, (minZ + maxZ) / 2);
    // Low-frequency value noise → patches of greener grass and dusty earth
    const rand = seededRandom(77);
    const grid = Array.from({ length: (seg / 6 + 2) ** 2 }, () => rand());
    const gw = seg / 6 + 2;
    const noise = (u, v) => {
      const x = u * (seg / 6);
      const y = v * (seg / 6);
      const x0 = Math.floor(x);
      const y0 = Math.floor(y);
      const fx = x - x0;
      const fy = y - y0;
      const at = (i, j) => grid[(j % gw) * gw + (i % gw)];
      const a = at(x0, y0) * (1 - fx) + at(x0 + 1, y0) * fx;
      const b = at(x0, y0 + 1) * (1 - fx) + at(x0 + 1, y0 + 1) * fx;
      return a * (1 - fy) + b * fy;
    };
    const green = new THREE.Color('#9aa865');
    const dust = new THREE.Color('#c2b48a');
    const c = new THREE.Color();
    const colors = new Float32Array(geometry.attributes.position.count * 3);
    for (let j = 0; j <= seg; j++) {
      for (let i = 0; i <= seg; i++) {
        const k = j * (seg + 1) + i;
        c.copy(green).lerp(dust, noise(i / seg, j / seg) * 0.85);
        colors.set([c.r, c.g, c.b], k * 3);
      }
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const tex = makeNoiseTexture({
      base: '#d9d9d0',
      speckles: ['#bfc4a6', '#e8e2c9', '#a9b38a', '#cfc7a3', '#9aa37c'],
      density: 2.5,
      seed: 11,
    });
    tex.repeat.set(size / 24, size / 24);
    return { geometry, tex };
  }, []);
  useEffect(
    () => () => {
      geometry.dispose();
      tex.dispose();
    },
    [geometry, tex],
  );
  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial map={tex} vertexColors roughness={1} />
    </mesh>
  );
}

export function Lighting({ shadows, shadowMapSize }) {
  const sun = useRef();
  const camera = useThree((s) => s.camera);
  const target = useMemo(() => new THREE.Object3D(), []);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  useLayoutEffect(() => {
    sun.current.target = target;
  }, [target]);
  useEffect(() => {
    // Changing the shadow-map size needs the old map to be thrown away
    const s = sun.current.shadow;
    s.mapSize.set(shadowMapSize, shadowMapSize);
    s.map?.dispose();
    s.map = null;
  }, [shadowMapSize]);

  useFrame(() => {
    // Centre the shadow box ~50 m in front of the camera, on the ground, and
    // snap it to whole shadow-map texels so shadows don't shimmer when moving.
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const texel = 180 / shadowMapSize;
    const x = Math.round((camera.position.x + fwd.x * 50) / texel) * texel;
    const z = Math.round((camera.position.z + fwd.z * 50) / texel) * texel;
    target.position.set(x, 0, z);
    sun.current.position.set(x + SUN_DIR.x * 200, SUN_DIR.y * 200, z + SUN_DIR.z * 200);
    target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={['#e3ebf2', '#7a7250', 0.75]} />
      <directionalLight
        ref={sun}
        intensity={2.8}
        color="#fff0d4"
        castShadow={shadows}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-near={50}
        shadow-camera-far={420}
        shadow-bias={-0.0003}
        shadow-normalBias={0.05}
      />
      <primitive object={target} />
    </>
  );
}

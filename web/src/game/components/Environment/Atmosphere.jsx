// Sky, fog, ground and lights.
// - Fog hides the end of the world and makes distant objects cheap to fake.
// - The sky is a big gradient sphere that follows the camera; its horizon
//   colour equals the fog colour so the two blend seamlessly (hazy Indian sky).
// - One directional "sun" light casts shadows, but only in a box around the
//   train (the light follows the locomotive) so shadow maps stay sharp & cheap.
import { useMemo, useRef, useLayoutEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { route } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { makeNoiseTexture } from '../../world/textures.js';

export const HORIZON_COLOR = '#d6d9cf';
const ZENITH_COLOR = '#6f9ccc';
const SUN_OFFSET = new THREE.Vector3(70, 110, 45);

export function Sky({ radius }) {
  const ref = useRef();
  const camera = useThree((s) => s.camera);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          horizon: { value: new THREE.Color(HORIZON_COLOR) },
          zenith: { value: new THREE.Color(ZENITH_COLOR) },
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
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            gl_FragColor = vec4(mix(horizon, zenith, pow(h, 0.55)), 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  );
  useFrame(() => ref.current.position.copy(camera.position));
  return (
    <mesh ref={ref} material={material} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[radius, 24, 12]} />
    </mesh>
  );
}

export function Ground() {
  const { size, cx, cz, tex } = useMemo(() => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    const p = {};
    for (let s = 0; s <= route.length; s += 50) {
      route.sample(s, p);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
    const size = Math.max(maxX - minX, maxZ - minZ) + 6000;
    const tex = makeNoiseTexture({
      base: '#8d8f5a',
      speckles: ['#7c8150', '#9ea067', '#a39a6a', '#6f7848', '#b0a676'],
      density: 2.5,
      seed: 11,
    });
    tex.repeat.set(size / 30, size / 30);
    return { size, cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, tex };
  }, []);
  return (
    <mesh position={[cx, -0.05, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial map={tex} roughness={1} />
    </mesh>
  );
}

export function Lighting({ shadows }) {
  const sun = useRef();
  const target = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    sun.current.target = target;
  }, [target]);

  useFrame(() => {
    const loco = sceneRefs.locomotive;
    if (!loco) return;
    // Keep the shadow box centred on the middle of the train.
    target.position.set(-40, 0, 0);
    loco.localToWorld(target.position);
    target.position.y = 0;
    sun.current.position.copy(target.position).add(SUN_OFFSET);
    target.updateMatrixWorld();
  });

  return (
    <>
      <hemisphereLight args={['#dfe8f0', '#7d7350', 1.1]} />
      <directionalLight
        ref={sun}
        intensity={2.6}
        color="#fff1d6"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-75}
        shadow-camera-right={75}
        shadow-camera-top={75}
        shadow-camera-bottom={-75}
        shadow-camera-near={10}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
      <primitive object={target} />
    </>
  );
}

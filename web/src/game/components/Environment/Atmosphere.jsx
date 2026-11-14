// Sky, fog, ground, lights and reflections — all driven by the time of day and
// weather (see world/environment.js).
// - EnvironmentController blends the live environment towards the chosen
//   preset and pushes it into fog, exposure, sky and lights.
// - The sky is a gradient sphere that follows the camera; its horizon colour
//   equals the fog colour, so they blend seamlessly. It also draws the sun or
//   moon disc, a warm horizon band at dawn/dusk and procedural stars at night.
// - One directional "sun" (the moon at night) casts shadows only in a box near
//   the camera, so the shadow map stays sharp and cheap.
// - An environment map rendered from the current sky gives glass and paint
//   believable reflections (skipped on Low). It is re-rendered only when the
//   preset changes.
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameValue, useQuality } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { computeEnvironment, envState, blendEnvironment, snapEnvironment, notifyEnvironment, onEnvironmentChange } from '../../world/environment.js';
import { damp } from '../Cameras/cameraConstants.js';

export const HORIZON_COLOR = '#d9dccf';

function makeSkyMaterial() {
  return new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      horizon: { value: new THREE.Color(HORIZON_COLOR) },
      zenith: { value: new THREE.Color('#6a9bd0') },
      sunDir: { value: new THREE.Vector3(0.55, 0.78, 0.3).normalize() },
      sunColor: { value: new THREE.Color('#fff1d6') },
      sunVisible: { value: 1 },
      night: { value: 0 },
      stars: { value: 0 },
      time: { value: 0 },
      flash: { value: 0 },
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
      uniform vec3 sunColor;
      uniform float sunVisible;
      uniform float night;
      uniform float stars;
      uniform float time;
      uniform float flash;
      varying vec3 vDir;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }

      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(horizon, zenith, pow(h, 0.5));
        float sun = max(dot(d, sunDir), 0.0);
        // warm band along the horizon on the sun's side at dawn/dusk
        float lowSun = 1.0 - smoothstep(0.05, 0.45, sunDir.y);
        float band = exp(-h * 9.0) * pow(max(dot(normalize(vec3(d.x, 0.0, d.z)), normalize(vec3(sunDir.x, 0.0, sunDir.z))), 0.0), 2.0);
        col += sunColor * band * lowSun * 0.45 * (1.0 - night) * sunVisible;
        // sun disc + glow (by day) or a crisp moon (by night)
        float disc = night > 0.5 ? smoothstep(0.99975, 0.99985, sun) * 1.4 : pow(sun, 700.0) * 4.0;
        col += sunColor * (disc + pow(sun, 10.0) * 0.16 * (1.0 - night * 0.7)) * sunVisible;
        // stars: hashed directions on a fine grid, gently twinkling
        if (stars > 0.0 && d.y > 0.0) {
          vec3 g = d * 420.0;
          vec3 cell = floor(g);
          float r = hash(cell);
          // a small round point inside the cell, not the whole (square) cell
          vec3 off = vec3(hash(cell + 3.1), hash(cell + 7.7), hash(cell + 1.3)) * 0.5 + 0.25;
          float pt = 1.0 - smoothstep(0.06, 0.2, length(fract(g) - off));
          float star = step(0.993, r) * pt * smoothstep(0.0, 0.25, d.y);
          float tw = 0.65 + 0.35 * sin(time * (1.5 + r * 4.0) + r * 40.0);
          col += vec3(0.85, 0.9, 1.0) * star * tw * stars * (0.6 + 1.6 * fract(r * 91.7));
        }
        col += vec3(0.75, 0.8, 1.0) * flash; // lightning
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}

/** Shared sky material, so the controller can update it without a ref chain. */
const skyMaterial = makeSkyMaterial();

export function Sky({ radius }) {
  const ref = useRef();
  const camera = useThree((s) => s.camera);
  useFrame((state) => {
    ref.current.position.copy(camera.position);
    if (envState.stars > 0) skyMaterial.uniforms.time.value = state.clock.elapsedTime;
  });
  return (
    <mesh ref={ref} material={skyMaterial} renderOrder={-1} frustumCulled={false}>
      <sphereGeometry args={[radius, 32, 16]} />
    </mesh>
  );
}

/**
 * Blends envState towards the chosen time/weather and applies it to the
 * renderer, fog and sky. Notifies subscribers only while something changes.
 */
export function EnvironmentController() {
  const timeKey = useGameValue((s) => s.settings.timeOfDay);
  const weatherKey = useGameValue((s) => s.settings.weather);
  const resetVersion = useGameValue((s) => s.resetVersion);
  const quality = useQuality();
  const { gl, scene } = useThree();
  const target = useMemo(() => computeEnvironment(timeKey, weatherKey, quality.fogFar), [timeKey, weatherKey, quality.fogFar]);
  const st = useRef({ first: true, moving: true, flash: false });

  // A new journey (or the very first frame) starts in the right conditions instantly.
  useEffect(() => {
    st.current.first = true;
  }, [resetVersion]);
  useEffect(() => {
    st.current.moving = true;
  }, [target]);

  useFrame((_, delta) => {
    const s = st.current;
    if (s.first) {
      snapEnvironment(target);
      s.first = false;
      s.moving = true;
    } else if (s.moving || envState.lightning > 0 || s.flash) {
      s.moving = blendEnvironment(target, damp(1.6, Math.min(delta, 0.1)));
    } else return;
    s.flash = envState.lightning > 0; // one more update after a flash ends

    const e = envState;
    if (scene.fog) {
      scene.fog.color.copy(e.fogColor);
      scene.fog.near = e.fogNear;
      scene.fog.far = e.fogFar;
    }
    if (scene.background?.isColor) scene.background.copy(e.fogColor);
    gl.toneMappingExposure = e.exposure;
    scene.environmentIntensity = e.envIntensity;
    const u = skyMaterial.uniforms;
    u.horizon.value.copy(e.horizon);
    u.zenith.value.copy(e.zenith);
    u.sunDir.value.copy(e.sunDir);
    u.sunColor.value.copy(e.sunGlow);
    u.sunVisible.value = e.sunVisible;
    u.night.value = e.night;
    u.stars.value = e.stars;
    u.flash.value = e.lightning * 0.35;
    notifyEnvironment();
  }, -4);

  return null;
}

/** Reflections: render the current preset's sky into a PMREM environment map. */
export function EnvironmentLighting({ enabled }) {
  const { gl, scene } = useThree();
  const timeKey = useGameValue((s) => s.settings.timeOfDay);
  const weatherKey = useGameValue((s) => s.settings.weather);
  useEffect(() => {
    if (!enabled) {
      scene.environment = null;
      return undefined;
    }
    const env = computeEnvironment(timeKey, weatherKey);
    const pmrem = new THREE.PMREMGenerator(gl);
    const envScene = new THREE.Scene();
    const mat = makeSkyMaterial();
    mat.uniforms.horizon.value.copy(env.horizon);
    mat.uniforms.zenith.value.copy(env.zenith);
    mat.uniforms.sunDir.value.copy(env.sunDir);
    mat.uniforms.sunColor.value.copy(env.sunGlow);
    mat.uniforms.sunVisible.value = env.sunVisible;
    mat.uniforms.night.value = env.night;
    const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), mat);
    const groundMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#7d7a5a').multiplyScalar(0.25 + 0.75 * (1 - env.night)) });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(100, 16), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5;
    envScene.add(sky, ground);
    const rt = pmrem.fromScene(envScene, 0.02);
    scene.environment = rt.texture;
    scene.environmentIntensity = envState.envIntensity;
    return () => {
      scene.environment = null;
      rt.dispose();
      pmrem.dispose();
      sky.geometry.dispose();
      mat.dispose();
      ground.geometry.dispose();
      groundMat.dispose();
    };
  }, [enabled, gl, scene, timeKey, weatherKey]);
  return null;
}

export function Lighting({ shadows, shadowMapSize }) {
  const sun = useRef();
  const hemi = useRef();
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
  useEffect(
    () =>
      onEnvironmentChange((env) => {
        if (!sun.current) return;
        const t = 1 - (sceneRefs.tunnelDark ?? 0);
        sun.current.color.copy(env.sunColor);
        sun.current.intensity = (env.sunIntensity + env.lightning * 3) * (1 - 0.92 * (1 - t));
        hemi.current.color.copy(env.hemiSky);
        hemi.current.groundColor.copy(env.hemiGround);
        hemi.current.intensity = (env.hemiIntensity + env.lightning * 2.5) * (1 - 0.85 * (1 - t));
      }),
    [],
  );

  const dark = useRef(0);
  const scene = useThree((s) => s.scene);
  useFrame(() => {
    // Centre the shadow box ~50 m in front of the camera, near the ground
    // under it (routes climb hundreds of metres), and snap it to whole
    // shadow-map texels so shadows don't shimmer when moving.
    camera.getWorldDirection(fwd);
    fwd.y = 0;
    fwd.normalize();
    const texel = 180 / shadowMapSize;
    const x = Math.round((camera.position.x + fwd.x * 50) / texel) * texel;
    const z = Math.round((camera.position.z + fwd.z * 50) / texel) * texel;
    const y = Math.round((camera.position.y - 4) / 2) * 2;
    const d = envState.sunDir;
    target.position.set(x, y, z);
    sun.current.position.set(x + d.x * 200, y + Math.max(d.y, 0.08) * 200, z + d.z * 200);
    target.updateMatrixWorld();
    // inside a tunnel (on-train views) daylight is shut out: only the headlight and lamps remain
    const t = sceneRefs.tunnelDark ?? 0;
    if (t > 0.002 || Math.abs(t - dark.current) > 0.002) {
      dark.current = t;
      sun.current.intensity = (envState.sunIntensity + envState.lightning * 3) * (1 - 0.92 * t);
      hemi.current.intensity = (envState.hemiIntensity + envState.lightning * 2.5) * (1 - 0.85 * t);
      scene.environmentIntensity = envState.envIntensity * (1 - 0.9 * t);
    }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={['#e3ebf2', '#7a7250', 0.75]} />
      <directionalLight
        ref={sun}
        intensity={2.8}
        color="#fff0d4"
        castShadow={shadows}
        shadow-camera-left={-90}
        shadow-camera-right={90}
        shadow-camera-top={90}
        shadow-camera-bottom={-90}
        shadow-camera-near={30}
        shadow-camera-far={440}
        shadow-bias={0.00003}
        shadow-normalBias={0.05}
      />
      <primitive object={target} />
    </>
  );
}

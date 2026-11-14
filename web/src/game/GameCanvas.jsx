// The 3D view. Everything inside <Canvas> is Three.js, written as React
// components via React Three Fiber.
import { memo, useEffect, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { STATIONS } from './config/gameConfig.js';
import { game, useGameValue, useQuality } from './state/gameStore.js';
import { sceneRefs } from './state/sceneRefs.js';
import SimulationDriver from './SimulationDriver.jsx';
import TrackRoute from './components/Track/TrackRoute.jsx';
import Train from './components/Train/Train.jsx';
import Station from './components/Stations/Station.jsx';
import Scenery from './components/Environment/Scenery.jsx';
import Road from './components/Environment/Road.jsx';
import Terrain from './components/Environment/Terrain.jsx';
import Structures from './components/Environment/Structures.jsx';
import Landmarks from './components/Environment/Landmarks.jsx';
import { Sky, Lighting, EnvironmentLighting, EnvironmentController, HORIZON_COLOR } from './components/Environment/Atmosphere.jsx';
import Weather from './components/Environment/Weather.jsx';
import Crowds from './components/People/Crowds.jsx';
import CameraRig from './components/Cameras/CameraRig.jsx';

/**
 * Everything built from the route. Keyed by route id: switching routes
 * unmounts the old world (each builder disposes its GPU buffers) and builds
 * the new one, so there is no partial hot-swap to get wrong.
 */
function RouteWorld() {
  return (
    <>
      <SimulationDriver />
      <Terrain />
      <TrackRoute />
      <Structures />
      <Scenery />
      <Landmarks />
      <Road />
      {STATIONS.map((st) => (
        <Station key={st.id} station={st} />
      ))}
      <Crowds />
    </>
  );
}

/**
 * Memoised: the App re-renders ~10×/s for the HUD, but the 3D tree only needs
 * to re-render when its own subscribed values (screen, route, quality) change.
 */
export default memo(function GameCanvas() {
  const screen = useGameValue((s) => s.screen);
  const routeId = useGameValue((s) => s.routeId);
  const quality = useQuality();
  // While a menu covers the game we only render on demand, which saves battery.
  const frameloop = screen === 'paused' || screen === 'confirmRestart' ? 'demand' : 'always';
  const maxDpr = Math.min(quality.maxDpr, window.devicePixelRatio || 1);

  return (
    <Canvas
      // Antialiasing can only be chosen when the WebGL context is created, so
      // switching it (Low ↔ Medium/High) recreates the canvas.
      key={quality.antialias ? 'aa' : 'no-aa'}
      className="game-canvas"
      frameloop={frameloop}
      dpr={maxDpr}
      shadows="percentage"
      gl={{ antialias: quality.antialias, powerPreference: 'high-performance', stencil: false, logarithmicDepthBuffer: true }}
      camera={{ fov: 60, near: 0.25, far: quality.cameraFar, position: [0, 20, 40] }}
      onCreated={({ gl, scene }) => {
        sceneRefs.gl = gl;
        sceneRefs.scene = scene;
      }}
    >
      <CameraFar far={quality.cameraFar} />
      <AdaptiveResolution min={Math.min(quality.minDpr, maxDpr)} max={maxDpr} />
      <color attach="background" args={[HORIZON_COLOR]} />
      <fog attach="fog" args={[HORIZON_COLOR, 300, quality.fogFar]} />
      <SimulationDriver />
      <EnvironmentController />
      <EnvironmentLighting enabled={quality.environment} />
      <Lighting shadows={quality.shadows} shadowMapSize={quality.shadowMapSize} />
      <Sky radius={quality.cameraFar * 0.9} />
      <RouteWorld key={routeId} />
      <Train />
      <Weather />
      <CameraRig />
    </Canvas>
  );
});

/** Applies the quality preset's view distance when it changes at runtime. */
function CameraFar({ far }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.far = far;
    camera.updateProjectionMatrix();
  }, [camera, far]);
  return null;
}

/**
 * Dynamic resolution: if the frame rate drops below ~50 FPS we render fewer
 * pixels (lower device-pixel-ratio), and raise it again when there is
 * headroom. Pixel count is the #1 cost on integrated laptop GPUs.
 */
function AdaptiveResolution({ min, max }) {
  const setDpr = useThree((s) => s.setDpr);
  const st = useRef({ dpr: max, time: 0, frames: 0, good: 0 });
  useEffect(() => {
    st.current.dpr = max;
    setDpr(max);
    game.renderScale = max;
  }, [max, setDpr]);
  useFrame((_, delta) => {
    const s = st.current;
    if (game.screen !== 'playing' && game.screen !== 'title') return;
    s.time += Math.min(delta, 0.25);
    s.frames++;
    if (s.time < 1.5) return;
    const fps = s.frames / s.time;
    s.time = 0;
    s.frames = 0;
    let next = s.dpr;
    if (fps < 48 && s.dpr > min) {
      next = Math.max(min, s.dpr - (fps < 35 ? 0.2 : 0.1));
      s.good = 0;
    } else if (fps > 57) {
      if (++s.good >= 3 && s.dpr < max) {
        next = Math.min(max, s.dpr + 0.1);
        s.good = 0;
      }
    } else s.good = 0;
    if (next !== s.dpr) {
      s.dpr = Math.round(next * 100) / 100;
      setDpr(s.dpr);
      game.renderScale = s.dpr;
    }
  });
  return null;
}

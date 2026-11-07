// The 3D view. Everything inside <Canvas> is Three.js, written as React
// components via React Three Fiber.
import { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { STATIONS, JOURNEY, QUALITY_PRESETS } from './config/gameConfig.js';
import { useGameValue } from './state/gameStore.js';
import { sceneRefs } from './state/sceneRefs.js';
import SimulationDriver from './SimulationDriver.jsx';
import TrackRoute from './components/Track/TrackRoute.jsx';
import Train from './components/Train/Train.jsx';
import Station from './components/Stations/Station.jsx';
import Scenery from './components/Environment/Scenery.jsx';
import { Sky, Ground, Lighting, HORIZON_COLOR } from './components/Environment/Atmosphere.jsx';
import CameraRig from './components/Cameras/CameraRig.jsx';

export default function GameCanvas() {
  const screen = useGameValue((s) => s.screen);
  const quality = QUALITY_PRESETS[useGameValue((s) => s.settings.quality)];
  // While a menu covers the game we only render on demand, which saves battery.
  const frameloop = screen === 'paused' || screen === 'confirmRestart' ? 'demand' : 'always';

  return (
    <Canvas
      className="game-canvas"
      frameloop={frameloop}
      dpr={quality.dpr}
      shadows="percentage"
      onCreated={({ gl }) => (sceneRefs.gl = gl)}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 50, near: 0.2, far: quality.cameraFar, position: [0, 20, 40] }}
    >
      <CameraFar far={quality.cameraFar} />
      <color attach="background" args={[HORIZON_COLOR]} />
      <fog attach="fog" args={[HORIZON_COLOR, 250, quality.fogFar]} />
      <SimulationDriver />
      <Lighting shadows={quality.shadows} />
      <Sky radius={quality.cameraFar * 0.9} />
      <Ground />
      <TrackRoute />
      <Scenery />
      {STATIONS.map((st) => (
        <Station key={st.id} station={st} isDestination={st.id === JOURNEY.destinationId} />
      ))}
      <Train />
      <CameraRig />
    </Canvas>
  );
}

/** Applies the quality preset's view distance when it changes at runtime. */
function CameraFar({ far }) {
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    camera.far = far;
    camera.updateProjectionMatrix();
  }, [camera, far]);
  return null;
}

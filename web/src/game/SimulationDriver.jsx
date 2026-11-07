// The heartbeat of the game. Runs FIRST every frame (priority -3):
//   1. advance the train physics in fixed 1/60 s steps
//   2. update journey rules (stop zone, completion)
//   3. compute a smoothed "render distance" for drawing
//   4. feed the audio engine
//   5. publish a HUD snapshot ~10 times per second (not every frame)
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { game, publish, completeJourney, sceneReady, showToast, route, currentSpeedLimit, formation } from './state/gameStore.js';
import { stepTrain, createFixedStepper } from './simulation/trainSimulation.js';
import { updateJourney, JOURNEY_STATE } from './simulation/journeyManager.js';
import { TRAIN, JOURNEY, FIXED_TIMESTEP, MAX_FRAME_DELTA, STATIONS, SPEED_LIMITS, LEVEL_CROSSING } from './config/gameConfig.js';
import { stepAiTrains } from './simulation/aiTraffic.js';
import { audioEngine } from './audio/audioEngine.js';

const HUD_INTERVAL = 0.1;

/** 1 at a platform, fading to 0 about half a kilometre away (for station ambience). */
function stationProximity(s) {
  let best = 0;
  for (const st of STATIONS) {
    const d = Math.max(0, Math.max(st.platformStart - s, s - formation.totalLength - st.platformEnd));
    best = Math.max(best, 1 - Math.min(1, d / 550));
  }
  return best;
}
const MAX_SPEED_MPS = TRAIN.sectionalSpeedKmh / 3.6;

export default function SimulationDriver() {
  const stepper = useMemo(() => createFixedStepper(FIXED_TIMESTEP, MAX_FRAME_DELTA), []);
  const timers = useRef({ hud: 0, fpsTime: 0, fpsFrames: 0, frames: 0, resetVersion: game.resetVersion });

  useFrame((_, delta) => {
    const t = timers.current;
    if (t.resetVersion !== game.resetVersion) {
      t.resetVersion = game.resetVersion;
      stepper.reset();
    }

    const train = game.train;
    if (game.screen === 'playing') {
      const { alpha } = stepper.advance(delta, (dt) => {
        const speedBefore = train.speedMps;
        const k = Math.abs(route.curvatureAt(train.routeDistance - 100));
        stepTrain(train, game.input, dt, TRAIN, { curveRadius: k > 0 ? 1 / k : Infinity });
        updateJourney(game.journey, train, dt, JOURNEY, currentSpeedLimit(train));
        if (game.aiTrains) {
          stepAiTrains(game.aiTrains, dt, game.journey.elapsed, {
            limits: SPEED_LIMITS,
            playerFront: train.routeDistance,
          });
        }
        if (train.hitBufferStop && speedBefore > 0.5) showToast('End of the line — the train hit the buffer stop');
      });
      // Interpolate between the last two physics states for silky motion
      // even when the display refresh rate isn't exactly 60 Hz.
      game.renderDistance = train.previousRouteDistance + (train.routeDistance - train.previousRouteDistance) * alpha;
      if (game.journey.state === JOURNEY_STATE.COMPLETED) completeJourney();
    } else {
      game.renderDistance = train.routeDistance;
    }

    let passingAiTrain = false;
    if (game.aiTrains) {
      for (const tr of game.aiTrains) {
        if (tr.state !== 'running') continue;
        const rel = tr.front - train.routeDistance;
        if (rel > -tr.length - 30 && rel < 70) {
          passingAiTrain = true;
          if (!tr.hornSounded && rel > -10 && rel < 40) {
            tr.hornSounded = true;
            audioEngine.playAiHorn();
          }
        }
      }
    }

    const distToCrossing = Math.abs(train.routeDistance - LEVEL_CROSSING.s);
    const crossingProximity = distToCrossing < 450 ? 1 - distToCrossing / 450 : 0;

    audioEngine.update(train, game.input, MAX_SPEED_MPS, {
      stationProximity: stationProximity(train.routeDistance),
      crossingProximity,
      passingAiTrain,
      cameraMode: game.cameraMode,
      coachLivery: game.settings.coachLivery,
    });

    // FPS counter (cheap)
    t.fpsFrames++;
    t.fpsTime += delta;
    if (t.fpsTime >= 0.5) {
      game.fps = Math.round(t.fpsFrames / t.fpsTime);
      t.fpsFrames = 0;
      t.fpsTime = 0;
    }

    t.hud += delta;
    if (t.hud >= HUD_INTERVAL) {
      t.hud = 0;
      publish();
    }

    // The first couple of frames compile shaders; after that we're ready.
    if (++t.frames === 3) sceneReady();
  }, -3);

  return null;
}

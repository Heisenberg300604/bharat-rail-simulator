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
import { TRAIN, JOURNEY, FIXED_TIMESTEP, MAX_FRAME_DELTA, STATIONS, SPEED_LIMITS, LEVEL_CROSSING, ROAD } from './config/gameConfig.js';
import { sceneRefs } from './state/sceneRefs.js';
import { envState } from './world/environment.js';
import { KID_SPOTS } from './components/People/Crowds.jsx';
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

function nearestStationId(s) {
  let best = null;
  let bestD = Infinity;
  for (const st of STATIONS) {
    const d = Math.abs(s - (st.platformStart + st.platformEnd) / 2);
    if (d < bestD) {
      bestD = d;
      best = st.id;
    }
  }
  return best;
}

/** 0..1: how close the highway (lateral 32 m) is to the train. */
function roadProximity(s) {
  const out = Math.max(0, ROAD.from - s, s - ROAD.to);
  return 0.75 * (1 - Math.min(1, out / 250));
}

export default function SimulationDriver() {
  const stepper = useMemo(() => createFixedStepper(FIXED_TIMESTEP, MAX_FRAME_DELTA), []);
  const timers = useRef({ hud: 0, fpsTime: 0, fpsFrames: 0, frames: 0, resetVersion: game.resetVersion, playing: 0, whistled: false, kids: new Set() });

  useFrame((state, delta) => {
    const t = timers.current;
    if (t.resetVersion !== game.resetVersion) {
      t.resetVersion = game.resetVersion;
      stepper.reset();
      t.playing = 0;
      t.whistled = false;
      t.kids.clear();
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

    const front = train.routeDistance;
    if (game.screen === 'playing') {
      t.playing += delta;
      // the guard's "right away" whistle from the rear, shortly after the start
      if (!t.whistled && t.playing > 2.5) {
        t.whistled = true;
        audioEngine.playGuardWhistle(game.cameraMode === 'cab' ? 0.45 : 0.8);
      }
      // village children shouting as the train goes by
      for (const ks of KID_SPOTS) {
        if (!t.kids.has(ks) && train.speedMps > 4 && Math.abs(front - 30 - ks) < 25) {
          t.kids.add(ks);
          audioEngine.playKids(game.cameraMode === 'interior' && game.settings.coachLivery !== 'icfBlue' ? 0.25 : 0.8);
        }
      }
    }

    const k = Math.abs(route.curvatureAt(front - 60));
    audioEngine.update(train, game.input, MAX_SPEED_MPS, {
      route,
      camera: state.camera,
      stationProximity: stationProximity(front),
      stationId: nearestStationId(front),
      roadProximity: roadProximity(front),
      lcBell: !!sceneRefs.lcClosing,
      lcDistance: Math.abs(front - LEVEL_CROSSING.s),
      passingAiTrain,
      cameraMode: game.cameraMode,
      coachType: game.settings.coachLivery === 'icfBlue' ? 'icf' : 'lhb',
      coachEyeX: sceneRefs.coachEye?.eye[0] ?? 0,
      curveRadius: k > 0 ? 1 / k : Infinity,
      env: envState,
      ambienceMode: game.settings.ambience,
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

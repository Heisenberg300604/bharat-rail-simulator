// The heartbeat of the game. Runs FIRST every frame (priority -3):
//   1. advance the train physics in fixed 1/60 s steps
//   2. update journey rules (stop zone, completion)
//   3. compute a smoothed "render distance" for drawing
//   4. feed the audio engine
//   5. publish a HUD snapshot ~10 times per second (not every frame)
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { game, publish, completeJourney, sceneReady, showToast, route, currentSpeedLimit, formation } from './state/gameStore.js';
import { stepTrain, createFixedStepper, maxTractiveEffort } from './simulation/trainSimulation.js';
import { updateJourney, JOURNEY_STATE, stopsOf } from './simulation/journeyManager.js';
import { TRAIN, JOURNEY, FIXED_TIMESTEP, MAX_FRAME_DELTA, STATIONS, SPEED_LIMITS, ROAD, ROUTE, LOCOMOTIVES, consistFor } from './config/gameConfig.js';
import { tunnelAt, bridgeAt } from './routes/activeRoute.js';
import { terrain } from './world/terrain.js';
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

/** Which horn recording plays: the player's pick, or the locomotive's own. */
function hornChoice(settings) {
  return settings.horn && settings.horn !== 'auto' ? settings.horn : LOCOMOTIVES[settings.locomotive]?.horn ?? null;
}

function nearestStation(s) {
  let best = null;
  let bestD = Infinity;
  for (const st of STATIONS) {
    const d = Math.abs(s - (st.platformStart + st.platformEnd) / 2);
    if (d < bestD) {
      bestD = d;
      best = st;
    }
  }
  return best;
}

/** 0..1: how close the highway is to the train. */
function roadProximity(s) {
  if (!ROAD) return 0;
  const out = Math.max(0, ROAD.from - s, s - ROAD.to);
  return 0.75 * (1 - Math.min(1, out / 250));
}

/** 0..1: open water beside the line (sea, estuary) for the surf/wind ambience. */
function waterProximity(s) {
  if (!ROUTE.ambience.sea || !terrain.hasWater) return 0;
  let wet = 0;
  for (const lat of [-160, -70, 70, 160]) if (terrain.underwater(s, lat)) wet += 0.25;
  return wet * ROUTE.ambience.sea;
}

/** Route distance of the camera's viewpoint for on-train views (null = outside the train). */
function viewpointS(front) {
  switch (game.cameraMode) {
    case 'cab':
      return front - 2;
    case 'interior':
      return front - 33;
    case 'door':
      return front - 45;
    case 'rear':
      return front - formation.totalLength;
    default:
      return null;
  }
}

const JOURNEY_TOASTS = {
  arrived: (st) => `Arrived at ${st.name} — passengers boarding`,
  rightAway: (st, next) => `Right away! Guard's whistle — next stop ${next?.name ?? ''}`,
  missed: (st) => `Ran through ${st.name} without stopping (−20)`,
  early: (st) => `Left ${st.name} before the right-away (−8)`,
};

export default function SimulationDriver() {
  const stepper = useMemo(() => createFixedStepper(FIXED_TIMESTEP, MAX_FRAME_DELTA), []);
  const timers = useRef({ hud: 0, fpsTime: 0, fpsFrames: 0, frames: 0, resetVersion: game.resetVersion, playing: 0, whistled: false, kids: new Set(), water: 0, waterT: 0, tunnelCam: 0, tunnelTrain: 0 });

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
        // average gradient under the whole train (rise over its length)
        const len = formation.totalLength;
        const grade = (route.heightAt(train.routeDistance) - route.heightAt(train.routeDistance - len)) / len;
        const b = game.banker;
        const bankerTE = b && train.routeDistance > b.from && train.routeDistance < b.to ? b.count * maxTractiveEffort(train.speedMps, b.loco) : 0;
        stepTrain(train, game.input, dt, game.trainCfg, { curveRadius: k > 0 ? 1 / k : Infinity, grade, bankerTE_kN: bankerTE });
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
      // halts: arrival, the guard's right-away, missed stops
      const events = game.journey.events;
      while (events.length) {
        const ev = events.shift();
        const stops = stopsOf(JOURNEY);
        const i = game.journey.stopIndex;
        const st = ev === 'arrived' ? stops[i] : stops[Math.max(0, i - 1)];
        if (ev === 'rightAway') audioEngine.playGuardWhistle(game.cameraMode === 'cab' ? 0.45 : 0.8);
        if (ev === 'arrived') audioEngine.playClick('switch');
        showToast(JOURNEY_TOASTS[ev](st, stops[i]), 3200);
      }
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

    // nearest level crossing (its bell rings while its gates are closing/closed)
    let lcBell = false;
    let lcDistance = Infinity;
    for (const lc of sceneRefs.lcState ?? []) {
      const d = Math.abs(front - lc.s);
      if (d < lcDistance) {
        lcDistance = d;
        lcBell = lc.closing;
      }
    }
    const k = Math.abs(route.curvatureAt(front - 60));
    // tunnels: the train's own sound (enclosure) and the light level of on-train views
    const d = Math.min(delta, 0.1);
    const inT = tunnelAt(front - 30) ? 1 : 0;
    t.tunnelTrain += (inT - t.tunnelTrain) * Math.min(1, d * 3);
    const vs = viewpointS(game.renderDistance);
    const camIn = vs !== null && tunnelAt(vs, -6) ? 1 : 0;
    t.tunnelCam += (camIn - t.tunnelCam) * Math.min(1, d * 2.5);
    sceneRefs.tunnelDark = t.tunnelCam;
    t.waterT -= delta;
    if (t.waterT <= 0) {
      t.waterT = 0.5;
      t.water = waterProximity(front);
    }
    const nearSt = nearestStation(front);
    audioEngine.update(train, game.input, MAX_SPEED_MPS, {
      route,
      camera: state.camera,
      stationProximity: stationProximity(front),
      stationBusy: nearSt?.sound === 'city' || nearSt === STATIONS[0],
      enclosure: game.cameraMode === 'orbit' || game.cameraMode === 'trackside' ? t.tunnelTrain * 0.5 : t.tunnelTrain,
      onBridge: !!bridgeAt(front - 40),
      water: t.water,
      roadProximity: roadProximity(front),
      lcBell,
      lcDistance,
      passingAiTrain,
      cameraMode: game.cameraMode,
      coachType: consistFor(game.settings.coachLivery).type,
      coachCount: consistFor(game.settings.coachLivery).count,
      coachEyeX: sceneRefs.coachEye?.eye[0] ?? 0,
      curveRadius: k > 0 ? 1 / k : Infinity,
      env: envState,
      ambienceMode: game.settings.ambience,
      hornChoice: hornChoice(game.settings),
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

    // Compile every shader now (behind the loading screen), including objects
    // that are culled or far down the line, so nothing hitches when it first
    // comes into view mid-journey. Runs before the chunk culling hides them.
    if (t.frames === 0) {
      try {
        state.gl.compile(state.scene, state.camera);
      } catch {
        /* older three.js: shaders compile lazily instead */
      }
    }
    if (++t.frames === 3) sceneReady();
  }, -3);

  return null;
}

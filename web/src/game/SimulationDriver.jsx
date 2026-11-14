// The heartbeat of the game. Runs FIRST every frame (priority -3):
//   1. advance the train physics in fixed 1/60 s steps
//   2. update journey rules (stop zone, completion)
//   3. compute a smoothed "render distance" for drawing
//   4. feed the audio engine
//   5. publish a HUD snapshot ~10 times per second (not every frame)
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { game, publish, completeJourney, sceneReady, showToast, route, currentSpeedLimit, formation, journeyCfg } from './state/gameStore.js';
import { updateRunStats } from './simulation/runStats.js';
import { updateSignalling, nextSignal } from './simulation/signalling.js';
import { failJourney, emergencyBrake } from './state/gameStore.js';
import { difficultyFor } from './config/gameConfig.js';
import { updateLesson, lessonById } from './simulation/driverSchool.js';
import { markLessonDone } from './state/gameStore.js';
import { stepTrain, createFixedStepper, maxTractiveEffort, adhesionMu, applyEmergency } from './simulation/trainSimulation.js';
import { updateKavach } from './simulation/kavach.js';
import { updateVcd } from './simulation/vcd.js';
import { kavachActive } from './state/gameStore.js';
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

/**
 * Kavach, the vigilance device and adhesion, per difficulty/settings. Runs
 * every physics step; returns the extra inputs for stepTrain.
 */
const prev = { lever: 0, buzz: false };
function protection(train, dt) {
  const diff = difficultyFor(game.settings.difficulty);
  const out = {};
  // adhesion: wet rail in rain, damp in fog; sand restores grip
  if (diff.adhesion) out.mu = adhesionMu({ rain: envState.rain ?? 0, fog: game.settings.weather === 'fog' ? 1 : 0, sanding: game.input.sand });

  // Kavach: supervise the line speed, restrictions ahead and the end of authority
  const k = game.kavach;
  if (kavachActive()) {
    const front = train.routeDistance;
    const limitsAhead = [];
    for (const l of SPEED_LIMITS) if (l.from > front && l.from - front < 2000) limitsAhead.push({ distance: l.from - front, kmh: l.kmh, label: l.reason });
    let redAhead = { distance: JOURNEY.bufferStop - front, name: 'Buffer stop' };
    let passedRedBy = 0;
    for (const sig of game.signalling?.up ?? []) {
      if (sig.spad) passedRedBy = Math.max(passedRedBy, front - sig.s);
      if (sig.s > front && sig.aspect === 'red' && sig.s - front < redAhead.distance) {
        redAhead = { distance: sig.s - front, name: sig.name };
        break;
      }
    }
    const ev = updateKavach(k, { speedMps: train.speedMps, front, lineLimitKmh: currentSpeedLimit(train), limitsAhead, redAhead, passedRedBy });
    if (ev === 'intervene') {
      game.stats.kavachInterventions++;
      showToast(`Kavach: overspeed — brakes applied (permitted ${Math.round(k.permittedKmh)} km/h)`, 2600);
      audioEngine.playClick('heavy');
    } else if (ev === 'warn') audioEngine.playClick('lever');
    else if (ev === 'trip') showToast('Kavach TRIP — emergency brake', 3000);
    if (k.emergency && !train.emergency) applyEmergency(train);
    if (k.brakeDemand > 0) {
      out.extraBrake = k.brakeDemand;
      out.cutTraction = true;
    }
  } else if (k.state !== 'normal') {
    k.state = 'normal';
    k.brakeDemand = 0;
  }

  // VCD: act every 60 s (button V, moving the throttle > 3 %, or sanding)
  if (diff.vcd) {
    const leverMoved = Math.abs(train.lever - prev.lever) > 0.03;
    if (leverMoved) prev.lever = train.lever;
    const ack = game.vcdAck || leverMoved || game.input.sand;
    game.vcdAck = false;
    const ev = updateVcd(game.vcd, { speedKmh: train.speedMps * 3.6, ack, leverZero: Math.abs(train.lever) < 0.02, dt });
    if (ev === 'warn') showToast('VCD — press V (vigilance) within 8 seconds', 3000);
    if (ev === 'penalty') {
      applyEmergency(train);
      game.stats.vcdPenalties++;
      showToast('VCD penalty brake! Throttle to 0, wait 160 s, then press V to reset.', 5000);
    }
    if (ev === 'reset') showToast('VCD reset', 1500);
    const buzz = game.vcd.phase === 'warning';
    if (buzz !== prev.buzz) audioEngine.setBuzzer((prev.buzz = buzz));
    if (game.vcd.phase === 'penalty') out.cutTraction = true;
  } else {
    game.vcdAck = false;
    prev.lever = train.lever;
    if (prev.buzz) audioEngine.setBuzzer((prev.buzz = false));
  }
  return out;
}

/** React to signals: SPAD consequences follow the difficulty; a cleared home is announced. */
function handleSignalEvent(ev) {
  if (ev.type === 'spad') {
    game.stats.spads++;
    if (!game.train.emergency) emergencyBrake(); // stop at once — what a loco pilot must do after a SPAD
    const mode = difficultyFor(game.settings.difficulty).spad;
    const name = ev.signal.name;
    if (mode === 'end') {
      failJourney(`Signal passed at danger: ${name}`);
      return;
    }
    if (mode === 'penalty') game.journey.spadPenalties++;
    showToast(mode === 'penalty' ? `SPAD — ${name} passed at danger (−25). Never pass a red signal.` : `SPAD — you passed ${name} at danger! Stop before a red signal.`, 5000);
    audioEngine.playClick('heavy');
  } else if (ev.type === 'cleared' && ev.signal.s - game.train.routeDistance < 1500) {
    showToast(`${ev.signal.name} cleared — proceed with caution`, 2800);
  }
}

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
        const prot = protection(train, dt);
        stepTrain(train, game.input, dt, game.trainCfg, { curveRadius: k > 0 ? 1 / k : Infinity, grade, bankerTE_kN: bankerTE, ...prot });
        updateJourney(game.journey, train, dt, journeyCfg, currentSpeedLimit(train));
        updateRunStats(game.stats, train, dt);
        if (game.signalling) {
          const j = game.journey;
          const spans = [];
          for (const ai of game.aiTrains ?? []) if (ai.state !== 'waiting') spans.push([ai.front, ai.front + ai.length]);
          const evs = updateSignalling(game.signalling, {
            front: train.routeDistance,
            speed: train.speedMps,
            dt,
            stopIndex: j.stopIndex,
            rightAway: j.rightAway,
            // the starter clears a few seconds before the guard's whistle
            dwellDone: j.state === JOURNEY_STATE.DWELL && j.dwellTimer < 4,
            aiSpans: spans,
          });
          for (const ev of evs) handleSignalEvent(ev);
        }
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
      sceneRefs.nextSignal = game.signalling ? nextSignal(game.signalling, train.routeDistance) : null;
      if (game.lesson && game.signalling) game.lesson.passed = game.signalling.passed;
      // driver school: advance the lesson when its step condition holds
      if (game.lesson && !game.lesson.done) {
        const r = updateLesson(game.lesson, { train, journey: game.journey, signal: sceneRefs.nextSignal ?? null }, delta);
        if (r) {
          audioEngine.playClick('lever');
          if (r === 'done') {
            markLessonDone(game.lesson.id);
            showToast(`Lesson complete: ${lessonById(game.lesson.id).title}`, 4000);
          }
          publish();
        }
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
        // close pass: the opposing train's nose goes by the cab — pressure thump + a jolt
        if (tr.lastRel !== undefined && tr.lastRel > 0 && rel <= 0) {
          const closing = tr.speed + train.speedMps;
          if (closing > 8) {
            const k = Math.min(1, closing / 45);
            audioEngine.playThump(game.cameraMode === 'interior' ? 0.45 * k : k);
            sceneRefs.shake = Math.max(sceneRefs.shake ?? 0, k);
          }
        }
        tr.lastRel = rel;
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
          audioEngine.playKids(game.cameraMode === 'interior' && consistFor(game.settings.coachLivery).type !== 'icf' ? 0.25 : 0.8);
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

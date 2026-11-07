// A tiny game store without extra libraries.
//
// `game` is a plain mutable object. The 3D frame loop reads and writes it
// directly every frame (fast, no React re-renders). React UI components read an
// immutable *snapshot* that we publish only when needed — ~10×/s for the HUD,
// immediately for menu/screen changes.
import { useSyncExternalStore } from 'react';
import { TRAIN, JOURNEY, ROUTE_SEGMENTS, FORMATION, COACH_TYPES, AI_TRAINS, STATIONS, QUALITY_PRESETS, SPEED_LIMITS } from '../config/gameConfig.js';
import { createRoute, computeFormation } from '../simulation/routeMath.js';
import { createAiTrains } from '../simulation/aiTraffic.js';
import {
  createTrainState,
  cycleDirection as simCycleDirection,
  applyEmergency,
  DIRECTION_LABEL,
  brakeHandleLabel,
  estimateStoppingDistance,
  speedLimitFor,
  nextSpeedLimit,
} from '../simulation/trainSimulation.js';
import {
  createJourney,
  journeyHint,
  journeyProgress,
  remainingDistance,
  JOURNEY_STATE,
} from '../simulation/journeyManager.js';
import { audioEngine } from '../audio/audioEngine.js';
import { detectQuality } from './detectQuality.js';

export const route = createRoute(ROUTE_SEGMENTS);
export const formation = computeFormation(FORMATION);
export const origin = STATIONS.find((s) => s.id === JOURNEY.originId);
export const destination = STATIONS.find((s) => s.id === JOURNEY.destinationId);

function lengthOfAiTrain(def) {
  const ct = COACH_TYPES[def.type] || COACH_TYPES.lhb;
  return FORMATION.locomotive.length + def.coaches * (ct.length + (ct.gap ?? 0.5));
}

export function initAiTrains() {
  return createAiTrains(AI_TRAINS, lengthOfAiTrain);
}

function newTrain() {
  return createTrainState({
    startDistance: JOURNEY.startDistance,
    minDistance: formation.totalLength + 5, // rear of the train can't pass the route start
    maxDistance: JOURNEY.bufferStop,
    coachCount: FORMATION.coachCount,
    cfg: TRAIN,
  });
}

function loadSettings() {
  const defaults = { volume: 0.8, muted: false, quality: detectQuality(), showFps: false, fov: 65, coachLivery: 'red' };
  try {
    const saved = JSON.parse(localStorage.getItem('brs-settings') || '{}');
    const merged = { ...defaults, ...saved };
    if (!QUALITY_PRESETS[merged.quality]) merged.quality = 'high';
    return merged;
  } catch {
    return defaults;
  }
}
function saveSettings() {
  try {
    localStorage.setItem('brs-settings', JSON.stringify(game.settings));
  } catch {
    /* storage unavailable (private mode) — settings just won't persist */
  }
}

export const game = {
  // 'loading' | 'title' | 'playing' | 'paused' | 'confirmRestart' | 'completed'
  screen: 'loading',
  train: newTrain(),
  journey: createJourney(),
  aiTrains: initAiTrains(),
  renderDistance: JOURNEY.startDistance, // smoothed distance used for drawing
  input: { leverUp: false, leverDown: false, brakeApply: false, brakeRelease: false, horn: false },
  cameraMode: 'cab', // 'cab' | 'chase' | 'orbit' | 'trackside'
  headlight: true,
  settings: loadSettings(),
  toast: null, // { text, until }
  fps: 0,
  renderScale: 1,
  resetVersion: 0, // bumps on restart so the frame loop can reset its timers
};

// ------------------------------------------------------------ snapshot / subscribe
const listeners = new Set();
let snapshot = buildSnapshot();

export function currentSpeedLimit(train = game.train) {
  return speedLimitFor(SPEED_LIMITS, train.routeDistance - formation.totalLength, train.routeDistance);
}

function buildSnapshot() {
  const t = game.train;
  const now = performance.now();
  const limit = currentSpeedLimit(t);
  return {
    lever: t.lever,
    teKN: t.teActual,
    bp: t.bp,
    bc: t.bc,
    brakeHandle: t.brakeHandle,
    brakeLabel: brakeHandleLabel(t),
    emergency: t.emergency,
    tractionCut: t.tractionCut && t.lever > 0,
    speedLimit: limit,
    nextLimit: nextSpeedLimit(SPEED_LIMITS, t.routeDistance, limit),
    stoppingDistance: estimateStoppingDistance(t, TRAIN),
    screen: game.screen,
    speedKmh: t.speedMps * 3.6,
    throttle: t.throttle,
    brake: t.brake,
    brakeEffective: t.brakeEffective,
    direction: t.direction,
    directionLabel: DIRECTION_LABEL[t.direction],
    journeyState: game.journey.state,
    remaining: remainingDistance(t, JOURNEY),
    progress: journeyProgress(t, JOURNEY),
    hint: journeyHint(game.journey, t, JOURNEY, destination.name),
    result: game.journey.result,
    elapsed: game.journey.elapsed,
    cameraMode: game.cameraMode,
    headlight: game.headlight,
    horn: game.input.horn,
    toast: game.toast && game.toast.until > now ? game.toast.text : null,
    settings: { ...game.settings },
    fps: game.fps,
    renderScale: game.renderScale,
  };
}

export function publish() {
  snapshot = buildSnapshot();
  listeners.forEach((l) => l());
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function useGameSnapshot() {
  return useSyncExternalStore(subscribe, () => snapshot);
}
/**
 * Subscribe to ONE primitive value, e.g. useGameValue(s => s.screen).
 * The component only re-renders when that value changes — important for the
 * 3D scene, which must not re-render 10×/s along with the HUD.
 */
export function useGameValue(selector) {
  return useSyncExternalStore(subscribe, () => selector(snapshot));
}
/** The active graphics preset object (see QUALITY_PRESETS). */
export function useQuality() {
  return QUALITY_PRESETS[useGameValue((s) => s.settings.quality)];
}

// ------------------------------------------------------------ actions
export function showToast(text, ms = 2200) {
  game.toast = { text, until: performance.now() + ms };
  publish();
}

function setScreen(screen) {
  game.screen = screen;
  releaseAllInputs();
  audioEngine.setPaused(screen !== 'playing');
  publish();
}

export function releaseAllInputs() {
  for (const key of Object.keys(game.input)) game.input[key] = false;
}

const _loadStartTime = Date.now();

export function sceneReady() {
  if (game.screen === 'loading') {
    const elapsed = Date.now() - _loadStartTime;
    const minLoadingTime = 1500; // ms: gives time for shaders to warm up and for the user to enjoy the train & track animation
    if (elapsed < minLoadingTime) {
      setTimeout(() => {
        if (game.screen === 'loading') setScreen('title');
      }, minLoadingTime - elapsed);
    } else {
      setScreen('title');
    }
  }
}

export function resetJourney() {
  game.train = newTrain();
  game.journey = createJourney();
  game.aiTrains = initAiTrains();
  game.renderDistance = game.train.routeDistance;
  game.toast = null;
  game.resetVersion++;
}

export function startJourney() {
  audioEngine.init(); // must happen inside a click: browsers block audio until a user gesture
  audioEngine.setVolume(game.settings.volume, game.settings.muted);
  resetJourney();
  setScreen('playing');
}

export function togglePause() {
  if (game.screen === 'playing') setScreen('paused');
  else if (game.screen === 'paused' || game.screen === 'confirmRestart') setScreen('playing');
}

export function requestRestart() {
  if (['playing', 'paused', 'completed'].includes(game.screen)) setScreen('confirmRestart');
}
export function confirmRestart() {
  resetJourney();
  setScreen('playing');
}
export function cancelRestart() {
  setScreen(game.journey.state === JOURNEY_STATE.COMPLETED ? 'completed' : 'playing');
}

export function returnToTitle() {
  resetJourney();
  setScreen('title');
}

export function completeJourney() {
  setScreen('completed');
}

const CAMERA_ORDER = ['cab', 'interior', 'chase', 'orbit', 'trackside'];
export function toggleCamera() {
  game.cameraMode = CAMERA_ORDER[(CAMERA_ORDER.indexOf(game.cameraMode) + 1) % CAMERA_ORDER.length];
  publish();
}
export function setCamera(mode) {
  if (CAMERA_ORDER.includes(mode)) {
    game.cameraMode = mode;
    publish();
  }
}

export function toggleHeadlight() {
  game.headlight = !game.headlight;
  publish();
}

export function emergencyBrake() {
  if (!game.train.emergency) {
    applyEmergency(game.train);
    showToast('EMERGENCY BRAKE — brake pipe vented. Stop, then hold X to reset.', 3500);
  }
}

export function cycleDirection() {
  const res = simCycleDirection(game.train, TRAIN);
  showToast(res.message);
}

export function updateSettings(patch) {
  game.settings = { ...game.settings, ...patch };
  audioEngine.setVolume(game.settings.volume, game.settings.muted);
  saveSettings();
  publish();
}

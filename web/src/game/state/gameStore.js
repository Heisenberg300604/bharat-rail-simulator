// A tiny game store without extra libraries.
//
// `game` is a plain mutable object. The 3D frame loop reads and writes it
// directly every frame (fast, no React re-renders). React UI components read an
// immutable *snapshot* that we publish only when needed — ~10×/s for the HUD,
// immediately for menu/screen changes.
import { useSyncExternalStore } from 'react';
import { JOURNEY, FORMATION, COACH_TYPES, AI_TRAINS, STATIONS, QUALITY_PRESETS, SPEED_LIMITS, LOCOMOTIVES, CONSISTS, ROUTE, consistFor, trainConfigFor } from '../config/gameConfig.js';
import { computeFormation } from '../simulation/routeMath.js';
import { setActiveRoute, routeId as activeRouteId } from '../routes/activeRoute.js';
import { isRouteId, DEFAULT_ROUTE_ID } from '../routes/index.js';
import { createAiTrains } from '../simulation/aiTraffic.js';
import {
  createTrainState,
  trainMass,
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
  currentStop,
  JOURNEY_STATE,
} from '../simulation/journeyManager.js';
import { audioEngine } from '../audio/audioEngine.js';
import { detectQuality } from './detectQuality.js';
import { TIME_OF_DAY, WEATHER } from '../world/environment.js';

// The route geometry (live binding: changes with the selected route)
export { route } from '../routes/activeRoute.js';
/** Length/offsets of the player's train for a consist (passenger rake or freight). */
function formationFor(consistId) {
  const c = consistFor(consistId);
  const ct = COACH_TYPES[c.type] ?? COACH_TYPES.lhb;
  return computeFormation({ locomotive: FORMATION.locomotive, coach: ct, coachCount: c.count, couplingGap: ct.gap ?? FORMATION.couplingGap });
}
// `let`: an ES-module live binding, so importers see the new value when the consist changes
export let formation = formationFor('red');
// live bindings, refreshed when the route changes
export let origin = STATIONS.find((s) => s.id === JOURNEY.originId);
export let destination = STATIONS.find((s) => s.id === JOURNEY.destinationId);
function refreshEnds() {
  origin = STATIONS.find((s) => s.id === JOURNEY.originId);
  destination = STATIONS.find((s) => s.id === JOURNEY.destinationId);
}

function lengthOfAiTrain(def) {
  const ct = COACH_TYPES[def.type] || COACH_TYPES.lhb;
  return FORMATION.locomotive.length + def.coaches * (ct.length + (ct.gap ?? 0.5));
}

export function initAiTrains() {
  return createAiTrains(AI_TRAINS, lengthOfAiTrain);
}

/**
 * Banking locomotives (e.g. two WAG-9s on the Bhor Ghat) are attached at the
 * rear of heavy trains on routes that use them: extra mass + extra push.
 */
export function bankerFor(cfg, consistId) {
  const b = ROUTE.banker;
  if (!b) return null;
  const massT = cfg.loco.massT + consistFor(consistId).count * consistFor(consistId).massT;
  if (massT < (b.minTrainMassT ?? 0)) return null;
  const loco = { ...TRAIN_DEFAULTS(), ...(LOCOMOTIVES[b.loco]?.physics ?? {}) };
  return { ...b, label: `${b.count} × ${LOCOMOTIVES[b.loco]?.label.split(' ')[0] ?? b.loco} banker${b.count > 1 ? 's' : ''}`, massT: b.count * cfg.loco.massT, loco };
}
function TRAIN_DEFAULTS() {
  return trainConfigFor('wap7');
}
function trainCfgWithBanker(locoId, consistId) {
  const cfg = trainConfigFor(locoId, consistId);
  const b = bankerFor(cfg, consistId);
  return b ? { ...cfg, bankerMassT: b.massT } : cfg;
}

function newTrain(cfg = game.trainCfg, consistId = game.settings.coachLivery) {
  return createTrainState({
    startDistance: JOURNEY.startDistance,
    minDistance: formation.totalLength + 5, // rear of the train can't pass the route start
    maxDistance: JOURNEY.bufferStop,
    coachCount: consistFor(consistId).count,
    cfg,
  });
}

function loadSettings() {
  const defaults = {
    volume: 0.8,
    muted: false,
    quality: detectQuality(),
    showFps: false,
    fov: 65,
    coachLivery: 'red',
    timeOfDay: 'noon',
    weather: 'clear',
    kavach: true,
    crowd: true,
    ambience: 'occasional', // background sounds: 'occasional' | 'always' | 'off'
    locomotive: 'wap7',
    horn: 'auto', // 'auto' = the locomotive's own horns, or a horn id from horns/horns.json
    route: DEFAULT_ROUTE_ID,
  };
  try {
    const saved = JSON.parse(localStorage.getItem('brs-settings') || '{}');
    const merged = { ...defaults, ...saved };
    if (!QUALITY_PRESETS[merged.quality]) merged.quality = 'high';
    if (!TIME_OF_DAY[merged.timeOfDay]) merged.timeOfDay = defaults.timeOfDay;
    if (!WEATHER[merged.weather]) merged.weather = defaults.weather;
    if (!LOCOMOTIVES[merged.locomotive]) merged.locomotive = defaults.locomotive;
    if (!CONSISTS[merged.coachLivery]) merged.coachLivery = defaults.coachLivery; // e.g. the retired blue LHB option
    if (!isRouteId(merged.route)) merged.route = defaults.route;
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

const initialSettings = loadSettings();
if (setActiveRoute(initialSettings.route)) refreshEnds();
const initialTrainCfg = trainCfgWithBanker(initialSettings.locomotive, initialSettings.coachLivery);
formation = formationFor(initialSettings.coachLivery);

export const game = {
  // 'loading' | 'title' | 'playing' | 'paused' | 'confirmRestart' | 'completed'
  screen: 'loading',
  trainCfg: initialTrainCfg, // TRAIN + the chosen locomotive's figures
  banker: bankerFor(initialTrainCfg, initialSettings.coachLivery),
  train: newTrain(initialTrainCfg, initialSettings.coachLivery),
  journey: createJourney(),
  aiTrains: initAiTrains(),
  renderDistance: JOURNEY.startDistance, // smoothed distance used for drawing
  input: { leverUp: false, leverDown: false, brakeApply: false, brakeRelease: false, horn: false },
  cameraMode: 'cab', // 'cab' | 'chase' | 'orbit' | 'trackside'
  headlight: true,
  settings: initialSettings,
  toast: null, // { text, until }
  fps: 0,
  renderScale: 1,
  resetVersion: 0, // bumps on restart so the frame loop can reset its timers
  routeId: activeRouteId,
  bests: loadBests(), // best score per route id
};

function loadBests() {
  try {
    return JSON.parse(localStorage.getItem('brs-best') || '{}');
  } catch {
    return {};
  }
}
function saveBest(id, score) {
  if (!(score > (game.bests[id] ?? -1))) return false;
  game.bests = { ...game.bests, [id]: score };
  try {
    localStorage.setItem('brs-best', JSON.stringify(game.bests));
  } catch {
    /* storage unavailable */
  }
  return true;
}

// ------------------------------------------------------------ snapshot / subscribe
const listeners = new Set();
let snapshot = buildSnapshot();

/** Route speed limit over the whole train, capped by the locomotive's own maximum. */
export function currentSpeedLimit(train = game.train) {
  const route = speedLimitFor(SPEED_LIMITS, train.routeDistance - formation.totalLength, train.routeDistance);
  return Math.min(route, game.trainCfg?.locoMaxKmh ?? Infinity);
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
    stoppingDistance: estimateStoppingDistance(t, game.trainCfg),
    screen: game.screen,
    speedKmh: t.speedMps * 3.6,
    throttle: t.throttle,
    brake: t.brake,
    brakeEffective: t.brakeEffective,
    direction: t.direction,
    directionLabel: DIRECTION_LABEL[t.direction],
    journeyState: game.journey.state,
    remaining: remainingDistance(t, JOURNEY, game.journey),
    progress: journeyProgress(t, JOURNEY),
    hint: journeyHint(game.journey, t, JOURNEY),
    nextStop: currentStop(game.journey, JOURNEY),
    stopIndex: game.journey.stopIndex,
    dwell: game.journey.state === JOURNEY_STATE.DWELL ? Math.max(0, game.journey.dwellTimer) : null,
    grade: t.grade ?? 0,
    banker: game.banker?.label ?? null,
    routeId: game.routeId,
    bests: game.bests,
    newBest: game.newBest ?? false,
    result: game.journey.result,
    elapsed: game.journey.elapsed,
    cameraMode: game.cameraMode,
    headlight: game.headlight,
    horn: game.input.horn,
    toast: game.toast && game.toast.until > now ? game.toast.text : null,
    settings: { ...game.settings },
    fps: game.fps,
    renderScale: game.renderScale,
    resetVersion: game.resetVersion,
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

let loadStart = Date.now();
let firstLoad = true;

export function sceneReady() {
  if (game.screen === 'loading') {
    const elapsed = Date.now() - loadStart;
    const minLoadingTime = firstLoad ? 1500 : 700; // ms: shader warm-up (and time to enjoy the loading animation)
    firstLoad = false;
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
  game.trainCfg = trainCfgWithBanker(game.settings.locomotive, game.settings.coachLivery);
  game.banker = bankerFor(game.trainCfg, game.settings.coachLivery);
  game.newBest = false;
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
  const score = game.journey.result?.score;
  game.newBest = score !== undefined && saveBest(game.routeId, score);
  setScreen('completed');
}

/**
 * Switch to another route. The 3D world is keyed by route id, so it rebuilds
 * (behind the loading screen) and the old route's GPU memory is released.
 */
export function selectRoute(id) {
  if (!isRouteId(id) || id === game.routeId) return;
  if (!setActiveRoute(id)) return;
  refreshEnds();
  game.routeId = id;
  game.settings = { ...game.settings, route: id };
  saveSettings();
  resetJourney();
  loadStart = Date.now();
  setScreen('loading');
}

const CAMERA_ORDER = ['cab', 'interior', 'door', 'rear', 'orbit', 'trackside'];
/** Cameras available with the current consist (no coach interior/doorway on a freight train). */
function cameraAvailable(mode) {
  return consistFor(game.settings.coachLivery).passenger || (mode !== 'interior' && mode !== 'door');
}
export function toggleCamera() {
  let i = CAMERA_ORDER.indexOf(game.cameraMode);
  do i = (i + 1) % CAMERA_ORDER.length;
  while (!cameraAvailable(CAMERA_ORDER[i]));
  game.cameraMode = CAMERA_ORDER[i];
  publish();
}
export function setCamera(mode) {
  if (CAMERA_ORDER.includes(mode) && cameraAvailable(mode)) {
    game.cameraMode = mode;
    publish();
  }
}

export function toggleHeadlight() {
  game.headlight = !game.headlight;
  audioEngine.playClick('switch');
  publish();
}

export function emergencyBrake() {
  if (!game.train.emergency) {
    applyEmergency(game.train);
    audioEngine.playClick('heavy');
    showToast('EMERGENCY BRAKE — brake pipe vented. Stop, then hold X to reset.', 3500);
  }
}

export function cycleDirection() {
  const res = simCycleDirection(game.train, game.trainCfg);
  if (res.ok) audioEngine.playClick('heavy');
  showToast(res.message);
}

export function updateSettings(patch) {
  const prev = game.settings;
  game.settings = { ...game.settings, ...patch };
  // driving physics follow the chosen loco and what it hauls
  game.trainCfg = trainCfgWithBanker(game.settings.locomotive, game.settings.coachLivery);
  game.banker = bankerFor(game.trainCfg, game.settings.coachLivery);
  if (prev.coachLivery !== game.settings.coachLivery) {
    formation = formationFor(game.settings.coachLivery);
    const c = consistFor(game.settings.coachLivery);
    game.train.mass = trainMass(game.trainCfg, c.count);
    game.train.minDistance = formation.totalLength + 5;
    // a freight train has no coach to sit in or doorway to stand in
    if (!c.passenger && (game.cameraMode === 'interior' || game.cameraMode === 'door')) game.cameraMode = 'cab';
  } else if (prev.locomotive !== game.settings.locomotive) {
    game.train.mass = trainMass(game.trainCfg, consistFor(game.settings.coachLivery).count);
  }
  audioEngine.setVolume(game.settings.volume, game.settings.muted);
  saveSettings();
  publish();
}

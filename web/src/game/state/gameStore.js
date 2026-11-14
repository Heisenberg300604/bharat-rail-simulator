// A tiny game store without extra libraries.
//
// `game` is a plain mutable object. The 3D frame loop reads and writes it
// directly every frame (fast, no React re-renders). React UI components read an
// immutable *snapshot* that we publish only when needed — ~10×/s for the HUD,
// immediately for menu/screen changes.
import { useSyncExternalStore } from 'react';
import { JOURNEY, FORMATION, COACH_TYPES, AI_TRAINS, STATIONS, QUALITY_PRESETS, SPEED_LIMITS, LOCOMOTIVES, CONSISTS, ROUTE, DIFFICULTY, consistFor, trainConfigFor, difficultyFor, locoLength } from '../config/gameConfig.js';
import { createRunStats, summarizeRunStats } from '../simulation/runStats.js';
import { createRecords } from './records.js';
import { createLessonState, lessonById } from '../simulation/driverSchool.js';
import { createSignalling, nextSignal as findNextSignal } from '../simulation/signalling.js';
import { createKavach } from '../simulation/kavach.js';
import { planIncidents, createIncidentState, runSpeedLimits, incidentLimitAt, summarizeIncidents, INCIDENT_MODES } from '../simulation/incidents.js';
import { failSignal } from '../simulation/signalling.js';
import { tunnelAt, bridgeAt } from '../routes/activeRoute.js';
import { createVcd, vcdSecondsLeft } from '../simulation/vcd.js';
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
import { pauseAnnouncements, stopAnnouncements } from '../audio/announcements.js';
import { detectQuality } from './detectQuality.js';
import { TIME_OF_DAY, WEATHER } from '../world/environment.js';

// The route geometry (live binding: changes with the selected route)
export { route } from '../routes/activeRoute.js';
/** Length/offsets of the player's train for a consist (passenger rake or freight). */
function formationFor(consistId, locoId = 'wap7') {
  const c = consistFor(consistId);
  const ct = COACH_TYPES[c.type] ?? COACH_TYPES.lhb;
  const f = computeFormation({ locomotive: { ...FORMATION.locomotive, length: locoLength(locoId) }, coach: ct, coachCount: c.count, couplingGap: ct.gap ?? FORMATION.couplingGap });
  // goods trains end with a brake van (the guard's van)
  if (c.brakeVan) f.totalLength += (ct.gap ?? FORMATION.couplingGap) + COACH_TYPES[c.brakeVan].length;
  return f;
}
export let formation = formationFor('red');
// live bindings, refreshed when the route changes
export let origin = STATIONS.find((s) => s.id === JOURNEY.originId);
export let destination = STATIONS.find((s) => s.id === JOURNEY.destinationId);
function refreshEnds() {
  origin = STATIONS.find((s) => s.id === JOURNEY.originId);
  destination = STATIONS.find((s) => s.id === JOURNEY.destinationId);
}

/**
 * The journey rules actually in force: the route's journey with the stop
 * zone of the chosen difficulty (live binding — read it, don't cache it).
 */
export let journeyCfg = JOURNEY;
function refreshJourneyCfg(difficultyId) {
  const half = difficultyFor(difficultyId).stopZoneHalf;
  journeyCfg = half ? { ...JOURNEY, stopZoneHalfLength: half, stops: JOURNEY.stops.map((st) => ({ ...st, halfLength: half })) } : JOURNEY;
}

/** Is Kavach active? The player's setting ('on' | 'off'), or the difficulty's default ('auto'). */
export function kavachActive(settings = game.settings) {
  if (settings.kavach === 'on') return true;
  if (settings.kavach === 'off') return false;
  return difficultyFor(settings.difficulty).kavach;
}

export const records = createRecords();

function lengthOfAiTrain(def) {
  const ct = COACH_TYPES[def.type] || COACH_TYPES.lhb;
  const van = def.type === 'boxn' ? (ct.gap ?? 0.5) + COACH_TYPES.bvzi.length : 0;
  return locoLength(def.loco ?? 'wap7') + def.coaches * (ct.length + (ct.gap ?? 0.5)) + van;
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
    kavach: 'auto', // Kavach ATP: 'auto' (follows the difficulty) | 'on' | 'off'
    difficulty: 'pilot', // see DIFFICULTY in gameConfig.js; 'pilot' = the standard game
    crowd: true,
    ambience: 'occasional', // background sounds: 'occasional' | 'always' | 'off'
    locomotive: 'wap7',
    horn: 'auto', // 'auto' = the locomotive's own horns, or a horn id from horns/horns.json
    route: DEFAULT_ROUTE_ID,
    showStandIns: false, // offer locos whose licensed 3D model isn't downloaded yet (procedural stand-in body)
    incidents: 'off', // B5: 'off' | 'occasional' | 'always' (caution orders, failed signals, alarm chain)
    spokenAnnouncements: false, // D1: speak a route-specific station announcement (browser speech) at halts
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
    if (!DIFFICULTY[merged.difficulty]) merged.difficulty = defaults.difficulty;
    if (!['auto', 'on', 'off'].includes(merged.kavach)) merged.kavach = 'auto'; // was an unused boolean
    if (!INCIDENT_MODES.includes(merged.incidents)) merged.incidents = defaults.incidents;
    merged.spokenAnnouncements = merged.spokenAnnouncements === true;
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
refreshJourneyCfg(initialSettings.difficulty);
const initialTrainCfg = trainCfgWithBanker(initialSettings.locomotive, initialSettings.coachLivery);
formation = formationFor(initialSettings.coachLivery, initialSettings.locomotive);

export const game = {
  // 'loading' | 'title' | 'playing' | 'paused' | 'confirmRestart' | 'completed'
  screen: 'loading',
  trainCfg: initialTrainCfg, // TRAIN + the chosen locomotive's figures
  banker: bankerFor(initialTrainCfg, initialSettings.coachLivery),
  train: newTrain(initialTrainCfg, initialSettings.coachLivery),
  journey: createJourney(),
  aiTrains: initAiTrains(),
  renderDistance: JOURNEY.startDistance, // smoothed distance used for drawing
  input: { leverUp: false, leverDown: false, brakeApply: false, brakeRelease: false, horn: false, sand: false },
  kavach: createKavach(), // ATP state (simulation/kavach.js)
  vcd: createVcd(), // vigilance control device (simulation/vcd.js)
  vcdAck: false, // set by the VCD button (V); consumed by the frame loop
  cameraMode: 'cab', // 'cab' | 'chase' | 'orbit' | 'trackside'
  headlight: true,
  cabLight: false, // the cab's ceiling lamp (K) — for night running
  settings: initialSettings,
  toast: null, // { text, until }
  fps: 0,
  renderScale: 1,
  resetVersion: 0, // bumps on restart so the frame loop can reset its timers
  routeId: activeRouteId,
  bests: loadBests(), // best score per route id
  locoModels: {}, // loco id → true once its GLB has loaded (Train.jsx)
  stats: createRunStats(), // energy, comfort and safety counters for the run card
  signalling: null, // live signal aspects (simulation/signalling.js), created per run
  incidents: createIncidentState(), // this run's incidents (simulation/incidents.js)
  runLimits: SPEED_LIMITS, // the route's speed limits + this run's caution order
  runRecord: null, // what the finished run changed in the personal records
  lesson: null, // driver school: { id, step, done } while a lesson is running
  pendingLesson: null, // lesson to start once the Delhi route has loaded
  schoolDone: loadSchool(), // ids of completed lessons
};

function loadSchool() {
  try {
    return JSON.parse(localStorage.getItem('brs-school') || '[]');
  } catch {
    return [];
  }
}
export function markLessonDone(id) {
  if (game.schoolDone.includes(id)) return;
  game.schoolDone = [...game.schoolDone, id];
  try {
    localStorage.setItem('brs-school', JSON.stringify(game.schoolDone));
  } catch {
    /* storage unavailable */
  }
}

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
  const route = speedLimitFor(game.runLimits ?? SPEED_LIMITS, train.routeDistance - formation.totalLength, train.routeDistance);
  return Math.min(route, incidentLimitAt(game.incidents, train.routeDistance), game.trainCfg?.locoMaxKmh ?? Infinity);
}

/** What the HUD shows about this run's incidents. */
function incidentSnapshot() {
  const inc = game.incidents;
  if (!inc) return null;
  const front = game.train.routeDistance;
  const out = {};
  if (inc.tsr && front < inc.tsr.to + 50) out.cautionOrder = { from: inc.tsr.from, to: inc.tsr.to, kmh: inc.tsr.kmh };
  if (inc.acp && (inc.acp.phase === 'venting' || inc.acp.phase === 'resetting')) out.acp = { phase: inc.acp.phase, coach: inc.acp.coach, left: inc.acp.resetLeft };
  if (inc.restriction) out.restriction = { kmh: inc.restriction.kmh, distance: inc.restriction.to - front };
  const f = inc.failedSignal;
  if (f && !f.passed && game.signalling) {
    const sig = game.signalling.up.find((x) => x.s === f.s);
    const d = sig.s - front;
    if (d > 0 && d < 1500) out.failedSignal = { name: sig.name, distance: d, waited: sig.failWaited, wait: sig.failWait, authorised: sig.authorised, codeSounded: f.codeSounded };
  }
  return out;
}

function publicSignal(sig) {
  return sig ? { name: sig.name, kind: sig.kind, aspect: sig.aspect, distance: sig.distance, held: sig.held } : null;
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
    nextLimit: nextSpeedLimit([...(game.runLimits ?? SPEED_LIMITS)].sort((a, b) => a.from - b.from), t.routeDistance, limit),
    incident: incidentSnapshot(),
    stoppingDistance: estimateStoppingDistance(t, game.trainCfg),
    screen: game.screen,
    speedKmh: t.speedMps * 3.6,
    throttle: t.throttle,
    brake: t.brake,
    brakeEffective: t.brakeEffective,
    direction: t.direction,
    directionLabel: DIRECTION_LABEL[t.direction],
    journeyState: game.journey.state,
    remaining: remainingDistance(t, journeyCfg, game.journey),
    progress: journeyProgress(t, JOURNEY),
    hint: difficultyFor(game.settings.difficulty).hints || game.journey.state === JOURNEY_STATE.READY ? journeyHint(game.journey, t, journeyCfg) : '',
    nextStop: currentStop(game.journey, journeyCfg),
    stopIndex: game.journey.stopIndex,
    dwell: game.journey.state === JOURNEY_STATE.DWELL ? Math.max(0, game.journey.dwellTimer) : null,
    grade: t.grade ?? 0,
    banker: game.banker?.label ?? null,
    routeId: game.routeId,
    bests: game.bests,
    locoModels: game.locoModels,
    difficulty: game.settings.difficulty,
    stats: game.screen === 'completed' ? summarizeRunStats(game.stats) : null,
    runRecord: game.runRecord,
    kavachOn: kavachActive(),
    kavach: { state: game.kavach.state, permitted: game.kavach.permittedKmh, target: game.kavach.target },
    vcdOn: difficultyFor(game.settings.difficulty).vcd,
    vcd: { phase: game.vcd.phase, left: vcdSecondsLeft(game.vcd) },
    adhesionOn: difficultyFor(game.settings.difficulty).adhesion,
    slipping: !!t.slipping,
    sanding: !!game.input.sand,
    stoppingHud: difficultyFor(game.settings.difficulty).stoppingHud,
    signal: game.signalling ? publicSignal(findNextSignal(game.signalling, t.routeDistance)) : null,
    lesson: game.lesson ? { id: game.lesson.id, step: game.lesson.step, done: game.lesson.done } : null,
    schoolDone: game.schoolDone,
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
    incidentsVersion: game.incidentsVersion ?? 0,
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
  pauseAnnouncements(screen !== 'playing');
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
        if (game.screen === 'loading') afterLoad();
      }, minLoadingTime - elapsed);
    } else {
      afterLoad();
    }
  }
}

function afterLoad() {
  if (game.pendingLesson) {
    const id = game.pendingLesson;
    game.pendingLesson = null;
    startLesson(id);
  } else setScreen('title');
}

/**
 * Driver school: lessons run on the Delhi route. Places the train as the
 * lesson needs (position, speed, brakes released) and starts the guide.
 */
export function startLesson(id) {
  const lesson = lessonById(id);
  if (!lesson) return;
  if (game.routeId !== 'ndls-gzb') {
    game.pendingLesson = id;
    selectRoute('ndls-gzb');
    return;
  }
  startJourney();
  const t = game.train;
  const { s, kmh, released } = lesson.setup;
  t.routeDistance = t.previousRouteDistance = s;
  game.renderDistance = s;
  t.speedMps = kmh / 3.6;
  if (released) {
    t.brakeHandle = 0;
    t.bp = game.trainCfg.bpNormal;
    t.bc = 0;
    t.brakeSignal = 0;
  }
  if (kmh > 0) game.journey.state = JOURNEY_STATE.RUNNING;
  game.lesson = createLessonState(id);
  game.cameraMode = 'cab';
  publish();
}
export function endLesson() {
  game.lesson = null;
  publish();
}

export function resetJourney() {
  game.trainCfg = trainCfgWithBanker(game.settings.locomotive, game.settings.coachLivery);
  game.banker = bankerFor(game.trainCfg, game.settings.coachLivery);
  game.newBest = false;
  game.runRecord = null;
  game.lesson = null;
  game.stats = createRunStats();
  // a fresh random seed per run decides which home signals are held at danger
  game.signalling = createSignalling(ROUTE, { seed: (Math.random() * 1e9) | 0, holdChance: 0.35 });
  // B5 incidents (off by default): a caution order, a failed automatic signal, the alarm chain
  const consist = consistFor(game.settings.coachLivery);
  game.incidents = planIncidents(ROUTE, {
    seed: (Math.random() * 1e9) | 0,
    mode: game.settings.incidents,
    passenger: !!consist.passenger,
    coachCount: consist.count,
    night: game.settings.timeOfDay === 'night',
    autoSignals: game.signalling.up.filter((x) => x.kind === 'auto'),
    blocked: (s) => !!tunnelAt(s, 15) || !!bridgeAt(s, 15),
  });
  if (game.incidents.failedSignal) failSignal(game.signalling, game.incidents.failedSignal.s, game.incidents.failedSignal.waitS);
  game.runLimits = runSpeedLimits(SPEED_LIMITS, game.incidents);
  game.incidentsVersion = (game.incidentsVersion ?? 0) + 1;
  game.kavach = createKavach();
  game.vcd = createVcd();
  game.vcdAck = false;
  game.train = newTrain();
  game.journey = createJourney();
  game.aiTrains = initAiTrains();
  game.renderDistance = game.train.routeDistance;
  game.toast = null;
  stopAnnouncements();
  audioEngine.setBuzzer(false, 'acp');
  game.resetVersion++;
}

export function startJourney() {
  audioEngine.init(); // must happen inside a click: browsers block audio until a user gesture
  audioEngine.setVolume(game.settings.volume, game.settings.muted);
  resetJourney();
  records.noteStarted();
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

function recordKey() {
  const st = game.settings;
  return records.keyFor({ route: game.routeId, loco: st.locomotive, consist: st.coachLivery, difficulty: st.difficulty });
}

export function completeJourney() {
  const result = game.journey.result;
  const score = result?.score;
  game.newBest = score !== undefined && !result.failed && saveBest(game.routeId, score);
  if (result) result.incidents = summarizeIncidents(game.incidents);
  if (result) game.runRecord = { ...records.recordRun(recordKey(), result, game.stats), entry: records.entry(recordKey()) };
  setScreen('completed');
}

/**
 * End the run early (a signal passed at danger on Realistic). The run card
 * shows why; the run is logged but never becomes a record.
 */
export function failJourney(reason) {
  const j = game.journey;
  if (j.state === JOURNEY_STATE.COMPLETED) return;
  j.state = JOURNEY_STATE.COMPLETED;
  j.result = {
    failed: true,
    reason,
    elapsed: j.elapsed,
    maxSpeedKmh: game.train.maxSpeedReachedMps * 3.6,
    stopOffset: 0,
    stopRating: '—',
    overspeedSeconds: j.overspeedSeconds,
    maxOverspeedKmh: j.maxOverspeedKmh,
    emergencyUsed: j.emergencyUsed,
    stops: j.stopResults.map((r) => ({ ...r })),
    missedStops: j.stopResults.filter((r) => r.missed).length,
    earlyDepartures: j.earlyDepartures,
    scheduled: null,
    lateSeconds: 0,
    score: 0,
  };
  completeJourney();
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
  refreshJourneyCfg(game.settings.difficulty);
  resetJourney();
  loadStart = Date.now();
  setScreen('loading');
}

/** Photo mode: the run freezes, the HUD hides and a free camera takes over. */
export function enterPhotoMode() {
  if (game.screen !== 'playing' && game.screen !== 'paused') return;
  setScreen('photo');
}
export function exitPhotoMode() {
  if (game.screen === 'photo') setScreen('playing');
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

/** VCD acknowledge button (V): resets the vigilance timer, or the device after a penalty. */
export function acknowledgeVcd() {
  game.vcdAck = true;
  audioEngine.playClick('switch');
}

export function toggleCabLight() {
  game.cabLight = !game.cabLight;
  audioEngine.playClick('switch');
  showToast(game.cabLight ? 'Cab light on' : 'Cab light off', 1200);
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
  if (prev.coachLivery !== game.settings.coachLivery || prev.locomotive !== game.settings.locomotive) {
    formation = formationFor(game.settings.coachLivery, game.settings.locomotive);
    const c = consistFor(game.settings.coachLivery);
    game.train.mass = trainMass(game.trainCfg, c.count);
    game.train.minDistance = formation.totalLength + 5;
    // a freight train has no coach to sit in or doorway to stand in
    if (!c.passenger && (game.cameraMode === 'interior' || game.cameraMode === 'door')) game.cameraMode = 'cab';
  }
  if (prev.difficulty !== game.settings.difficulty) refreshJourneyCfg(game.settings.difficulty);
  audioEngine.setVolume(game.settings.volume, game.settings.muted);
  saveSettings();
  publish();
}

/** Train.jsx reports which loco models exist, so the pickers can offer them. */
export function setLocoModelAvailable(id, ok) {
  if (game.locoModels[id] === ok) return;
  game.locoModels = { ...game.locoModels, [id]: ok };
  publish();
}

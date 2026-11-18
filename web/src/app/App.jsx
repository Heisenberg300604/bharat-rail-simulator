import GameCanvas from '../game/GameCanvas.jsx';
import { useGameSnapshot, game, publish, route, selectRoute, startJourney, setCamera, updateSettings } from '../game/state/gameStore.js';
import { useKeyboardControls } from '../game/hooks/useKeyboardControls.js';
import StartScreen from '../ui/StartScreen.jsx';
import LoadingScreen from '../ui/LoadingScreen.jsx';
import HUD from '../ui/HUD.jsx';
import PauseMenu from '../ui/PauseMenu.jsx';
import RestartConfirm from '../ui/RestartConfirm.jsx';
import JourneyComplete from '../ui/JourneyComplete.jsx';
import PhotoMode from '../ui/PhotoMode.jsx';
import LessonPanel from '../ui/LessonPanel.jsx';
import { sceneRefs } from '../game/state/sceneRefs.js';
import { audioEngine } from '../game/audio/audioEngine.js';
import * as gameConfig from '../game/config/gameConfig.js';

// Development-only helper for testing in the browser console, e.g.
//   __BRS__.teleport(7300, 40)   → jump 7.3 km down the line at 40 km/h
//   __BRS__.selectRoute('pamban') → switch route
if (import.meta.env.DEV) {
  window.__BRS__ = {
    game,
    get route() {
      return route;
    },
    selectRoute,
    startJourney,
    updateSettings,
    cfg: gameConfig, // live route data (STATIONS, ROUTE, AI_TRAINS…)
    setCamera,
    sceneRefs,
    audioEngine,
    teleport(distance, kmh = 0) {
      game.train.routeDistance = game.train.previousRouteDistance = distance;
      game.train.speedMps = kmh / 3.6;
      publish();
    },
    /**
     * Fixed debug camera in route coordinates (for repeatable screenshots):
     * __BRS__.view(s, lat, height, lookS, lookLat, lookHeight); __BRS__.view(null) releases it.
     * Heights are above the ground at that spot.
     */
    view(s, lat = 0, h = 20, ts = s + 200, tlat = 0, th = 0) {
      if (s == null) {
        sceneRefs.debugCam = null;
        return;
      }
      const g = (ss, ll) => window.__BRS__.terrain?.groundY(ss, ll) ?? 0;
      const a = route.sample(s, {});
      const b = route.sample(ts, {});
      sceneRefs.debugCam = {
        pos: [a.x + a.lx * lat, g(s, lat) + h, a.z + a.lz * lat],
        look: [b.x + b.lx * tlat, g(ts, tlat) + th, b.z + b.lz * tlat],
      };
    },
    /** Draw calls and triangles of the last frame. */
    stats() {
      const i = sceneRefs.gl?.info.render;
      return i && { calls: i.calls, triangles: i.triangles };
    },
  };
  import('../game/world/terrain.js').then((m) => {
    Object.defineProperty(window.__BRS__, 'terrain', { get: () => m.terrain, configurable: true });
  });
}

export default function App() {
  useKeyboardControls();
  const s = useGameSnapshot();
  const inGame = s.screen === 'playing' || s.screen === 'paused' || s.screen === 'confirmRestart' || s.screen === 'completed';

  return (
    <div className="app">
      <GameCanvas />
      {s.screen === 'loading' && <LoadingScreen />}
      {s.screen === 'title' && <StartScreen settings={s.settings} bests={s.bests} routeId={s.routeId} schoolDone={s.schoolDone} locoModels={s.locoModels} />}
      {inGame && <HUD s={s} />}
      {s.lesson && (s.screen === 'playing' || s.screen === 'paused') && <LessonPanel lesson={s.lesson} />}
      {s.screen === 'paused' && <PauseMenu settings={s.settings} locoModels={s.locoModels} />}
      {s.screen === 'photo' && <PhotoMode settings={s.settings} />}
      {s.screen === 'confirmRestart' && <RestartConfirm />}
      {s.screen === 'completed' && <JourneyComplete result={s.result} stats={s.stats} record={s.runRecord} settings={s.settings} />}
    </div>
  );
}

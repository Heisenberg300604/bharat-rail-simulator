import GameCanvas from '../game/GameCanvas.jsx';
import { useGameSnapshot, game, publish, route, selectRoute, startJourney, setCamera } from '../game/state/gameStore.js';
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
    setCamera,
    sceneRefs,
    audioEngine,
    teleport(distance, kmh = 0) {
      game.train.routeDistance = game.train.previousRouteDistance = distance;
      game.train.speedMps = kmh / 3.6;
      publish();
    },
  };
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

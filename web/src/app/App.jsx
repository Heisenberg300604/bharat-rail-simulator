import GameCanvas from '../game/GameCanvas.jsx';
import { useGameSnapshot, game, publish, route } from '../game/state/gameStore.js';
import { useKeyboardControls } from '../game/hooks/useKeyboardControls.js';
import StartScreen from '../ui/StartScreen.jsx';
import LoadingScreen from '../ui/LoadingScreen.jsx';
import HUD from '../ui/HUD.jsx';
import PauseMenu from '../ui/PauseMenu.jsx';
import RestartConfirm from '../ui/RestartConfirm.jsx';
import JourneyComplete from '../ui/JourneyComplete.jsx';
import { sceneRefs } from '../game/state/sceneRefs.js';
import { audioEngine } from '../game/audio/audioEngine.js';

// Development-only helper for testing in the browser console, e.g.
//   __BRS__.teleport(7300, 40)   → jump near Ghaziabad at 40 km/h
if (import.meta.env.DEV) {
  window.__BRS__ = {
    game,
    route,
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
      {s.screen === 'title' && <StartScreen settings={s.settings} />}
      {inGame && <HUD s={s} />}
      {s.screen === 'paused' && <PauseMenu settings={s.settings} />}
      {s.screen === 'confirmRestart' && <RestartConfirm />}
      {s.screen === 'completed' && <JourneyComplete result={s.result} />}
    </div>
  );
}

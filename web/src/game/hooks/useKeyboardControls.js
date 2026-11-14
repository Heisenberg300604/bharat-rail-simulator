// Keyboard → game input. Held keys set flags in game.input that the simulation
// reads every step; single-press keys call store actions.
import { useEffect } from 'react';
import {
  game,
  togglePause,
  requestRestart,
  confirmRestart,
  cancelRestart,
  toggleCamera,
  toggleHeadlight,
  toggleCabLight,
  acknowledgeVcd,
  cycleDirection,
  emergencyBrake,
  setCamera,
  releaseAllInputs,
  publish,
  enterPhotoMode,
  exitPhotoMode,
} from '../state/gameStore.js';
import { photoKeys } from '../components/Cameras/photoInput.js';

// e.code is the physical key, so this works on non-QWERTY layouts too.
const HELD_KEYS = {
  KeyW: 'leverUp',
  ArrowUp: 'leverUp',
  KeyS: 'leverDown',
  ArrowDown: 'leverDown',
  Space: 'brakeApply',
  KeyX: 'brakeRelease',
  KeyH: 'horn',
  KeyB: 'sand', // sander (foot switch on the real loco)
};

const PRESS_KEYS = {
  KeyF: cycleDirection,
  KeyL: toggleHeadlight,
  KeyK: toggleCabLight,
  KeyV: acknowledgeVcd,
  KeyC: toggleCamera,
  KeyR: requestRestart,
  KeyE: emergencyBrake,
  Backspace: emergencyBrake,
  Digit1: () => setCamera('cab'),
  Digit2: () => setCamera('interior'),
  Digit3: () => setCamera('door'),
  Digit4: () => setCamera('rear'),
  Digit5: () => setCamera('orbit'),
  Digit6: () => setCamera('trackside'),
};

export function useKeyboardControls() {
  useEffect(() => {
    function onKeyDown(e) {
      // Let form controls (e.g. the volume slider) keep their own keys.
      const tag = e.target?.tagName;
      const inForm = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';

      if (game.screen === 'photo') {
        if (e.code === 'Escape' || e.code === 'KeyP') {
          exitPhotoMode();
          e.preventDefault();
          return;
        }
        if (!inForm && e.code in photoKeys) {
          photoKeys[e.code] = true;
          e.preventDefault();
        }
        return;
      }
      if (e.code === 'KeyP' && !inForm && (game.screen === 'playing' || game.screen === 'paused')) {
        enterPhotoMode();
        e.preventDefault();
        return;
      }

      if (e.code === 'Escape') {
        if (game.screen === 'confirmRestart') cancelRestart();
        else togglePause();
        e.preventDefault();
        return;
      }

      if (game.screen === 'confirmRestart') {
        if (e.code === 'Enter' || e.code === 'KeyY') confirmRestart();
        if (e.code === 'KeyN') cancelRestart();
        return;
      }

      if (game.screen === 'completed' && e.code === 'KeyR') {
        requestRestart();
        return;
      }

      if (game.screen !== 'playing' || inForm) return;

      const held = HELD_KEYS[e.code];
      if (held) {
        e.preventDefault(); // stop Space/arrows scrolling the page
        if (!game.input[held]) {
          game.input[held] = true;
          if (held === 'horn') publish();
        }
        return;
      }
      const action = PRESS_KEYS[e.code];
      if (action && !e.repeat) {
        e.preventDefault();
        action();
      }
    }

    function onKeyUp(e) {
      if (e.code in photoKeys) photoKeys[e.code] = false;
      const held = HELD_KEYS[e.code];
      if (held && game.input[held]) {
        game.input[held] = false;
        if (held === 'horn') publish();
      }
    }

    // If the window loses focus we never get keyup, so release everything
    // (otherwise the horn or throttle could get "stuck").
    function onBlur() {
      releaseAllInputs();
      publish();
    }
    function onVisibility() {
      if (document.hidden && game.screen === 'playing') togglePause();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
}

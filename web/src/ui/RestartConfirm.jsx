import { confirmRestart, cancelRestart } from '../game/state/gameStore.js';

export default function RestartConfirm() {
  return (
    <div className="overlay">
      <div className="panel panel--small" role="alertdialog" aria-label="Restart journey?">
        <h2>Restart journey?</h2>
        <p>The train will return to New Delhi and your progress will be lost.</p>
        <div className="menu-buttons menu-buttons--row">
          <button className="btn btn--primary" onClick={confirmRestart} autoFocus>
            Restart <kbd>Y</kbd>
          </button>
          <button className="btn" onClick={cancelRestart}>
            Cancel <kbd>N</kbd>
          </button>
        </div>
      </div>
    </div>
  );
}

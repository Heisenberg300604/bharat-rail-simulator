import { togglePause, requestRestart, returnToTitle, updateSettings } from '../game/state/gameStore.js';
import { QUALITY_PRESETS } from '../game/config/gameConfig.js';
import ControlsTable from './ControlsTable.jsx';

export default function PauseMenu({ settings }) {
  return (
    <div className="overlay">
      <div className="panel panel--menu" role="dialog" aria-label="Paused">
        <h2>Paused</h2>
        <div className="menu-buttons">
          <button className="btn btn--primary" onClick={togglePause} autoFocus>
            Resume
          </button>
          <button className="btn" onClick={requestRestart}>
            Restart journey
          </button>
          <button className="btn" onClick={returnToTitle}>
            Return to title
          </button>
        </div>

        <div className="settings">
          <label className="setting">
            <span>Volume</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.volume}
              onChange={(e) => updateSettings({ volume: Number(e.target.value) })}
            />
            <span className="num">{Math.round(settings.volume * 100)}%</span>
          </label>
          <label className="setting setting--check">
            <input type="checkbox" checked={settings.muted} onChange={(e) => updateSettings({ muted: e.target.checked })} />
            <span>Mute</span>
          </label>
          <label className="setting">
            <span>Graphics</span>
            <select value={settings.quality} onChange={(e) => updateSettings({ quality: e.target.value })}>
              {Object.entries(QUALITY_PRESETS).map(([id, q]) => (
                <option key={id} value={id}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
          <label className="setting">
            <span>Coaches</span>
            <select value={settings.coachLivery} onChange={(e) => updateSettings({ coachLivery: e.target.value })}>
              <option value="icfBlue">Classic Blue ICF</option>
              <option value="red">Red-grey LHB</option>
              <option value="blue">Blue-grey LHB</option>
            </select>
          </label>
          <label className="setting">
            <span>Field of view</span>
            <input type="range" min="50" max="90" step="1" value={settings.fov} onChange={(e) => updateSettings({ fov: Number(e.target.value) })} />
            <span className="num">{settings.fov}°</span>
          </label>
          <label className="setting setting--check">
            <input type="checkbox" checked={settings.showFps} onChange={(e) => updateSettings({ showFps: e.target.checked })} />
            <span>Show FPS</span>
          </label>
        </div>

        <h3>Controls</h3>
        <ControlsTable />
      </div>
    </div>
  );
}

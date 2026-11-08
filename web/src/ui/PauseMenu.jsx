import { useEffect, useState } from 'react';
import { HORN_INDEX_URL } from '../game/audio/audioManifest.js';
import { togglePause, requestRestart, returnToTitle, updateSettings } from '../game/state/gameStore.js';
import { QUALITY_PRESETS, LOCOMOTIVES, CONSISTS } from '../game/config/gameConfig.js';
import ControlsTable from './ControlsTable.jsx';
import EnvironmentPicker from './EnvironmentPicker.jsx';

/** The horn library (public/assets/audio/horns/horns.json), loaded once for the picker. */
let hornListCache = null;
function useHornList() {
  const [list, setList] = useState(hornListCache ?? []);
  useEffect(() => {
    if (hornListCache) return;
    fetch(HORN_INDEX_URL)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => {
        hornListCache = (Array.isArray(d) ? d : d.horns ?? []).filter((h) => h.kind !== 'distant');
        setList(hornListCache);
      })
      .catch(() => setList([]));
  }, []);
  return list;
}

export default function PauseMenu({ settings }) {
  const horns = useHornList();
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

        <EnvironmentPicker settings={settings} />
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
            <span>Background sounds</span>
            <select value={settings.ambience ?? 'occasional'} onChange={(e) => updateSettings({ ambience: e.target.value })}>
              <option value="occasional">Occasional (comes and goes)</option>
              <option value="always">Always</option>
              <option value="off">Off</option>
            </select>
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
            <span>Locomotive</span>
            <select value={settings.locomotive} onChange={(e) => updateSettings({ locomotive: e.target.value })}>
              {Object.entries(LOCOMOTIVES).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="setting">
            <span>Horn (H)</span>
            <select value={settings.horn ?? 'auto'} onChange={(e) => updateSettings({ horn: e.target.value })}>
              <option value="auto">Locomotive's own horns</option>
              {horns.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.label ?? `${h.loco ?? 'Horn'} · ${h.tone ?? ''}`.trim()}
                </option>
              ))}
            </select>
          </label>
          <label className="setting">
            <span>Coaches</span>
            <select value={settings.coachLivery} onChange={(e) => updateSettings({ coachLivery: e.target.value })}>
              {Object.entries(CONSISTS).map(([id, c]) => (
                <option key={id} value={id}>
                  {c.label}
                </option>
              ))}
            </select>
          </label>
          <label className="setting">
            <span>Field of view</span>
            <input type="range" min="50" max="90" step="1" value={settings.fov} onChange={(e) => updateSettings({ fov: Number(e.target.value) })} />
            <span className="num">{settings.fov}°</span>
          </label>
          <label className="setting setting--check">
            <input type="checkbox" checked={settings.crowd} onChange={(e) => updateSettings({ crowd: e.target.checked })} />
            <span>People on platforms</span>
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

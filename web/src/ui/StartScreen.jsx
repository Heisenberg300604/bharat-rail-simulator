import { startJourney, updateSettings, origin, destination } from '../game/state/gameStore.js';
import { QUALITY_PRESETS } from '../game/config/gameConfig.js';
import ControlsTable from './ControlsTable.jsx';

export default function StartScreen({ settings }) {
  return (
    <div className="overlay overlay--title">
      <div className="panel panel--title">
        <p className="eyebrow">Web MVP · Test route</p>
        <h1>
          Bharat Rail Simulator
          <span className="title-hindi">भारत रेल सिम्युलेटर</span>
        </h1>
        <p className="route-line">
          {origin.name} <span aria-hidden>→</span> {destination.name}
        </p>
        <button className="btn btn--primary" onClick={startJourney} autoFocus>
          Start Journey
        </button>
        <div className="title-settings">
          <label>
            Graphics
            <select value={settings.quality} onChange={(e) => updateSettings({ quality: e.target.value })}>
              {Object.entries(QUALITY_PRESETS).map(([id, q]) => (
                <option key={id} value={id}>
                  {q.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h2>Controls</h2>
        <ControlsTable />
        <p className="disclaimer">
          A short, fictional test route — not a geographically accurate recreation. An independent hobby project, not
          affiliated with or endorsed by Indian Railways.
        </p>
      </div>
    </div>
  );
}

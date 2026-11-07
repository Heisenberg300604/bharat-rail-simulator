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
          <label>
            Coaches
            <select value={settings.coachLivery} onChange={(e) => updateSettings({ coachLivery: e.target.value })}>
              <option value="red">Red-grey LHB (standard)</option>
              <option value="blue">Blue-grey LHB</option>
            </select>
          </label>
        </div>
        <h2>Controls</h2>
        <ControlsTable />
        <p className="disclaimer">
          A short, fictional test route — not a geographically accurate recreation. An independent hobby project, not
          affiliated with or endorsed by Indian Railways.
        </p>
        <p className="disclaimer credits">
          WAP-7 3D model:{' '}
          <a href="https://sketchfab.com/3d-models/wap-7-indian-locomotive-low-poly-model-1935cec9ac9446e3b2524ad73f0902a4" target="_blank" rel="noreferrer">
            “WAP 7 Indian Locomotive Low Poly model”
          </a>{' '}
          by knitro_builds, licensed under{' '}
          <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>{' '}
          (optimised for the web). Horn:{' '}
          <a href="https://freesound.org/s/248229/" target="_blank" rel="noreferrer">
            “Train Horn”
          </a>{' '}
          by CouleurCasquette, CC BY 3.0. Other sounds CC0 from Freesound; full list in docs/ASSET_CREDITS.md.
        </p>
      </div>
    </div>
  );
}

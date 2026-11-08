import { startJourney, updateSettings, origin, destination } from '../game/state/gameStore.js';
import { QUALITY_PRESETS, LOCOMOTIVES, CONSISTS } from '../game/config/gameConfig.js';
import ControlsTable from './ControlsTable.jsx';
import EnvironmentPicker from './EnvironmentPicker.jsx';

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
        <EnvironmentPicker settings={settings} />
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
            Locomotive
            <select value={settings.locomotive} onChange={(e) => updateSettings({ locomotive: e.target.value })}>
              {Object.entries(LOCOMOTIVES).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Coaches
            <select value={settings.coachLivery} onChange={(e) => updateSettings({ coachLivery: e.target.value })}>
              {Object.entries(CONSISTS).map(([id, c]) => (
                <option key={id} value={id}>
                  {c.label}
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
        <p className="disclaimer credits">
          WAP-7 3D model:{' '}
          <a href="https://sketchfab.com/3d-models/wap-7-indian-locomotive-low-poly-model-1935cec9ac9446e3b2524ad73f0902a4" target="_blank" rel="noreferrer">
            “WAP 7 Indian Locomotive Low Poly model”
          </a>{' '}
          by knitro_builds, licensed under{' '}
          <a href="http://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>{' '}
          (optimised for the web). WAG-9 3D model:{' '}
          <a href="https://sketchfab.com/3d-models/wag-9-indian-locomotive-lowpoly-count-665150d63c6146e0b361c1020a87074e" target="_blank" rel="noreferrer">
            “Wag 9 Indian Locomotive Lowpoly count”
          </a>{' '}
          by knitro_vedant, CC BY 4.0 (optimised). Horn:{' '}
          <a href="https://freesound.org/s/248229/" target="_blank" rel="noreferrer">
            “Train Horn”
          </a>{' '}
          by CouleurCasquette, CC BY 3.0. Sounds also by Calcuttan (birds), Zabuhailo, KrystofJakobe, Anton and Garuda1982 on
          Freesound (CC BY 4.0/3.0), and Village Regional and Vijay Singh Choudhary on Wikimedia Commons (CC BY 3.0); all other
          sounds CC0. Full list in docs/ASSET_CREDITS.md.
        </p>
      </div>
    </div>
  );
}

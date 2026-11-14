// Title screen: pick a route (left), see it and set up the run (middle),
// start. How to play, settings and credits live behind buttons in the footer
// so the screen stays clean; the 3D scene behind shows the chosen route.
import { useEffect, useState } from 'react';
import { startJourney, updateSettings } from '../game/state/gameStore.js';
import { QUALITY_PRESETS, LOCOMOTIVES, CONSISTS, ROUTE } from '../game/config/gameConfig.js';
import ControlsTable from './ControlsTable.jsx';
import EnvironmentPicker from './EnvironmentPicker.jsx';
import { RouteList, RouteDetail } from './RoutePicker.jsx';

function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);
  return (
    <div className="modal" role="dialog" aria-label={title} onClick={onClose}>
      <div className={`modal__card ${wide ? 'modal__card--wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="modal__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close" autoFocus>
            ✕
          </button>
        </div>
        <div className="modal__body">{children}</div>
      </div>
    </div>
  );
}

function HowToPlay() {
  const steps = [
    ['Release the brakes', 'Hold X until the brake pipe (BP) recharges to 5.0 kg/cm². Traction is cut below 4.75.'],
    ['Power up', 'Hold W to notch up the TE/BE lever. S notches down, then into regenerative braking.'],
    ['Respect the limits', 'The sign by the speedometer is the limit; it holds until your last coach has passed.'],
    ['Plan the stop', 'Watch "Full-service stop" on the HUD: from 110 km/h you need about a kilometre.'],
    ['Stop at the marker', 'Bring the loco into the green zone by the STOP board and hold for 3 s.'],
    ['At halts, wait', 'Keep the brakes on until the guard’s whistle (right away), then go. Be on time!'],
  ];
  return (
    <>
      <ol className="howto">
        {steps.map(([h, t], i) => (
          <li key={h}>
            <span className="howto__n">{i + 1}</span>
            <div>
              <strong>{h}</strong>
              <p>{t}</p>
            </div>
          </li>
        ))}
      </ol>
      <h3>Controls</h3>
      <ControlsTable />
      <p className="modal__note">Gradients matter: on the Bhor Ghat (1 in 37) heavy freight trains get two banking locomotives pushing from the rear.</p>
    </>
  );
}

function Settings({ settings }) {
  return (
    <div className="settings">
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
        <span>Volume</span>
        <input type="range" min="0" max="1" step="0.05" value={settings.volume} onChange={(e) => updateSettings({ volume: Number(e.target.value) })} />
        <span className="num">{Math.round(settings.volume * 100)}%</span>
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
      <p className="modal__note">More options (horn, mute) are in the pause menu (Esc) while driving.</p>
    </div>
  );
}

function About() {
  return (
    <div className="about">
      <p>
        Every route is a short, condensed segment inspired by a real Indian line — fictional in its detail, not a geographically accurate recreation. An
        independent hobby project, not affiliated with or endorsed by Indian Railways.
      </p>
      <p className="credits">
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
        by CouleurCasquette, CC BY 3.0. Sounds also by Calcuttan (birds), Zabuhailo, KrystofJakobe, Anton and Garuda1982 on Freesound (CC BY 4.0/3.0), and Village
        Regional and Vijay Singh Choudhary on Wikimedia Commons (CC BY 3.0); all other sounds CC0. Full list in docs/ASSET_CREDITS.md.
      </p>
    </div>
  );
}

export default function StartScreen({ settings, bests, routeId }) {
  const [modal, setModal] = useState(null);
  const freightOnGhat = ROUTE.banker && CONSISTS[settings.coachLivery]?.passenger === false;
  return (
    <div className="overlay overlay--title">
      <div className="title-screen">
        <header className="title-brand">
          <h1>
            Bharat Rail Simulator <span className="title-hindi">भारत रेल सिम्युलेटर</span>
          </h1>
          <p className="eyebrow">Drive famous routes of Indian Railways</p>
        </header>

        <div className="title-grid">
          <section className="title-col">
            <h3>Choose a route</h3>
            <RouteList bests={bests} current={routeId} />
          </section>

          <section className="title-col title-col--detail">
            <RouteDetail r={ROUTE} settings={settings} best={bests[routeId]} />
            <div className="setup">
              <div className="setup__row">
                <label>
                  <span>Locomotive</span>
                  <select value={settings.locomotive} onChange={(e) => updateSettings({ locomotive: e.target.value })}>
                    {Object.entries(LOCOMOTIVES).map(([id, l]) => (
                      <option key={id} value={id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Train</span>
                  <select value={settings.coachLivery} onChange={(e) => updateSettings({ coachLivery: e.target.value })}>
                    {Object.entries(CONSISTS).map(([id, c]) => (
                      <option key={id} value={id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {freightOnGhat && <p className="setup__note">Two WAG-9 bankers will push from the rear up the ghat.</p>}
              <EnvironmentPicker settings={settings} />
              <button className="btn btn--primary btn--start" onClick={startJourney} autoFocus>
                Start journey <span aria-hidden>▶</span>
              </button>
            </div>
          </section>
        </div>

        <footer className="title-footer">
          <button className="btn btn--ghost" onClick={() => setModal('how')}>
            ⌨ How to play
          </button>
          <button className="btn btn--ghost" onClick={() => setModal('settings')}>
            ⚙ Settings
          </button>
          <button className="btn btn--ghost" onClick={() => setModal('about')}>
            ⓘ About &amp; credits
          </button>
        </footer>
      </div>

      {modal === 'how' && (
        <Modal title="How to play" onClose={() => setModal(null)} wide>
          <HowToPlay />
        </Modal>
      )}
      {modal === 'settings' && (
        <Modal title="Settings" onClose={() => setModal(null)}>
          <Settings settings={settings} />
        </Modal>
      )}
      {modal === 'about' && (
        <Modal title="About & credits" onClose={() => setModal(null)}>
          <About />
        </Modal>
      )}
    </div>
  );
}

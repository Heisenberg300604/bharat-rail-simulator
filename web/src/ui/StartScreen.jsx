// Title screen: pick a route (left), see it and set up the run (middle),
// start. How to play, settings and credits live behind buttons in the footer
// so the screen stays clean; the 3D scene behind shows the chosen route.
import { useEffect, useState } from 'react';
import { startJourney, updateSettings, records, startLesson } from '../game/state/gameStore.js';
import { LESSONS } from '../game/simulation/driverSchool.js';
import { QUALITY_PRESETS, LOCOMOTIVES, CONSISTS, pickableLocos, ROUTE, DIFFICULTY, difficultyFor } from '../game/config/gameConfig.js';
import { routeSummaries } from '../game/routes/activeRoute.js';
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
        <span>Kavach (ATP)</span>
        <select value={settings.kavach ?? 'auto'} onChange={(e) => updateSettings({ kavach: e.target.value })}>
          <option value="auto">Follow difficulty ({difficultyFor(settings.difficulty).kavach ? 'on' : 'off'})</option>
          <option value="on">Always on</option>
          <option value="off">Off (purist)</option>
        </select>
      </label>
      <label className="setting">
        <span>Incidents</span>
        <select value={settings.incidents ?? 'off'} onChange={(e) => updateSettings({ incidents: e.target.value })}>
          <option value="off">Off</option>
          <option value="occasional">Occasional (about one run in two)</option>
          <option value="always">Every run (practice)</option>
        </select>
      </label>
      <p className="modal__note">Incidents: a caution order for track work, an automatic signal failed at danger (GR 9.02), or the alarm chain pulled. Each follows the rulebook, and the HUD tells you the procedure.</p>
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
        <input type="checkbox" checked={!!settings.spokenAnnouncements} onChange={(e) => updateSettings({ spokenAnnouncements: e.target.checked })} />
        <span>Spoken station announcements ("Yatrigan kripya dhyan dein…", Hindi + English, uses your browser's voices)</span>
      </label>
      <label className="setting setting--check">
        <input type="checkbox" checked={settings.showFps} onChange={(e) => updateSettings({ showFps: e.target.checked })} />
        <span>Show FPS</span>
      </label>
      <label className="setting setting--check">
        <input type="checkbox" checked={!!settings.showStandIns} onChange={(e) => updateSettings({ showStandIns: e.target.checked })} />
        <span>Show locos still waiting for their 3D model (WAP-5, WAP-4 — stand-in body, real physics)</span>
      </label>
      <p className="modal__note">More options (horn, mute) are in the pause menu (Esc) while driving.</p>
    </div>
  );
}

/** Personal bests per route and the lifetime driving log (all stored in this browser). */
function Records() {
  const d = records.data;
  const log = d.log;
  const rows = routeSummaries().map((r) => {
    const entries = Object.entries(d.runs).filter(([k]) => k.startsWith(`${r.id}|`));
    const best = entries.reduce((b, [, e]) => (e.bestScore > (b?.bestScore ?? -1) ? e : b), null);
    const runs = entries.reduce((n, [, e]) => n + e.runs, 0);
    return { r, best, runs };
  });
  return (
    <div className="records">
      <dl className="route-detail__stats">
        <div>
          <dt>Runs</dt>
          <dd className="num">
            {log.completed}/{log.started}
          </dd>
        </div>
        <div>
          <dt>Distance</dt>
          <dd className="num">{log.km.toFixed(1)} km</dd>
        </div>
        <div>
          <dt>Energy</dt>
          <dd className="num">{log.kWh.toFixed(0)} kWh</dd>
        </div>
        <div>
          <dt>SPADs</dt>
          <dd className="num">{log.spads}</dd>
        </div>
      </dl>
      <table className="halts">
        <thead>
          <tr>
            <th>Route</th>
            <th>Runs</th>
            <th>Best</th>
            <th>Best stop</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, best, runs }) => (
            <tr key={r.id}>
              <td>{r.meta.shortName}</td>
              <td className="num">{runs}</td>
              <td className="num">{best?.bestScore ?? '—'}</td>
              <td className="num">{best?.bestStopCm !== undefined ? `${best.bestStopCm} cm` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="modal__note">Records are kept in this browser only (localStorage). Nothing is uploaded.</p>
    </div>
  );
}

/** Driver school: the lessons, with a tick for each one completed. */
function School({ done, onStart }) {
  return (
    <div className="school">
      <p className="modal__note" style={{ marginTop: 0 }}>
        Four short guided lessons on the Delhi route. The guide waits for you to actually do each step.
      </p>
      <ol className="school__list">
        {LESSONS.map((l) => (
          <li key={l.id}>
            <div>
              <strong>
                {done.includes(l.id) && <span className="school__tick">✓ </span>}
                {l.title}
              </strong>
              <p>{l.summary}</p>
            </div>
            <button className="btn btn--primary" onClick={() => onStart(l.id)}>
              {done.includes(l.id) ? 'Again' : 'Start'}
            </button>
          </li>
        ))}
      </ol>
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
        by knitro_vedant, CC BY 4.0 (optimised). WAP-4 and WCAM-1 3D models:{' '}
        <a href="https://sketchfab.com/3d-models/wap-4-indian-electric-engine-locomotive-ed30919c961142c1a77c931dc13ad5bd" target="_blank" rel="noreferrer">
          “WAP-4 | Indian Electric Engine Locomotive”
        </a>{' '}
        and{' '}
        <a href="https://sketchfab.com/3d-models/wam-4-indian-electric-engine-locomotive-37aa5b915f9a4e44825da1c8a498a850" target="_blank" rel="noreferrer">
          “WAM-4 | Indian Electric Engine Locomotive”
        </a>{' '}
        (a WCAM-1) and{' '}
        <a href="https://sketchfab.com/3d-models/train-freight-compartment-2cd8d1032b53426a92abb64a71743aa6" target="_blank" rel="noreferrer">
          “Train Freight Compartment”
        </a>{' '}
        (BCNA wagon) by Prabhu Ram (virtualmakes), CC BY 4.0 (scaled, optimised; watermark removed). Petrol tank wagon:{' '}
        <a href="https://sketchfab.com/3d-models/authentic-3d-indian-petrol-wagon-train-model-2e40ef40f08a4a1e82bd713b7d1260c4" target="_blank" rel="noreferrer">
          “Authentic 3D Indian Petrol-Wagon Train Model”
        </a>{' '}
        (BTPN) by lakshyasharma11052002, CC BY 4.0 (scaled, simplified). Wayside station building:{' '}
        <a href="https://sketchfab.com/3d-models/indian-railway-station-building-game-ready-b511a0c49a8344208f04883f8ffeb379" target="_blank" rel="noreferrer">
          “Indian Railway Station Building Game-Ready”
        </a>{' '}
        © nayan pachori, used with the author's permission (not for reuse as a separate file). Brake van:{' '}
        <a href="https://sketchfab.com/3d-models/bvzi--brake--van-indian-train-c077c09c16de4be28c7cfc7cb09c83ed" target="_blank" rel="noreferrer">
          “BVZI_ Brake_ Van_indian_train”
        </a>{' '}
        by GameChangz (krupesh2736), CC BY 4.0 (optimised). Horn:{' '}
        <a href="https://freesound.org/s/248229/" target="_blank" rel="noreferrer">
          “Train Horn”
        </a>{' '}
        by CouleurCasquette, CC BY 3.0 (original horn). Locomotive horns:{' '}
        <a href="https://freesound.org/s/403930/" target="_blank" rel="noreferrer">
          “Sound of passing train”
        </a>{' '}
        by arundasstp and{' '}
        <a href="https://freesound.org/s/94012/" target="_blank" rel="noreferrer">
          “train-station-Rajasthan”
        </a>{' '}
        by xserra, CC BY 4.0 (excerpts, normalised). Sounds also by Calcuttan (birds), Zabuhailo, KrystofJakobe, Anton and Garuda1982 on Freesound (CC BY 4.0/3.0), and Village
        Regional and Vijay Singh Choudhary on Wikimedia Commons (CC BY 3.0); all other sounds CC0. Full list in docs/ASSET_CREDITS.md.
      </p>
    </div>
  );
}

export default function StartScreen({ settings, bests, routeId, schoolDone = [], locoModels = {} }) {
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
                    {pickableLocos(locoModels, settings.showStandIns).map(([id, l]) => (
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
              <div className="segmented" role="radiogroup" aria-label="Difficulty">
                <span className="segmented__label">Difficulty</span>
                <div className="segmented__options">
                  {Object.entries(DIFFICULTY).map(([id, d]) => (
                    <button key={id} type="button" role="radio" aria-checked={settings.difficulty === id} className={`segmented__btn ${settings.difficulty === id ? 'is-active' : ''}`} onClick={() => updateSettings({ difficulty: id })}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <span className="setup__hint">{difficultyFor(settings.difficulty).blurb}</span>
              </div>
              <EnvironmentPicker settings={settings} />
              <button className="btn btn--primary btn--start" onClick={startJourney} ref={(el) => el && !el.dataset.f && ((el.dataset.f = 1), el.focus({ preventScroll: true }))}>
                Start journey <span aria-hidden>▶</span>
              </button>
            </div>
          </section>
        </div>

        <footer className="title-footer">
          <button className="btn btn--ghost btn--school" onClick={() => setModal('school')}>
            🎓 Driver school {schoolDone.length > 0 && <span className="num">({schoolDone.length}/{LESSONS.length})</span>}
          </button>
          <button className="btn btn--ghost" onClick={() => setModal('how')}>
            ⌨ How to play
          </button>
          <button className="btn btn--ghost" onClick={() => setModal('settings')}>
            ⚙ Settings
          </button>
          <button className="btn btn--ghost" onClick={() => setModal('records')}>
            ★ Records
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
      {modal === 'school' && (
        <Modal title="Driver school" onClose={() => setModal(null)} wide>
          <School
            done={schoolDone}
            onStart={(id) => {
              setModal(null);
              startLesson(id);
            }}
          />
        </Modal>
      )}
      {modal === 'records' && (
        <Modal title="Records & driving log" onClose={() => setModal(null)}>
          <Records />
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

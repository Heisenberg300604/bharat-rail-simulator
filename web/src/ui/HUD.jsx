// Driving HUD (DOM overlay). Reads the ~10 Hz snapshot; never touches the 3D scene.
import { origin, destination } from '../game/state/gameStore.js';
import { TRAIN, JOURNEY } from '../game/config/gameConfig.js';

const CAMERA_LABELS = { cab: 'Cab', interior: 'Coach', door: 'Door', rear: 'Last coach', chase: 'Chase', orbit: 'Orbit', trackside: 'Trackside' };

function formatClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "1 in 37 ↑" style gradient readout (Indian railways quote gradients as 1 in N). */
function gradeLabel(g) {
  if (Math.abs(g) < 1 / 600) return 'Level';
  return `1 in ${Math.round(1 / Math.abs(g))} ${g > 0 ? '▲ rising' : '▼ falling'}`;
}

function formatDistance(m) {
  if (Math.abs(m) >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.max(0, Math.round(m))} m`;
}

/** Two-sided meter: right = traction (green), left = regenerative braking (blue). */
function TeBeMeter({ lever, kN }) {
  const pct = Math.round(lever * 100);
  return (
    <div className="meter">
      <div className="meter__label">
        <span>TE/BE</span>
        <span className="num">
          {pct > 0 ? `TE ${pct}%` : pct < 0 ? `BE ${-pct}%` : 'OFF'} · {Math.round(Math.abs(kN))} kN
        </span>
      </div>
      <div className="meter__track meter__track--split">
        <div className="meter__zero" />
        {lever > 0 && <div className="meter__fill meter__fill--te" style={{ left: '50%', width: `${lever * 50}%` }} />}
        {lever < 0 && <div className="meter__fill meter__fill--be" style={{ right: '50%', width: `${-lever * 50}%` }} />}
      </div>
    </div>
  );
}

function Gauge({ label, value, max, unit, tone }) {
  return (
    <div className="gauge">
      <div className="gauge__label">{label}</div>
      <div className="gauge__value num">
        {value.toFixed(1)}
        <small>{unit}</small>
      </div>
      <div className="gauge__track">
        <div className={`gauge__fill gauge__fill--${tone}`} style={{ width: `${Math.min(1, value / max) * 100}%` }} />
      </div>
    </div>
  );
}

const DIRS = [
  [1, 'F'],
  [0, 'N'],
  [-1, 'R'],
];

export default function HUD({ s }) {
  const remaining = s.remaining;
  const overshoot = remaining < 0;
  const limit = Number.isFinite(s.speedLimit) ? s.speedLimit : TRAIN.sectionalSpeedKmh;
  const overspeed = s.speedKmh > limit + 1;
  const tooLate = s.speedKmh > 5 && remaining > 0 && s.stoppingDistance > remaining && s.dwell === null;
  const next = s.nextStop;
  const span = JOURNEY.stopMarker - JOURNEY.startDistance;
  const late = next?.scheduled ? s.elapsed - next.scheduled : 0;
  return (
    <div className="hud" aria-live="off">
      <div className="hud__top">
        <div className="hud__route">
          <div className="hud__stations">
            <span>{origin.name}</span>
            <span className="hud__to">→</span>
            <strong>{next?.final ? destination.name : next?.name}</strong>
            {!next?.final && <span className="hud__final">· then {destination.name}</span>}
          </div>
          <div className="progress">
            <div className="progress__fill" style={{ width: `${s.progress * 100}%` }} />
            {JOURNEY.stops
              .filter((st) => !st.final)
              .map((st, i) => (
                <span key={st.stationId} className={`progress__stop ${i < s.stopIndex ? 'is-done' : ''}`} style={{ left: `${((st.marker - JOURNEY.startDistance) / span) * 100}%` }} title={st.name} />
              ))}
          </div>
          <div className="hud__remaining">
            {s.dwell !== null
              ? `Halt at ${next?.name} · right away in ${Math.ceil(s.dwell)} s`
              : overshoot
                ? `${formatDistance(-remaining)} past the stop marker`
                : `${formatDistance(remaining)} to the ${next?.final ? 'stop marker' : `${next?.name} halt`}`}
          </div>
          {next?.scheduled && s.journeyState !== 'ready' && (
            <div className={`hud__timetable num ${late > 30 ? 'is-late' : ''}`}>
              {formatClock(s.elapsed)} · due {next.name} {formatClock(next.scheduled)}
              {late > 30 ? ` · ${formatClock(late)} late` : late > -15 ? ' · on time' : ''}
            </div>
          )}
        </div>
        <div className="hud__alerts">
          {s.emergency && <span className="alert alert--red">EMERGENCY BRAKE</span>}
          {s.tractionCut && !s.emergency && <span className="alert alert--amber">TRACTION CUT · BP below 4.75</span>}
          {overspeed && <span className="alert alert--red">OVERSPEED · limit {limit} km/h</span>}
          {tooLate && <span className="alert alert--amber">Brake now — full-service stop needs {formatDistance(s.stoppingDistance)}</span>}
        </div>
        {(s.toast || s.hint) && <div className="hud__hint">{s.toast || s.hint}</div>}
      </div>

      <div className="hud__speed panel-glass">
        <div className="speed-row">
          <div className="speed">
            <span className={`speed__value num ${overspeed ? 'is-over' : ''}`}>{Math.round(s.speedKmh)}</span>
            <span className="speed__unit">km/h</span>
          </div>
          <div className="limit-sign" title="Speed limit">
            <span className="num">{limit}</span>
          </div>
        </div>
        <div className="speed__limit">
          {s.nextLimit ? `Next: ${s.nextLimit.kmh} km/h in ${formatDistance(s.nextLimit.distance)}` : 'No restriction ahead'}
        </div>
        <TeBeMeter lever={s.lever} kN={s.teKN} />
        <div className="brake-row">
          <div className="brake-handle">
            <div className="gauge__label">A9 brake</div>
            <div className={`brake-handle__pos ${s.emergency ? 'is-emergency' : ''}`}>{s.brakeLabel}</div>
          </div>
          <Gauge label="BP" value={s.bp} max={5.2} unit="kg/cm²" tone="bp" />
          <Gauge label="BC" value={s.bc} max={3.8} unit="kg/cm²" tone="bc" />
        </div>
        <div className="speed__limit">Full-service stop: {s.speedKmh > 1 ? formatDistance(s.stoppingDistance) : '—'}</div>
        <div className="direction" aria-label={`Reverser ${s.directionLabel}`}>
          {DIRS.map(([d, l]) => (
            <span key={l} className={`direction__pill ${s.direction === d ? 'is-active' : ''}`}>
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="hud__status panel-glass">
        <div className="status-row">
          <span>Camera</span>
          <strong>{CAMERA_LABELS[s.cameraMode]}</strong>
        </div>
        <div className="status-row">
          <span>Headlight</span>
          <strong className={s.headlight ? 'on' : ''}>{s.headlight ? 'On' : 'Off'}</strong>
        </div>
        <div className="status-row">
          <span>Horn</span>
          <strong className={s.horn ? 'on' : ''}>{s.horn ? 'Sounding' : '—'}</strong>
        </div>
        <div className="status-row">
          <span>Gradient</span>
          <strong className={Math.abs(s.grade) > 1 / 100 ? 'warn' : ''}>{gradeLabel(s.grade)}</strong>
        </div>
        {s.banker && (
          <div className="status-row">
            <span>Bankers</span>
            <strong className="on">{s.banker}</strong>
          </div>
        )}
        <div className="status-keys">
          W/S TE/BE · Space/X A9 brake · E emergency · F reverser · H horn · C/1–6 camera · drag to look · Esc menu
        </div>
        {s.settings.showFps && (
          <div className="fps num">
            {s.fps} FPS · render scale {s.renderScale?.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}

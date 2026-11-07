// Driving HUD. Reads the ~10 Hz snapshot; never touches the 3D scene.
import { origin, destination } from '../game/state/gameStore.js';
import { TRAIN } from '../game/config/gameConfig.js';

function formatDistance(m) {
  if (m >= 1000) return `${(m / 1000).toFixed(2)} km`;
  return `${Math.max(0, Math.round(m))} m`;
}

function Bar({ label, value, tone, ghost }) {
  return (
    <div className="bar">
      <div className="bar__label">
        <span>{label}</span>
        <span className="num">{Math.round(value * 100)}%</span>
      </div>
      <div className="bar__track">
        {ghost !== undefined && <div className="bar__ghost" style={{ width: `${ghost * 100}%` }} />}
        <div className={`bar__fill bar__fill--${tone}`} style={{ width: `${value * 100}%` }} />
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
  return (
    <div className="hud" aria-live="off">
      <div className="hud__top">
        <div className="hud__route">
          <div className="hud__stations">
            <span>{origin.name}</span>
            <span className="hud__to">→</span>
            <strong>{destination.name}</strong>
          </div>
          <div className="progress">
            <div className="progress__fill" style={{ width: `${s.progress * 100}%` }} />
          </div>
          <div className="hud__remaining">
            {overshoot ? `${formatDistance(-remaining)} past the stop marker` : `${formatDistance(remaining)} to stop marker`}
          </div>
        </div>
        {(s.toast || s.hint) && <div className="hud__hint">{s.toast || s.hint}</div>}
      </div>

      <div className="hud__speed panel-glass">
        <div className="speed">
          <span className="speed__value num">{Math.round(s.speedKmh)}</span>
          <span className="speed__unit">km/h</span>
        </div>
        <div className="speed__limit">Max {TRAIN.maxSpeedKmh} km/h</div>
        <Bar label="Throttle" value={s.throttle} tone="throttle" />
        <Bar label="Brake" value={s.brake} ghost={s.brakeEffective} tone="brake" />
        <div className="direction" aria-label={`Direction ${s.directionLabel}`}>
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
          <strong>{s.cameraMode === 'cab' ? 'Cab' : 'Exterior'}</strong>
        </div>
        <div className="status-row">
          <span>Headlight</span>
          <strong className={s.headlight ? 'on' : ''}>{s.headlight ? 'On' : 'Off'}</strong>
        </div>
        <div className="status-row">
          <span>Horn</span>
          <strong className={s.horn ? 'on' : ''}>{s.horn ? 'Sounding' : '—'}</strong>
        </div>
        <div className="status-keys">W/S throttle · Space/X brake · F dir · H horn · C cam · Esc pause</div>
        {s.settings.showFps && <div className="fps num">{s.fps} FPS</div>}
      </div>
    </div>
  );
}

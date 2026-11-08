// Time of day and weather: segmented buttons, used on the title screen and in
// the pause menu. Changing them mid-journey blends the sky and lights over ~2 s.
import { updateSettings } from '../game/state/gameStore.js';
import { TIME_OF_DAY, WEATHER } from '../game/world/environment.js';

const TIME_ICONS = { morning: '🌅', noon: '☀️', evening: '🌇', night: '🌙' };
const WEATHER_ICONS = { clear: '✨', fog: '🌫️', rain: '🌧️' };

function Segmented({ label, options, value, onChange, icons }) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      <span className="segmented__label">{label}</span>
      <div className="segmented__options">
        {Object.entries(options).map(([id, o]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={value === id}
            className={`segmented__btn ${value === id ? 'is-active' : ''}`}
            onClick={() => onChange(id)}
            title={o.label}
          >
            <span aria-hidden>{icons[id]}</span> {o.label.split(' · ')[0]}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function EnvironmentPicker({ settings }) {
  return (
    <div className="env-picker">
      <Segmented label="Time of day" options={TIME_OF_DAY} value={settings.timeOfDay} icons={TIME_ICONS} onChange={(timeOfDay) => updateSettings({ timeOfDay })} />
      <Segmented label="Weather" options={WEATHER} value={settings.weather} icons={WEATHER_ICONS} onChange={(weather) => updateSettings({ weather })} />
    </div>
  );
}

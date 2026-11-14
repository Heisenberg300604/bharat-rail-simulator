// Route list (left column of the title screen) and the detail panel for the
// selected route. Picking a route rebuilds the 3D world behind a short
// loading screen; the scene behind the menu then shows the new route.
import { memo } from 'react';
import { selectRoute, updateSettings } from '../game/state/gameStore.js';
import { routeSummaries } from '../game/routes/activeRoute.js';
import { TIME_OF_DAY, WEATHER } from '../game/world/environment.js';

/** Elevation profile: stations as dots, tunnels dark, bridges blue. */
export const Profile = memo(function Profile({ r, width = 132, height = 34, labels = false }) {
  const W = width;
  const H = height;
  const g = r.geometry;
  const n = 64;
  const hs = Array.from({ length: n + 1 }, (_, i) => g.heightAt((i / n) * r.length));
  const lo = Math.min(...hs);
  const hi = Math.max(...hs);
  const range = Math.max(12, hi - lo);
  const pad = labels ? 14 : 4;
  const X = (s) => (s / r.length) * W;
  const Y = (h) => H - pad - ((h - lo) / range) * (H - pad - 8);
  const line = hs.map((h, i) => `${i ? 'L' : 'M'}${((i / n) * W).toFixed(1)},${Y(h).toFixed(1)}`).join('');
  return (
    <svg className="route-profile" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill="currentColor" opacity="0.16" />
      {r.bridges
        .filter((b) => b.track !== false)
        .map((b) => (
          <rect key={b.from} x={X(b.from)} y={Y(g.heightAt((b.from + b.to) / 2)) + 1} width={Math.max(2, X(b.to) - X(b.from))} height={4} fill="#5fb4e0" />
        ))}
      {r.tunnels.map((t) => (
        <rect key={t.from} x={X(t.from)} y={Y(g.heightAt((t.from + t.to) / 2)) - 3} width={Math.max(2, X(t.to) - X(t.from))} height={6} rx={1.5} fill="#151515" stroke="currentColor" strokeWidth="0.6" />
      ))}
      <path d={line} fill="none" stroke="currentColor" strokeWidth={labels ? 2 : 1.6} />
      {r.stations.map((st) => (
        <g key={st.id}>
          <circle cx={X(st.centerS)} cy={Y(g.heightAt(st.centerS))} r={labels ? 3.2 : 2.2} fill="#f4f1ea" />
          {labels && (
            <text x={Math.min(W - 4, Math.max(4, X(st.centerS)))} y={H - 2} textAnchor={X(st.centerS) < 20 ? 'start' : X(st.centerS) > W - 20 ? 'end' : 'middle'} className="route-profile__label">
              {st.code}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
});

export function RouteList({ bests, current }) {
  return (
    <div className="route-list" role="radiogroup" aria-label="Route">
      {routeSummaries().map((r) => {
        const m = r.meta;
        const active = r.id === current;
        return (
          <div
            key={r.id}
            role="radio"
            aria-checked={active}
            tabIndex={0}
            className={`route-item ${active ? 'is-active' : ''}`}
            style={{ '--route-accent': m.accent ?? '#f2a93b' }}
            onClick={() => selectRoute(r.id)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), selectRoute(r.id))}
          >
            <div className="route-item__text">
              <strong>{m.shortName}</strong>
              <span>{m.name}</span>
            </div>
            <div className="route-item__side">
              <Profile r={r} width={74} height={26} />
              {bests[r.id] !== undefined && <span className="route-item__best">★ {bests[r.id]}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Suggested({ r, settings }) {
  const sg = r.meta.suggested;
  if (!sg) return null;
  const same = (!sg.weather || sg.weather === settings.weather) && (!sg.timeOfDay || sg.timeOfDay === settings.timeOfDay);
  const label = [sg.weather && WEATHER[sg.weather]?.label.split(' · ')[0], sg.timeOfDay && TIME_OF_DAY[sg.timeOfDay]?.label.split(' · ')[0]].filter(Boolean).join(' · ');
  return (
    <button type="button" className="chip-btn" disabled={same} onClick={() => updateSettings({ ...(sg.weather && { weather: sg.weather }), ...(sg.timeOfDay && { timeOfDay: sg.timeOfDay }) })}>
      {same ? `✓ Best in ${label}` : `Best in ${label} — apply`}
    </button>
  );
}

export function RouteDetail({ r, settings, best }) {
  const m = r.meta;
  const a = r.stations[0];
  const b = r.stations[r.stations.length - 1];
  const halts = r.journey.stops.length - 1;
  return (
    <div className="route-detail" style={{ '--route-accent': m.accent ?? '#f2a93b' }}>
      <div className="route-detail__head">
        <span className={`diff diff--${m.difficulty.toLowerCase()}`}>{m.difficulty}</span>
        <h2>{m.shortName}</h2>
        <p className="route-detail__ends">
          <span>
            {a.name} <small>{a.code}</small>
          </span>
          <span aria-hidden>→</span>
          <span>
            {b.name} <small>{b.code}</small>
          </span>
        </p>
      </div>
      <p className="route-detail__tagline">{m.tagline}</p>
      <div className="route-detail__profile">
        <Profile r={r} width={372} height={78} labels />
        <div className="route-detail__legend">
          <span>
            <i className="lg lg--tunnel" /> tunnel
          </span>
          <span>
            <i className="lg lg--bridge" /> bridge
          </span>
          <span>{r.profile.length ? `climb ${Math.round(Math.max(...r.profile.map((p) => p.z)) - Math.min(...r.profile.map((p) => p.z)))} m` : 'level'}</span>
        </div>
      </div>
      <dl className="route-detail__stats">
        <div>
          <dt>Length</dt>
          <dd className="num">{m.lengthKm.toFixed(0)} km</dd>
        </div>
        <div>
          <dt>Halts</dt>
          <dd className="num">{halts || 'Non-stop'}</dd>
        </div>
        <div>
          <dt>Line speed</dt>
          <dd className="num">{m.maxKmh} km/h</dd>
        </div>
        <div>
          <dt>Best</dt>
          <dd className="num">{best ?? '—'}</dd>
        </div>
      </dl>
      <div className="chips">
        <span>{r.double ? 'Double line' : 'Single line'}</span>
        {m.features.map((f) => (
          <span key={f}>{f}</span>
        ))}
      </div>
      <p className="route-detail__inspired">
        {m.region} · inspired by the {m.inspiredBy}
      </p>
      <Suggested r={r} settings={settings} />
    </div>
  );
}

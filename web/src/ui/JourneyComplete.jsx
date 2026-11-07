import { confirmRestart, returnToTitle, destination } from '../game/state/gameStore.js';

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function JourneyComplete({ result }) {
  if (!result) return null;
  const off = result.stopOffset;
  const where = Math.abs(off) < 0.5 ? 'right on the marker' : `${Math.abs(off).toFixed(1)} m ${off > 0 ? 'past' : 'short of'} the marker`;
  return (
    <div className="overlay">
      <div className="panel panel--small" role="dialog" aria-label="Journey completed">
        <p className="eyebrow">Arrived at {destination.name}</p>
        <h2>Journey completed</h2>
        <dl className="stats">
          <div>
            <dt>Elapsed time</dt>
            <dd className="num">{formatTime(result.elapsed)}</dd>
          </div>
          <div>
            <dt>Maximum speed</dt>
            <dd className="num">{Math.round(result.maxSpeedKmh)} km/h</dd>
          </div>
          <div>
            <dt>Speed discipline</dt>
            <dd>
              {result.overspeedSeconds < 1 ? 'No overspeeding' : `${Math.round(result.overspeedSeconds)} s over the limit`}
              {result.maxOverspeedKmh >= 1 && <small>worst: +{Math.round(result.maxOverspeedKmh)} km/h</small>}
            </dd>
          </div>
          {result.emergencyUsed && (
            <div>
              <dt>Emergency brake</dt>
              <dd>Used (−15)</dd>
            </div>
          )}
          <div>
            <dt>Driving score</dt>
            <dd className="num">{result.score} / 100</dd>
          </div>
          <div>
            <dt>Stop</dt>
            <dd>
              {result.stopRating}
              <small>{where}</small>
            </dd>
          </div>
        </dl>
        <div className="menu-buttons menu-buttons--row">
          <button className="btn btn--primary" onClick={confirmRestart} autoFocus>
            Drive again
          </button>
          <button className="btn" onClick={returnToTitle}>
            Title screen
          </button>
        </div>
      </div>
    </div>
  );
}

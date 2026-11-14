// Run card: the end-of-journey report, written like a loco pilot's memo —
// punctuality at every halt, stopping accuracy, speed discipline, safety,
// passenger comfort and energy — compared with the player's own records
// (kept in localStorage). "Save card" downloads it as a PNG with a snapshot
// of the scene, ready to share.
import { confirmRestart, returnToTitle, destination } from '../game/state/gameStore.js';
import { ROUTE, LOCOMOTIVES, CONSISTS, difficultyFor } from '../game/config/gameConfig.js';
import { sceneRefs } from '../game/state/sceneRefs.js';

function formatTime(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const cm = (m) => `${Math.round(Math.abs(m) * 100)} cm`;

function grade(score) {
  if (score >= 95) return 'A+';
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  return 'D';
}

/** Render the card (+ a frame of the 3D view) to a PNG and download it. */
function saveCard(result, stats, meta) {
  const W = 1200;
  const H = 630;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#12161a';
  g.fillRect(0, 0, W, H);
  // the current view on the right
  try {
    const gl = sceneRefs.gl;
    if (gl && sceneRefs.scene && sceneRefs.camera) gl.render(sceneRefs.scene, sceneRefs.camera); // the drawing buffer is cleared after each frame
    const img = gl?.domElement;
    if (img) {
      const sw = img.width;
      const sh = img.height;
      const tw = 560;
      const th = H;
      const scale = Math.max(tw / sw, th / sh);
      g.drawImage(img, (sw - tw / scale) / 2, (sh - th / scale) / 2, tw / scale, th / scale, W - tw, 0, tw, th);
      const grad = g.createLinearGradient(W - tw, 0, W - tw + 160, 0);
      grad.addColorStop(0, '#12161a');
      grad.addColorStop(1, 'rgba(18,22,26,0)');
      g.fillStyle = grad;
      g.fillRect(W - tw, 0, 160, H);
    }
  } catch {
    /* no snapshot: the card still works */
  }
  g.fillStyle = '#f2a93b';
  g.font = 'bold 22px Helvetica, Arial, sans-serif';
  g.fillText('BHARAT RAIL SIMULATOR · RUN CARD', 48, 64);
  g.fillStyle = '#f4f1ea';
  g.font = 'bold 46px Helvetica, Arial, sans-serif';
  g.fillText(meta.title, 48, 124);
  g.font = '24px Helvetica, Arial, sans-serif';
  g.fillStyle = '#b9b5ab';
  g.fillText(meta.sub, 48, 162);
  g.fillStyle = result.failed ? '#e2483d' : '#f2a93b';
  g.font = 'bold 120px Helvetica, Arial, sans-serif';
  g.fillText(result.failed ? '—' : String(result.score), 48, 300);
  g.font = 'bold 34px Helvetica, Arial, sans-serif';
  g.fillText(result.failed ? meta.reason : `/ 100 · grade ${grade(result.score)}`, result.failed ? 48 : 260, result.failed ? 350 : 300);
  g.fillStyle = '#f4f1ea';
  g.font = '26px Helvetica, Arial, sans-serif';
  const lines = [
    `Time ${formatTime(result.elapsed)}${result.scheduled ? (result.lateSeconds > 30 ? ` · ${formatTime(result.lateSeconds)} late` : ' · on time') : ''}`,
    !result.failed ? `Stop ${cm(result.stopOffset)} from the marker (${result.stopRating})` : '',
    `Max ${Math.round(result.maxSpeedKmh)} km/h · ride ${stats.comfort.toLowerCase()}`,
    `${stats.energyKWh.toFixed(0)} kWh used · ${Math.round(stats.regenShare * 100)}% regenerated`,
  ].filter(Boolean);
  lines.forEach((l, i) => g.fillText(l, 48, 410 + i * 44));
  const a = document.createElement('a');
  a.download = `run-${ROUTE.id}-${new Date().toISOString().slice(0, 10)}.png`;
  a.href = c.toDataURL('image/png');
  a.click();
}

export default function JourneyComplete({ result, stats, record, settings }) {
  if (!result) return null;
  const st = stats ?? { energyKWh: 0, regenKWh: 0, regenShare: 0, peakDecel: 0, peakJerk: 0, comfort: '—', spads: 0, emergencies: 0, vcdPenalties: 0, kavachInterventions: 0, slipSeconds: 0, distanceM: 0 };
  const off = result.stopOffset;
  const where = Math.abs(off) < 0.05 ? 'right on the marker' : `${cm(off)} ${off > 0 ? 'past' : 'short of'} the marker`;
  const halts = (result.stops ?? []).filter((h) => !(h.stationId === destination.id && !h.missed));
  const loco = LOCOMOTIVES[settings.locomotive]?.label.split(' ·')[0] ?? settings.locomotive;
  const consist = CONSISTS[settings.coachLivery]?.label ?? '';
  const diff = difficultyFor(settings.difficulty).label;
  const prev = record?.previous;
  const title = result.failed ? 'Run ended' : `Arrived at ${destination.name}`;

  return (
    <div className="overlay">
      <div className="panel run-card" role="dialog" aria-label="Run card">
        <div className="run-card__head">
          <div>
            <p className="eyebrow">
              Run card · {ROUTE.meta.shortName} · {diff}
            </p>
            <h2>{title}</h2>
            <p className="run-card__sub">
              {loco} · {consist}
            </p>
          </div>
          <div className={`run-card__score ${result.failed ? 'is-failed' : ''}`}>
            {result.failed ? (
              <span className="run-card__fail">{result.reason}</span>
            ) : (
              <>
                <span className="num">{result.score}</span>
                <small>grade {grade(result.score)}</small>
              </>
            )}
          </div>
        </div>

        {!result.failed && record && (
          <div className="run-card__badges">
            {record.firstRun && <span className="badge">First run with this train — record set</span>}
            {record.newBestScore && <span className="badge badge--gold">New best score (was {prev?.bestScore})</span>}
            {record.newBestStop && <span className="badge badge--gold">Most accurate stop yet</span>}
            {record.newBestTime && <span className="badge">Fastest run yet</span>}
            {!record.firstRun && !record.newBestScore && prev && <span className="badge">Your best: {prev.bestScore}</span>}
          </div>
        )}

        <div className="run-card__grid">
          <section>
            <h3>Punctuality</h3>
            <p>
              <strong className="num">{formatTime(result.elapsed)}</strong>
              {result.scheduled ? <small> due {formatTime(result.scheduled)} · {result.lateSeconds <= 30 ? 'on time' : `${formatTime(result.lateSeconds)} late`}</small> : null}
            </p>
            {halts.length > 0 && (
              <table className="halts">
                <tbody>
                  {halts.map((h) => (
                    <tr key={h.stationId}>
                      <td>{h.name}</td>
                      <td>{h.missed ? <span className="bad">missed (−20)</span> : cm(h.offset)}</td>
                      <td className="num">{h.missed ? '—' : h.late > 30 ? `+${formatTime(h.late)}` : 'on time'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {result.earlyDepartures > 0 && <p className="bad">Left before the right-away ×{result.earlyDepartures} (−8 each)</p>}
          </section>
          <section>
            <h3>Stopping</h3>
            {result.failed ? (
              <p>—</p>
            ) : (
              <p>
                <strong>{result.stopRating}</strong>
                <small> {where}</small>
              </p>
            )}
            {record?.entry?.bestStopCm !== undefined && <p className="muted">Best stop: {record.entry.bestStopCm} cm</p>}
          </section>
          <section>
            <h3>Speed discipline</h3>
            <p>
              Max <strong className="num">{Math.round(result.maxSpeedKmh)} km/h</strong>
            </p>
            <p className={result.overspeedSeconds >= 1 ? 'bad' : 'muted'}>
              {result.overspeedSeconds < 1 ? 'No overspeeding' : `${Math.round(result.overspeedSeconds)} s over the limit (worst +${Math.round(result.maxOverspeedKmh)} km/h)`}
            </p>
          </section>
          <section>
            <h3>Safety</h3>
            <ul className="safety">
              <li className={st.spads ? 'bad' : ''}>Signals passed at danger: {st.spads}</li>
              <li className={st.emergencies ? 'bad' : ''}>Emergency brake: {st.emergencies}</li>
              {st.vcdPenalties > 0 && <li className="bad">VCD penalty brakes: {st.vcdPenalties}</li>}
              {st.kavachInterventions > 0 && <li>Kavach interventions: {st.kavachInterventions}</li>}
              {st.slipSeconds > 0.5 && <li>Wheel slip: {Math.round(st.slipSeconds)} s</li>}
              {st.guardSignals > 0 && (
                <li className={st.guardAcks < st.guardSignals ? 'muted' : ''}>
                  Guard's right-away acknowledged ('--'): {st.guardAcks}/{st.guardSignals}
                </li>
              )}
            </ul>
          </section>
          {result.incidents?.length > 0 && (
            <section>
              <h3>Incidents</h3>
              <ul className="safety">
                {result.incidents.map((i) => (
                  <li key={i.kind} className={i.ok ? '' : 'bad'}>
                    {i.title} — {i.note}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3>Passenger comfort</h3>
            <p>
              <strong>{st.comfort}</strong>
            </p>
            <p className="muted num">
              peak braking {st.peakDecel.toFixed(2)} m/s² · jerk {st.peakJerk.toFixed(2)} m/s³
            </p>
          </section>
          <section>
            <h3>Energy</h3>
            <p>
              <strong className="num">{st.energyKWh.toFixed(0)} kWh</strong> <small>at the wheel</small>
            </p>
            <p className="muted num">
              {st.regenKWh.toFixed(0)} kWh regenerated ({Math.round(st.regenShare * 100)}%) · {(st.distanceM / 1000).toFixed(1)} km
            </p>
          </section>
        </div>

        <div className="menu-buttons menu-buttons--row">
          <button className="btn btn--primary" onClick={confirmRestart} autoFocus>
            Drive again
          </button>
          <button className="btn" onClick={() => saveCard(result, st, { title, sub: `${ROUTE.meta.name} · ${loco} · ${diff}`, reason: result.reason ?? '' })}>
            Save card
          </button>
          <button className="btn" onClick={returnToTitle}>
            Title screen
          </button>
        </div>
      </div>
    </div>
  );
}

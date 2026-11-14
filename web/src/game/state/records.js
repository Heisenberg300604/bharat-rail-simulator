// Personal records and the driving log, kept in localStorage (no server, no
// account; nothing ever leaves the browser). A storage object can be passed
// in for tests.
//
//   brs-records  { v: 1, runs: { "<route>|<loco>|<consist>|<difficulty>": Entry },
//                  log: { started, completed, failed, spads, emergencies, km, kWh, regenKWh } }
//   Entry        { runs, bestScore, bestTime, bestStopCm, last: {score, date} }

const KEY = 'brs-records';

function emptyLog() {
  return { started: 0, completed: 0, failed: 0, spads: 0, emergencies: 0, km: 0, kWh: 0, regenKWh: 0 };
}

export function createRecords(storage = globalThis.localStorage) {
  let data = { v: 1, runs: {}, log: emptyLog() };
  try {
    const saved = JSON.parse(storage?.getItem(KEY) || 'null');
    if (saved?.v === 1) data = { v: 1, runs: saved.runs ?? {}, log: { ...emptyLog(), ...(saved.log ?? {}) } };
  } catch {
    /* corrupt or unavailable: start fresh */
  }
  const save = () => {
    try {
      storage?.setItem(KEY, JSON.stringify(data));
    } catch {
      /* private mode / quota: records just won't persist */
    }
  };

  return {
    get data() {
      return data;
    },
    keyFor({ route, loco, consist, difficulty }) {
      return `${route}|${loco}|${consist}|${difficulty}`;
    },
    entry(key) {
      return data.runs[key] ?? null;
    },
    /** Best score on a route across every loco/consist/difficulty. */
    bestForRoute(route) {
      let best;
      for (const [k, e] of Object.entries(data.runs)) if (k.startsWith(`${route}|`) && e.bestScore !== undefined) best = Math.max(best ?? -1, e.bestScore);
      return best;
    },
    noteStarted() {
      data.log.started++;
      save();
    },
    /**
     * Record a finished (or failed) run. Returns what changed, for the run card:
     * { previous: Entry|null, firstRun, newBestScore, newBestTime, newBestStop }
     */
    recordRun(key, result, stats, date = new Date()) {
      const prev = data.runs[key] ? { ...data.runs[key] } : null;
      const log = data.log;
      log.spads += stats?.spads ?? 0;
      log.emergencies += stats?.emergencies ?? 0;
      log.km += (stats?.distanceM ?? 0) / 1000;
      log.kWh += stats?.energyKWh ?? 0;
      log.regenKWh += stats?.regenKWh ?? 0;
      const out = { previous: prev, firstRun: !prev, newBestScore: false, newBestTime: false, newBestStop: false };
      if (result.failed) {
        log.failed++;
        save();
        return out;
      }
      log.completed++;
      const e = data.runs[key] ?? { runs: 0 };
      e.runs++;
      const stopCm = Math.round(Math.abs(result.stopOffset) * 100);
      if (e.bestScore === undefined || result.score > e.bestScore) {
        out.newBestScore = e.bestScore !== undefined;
        e.bestScore = result.score;
      }
      if (e.bestTime === undefined || result.elapsed < e.bestTime) {
        out.newBestTime = e.bestTime !== undefined;
        e.bestTime = result.elapsed;
      }
      if (e.bestStopCm === undefined || stopCm < e.bestStopCm) {
        out.newBestStop = e.bestStopCm !== undefined;
        e.bestStopCm = stopCm;
      }
      e.last = { score: result.score, date: date.toISOString().slice(0, 10) };
      data.runs[key] = e;
      save();
      return out;
    },
    reset() {
      data = { v: 1, runs: {}, log: emptyLog() };
      save();
    },
  };
}

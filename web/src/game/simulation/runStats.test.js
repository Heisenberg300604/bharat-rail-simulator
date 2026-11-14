// Run statistics and personal records (run with: npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRunStats, updateRunStats, summarizeRunStats, comfortRating } from './runStats.js';
import { createRecords } from '../state/records.js';

const DT = 1 / 60;

test('energy: 300 kN at 20 m/s for one hour is 6000 kWh at the wheel', () => {
  const st = createRunStats();
  const train = { speedMps: 20, forces: { traction: 300, regen: 0 }, emergency: false };
  for (let i = 0; i < 3600; i++) updateRunStats(st, train, 1);
  assert.ok(Math.abs(st.energyKWh - 6000) < 1e-6);
  assert.ok(Math.abs(st.distanceM - 72000) < 1e-6);
});

test('regenerated energy is counted separately', () => {
  const st = createRunStats();
  updateRunStats(st, { speedMps: 10, forces: { traction: 0, regen: 100 }, emergency: false }, 36);
  assert.ok(Math.abs(st.regenKWh - 10) < 1e-9);
  assert.equal(st.energyKWh, 0);
});

test('a gentle stop is smooth, a slam is rough', () => {
  const gentle = createRunStats();
  let v = 20;
  let t = 0;
  while (v > 0) {
    updateRunStats(gentle, { speedMps: v, forces: {}, emergency: false }, DT);
    v = Math.max(0, v - 0.5 * Math.min(1, t / 3) * DT); // brakes build up over ~3 s, like the A9
    t += DT;
  }
  assert.equal(comfortRating(gentle), 'Smooth', JSON.stringify(summarizeRunStats(gentle)));
  const slam = createRunStats();
  v = 20;
  for (let i = 0; i < 60; i++) updateRunStats(slam, { speedMps: v, forces: {}, emergency: false }, DT);
  while (v > 0) {
    updateRunStats(slam, { speedMps: v, forces: {}, emergency: false }, DT);
    v = Math.max(0, v - 2.5 * DT);
  }
  assert.equal(comfortRating(slam), 'Rough ride');
});

test('emergency applications are counted once each', () => {
  const st = createRunStats();
  const t = { speedMps: 10, forces: {}, emergency: true };
  for (let i = 0; i < 30; i++) updateRunStats(st, t, DT);
  t.emergency = false;
  updateRunStats(st, t, DT);
  t.emergency = true;
  updateRunStats(st, t, DT);
  assert.equal(st.emergencies, 2);
});

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) };
}

test('records: first run, then a new best, persisted across reloads', () => {
  const storage = memoryStorage();
  const rec = createRecords(storage);
  const key = rec.keyFor({ route: 'pamban', loco: 'wap7', consist: 'red', difficulty: 'pilot' });
  const first = rec.recordRun(key, { score: 70, elapsed: 600, stopOffset: 2.5 }, { distanceM: 12000, energyKWh: 300 });
  assert.equal(first.firstRun, true);
  assert.equal(first.newBestScore, false);
  const second = rec.recordRun(key, { score: 82, elapsed: 650, stopOffset: 0.4 }, {});
  assert.equal(second.newBestScore, true);
  assert.equal(second.newBestTime, false);
  assert.equal(second.newBestStop, true);
  const reloaded = createRecords(storage);
  assert.equal(reloaded.entry(key).bestScore, 82);
  assert.equal(reloaded.entry(key).bestStopCm, 40);
  assert.equal(reloaded.entry(key).runs, 2);
  assert.equal(reloaded.bestForRoute('pamban'), 82);
  assert.equal(reloaded.data.log.completed, 2);
  assert.ok(Math.abs(reloaded.data.log.km - 12) < 1e-9);
});

test('records: a failed run (SPAD) is logged but never becomes a record', () => {
  const rec = createRecords(memoryStorage());
  const key = 'x|wap7|red|realistic';
  rec.recordRun(key, { failed: true, score: 0 }, { spads: 1 });
  assert.equal(rec.entry(key), null);
  assert.equal(rec.data.log.failed, 1);
  assert.equal(rec.data.log.spads, 1);
});

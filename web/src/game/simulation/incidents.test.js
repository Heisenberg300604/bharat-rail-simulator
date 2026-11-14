import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planIncidents, updateIncidents, runSpeedLimits, incidentLimitAt, incidentInputs, startCautiousRun, tsrBoards, summarizeIncidents, INCIDENT_RULES } from './incidents.js';
import { createHornReader, updateHornReader, blastSymbol, hasLongBlast } from './hornCodes.js';
import { createSignalling, updateSignalling, failSignal, nextStopSignalAfter, ASPECT } from './signalling.js';
import { createTrainState, stepTrain, speedLimitFor } from './trainSimulation.js';
import { dopplerFactor, nearestOnSpan } from '../audio/railAcoustics.js';
import { trainConfigFor } from '../config/gameConfig.js';
import { ROUTE_DEFS } from '../routes/index.js';
import { buildRoute } from '../routes/buildRoute.js';

const routes = Object.fromEntries(ROUTE_DEFS.map((d) => [d.id, buildRoute(d)]));
const autosOf = (r) => createSignalling(r).up.filter((s) => s.kind === 'auto');

// ------------------------------------------------------------ horn codes
function sound(reader, pattern) {
  // pattern: array of [seconds on, seconds off]
  let code = null;
  for (const [on, off] of pattern) {
    for (let t = 0; t < on; t += 0.05) code = updateHornReader(reader, true, 0.05) ?? code;
    for (let t = 0; t < off; t += 0.05) code = updateHornReader(reader, false, 0.05) ?? code;
  }
  return code;
}

test('horn codes: short / long / longer blasts are read as IRFCA notation', () => {
  assert.equal(blastSymbol(0.3), 'o');
  assert.equal(blastSymbol(1.5), '--');
  assert.equal(blastSymbol(3.2), '-----');
  assert.equal(sound(createHornReader(), [[0.3, 0.4], [0.3, 0.4], [1.5, 2]]), 'o o --');
  assert.equal(sound(createHornReader(), [[1.4, 2]]), '--');
  assert.ok(hasLongBlast('--') && hasLongBlast('-----') && !hasLongBlast('o o'));
});

test('horn codes: nothing is reported until the driver has been silent for the gap', () => {
  const r = createHornReader();
  assert.equal(sound(r, [[0.3, 0.5]]), null);
  assert.equal(sound(r, [[0, 1.5]]), 'o');
});

// ------------------------------------------------------------ planning
test('incidents are off unless the setting asks for them', () => {
  const st = planIncidents(routes['ndls-gzb'], { seed: 3, mode: 'off', autoSignals: autosOf(routes['ndls-gzb']) });
  assert.equal(st.tsr, null);
  assert.equal(st.failedSignal, null);
  assert.equal(st.acp, null);
});

test("'always' plans a caution order, a failed automatic signal and an alarm chain on a double line", () => {
  const r = routes['ndls-gzb'];
  for (let seed = 1; seed < 12; seed++) {
    const st = planIncidents(r, { seed, mode: 'always', autoSignals: autosOf(r) });
    assert.ok(st.tsr, `seed ${seed}: tsr`);
    assert.ok(st.failedSignal, `seed ${seed}: failed signal`);
    assert.ok(st.acp, `seed ${seed}: acp`);
    // the restriction lies between the stations, on track faster than the restriction
    assert.ok(st.tsr.from - INCIDENT_RULES.cautionBefore > r.journey.startDistance);
    assert.ok(speedLimitFor(r.speedLimits, st.tsr.from, st.tsr.to) >= st.tsr.kmh + 20);
    for (const stn of r.stations) assert.ok(st.tsr.to + INCIDENT_RULES.terminationG < stn.platformStart || st.tsr.from - 800 > stn.platformEnd);
  }
});

test('GR 15.09: caution indicator ≥ 800 m and speed indicator 30 m before; T/P and T/G beyond the end', () => {
  const b = tsrBoards({ from: 3000, to: 3400, kmh: 30 });
  assert.deepEqual(
    b.map((x) => [x.kind, x.s, x.label]),
    [
      ['caution', 2200, ''],
      ['tsrSpeed', 2970, '30'],
      ['termination', 4000, 'T/P'],
      ['termination', 4100, 'T/G'],
    ],
  );
});

test('no failed automatic signal on single lines (GR 9.02 is a double-line rule); no ACP on goods trains', () => {
  const r = routes['konkan'];
  const st = planIncidents(r, { seed: 5, mode: 'always', passenger: false, autoSignals: autosOf(r) });
  assert.equal(st.failedSignal, null);
  assert.equal(st.acp, null);
});

test('night doubles the GR 9.02 wait', () => {
  const r = routes['ndls-gzb'];
  assert.equal(planIncidents(r, { seed: 2, mode: 'always', autoSignals: autosOf(r) }).failedSignal.waitS, 60);
  assert.equal(planIncidents(r, { seed: 2, mode: 'always', night: true, autoSignals: autosOf(r) }).failedSignal.waitS, 120);
});

test('the caution order joins the speed limits, applying until the rear clears', () => {
  const st = planIncidents(routes['ndls-gzb'], { seed: 4, mode: 'always', autoSignals: autosOf(routes['ndls-gzb']) });
  const lim = runSpeedLimits(routes['ndls-gzb'].speedLimits, st);
  assert.equal(speedLimitFor(lim, st.tsr.from - 200, st.tsr.from + 10), 30);
  assert.equal(speedLimitFor(lim, st.tsr.to - 5, st.tsr.to + 300), 30); // rear still inside
  assert.ok(speedLimitFor(lim, st.tsr.to + 5, st.tsr.to + 300) > 30);
});

// ------------------------------------------------------------ failed automatic signal
test('GR 9.02: a failed automatic signal stays red; after the wait it may be passed with authority, then 15 km/h to the next stop signal', () => {
  const r = routes['ndls-gzb'];
  const sg = createSignalling(r, { holdChance: 0 });
  const auto = sg.up.find((s) => s.kind === 'auto' && s.s > 2500);
  failSignal(sg, auto.s, 60);
  const ctx = (front, speed, dt = 0.5) => ({ front, speed, dt, stopIndex: 0, dwellDone: false, rightAway: [], aiSpans: [] });
  updateSignalling(sg, ctx(auto.s - 1500, 20));
  assert.equal(auto.aspect, ASPECT.RED);
  const prev = sg.up[sg.up.indexOf(auto) - 1];
  assert.equal(prev.aspect, ASPECT.YELLOW);
  // standing in rear of it for 59 s: not yet authorised
  let evs = [];
  for (let t = 0; t < 59; t += 0.5) evs.push(...updateSignalling(sg, ctx(auto.s - 80, 0)));
  assert.ok(!auto.authorised);
  for (let t = 0; t < 2; t += 0.5) evs.push(...updateSignalling(sg, ctx(auto.s - 80, 0)));
  assert.ok(evs.some((e) => e.type === 'authorised'));
  assert.equal(auto.aspect, ASPECT.RED); // still 'on' — it is a failure
  // passing it now is not a SPAD
  evs = updateSignalling(sg, ctx(auto.s + 3, 2, 0.1));
  assert.ok(evs.some((e) => e.type === 'passedAuthorised'));
  assert.ok(!evs.some((e) => e.type === 'spad'));
  const st = { restriction: null, failedSignal: { passed: false } };
  const next = nextStopSignalAfter(sg, auto.s);
  startCautiousRun(st, { signalS: auto.s, nextStopSignalS: next.s, obscured: false });
  assert.equal(incidentLimitAt(st, auto.s + 50), 15);
  startCautiousRun(st, { signalS: auto.s, nextStopSignalS: next.s, obscured: true });
  assert.equal(incidentLimitAt(st, auto.s + 50), 8);
  const ev = updateIncidents(st, { front: next.s + 1, speed: 2, dt: 0.1 });
  assert.ok(ev.some((e) => e.type === 'restrictionEnded'));
  assert.equal(incidentLimitAt(st, next.s + 1), Infinity);
});

test('passing a failed automatic signal before the wait is a SPAD', () => {
  const sg = createSignalling(routes['ndls-gzb'], { holdChance: 0 });
  const auto = sg.up.find((s) => s.kind === 'auto' && s.s > 2500);
  failSignal(sg, auto.s, 60);
  updateSignalling(sg, { front: auto.s - 5, speed: 10, dt: 0.1, stopIndex: 0, rightAway: [], aiSpans: [] });
  const evs = updateSignalling(sg, { front: auto.s + 1, speed: 10, dt: 0.1, stopIndex: 0, rightAway: [], aiSpans: [] });
  assert.ok(evs.some((e) => e.type === 'spad'));
});

// ------------------------------------------------------------ alarm chain
test('ACP: the vent drains the brake pipe and applies the brakes; it stays open until the reset', () => {
  const cfg = trainConfigFor('wap7');
  const train = createTrainState({ startDistance: 1000, minDistance: 0, maxDistance: 1e6, coachCount: 12, cfg });
  train.brakeHandle = 0;
  train.bp = cfg.bpNormal;
  train.speedMps = 25;
  train.direction = 1;
  const st = { acp: { s: 1100, coach: 4, phase: 'pending', resetLeft: 120, codeSounded: false }, restriction: null };
  let events = [];
  let t = 0;
  while (t < 400) {
    events.push(...updateIncidents(st, { front: train.routeDistance, speed: train.speedMps, dt: 0.1, hornCode: t > 30 && t < 30.2 ? 'o o --' : null }));
    stepTrain(train, {}, 0.1, cfg, { ...incidentInputs(st) });
    t += 0.1;
    if (st.acp.phase === 'done') break;
  }
  const types = events.map((e) => e.type);
  assert.deepEqual(types.filter((x) => x !== 'acpCode'), ['acpPulled', 'acpStopped', 'acpReset']);
  assert.ok(st.acp.codeSounded);
  assert.equal(train.speedMps, 0);
  assert.ok(train.bp < 1, `bp ${train.bp}`);
  assert.ok(!incidentInputs(st).ventBp); // reset: the driver can recharge now
  const sum = summarizeIncidents(st);
  assert.equal(sum[0].kind, 'acp');
  assert.ok(sum[0].ok);
});

// ------------------------------------------------------------ Doppler
test('Doppler: higher pitch approaching, lower receding, 1 when abeam', () => {
  const lis = { x: 0, z: 0 };
  const still = { x: 0, z: 0 };
  // source 200 m away coming at 30 m/s: f'/f = 343 / (343 − 30)
  const up = dopplerFactor({ x: 200, z: 5 }, { x: -30, z: 0 }, lis, still);
  assert.ok(Math.abs(up - 343 / 313) < 0.005, String(up));
  const down = dopplerFactor({ x: -200, z: 5 }, { x: -30, z: 0 }, lis, still);
  assert.ok(Math.abs(down - 343 / 373) < 0.005, String(down));
  const abeam = dopplerFactor({ x: 0, z: 5 }, { x: -30, z: 0 }, lis, still);
  assert.ok(Math.abs(abeam - 1) < 1e-9);
  // a listener moving towards the source raises the pitch further
  assert.ok(dopplerFactor({ x: 200, z: 5 }, { x: -30, z: 0 }, lis, { x: 30, z: 0 }) > up);
  assert.equal(nearestOnSpan(50, 100, 400), 100);
  assert.equal(nearestOnSpan(250, 100, 400), 250);
});

// ------------------------------------------------------------ D1 announcement text
import { arrivalAnnouncement } from '../audio/announcements.js';
test('arrival announcement: Hindi opens with "यात्रीगण कृपया ध्यान दें", names the route and platform 1', () => {
  const r = routes['ndls-gzb'];
  const [o, d] = [r.stations[0], r.stations.at(-1)];
  const a = arrivalAnnouncement({ origin: o, destination: d, station: { id: 'x' } });
  assert.ok(a.hindi.startsWith('यात्रीगण कृपया ध्यान दें'));
  assert.ok(a.hindi.includes(o.hindi) && a.hindi.includes(d.hindi) && a.hindi.includes('प्लेटफ़ॉर्म संख्या एक'));
  assert.ok(a.english.includes(`from ${o.name} to ${d.name}`) && a.english.includes('platform number 1'));
  const fin = arrivalAnnouncement({ origin: o, destination: d, station: d });
  assert.ok(fin.english.includes(`The train from ${o.name} is arriving`));
});

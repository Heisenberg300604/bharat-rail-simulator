// Kavach, VCD and adhesion (run with: npm test)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createKavach, updateKavach, curveSpeed, KAVACH } from './kavach.js';
import { createVcd, updateVcd, VCD } from './vcd.js';
import { createTrainState, stepTrain, adhesionMu, ADHESION } from './trainSimulation.js';
import { TRAIN, FIXED_TIMESTEP, trainConfigFor } from '../config/gameConfig.js';

const DT = FIXED_TIMESTEP;
const NO = { leverUp: false, leverDown: false, brakeApply: false, brakeRelease: false };

// ---------------------------------------------------------------- Kavach
test('Kavach: within the limit nothing happens; +2 warns, +5 brakes, +10 is emergency', () => {
  const k = createKavach();
  const at = (kmh) => updateKavach(k, { speedMps: kmh / 3.6, lineLimitKmh: 100, limitsAhead: [] });
  at(100);
  assert.equal(k.state, 'normal');
  assert.equal(at(103), 'warn');
  assert.equal(k.brakeDemand, 0);
  assert.equal(at(106), 'intervene');
  assert.ok(k.brakeDemand > 0);
  at(111);
  assert.equal(k.state, 'emergency');
  assert.equal(k.interventions, 1);
});

test('Kavach holds the brake until the train is back at the permitted speed', () => {
  const k = createKavach();
  updateKavach(k, { speedMps: 107 / 3.6, lineLimitKmh: 100, limitsAhead: [] });
  updateKavach(k, { speedMps: 103 / 3.6, lineLimitKmh: 100, limitsAhead: [] });
  assert.ok(k.brakeDemand > 0, 'still braking at +3');
  updateKavach(k, { speedMps: 99.5 / 3.6, lineLimitKmh: 100, limitsAhead: [] });
  assert.equal(k.brakeDemand, 0);
});

test('Kavach: a red signal ahead lowers the permitted speed along a braking curve to 0', () => {
  const k = createKavach();
  updateKavach(k, { speedMps: 25, lineLimitKmh: 110, limitsAhead: [], redAhead: { distance: 300, name: 'Home' } });
  assert.equal(k.target.label, 'EoA');
  assert.ok(k.permittedKmh < 110 && k.permittedKmh < curveSpeed(1000, 0, 25));
  updateKavach(k, { speedMps: 0, lineLimitKmh: 110, limitsAhead: [], redAhead: { distance: 0.5, name: 'Home' } });
  assert.ok(k.permittedKmh < 5);
});

test('Kavach trips (emergency) 30 m past a red signal', () => {
  const k = createKavach();
  assert.equal(updateKavach(k, { speedMps: 5, lineLimitKmh: 30, limitsAhead: [], passedRedBy: KAVACH.tripPast + 1 }), 'trip');
  assert.equal(k.emergency, true);
});

// ---------------------------------------------------------------- VCD
test('VCD: 60 s without acting → 8 s warning → penalty; acting resets it', () => {
  const v = createVcd();
  const run = (s, ack = false) => {
    const evs = [];
    for (let t = 0; t < s; t += 0.5) {
      const e = updateVcd(v, { speedKmh: 60, ack, leverZero: false, dt: 0.5 });
      if (e) evs.push(e);
    }
    return evs;
  };
  assert.deepEqual(run(59.5), []);
  assert.deepEqual(run(1), ['warn']);
  run(1, true);
  assert.equal(v.phase, 'ok');
  assert.deepEqual(run(VCD.cycle + VCD.warn + 0.5), ['warn', 'penalty']);
  assert.equal(v.penalties, 1);
});

test('VCD is idle below 1.5 km/h and needs 160 s + throttle at 0 to reset after a penalty', () => {
  const v = createVcd();
  for (let t = 0; t < 200; t++) updateVcd(v, { speedKmh: 1, ack: false, dt: 1 });
  assert.equal(v.phase, 'ok');
  v.phase = 'penalty';
  v.penaltyT = 0;
  assert.equal(updateVcd(v, { speedKmh: 0, ack: true, leverZero: true, dt: 100 }), null);
  assert.equal(updateVcd(v, { speedKmh: 0, ack: true, leverZero: false, dt: 70 }), null);
  assert.equal(updateVcd(v, { speedKmh: 0, ack: true, leverZero: true, dt: 1 }), 'reset');
});

// ---------------------------------------------------------------- adhesion
test('dry rail: the WAP-7 never slips; wet rail: full power from a stand slips', () => {
  for (const [mu, expectSlip] of [
    [adhesionMu({}), false],
    [adhesionMu({ rain: 1 }), true],
  ]) {
    const t = createTrainState({ startDistance: 300, minDistance: 0, maxDistance: 1e5, coachCount: 8, cfg: TRAIN });
    for (let s = 0; s < 6; s += DT) stepTrain(t, { ...NO, brakeRelease: true }, DT, TRAIN, { mu });
    let slipped = false;
    for (let s = 0; s < 8; s += DT) {
      stepTrain(t, { ...NO, leverUp: true }, DT, TRAIN, { mu });
      slipped ||= t.slipping;
    }
    assert.equal(slipped, expectSlip, `µ=${mu}`);
  }
});

test('sand restores adhesion on wet rail', () => {
  assert.ok(adhesionMu({ rain: 1, sanding: true }) > adhesionMu({ rain: 1 }) + 0.05);
  assert.ok(adhesionMu({ sanding: true }) <= ADHESION.dry + 0.02);
});

test('extraBrake from Kavach applies the train brake; cutTraction removes power', () => {
  const cfg = trainConfigFor('wap7');
  const t = createTrainState({ startDistance: 300, minDistance: 0, maxDistance: 1e5, coachCount: 8, cfg });
  t.brakeHandle = 0;
  t.bp = 5;
  t.bc = 0;
  t.brakeSignal = 0;
  t.speedMps = 20;
  for (let s = 0; s < 5; s += DT) stepTrain(t, NO, DT, cfg, { extraBrake: 1, cutTraction: true });
  assert.ok(t.bc > 1.5, `bc ${t.bc}`);
  assert.ok(t.speedMps < 20);
});

// ---------------------------------------------------------------- new locos (sourced figures)
test('WAP-4 has no regenerative brake: BE on the lever gives no braking effort', () => {
  const cfg = trainConfigFor('wap4');
  const t = createTrainState({ startDistance: 300, minDistance: 0, maxDistance: 1e5, coachCount: 8, cfg });
  t.brakeHandle = 0;
  t.bp = 5;
  t.bc = 0;
  t.brakeSignal = 0;
  t.speedMps = 25;
  for (let s = 0; s < 4; s += DT) stepTrain(t, { ...NO, leverDown: true }, DT, cfg);
  assert.equal(t.forces.regen, 0);
});

test('WAP-5 runs to 160 km/h; the WAP-7 is held at 140', () => {
  for (const [id, max] of [
    ['wap5', 160],
    ['wap7', 140],
  ]) {
    const cfg = { ...trainConfigFor(id), coach: { ...TRAIN.coach, massT: 50 } };
    const t = createTrainState({ startDistance: 300, minDistance: 0, maxDistance: 1e6, coachCount: 4, cfg });
    t.brakeHandle = 0;
    t.bp = 5;
    t.bc = 0;
    t.brakeSignal = 0;
    for (let s = 0; s < 900; s += DT) stepTrain(t, { ...NO, leverUp: t.lever < 1 }, DT, cfg);
    assert.ok(Math.abs(t.speedMps * 3.6 - max) < 4, `${id} reached ${(t.speedMps * 3.6).toFixed(1)}`);
  }
});

test('the light WAP-5 slips on wet rail where it would not on dry', () => {
  const cfg = trainConfigFor('wap5');
  const t = createTrainState({ startDistance: 300, minDistance: 0, maxDistance: 1e5, coachCount: 8, cfg });
  for (let s = 0; s < 6; s += DT) stepTrain(t, { ...NO, brakeRelease: true }, DT, cfg, { mu: adhesionMu({ rain: 1 }) });
  let slipped = false;
  for (let s = 0; s < 8; s += DT) {
    stepTrain(t, { ...NO, leverUp: true }, DT, cfg, { mu: adhesionMu({ rain: 1 }) });
    slipped ||= t.slipping;
  }
  assert.ok(slipped);
});

test('WCAM-1 (AC mode): 120 km/h maximum and no dynamic brake', () => {
  const cfg = trainConfigFor('wcam1');
  assert.equal(cfg.locoMaxKmh, 120);
  assert.equal(cfg.regenMax_kN, 0);
  assert.equal(cfg.loco.massT, 112.8);
});

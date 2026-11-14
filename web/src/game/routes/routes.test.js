// Route data, vertical profile, gradients, multi-stop journeys and terrain.
// Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ROUTE_DEFS } from './index.js';
import { buildRoute, yardTrackSpans } from './buildRoute.js';
import { validateRoute } from './validateRoute.js';
import { setActiveRoute } from './activeRoute.js';
import { createProfile, computeFormation } from '../simulation/routeMath.js';
import { createTrainState, stepTrain, speedLimitFor, maxTractiveEffort } from '../simulation/trainSimulation.js';
import { createJourney, updateJourney, JOURNEY_STATE, scoreJourney } from '../simulation/journeyManager.js';
import { TRAIN, FORMATION, COACH_TYPES, FIXED_TIMESTEP, trainConfigFor, consistFor } from '../config/gameConfig.js';
import { createTerrain } from '../world/terrain.js';

const DT = FIXED_TIMESTEP;
const NO_INPUT = { leverUp: false, leverDown: false, brakeApply: false, brakeRelease: false };
const built = ROUTE_DEFS.map(buildRoute);

// ---------------------------------------------------------------- data
for (const r of built) {
  test(`route "${r.id}" is valid`, () => {
    assert.deepEqual(validateRoute(r), []);
  });
}

test('route ids are unique and the classic Delhi route is unchanged', () => {
  assert.equal(new Set(built.map((r) => r.id)).size, built.length);
  const d = built.find((r) => r.id === 'ndls-gzb');
  assert.equal(d.length, 8000);
  assert.equal(d.journey.stopMarker, 7635);
  assert.equal(d.journey.startDistance, 410);
  assert.equal(d.journey.stops.length, 1);
  assert.equal(d.geometry.heightAt(4000), 0);
});

test('timetable times increase along the route and include the dwell', () => {
  for (const r of built) {
    let prev = 0;
    for (const st of r.journey.stops) {
      assert.ok(st.scheduled > prev, `${r.id}: ${st.stationId} due ${st.scheduled} after ${prev}`);
      assert.equal(st.scheduled % 15, 0);
      prev = st.scheduled + st.dwell;
    }
  }
});

test('single-line routes run no opposing AI trains (they wait in loops instead)', () => {
  for (const r of built.filter((x) => !x.double)) assert.equal(r.aiTrains.length, 0);
});

test('yard tracks fan out from the right running line and stay within the route', () => {
  for (const r of built) {
    for (const sp of yardTrackSpans(r)) {
      if (r.double && sp.track.offset < 0) assert.equal(sp.base, -5.3);
      else assert.equal(sp.base, 0);
      assert.ok(sp.atStart || sp.fanStart > 0, `${r.id} ${sp.station.id}-${sp.track.id}`);
    }
  }
});

// ---------------------------------------------------------------- profile
test('vertical profile: constant gradients joined by smooth vertical curves', () => {
  const p = createProfile([
    { s: 0, z: 0 },
    { s: 1000, z: 0 },
    { s: 4700, z: 100 },
  ]);
  assert.equal(p.heightAt(500), 0);
  assert.ok(Math.abs(p.gradeAt(3000) - 1 / 37) < 1e-9);
  assert.ok(Math.abs(p.heightAt(4700) - 100) < 1e-9);
  // continuous height and gradient through the vertical curve at 1000 m
  for (let s = 850; s < 1150; s += 1) {
    assert.ok(Math.abs(p.heightAt(s + 1) - p.heightAt(s) - p.gradeAt(s + 0.5)) < 1e-3);
  }
});

test('the Bhor Ghat climbs ~200 m at up to 1 in 37', () => {
  const r = built.find((x) => x.id === 'bhor-ghat');
  const rise = r.geometry.heightAt(13500) - r.geometry.heightAt(300);
  assert.ok(rise > 190 && rise < 230, `rise ${rise}`);
  let steepest = 0;
  for (let s = 0; s < r.length; s += 10) steepest = Math.max(steepest, r.geometry.gradeAt(s));
  assert.ok(Math.abs(1 / steepest - 37) < 1, `steepest 1 in ${(1 / steepest).toFixed(1)}`);
});

// ---------------------------------------------------------------- physics on gradients
function heavyTrain(cfg, coaches) {
  return createTrainState({ startDistance: 300, minDistance: 0, maxDistance: 1e6, coachCount: coaches, cfg });
}
function release(train, cfg, grade = 0, extra = {}) {
  for (let t = 0; t < 12; t += DT) stepTrain(train, { ...NO_INPUT, brakeRelease: true }, DT, cfg, { grade, ...extra });
}

test('on a 1 in 37 climb the passenger train still accelerates, but slower than on the level', () => {
  const level = heavyTrain(TRAIN, 8);
  const climb = heavyTrain(TRAIN, 8);
  release(level, TRAIN);
  release(climb, TRAIN, 1 / 37);
  for (let t = 0; t < 60; t += DT) {
    stepTrain(level, { ...NO_INPUT, leverUp: true }, DT, TRAIN, {});
    stepTrain(climb, { ...NO_INPUT, leverUp: true }, DT, TRAIN, { grade: 1 / 37 });
  }
  assert.ok(climb.speedMps > 3, `climb ${climb.speedMps}`);
  assert.ok(climb.speedMps < level.speedMps * 0.75, `climb ${climb.speedMps} vs level ${level.speedMps}`);
  assert.ok(climb.forces.gradient < -100, `gravity ${climb.forces.gradient.toFixed(0)} kN`);
});

test('released brakes on a falling gradient: the train runs away downhill', () => {
  const train = heavyTrain(TRAIN, 8);
  release(train, TRAIN, -1 / 37);
  for (let t = 0; t < 30; t += DT) stepTrain(train, NO_INPUT, DT, TRAIN, { grade: -1 / 37 });
  assert.ok(train.speedMps > 5, `rolled to ${train.speedMps}`);
});

test('full-service brakes hold a train on 1 in 37', () => {
  const train = heavyTrain(TRAIN, 8);
  for (let t = 0; t < 20; t += DT) stepTrain(train, NO_INPUT, DT, TRAIN, { grade: -1 / 37 });
  assert.equal(train.speedMps, 0);
});

test('a heavy coal train stalls on the ghat with one WAG-9 but climbs with two bankers', () => {
  const consist = consistFor('freight');
  const alone = trainConfigFor('wag9', 'freight');
  const banked = { ...alone, bankerMassT: 2 * 123 };
  const wag9 = trainConfigFor('wag9');
  const a = heavyTrain(alone, consist.count);
  const b = heavyTrain(banked, consist.count);
  release(a, alone, 1 / 37);
  release(b, banked, 1 / 37);
  for (let t = 0; t < 90; t += DT) {
    stepTrain(a, { ...NO_INPUT, leverUp: true }, DT, alone, { grade: 1 / 37 });
    stepTrain(b, { ...NO_INPUT, leverUp: true }, DT, banked, { grade: 1 / 37, bankerTE_kN: 2 * maxTractiveEffort(b.speedMps, wag9) });
  }
  assert.ok(a.speedMps < 0.5, `unbanked reached ${a.speedMps}`);
  assert.ok(b.speedMps > 3, `banked reached ${b.speedMps}`);
});

// ---------------------------------------------------------------- multi-stop journeys
const CFG = {
  startDistance: 400,
  stopMarker: 5000,
  stopZoneHalfLength: 30,
  approachDistance: 1500,
  stopHoldSeconds: 3,
  stops: [
    { stationId: 'a', name: 'Halt A', marker: 2000, halfLength: 30, dwell: 10, scheduled: 120 },
    { stationId: 'b', name: 'Terminus', marker: 5000, halfLength: 30, dwell: 0, scheduled: 300, final: true },
  ],
};
const moving = (s) => ({ routeDistance: s, speedMps: 10, maxSpeedReachedMps: 20, emergency: false });
const stoppedAt = (s) => ({ routeDistance: s, speedMps: 0, maxSpeedReachedMps: 20, emergency: false });

test('halt: stop, hold, dwell, right-away, then on to the destination', () => {
  const j = createJourney();
  updateJourney(j, moving(450), 1, CFG);
  assert.equal(j.state, JOURNEY_STATE.RUNNING);
  for (let t = 0; t < 3.5; t += 0.5) updateJourney(j, stoppedAt(2004), 0.5, CFG);
  assert.equal(j.state, JOURNEY_STATE.DWELL);
  assert.deepEqual(j.events, ['arrived']);
  for (let t = 0; t < 10.5; t += 0.5) updateJourney(j, stoppedAt(2004), 0.5, CFG);
  assert.equal(j.state, JOURNEY_STATE.RUNNING);
  assert.equal(j.stopIndex, 1);
  assert.deepEqual(j.events, ['arrived', 'rightAway']);
  for (let t = 0; t < 3.5; t += 0.5) updateJourney(j, stoppedAt(4998), 0.5, CFG);
  assert.equal(j.state, JOURNEY_STATE.COMPLETED);
  assert.equal(j.result.stops.length, 2);
  assert.equal(j.result.missedStops, 0);
});

test('running through a halt is a missed stop (−20)', () => {
  const j = createJourney();
  updateJourney(j, moving(500), 1, CFG);
  updateJourney(j, moving(2300), 1, CFG);
  assert.equal(j.stopIndex, 1);
  assert.deepEqual(j.events, ['missed']);
  for (let t = 0; t < 3.5; t += 0.5) updateJourney(j, stoppedAt(5000), 0.5, CFG);
  assert.equal(j.result.missedStops, 1);
  assert.ok(j.result.score <= 80);
});

test('leaving a halt before the right-away costs points', () => {
  const j = createJourney();
  updateJourney(j, moving(500), 1, CFG);
  for (let t = 0; t < 3.5; t += 0.5) updateJourney(j, stoppedAt(2000), 0.5, CFG);
  updateJourney(j, moving(2001), 0.5, CFG);
  assert.equal(j.earlyDepartures, 1);
  assert.equal(j.stopIndex, 1);
});

test('lateness beyond 30 s is penalised, being on time is not', () => {
  const base = { overspeedSeconds: 0, maxOverspeedKmh: 0, emergencyUsed: false, earlyDepartures: 0 };
  const onTime = scoreJourney(0, { ...base, stopResults: [{ offset: 0, scheduled: 300, late: 20 }] });
  const late = scoreJourney(0, { ...base, stopResults: [{ offset: 0, scheduled: 300, late: 130 }] });
  assert.equal(onTime, 100);
  assert.equal(late, 90);
});

// ---------------------------------------------------------------- every route can be driven
for (const r of built) {
  test(`an automatic driver completes ${r.meta.name}, stopping at every halt`, () => {
    const total = computeFormation({ ...FORMATION, coach: COACH_TYPES.lhb }).totalLength;
    const J = r.journey;
    const L = r.speedLimits;
    const train = createTrainState({ startDistance: J.startDistance, minDistance: total + 5, maxDistance: J.bufferStop, coachCount: 8, cfg: TRAIN });
    const journey = createJourney();
    const A = 0.3;
    let t = 0;
    while (journey.state !== JOURNEY_STATE.COMPLETED && t < 3000) {
      const front = train.routeDistance;
      const limit = speedLimitFor(L, front - total, front);
      const stop = J.stops[journey.stopIndex];
      let target = limit - 5;
      for (const l of L) if (l.from > front && l.kmh < target) target = Math.min(target, Math.sqrt((l.kmh - 5) ** 2 / 12.96 + 2 * A * Math.max(0, l.from - front - 150)) * 3.6);
      const remaining = stop.marker - front;
      target = Math.min(target, Math.sqrt(Math.max(0, 2 * A * (remaining - 40))) * 3.6 + 3);
      const v = train.speedMps * 3.6;
      const input = { ...NO_INPUT };
      if (journey.state === JOURNEY_STATE.DWELL || remaining < 2) input.brakeApply = true;
      else if (v < target - 3) {
        input.brakeRelease = true;
        if (train.lever < 0.9) input.leverUp = true;
      } else if (v > target + 2) {
        if (train.lever > -0.6) input.leverDown = true;
        if (v > target + 6) input.brakeApply = true;
        else input.brakeRelease = true;
      } else {
        input.brakeRelease = true;
        if (train.lever > 0.15 && train.grade < 0.005) input.leverDown = true;
        if (train.grade > 0.005 && train.lever < 0.6) input.leverUp = true;
      }
      const grade = (r.geometry.heightAt(front) - r.geometry.heightAt(front - total)) / total;
      stepTrain(train, input, DT, TRAIN, { grade });
      updateJourney(journey, train, DT, J, limit);
      t += DT;
    }
    assert.equal(journey.state, JOURNEY_STATE.COMPLETED, `ended at s=${train.routeDistance.toFixed(0)} v=${(train.speedMps * 3.6).toFixed(1)} state=${journey.state}`);
    assert.equal(journey.result.missedStops, 0);
    assert.equal(journey.result.earlyDepartures, 0);
    assert.ok(journey.result.maxOverspeedKmh < 6, `overspeed ${journey.result.maxOverspeedKmh.toFixed(1)}`);
    assert.ok(t < r.journey.stopMarker / 4, `took ${t.toFixed(0)} s`);
    console.log(`  ${r.id}: ${(t / 60).toFixed(1)} min (due ${(J.stops.at(-1).scheduled / 60).toFixed(1)}), max ${journey.result.maxSpeedKmh.toFixed(0)} km/h, score ${journey.result.score}`);
  });
}

// ---------------------------------------------------------------- terrain
test('terrain: level formation under the track, ground below bridge decks, hill above tunnels', () => {
  for (const r of built) {
    setActiveRoute(r.id);
    const T = createTerrain(r);
    for (let s = 100; s < r.length - 100; s += 97) {
      const ty = r.geometry.heightAt(s);
      const inTunnel = r.tunnels.some((tn) => s >= tn.from && s <= tn.to);
      const onBridge = r.bridges.some((b) => b.track !== false && s > b.from - 4 && s < b.to + 4);
      const g = T.groundY(s, 0);
      if (inTunnel) assert.ok(g > ty + T.bore.crown, `${r.id} ${s}: tunnel cover ${g - ty}`);
      else if (onBridge) assert.ok(g < ty - 2, `${r.id} ${s}: ground under the deck ${g - ty}`);
      else assert.ok(Math.abs(g - (ty - 0.05)) < 1e-6, `${r.id} ${s}: formation ${g} vs ${ty}`);
    }
  }
  setActiveRoute('ndls-gzb');
});

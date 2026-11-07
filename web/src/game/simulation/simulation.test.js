// Run with: npm test   (uses Node's built-in test runner, no extra packages)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRoute, vehiclePose, computeFormation } from './routeMath.js';
import { createTrainState, stepTrain, cycleDirection, createFixedStepper, DIRECTION } from './trainSimulation.js';
import { createJourney, updateJourney, JOURNEY_STATE } from './journeyManager.js';
import { TRAIN, ROUTE_SEGMENTS, JOURNEY, FORMATION, FIXED_TIMESTEP } from '../config/gameConfig.js';

const DT = FIXED_TIMESTEP;
const NO_INPUT = { throttleUp: false, throttleDown: false, brakeApply: false, brakeRelease: false };

function newTrain(start = 300) {
  return createTrainState({ startDistance: start, minDistance: 0, maxDistance: 8000 });
}
function run(train, input, seconds) {
  for (let t = 0; t < seconds; t += DT) stepTrain(train, input, DT, TRAIN);
}
/** Release brakes and set full throttle by holding keys. */
function readyToDrive(train) {
  run(train, { ...NO_INPUT, brakeRelease: true, throttleUp: true }, 3);
}

// ---------------------------------------------------------------- route
test('route length is the sum of its segments', () => {
  const route = createRoute(ROUTE_SEGMENTS);
  assert.equal(route.length, 8000);
});

test('straight route samples exactly', () => {
  const route = createRoute([{ type: 'straight', length: 100 }]);
  const p = route.sample(40);
  assert.ok(Math.abs(p.x - 40) < 1e-9 && Math.abs(p.z) < 1e-9);
});

test('a quarter-circle arc ends at the right place and heading', () => {
  const R = 100;
  const route = createRoute([{ type: 'arc', length: (Math.PI / 2) * R, radius: R, turn: 'right' }]);
  const end = route.sample(route.length);
  assert.ok(Math.abs(end.x - R) < 1e-6, `x=${end.x}`);
  assert.ok(Math.abs(end.z - R) < 1e-6, `z=${end.z}`);
  assert.ok(Math.abs(end.heading - Math.PI / 2) < 1e-9);
});

test('route is continuous across segment boundaries', () => {
  const route = createRoute(ROUTE_SEGMENTS);
  for (const seg of route.segments.slice(1)) {
    const a = route.sample(seg.startS - 1e-6);
    const b = route.sample(seg.startS + 1e-6);
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-3);
    assert.ok(Math.abs(a.heading - b.heading) < 1e-3);
  }
});

test('route sampling clamps outside the route', () => {
  const route = createRoute(ROUTE_SEGMENTS);
  assert.deepEqual(route.sample(-50).x, route.sample(0).x);
  assert.deepEqual(route.sample(99999).x, route.sample(route.length).x);
});

test('vehicle pose sits on the track on a straight', () => {
  const route = createRoute([{ type: 'straight', length: 500 }]);
  const pose = vehiclePose(route, 200, 10);
  assert.ok(Math.abs(pose.x - 200) < 1e-9);
  assert.ok(Math.abs(pose.yaw) < 1e-9);
});

test('formation places coaches behind the locomotive with gaps', () => {
  const { vehicles, totalLength } = computeFormation(FORMATION);
  assert.equal(vehicles.length, 1 + FORMATION.coachCount);
  assert.equal(vehicles[0].kind, 'locomotive');
  for (let i = 1; i < vehicles.length; i++) {
    const prev = vehicles[i - 1];
    const cur = vehicles[i];
    const gap = cur.centerOffset - cur.length / 2 - (prev.centerOffset + prev.length / 2);
    assert.ok(Math.abs(gap - FORMATION.couplingGap) < 1e-9);
  }
  assert.ok(totalLength > 90 && totalLength < 100);
});

// ---------------------------------------------------------------- train
test('train starts stationary with brakes applied and does not move', () => {
  const train = newTrain();
  run(train, NO_INPUT, 5);
  assert.equal(train.speedMps, 0);
  assert.equal(train.routeDistance, 300);
});

test('throttle accelerates gradually (no instant speed)', () => {
  const train = newTrain();
  readyToDrive(train);
  const v1 = train.speedMps;
  run(train, NO_INPUT, 10);
  assert.ok(train.speedMps > v1, 'speed should increase');
  assert.ok(train.speedMps < 6, `still gradual after ~13s, got ${train.speedMps}`);
  assert.ok(train.routeDistance > 300);
});

test('speed never exceeds the cap', () => {
  const train = newTrain(10);
  train.maxDistance = 1e9;
  readyToDrive(train);
  run(train, NO_INPUT, 600);
  assert.ok(train.speedMps <= TRAIN.maxSpeedKmh / 3.6 + 1e-9);
  assert.ok(train.speedMps > TRAIN.maxSpeedKmh / 3.6 - 1, 'should reach near max speed');
});

test('coasting slows the train only slightly', () => {
  const train = newTrain(10);
  train.maxDistance = 1e9;
  train.brake = train.brakeEffective = 0;
  train.speedMps = 25;
  run(train, NO_INPUT, 10);
  assert.ok(train.speedMps < 25 && train.speedMps > 23, `got ${train.speedMps}`);
});

test('brakes decelerate gradually, need distance, and hold the train at rest', () => {
  const train = newTrain(10);
  train.maxDistance = 1e9;
  train.brake = train.brakeEffective = 0;
  train.speedMps = 100 / 3.6;
  // One fixed step of full braking must not stop the train
  stepTrain(train, { ...NO_INPUT, brakeApply: true }, DT, TRAIN);
  assert.ok(train.speedMps > 27);
  const startS = train.routeDistance;
  run(train, { ...NO_INPUT, brakeApply: true }, 90);
  assert.equal(train.speedMps, 0);
  const stoppingDistance = train.routeDistance - startS;
  assert.ok(stoppingDistance > 350, `stopping distance ${stoppingDistance}`);
  const restS = train.routeDistance;
  run(train, NO_INPUT, 10);
  assert.equal(train.routeDistance, restS, 'stays stopped');
});

test('direction cannot change while moving, but can when stopped', () => {
  const train = newTrain();
  train.speedMps = 5;
  const res = cycleDirection(train, TRAIN);
  assert.equal(res.ok, false);
  assert.equal(train.direction, DIRECTION.FORWARD);
  train.speedMps = 0;
  assert.equal(cycleDirection(train, TRAIN).ok, true);
  assert.equal(train.direction, DIRECTION.NEUTRAL);
});

test('neutral gives no traction; reverse moves backwards', () => {
  const train = newTrain();
  cycleDirection(train, TRAIN); // neutral
  readyToDrive(train);
  run(train, { ...NO_INPUT }, 5);
  assert.equal(train.speedMps, 0);
  cycleDirection(train, TRAIN); // reverse
  run(train, NO_INPUT, 5);
  assert.ok(train.routeDistance < 300);
});

test('train stops at the end of track', () => {
  const train = newTrain(7990);
  train.speedMps = 10;
  train.brake = train.brakeEffective = 0;
  run(train, NO_INPUT, 3);
  assert.equal(train.routeDistance, 8000);
  assert.equal(train.speedMps, 0);
});

test('fixed stepper caps huge frame delays', () => {
  const stepper = createFixedStepper(DT, 0.1);
  let steps = 0;
  stepper.advance(5, () => steps++); // a 5 s browser stall
  assert.ok(steps <= Math.ceil(0.1 / DT));
});

// ---------------------------------------------------------------- journey
test('journey completes only after holding a stop in the zone', () => {
  const train = newTrain(JOURNEY.stopMarker - 2);
  const journey = createJourney();
  journey.state = JOURNEY_STATE.APPROACHING;
  updateJourney(journey, train, 1, JOURNEY);
  assert.equal(journey.state, JOURNEY_STATE.STOPPED);
  updateJourney(journey, train, JOURNEY.stopHoldSeconds, JOURNEY);
  assert.equal(journey.state, JOURNEY_STATE.COMPLETED);
  assert.equal(journey.result.stopRating, 'Excellent');
});

test('stopping outside the zone does not complete the journey', () => {
  const train = newTrain(JOURNEY.stopMarker + 200);
  const journey = createJourney();
  journey.state = JOURNEY_STATE.RUNNING;
  for (let i = 0; i < 20; i++) updateJourney(journey, train, 1, JOURNEY);
  assert.notEqual(journey.state, JOURNEY_STATE.COMPLETED);
});

test('a scripted full drive from New Delhi to Ghaziabad completes in 4–10 minutes', () => {
  const train = createTrainState({ startDistance: JOURNEY.startDistance, minDistance: 100, maxDistance: JOURNEY.bufferStop });
  const journey = createJourney();
  let t = 0;
  while (journey.state !== JOURNEY_STATE.COMPLETED && t < 1200) {
    const remaining = JOURNEY.stopMarker - train.routeDistance;
    // Simple "driver": full power, then brake when within braking distance (+ margin)
    const v = train.speedMps;
    const brakingDistance = (v * v) / (2 * 0.6 * TRAIN.maxBrakeDecel) + v * TRAIN.brakeResponseTime + 5;
    const shouldBrake = remaining < brakingDistance || remaining < 1;
    const input = shouldBrake
      ? { ...NO_INPUT, brakeApply: true, throttleDown: true }
      : { ...NO_INPUT, brakeRelease: true, throttleUp: true };
    stepTrain(train, input, DT, TRAIN);
    updateJourney(journey, train, DT, JOURNEY);
    t += DT;
  }
  assert.equal(journey.state, JOURNEY_STATE.COMPLETED, `ended at s=${train.routeDistance}`);
  assert.ok(t > 240 && t < 600, `journey took ${t.toFixed(0)} s`);
});

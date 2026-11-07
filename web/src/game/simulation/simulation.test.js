// Run with: npm test   (uses Node's built-in test runner, no extra packages)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createRoute, vehiclePose, computeFormation } from './routeMath.js';
import { createTrainState, stepTrain, cycleDirection, createFixedStepper, applyEmergency, speedLimitFor, DIRECTION } from './trainSimulation.js';
import { createJourney, updateJourney, JOURNEY_STATE } from './journeyManager.js';
import { createAiTrains, stepAiTrains } from './aiTraffic.js';
import { TRAIN, ROUTE_SEGMENTS, JOURNEY, FORMATION, COACH_TYPES, AI_TRAINS, LEVEL_CROSSING, FIXED_TIMESTEP, SPEED_LIMITS } from '../config/gameConfig.js';
import { coachVariantKey } from '../world/models/coaches.js';

const DT = FIXED_TIMESTEP;
const NO_INPUT = { leverUp: false, leverDown: false, brakeApply: false, brakeRelease: false };

function newTrain(start = 300) {
  return createTrainState({ startDistance: start, minDistance: 0, maxDistance: 8000, coachCount: FORMATION.coachCount, cfg: TRAIN });
}
function run(train, input, seconds) {
  for (let t = 0; t < seconds; t += DT) stepTrain(train, input, DT, TRAIN);
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
  assert.ok(totalLength > 205 && totalLength < 220, `length ${totalLength}`); // WAP-7 + 8 LHB ≈ 213 m
});

// ---------------------------------------------------------------- train
const KMH = 1 / 3.6;
function cruising(kmh, start = 1000) {
  const t = newTrain(start);
  t.maxDistance = 1e9;
  t.brakeHandle = 0;
  t.bp = TRAIN.bpNormal;
  t.bc = t.brakeSignal = 0;
  t.speedMps = kmh * KMH;
  return t;
}

test('train starts held by the brakes; traction is cut while the brake pipe is low', () => {
  const train = newTrain();
  run(train, { ...NO_INPUT, leverUp: true }, 3);
  assert.equal(train.speedMps, 0);
  assert.equal(train.routeDistance, 300);
  assert.ok(train.tractionCut);
});

test('releasing the A9 brake recharges the brake pipe, cylinders release slowly', () => {
  const train = newTrain();
  run(train, { ...NO_INPUT, brakeRelease: true }, 2.5);
  assert.ok(train.bp > 4.9, `bp ${train.bp}`);
  assert.ok(train.bc > 0.5, 'brake cylinders should still be releasing');
  run(train, NO_INPUT, 20);
  assert.ok(train.bc < 0.05, `bc ${train.bc}`);
});

test('full power: 0–100 km/h takes about a minute (WAP-7 + 8 LHB ≈ 523 t)', () => {
  const train = cruising(0);
  let t = 0;
  while (train.speedMps < 100 * KMH && t < 300) {
    stepTrain(train, { ...NO_INPUT, leverUp: true }, DT, TRAIN);
    t += DT;
  }
  assert.ok(t > 50 && t < 90, `0–100 took ${t.toFixed(1)} s`);
});

test('coasting at 110 km/h loses speed only slowly', () => {
  const train = cruising(110);
  run(train, NO_INPUT, 10);
  const lost = 110 - train.speedMps * 3.6;
  assert.ok(lost > 0.5 && lost < 3, `lost ${lost.toFixed(2)} km/h in 10 s`);
});

test('full-service stop from 110 km/h needs roughly a kilometre; emergency is shorter', () => {
  const service = cruising(110);
  const s0 = service.routeDistance;
  run(service, { ...NO_INPUT, brakeApply: true }, 200);
  const serviceDist = service.routeDistance - s0;
  assert.equal(service.speedMps, 0);
  assert.ok(serviceDist > 800 && serviceDist < 1300, `service ${serviceDist.toFixed(0)} m`);

  const emerg = cruising(110);
  applyEmergency(emerg);
  const e0 = emerg.routeDistance;
  run(emerg, NO_INPUT, 200);
  const emergDist = emerg.routeDistance - e0;
  assert.ok(emergDist < serviceDist, 'emergency must be shorter');
  assert.ok(emergDist > 600 && emergDist < 950, `emergency ${emergDist.toFixed(0)} m`);
});

test('brakes never stop the train instantly', () => {
  const train = cruising(100);
  applyEmergency(train);
  run(train, NO_INPUT, 1);
  assert.ok(train.speedMps * 3.6 > 97, 'brake force takes time to build up');
});

test('regenerative braking (lever below 0) slows the train', () => {
  const train = cruising(100);
  run(train, { ...NO_INPUT, leverDown: true }, 15);
  assert.ok(train.lever < 0);
  assert.ok(train.speedMps * 3.6 < 85, `speed ${train.speedMps * 3.6}`);
});

test('stopped train stays stopped', () => {
  const train = cruising(20);
  run(train, { ...NO_INPUT, brakeApply: true }, 60);
  assert.equal(train.speedMps, 0);
  const s = train.routeDistance;
  run(train, NO_INPUT, 10);
  assert.equal(train.routeDistance, s);
});

test('reverser cannot change while moving or with power applied', () => {
  const train = cruising(20);
  assert.equal(cycleDirection(train, TRAIN).ok, false);
  train.speedMps = 0;
  train.lever = 0.5;
  assert.equal(cycleDirection(train, TRAIN).ok, false);
  train.lever = 0;
  assert.equal(cycleDirection(train, TRAIN).ok, true);
  assert.equal(train.direction, DIRECTION.NEUTRAL);
});

test('neutral gives no traction; reverse moves backwards', () => {
  const train = cruising(0);
  cycleDirection(train, TRAIN); // neutral
  run(train, { ...NO_INPUT, leverUp: true }, 5);
  assert.equal(train.speedMps, 0);
  train.lever = 0;
  cycleDirection(train, TRAIN); // reverse
  run(train, { ...NO_INPUT, leverUp: true }, 8);
  assert.ok(train.routeDistance < 1000);
});

test('train stops at the end of track', () => {
  const train = cruising(30, 7990);
  train.maxDistance = 8000;
  run(train, NO_INPUT, 3);
  assert.equal(train.routeDistance, 8000);
  assert.equal(train.speedMps, 0);
});

test('speed limit applies until the rear of the train clears it', () => {
  assert.equal(speedLimitFor(SPEED_LIMITS, 800, 1013), 30);
  assert.equal(speedLimitFor(SPEED_LIMITS, 950, 1163), 110);
});

test('fixed stepper caps huge frame delays', () => {
  const stepper = createFixedStepper(DT, 0.1);
  let steps = 0;
  stepper.advance(5, () => steps++);
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

test('an automatic driver obeying speed limits completes New Delhi → Ghaziabad in 5–12 min', () => {
  const total = computeFormation(FORMATION).totalLength;
  const train = createTrainState({ startDistance: JOURNEY.startDistance, minDistance: total + 5, maxDistance: JOURNEY.bufferStop, coachCount: FORMATION.coachCount, cfg: TRAIN });
  const journey = createJourney();
  const A = 0.3; // planning deceleration (m/s²), comfortably below full service
  let t = 0;
  while (journey.state !== JOURNEY_STATE.COMPLETED && t < 1500) {
    const front = train.routeDistance;
    const limit = speedLimitFor(SPEED_LIMITS, front - total, front);
    let target = limit - 5;
    for (const l of SPEED_LIMITS) if (l.from > front && l.kmh < target) target = Math.min(target, Math.sqrt((l.kmh - 5) ** 2 / 12.96 + 2 * A * Math.max(0, l.from - front - 150)) * 3.6);
    const remaining = JOURNEY.stopMarker - front;
    target = Math.min(target, Math.sqrt(Math.max(0, 2 * A * (remaining - 40))) * 3.6 + 3);
    const v = train.speedMps * 3.6;
    const input = { ...NO_INPUT };
    if (remaining < 2) input.brakeApply = true;
    else if (v < target - 3) {
      input.brakeRelease = true;
      if (train.lever < 0.8) input.leverUp = true;
    } else if (v > target + 2) {
      if (train.lever > -0.6) input.leverDown = true;
      if (v > target + 6) input.brakeApply = true;
      else input.brakeRelease = true;
    } else {
      input.brakeRelease = true;
      if (train.lever > 0.15) input.leverDown = true;
    }
    stepTrain(train, input, DT, TRAIN);
    updateJourney(journey, train, DT, JOURNEY, limit);
    t += DT;
  }
  assert.equal(journey.state, JOURNEY_STATE.COMPLETED, `ended at s=${train.routeDistance.toFixed(0)} v=${(train.speedMps * 3.6).toFixed(1)}`);
  assert.ok(t > 300 && t < 720, `journey took ${t.toFixed(0)} s`);
  assert.ok(journey.result.maxOverspeedKmh < 5, `overspeed ${journey.result.maxOverspeedKmh.toFixed(1)}`);
  console.log(`  auto-driver: ${(t / 60).toFixed(1)} min, max ${journey.result.maxSpeedKmh.toFixed(0)} km/h, stop offset ${journey.result.stopOffset.toFixed(1)} m, score ${journey.result.score}`);
});

// ---------------------------------------------------------------- AI trains
test('AI train waits until the player is far away, obeys limits, stops at its platform', () => {
  const [tr] = createAiTrains([{ id: 'x', departAt: 5, startFront: 7880, stopFront: 120, maxKmh: 100 }], () => 240);
  let maxOver = 0;
  // player sitting near Ghaziabad: the AI train must not appear
  stepAiTrains([tr], DT, 10, { limits: SPEED_LIMITS, playerFront: 7000 });
  assert.equal(tr.state, 'waiting');
  let t = 0;
  while (tr.state !== 'arrived' && t < 1500) {
    stepAiTrains([tr], DT, 10 + t, { limits: SPEED_LIMITS, playerFront: 400 });
    const lim = speedLimitFor(SPEED_LIMITS, tr.front, tr.front + tr.length);
    maxOver = Math.max(maxOver, tr.speed * 3.6 - lim);
    t += DT;
  }
  assert.equal(tr.state, 'arrived');
  assert.ok(Math.abs(tr.front - 120) < 3, `stopped at ${tr.front.toFixed(1)}`);
  assert.ok(maxOver < 2, `overspeed ${maxOver.toFixed(1)} km/h`);
});

test('coachVariantKey correctly maps coach types and liveries', () => {
  assert.equal(coachVariantKey('icf', 'icfBlue'), 'icf-blue');
  assert.equal(coachVariantKey('icf', 'contrast'), 'icf-blue');
  assert.equal(coachVariantKey('lhb', 'lhb'), 'lhb-red');
  assert.equal(coachVariantKey('lhb', 'red'), 'lhb-red');
  assert.equal(coachVariantKey('lhb', 'lhbBlue'), 'lhb-blue');
  assert.equal(coachVariantKey('lhb', 'blue'), 'lhb-blue');
});

test('AI train formation lengths respect coach types (ICF vs LHB)', () => {
  const lengthOf = (def) => {
    const ct = COACH_TYPES[def.type] || COACH_TYPES.lhb;
    return FORMATION.locomotive.length + def.coaches * (ct.length + (ct.gap ?? 0.5));
  };
  const aiTrains = createAiTrains(AI_TRAINS, lengthOf);
  assert.equal(aiTrains.length, 2);

  // icf-express: WAP-7 (20.56) + 10 ICF (21.337 + 0.7 = 22.037) = 240.93 m
  const icfExpress = aiTrains.find((t) => t.id === 'icf-express');
  assert.ok(icfExpress);
  assert.ok(Math.abs(icfExpress.length - (20.56 + 10 * (21.337 + 0.7))) < 1e-3);

  // lhb-rajdhani: WAP-7 (20.56) + 9 LHB (23.54 + 0.5 = 24.04) = 236.92 m
  const lhbRajdhani = aiTrains.find((t) => t.id === 'lhb-rajdhani');
  assert.ok(lhbRajdhani);
  assert.ok(Math.abs(lhbRajdhani.length - (20.56 + 9 * (23.54 + 0.5))) < 1e-3);
});

test('level crossing gate timing correctly calculates closing window', () => {
  const crossingS = LEVEL_CROSSING.s;
  const isClosing = (trainFront, trainRear) => {
    const distToCrossing = crossingS - trainFront;
    return distToCrossing > -40 && distToCrossing < LEVEL_CROSSING.closeAhead;
  };

  // Train far away (>650m): gates open
  assert.equal(isClosing(crossingS - 800, crossingS - 1000), false);

  // Train approaching (within 650m): gates closed
  assert.equal(isClosing(crossingS - 500, crossingS - 700), true);
  assert.equal(isClosing(crossingS - 50, crossingS - 250), true);

  // Train crossing: gates closed
  assert.equal(isClosing(crossingS + 20, crossingS - 180), true);

  // Train has fully cleared crossing: gates open
  assert.equal(isClosing(crossingS + 260, crossingS + 50), false);
});

test('player train formation spacing joins coaches seamlessly without gaps for ICF and LHB', () => {
  for (const coachType of ['icf', 'lhb']) {
    const spec = COACH_TYPES[coachType];
    const gap = spec.gap ?? FORMATION.couplingGap;
    const L = FORMATION.locomotive.length;

    const vehicles = [{ kind: 'locomotive', offset: L / 2, length: L }];
    let back = L;
    for (let i = 0; i < FORMATION.coachCount; i++) {
      back += gap;
      vehicles.push({ kind: 'coach', offset: back + spec.length / 2, length: spec.length });
      back += spec.length;
    }

    assert.equal(vehicles.length, 9);
    for (let i = 1; i < vehicles.length; i++) {
      const prev = vehicles[i - 1];
      const curr = vehicles[i];
      const prevRear = prev.offset + prev.length / 2;
      const currFront = curr.offset - curr.length / 2;
      const measuredGap = currFront - prevRear;
      assert.ok(Math.abs(measuredGap - gap) < 1e-4, `Expected gap ${gap}, got ${measuredGap}`);
      // Reach of couplers / gangway bellows from each side must bridge the gap
      const reach = gap / 2 + 0.02;
      assert.ok(reach * 2 > gap, 'Gangway bellows overlap to form seamless connection');
    }
  }
});

test('station departure announcement attenuation fades as train leaves station', () => {
  // Volume follows Math.pow(proximity, 1.8)
  const volAt = (prox) => (prox > 0.04 ? Math.pow(prox, 1.8) : 0);
  assert.equal(volAt(1.0), 1.0); // At platform: full volume
  assert.ok(volAt(0.5) < 0.35);  // Mid-departure: drops by >65%
  assert.ok(volAt(0.2) < 0.06);  // Exiting yard: barely a whisper
  assert.equal(volAt(0.02), 0);  // Clear of station: completely silent
});

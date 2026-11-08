// Unit tests for the track-acoustics model (run with `npm test`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextJoint, trainAxles, timeToJoint, inverterTone, bandWeights, RAIL_JOINTS, specialJoints } from './railAcoustics.js';

const plain = { spacing: 13, lwr: [{ from: 1000, to: 1520 }], lwrSpacing: 260, turnouts: [[200, 222]], levelCrossings: [] };
const sp = specialJoints(plain);

test('ordinary joints every 13 m, forward and backward', () => {
  assert.equal(nextJoint(14, 1, plain, sp).s, 26);
  assert.equal(nextJoint(26, 1, plain, sp).s, 39); // strictly ahead
  assert.equal(nextJoint(30, -1, plain, sp).s, 26);
  assert.equal(nextJoint(26, -1, plain, sp).s, 13);
});

test('turnout heel and frog are reported with their kind', () => {
  assert.deepEqual(nextJoint(199, 1, plain, sp), { s: 200, kind: 'heel' });
  assert.deepEqual(nextJoint(221, 1, plain, sp), { s: 222, kind: 'frog' });
});

test('long welded rail only has sparse joints, and the grid resumes after it', () => {
  assert.equal(nextJoint(1000, 1, plain, sp).s, 1260);
  assert.equal(nextJoint(995, 1, plain, sp).s, 1000); // edge of the LWR stretch
  assert.equal(nextJoint(1515, 1, plain, sp).s, 1520); // expansion joint at the end of the LWR
  const after = nextJoint(1520, 1, plain, sp).s;
  assert.ok(after > 1520 && after % 13 === 0, `resumes on the 13 m grid, got ${after}`);
});

test('walking the joints never gets stuck or goes backwards', () => {
  let s = 0;
  for (let i = 0; i < 800; i++) {
    const n = nextJoint(s, 1).s;
    assert.ok(n > s, `joint after ${s} was ${n}`);
    s = n;
  }
  assert.ok(s > 5000);
});

test('axles: WAP-7 Co-Co has 3 axles per bogie 1.85 m apart, LHB coaches 2 per bogie 2.56 m apart', () => {
  const axles = trainAxles('lhb', 2);
  const loco = axles.filter((a) => a.kind === 'loco');
  assert.equal(loco.length, 6);
  assert.ok(Math.abs(loco[1].offset - loco[0].offset - 1.85) < 1e-9);
  const coach = axles.filter((a) => a.vehicle === 1);
  assert.equal(coach.length, 4);
  assert.ok(Math.abs(coach[1].offset - coach[0].offset - 2.56) < 1e-9);
  assert.equal(axles.length, 6 + 2 * 4);
  // sorted front to rear, all behind the loco front
  for (let i = 1; i < axles.length; i++) assert.ok(axles[i].offset >= axles[i - 1].offset);
  assert.ok(axles[0].offset > 0);
});

test('time to joint', () => {
  assert.equal(timeToJoint(10, 13, 3, 1), 1);
  assert.equal(timeToJoint(10, 13, 0, 1), Infinity);
  assert.equal(timeToJoint(14, 13, 3, 1), Infinity);
  assert.equal(timeToJoint(14, 13, 2, -1), 0.5);
});

test('converter tone rises within a pulse mode and drops when the mode changes', () => {
  const a = inverterTone(2);
  const b = inverterTone(3);
  assert.ok(b.freq > a.freq && a.pulses === b.pulses);
  let dropped = false;
  let prev = inverterTone(0);
  for (let v = 0.1; v < 40; v += 0.1) {
    const t = inverterTone(v);
    if (t.pulses < prev.pulses && t.freq < prev.freq) dropped = true;
    prev = t;
  }
  assert.ok(dropped);
});

test('speed-band weights are equal-power and pick the right bands', () => {
  const bands = [{ speed: 30 }, { speed: 70 }, { speed: 110 }];
  assert.deepEqual(bandWeights(bands, 10), [1, 0, 0]);
  assert.deepEqual(bandWeights(bands, 130), [0, 0, 1]);
  const w = bandWeights(bands, 50);
  assert.equal(w[2], 0);
  assert.ok(Math.abs(w[0] ** 2 + w[1] ** 2 - 1) < 1e-9);
});

test('route joint config: all turnouts are frog-after-heel', () => {
  for (const [heel, frog] of RAIL_JOINTS.turnouts) assert.ok(frog > heel);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSignalling, updateSignalling, nextSignal, ASPECT } from './signalling.js';
import { ROUTE_DEFS } from '../routes/index.js';
import { buildRoute } from '../routes/buildRoute.js';

const routes = Object.fromEntries(ROUTE_DEFS.map((d) => [d.id, buildRoute(d)]));
const step = (st, front, extra = {}) => updateSignalling(st, { front, speed: extra.speed ?? 20, dt: extra.dt ?? 0.1, stopIndex: extra.stopIndex ?? 0, dwellDone: extra.dwellDone ?? false, rightAway: extra.rightAway ?? [], aiSpans: extra.aiSpans ?? [] });

test('approaching a terminus: green … double yellow, yellow, then the buffer stop', () => {
  const st = createSignalling(routes['ndls-gzb'], { holdChance: 0 });
  step(st, 500);
  const asp = st.up.map((s) => s.aspect);
  assert.equal(asp.at(-1), ASPECT.YELLOW, asp.join());
  assert.equal(asp.at(-2), ASPECT.YY, asp.join());
  assert.ok(asp.slice(0, -2).every((a) => a === ASPECT.GREEN), asp.join());
});

test('a halt: the starter stays red until the right-away, then clears', () => {
  const r = routes['howrah-bandel'];
  const st = createSignalling(r, { holdChance: 0 });
  step(st, 2000, { stopIndex: 0 });
  const starter = st.up.find((s) => s.kind === 'starter' && s.stationId === 'bly');
  const home = st.up.find((s) => s.kind === 'home' && s.stationId === 'bly');
  assert.equal(starter.aspect, ASPECT.RED);
  assert.equal(home.aspect, ASPECT.YELLOW);
  step(st, 3135, { stopIndex: 0, dwellDone: true, speed: 0 });
  assert.notEqual(starter.aspect, ASPECT.RED);
  step(st, 3140, { stopIndex: 1, rightAway: [0] });
  assert.notEqual(starter.aspect, ASPECT.RED);
});

test('leaving a halt early does not clear its starter: passing it is a SPAD', () => {
  const st = createSignalling(routes['howrah-bandel'], { holdChance: 0 });
  const starter = st.up.find((s) => s.kind === 'starter' && s.stationId === 'bly');
  step(st, starter.s - 20, { stopIndex: 1, rightAway: [] }); // the journey moved on (early departure)
  assert.equal(starter.aspect, ASPECT.RED);
  const ev = step(st, starter.s + 1, { stopIndex: 1, rightAway: [] });
  assert.ok(ev.some((e) => e.type === 'spad'));
});

test('passing a red signal is a SPAD, once', () => {
  const st = createSignalling(routes['howrah-bandel'], { holdChance: 0 });
  const starter = st.up.find((s) => s.kind === 'starter' && s.stationId === 'bly');
  step(st, starter.s - 5, { stopIndex: 0 });
  const ev = step(st, starter.s + 2, { stopIndex: 0 });
  assert.ok(ev.some((e) => e.type === 'spad' && e.signal === starter));
  const again = step(st, starter.s + 4, { stopIndex: 0 });
  assert.ok(!again.some((e) => e.type === 'spad'));
});

test('a held home signal clears after the driver waits at it', () => {
  const st = createSignalling(routes['howrah-bandel'], { holdChance: 1, seed: 3 });
  const home = st.up.find((s) => s.kind === 'home' && s.stationId === 'bly');
  assert.ok(home.held);
  step(st, home.s - 100, { speed: 0 });
  assert.equal(home.aspect, ASPECT.RED);
  let cleared = false;
  for (let t = 0; t < 40 && !cleared; t += 0.5) cleared = step(st, home.s - 100, { speed: 0, dt: 0.5 }).some((e) => e.type === 'cleared');
  assert.ok(cleared);
  step(st, home.s - 100, { speed: 0 });
  assert.equal(home.aspect, ASPECT.YELLOW);
});

test('opposite direction: the block behind an AI train is red, the one before it yellow', () => {
  const st = createSignalling(routes['gatimaan'], { holdChance: 0 });
  const mid = st.down[Math.floor(st.down.length / 2)];
  const below = st.down[st.down.indexOf(mid) + 1];
  step(st, 500, { aiSpans: [[below.s + 10, below.s + 300]] });
  assert.equal(mid.aspect, ASPECT.RED);
  const behind = st.down[st.down.indexOf(mid) - 1];
  assert.equal(behind.aspect, ASPECT.YELLOW);
});

test('single line is 3-aspect: no double yellow', () => {
  const st = createSignalling(routes['konkan'], { holdChance: 0 });
  step(st, 500);
  assert.ok(!st.up.some((s) => s.aspect === ASPECT.YY));
});

test('nextSignal reports the signal ahead and its distance', () => {
  const st = createSignalling(routes['ndls-gzb'], { holdChance: 0 });
  step(st, 1000);
  const n = nextSignal(st, 1000);
  assert.ok(n && n.s > 1000 && Math.abs(n.distance - (n.s - 1000)) < 1e-9);
});

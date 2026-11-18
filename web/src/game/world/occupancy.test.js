import test from 'node:test';
import assert from 'node:assert/strict';
import { Occupancy } from './occupancy.js';

test('occupancy: a marked rectangle is no longer free, its surroundings are', () => {
  const o = new Occupancy(2);
  o.mark(100, 50, 10, 8);
  assert.equal(o.free(100, 50, 2, 2), false);
  assert.equal(o.free(104, 53, 1, 1), false, 'corner inside');
  assert.equal(o.free(120, 50, 4, 4), true, 'well clear along s');
  assert.equal(o.free(100, 70, 4, 4), true, 'well clear across');
});

test('occupancy: padding keeps a gap between neighbours', () => {
  const o = new Occupancy(1);
  o.mark(0, 0, 10, 10);
  assert.equal(o.free(8, 0, 4, 4), true, 'touching edge is allowed without pad');
  assert.equal(o.free(8, 0, 4, 4, 2), false, 'but not with a 2 m gap');
});

test('occupancy: levels — a field lets trees in but not houses', () => {
  const o = new Occupancy(2);
  o.mark(0, 30, 60, 40, 1); // a field (soft)
  assert.equal(o.free(0, 30, 6, 6, 0, 1), false, 'a house (needs level-1-free ground) cannot go on the field');
  assert.equal(o.free(0, 30, 6, 6, 0, 2), true, 'a tree only avoids solid cells');
  o.mark(0, 30, 6, 6, 2);
  assert.equal(o.at(0, 30), 2);
  assert.equal(o.at(500, 30), 0);
  o.mark(0, 30, 6, 6, 1);
  assert.equal(o.at(0, 30), 2, 'a lower level never downgrades a cell');
});

test('occupancy: works at negative lateral offsets (right of the line)', () => {
  const o = new Occupancy(2);
  o.mark(1000, -40, 12, 10);
  assert.equal(o.free(1000, -40, 1, 1), false);
  assert.equal(o.free(1000, 40, 1, 1), true, 'the mirror position on the left is untouched');
});

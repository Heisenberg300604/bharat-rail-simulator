import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LESSONS, createLessonState, updateLesson } from './driverSchool.js';
import { createTrainState, stepTrain } from './trainSimulation.js';
import { TRAIN, FIXED_TIMESTEP } from '../config/gameConfig.js';

const DT = FIXED_TIMESTEP;
const NO = { leverUp: false, leverDown: false, brakeApply: false, brakeRelease: false };

test('every lesson has steps with text and a check', () => {
  assert.ok(LESSONS.length >= 3);
  for (const l of LESSONS) {
    assert.ok(l.steps.length > 0 && l.title && l.summary && l.setup);
    for (const st of l.steps) assert.ok(st.text.length > 20 && typeof st.check === 'function');
  }
});

test('lesson 1 can be completed by actually using the brake', () => {
  const train = createTrainState({ startDistance: 410, minDistance: 0, maxDistance: 8000, coachCount: 8, cfg: TRAIN });
  const lesson = createLessonState('brakes');
  const journey = { state: 'ready' };
  const run = (input, seconds) => {
    for (let t = 0; t < seconds; t += DT) {
      stepTrain(train, input, DT, TRAIN);
      updateLesson(lesson, { train, journey }, DT);
    }
  };
  run({ ...NO, brakeRelease: true }, 4); // handle to release, BP charging
  assert.ok(lesson.step >= 1);
  run(NO, 3); // wait for BP 5.0
  assert.equal(lesson.step, 2);
  run({ ...NO, brakeApply: true }, 0.6);
  run(NO, 4);
  assert.equal(lesson.step, 3);
  run({ ...NO, brakeRelease: true }, 2);
  run(NO, 20);
  assert.equal(lesson.done, true);
});

test('a step only counts once its condition holds for a moment', () => {
  const lesson = createLessonState('brakes');
  const train = { brakeHandle: 0 };
  assert.equal(updateLesson(lesson, { train }, 0.1), null);
  assert.equal(lesson.step, 0);
  for (let i = 0; i < 6; i++) updateLesson(lesson, { train }, 0.1);
  assert.equal(lesson.step, 1);
});

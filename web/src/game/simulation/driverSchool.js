// Driver school: short guided lessons on the Delhi route. Each lesson sets the
// train up somewhere, then walks through steps; a step is done when its check
// is true for a moment (so a flick of a key doesn't count). Pure logic (no
// Three.js / React) — unit-tested in driverSchool.test.js.
//
// A check receives { train, journey, signal } where signal is the next signal
// ahead ({ aspect, distance } or null) and returns true when the step is done.

const HOLD = 0.6; // seconds a step's condition must hold

export const LESSONS = [
  {
    id: 'brakes',
    title: '1 · The air brake',
    summary: 'Release and apply the A9 automatic brake, and read the brake pipe and cylinder gauges.',
    setup: { s: 410, kmh: 0 },
    steps: [
      {
        text: 'You are at New Delhi with the A9 brake fully applied (BP 3.4). Hold X to release it and watch the brake pipe (BP) gauge climb.',
        check: ({ train }) => train.brakeHandle < 0.04,
      },
      {
        text: 'Keep it released until BP reaches 5.0 kg/cm². Below 4.75 the loco cuts traction — a real interlock, not a bug.',
        check: ({ train }) => train.bp > 4.95,
      },
      {
        text: 'Now apply a little brake: tap Space until the handle reads "Min. reduction" or "Service" and watch BC (brake cylinder) rise.',
        check: ({ train }) => train.brakeHandle >= 0.04 && train.bc > 0.4 && train.bp < 4.9, // a fresh application, not the leftover from the start
      },
      {
        text: 'The brakes take time to build and to release — that delay is why trains need distance. Release again with X until BC falls below 0.2.',
        check: ({ train }) => train.bc < 0.2 && train.brakeHandle < 0.04,
      },
    ],
  },
  {
    id: 'power',
    title: '2 · Power and regenerative braking',
    summary: 'Notch up the TE/BE lever, respect the yard limit, coast, and slow down with the motors.',
    setup: { s: 410, kmh: 0, released: true },
    steps: [
      {
        text: 'Hold W to notch the TE/BE lever up to about 30 %. The train starts to roll — traction builds over a second or two.',
        check: ({ train }) => train.lever >= 0.28 && train.speedMps > 0.5,
      },
      {
        text: 'Accelerate to 25 km/h. The yard limit is 30 km/h until the whole train has cleared the turnouts.',
        check: ({ train }) => train.speedMps * 3.6 >= 25,
      },
      {
        text: 'Hold S to bring the lever back to 0 and coast. Notice how little speed you lose: rolling resistance is small.',
        check: ({ train }) => Math.abs(train.lever) < 0.02 && train.speedMps > 3,
      },
      {
        text: 'Keep holding S past 0 into BE (regenerative braking, 30 % or more). The motors now act as generators and slow the train.',
        check: ({ train }) => train.lever <= -0.28 && train.forces.regen > 20,
      },
      {
        text: 'Use regen and the A9 brake (Space) together to stop completely. Then release the brake (X).',
        check: ({ train }) => train.speedMps < 0.05,
      },
    ],
  },
  {
    id: 'stopping',
    title: '3 · Stopping at a marker',
    summary: 'Arrive at Ghaziabad at speed and stop with the loco inside the green zone.',
    setup: { s: 5600, kmh: 75, released: true },
    steps: [
      {
        text: 'You are running at 75 km/h towards Ghaziabad. The HUD shows "Full-service stop" — the distance you need. Keep an eye on it and on the limits ahead (60, then 30).',
        check: ({ train }) => train.routeDistance > 6350,
      },
      {
        text: 'Start braking early and gently: a little A9 (Space), and regen (S). Aim to be at 30 km/h as you reach the platform.',
        check: ({ train }) => train.routeDistance > 7150 && train.speedMps * 3.6 < 34,
      },
      {
        text: 'Now stop with the loco front inside the green zone next to the STOP board, and hold still for 3 seconds.',
        check: ({ journey }) => journey.state === 'stopped' || journey.state === 'completed',
      },
    ],
  },
  {
    id: 'signals',
    title: '4 · Reading the signals',
    summary: 'Drive on the colour-light signals: green, double yellow, yellow and red — and never pass a red.',
    setup: { s: 410, kmh: 0, released: true, signalsLesson: true },
    steps: [
      {
        text: 'Signals stand on the left of the line; the next one is shown at the top of your speed panel. Green means proceed. Get the train moving (X to release, then W).',
        check: ({ train }) => train.speedMps * 3.6 > 15,
      },
      {
        text: 'Automatic signals carry a white "A" plate; distant signals a "P". Drive on and pass the next signal — it must be showing a proceed aspect.',
        check: ({ passed }) => passed > 0,
      },
      {
        text: 'Double yellow = attention: be prepared to pass the next signal at a restricted speed. Single yellow = caution: be prepared to stop at the next signal. Watch the aspects as you near Ghaziabad.',
        check: ({ signal }) => !!signal && (signal.aspect === 'yy' || signal.aspect === 'yellow'),
      },
      {
        text: 'Red = stop. Passing a signal at danger (a SPAD) is one of the most serious events on Indian Railways. Bring the train to a stand at Ghaziabad without passing a red.',
        check: ({ journey }) => journey.state === 'stopped' || journey.state === 'completed',
      },
    ],
  },
];

export function lessonById(id) {
  return LESSONS.find((l) => l.id === id) ?? null;
}

export function createLessonState(id) {
  return { id, step: 0, held: 0, done: false, passed: 0 };
}

/** Advance the lesson. Returns 'step' when a step was just completed, 'done' at the end, else null. */
export function updateLesson(state, ctx, dt) {
  if (!state || state.done) return null;
  const lesson = lessonById(state.id);
  const step = lesson.steps[state.step];
  if (step.check({ ...ctx, passed: state.passed })) state.held += dt;
  else state.held = 0;
  if (state.held < HOLD) return null;
  state.held = 0;
  state.step++;
  if (state.step >= lesson.steps.length) {
    state.done = true;
    return 'done';
  }
  return 'step';
}

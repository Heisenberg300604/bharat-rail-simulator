// Engine whistle / horn codes, read from how long the driver holds the horn.
// Pure (no Three.js / React) — unit-tested in incidents.test.js.
//
// Notation and meanings: IRFCA signalling FAQ part 5, "Whistle and Horn
// Codes" (https://www.irfca.org/faq/faq-signal5.html), from the G&SR:
//   'o'      a short blast
//   '--'     a comparatively long blast
//   '-----'  a longer blast
// Codes the game listens for:
//   '--'        normal departure on a clear signal; usually followed by another
//               long blast 10–20 s later, after the guard's all-right
//   '-----'     (on the run) acknowledgement of the guard's signal;
//               (before starting) passing an automatic stop signal at 'On'
//   'o o --'    sudden loss of brake pressure (perhaps the alarm chain pulled)
//
// GAME ASSUMPTION: the rulebook gives no durations. Here a blast under 0.8 s
// is short, 0.8–2.5 s long, 2.5 s or more longer; a code ends after 1.6 s of
// silence.
export const HORN_TIMING = { shortMax: 0.8, longMax: 2.5, gap: 1.6 };

export const HORN_CODE_MEANING = {
  '--': 'Normal departure',
  '-----': "Acknowledging the guard / passing an automatic signal at 'On'",
  'o o --': 'Sudden loss of brake pressure (alarm chain)',
  'o o': "Calling for the guard's signal",
  'o o o o': 'Train cannot proceed — protect in rear',
};

export function blastSymbol(seconds) {
  if (seconds < HORN_TIMING.shortMax) return 'o';
  if (seconds < HORN_TIMING.longMax) return '--';
  return '-----';
}

export function createHornReader() {
  return { on: false, held: 0, silence: 0, blasts: [], lastCode: null };
}

/**
 * Feed the horn button state every step. Returns a finished code string
 * (e.g. 'o o --') once the driver has been silent for HORN_TIMING.gap, else null.
 */
export function updateHornReader(r, hornDown, dt) {
  if (hornDown) {
    r.held += dt;
    r.silence = 0;
    r.on = true;
    return null;
  }
  if (r.on) {
    r.blasts.push(blastSymbol(r.held));
    r.held = 0;
    r.on = false;
  }
  if (!r.blasts.length) return null;
  r.silence += dt;
  if (r.silence < HORN_TIMING.gap) return null;
  const code = r.blasts.join(' ');
  r.blasts = [];
  r.silence = 0;
  r.lastCode = code;
  return code;
}

/** Does a finished code contain at least one long (or longer) blast? */
export function hasLongBlast(code) {
  return /--/.test(code ?? '');
}

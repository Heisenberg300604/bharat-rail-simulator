// Statistics for the run card: energy, passenger comfort and safety counters.
// Pure (no Three.js / React) — unit-tested in runStats.test.js.
//
// Energy: traction power = TE × v (kN × m/s = kW), integrated to kWh at the
//   wheel. Regenerative braking is counted the same way (energy returned to
//   the 25 kV line, before converter losses).
// Comfort: what passengers feel is longitudinal acceleration and how quickly
//   it changes (jerk, m/s³). Acceleration is smoothed (0.4 s) so a single
//   physics step can't spike it.

export function createRunStats() {
  return {
    energyKWh: 0,
    regenKWh: 0,
    distanceM: 0,
    peakAccel: 0, // m/s², forward
    peakDecel: 0, // m/s², braking (positive number)
    peakJerk: 0, // m/s³
    spads: 0,
    emergencies: 0,
    vcdPenalties: 0,
    kavachInterventions: 0,
    slipSeconds: 0,
    guardSignals: 0, // right-away signals given by the guard (D1)
    guardAcks: 0, // …acknowledged by the driver with a long horn blast
    _v: null,
    _a: 0,
    _wasEmergency: false,
  };
}

const ACCEL_TAU = 0.4; // s

export function updateRunStats(st, train, dt) {
  const v = train.speedMps;
  const f = train.forces ?? {};
  st.energyKWh += ((f.traction ?? 0) * v * dt) / 3600;
  st.regenKWh += ((f.regen ?? 0) * v * dt) / 3600;
  st.distanceM += v * dt;
  // a jump in speed no train can produce (> 4 m/s²: a restart, a teleport) is not a jolt — skip it
  if (st._v !== null && dt > 0 && Math.abs(v - st._v) / dt > 4) st._v = v;
  if (st._v !== null && dt > 0) {
    const raw = (v - st._v) / dt;
    const a = st._a + (raw - st._a) * Math.min(1, dt / ACCEL_TAU);
    // only count jerk while moving: the final "settle" at standstill isn't felt as a jerk
    if (v > 0.5) st.peakJerk = Math.max(st.peakJerk, Math.abs(a - st._a) / dt);
    st._a = a;
    if (a > 0) st.peakAccel = Math.max(st.peakAccel, a);
    else st.peakDecel = Math.max(st.peakDecel, -a);
  }
  st._v = v;
  if (train.emergency && !st._wasEmergency && v > 0.5) st.emergencies++;
  st._wasEmergency = train.emergency;
  if (train.slipping) st.slipSeconds += dt;
  return st;
}

/**
 * Ride quality for passengers. Thresholds follow common rail-comfort
 * practice: ~0.5 m/s³ jerk and ~1 m/s² deceleration are where standing
 * passengers start to notice.
 */
export function comfortRating(st) {
  const j = st.peakJerk;
  const d = Math.max(st.peakDecel, st.peakAccel);
  if (j < 0.35 && d < 0.75) return 'Smooth';
  if (j < 0.7 && d < 1.0) return 'Comfortable';
  if (j < 1.2 && d < 1.3) return 'Noticeable jolts';
  return 'Rough ride';
}

/** Public snapshot (drops the private smoothing state). */
export function summarizeRunStats(st) {
  const { _v, _a, _wasEmergency, ...pub } = st; // eslint-disable-line no-unused-vars
  return { ...pub, comfort: comfortRating(st), regenShare: st.energyKWh > 0 ? st.regenKWh / st.energyKWh : 0 };
}

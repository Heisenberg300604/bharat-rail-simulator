// Kavach — Indian Railways' automatic train protection (TCAS), simplified.
// Pure logic, unit-tested in kavach.test.js.
//
// Source for the numbers: RDSO/SPN/196 (Kavach specification), Annexure A2
// "Onboard Kavach configurable parameters" (Amdt-3, 2024), defaults:
//   warning at 2 km/h over the permitted speed, then brake intervention;
//   normal service brake margin 5, full service 3, emergency 2 km/h (the
//   annexure lists each "beyond permitted speed"; we stack them as escalation
//   steps: +5 service, +8 full service, +10 emergency); 80 m overlap past the
//   end of authority; TRIP (emergency) 30 m past it.
// Annexure B (driver display): speed dial green within limits, orange when
// overspeeding, red while Kavach brakes; target distance bar up to 2,000 m.
//
// What Kavach supervises here: the line speed, lower restrictions ahead, and
// the end of movement authority = the first signal at danger ahead.

export const KAVACH = {
  warnOver: 2,
  serviceOver: 5,
  fullOver: 8,
  emergencyOver: 10,
  tripPast: 30,
  planDecel: 0.45, // m/s² used for the braking curve (below the train's full service)
  reactionS: 6, // 2 s warning + 4 s driver reaction before the curve bites
  range: 2000, // metres the display looks ahead
};

export function createKavach() {
  return { state: 'normal', permittedKmh: Infinity, target: null, interventions: 0, brakeDemand: 0, emergency: false, tripped: false };
}

/** Permitted speed (km/h) now, given a target `distance` m ahead with speed `vTkmh`. */
export function curveSpeed(distance, vTkmh, speedMps, k = KAVACH) {
  const d = Math.max(0, distance - speedMps * k.reactionS);
  return Math.sqrt((vTkmh / 3.6) ** 2 + 2 * k.planDecel * d) * 3.6;
}

/**
 * ctx: { speedMps, front, lineLimitKmh, limitsAhead: [{ distance, kmh, label }],
 *        redAhead: { distance, name } | null (first signal at danger ahead),
 *        passedRedBy: metres past a red signal (0 if none) }
 * Sets k.brakeDemand (0…1 A9-equivalent), k.emergency, k.state, k.permittedKmh, k.target.
 * Returns 'intervene' | 'trip' | 'warn' when that starts this step, else null.
 */
export function updateKavach(k, ctx, cfg = KAVACH) {
  const v = ctx.speedMps * 3.6;
  let permitted = ctx.lineLimitKmh;
  let target = null;
  const consider = (distance, kmh, label, name) => {
    if (distance > cfg.range || distance < 0 || kmh >= ctx.lineLimitKmh) return; // only lower targets matter
    const p = curveSpeed(distance, kmh, ctx.speedMps, cfg);
    if (!target || kmh < target.kmh || p < permitted) target = { distance, kmh, label, name };
    permitted = Math.min(permitted, Math.max(kmh, p));
  };
  for (const l of ctx.limitsAhead ?? []) consider(l.distance, l.kmh, 'PSR', l.label);
  if (ctx.redAhead) consider(ctx.redAhead.distance, 0, 'EoA', ctx.redAhead.name);
  k.permittedKmh = permitted;
  k.target = target;

  const prev = k.state;
  let event = null;
  if ((ctx.passedRedBy ?? 0) > cfg.tripPast) {
    if (!k.tripped) event = 'trip';
    k.tripped = true;
  }
  if (k.tripped) {
    k.state = 'trip';
    k.emergency = true;
    k.brakeDemand = 1;
    return event;
  }
  const LEVELS = ['normal', 'warning', 'service', 'full', 'emergency'];
  const over = v - permitted;
  let level = over > cfg.emergencyOver ? 4 : over > cfg.fullOver ? 3 : over > cfg.serviceOver ? 2 : over > cfg.warnOver ? 1 : 0;
  const prevLevel = LEVELS.indexOf(prev);
  // once braking, Kavach holds the brake until the speed is back at the permitted speed
  if (prevLevel >= 2 && over > 0) level = Math.max(level, prevLevel);
  const next = LEVELS[level];
  k.state = next;
  k.emergency = level === 4;
  k.brakeDemand = level === 2 ? 0.45 : level >= 3 ? 1 : 0;
  if (level >= 2 && prevLevel < 2) {
    k.interventions++;
    event = 'intervene';
  } else if (level === 1 && prevLevel === 0) event = 'warn';
  return event;
}

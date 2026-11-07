// Other trains on the DOWN main (running towards New Delhi, i.e. towards lower
// route distance). Kinematic "AI drivers": accelerate to the line speed, obey
// the same speed restrictions as the player (over the whole train length),
// brake in time for lower limits ahead, and stop at their platform.
// Pure logic — unit-tested in simulation.test.js.
import { speedLimitFor } from './trainSimulation.js';

const ACCEL = 0.35; // m/s²
const BRAKE = 0.6; // m/s² (actual)
const PLAN = 0.42; // m/s² (planning — less than actual, so they always make it)

export function createAiTrains(defs, lengthOf) {
  return defs.map((def) => ({
    ...def,
    length: lengthOf(def),
    state: 'waiting', // waiting → running → arrived
    front: def.startFront, // leading end (lowest route distance, since it runs towards s = 0)
    speed: 0,
    hornSounded: false,
  }));
}

/**
 * @param trains  from createAiTrains (mutated)
 * @param dt      seconds
 * @param t       seconds since the journey started
 * @param ctx     { limits, playerFront }
 */
export function stepAiTrains(trains, dt, t, { limits, playerFront }) {
  for (const tr of trains) {
    if (tr.state === 'waiting') {
      // Only appear at Ghaziabad while the player is far away (out of sight).
      if (t >= tr.departAt && playerFront < tr.startFront - 2500) tr.state = 'running';
      continue;
    }
    if (tr.state !== 'running') continue;

    const rear = tr.front + tr.length;
    let target = Math.min(tr.maxKmh, speedLimitFor(limits, tr.front, rear)) / 3.6;
    // lower restrictions ahead (ahead = lower s for this direction)
    for (const l of limits) {
      if (l.to <= tr.front && l.kmh / 3.6 < target) {
        const d = tr.front - l.to;
        target = Math.min(target, Math.sqrt((l.kmh / 3.6) ** 2 + 2 * PLAN * d));
      }
    }
    // stop at the platform
    const toStop = tr.front - tr.stopFront;
    target = Math.min(target, Math.sqrt(2 * PLAN * Math.max(0, toStop)) + (toStop > 1 ? 0.3 : 0));

    if (tr.speed < target) tr.speed = Math.min(target, tr.speed + ACCEL * dt);
    else tr.speed = Math.max(target, tr.speed - BRAKE * dt);
    tr.front -= tr.speed * dt;

    if (toStop < 0.5 && tr.speed < 0.3) {
      tr.speed = 0;
      tr.state = 'arrived';
    }
  }
  return trains;
}

/** Route-distance span [min, max] occupied by a train that is on the track. */
export function aiSpan(tr) {
  return tr.state === 'waiting' ? null : [tr.front, tr.front + tr.length];
}

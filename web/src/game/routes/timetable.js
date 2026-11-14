// Working timetable: how long a competent driver needs between stops.
// A simple kinematic "ideal run" — accelerate gently to the line speed, obey
// every restriction over the whole train length, brake early for lower limits
// and for each stop marker — plus a recovery margin, rounded to 15 s like a
// real working timetable. Pure JS, unit-tested.
import { speedLimitFor } from '../simulation/trainSimulation.js';

const ACCEL = 0.3; // m/s², a loaded passenger train on level track
const BRAKE = 0.4; // m/s², planned service braking
const DT = 0.5;

/**
 * @param route   { speedLimits, journey: { startDistance, stops } }
 * @param opts    { trainLength, maxKmh, margin, roundTo }
 * @returns       [{ stationId, runSeconds, arrive, depart }] (times since start, s)
 */
export function computeTimetable(route, { trainLength = 215, maxKmh = 110, margin = 0.15, pad = 30, roundTo = 15 } = {}) {
  const limits = route.speedLimits;
  const stops = route.journey.stops;
  let s = route.journey.startDistance;
  let v = 0;
  let t = 0;
  const out = [];
  for (const stop of stops) {
    const target = stop.marker;
    let guard = 0;
    while (s < target - 0.5 && guard++ < 200000) {
      let vMax = Math.min(maxKmh, speedLimitFor(limits, s - trainLength, s)) / 3.6;
      for (const l of limits) {
        if (l.from > s && l.kmh / 3.6 < vMax) vMax = Math.min(vMax, Math.sqrt((l.kmh / 3.6) ** 2 + 2 * BRAKE * (l.from - s)));
      }
      vMax = Math.min(vMax, Math.sqrt(2 * BRAKE * Math.max(0, target - s)) + 0.3);
      if (v < vMax) v = Math.min(vMax, v + ACCEL * DT);
      else v = Math.max(vMax, v - BRAKE * 1.5 * DT);
      s += v * DT;
      t += DT;
    }
    s = target;
    v = 0;
    const arrive = roundUp(t * (1 + margin) + pad, roundTo);
    out.push({ stationId: stop.stationId, runSeconds: t, arrive, depart: stop.final ? null : arrive + stop.dwell });
    t += stop.dwell + 4; // dwell + the time to get going again
  }
  return out;
}

function roundUp(x, step) {
  return Math.ceil(x / step) * step;
}

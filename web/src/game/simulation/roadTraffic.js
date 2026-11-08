// Road traffic: vehicles following lanes with the Intelligent Driver Model
// (IDM), the standard car-following model. Each vehicle accelerates towards
// its own cruising speed, keeps a safe time gap to the vehicle ahead, and
// brakes smoothly for red stop lines (the level-crossing gates), so queues
// build up naturally when a train is coming and dissolve when the gates lift.
// Pure logic (no Three.js) — unit-tested in roadTraffic.test.js.

const IDM = {
  a: 1.3, // max acceleration m/s²
  b: 2.2, // comfortable deceleration m/s²
  T: 1.2, // desired time gap s
  s0: 2.2, // minimum bumper gap m
};

/**
 * @param lanes   [{ id, length }]
 * @param vehicles [{ type, lane, d, length, v0 }] initial placement (d = distance along the lane)
 */
export function createTraffic(lanes, vehicles) {
  return {
    lanes: lanes.map((l) => ({ ...l })),
    vehicles: vehicles.map((v, i) => ({ id: i, v: v.v0 * 0.8, active: true, waiting: 0, ...v })),
  };
}

function idmAccel(v, v0, gap, dv) {
  const sStar = IDM.s0 + Math.max(0, v * IDM.T + (v * dv) / (2 * Math.sqrt(IDM.a * IDM.b)));
  const free = 1 - Math.pow(v / Math.max(v0, 0.1), 4);
  const inter = gap > 0.01 ? (sStar / gap) ** 2 : 100;
  return IDM.a * (free - inter);
}

/**
 * Advance traffic by dt.
 * stops: { [laneId]: number[] } distances along each lane where vehicles must
 *        stop right now (red lights / closed gates). A vehicle that is already
 *        past a stop line (or too close to stop) keeps going.
 */
export function stepTraffic(traffic, dt, stops = {}) {
  const byLane = new Map();
  for (const veh of traffic.vehicles) {
    if (!veh.active) continue;
    if (!byLane.has(veh.lane)) byLane.set(veh.lane, []);
    byLane.get(veh.lane).push(veh);
  }
  for (const lane of traffic.lanes) {
    const list = (byLane.get(lane.id) ?? []).sort((a, b) => b.d - a.d); // leader first
    const laneStops = stops[lane.id] ?? [];
    for (let i = 0; i < list.length; i++) {
      const veh = list[i];
      const leader = list[i - 1];
      let gap = leader ? leader.d - leader.length / 2 - (veh.d + veh.length / 2) : Infinity;
      let dv = leader ? veh.v - leader.v : 0;
      // closest stop line ahead that we can still stop for
      for (const sd of laneStops) {
        const toLine = sd - (veh.d + veh.length / 2);
        const canStop = toLine > (veh.v * veh.v) / (2 * 4.5) - 0.5;
        if (toLine > -0.5 && canStop && toLine < gap) {
          gap = Math.max(0.01, toLine + IDM.s0 * 0.4);
          dv = veh.v;
        }
      }
      const acc = Math.max(-7, idmAccel(veh.v, veh.v0, gap, dv));
      veh.v = Math.max(0, veh.v + acc * dt);
      veh.d += veh.v * dt;
      veh.waiting = veh.v < 0.3 ? veh.waiting + dt : 0;
    }
    // vehicles leaving the end of the lane re-enter at the start (out of sight),
    // as long as the entry isn't blocked
    for (const veh of list) {
      if (veh.d - veh.length / 2 <= lane.length) continue;
      const entryClear = list.every((o) => o === veh || o.d > veh.length + 12 + o.length / 2 || o.d > lane.length);
      if (entryClear) {
        veh.d = 0;
        veh.v = veh.v0 * 0.85;
      }
    }
  }
  return traffic;
}

/** Spread `count` vehicles evenly (with jitter) along a lane. */
export function placeAlongLane(laneLength, count, rand) {
  const out = [];
  const spacing = laneLength / Math.max(1, count);
  for (let i = 0; i < count; i++) out.push(i * spacing + rand() * spacing * 0.5);
  return out;
}

// Journey rules: a run from the origin through every scheduled halt to the
// destination. At each halt the driver must stop with the loco inside the
// stop zone, hold it, wait out the dwell time until the guard gives the
// "right away", then depart. Pure logic, unit-tested in simulation.test.js.
//
// cfg (route.journey): { startDistance, stops: [{ stationId, name, marker,
// halfLength, dwell, scheduled, final }], approachDistance, stopHoldSeconds }
// A cfg without `stops` is treated as a single stop at cfg.stopMarker.

export const JOURNEY_STATE = {
  READY: 'ready',
  RUNNING: 'running',
  APPROACHING: 'approaching',
  STOPPED: 'stopped', // stopped inside the zone, hold timer running
  DWELL: 'dwell', // at an intermediate halt, waiting for the right-away
  COMPLETED: 'completed',
};

const STOPPED_SPEED = 0.1; // m/s
const MISSED_BEYOND = 150; // metres past the zone (and still moving) = stop missed

export function stopsOf(cfg) {
  if (cfg.stops?.length) return cfg.stops;
  return [{ stationId: cfg.destinationId, name: 'destination', marker: cfg.stopMarker, halfLength: cfg.stopZoneHalfLength, dwell: 0, final: true }];
}

export function createJourney() {
  return {
    state: JOURNEY_STATE.READY,
    elapsed: 0,
    stopTimer: 0,
    overspeedSeconds: 0,
    maxOverspeedKmh: 0,
    emergencyUsed: false,
    result: null,
    stopIndex: 0,
    dwellTimer: 0,
    stopResults: [], // per halt: { stationId, name, offset, rating, arrivedAt, scheduled, late, missed }
    earlyDepartures: 0,
    spadPenalties: 0, // signals passed at danger that count against the score (−25 each)
    rightAway: [], // indexes of halts where the guard gave the right-away (their starter clears)
    events: [], // 'arrived' | 'rightAway' | 'missed' | 'early' (consumed by the frame loop)
  };
}

/** The stop the train is heading for (or standing at). */
export function currentStop(journey, cfg) {
  const stops = stopsOf(cfg);
  return stops[Math.min(journey?.stopIndex ?? stops.length - 1, stops.length - 1)];
}

export function stopZone(cfg, stop = currentStop(null, cfg)) {
  const half = stop.halfLength ?? cfg.stopZoneHalfLength;
  return { start: stop.marker - half, end: stop.marker + half };
}

/** Metres from the loco front to the current stop marker. */
export function remainingDistance(train, cfg, journey = null) {
  return currentStop(journey, cfg).marker - train.routeDistance;
}

/** 0…1 over the whole journey (origin → final stop). */
export function journeyProgress(train, cfg) {
  const p = (train.routeDistance - cfg.startDistance) / (cfg.stopMarker - cfg.startDistance);
  return Math.min(Math.max(p, 0), 1);
}

function advance(journey, stops) {
  journey.stopIndex = Math.min(journey.stopIndex + 1, stops.length - 1);
  journey.dwellTimer = 0;
  journey.stopTimer = 0;
  journey.state = JOURNEY_STATE.RUNNING;
}

export function updateJourney(journey, train, dt, cfg, speedLimitKmh = Infinity) {
  if (journey.state === JOURNEY_STATE.COMPLETED) return journey;
  if (train.emergency && train.speedMps > 0.5) journey.emergencyUsed = true;
  const over = train.speedMps * 3.6 - speedLimitKmh;
  if (over > 1) {
    journey.overspeedSeconds += dt;
    journey.maxOverspeedKmh = Math.max(journey.maxOverspeedKmh, over);
  }

  if (journey.state === JOURNEY_STATE.READY) {
    if (train.speedMps > STOPPED_SPEED) journey.state = JOURNEY_STATE.RUNNING;
    else return journey;
  }

  journey.elapsed += dt;
  const stops = stopsOf(cfg);
  const stopped = train.speedMps < STOPPED_SPEED;

  // standing at an intermediate halt: wait for the right-away
  if (journey.state === JOURNEY_STATE.DWELL) {
    journey.dwellTimer -= dt;
    if (!stopped) {
      journey.earlyDepartures++;
      journey.events.push('early');
      advance(journey, stops);
    } else if (journey.dwellTimer <= 0) {
      journey.events.push('rightAway');
      journey.rightAway.push(journey.stopIndex);
      advance(journey, stops);
    }
    return journey;
  }

  const stop = stops[journey.stopIndex];
  const zone = stopZone(cfg, stop);
  const front = train.routeDistance;
  const inZone = front >= zone.start && front <= zone.end;
  const approaching = front >= stop.marker - cfg.approachDistance;

  // ran through an intermediate halt
  if (!stop.final && front > zone.end + MISSED_BEYOND && !stopped) {
    journey.stopResults.push({ stationId: stop.stationId, name: stop.name, missed: true, scheduled: stop.scheduled });
    journey.events.push('missed');
    advance(journey, stops);
    return journey;
  }

  if (inZone && stopped) {
    journey.state = JOURNEY_STATE.STOPPED;
    journey.stopTimer += dt;
    if (journey.stopTimer >= cfg.stopHoldSeconds) {
      const offset = front - stop.marker;
      journey.stopResults.push({
        stationId: stop.stationId,
        name: stop.name,
        offset,
        rating: rateStop(Math.abs(offset)),
        arrivedAt: journey.elapsed,
        scheduled: stop.scheduled,
        late: stop.scheduled ? journey.elapsed - stop.scheduled : 0,
      });
      if (stop.final || journey.stopIndex >= stops.length - 1) {
        journey.state = JOURNEY_STATE.COMPLETED;
        const late = stop.scheduled ? journey.elapsed - stop.scheduled : 0;
        journey.result = {
          elapsed: journey.elapsed,
          maxSpeedKmh: train.maxSpeedReachedMps * 3.6,
          stopOffset: offset,
          stopRating: rateStop(Math.abs(offset)),
          overspeedSeconds: journey.overspeedSeconds,
          maxOverspeedKmh: journey.maxOverspeedKmh,
          emergencyUsed: journey.emergencyUsed,
          stops: journey.stopResults.map((r) => ({ ...r })),
          missedStops: journey.stopResults.filter((r) => r.missed).length,
          earlyDepartures: journey.earlyDepartures,
          spads: journey.spadPenalties,
          scheduled: stop.scheduled ?? null,
          lateSeconds: late,
          score: scoreJourney(Math.abs(offset), journey),
        };
      } else {
        journey.state = JOURNEY_STATE.DWELL;
        journey.dwellTimer = stop.dwell ?? 20;
        journey.stopTimer = 0;
        journey.events.push('arrived');
      }
    }
  } else {
    journey.stopTimer = 0;
    journey.state = approaching ? JOURNEY_STATE.APPROACHING : JOURNEY_STATE.RUNNING;
  }
  return journey;
}

/** Punctuality penalty: free up to 30 s late, then −1 per 10 s (max −15). */
export function latenessPenalty(lateSeconds) {
  return Math.min(15, Math.max(0, (lateSeconds - 30) / 10));
}

/**
 * 0–100 driving score: stop accuracy (averaged over every halt), speed
 * discipline, smooth braking, missed halts, leaving before the right-away,
 * signals passed at danger, and punctuality at the destination.
 */
export function scoreJourney(absOffset, journey) {
  const arrived = (journey.stopResults ?? []).filter((r) => !r.missed);
  const accuracy = arrived.length ? arrived.reduce((n, r) => n + Math.min(40, Math.abs(r.offset) * 1.2), 0) / arrived.length : Math.min(40, absOffset * 1.2);
  let score = 100 - accuracy;
  score -= Math.min(40, journey.overspeedSeconds * 2 + journey.maxOverspeedKmh);
  if (journey.emergencyUsed) score -= 15;
  score -= 20 * (journey.stopResults ?? []).filter((r) => r.missed).length;
  score -= 8 * (journey.earlyDepartures ?? 0);
  score -= 25 * (journey.spadPenalties ?? 0);
  const last = arrived[arrived.length - 1];
  if (last?.scheduled) score -= latenessPenalty(last.late);
  return Math.max(0, Math.round(score));
}

export function rateStop(absOffset) {
  if (absOffset <= 5) return 'Excellent';
  if (absOffset <= 15) return 'Good';
  return 'Within stop zone';
}

/** One-line guidance for the HUD, derived from current state. */
export function journeyHint(journey, train, cfg) {
  const stop = currentStop(journey, cfg);
  const zone = stopZone(cfg, stop);
  const front = train.routeDistance;
  const stopped = train.speedMps < STOPPED_SPEED;
  switch (journey.state) {
    case JOURNEY_STATE.READY:
      if (train.brake > 0.04) return 'Release the A9 brake (hold X) — brake pipe must recharge to 5.0';
      if (train.direction === 0) return 'Set the reverser to Forward with F';
      if (train.bp < 4.75) return 'Wait for the brake pipe to recharge…';
      if (train.throttle === 0) return 'Notch up the TE/BE lever (hold W)';
      return '';
    case JOURNEY_STATE.APPROACHING:
      if (stopped && front > zone.end) return 'Overshot the stop zone — select Reverse (F) and back up';
      if (stopped && front < zone.start) return `Move up to the stop marker — ${Math.round(zone.start - front)} m to go`;
      return `Approaching ${stop.name} — brake to stop at the marker`;
    case JOURNEY_STATE.STOPPED:
      return stop.final ? 'Stopped at the platform — hold position…' : `Stopped at ${stop.name} — hold position…`;
    case JOURNEY_STATE.DWELL:
      return `Halt at ${stop.name}: passengers boarding — right away in ${Math.max(0, Math.ceil(journey.dwellTimer))} s (keep the brakes on)`;
    default:
      return '';
  }
}

// Journey rules: when has the player started, are they approaching the
// destination, have they stopped in the zone long enough to complete?
// Pure logic, unit-tested in journeyManager.test.js.

export const JOURNEY_STATE = {
  READY: 'ready',
  RUNNING: 'running',
  APPROACHING: 'approaching',
  STOPPED: 'stopped', // stopped inside the destination zone, hold timer running
  COMPLETED: 'completed',
};

export function createJourney() {
  return {
    state: JOURNEY_STATE.READY,
    elapsed: 0,
    stopTimer: 0,
    overspeedSeconds: 0,
    maxOverspeedKmh: 0,
    emergencyUsed: false,
    result: null,
  };
}

export function stopZone(cfg) {
  return { start: cfg.stopMarker - cfg.stopZoneHalfLength, end: cfg.stopMarker + cfg.stopZoneHalfLength };
}

export function remainingDistance(train, cfg) {
  return cfg.stopMarker - train.routeDistance;
}

export function journeyProgress(train, cfg) {
  const p = (train.routeDistance - cfg.startDistance) / (cfg.stopMarker - cfg.startDistance);
  return Math.min(Math.max(p, 0), 1);
}

const STOPPED_SPEED = 0.1; // m/s

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

  const zone = stopZone(cfg);
  const front = train.routeDistance;
  const inZone = front >= zone.start && front <= zone.end;
  const stopped = train.speedMps < STOPPED_SPEED;
  const approaching = front >= cfg.stopMarker - cfg.approachDistance;

  if (inZone && stopped) {
    journey.state = JOURNEY_STATE.STOPPED;
    journey.stopTimer += dt;
    if (journey.stopTimer >= cfg.stopHoldSeconds) {
      journey.state = JOURNEY_STATE.COMPLETED;
      const offset = front - cfg.stopMarker;
      journey.result = {
        elapsed: journey.elapsed,
        maxSpeedKmh: train.maxSpeedReachedMps * 3.6,
        stopOffset: offset,
        stopRating: rateStop(Math.abs(offset)),
        overspeedSeconds: journey.overspeedSeconds,
        maxOverspeedKmh: journey.maxOverspeedKmh,
        emergencyUsed: journey.emergencyUsed,
        score: scoreJourney(Math.abs(offset), journey),
      };
    }
  } else {
    journey.stopTimer = 0;
    journey.state = approaching ? JOURNEY_STATE.APPROACHING : JOURNEY_STATE.RUNNING;
  }
  return journey;
}

/** 0–100 driving score: stop accuracy, speed discipline, smooth braking. */
export function scoreJourney(absOffset, journey) {
  let score = 100;
  score -= Math.min(40, absOffset * 1.2);
  score -= Math.min(40, journey.overspeedSeconds * 2 + journey.maxOverspeedKmh);
  if (journey.emergencyUsed) score -= 15;
  return Math.max(0, Math.round(score));
}

export function rateStop(absOffset) {
  if (absOffset <= 5) return 'Excellent';
  if (absOffset <= 15) return 'Good';
  return 'Within stop zone';
}

/** One-line guidance for the HUD, derived from current state. */
export function journeyHint(journey, train, cfg, destinationName) {
  const zone = stopZone(cfg);
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
      return `Approaching ${destinationName} — brake to stop at the marker`;
    case JOURNEY_STATE.STOPPED:
      return 'Stopped at the platform — hold position…';
    default:
      return '';
  }
}

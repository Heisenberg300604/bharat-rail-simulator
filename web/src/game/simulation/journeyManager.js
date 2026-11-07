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

export function updateJourney(journey, train, dt, cfg) {
  if (journey.state === JOURNEY_STATE.COMPLETED) return journey;

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
      };
    }
  } else {
    journey.stopTimer = 0;
    journey.state = approaching ? JOURNEY_STATE.APPROACHING : JOURNEY_STATE.RUNNING;
  }
  return journey;
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
      if (train.brake > 0.05) return 'Release the brake (hold X), then raise the throttle (hold W)';
      if (train.direction === 0) return 'Select a direction with F';
      if (train.throttle === 0) return 'Raise the throttle (hold W)';
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

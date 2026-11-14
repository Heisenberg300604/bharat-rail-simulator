// Live colour-light signalling (Multiple Aspect Colour Light Signalling).
// Pure logic (no Three.js / React) — unit-tested in signalling.test.js.
//
// Aspects, as on Indian Railways:
//   RED      stop — never pass it (a SPAD: Signal Passed At Danger)
//   YELLOW   caution — proceed, prepared to stop at the next signal
//   YY       attention (double yellow) — the next signal is at caution
//   GREEN    proceed at line speed
// Each signal's aspect follows from the one after it (next red → yellow,
// next yellow → double yellow on 4-aspect lines, else green), unless the
// signal itself is held at danger:
//   • the STARTER of a station where the train is booked to stop stays red
//     until the right-away (the station master clears it to dispatch you);
//   • a HOME signal may be held at danger when the platform is occupied; it
//     clears once the train has waited at it (or after a while, regardless);
//   • at a terminus the buffer stop counts as a red ahead;
//   • for the opposite direction, any block occupied by an AI train is red.

export const ASPECT = { RED: 'red', YELLOW: 'yellow', YY: 'yy', GREEN: 'green' };
export const ASPECT_LABEL = { red: 'Red · stop', yellow: 'Yellow · caution', yy: 'Double yellow · attention', green: 'Green · proceed' };

function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** What a signal is, from where it stands relative to the stations. */
function classify(sig, stations) {
  for (const st of stations) {
    if (!sig.rev) {
      if (sig.s < st.platformStart && sig.s > st.platformStart - 700) return { kind: 'home', station: st };
      if (sig.s <= st.platformStart - 700 && sig.s > st.platformStart - 2200) return { kind: 'distant', station: st };
      if (sig.s >= st.platformEnd - 5 && sig.s < st.platformEnd + 400) return { kind: 'starter', station: st };
    } else {
      if (sig.s > st.platformEnd && sig.s < st.platformEnd + 700) return { kind: 'home', station: st };
      if (sig.s <= st.platformStart + 5 && sig.s > st.platformStart - 400) return { kind: 'starter', station: st };
    }
  }
  return { kind: 'auto', station: null };
}

const KIND_LABEL = { home: 'Home', distant: 'Distant', starter: 'Starter', auto: 'Automatic' };

/**
 * @param route  built route ({ signals, stations, journey, double })
 * @param opts   { seed, holdChance } holdChance = probability that a station's
 *               home signal is held at danger when the train arrives
 */
export function createSignalling(route, { seed = 1, holdChance = 0.35 } = {}) {
  const rand = seeded(seed);
  const stops = route.journey.stops;
  const mk = (def, i) => {
    const { kind, station } = classify(def, route.stations);
    const stopIdx = station ? stops.findIndex((x) => x.stationId === station.id) : -1;
    const isOrigin = station && station.id === route.stations[0].id;
    const sig = {
      id: i,
      s: def.s,
      lat: def.lat,
      rev: !!def.rev,
      kind,
      stationId: station?.id ?? null,
      name: station ? `${KIND_LABEL[kind]} · ${station.code}` : `Automatic ${Math.round(def.s / 100) / 10} km`,
      stopIdx, // index in journey.stops of the halt this signal belongs to (-1: none)
      final: station?.id === route.journey.destinationId,
      aspect: ASPECT.GREEN,
      held: false,
      holdWait: 0,
      waited: 0,
      approachTime: 0,
      spad: false,
      failed: false, // an automatic signal stuck at 'on' (incidents.js, GR 9.02)
      failWait: 0,
      failWaited: 0,
      authorised: false, // may be passed at 'on' after the GR 9.02 wait
    };
    if (!sig.rev && kind === 'home' && !isOrigin && stopIdx >= 0 && rand() < holdChance) {
      sig.held = true;
      sig.holdWait = 12 + rand() * 18; // seconds the driver must wait at it
    }
    return sig;
  };
  const all = route.signals.map(mk);
  return {
    up: all.filter((x) => !x.rev).sort((a, b) => a.s - b.s),
    down: all.filter((x) => x.rev).sort((a, b) => b.s - a.s),
    fourAspect: route.double, // automatic 4-aspect on double lines, 3-aspect absolute block on single
    bufferStop: route.journey.bufferStop,
    passed: 0, // signals passed at a proceed aspect (driver school uses it)
    version: 0, // bumps whenever any aspect changes (rendering updates then)
    lastFront: null,
  };
}

function chain(next, four) {
  if (next === ASPECT.RED) return ASPECT.YELLOW;
  if (next === ASPECT.YELLOW) return four ? ASPECT.YY : ASPECT.GREEN;
  return ASPECT.GREEN;
}

/**
 * Advance one step.
 * ctx: { front, speed, dt, stopIndex, dwellDone (bool for the current stop),
 *        rightAway: [halt indexes dispatched by the guard],
 *        aiSpans: [[sMin, sMax], …] for trains on the opposite line }
 * Returns events: [{ type: 'spad', signal }, { type: 'passed', signal }, { type: 'cleared', signal }]
 */
export function updateSignalling(st, ctx) {
  const events = [];
  const { front, speed, dt } = ctx;
  let changed = false;
  const set = (sig, a) => {
    if (sig.aspect !== a) {
      sig.aspect = a;
      changed = true;
    }
  };

  // held home signals: clear once the driver has waited at it (or after a while)
  for (const sig of st.up) {
    if (!sig.held) continue;
    const d = sig.s - front;
    if (d > 0 && d < 1500) sig.approachTime += dt;
    if (d > 0 && d < 450 && speed < 0.1) sig.waited += dt;
    if (sig.waited >= sig.holdWait || sig.approachTime > 150 || d < -50) {
      sig.held = false;
      events.push({ type: 'cleared', signal: sig });
    }
  }

  // failed automatic signal: stop in rear, wait 1 min by day / 2 by night (GR 9.02)
  for (const sig of st.up) {
    if (!sig.failed || sig.authorised) continue;
    const d = sig.s - front;
    if (d > 0 && d < 450 && speed < 0.1) sig.failWaited += dt;
    if (sig.failWaited >= sig.failWait) {
      sig.authorised = true;
      events.push({ type: 'authorised', signal: sig });
    }
  }

  // player's direction: walk back from the end of the line
  let next = ASPECT.RED; // the buffer stop beyond the last signal
  for (let i = st.up.length - 1; i >= 0; i--) {
    const sig = st.up[i];
    let danger = sig.held || sig.failed;
    // the starter at a booked halt stays at danger until the right-away
    // (leaving early or running through doesn't clear it — passing it then is a SPAD)
    if (sig.kind === 'starter' && sig.stopIdx >= 0) {
      if (sig.final) danger = true;
      else if (!(ctx.rightAway ?? []).includes(sig.stopIdx) && !(ctx.stopIndex === sig.stopIdx && ctx.dwellDone)) danger = true;
    }
    const a = danger ? ASPECT.RED : chain(next, st.fourAspect);
    set(sig, a);
    next = a;
  }

  // opposite direction: blocks occupied by AI trains are protected by red
  next = ASPECT.GREEN;
  const spans = ctx.aiSpans ?? [];
  for (let i = st.down.length - 1; i >= 0; i--) {
    const sig = st.down[i]; // down is sorted by descending s; walk from the far end (low s)
    const blockEnd = i + 1 < st.down.length ? st.down[i + 1].s : -Infinity;
    const occupied = spans.some(([a, b]) => b >= blockEnd && a <= sig.s);
    const a = occupied ? ASPECT.RED : chain(next, st.fourAspect);
    set(sig, a);
    next = a;
  }

  // passing signals: SPAD if at danger
  if (st.lastFront !== null && front > st.lastFront) {
    for (const sig of st.up) {
      if (sig.s > st.lastFront && sig.s <= front) {
        if (sig.aspect === ASPECT.RED && sig.authorised) {
          events.push({ type: 'passedAuthorised', signal: sig });
        } else if (sig.aspect === ASPECT.RED && !sig.spad) {
          sig.spad = true;
          events.push({ type: 'spad', signal: sig });
        } else if (sig.aspect !== ASPECT.RED) {
          st.passed++;
          events.push({ type: 'passed', signal: sig });
        }
      }
    }
  }
  st.lastFront = front;
  if (changed) st.version++;
  return events;
}

/** Make the automatic signal at route distance s fail at 'on' (B5 incidents). */
export function failSignal(st, s, waitSeconds) {
  const sig = st.up.find((x) => x.s === s && x.kind === 'auto');
  if (!sig) return null;
  sig.failed = true;
  sig.failWait = waitSeconds;
  sig.failWaited = 0;
  sig.authorised = false;
  return sig;
}

/** The next stop signal beyond route distance s (where a GR 9.02 cautious run ends). */
export function nextStopSignalAfter(st, s) {
  return st.up.find((x) => x.s > s + 0.5 && x.kind !== 'distant') ?? null;
}

/** The next signal ahead of the train (player's direction), with its distance. */
export function nextSignal(st, front, range = 2500) {
  for (const sig of st.up) {
    if (sig.s > front + 0.5) {
      const distance = sig.s - front;
      return distance <= range ? { ...sig, distance } : null;
    }
  }
  return null;
}

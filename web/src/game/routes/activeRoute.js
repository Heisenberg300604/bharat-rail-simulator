// The route currently being driven.
//
// Everything route-specific is exported as an ES-module *live binding*
// (`export let`): when setActiveRoute() reassigns them, every module that
// imported them sees the new values without being rewritten. Modules that
// derive data from the route at load time (track layout, terrain, rail
// joints…) subscribe with onRouteChange() and rebuild themselves.
//
// The 3D world is keyed by route id in GameCanvas, so every scene builder
// re-runs and disposes the old route's GPU resources cleanly.
import { ROUTE_DEFS, DEFAULT_ROUTE_ID, getRouteDef, isRouteId } from './index.js';
import { buildRoute } from './buildRoute.js';

const compiled = new Map(); // route id → built route (cheap data, kept for the picker)
export function getBuiltRoute(id) {
  if (!compiled.has(id)) compiled.set(id, buildRoute(getRouteDef(id)));
  return compiled.get(id);
}
/** Lightweight summaries for the route picker. */
export function routeSummaries() {
  return ROUTE_DEFS.map((d) => getBuiltRoute(d.id));
}

/** @type {ReturnType<typeof buildRoute>} */
export let ROUTE;
export let routeId;
export let route; // geometry: sample(s) → { x, z, y, heading, lx, lz }, heightAt, gradeAt…
export let ROUTE_SEGMENTS;
export let STATIONS;
export let JOURNEY;
export let SPEED_LIMITS;
export let AI_TRAINS;
export let PARKED_TRAINS;
export let ROAD;
export let LEVEL_CROSSINGS;
export let SIGNALS;
export let BRIDGES;
export let TUNNELS;
export let DOUBLE_LINE;

const listeners = [];
/** fn(route) runs now (if a route is active) and after every route change. */
export function onRouteChange(fn) {
  listeners.push(fn);
  if (ROUTE) fn(ROUTE);
  return () => listeners.splice(listeners.indexOf(fn), 1);
}

export function setActiveRoute(id) {
  const next = getBuiltRoute(isRouteId(id) ? id : DEFAULT_ROUTE_ID);
  if (next === ROUTE) return false;
  ROUTE = next;
  routeId = next.id;
  route = next.geometry;
  ROUTE_SEGMENTS = next.segments;
  STATIONS = next.stations;
  JOURNEY = next.journey;
  SPEED_LIMITS = next.speedLimits;
  AI_TRAINS = next.aiTrains;
  PARKED_TRAINS = next.parkedTrains;
  ROAD = next.road;
  LEVEL_CROSSINGS = next.levelCrossings;
  SIGNALS = next.signals;
  BRIDGES = next.bridges;
  TUNNELS = next.tunnels;
  DOUBLE_LINE = next.double;
  for (const fn of [...listeners]) fn(next);
  return true;
}

/** Route saved with the player's settings (browser only), so the first build is the right one. */
function savedRouteId() {
  try {
    return JSON.parse(globalThis.localStorage?.getItem('brs-settings') || '{}').route;
  } catch {
    return undefined;
  }
}
setActiveRoute(savedRouteId() ?? DEFAULT_ROUTE_ID);

/** Is route distance s inside a tunnel? (margin extends the range at both ends) */
export function tunnelAt(s, margin = 0) {
  for (const t of TUNNELS) if (s > t.from - margin && s < t.to + margin) return t;
  return null;
}
/** Is route distance s on a bridge that carries our track? */
export function bridgeAt(s, margin = 0) {
  for (const b of BRIDGES) if (b.track !== false && s > b.from - margin && s < b.to + margin) return b;
  return null;
}

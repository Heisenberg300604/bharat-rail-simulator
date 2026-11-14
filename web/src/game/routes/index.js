// Route registry. Route files are plain data (a few KB each), so they are
// imported statically; the expensive part — building the 3D world — only
// happens for the route that is actually selected (see activeRoute.js).
import ndlsGzb from './ndls-gzb.js';
import bhorGhat from './bhor-ghat.js';
import konkan from './konkan.js';
import pamban from './pamban.js';
import gatimaan from './gatimaan.js';
import howrahBandel from './howrah-bandel.js';

export const ROUTE_DEFS = [ndlsGzb, bhorGhat, konkan, pamban, gatimaan, howrahBandel];
export const DEFAULT_ROUTE_ID = ndlsGzb.id;

export function getRouteDef(id) {
  return ROUTE_DEFS.find((r) => r.id === id) ?? ndlsGzb;
}
export function isRouteId(id) {
  return ROUTE_DEFS.some((r) => r.id === id);
}

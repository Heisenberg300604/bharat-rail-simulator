// Route geometry, independent of Three.js so it can be unit-tested in Node.
//
// The route lies on the ground plane (x, z). "heading" h is the direction of
// travel: direction vector = (cos h, sin h) in (x, z).
// Any point on the route is identified by s = distance along the track.

/**
 * @param {Array<{type:'straight'|'arc', length:number, radius?:number, turn?:'left'|'right'}>} segmentDefs
 * @param {{x?:number, z?:number, heading?:number}} start
 */
export function createRoute(segmentDefs, start = {}) {
  let x = start.x ?? 0;
  let z = start.z ?? 0;
  let heading = start.heading ?? 0;
  let s = 0;
  const segments = [];

  for (const def of segmentDefs) {
    if (!(def.length > 0)) throw new Error('Route segment needs a positive length');
    let curvature = 0;
    if (def.type === 'arc') {
      if (!(def.radius > 0)) throw new Error('Arc segment needs a positive radius');
      // In Three.js (y up), increasing heading turns to the RIGHT, so left = negative.
      curvature = (def.turn === 'left' ? -1 : 1) / def.radius;
    }
    const seg = { type: def.type, length: def.length, curvature, startS: s, x0: x, z0: z, h0: heading };
    segments.push(seg);

    const end = pointOnSegment(seg, def.length, {});
    x = end.x;
    z = end.z;
    heading = end.heading;
    s += def.length;
  }

  const length = s;

  function findSegment(dist) {
    // Few segments, so a linear search is fine and easy to read.
    for (let i = segments.length - 1; i >= 0; i--) {
      if (dist >= segments[i].startS) return segments[i];
    }
    return segments[0];
  }

  /**
   * Position and heading at distance s. Writes into `out` to avoid allocating
   * objects every frame. Also returns lateral "left" vector (lx, lz).
   */
  function sample(dist, out = {}) {
    const d = Math.min(Math.max(dist, 0), length);
    const seg = findSegment(d);
    pointOnSegment(seg, d - seg.startS, out);
    out.lx = Math.sin(out.heading);
    out.lz = -Math.cos(out.heading);
    return out;
  }

  /** Signed curvature (1/radius) at distance s; 0 on straights. */
  function curvatureAt(dist) {
    return findSegment(Math.min(Math.max(dist, 0), length)).curvature;
  }

  return { segments, length, sample, curvatureAt };
}

function pointOnSegment(seg, t, out) {
  const { x0, z0, h0, curvature: k } = seg;
  if (k === 0) {
    out.x = x0 + Math.cos(h0) * t;
    out.z = z0 + Math.sin(h0) * t;
    out.heading = h0;
  } else {
    // Exact circular arc: integrate (cos h, sin h) with h = h0 + k·t
    const h = h0 + k * t;
    out.x = x0 + (Math.sin(h) - Math.sin(h0)) / k;
    out.z = z0 - (Math.cos(h) - Math.cos(h0)) / k;
    out.heading = h;
  }
  return out;
}

/**
 * Position of a rail vehicle whose centre is at route distance centerS.
 * The body sits between its two bogies, so on a curve it forms a chord —
 * just like a real coach. Yaw is ready for Object3D.rotation.y.
 */
const tmpFront = {};
const tmpRear = {};
export function vehiclePose(route, centerS, bogieSpacing, out = {}) {
  route.sample(centerS + bogieSpacing / 2, tmpFront);
  route.sample(centerS - bogieSpacing / 2, tmpRear);
  out.x = (tmpFront.x + tmpRear.x) / 2;
  out.z = (tmpFront.z + tmpRear.z) / 2;
  const heading = Math.atan2(tmpFront.z - tmpRear.z, tmpFront.x - tmpRear.x);
  out.heading = heading;
  out.yaw = -heading; // local +X (vehicle front) points along the track
  return out;
}

/** Centre offsets (distance behind the locomotive front) for each vehicle. */
export function computeFormation(formation) {
  const vehicles = [];
  const loco = formation.locomotive;
  let back = 0; // distance from locomotive front to the rear of the last vehicle
  vehicles.push({ kind: 'locomotive', index: 0, ...loco, centerOffset: loco.length / 2 });
  back = loco.length;
  for (let i = 0; i < formation.coachCount; i++) {
    back += formation.couplingGap;
    const c = formation.coach;
    vehicles.push({ kind: 'coach', index: i, ...c, centerOffset: back + c.length / 2 });
    back += c.length;
  }
  return { vehicles, totalLength: back };
}

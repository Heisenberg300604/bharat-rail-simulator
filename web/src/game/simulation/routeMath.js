// Route geometry, independent of Three.js so it can be unit-tested in Node.
//
// The route lies on the ground plane (x, z). "heading" h is the direction of
// travel: direction vector = (cos h, sin h) in (x, z).
// Any point on the route is identified by s = distance along the track.

/**
 * Vertical profile: elevation points [{ s, z }] joined by constant gradients,
 * with a parabolic vertical curve at every change of gradient (like a real
 * railway). Returns { heightAt(s), gradeAt(s) }; grade is rise per metre.
 */
export function createProfile(points = [], maxCurve = 240) {
  const pts = [...points].sort((a, b) => a.s - b.s);
  if (pts.length === 0) return { heightAt: () => 0, gradeAt: () => 0, points: [] };
  if (pts.length === 1) return { heightAt: () => pts[0].z, gradeAt: () => 0, points: pts };
  const n = pts.length;
  const grades = [];
  for (let i = 0; i < n - 1; i++) grades.push((pts[i + 1].z - pts[i].z) / Math.max(1e-6, pts[i + 1].s - pts[i].s));
  // vertical curve length at each interior vertex (never more than ~half a span)
  const curves = pts.map((p, i) => {
    if (i === 0 || i === n - 1) return 0;
    return Math.min(maxCurve, 0.45 * (p.s - pts[i - 1].s), 0.45 * (pts[i + 1].s - p.s));
  });
  function span(s) {
    let i = 0;
    while (i < n - 2 && s >= pts[i + 1].s) i++;
    return i;
  }
  function heightAt(s) {
    if (s <= pts[0].s) return pts[0].z;
    if (s >= pts[n - 1].s) return pts[n - 1].z;
    // inside a vertical curve?
    for (let k = 1; k < n - 1; k++) {
      const L = curves[k];
      if (L > 0 && Math.abs(s - pts[k].s) < L / 2) {
        const g1 = grades[k - 1];
        const g2 = grades[k];
        const x = s - pts[k].s;
        return pts[k].z + g1 * x + ((g2 - g1) * (x + L / 2) ** 2) / (2 * L);
      }
    }
    const i = span(s);
    return pts[i].z + grades[i] * (s - pts[i].s);
  }
  function gradeAt(s) {
    if (s <= pts[0].s || s >= pts[n - 1].s) return 0;
    for (let k = 1; k < n - 1; k++) {
      const L = curves[k];
      if (L > 0 && Math.abs(s - pts[k].s) < L / 2) {
        const g1 = grades[k - 1];
        const g2 = grades[k];
        return g1 + ((g2 - g1) * (s - pts[k].s + L / 2)) / L;
      }
    }
    return grades[span(s)];
  }
  return { heightAt, gradeAt, points: pts };
}

/**
 * @param {Array<{type:'straight'|'arc', length:number, radius?:number, turn?:'left'|'right'}>} segmentDefs
 * @param {{x?:number, z?:number, heading?:number}} start
 * @param {Array<{s:number, z:number}>} [profilePoints] vertical profile (elevation in metres)
 */
export function createRoute(segmentDefs, start = {}, profilePoints = []) {
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
  const profile = createProfile(profilePoints);

  function findSegment(dist) {
    // Few segments, so a linear search is fine and easy to read.
    for (let i = segments.length - 1; i >= 0; i--) {
      if (dist >= segments[i].startS) return segments[i];
    }
    return segments[0];
  }

  /**
   * Position and heading at distance s. Writes into `out` to avoid allocating
   * objects every frame. Also returns lateral "left" vector (lx, lz) and the
   * track (formation) elevation y.
   */
  function sample(dist, out = {}) {
    const d = Math.min(Math.max(dist, 0), length);
    const seg = findSegment(d);
    pointOnSegment(seg, d - seg.startS, out);
    out.lx = Math.sin(out.heading);
    out.lz = -Math.cos(out.heading);
    out.y = profile.heightAt(d);
    return out;
  }

  /** Signed curvature (1/radius) at distance s; 0 on straights. */
  function curvatureAt(dist) {
    return findSegment(Math.min(Math.max(dist, 0), length)).curvature;
  }

  /** Track elevation (m) and gradient (rise per metre) at distance s. */
  const heightAt = (dist) => profile.heightAt(Math.min(Math.max(dist, 0), length));
  const gradeAt = (dist) => profile.gradeAt(Math.min(Math.max(dist, 0), length));

  return { segments, length, sample, curvatureAt, heightAt, gradeAt };
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
  const yf = tmpFront.y ?? 0;
  const yr = tmpRear.y ?? 0;
  out.y = (yf + yr) / 2;
  const heading = Math.atan2(tmpFront.z - tmpRear.z, tmpFront.x - tmpRear.x);
  out.heading = heading;
  out.yaw = -heading; // local +X (vehicle front) points along the track
  out.pitch = Math.atan2(yf - yr, Math.max(1e-6, bogieSpacing)); // + = nose up
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

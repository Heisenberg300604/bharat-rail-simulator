// Occupancy grid in route coordinates (s along the line, lat across it), so
// scenery placed later never overlaps scenery placed earlier. Pure JS (no
// Three.js) — unit-tested in occupancy.test.js.
//
// Each cell remembers the highest "level" marked on it: e.g. 1 = soft (a
// field: a tree may stand in it, a house may not), 2 = solid (a building).

export class Occupancy {
  constructor(cell = 2) {
    this.cell = cell;
    this.map = new Map();
  }
  _range(s, lat, w, d, pad) {
    const c = this.cell;
    return [Math.floor((s - w / 2 - pad) / c), Math.floor((s + w / 2 + pad) / c), Math.floor((lat - d / 2 - pad) / c), Math.floor((lat + d / 2 + pad) / c)];
  }
  /** Mark a w (along s) × d (across) rectangle centred on (s, lat). */
  mark(s, lat, w, d, level = 2, pad = 0) {
    const [i0, i1, j0, j1] = this._range(s, lat, w, d, pad);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        const k = i * 100003 + j;
        if ((this.map.get(k) ?? 0) < level) this.map.set(k, level);
      }
    }
  }
  /** True if no cell of the rectangle (grown by pad) is marked at `level` or above. */
  free(s, lat, w, d, pad = 0, level = 1) {
    const [i0, i1, j0, j1] = this._range(s, lat, w, d, pad);
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) if ((this.map.get(i * 100003 + j) ?? 0) >= level) return false;
    }
    return true;
  }
  /** Level marked at a single point (0 if nothing). */
  at(s, lat) {
    return this.map.get(Math.floor(s / this.cell) * 100003 + Math.floor(lat / this.cell)) ?? 0;
  }
}

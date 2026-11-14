// Bridges and tunnels.
//  • Tunnels: an arched bore swept along the line (one merged mesh for every
//    tunnel on the route) and masonry portals whose headwall fills the gap
//    between the arch and the hillside above it.
//  • Bridges: concrete deck + parapets swept along the line, piers placed
//    per span down to the ground or sea bed (instanced), steel through-truss
//    spans (one instanced unit truss), the lift-span towers of the Pamban
//    bridge, the old bridge alongside and the road bridge beyond.
// Every route's structures cost ~8 draw calls in total.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { ROUTE } from '../../config/gameConfig.js';
import { mainLine } from '../../world/trackLayout.js';
import { terrain } from '../../world/terrain.js';
import { buildRibbonGeometry, mergeGeometries } from '../../world/geometry.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';
import { useQuality } from '../../state/gameStore.js';

const DECK_DEPTH = { girder: 2.6, viaduct: 2.4, sea: 1.8, truss: 1.4 };

/** Lateral extent [lo, hi] of the deck for the route's tracks. */
function deckLats(double) {
  return double ? [-5.3 - 3.4, 3.4] : [-3.4, 3.4];
}

function boreProfile(bore) {
  const { c, hw, wall, crown } = bore;
  const pts = [[c + hw, -0.1], [c + hw, wall]];
  for (let k = 1; k < 12; k++) {
    const a = (k / 12) * Math.PI;
    pts.push([c + hw * Math.cos(a), wall + (crown - wall) * Math.sin(a)]);
  }
  pts.push([c - hw, wall], [c - hw, -0.1]);
  return pts;
}

/** A line that follows the track in plan but at a height given by fn(s). */
function heightLine(fn, lateralShift = 0) {
  return {
    length: mainLine.length,
    sample(s, out = {}) {
      mainLine.sample(s, out);
      out.x += out.lx * lateralShift;
      out.z += out.lz * lateralShift;
      out.y = fn(s);
      return out;
    },
  };
}

function buildTunnels() {
  const T = terrain;
  const bore = T.bore;
  const tubes = [];
  const floors = [];
  const portals = new ModelBuilder();
  const p = {};
  for (const tn of ROUTE.tunnels) {
    tubes.push(buildRibbonGeometry(mainLine, boreProfile(bore), { from: tn.from - 0.4, to: tn.to + 0.4, step: 4, uvScale: 6 }));
    floors.push(buildRibbonGeometry(mainLine, [[bore.c + bore.hw, -0.03], [bore.c - bore.hw, -0.03]], { from: tn.from - 0.8, to: tn.to + 0.8, step: 6 }));
    // portal headwalls: vertical slices from the arch (or the ground) up to the hillside
    for (const [s, dir] of [
      [tn.from, -1],
      [tn.to, 1],
    ]) {
      mainLine.sample(s, p);
      const m = new THREE.Matrix4().makeRotationY(-p.heading).setPosition(p.x, p.y, p.z);
      const x0 = dir < 0 ? -1.4 : 0;
      const x1 = dir < 0 ? 0 : 1.4;
      const lo = bore.c - bore.hw - 1.4;
      const hi = bore.c + bore.hw + 1.4;
      const N = 18;
      let topMax = 0;
      for (let k = 0; k < N; k++) {
        const la = lo + ((hi - lo) * k) / N;
        const lb = lo + ((hi - lo) * (k + 1)) / N;
        const lm = (la + lb) / 2;
        const u = (lm - bore.c) / bore.hw;
        const yArch = Math.abs(u) < 1 ? bore.wall + (bore.crown - bore.wall) * Math.sqrt(1 - u * u) : -0.2;
        const top = Math.max(bore.crown + 2, T.groundY(s - dir * 3, lm) - p.y + 1.2);
        topMax = Math.max(topMax, top);
        portals.box([x0, x1], [yArch, top], [-lb, -la], '#7c7366', { matrix: m });
      }
      // stone pilasters, cornice and a dark name plate above the arch
      for (const lat of [bore.c + bore.hw + 0.7, bore.c - bore.hw - 0.7]) portals.box([x0 - dir * 0.35, x1 - dir * 0.35], [-0.2, bore.crown + 1.6], [-lat - 0.7, -lat + 0.7], '#948a7a', { matrix: m });
      portals.box(dir < 0 ? [x0 - 0.4, x1] : [x0, x1 + 0.4], [bore.crown + 1.5, bore.crown + 2.0], [-hi, -lo], '#a0968a', { matrix: m });
      portals.box(dir < 0 ? [x0 - 0.05, x0] : [x1, x1 + 0.05], [bore.crown + 0.4, bore.crown + 1.3], [-bore.c - 1.6, -bore.c + 1.6], '#2d2a26', { matrix: m });
    }
  }
  return {
    tube: tubes.length ? mergeGeometries(tubes) : null,
    floor: floors.length ? mergeGeometries(floors) : null,
    portals: ROUTE.tunnels.length ? portals.build() : null,
  };
}

/**
 * One through-truss span of the given length (Warren truss with verticals),
 * built at its real size so the diagonals keep their proportions.
 */
function buildTruss(lo, hi, length, height = 7.2) {
  const b = new ModelBuilder();
  const steel = '#6f7f86';
  const zs = [-(hi + 0.35), -(lo - 0.35)];
  const panels = Math.max(4, Math.round(length / 8));
  const dx = length / panels;
  const x0 = -length / 2;
  for (const z of zs) {
    b.box([x0, -x0], [-0.25, 0.35], [z - 0.28, z + 0.28], steel); // bottom chord
    b.box([x0 + dx, -x0 - dx], [height - 0.3, height + 0.25], [z - 0.3, z + 0.3], steel); // top chord
    for (let k = 1; k < panels; k++) {
      const x = x0 + k * dx;
      b.box([x - 0.12, x + 0.12], [0, height], [z - 0.2, z + 0.2], steel); // verticals
    }
    for (let k = 0; k < panels; k++) {
      // diagonals alternate direction (Warren); the end panels are the sloping end posts
      const xa = x0 + k * dx;
      const up = k % 2 === 0;
      const len = Math.hypot(dx, height);
      const ang = Math.atan2(height, dx) * (up ? 1 : -1);
      b.add(new THREE.BoxGeometry(len, 0.32, 0.36), { color: steel, position: [xa + dx / 2, height / 2, z], rotation: [0, 0, ang] });
    }
  }
  // overhead portal bracing between the two trusses
  for (let k = 1; k < panels; k++) {
    const x = x0 + k * dx;
    b.box([x - 0.1, x + 0.1], [height - 0.15, height + 0.15], [zs[0], zs[1]], steel);
  }
  return b.build().body;
}

function buildBridges() {
  const T = terrain;
  const [lo, hi] = deckLats(ROUTE.double);
  const decks = [];
  const piers = { concrete: [], stone: [] };
  const trusses = new Map(); // span length → instances
  const addTruss = (len, item) => {
    const key = Math.round(len * 10) / 10;
    if (!trusses.has(key)) trusses.set(key, []);
    trusses.get(key).push(item);
  };
  const extra = new ModelBuilder();
  const p = {};
  for (const b of ROUTE.bridges) {
    if (b.track !== false) {
      const D = DECK_DEPTH[b.type] ?? 2.4;
      decks.push(
        buildRibbonGeometry(
          mainLine,
          [
            [hi + 0.6, 0.02],
            [hi + 0.6, -D],
            [lo - 0.6, -D],
            [lo - 0.6, 0.02],
            [hi + 0.6, 0.02],
          ],
          { from: b.from - 2, to: b.to + 2, step: 4 },
        ),
      );
      // parapets / railings
      for (const e of [hi + 0.6, lo - 0.6]) {
        const inward = e > 0 ? -0.18 : 0.18;
        decks.push(buildRibbonGeometry(mainLine, [[e, 0], [e, 1.05], [e + inward, 1.05], [e + inward, 0]], { from: b.from - 2, to: b.to + 2, step: 4 }));
      }
      // piers: down to the ground, river bed or sea bed
      const n = Math.max(1, Math.round((b.to - b.from) / b.span));
      for (let k = 0; k <= n; k++) {
        const s = b.from + ((b.to - b.from) * k) / n;
        mainLine.sample(s, p);
        const mid = (lo + hi) / 2;
        const ground = k === 0 || k === n ? p.y - D - 1 : Math.min(T.naturalAt(T.row(s), mid), p.y - D) - 3;
        const top = p.y - D;
        const h = Math.max(0.5, top - ground);
        const width = hi - lo + (b.type === 'viaduct' ? 0.4 : -0.6);
        const thick = b.type === 'viaduct' ? 3.2 : b.type === 'sea' ? 1.6 : 2.6;
        piers.concrete.push({ x: p.x + p.lx * mid, y: ground + h / 2, z: p.z + p.lz * mid, yaw: -p.heading, sx: thick, sy: h, sz: width });
        if (b.type === 'viaduct' && h > 25) {
          // tall viaduct piers flare out at the bottom
          piers.concrete.push({ x: p.x + p.lx * mid, y: ground + 6, z: p.z + p.lz * mid, yaw: -p.heading, sx: thick + 1.6, sy: 12, sz: width + 2.2 });
        }
        if (k < n && b.type === 'truss') {
          const sm = b.from + ((b.to - b.from) * (k + 0.5)) / n;
          mainLine.sample(sm, p);
          addTruss((b.to - b.from) / n - 1, { x: p.x, y: p.y, z: p.z, yaw: -p.heading });
        }
      }
      // Pamban: vertical-lift navigation span — a truss between two tall towers
      if (b.liftSpan) {
        const { at, length } = b.liftSpan;
        mainLine.sample(at, p);
        addTruss(length - 1, { x: p.x, y: p.y, z: p.z, yaw: -p.heading, sy: 1.25 });
        for (const s of [at - length / 2, at + length / 2]) {
          mainLine.sample(s, p);
          const m = new THREE.Matrix4().makeRotationY(-p.heading).setPosition(p.x, p.y, p.z);
          for (const lat of [hi + 2.2, lo - 2.2]) extra.box([-2.2, 2.2], [-D - 4, 34], [-lat - 1.6, -lat + 1.6], '#c9c4b8', { matrix: m });
          extra.box([-2.4, 2.4], [32, 35.5], [-(hi + 3.8), -(lo - 3.8)], '#b7b1a3', { matrix: m });
          extra.box([-0.6, 0.6], [10, 32], [-(hi + 2.4), -(hi + 2.0)], '#3a3f44', { matrix: m }); // counterweight ropes
        }
      }
    } else {
      // structures alongside: the old bridge and the road bridge
      const lat = b.lat ?? 30;
      const width = b.type === 'road' ? 12 : 4.6;
      const bump = (s) => {
        if (!b.arch) return 0;
        const m = (b.from + b.to) / 2;
        const half = (b.to - b.from) * 0.22;
        const x = Math.min(1, Math.abs(s - m) / half);
        return b.arch * (1 - x * x);
      };
      const line = heightLine((s) => b.deckY + bump(s), lat);
      const ranges = [[b.from, b.to]];
      for (const [a, z] of ranges) {
        decks.push(
          buildRibbonGeometry(
            line,
            [
              [width / 2, 0],
              [width / 2, -1.4],
              [-width / 2, -1.4],
              [-width / 2, 0],
              [width / 2, 0],
            ],
            { from: a, to: z, step: 5 },
          ),
        );
        if (b.type === 'road') {
          for (const e of [width / 2, -width / 2]) decks.push(buildRibbonGeometry(line, [[e, 0], [e, 1.1], [e * 0.97, 1.1], [e * 0.97, 0]], { from: a, to: z, step: 5 }));
        }
      }
      const n = Math.round((b.to - b.from) / b.span);
      for (let k = 0; k <= n; k++) {
        const s = b.from + ((b.to - b.from) * k) / n;
        if (b.scherzerAt && Math.abs(s - b.scherzerAt) < 30) continue;
        line.sample(s, p);
        const ground = T.naturalAt(T.row(s), lat) - 2;
        const top = p.y - 1.4;
        const h = Math.max(0.5, top - ground);
        (b.type === 'old' ? piers.stone : piers.concrete).push({ x: p.x, y: ground + h / 2, z: p.z, yaw: -p.heading, sx: b.type === 'road' ? 2.6 : 1.8, sy: h, sz: width - 0.6 });
      }
      // the old bridge's Scherzer rolling-lift span (lowered): a riveted steel girder frame
      if (b.scherzerAt) {
        const len = 68;
        line.sample(b.scherzerAt, p);
        const m = new THREE.Matrix4().makeRotationY(-p.heading).setPosition(p.x, p.y, p.z);
        for (const z of [-width / 2 - 0.2, width / 2 + 0.2]) {
          extra.box([-len / 2, len / 2], [-0.2, 0.4], [z - 0.25, z + 0.25], '#6e4a36', { matrix: m });
          extra.box([-len / 2 + 6, len / 2 - 6], [4.6, 5.1], [z - 0.25, z + 0.25], '#6e4a36', { matrix: m });
          for (let k = 0; k <= 8; k++) {
            const x = -len / 2 + 6 + ((len - 12) * k) / 8;
            extra.box([x - 0.2, x + 0.2], [0, 5], [z - 0.2, z + 0.2], '#6e4a36', { matrix: m });
          }
          for (const sgn of [-1, 1]) extra.add(new THREE.BoxGeometry(8.2, 0.4, 0.4), { color: '#6e4a36', position: [sgn * (len / 2 - 3), 2.5, z], rotation: [0, 0, sgn * -0.66], matrix: m });
        }
        for (const x of [-len / 2, len / 2]) extra.box([x - 3, x + 3], [-7, -1.4], [-width / 2 - 0.6, width / 2 + 0.6], '#8a7f70', { matrix: m });
      }
    }
  }
  const truss = [...trusses].map(([len, items]) => ({ geometry: buildTruss(lo, hi, len), items }));
  return { deck: decks.length ? mergeGeometries(decks) : null, piers, truss, extra: extra.groups.size ? extra.build() : null };
}

export default function Structures() {
  const quality = useQuality();
  const tunnels = useMemo(buildTunnels, []);
  const bridges = useMemo(buildBridges, []);
  const mats = useMemo(
    () => ({
      tube: new THREE.MeshStandardMaterial({ color: '#4a463f', roughness: 1, side: THREE.DoubleSide, envMapIntensity: 0 }),
      floor: new THREE.MeshStandardMaterial({ color: '#2f2c28', roughness: 1, envMapIntensity: 0 }),
      stone: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      concrete: new THREE.MeshStandardMaterial({ color: '#b9b4aa', roughness: 0.9, side: THREE.DoubleSide }),
      oldStone: new THREE.MeshStandardMaterial({ color: '#8f8577', roughness: 1 }),
      steel: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.45 }),
      unitBox: new THREE.BoxGeometry(1, 1, 1),
    }),
    [],
  );
  useEffect(
    () => () => {
      [tunnels.tube, tunnels.floor, bridges.deck, mats.unitBox, ...bridges.truss.map((t) => t.geometry)].forEach((g) => g?.dispose());
      for (const set of [tunnels.portals, bridges.extra]) if (set) Object.values(set).forEach((g) => g.dispose());
      for (const m of Object.values(mats)) m.dispose?.();
    },
    [tunnels, bridges, mats],
  );

  const far = quality.sceneryDistance + 600;
  return (
    <group>
      {tunnels.tube && <mesh geometry={tunnels.tube} material={mats.tube} />}
      {tunnels.floor && <mesh geometry={tunnels.floor} material={mats.floor} />}
      {tunnels.portals && Object.entries(tunnels.portals).map(([k, g]) => <mesh key={k} geometry={g} material={mats.stone} receiveShadow />)}
      {bridges.deck && <mesh geometry={bridges.deck} material={mats.concrete} receiveShadow castShadow />}
      {bridges.extra && Object.entries(bridges.extra).map(([k, g]) => <mesh key={k} geometry={g} material={mats.stone} castShadow />)}
      {bridges.piers.concrete.length > 0 && <ChunkedInstances items={bridges.piers.concrete} geometry={mats.unitBox} material={mats.concrete} cellSize={400} maxDistance={far} />}
      {bridges.piers.stone.length > 0 && <ChunkedInstances items={bridges.piers.stone} geometry={mats.unitBox} material={mats.oldStone} cellSize={400} maxDistance={far} />}
      {bridges.truss.map((t) => (
        <ChunkedInstances key={t.geometry.uuid} items={t.items} geometry={t.geometry} material={mats.steel} cellSize={400} maxDistance={far} castShadow />
      ))}
    </group>
  );
}


// Lineside speed boards, as on Indian Railways (GR 15.09; IRFCA signalling
// FAQ): a yellow triangle with the speed in km/h 30 m before a lower speed
// restriction, and a yellow disc with "T" (termination) where normal speed
// resumes. One instanced mesh per board face + one for all posts.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { SPEED_LIMITS } from '../../config/gameConfig.js';
import { useQuality } from '../../state/gameStore.js';
import { mainLine } from '../../world/trackLayout.js';
import ChunkedInstances from '../../world/ChunkedInstances.jsx';
import { tunnelAt, bridgeAt } from '../../routes/activeRoute.js';

const LAT = 4.6; // left of the line, outside the OHE masts
const BOARD_Y = 2.6;

function boardTexture(kind, label) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f2c230';
  g.strokeStyle = '#111';
  g.lineWidth = 12;
  g.beginPath();
  if (kind === 'speed') {
    g.moveTo(128, 18);
    g.lineTo(242, 230);
    g.lineTo(14, 230);
    g.closePath();
  } else g.arc(128, 128, 112, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.fillStyle = '#111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `bold ${kind === 'speed' ? (label.length > 2 ? 64 : 84) : 130}px Helvetica, Arial, sans-serif`;
  g.fillText(label, 128, kind === 'speed' ? 160 : 136);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function SpeedBoards() {
  const quality = useQuality();
  const boards = useMemo(() => {
    const out = [];
    const lim = [...SPEED_LIMITS].sort((a, b) => a.from - b.from);
    for (let i = 1; i < lim.length; i++) {
      const before = lim[i - 1];
      const l = lim[i];
      if (l.kmh < before.kmh) out.push({ s: l.from - 30, kind: 'speed', label: String(l.kmh) });
      else if (l.kmh > before.kmh) out.push({ s: before.to, kind: 'end', label: 'T' });
    }
    const p = {};
    return out
      .filter((b) => b.s > 20 && !tunnelAt(b.s, 10) && !bridgeAt(b.s, 10))
      .map((b) => {
        mainLine.sample(b.s, p);
        return { ...b, x: p.x + p.lx * LAT, y: p.y, z: p.z + p.lz * LAT, yaw: -p.heading + Math.PI / 2 + Math.PI };
      });
  }, []);
  const res = useMemo(() => {
    const groups = new Map();
    for (const b of boards) {
      const key = `${b.kind}:${b.label}`;
      if (!groups.has(key)) groups.set(key, { tex: boardTexture(b.kind, b.label), items: [] });
      groups.get(key).items.push({ x: b.x, y: b.y + BOARD_Y, z: b.z, yaw: b.yaw });
    }
    const plane = new THREE.PlaneGeometry(1.1, 1.1);
    const mats = [...groups.values()].map((g) => new THREE.MeshStandardMaterial({ map: g.tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }));
    const post = new THREE.CylinderGeometry(0.05, 0.05, BOARD_Y, 6);
    post.translate(0, BOARD_Y / 2, 0);
    const postMat = new THREE.MeshStandardMaterial({ color: '#2f3336' });
    return { groups: [...groups.values()], plane, mats, post, postMat };
  }, [boards]);
  useEffect(
    () => () => {
      res.groups.forEach((g) => g.tex.dispose());
      res.mats.forEach((m) => m.dispose());
      res.plane.dispose();
      res.post.dispose();
      res.postMat.dispose();
    },
    [res],
  );
  const far = quality.detailDistance + 300;
  if (!boards.length) return null;
  return (
    <group>
      <ChunkedInstances items={boards.map((b) => ({ x: b.x, y: b.y, z: b.z }))} geometry={res.post} material={res.postMat} cellSize={800} maxDistance={far} />
      {res.groups.map((g, i) => (
        <ChunkedInstances key={i} items={g.items} geometry={res.plane} material={res.mats[i]} cellSize={800} maxDistance={far} />
      ))}
    </group>
  );
}

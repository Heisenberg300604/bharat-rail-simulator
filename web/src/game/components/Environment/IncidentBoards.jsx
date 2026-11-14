// Lineside boards for this run's caution order (B5, GR 15.09(1)(d)):
//   • caution indicator — arrow-shaped reflective yellow board with black
//     markings, pointing at the track it applies to, on a post banded black
//     and white (IRFCA signalling FAQ pt 5); at least 800 m before the work
//   • speed indicator — 30 m before the work, the speed in km/h
//   • termination indicators T/P and T/G — yellow discs beyond the end, by the
//     length of the longest passenger / goods train
// Rebuilt whenever a new run plans its incidents (at most four boards:
// 2 draw calls per board while in view, none when there is no caution order).
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { game, useGameValue } from '../../state/gameStore.js';
import { mainLine } from '../../world/trackLayout.js';

const LAT = 4.6; // left of the line, outside the OHE masts (as SpeedBoards)
const BOARD_Y = 2.6;

function drawBoard(kind, label) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.lineWidth = 10;
  g.strokeStyle = '#111';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  if (kind === 'caution') {
    // arrow pointing right — towards our track, which is to the board's right as the driver sees it
    g.fillStyle = '#f2c230';
    g.beginPath();
    g.moveTo(14, 70);
    g.lineTo(170, 70);
    g.lineTo(170, 26);
    g.lineTo(244, 128);
    g.lineTo(170, 230);
    g.lineTo(170, 186);
    g.lineTo(14, 186);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = '#111';
    g.fillRect(30, 112, 150, 32);
  } else if (kind === 'tsrSpeed') {
    g.fillStyle = '#f7f7f2';
    g.fillRect(30, 10, 196, 236);
    g.fillStyle = '#111';
    for (let i = 0; i < 4; i++) {
      g.fillRect(30 + i * 49, 10, 25, 36);
      g.fillRect(30 + i * 49 + 24, 210, 25, 36);
    }
    g.strokeRect(30, 10, 196, 236);
    g.font = 'bold 104px Helvetica, Arial, sans-serif';
    g.fillText(label, 128, 132);
  } else {
    g.fillStyle = '#f2c230';
    g.beginPath();
    g.arc(128, 128, 112, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.fillStyle = '#111';
    g.font = 'bold 84px Helvetica, Arial, sans-serif';
    g.fillText(label, 128, 134);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function bandedPostTexture() {
  const c = document.createElement('canvas');
  c.width = 8;
  c.height = 64;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#111' : '#f4f4f0';
    g.fillRect(0, i * 8, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export default function IncidentBoards() {
  const version = useGameValue((s) => s.incidentsVersion);
  const res = useMemo(() => {
    const boards = game.incidents?.boards ?? [];
    if (!boards.length) return null;
    const plane = new THREE.PlaneGeometry(1.1, 1.1);
    const post = new THREE.CylinderGeometry(0.05, 0.05, BOARD_Y, 6);
    post.translate(0, BOARD_Y / 2, 0);
    const postTex = bandedPostTexture();
    const bandedMat = new THREE.MeshStandardMaterial({ map: postTex });
    const greyMat = new THREE.MeshStandardMaterial({ color: '#2f3336' });
    const p = {};
    const items = boards.map((b) => {
      mainLine.sample(b.s, p);
      const tex = drawBoard(b.kind, b.label);
      return {
        key: `${b.kind}${b.s}`,
        pos: [p.x + p.lx * LAT, p.y, p.z + p.lz * LAT],
        yaw: -p.heading + Math.PI / 2 + Math.PI,
        tex,
        mat: new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide }),
        postMat: b.kind === 'caution' ? bandedMat : greyMat,
      };
    });
    return { plane, post, postTex, bandedMat, greyMat, items };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version]);
  useEffect(
    () => () => {
      if (!res) return;
      res.items.forEach((i) => {
        i.tex.dispose();
        i.mat.dispose();
      });
      res.plane.dispose();
      res.post.dispose();
      res.postTex.dispose();
      res.bandedMat.dispose();
      res.greyMat.dispose();
    },
    [res],
  );
  if (!res) return null;
  return (
    <group>
      {res.items.map((i) => (
        <group key={i.key} position={i.pos} rotation={[0, i.yaw, 0]}>
          <mesh geometry={res.post} material={i.postMat} />
          <mesh geometry={res.plane} material={i.mat} position={[0, BOARD_Y, 0.06]} />
        </group>
      ))}
    </group>
  );
}

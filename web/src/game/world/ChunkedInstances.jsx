// Draw many copies of one object efficiently.
//
// 1. Instancing: all copies inside a chunk are ONE draw call.
// 2. Chunking: items are grouped into square cells (e.g. 300 m). Three.js
//    skips cells outside the camera's view (frustum culling), and we also hide
//    cells farther away than `maxDistance` — fog hides them anyway.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);

export default function ChunkedInstances({ items, geometry, material, cellSize = 300, maxDistance = 1500, castShadow = false, receiveShadow = false }) {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const cells = new Map();
    for (const it of items) {
      const key = `${Math.floor(it.x / cellSize)},${Math.floor(it.z / cellSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(it);
    }
    const hasColor = items.some((it) => it.color !== undefined);
    for (const list of cells.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, list.length);
      list.forEach((it, i) => {
        _p.set(it.x, it.y ?? 0, it.z);
        _q.setFromAxisAngle(UP, it.yaw ?? 0);
        _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
        mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
        if (hasColor) mesh.setColorAt(i, _c.set(it.color ?? '#ffffff'));
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      mesh.castShadow = castShadow;
      mesh.receiveShadow = receiveShadow;
      mesh.matrixAutoUpdate = false; // static: never moves
      g.add(mesh);
    }
    return g;
  }, [items, geometry, material, cellSize, castShadow, receiveShadow]);

  useEffect(
    () => () => {
      for (const m of group.children) m.dispose(); // frees instance buffers; geometry/material are shared
    },
    [group],
  );

  const maxDist = useRef(maxDistance);
  maxDist.current = maxDistance;
  const frame = useRef(0);
  const lastCheck = useRef(new THREE.Vector3(1e9, 0, 0));
  useFrame(({ camera }) => {
    // 6×/s is plenty for distance culling — but re-check at once after a jump
    // (camera switch, restart, route change) so nothing pops in late
    const jumped = lastCheck.current.distanceToSquared(camera.position) > 150 * 150;
    if (frame.current++ % 10 !== 0 && !jumped) return;
    lastCheck.current.copy(camera.position);
    for (const m of group.children) {
      const sphere = m.boundingSphere;
      m.visible = sphere.center.distanceTo(camera.position) - sphere.radius < maxDist.current;
    }
  });

  return <primitive object={group} />;
}

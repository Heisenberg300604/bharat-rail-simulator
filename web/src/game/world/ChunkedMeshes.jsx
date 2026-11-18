// Draw pre-merged scenery patches (one Kit per 600 m cell, see kit.js): ONE
// draw call per visible cell, frustum-culled by Three.js and hidden beyond
// `maxDistance` (fog hides them anyway). Same culling cadence as
// ChunkedInstances.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export default function ChunkedMeshes({ kits, material, maxDistance = 1500 }) {
  const group = useMemo(() => {
    const g = new THREE.Group();
    for (const kit of kits.values()) {
      const geo = kit.build();
      if (!geo) continue;
      const mesh = new THREE.Mesh(geo, material);
      mesh.matrixAutoUpdate = false; // static
      g.add(mesh);
    }
    return g;
  }, [kits, material]);

  useEffect(
    () => () => {
      for (const m of group.children) m.geometry.dispose();
    },
    [group],
  );

  const maxDist = useRef(maxDistance);
  maxDist.current = maxDistance;
  const frame = useRef(0);
  const lastCheck = useRef(new THREE.Vector3(1e9, 0, 0));
  useFrame(({ camera }) => {
    const jumped = lastCheck.current.distanceToSquared(camera.position) > 150 * 150;
    if (frame.current++ % 10 !== 0 && !jumped) return;
    lastCheck.current.copy(camera.position);
    for (const m of group.children) {
      const sphere = m.geometry.boundingSphere;
      m.visible = sphere.center.distanceTo(camera.position) - sphere.radius < maxDist.current;
    }
  });

  return <primitive object={group} />;
}

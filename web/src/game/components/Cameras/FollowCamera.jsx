// Exterior chase camera: elevated, behind and slightly to the side of the
// locomotive, looking ahead along the line. Position is smoothed with
// exponential damping so it glides instead of jittering.
// With `orbit`, it slowly circles the train instead (title-screen backdrop).
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { sceneRefs } from '../../state/sceneRefs.js';
import { FRAME_PRIORITY_CAMERA, damp } from './cameraConstants.js';

const CHASE_OFFSET = new THREE.Vector3(-34, 13, -9); // loco-local: behind, up, left
const CHASE_LOOK = new THREE.Vector3(40, 2, 0);

export default function FollowCamera({ orbit = false }) {
  const camera = useThree((s) => s.camera);
  const tmp = useMemo(() => ({ goal: new THREE.Vector3(), look: new THREE.Vector3(), lookSmoothed: new THREE.Vector3() }), []);
  const initialised = useRef(false);

  useFrame((state, delta) => {
    const loco = sceneRefs.locomotive;
    if (!loco) return;
    if (orbit) {
      const t = state.clock.elapsedTime * 0.06;
      tmp.goal.set(-40 + Math.cos(t) * 38, 9 + Math.sin(t * 0.7) * 3, Math.sin(t) * 26);
      tmp.look.set(-30, 2.5, 0);
    } else {
      tmp.goal.copy(CHASE_OFFSET);
      tmp.look.copy(CHASE_LOOK);
    }
    loco.localToWorld(tmp.goal);
    loco.localToWorld(tmp.look);

    if (!initialised.current) {
      camera.position.copy(tmp.goal);
      tmp.lookSmoothed.copy(tmp.look);
      initialised.current = true;
    } else {
      const k = damp(orbit ? 2 : 5, Math.min(delta, 0.1));
      camera.position.lerp(tmp.goal, k);
      tmp.lookSmoothed.lerp(tmp.look, k);
    }
    camera.lookAt(tmp.lookSmoothed);
    if (camera.fov !== 50) {
      camera.fov = 50;
      camera.updateProjectionMatrix();
    }
  }, FRAME_PRIORITY_CAMERA);

  return null;
}

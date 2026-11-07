// Driver's-eye view: the camera is rigidly attached to the locomotive at the
// driver's seat, with a very small speed-based sway for a sense of motion.
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import * as THREE from 'three';
import { game } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { CAB_EYE, CAB_LOOK_PITCH_DEG } from '../Train/CabInterior.jsx';
import { FRAME_PRIORITY_CAMERA } from './cameraConstants.js';

export default function CabCamera() {
  const camera = useThree((s) => s.camera);
  const tmp = useMemo(() => ({ eye: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useFrame((state) => {
    const loco = sceneRefs.locomotive;
    if (!loco) return;
    const v = game.train.speedMps;
    const t = state.clock.elapsedTime;
    const sway = Math.min(v / 25, 1);
    const [ex, ey, ez] = CAB_EYE;
    tmp.eye.set(ex, ey + Math.sin(t * 9.1) * 0.006 * sway, ez + Math.sin(t * 1.7) * 0.012 * sway);
    const ahead = 100;
    tmp.look.set(ex + ahead, ey + ahead * Math.tan((CAB_LOOK_PITCH_DEG * Math.PI) / 180), ez);
    loco.localToWorld(tmp.eye);
    loco.localToWorld(tmp.look);
    camera.position.copy(tmp.eye);
    camera.lookAt(tmp.look);
    if (camera.fov !== 62) {
      camera.fov = 62;
      camera.updateProjectionMatrix();
    }
  }, FRAME_PRIORITY_CAMERA);

  return null;
}

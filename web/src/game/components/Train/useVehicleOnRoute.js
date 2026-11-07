// Places a vehicle on the track every frame and spins its wheels.
// The vehicle's centre sits `centerOffset` metres behind the locomotive front,
// so every coach automatically follows the exact same rails.
import { useFrame } from '@react-three/fiber';
import { game, route } from '../../state/gameStore.js';
import { vehiclePose } from '../../simulation/routeMath.js';
import { TRACK } from '../../config/gameConfig.js';

export const FRAME_PRIORITY_TRAIN = -2; // after the simulation (-3), before cameras (-1)

export function useVehicleOnRoute(groupRef, axlesRef, { centerOffset, bogieSpacing, wheelRadius }) {
  const pose = {};
  useFrame(() => {
    const g = groupRef.current;
    if (!g) return;
    vehiclePose(route, game.renderDistance - centerOffset, bogieSpacing, pose);
    g.position.set(pose.x, TRACK.railTop, pose.z);
    g.rotation.y = pose.yaw;
    g.updateMatrixWorld(); // cameras read this matrix in the same frame

    // Wheels: rolled distance / radius = rotation angle (radians)
    const angle = -game.renderDistance / wheelRadius;
    for (const axle of axlesRef.current) if (axle) axle.rotation.z = angle;
  }, FRAME_PRIORITY_TRAIN);
}

// Cameras run after the train has been positioned this frame (-2).
export const FRAME_PRIORITY_CAMERA = -1;

/** Frame-rate independent smoothing factor ("exponential damping"). */
export function damp(lambda, dt) {
  return 1 - Math.exp(-lambda * dt);
}

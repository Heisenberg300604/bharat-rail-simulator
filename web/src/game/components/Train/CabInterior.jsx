// Simplified driver's cab, shown only in cab view (the exterior body is hidden
// then, so the camera never looks at the inside of the outer boxes).
// The camera position is defined here too, so cab and camera stay in sync.
import { Block } from './parts.jsx';

// Indian locos have the driver's desk on the LEFT (local -z).
export const CAB_EYE = [9.0, 3.15, -0.55];
export const CAB_LOOK_PITCH_DEG = -3;

const WALL = '#6b7781';
const TRIM = '#3f484f';
const DESK = '#4b555d';
const FRONT = 10.2;
const BACK = 8.55;
const W = 1.5; // half width inside
const SILL = 2.72; // bottom of the windscreen
const HEADER = 3.9; // top of the windscreen

export default function CabInterior() {
  return (
    <group>
      {/* driver's console: low desk under the windscreen */}
      <Block x={[9.55, FRONT]} y={[1.9, 2.5]} z={[-W, W]} color={DESK} />
      <Block x={[9.85, FRONT]} y={[2.5, 2.62]} z={[-1.3, 0.2]} color="#30373d" />
      {/* small gauges along the top of the desk */}
      {[-1.05, -0.8, -0.55, -0.3].map((z) => (
        <mesh key={z} position={[9.98, 2.68, z]} rotation={[0, 0, Math.PI / 2 - 0.35]}>
          <cylinderGeometry args={[0.045, 0.045, 0.015, 20]} />
          <meshStandardMaterial color="#f1ecdf" emissive="#3a3a30" />
        </mesh>
      ))}
      {/* front wall + windscreen frame */}
      <Block x={[FRONT, FRONT + 0.06]} y={[1.2, SILL]} z={[-W, W]} color={WALL} />
      <Block x={[FRONT - 0.03, FRONT + 0.06]} y={[HEADER, 4.15]} z={[-W, W]} color={WALL} />
      <Block x={[FRONT - 0.03, FRONT + 0.06]} y={[SILL, HEADER]} z={[-0.04, 0.04]} color={TRIM} />
      {[-1, 1].map((s) => (
        <Block key={s} x={[FRONT - 0.03, FRONT + 0.06]} y={[SILL, HEADER]} z={s > 0 ? [W - 0.1, W] : [-W, -W + 0.1]} color={TRIM} />
      ))}
      {/* sun visor above the driver */}
      <Block x={[FRONT - 0.22, FRONT - 0.03]} y={[HEADER - 0.04, HEADER]} z={[-1.3, -0.1]} color="#2a2f34" />
      {/* side walls with windows */}
      {[-1, 1].map((s) => {
        const z = s > 0 ? [W, W + 0.05] : [-W - 0.05, -W];
        return (
          <group key={s}>
            <Block x={[BACK, FRONT]} y={[1.2, SILL]} z={z} color={WALL} />
            <Block x={[BACK, FRONT]} y={[HEADER, 4.15]} z={z} color={WALL} />
            <Block x={[BACK, 9.15]} y={[SILL, HEADER]} z={z} color={WALL} />
          </group>
        );
      })}
      {/* ceiling, back wall, floor */}
      <Block x={[BACK, FRONT + 0.06]} y={[4.15, 4.22]} z={[-W - 0.05, W + 0.05]} color="#848d94" />
      <Block x={[BACK - 0.06, BACK]} y={[1.2, 4.2]} z={[-W, W]} color={WALL} />
      <Block x={[BACK, FRONT]} y={[1.15, 1.2]} z={[-W, W]} color="#2b2b2b" />
    </group>
  );
}

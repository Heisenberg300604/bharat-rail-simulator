// Small reusable building blocks for the placeholder train models.
// Vehicle local frame: x = forward, y = up (0 = rail top), z = right.
import { TRACK } from '../../config/gameConfig.js';

/** Box positioned by its min/max extents — easier to reason about than centres. */
export function Block({ x = [0, 1], y = [0, 1], z = [0, 1], color, material, castShadow = false, ...rest }) {
  return (
    <mesh
      position={[(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2]}
      castShadow={castShadow}
      {...rest}
    >
      <boxGeometry args={[x[1] - x[0], y[1] - y[0], z[1] - z[0]]} />
      {material ?? <meshStandardMaterial color={color} roughness={0.7} />}
    </mesh>
  );
}

/** Thin bar between two points in the x/y plane (used for the pantograph). */
export function Strut({ from, to, z = 0, thickness = 0.06, color = '#333' }) {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy);
  return (
    <mesh position={[(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, z]} rotation={[0, 0, Math.atan2(dy, dx)]}>
      <boxGeometry args={[len, thickness, thickness]} />
      <meshStandardMaterial color={color} metalness={0.5} roughness={0.5} />
    </mesh>
  );
}

const WHEEL_WIDTH = 0.14;

/**
 * One axle with two wheels. The outer group is what spins (rotation.z);
 * registerAxle stores it so the frame loop can rotate it.
 */
export function Axle({ x, radius, registerAxle }) {
  const half = TRACK.gauge / 2;
  return (
    <group position={[x, radius, 0]} ref={registerAxle}>
      {[-half, half].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[radius, radius, WHEEL_WIDTH, 18]} />
            <meshStandardMaterial color="#3a3836" metalness={0.6} roughness={0.5} />
          </mesh>
          {/* bright mark on the wheel face so you can see it turning */}
          <mesh position={[0, radius * 0.55, z > 0 ? 0.075 : -0.075]}>
            <boxGeometry args={[0.08, radius * 0.7, 0.01]} />
            <meshStandardMaterial color="#b9b4aa" />
          </mesh>
        </group>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, TRACK.gauge, 8]} />
        <meshStandardMaterial color="#2a2826" />
      </mesh>
    </group>
  );
}

/** Bogie (wheel truck): a frame plus 2 or 3 axles. */
export function Bogie({ x, axleOffsets, wheelRadius, registerAxle, frameColor = '#2d2f31' }) {
  const spread = Math.max(...axleOffsets) - Math.min(...axleOffsets) + wheelRadius * 2 + 0.3;
  return (
    <group position={[x, 0, 0]}>
      <Block x={[-spread / 2, spread / 2]} y={[wheelRadius * 0.8, wheelRadius * 0.8 + 0.45]} z={[-1.25, 1.25]} color={frameColor} />
      {axleOffsets.map((ax) => (
        <Axle key={ax} x={ax} radius={wheelRadius} registerAxle={registerAxle} />
      ))}
    </group>
  );
}

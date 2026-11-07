// Placeholder LHB-style passenger coach (red body, cream window band, grey
// roof). Swappable for a GLB later; the movement code stays the same.
import { useCallback, useMemo, useRef } from 'react';
import { Block, Bogie } from './parts.jsx';
import { useVehicleOnRoute } from './useVehicleOnRoute.js';
import { makeWindowStripTexture } from '../../world/textures.js';

const BODY = '#9e1b24';
const HALF_W = 1.62;

let windowTexture = null; // shared by all coaches
function getWindowTexture(halfLen) {
  if (!windowTexture) {
    windowTexture = makeWindowStripTexture();
    windowTexture.repeat.set(Math.round((halfLen * 2 - 4) / 1.9), 1);
  }
  return windowTexture;
}

export default function Coach({ vehicle }) {
  const groupRef = useRef();
  const axles = useRef([]);
  const registerAxle = useCallback((el) => {
    if (el && !axles.current.includes(el)) axles.current.push(el);
  }, []);
  useVehicleOnRoute(groupRef, axles, vehicle);

  const L = vehicle.length / 2;
  const windowTex = useMemo(() => getWindowTexture(L), [L]);

  return (
    <group ref={groupRef}>
      {/* main body shell */}
      <Block x={[-L, L]} y={[1.15, 3.95]} z={[-HALF_W, HALF_W]} color={BODY} castShadow />
      {/* window band on both sides */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[0, 2.85, side * (HALF_W + 0.006)]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
          <planeGeometry args={[vehicle.length - 4, 0.95]} />
          <meshStandardMaterial map={windowTex} roughness={0.5} />
        </mesh>
      ))}
      {/* doors near each end */}
      {[-1, 1].map((end) =>
        [-1, 1].map((side) => (
          <Block
            key={`${end}${side}`}
            x={end > 0 ? [L - 1.75, L - 0.85] : [-L + 0.85, -L + 1.75]}
            y={[1.3, 3.55]}
            z={side > 0 ? [HALF_W, HALF_W + 0.02] : [-HALF_W - 0.02, -HALF_W]}
            color="#5c1016"
          />
        )),
      )}
      {/* pale stripe under the windows */}
      <Block x={[-L, L]} y={[2.18, 2.3]} z={[-HALF_W - 0.01, HALF_W + 0.01]} color="#e8dcc0" />
      {/* roof */}
      <Block x={[-L, L]} y={[3.95, 4.2]} z={[-1.4, 1.4]} color="#7d8085" castShadow />
      <Block x={[-L + 1, L - 1]} y={[4.2, 4.3]} z={[-0.9, 0.9]} color="#6c6f74" />
      {/* gangway bellows */}
      {[-1, 1].map((end) => (
        <Block key={end} x={end > 0 ? [L, L + 0.5] : [-L - 0.5, -L]} y={[1.4, 3.7]} z={[-0.6, 0.6]} color="#1d1d1d" />
      ))}
      {/* underframe equipment */}
      <Block x={[-L + 1, L - 1]} y={[0.95, 1.15]} z={[-1.3, 1.3]} color="#26282a" />
      <Block x={[-4, 4]} y={[0.6, 0.95]} z={[-1.0, 1.0]} color="#303336" />
      {[-vehicle.bogieSpacing / 2, vehicle.bogieSpacing / 2].map((bx) => (
        <Bogie key={bx} x={bx} axleOffsets={[-1.28, 1.28]} wheelRadius={vehicle.wheelRadius} registerAxle={registerAxle} />
      ))}
    </group>
  );
}

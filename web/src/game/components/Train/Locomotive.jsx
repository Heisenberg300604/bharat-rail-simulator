// Placeholder Indian electric locomotive, loosely inspired by the WAP-7
// (dual-cab, Co-Co bogies, roof pantograph, red/cream livery). Built from
// simple boxes so it can later be swapped for a GLB model without touching
// the movement code — only this file would change.
import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Block, Bogie, Strut } from './parts.jsx';
import { useVehicleOnRoute, FRAME_PRIORITY_TRAIN } from './useVehicleOnRoute.js';
import { game } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import CabInterior from './CabInterior.jsx';

const RED = '#b8261d';
const CREAM = '#efe4c8';
const ROOF = '#5d6166';
const GLASS = '#1a2630';
const HALF_LEN = 10.35;
const BODY_W = 1.55; // half width

export default function Locomotive({ vehicle }) {
  const groupRef = useRef();
  const exteriorRef = useRef();
  const cabRef = useRef();
  const lightRef = useRef();
  const lampMatRef = useRef();
  const axles = useRef([]);
  const registerAxle = useCallback((el) => {
    if (el && !axles.current.includes(el)) axles.current.push(el);
  }, []);

  useVehicleOnRoute(groupRef, axles, vehicle);

  const lightTarget = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(80, 0, 0);
    return o;
  }, []);

  useLayoutEffect(() => {
    sceneRefs.locomotive = groupRef.current;
    lightRef.current.target = lightTarget;
    return () => {
      sceneRefs.locomotive = null;
    };
  }, [lightTarget]);

  // Per-frame visual toggles. We change intensity instead of adding/removing
  // the light: changing the NUMBER of lights forces every material to recompile.
  useFrame(() => {
    const cab = game.cameraMode === 'cab' && game.screen !== 'title' && game.screen !== 'loading';
    exteriorRef.current.visible = !cab;
    cabRef.current.visible = cab;
    lightRef.current.intensity = game.headlight ? 60 : 0;
    lampMatRef.current.emissiveIntensity = game.headlight ? 3 : 0.05;
  }, FRAME_PRIORITY_TRAIN);

  return (
    <group ref={groupRef}>
      <group ref={exteriorRef}>
        <LocoBody lampMatRef={lampMatRef} />
      </group>
      <group ref={cabRef} visible={false}>
        <CabInterior />
      </group>

      {/* Bogies stay visible in both views */}
      {[-vehicle.bogieSpacing / 2, vehicle.bogieSpacing / 2].map((bx) => (
        <Bogie key={bx} x={bx} axleOffsets={[-1.85, 0, 1.85]} wheelRadius={vehicle.wheelRadius} registerAxle={registerAxle} />
      ))}

      <spotLight ref={lightRef} position={[HALF_LEN + 0.2, 3.9, 0]} angle={0.22} penumbra={0.6} distance={260} decay={1} color="#fff6dd" />
      <primitive object={lightTarget} />
    </group>
  );
}

function CabEnd({ sign, lampMatRef }) {
  // sign = +1 front cab, -1 rear cab (mirrored)
  const x0 = sign * 8.9;
  const x1 = sign * HALF_LEN;
  const xs = [Math.min(x0, x1), Math.max(x0, x1)];
  const face = sign * (HALF_LEN + 0.01);
  return (
    <group>
      <Block x={xs} y={[1.45, 2.95]} z={[-BODY_W, BODY_W]} color={RED} castShadow />
      <Block x={xs} y={[2.95, 3.95]} z={[-BODY_W, BODY_W]} color={CREAM} castShadow />
      <Block x={xs} y={[3.95, 4.15]} z={[-BODY_W + 0.08, BODY_W - 0.08]} color={ROOF} />
      {/* windscreen panes */}
      {[-0.72, 0.72].map((z) => (
        <Block key={z} x={[face - 0.02, face + 0.02]} y={[3.0, 3.8]} z={[z - 0.65, z + 0.65]} color={GLASS} />
      ))}
      {/* yellow-black hazard stripe and marker lamps */}
      <Block x={[face - 0.02, face + 0.02]} y={[1.5, 1.75]} z={[-BODY_W, BODY_W]} color="#f2c230" />
      {[-1.1, 1.1].map((z) => (
        <Block key={z} x={[face - 0.03, face + 0.03]} y={[2.2, 2.4]} z={[z - 0.12, z + 0.12]} color={sign > 0 ? '#ffffff' : '#d01c1c'} />
      ))}
      {/* roof-front headlight (WAP-7 style), lit only on the leading cab */}
      <mesh position={[face, 4.0, 0]} rotation={[0, (sign * Math.PI) / 2, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.12, 16]} />
        {sign > 0 ? (
          <meshStandardMaterial ref={lampMatRef} color="#fffbe6" emissive="#fff3c4" emissiveIntensity={3} />
        ) : (
          <meshStandardMaterial color="#d9d6cc" />
        )}
      </mesh>
      {/* buffers and coupler */}
      {[-0.95, 0.95].map((z) => (
        <mesh key={z} position={[face + sign * 0.3, 1.1, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.6, 12]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      ))}
      <Block x={sign > 0 ? [HALF_LEN, HALF_LEN + 0.5] : [-HALF_LEN - 0.5, -HALF_LEN]} y={[0.85, 1.15]} z={[-0.2, 0.2]} color="#222" />
      {/* cowcatcher */}
      <Block x={sign > 0 ? [HALF_LEN - 0.2, HALF_LEN + 0.15] : [-HALF_LEN - 0.15, -HALF_LEN + 0.2]} y={[0.2, 0.75]} z={[-1.3, 1.3]} color="#2b2b2b" />
    </group>
  );
}

function LocoBody({ lampMatRef }) {
  return (
    <group>
      {/* underframe */}
      <Block x={[-HALF_LEN, HALF_LEN]} y={[1.15, 1.45]} z={[-1.45, 1.45]} color="#26282a" castShadow />
      {/* machine room between the two cabs */}
      <Block x={[-8.9, 8.9]} y={[1.45, 2.95]} z={[-BODY_W, BODY_W]} color={RED} castShadow />
      <Block x={[-8.9, 8.9]} y={[2.95, 3.95]} z={[-BODY_W, BODY_W]} color={CREAM} castShadow />
      <Block x={[-8.9, 8.9]} y={[2.75, 2.88]} z={[-BODY_W - 0.01, BODY_W + 0.01]} color="#f2c230" />
      {/* roof with raised hatches */}
      <Block x={[-8.9, 8.9]} y={[3.95, 4.15]} z={[-BODY_W + 0.08, BODY_W - 0.08]} color={ROOF} castShadow />
      <Block x={[-6.5, 6.5]} y={[4.15, 4.35]} z={[-1.0, 1.0]} color="#4c5055" />
      {/* side ventilation grilles */}
      {[-5.5, -2.0, 1.5, 5.0].map((x) =>
        [-1, 1].map((side) => (
          <Block key={`${x}${side}`} x={[x - 1.2, x + 1.2]} y={[3.1, 3.7]} z={side > 0 ? [BODY_W, BODY_W + 0.02] : [-BODY_W - 0.02, -BODY_W]} color="#3b3f43" />
        )),
      )}
      {/* cab side windows & doors */}
      {[-1, 1].map((end) =>
        [-1, 1].map((side) => (
          <group key={`${end}${side}`}>
            <Block x={end > 0 ? [9.2, 9.9] : [-9.9, -9.2]} y={[3.0, 3.75]} z={side > 0 ? [BODY_W, BODY_W + 0.02] : [-BODY_W - 0.02, -BODY_W]} color={GLASS} />
            <Block x={end > 0 ? [8.3, 8.85] : [-8.85, -8.3]} y={[1.6, 3.8]} z={side > 0 ? [BODY_W, BODY_W + 0.015] : [-BODY_W - 0.015, -BODY_W]} color="#8e1c15" />
          </group>
        )),
      )}
      <CabEnd sign={1} lampMatRef={lampMatRef} />
      <CabEnd sign={-1} />
      <Pantograph x={-5.6} raised />
      <Pantograph x={5.6} raised={false} />
      {/* fuel-less electric loco: transformer tank between bogies */}
      <Block x={[-3.2, 3.2]} y={[0.55, 1.15]} z={[-1.1, 1.1]} color="#303336" />
    </group>
  );
}

/** Single-arm pantograph. Raised one touches the contact wire (5.5 m above rail). */
function Pantograph({ x, raised }) {
  const base = 4.35;
  const knee = raised ? [x + 1.0, 5.0] : [x + 1.35, 4.6];
  const head = raised ? [x + 0.1, 5.47] : [x + 0.1, 4.68];
  return (
    <group>
      <Block x={[x - 0.9, x + 0.9]} y={[base, base + 0.12]} z={[-0.7, 0.7]} color="#3d4045" />
      {[-0.35, 0.35].map((z) => (
        <group key={z}>
          <Strut from={[x - 0.5, base + 0.12]} to={knee} z={z} />
          <Strut from={knee} to={head} z={z} thickness={0.045} />
        </group>
      ))}
      <Block x={[head[0] - 0.15, head[0] + 0.15]} y={[head[1], head[1] + 0.05]} z={[-0.95, 0.95]} color="#9a9a9a" />
    </group>
  );
}

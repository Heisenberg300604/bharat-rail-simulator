// The railway itself: ballast bed, sleepers, two rails and the overhead
// electrification (OHE) masts + contact wire of an electrified Indian line.
// Everything is generated once from the route, so editing ROUTE_SEGMENTS
// automatically re-lays the track.
import { useLayoutEffect, useMemo, useRef } from 'react';
import { route } from '../../state/gameStore.js';
import { TRACK, JOURNEY } from '../../config/gameConfig.js';
import { buildRibbonGeometry, fillInstances, mergeGeometries } from '../../world/geometry.js';
import { makeNoiseTexture } from '../../world/textures.js';

const OHE_SPACING = 60;
const OHE_SIDE = -3.6; // masts on the right-hand side of the line
const CONTACT_WIRE_HEIGHT = TRACK.railTop + 5.5;
const MESSENGER_HEIGHT = CONTACT_WIRE_HEIGHT + 1.2;

export default function TrackRoute() {
  const sleepersRef = useRef();
  const mastsRef = useRef();
  const armsRef = useRef();

  const { ballastGeo, railGeo, wireGeo, ballastTex } = useMemo(() => {
    const ballastProfile = [
      [2.9, 0],
      [1.8, TRACK.ballastTop],
      [-1.8, TRACK.ballastTop],
      [-2.9, 0],
    ];
    const half = TRACK.gauge / 2;
    const railTop = TRACK.railTop;
    const railBase = TRACK.sleeperTop;
    const railProfile = (c) => [
      [c + 0.04, railBase],
      [c + 0.035, railTop],
      [c - 0.035, railTop],
      [c - 0.04, railBase],
    ];
    const ballastGeo = buildRibbonGeometry(route, ballastProfile, { step: 5, uvScale: 3 });
    // Both rails in one geometry → one draw call.
    const railGeo = mergeGeometries([
      buildRibbonGeometry(route, railProfile(half), { step: 3 }),
      buildRibbonGeometry(route, railProfile(-half), { step: 3 }),
    ]);
    const wire = (y) => [
      [0.012, y + 0.012],
      [-0.012, y + 0.012],
      [-0.012, y - 0.012],
      [0.012, y - 0.012],
      [0.012, y + 0.012],
    ];
    const wireGeo = mergeGeometries([
      buildRibbonGeometry(route, wire(CONTACT_WIRE_HEIGHT), { step: 10 }),
      buildRibbonGeometry(route, wire(MESSENGER_HEIGHT), { step: 10 }),
    ]);
    const ballastTex = makeNoiseTexture({
      base: '#7b746b',
      speckles: ['#5b554e', '#9a9389', '#6d665c', '#a8a196', '#4a453f'],
      density: 2,
      seed: 7,
    });
    return { ballastGeo, railGeo, wireGeo, ballastTex };
  }, []);

  const sleeperItems = useMemo(() => {
    const items = [];
    const p = {};
    for (let s = 0.5; s < route.length; s += TRACK.sleeperSpacing) {
      route.sample(s, p);
      items.push({ x: p.x, y: TRACK.sleeperTop - 0.1, z: p.z, yaw: -p.heading });
    }
    return items;
  }, []);

  const mastItems = useMemo(() => {
    const masts = [];
    const arms = [];
    const p = {};
    for (let s = 20; s < route.length; s += OHE_SPACING) {
      route.sample(s, p);
      const x = p.x + p.lx * OHE_SIDE;
      const z = p.z + p.lz * OHE_SIDE;
      masts.push({ x, y: 4.1, z, yaw: -p.heading });
      // Cantilever arm reaching from the mast over the track.
      const ax = p.x + p.lx * (OHE_SIDE / 2);
      const az = p.z + p.lz * (OHE_SIDE / 2);
      arms.push({ x: ax, y: MESSENGER_HEIGHT + 0.3, z: az, yaw: -p.heading });
    }
    return { masts, arms };
  }, []);

  useLayoutEffect(() => {
    fillInstances(sleepersRef.current, sleeperItems);
    fillInstances(mastsRef.current, mastItems.masts);
    fillInstances(armsRef.current, mastItems.arms);
  }, [sleeperItems, mastItems]);

  return (
    <group>
      <mesh geometry={ballastGeo} receiveShadow>
        <meshStandardMaterial map={ballastTex} roughness={1} />
      </mesh>

      <instancedMesh ref={sleepersRef} args={[undefined, undefined, sleeperItems.length]} receiveShadow>
        {/* box: 0.26 m along the track, 0.2 m tall, 2.75 m across */}
        <boxGeometry args={[0.26, 0.2, 2.75]} />
        <meshStandardMaterial color="#9c9890" roughness={0.95} />
      </instancedMesh>

      <mesh geometry={railGeo} receiveShadow>
        <meshStandardMaterial color="#8a8580" metalness={0.75} roughness={0.35} />
      </mesh>

      <instancedMesh ref={mastsRef} args={[undefined, undefined, mastItems.masts.length]}>
        <boxGeometry args={[0.3, 8.2, 0.3]} />
        <meshStandardMaterial color="#6f7377" metalness={0.4} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={armsRef} args={[undefined, undefined, mastItems.arms.length]}>
        <boxGeometry args={[0.12, 0.12, Math.abs(OHE_SIDE) + 0.6]} />
        <meshStandardMaterial color="#6f7377" metalness={0.4} roughness={0.6} />
      </instancedMesh>

      <mesh geometry={wireGeo}>
        <meshStandardMaterial color="#2b2622" metalness={0.6} roughness={0.5} />
      </mesh>

      {/* buffer stops at both ends of the line */}
      <BufferStop s={2} facing={-1} />
      <BufferStop s={JOURNEY.bufferStop + 1} facing={1} />
    </group>
  );
}

/** Red-and-white end-of-line buffer stop. facing = +1 meets a train moving forward. */
function BufferStop({ s, facing }) {
  const p = route.sample(s, {});
  return (
    <group position={[p.x, TRACK.railTop, p.z]} rotation={[0, -p.heading + (facing > 0 ? 0 : Math.PI), 0]}>
      <mesh position={[0.3, 0.6, 0]} castShadow>
        <boxGeometry args={[0.6, 1.2, 2.6]} />
        <meshStandardMaterial color="#c4161c" />
      </mesh>
      <mesh position={[-0.02, 0.85, 0]}>
        <boxGeometry args={[0.05, 0.3, 2.62]} />
        <meshStandardMaterial color="#f4f1e8" />
      </mesh>
    </group>
  );
}

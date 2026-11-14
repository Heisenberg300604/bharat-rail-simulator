// D1: the guard giving the right-away. "When a train is about to start
// moving, normal practice is for the guard to show a green flag or lamp"
// (IRFCA signalling FAQ pt 5; GR 4.35 — the driver must not start without
// the guard's signal). Green flag by day, green hand lamp at night.
// The guard stands on platform 1 just beyond the rear of the train (the
// guard's cab is in the last vehicle), facing up the train so the crew can
// see the signal, and waves for ~14 s after the right-away.
// 5 small meshes, drawn only while the signal is being shown.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { STATIONS } from '../../config/gameConfig.js';
import { route } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { envState } from '../../world/environment.js';
import { terrain } from '../../world/terrain.js';
import { PLATFORM_TOP } from '../Stations/Station.jsx';

const LAT = 2.7; // on platform 1, ~0.9 m back from the edge

export default function Guard() {
  const group = useRef();
  const arm = useRef();
  const flag = useRef();
  const lamp = useRef();
  const res = useMemo(() => {
    const m = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...opts });
    return {
      body: new THREE.BoxGeometry(0.42, 0.75, 0.26).translate(0, 1.15, 0),
      legs: new THREE.BoxGeometry(0.36, 0.8, 0.22).translate(0, 0.4, 0),
      head: new THREE.SphereGeometry(0.13, 10, 8).translate(0, 1.7, 0),
      arm: new THREE.BoxGeometry(0.08, 0.62, 0.08).translate(0, -0.3, 0),
      flag: new THREE.PlaneGeometry(0.5, 0.36).translate(0.25, 0, 0),
      lamp: new THREE.SphereGeometry(0.09, 10, 8),
      white: m('#e9e6dc'), // white uniform shirt (game choice)
      dark: m('#22252b'),
      skin: m('#8a5a3c'),
      green: m('#14a043', { side: THREE.DoubleSide, roughness: 0.9 }),
      glow: new THREE.MeshBasicMaterial({ color: '#3dff7a', toneMapped: false }),
    };
  }, []);
  useEffect(
    () => () => {
      for (const v of Object.values(res)) v.dispose?.();
    },
    [res],
  );

  const p = useMemo(() => ({}), []);
  const q = useMemo(() => ({}), []);
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    const sig = sceneRefs.guardSignal;
    const now = performance.now();
    const on = !!sig && now < sig.until;
    g.visible = on;
    if (!on) return;
    const s = sig.s - 14; // on the platform a few paces beyond the rear end, facing up the train
    route.sample(s, p);
    route.sample(s + 5, q);
    const onPlatform = STATIONS.some((st) => s > st.platformStart && s < st.platformEnd);
    const y = onPlatform ? p.y + PLATFORM_TOP : terrain.groundY(s, LAT);
    g.position.set(p.x + p.lx * LAT, y, p.z + p.lz * LAT);
    // face the front of the train, so the driver (looking back) sees the signal
    g.rotation.y = Math.atan2(q.x - p.x, q.z - p.z) - Math.PI / 2;
    const night = (envState.night ?? 0) > 0.5;
    flag.current.visible = !night;
    lamp.current.visible = night;
    // wave: the arm sweeps side to side about the shoulder
    const t = state.clock.elapsedTime;
    arm.current.rotation.set(Math.sin(t * 5) * 0.55, 0, night ? 2.6 : 2.85);
  });

  return (
    <group ref={group} visible={false}>
      <mesh geometry={res.legs} material={res.dark} />
      <mesh geometry={res.body} material={res.white} />
      <mesh geometry={res.head} material={res.skin} />
      <group ref={arm} position={[0, 1.48, 0.25]}>
        <mesh geometry={res.arm} material={res.white} />
        <mesh ref={flag} geometry={res.flag} material={res.green} position={[0, -0.62, 0]} />
        <mesh ref={lamp} geometry={res.lamp} material={res.glow} position={[0, -0.66, 0]} visible={false} />
      </group>
    </group>
  );
}

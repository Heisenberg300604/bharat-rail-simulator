// All camera views. One scene camera, moved by whichever view is active:
//   cab       – driver's seat; drag to look around, wheel to zoom
//   chase     – smooth elevated follow camera behind the locomotive
//   orbit     – drag to circle the train, wheel to zoom (8–300 m)
//   trackside – camera waits beside the line ahead and the train passes it
// The title screen uses a slow automatic orbit.
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { game, useGameValue, formation } from '../../state/gameStore.js';
import { sceneRefs } from '../../state/sceneRefs.js';
import { mainLine } from '../../world/trackLayout.js';
import { CAB_EYE, CAB_LOOK_PITCH_DEG } from '../Train/CabInterior.jsx';
import { COACH_EYE, COACH_LOOK_PITCH_DEG, COACH_DEFAULT_YAW_DEG } from '../Train/CoachInterior.jsx';
import { TRACK, FORMATION, COACH_TYPES } from '../../config/gameConfig.js';
import { vehiclePose } from '../../simulation/routeMath.js';
import { attachPointer, consumePointer } from '../../hooks/pointerInput.js';
import { FRAME_PRIORITY_CAMERA, damp } from './cameraConstants.js';

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), hi);
const _coachMat = new THREE.Matrix4();

export const CAMERA_MODES = ['cab', 'interior', 'door', 'rear', 'orbit', 'trackside'];
export const CAMERA_LABELS = { cab: 'Cab', interior: 'Coach', door: 'Door', rear: 'Last coach', orbit: 'Orbit', trackside: 'Trackside' };

function setFov(camera, fov) {
  if (Math.abs(camera.fov - fov) > 0.01) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

export default function CameraRig() {
  const screen = useGameValue((s) => s.screen);
  const mode = useGameValue((s) => s.cameraMode);
  const fovSetting = useGameValue((s) => s.settings.fov);
  const { camera, gl } = useThree();
  useEffect(() => attachPointer(gl.domElement), [gl]);

  // Per-view state that survives between frames (and view switches)
  const st = useRef({
    cab: { yaw: 0, pitch: 0, zoom: 1 },
    interior: { yaw: COACH_DEFAULT_YAW_DEG * DEG, pitch: 0, zoom: 1 },
    orbit: { yaw: -140 * DEG, pitch: 18 * DEG, dist: 45 },
    door: { yaw: 12 * DEG, pitch: -4 * DEG, zoom: 1 },
    rear: { yaw: 0, pitch: -7 * DEG, zoom: 1 },
    trackside: { s: null, side: 1 },
    initialised: false,
    lastMode: null,
  });
  sceneRefs.cameraState = st.current; // lets the dev console/tests aim the orbit camera
  const v = useMemo(
    () => ({ eye: new THREE.Vector3(), look: new THREE.Vector3(), smoothLook: new THREE.Vector3(), tmp: new THREE.Vector3(), p: {} }),
    [],
  );

  useFrame((state, delta) => {
    const loco = sceneRefs.locomotive;
    if (!loco) return;
    const s = st.current;
    const input = consumePointer();
    const dt = Math.min(delta, 0.1);
    const view = screen === 'title' || screen === 'loading' ? 'title' : mode;
    const snap = view !== s.lastMode || !s.initialised;
    s.lastMode = view;
    s.initialised = true;

    if (view === 'cab') {
      const c = s.cab;
      if (input.reset) Object.assign(c, { yaw: 0, pitch: 0, zoom: 1 });
      c.yaw = clamp(c.yaw - input.dx * 0.004, -115 * DEG, 115 * DEG);
      c.pitch = clamp(c.pitch - input.dy * 0.004, -40 * DEG, 35 * DEG);
      c.zoom = clamp(c.zoom * (1 + input.wheel * 0.001), 0.45, 1);
      const sway = Math.min(game.train.speedMps / 25, 1);
      const t = state.clock.elapsedTime;
      const [ex, ey, ez] = CAB_EYE;
      v.eye.set(ex, ey + Math.sin(t * 9.1) * 0.006 * sway, ez + Math.sin(t * 1.7) * 0.012 * sway);
      const pitch = CAB_LOOK_PITCH_DEG * DEG + c.pitch;
      v.look.set(Math.cos(c.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.sin(c.yaw) * Math.cos(pitch)).add(v.eye);
      loco.localToWorld(v.eye);
      loco.localToWorld(v.look);
      camera.position.copy(v.eye);
      camera.lookAt(v.look);
      setFov(camera, fovSetting * c.zoom);
      return;
    }

    if (view === 'interior') {
      const c = s.interior;
      const seat = sceneRefs.coachEye ?? { eye: COACH_EYE, yawDeg: COACH_DEFAULT_YAW_DEG };
      if (input.reset) Object.assign(c, { yaw: seat.yawDeg * DEG, pitch: 0, zoom: 1 });
      c.yaw = clamp(c.yaw - input.dx * 0.004, -150 * DEG, 150 * DEG);
      c.pitch = clamp(c.pitch - input.dy * 0.004, -35 * DEG, 32 * DEG);
      c.zoom = clamp(c.zoom * (1 + input.wheel * 0.001), 0.5, 1);
      const sway = Math.min(game.train.speedMps / 25, 1);
      const t = state.clock.elapsedTime;
      const [ex, ey, ez] = seat.eye;
      v.eye.set(ex, ey + Math.sin(t * 8.5) * 0.008 * sway, ez + Math.sin(t * 1.5) * 0.015 * sway);
      const pitch = COACH_LOOK_PITCH_DEG * DEG + c.pitch;
      v.look.set(Math.cos(c.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.sin(c.yaw) * Math.cos(pitch)).add(v.eye);

      const coach = sceneRefs.coachInterior;
      if (coach) {
        coach.localToWorld(v.eye);
        coach.localToWorld(v.look);
        camera.position.copy(v.eye);
        camera.lookAt(v.look);
      } else {
        const isIcf = game.settings.coachLivery === 'icfBlue';
        const coachSpec = isIcf ? COACH_TYPES.icf : COACH_TYPES.lhb;
        const coachOffset = FORMATION.locomotive.length + (coachSpec.gap ?? FORMATION.couplingGap) + coachSpec.length / 2;
        const coachDist = game.renderDistance - coachOffset;
        vehiclePose(mainLine, coachDist, coachSpec.bogieSpacing, v.p);
        _coachMat.makeRotationY(v.p.yaw);
        _coachMat.setPosition(v.p.x, TRACK.railTop, v.p.z);
        v.eye.applyMatrix4(_coachMat);
        v.look.applyMatrix4(_coachMat);
        camera.position.copy(v.eye);
        camera.lookAt(v.look);
      }
      setFov(camera, fovSetting * c.zoom);
      return;
    }

    // Standing in the open doorway of the second coach, looking along the train
    if (view === 'door' && sceneRefs.doorway) {
      const c = s.door;
      const seat = sceneRefs.doorEye ?? { eye: [10.5, 2.9, -1.78], yawDeg: 12 };
      if (input.reset || snap) Object.assign(c, { yaw: seat.yawDeg * DEG, pitch: -4 * DEG, zoom: input.reset ? 1 : c.zoom });
      c.yaw = clamp(c.yaw - input.dx * 0.004, -20 * DEG, 200 * DEG); // forward along the train … back down it
      c.pitch = clamp(c.pitch - input.dy * 0.004, -45 * DEG, 35 * DEG);
      c.zoom = clamp(c.zoom * (1 + input.wheel * 0.001), 0.45, 1);
      const sway = Math.min(game.train.speedMps / 25, 1);
      const t = state.clock.elapsedTime;
      const [ex, ey, ez] = seat.eye;
      v.eye.set(ex, ey + Math.sin(t * 7.3) * 0.01 * sway, ez + Math.sin(t * 1.3) * 0.02 * sway);
      v.look.set(Math.cos(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), -Math.sin(c.yaw) * Math.cos(c.pitch)).add(v.eye);
      sceneRefs.doorway.localToWorld(v.eye);
      sceneRefs.doorway.localToWorld(v.look);
      camera.position.copy(v.eye);
      camera.lookAt(v.look);
      setFov(camera, fovSetting * c.zoom);
      return;
    }

    // From the back of the last coach: the track running away behind the train.
    // Drag round 180° to see the "X", the LV board and the tail lamp.
    if (view === 'rear' && sceneRefs.rearEnd) {
      const c = s.rear;
      if (input.reset) Object.assign(c, { yaw: 0, pitch: -7 * DEG, zoom: 1 });
      c.yaw = clamp(c.yaw - input.dx * 0.004, -185 * DEG, 185 * DEG);
      c.pitch = clamp(c.pitch - input.dy * 0.004, -50 * DEG, 30 * DEG);
      c.zoom = clamp(c.zoom * (1 + input.wheel * 0.001), 0.4, 1);
      const sway = Math.min(game.train.speedMps / 25, 1);
      const t = state.clock.elapsedTime;
      v.eye.set(-3.8, 3.05 + Math.sin(t * 6.1) * 0.012 * sway, Math.sin(t * 1.1) * 0.03 * sway);
      // base direction = backwards (−X); yaw turns round towards the coach
      v.look.set(-Math.cos(c.yaw) * Math.cos(c.pitch), Math.sin(c.pitch), Math.sin(c.yaw) * Math.cos(c.pitch)).add(v.eye);
      sceneRefs.rearEnd.localToWorld(v.eye);
      sceneRefs.rearEnd.localToWorld(v.look);
      camera.position.copy(v.eye);
      camera.lookAt(v.look);
      setFov(camera, fovSetting * c.zoom);
      return;
    }

    let k = damp(5, dt);
    if (view === 'title') {
      const a = state.clock.elapsedTime * 0.05;
      v.eye.set(-40 + Math.cos(a) * 70, 20 + Math.sin(a * 0.7) * 5, 25 + Math.sin(a) * 45);
      v.look.set(-50, 2.5, 0);
      loco.localToWorld(v.eye);
      loco.localToWorld(v.look);
      k = damp(2, dt);
    } else if (view === 'chase') {
      // directly behind/above the train: stays clear of station canopies
      v.eye.set(-32, 8.5, 1.5);
      v.look.set(40, 3, 0);
      loco.localToWorld(v.eye);
      loco.localToWorld(v.look);
    } else if (view === 'orbit') {
      const o = s.orbit;
      if (input.reset) Object.assign(o, { yaw: -140 * DEG, pitch: 18 * DEG, dist: 45 });
      o.yaw -= input.dx * 0.005;
      o.pitch = clamp(o.pitch + input.dy * 0.004, 2 * DEG, 85 * DEG);
      o.dist = clamp(o.dist * (1 + input.wheel * 0.0012), 8, 300);
      // pivot moves from the loco to the middle of the train as you zoom out
      const pivotBack = o.pivot ?? clamp((o.dist - 30) / 150, 0, 1) * formation.totalLength * 0.5;
      v.look.set(-pivotBack, 2.4, 0);
      v.eye.set(Math.cos(o.yaw) * Math.cos(o.pitch), Math.sin(o.pitch), Math.sin(o.yaw) * Math.cos(o.pitch)).multiplyScalar(o.dist).add(v.look);
      loco.localToWorld(v.look);
      loco.localToWorld(v.eye);
      // never below ground, and rise as you zoom out so buildings don't block the view
      v.eye.y = Math.max(v.eye.y, 1.2, o.dist * 0.18);
      k = damp(10, dt);
    } else if (view === 'trackside') {
      const t = s.trackside;
      const front = game.renderDistance;
      const rear = front - formation.totalLength;
      // Pick a new spot once the whole train has passed (or the spot is too far ahead)
      if (t.s === null || rear > t.s + 40 || t.s - front > 900 || front > t.s + 900 || snap) {
        t.s = Math.min(front + 70 + game.train.speedMps * 6, mainLine.length - 5);
        t.side = -t.side;
      }
      mainLine.sample(t.s, v.p);
      const lat = t.side * 9;
      v.eye.set(v.p.x + v.p.lx * lat, 2.2, v.p.z + v.p.lz * lat);
      v.look.set(0, 2.5, 0);
      loco.localToWorld(v.look);
      camera.position.copy(v.eye);
      v.smoothLook.lerp(v.look, snap ? 1 : damp(8, dt));
      camera.lookAt(v.smoothLook);
      setFov(camera, Math.max(25, fovSetting - 25));
      return;
    }

    if (snap) {
      camera.position.copy(v.eye);
      v.smoothLook.copy(v.look);
    } else {
      camera.position.lerp(v.eye, k);
      v.smoothLook.lerp(v.look, k);
    }
    camera.lookAt(v.smoothLook);
    setFov(camera, fovSetting - 10);
  }, FRAME_PRIORITY_CAMERA);

  return null;
}

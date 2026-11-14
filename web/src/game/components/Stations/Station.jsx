// An original, generic Indian station built from a layout preset (see
// routes/stationLayouts.js): a big terminus with four platform faces, a
// wayside halt, or a single-line crossing station. Canopies, lamp posts,
// benches, a foot-over-bridge (FOB), the station building in the route's
// regional colours, and yellow name boards (regional script / Hindi / English).
// All static parts are merged by ModelBuilder into ~3 draw calls per station.
import { useEffect, useMemo, useState } from 'react';
import { loadMergedModel } from '../../world/models/loadGlbModel.js';
import * as THREE from 'three';
import { route, journeyCfg, useGameValue } from '../../state/gameStore.js';
import { TRACK } from '../../config/gameConfig.js';
import { ModelBuilder } from '../../world/modelBuilder.js';
import { makeNoiseTexture, makePlateTexture, makeStationBoardTexture, makeFacadeTexture, makeFacadeGlowTexture } from '../../world/textures.js';
import { createGlowMaterial, createPoolMaterial, makeGlowMesh, disposeGlowMaterial } from '../../world/glow.js';
import { onEnvironmentChange } from '../../world/environment.js';

export const PLATFORM_TOP = TRACK.railTop + 0.76; // high-level platform ≈ 760 mm above rail
export const CANOPY_H = PLATFORM_TOP + 4.6;
const FOB_DECK = 9.0;

// Station-local frame: x along the track, z to the RIGHT. Lateral (+left) → z = -lat.
const zOf = (lat) => -lat;

// Wayside station building: "Indian Railway Station Building Game-Ready" by nayan
// pachori (Sketchfab; used with the author's permission — see docs/ASSET_CREDITS.md).
// 17.7 m along the track × 10.6 m deep × 7.7 m high, 1,911 triangles, 1 draw call.
// While it loads (or if it is missing) the procedural office is drawn instead.
const STATION_MODEL_URL = `${import.meta.env.BASE_URL}assets/models/station/station-building.glb`;
const STATION_MODEL_DEPTH = 10.56;
const STATION_MODEL_FRONT = 1; // +1: the model's +z face is its platform front (−1: its −z face)

function buildStation(length, layout, style, buildingSide, { modelBuilding = false } = {}) {
  const b = new ModelBuilder();
  const lights = { tubes: [], posts: [], boards: [] }; // positions for night glows (station-local)
  const L = length;
  const canopyLen = Math.min(layout.canopy, L - 60);
  const PLATFORMS = layout.platforms;

  for (const pf of PLATFORMS) {
    const [la, lb] = pf.lat;
    const z0 = Math.min(zOf(la), zOf(lb));
    const z1 = Math.max(zOf(la), zOf(lb));
    const zm = (z0 + z1) / 2;
    const width = z1 - z0;
    // platform body + surface (textured) + edge coping on track sides
    b.box([-L / 2, L / 2], [0, PLATFORM_TOP - 0.05], [z0, z1], '#b9b1a4', { mat: 'platform', uvScale: 6 });
    b.box([-L / 2, L / 2], [PLATFORM_TOP - 0.05, PLATFORM_TOP], [z0 + 0.5, z1 - 0.5], '#d9d3c8', { mat: 'platform', uvScale: 6 });
    for (const edge of [z0, z1]) {
      const inward = edge === z0 ? 1 : -1;
      b.box([-L / 2, L / 2], [PLATFORM_TOP - 0.05, PLATFORM_TOP + 0.005], edge === z0 ? [z0, z0 + 0.5] : [z1 - 0.5, z1], '#e8e4da');
      // yellow safety line
      const zl = edge + inward * 0.75;
      b.box([-L / 2, L / 2], [PLATFORM_TOP, PLATFORM_TOP + 0.01], [zl - 0.08, zl + 0.08], '#f2c230');
    }
    // canopy: two rows of posts + roof with fascia
    for (let x = -canopyLen / 2; x <= canopyLen / 2; x += 10) {
      b.box([x - 0.15, x + 0.15], [PLATFORM_TOP, CANOPY_H], [zm - 0.15, zm + 0.15], style.canopy);
      b.box([x - 0.08, x + 0.08], [CANOPY_H - 0.6, CANOPY_H], [zm - width / 2 + 1, zm + width / 2 - 1], style.canopy);
    }
    b.box([-canopyLen / 2 - 2, canopyLen / 2 + 2], [CANOPY_H, CANOPY_H + 0.18], [z0 + 0.3, z1 - 0.3], style.roof, { mat: 'roof' });
    b.box([-canopyLen / 2 - 2, canopyLen / 2 + 2], [CANOPY_H - 0.35, CANOPY_H], [z0 + 0.3, z0 + 0.45], style.trim);
    b.box([-canopyLen / 2 - 2, canopyLen / 2 + 2], [CANOPY_H - 0.35, CANOPY_H], [z1 - 0.45, z1 - 0.3], style.trim);
    // LED tube lights under the canopy, one row above each platform edge
    for (let x = -canopyLen / 2 + 5; x < canopyLen / 2; x += 10) {
      for (const zt of [z0 + 2.2, z1 - 2.2]) {
        b.box([x - 0.6, x + 0.6], [CANOPY_H - 0.62, CANOPY_H - 0.56], [zt - 0.05, zt + 0.05], '#f4f1e6', { mat: 'lamp' });
        lights.tubes.push({ x, y: CANOPY_H - 0.66, z: zt });
      }
    }
    // benches + lamp posts outside the canopy
    for (let x = -canopyLen / 2 + 15; x < canopyLen / 2; x += 28) {
      // Concrete side arms in maroon
      b.box([x - 1.1, x - 0.95], [PLATFORM_TOP, PLATFORM_TOP + 0.85], [zm - 0.35, zm + 0.35], '#6e1f1f');
      b.box([x + 0.95, x + 1.1], [PLATFORM_TOP, PLATFORM_TOP + 0.85], [zm - 0.35, zm + 0.35], '#6e1f1f');
      // Wooden seat & backrest slats
      b.box([x - 0.95, x + 0.95], [PLATFORM_TOP + 0.42, PLATFORM_TOP + 0.47], [zm - 0.32, zm + 0.32], '#ab6b34');
      b.box([x - 0.95, x + 0.95], [PLATFORM_TOP + 0.65, PLATFORM_TOP + 0.82], [zm - 0.05, zm + 0.05], '#ab6b34');
    }

    // Electronic Coach Guidance Display Boards (CGDB) hanging from canopy
    for (let x = -canopyLen / 2 + 18; x < canopyLen / 2; x += 24) {
      b.box([x - 0.03, x + 0.03], [CANOPY_H - 1.1, CANOPY_H], [zm - 0.4, zm - 0.35], '#222');
      b.box([x - 0.03, x + 0.03], [CANOPY_H - 1.1, CANOPY_H], [zm + 0.35, zm + 0.4], '#222');
      b.box([x - 0.45, x + 0.45], [CANOPY_H - 1.42, CANOPY_H - 1.1], [zm - 0.7, zm + 0.7], '#141414');
      // Amber LED matrix faces on both sides
      b.box([x - 0.43, x + 0.43], [CANOPY_H - 1.4, CANOPY_H - 1.12], [zm - 0.72, zm - 0.69], '#ff9500', { mat: 'lamp' });
      b.box([x - 0.43, x + 0.43], [CANOPY_H - 1.4, CANOPY_H - 1.12], [zm + 0.69, zm + 0.72], '#ff9500', { mat: 'lamp' });
      lights.boards.push({ x, y: CANOPY_H - 1.26, z: zm - 0.78 }, { x, y: CANOPY_H - 1.26, z: zm + 0.78 });
    }

    // Round Indian Railways analog platform clock hanging from canopy
    b.cylinder({ radius: 0.45, length: 0.16, axis: 'x', position: [0, CANOPY_H - 1.15, zm], color: '#f8f8f4', segments: 24 });
    b.cylinder({ radius: 0.48, length: 0.12, axis: 'x', position: [0, CANOPY_H - 1.15, zm], color: '#1a1a1a', segments: 24 });
    b.box([-0.02, 0.02], [CANOPY_H - 0.7, CANOPY_H], [zm - 0.03, zm + 0.03], '#222');

    // IRCTC Chai / Refreshment Kiosk under canopy (at x = -28)
    const stallX = -28;
    b.box([stallX - 2.2, stallX + 2.2], [PLATFORM_TOP, PLATFORM_TOP + 1.05], [zm - 1.2, zm + 1.2], '#1d487a');
    b.box([stallX - 2.3, stallX + 2.3], [PLATFORM_TOP + 1.05, PLATFORM_TOP + 1.12], [zm - 1.25, zm + 1.25], '#b4bac0');
    b.box([stallX - 2.4, stallX + 2.4], [PLATFORM_TOP + 2.35, PLATFORM_TOP + 2.45], [zm - 1.35, zm + 1.35], '#f2b528');
    for (const sx of [-2.2, 2.2]) {
      for (const sz of [-1.2, 1.2]) {
        b.box([stallX + sx - 0.04, stallX + sx + 0.04], [PLATFORM_TOP + 1.05, PLATFORM_TOP + 2.35], [zm + sz - 0.04, zm + sz + 0.04], '#333');
      }
    }
    b.cylinder({ radius: 0.22, length: 0.55, position: [stallX - 1.1, PLATFORM_TOP + 1.4, zm + 0.4], color: '#d09530', segments: 14 });
    b.box([stallX - 0.3, stallX + 1.6], [PLATFORM_TOP + 1.12, PLATFORM_TOP + 1.6], [zm - 0.8, zm + 0.8], '#a5cbe2', { mat: 'lamp' });

    // Drinking Water Booth ("स्वच्छ पेयजल") under canopy (at x = 35)
    const waterX = 35;
    b.box([waterX - 1.6, waterX + 1.6], [PLATFORM_TOP, PLATFORM_TOP + 0.85], [zm - 0.8, zm + 0.8], '#235999');
    b.box([waterX - 1.5, waterX + 1.5], [PLATFORM_TOP + 0.85, PLATFORM_TOP + 0.95], [zm - 0.7, zm + 0.7], '#cfd4da');
    for (const tapX of [-0.9, 0, 0.9]) {
      b.cylinder({ radius: 0.025, length: 0.35, position: [waterX + tapX, PLATFORM_TOP + 1.12, zm], color: '#b0b8c0', segments: 8 });
      b.cylinder({ radius: 0.02, length: 0.12, axis: 'z', position: [waterX + tapX, PLATFORM_TOP + 1.25, zm + 0.06], color: '#b0b8c0', segments: 6 });
      b.cylinder({ radius: 0.02, length: 0.12, axis: 'z', position: [waterX + tapX, PLATFORM_TOP + 1.25, zm - 0.06], color: '#b0b8c0', segments: 6 });
    }
    b.box([waterX - 1.4, waterX + 1.4], [PLATFORM_TOP + 2.1, PLATFORM_TOP + 2.45], [zm - 0.05, zm + 0.05], '#1d5e9f');
    for (const legX of [-1.3, 1.3]) {
      b.box([waterX + legX - 0.03, waterX + legX + 0.03], [PLATFORM_TOP + 0.95, PLATFORM_TOP + 2.1], [zm - 0.03, zm + 0.03], '#444');
    }

    for (let x = -L / 2 + 12; x < L / 2; x += 24) {
      if (Math.abs(x) < canopyLen / 2 + 3) continue;
      b.box([x - 0.08, x + 0.08], [PLATFORM_TOP, PLATFORM_TOP + 5.2], [zm - 0.08, zm + 0.08], '#5b6066');
      b.box([x - 0.25, x + 0.25], [PLATFORM_TOP + 5.1, PLATFORM_TOP + 5.3], [zm - 0.5, zm + 0.5], '#e9e6dc', { mat: 'lamp' });
      lights.posts.push({ x, y: PLATFORM_TOP + 5.0, z: zm });
    }
  }

  // Foot-over-bridge spanning every platform, with a staircase down to each
  if (layout.fob) buildFob(b, L, PLATFORMS, style);
  if (layout.building === 'grand') buildGrandBuilding(b, PLATFORMS, style, buildingSide, lights);
  else if (!modelBuilding) buildSmallBuilding(b, PLATFORMS, style, buildingSide, lights);

  return { geos: b.build(), lights };
}


/** Foot-over-bridge spanning every platform, with a staircase down to each. */
function buildFob(b, L, PLATFORMS, style) {
  const fobX = L / 2 - Math.min(70, L * 0.22);
  const allLat = PLATFORMS.flatMap((p) => p.lat);
  const zMin = zOf(Math.max(...allLat)) - 2;
  const zMax = zOf(Math.min(...allLat)) + 1;
  b.box([fobX - 2, fobX + 2], [FOB_DECK, FOB_DECK + 0.4], [zMin, zMax], '#c9c2b4');
  b.box([fobX - 2, fobX + 2], [FOB_DECK + 0.4, FOB_DECK + 1.5], [zMin, zMin + 0.12], '#d8d0c0');
  b.box([fobX - 2, fobX + 2], [FOB_DECK + 0.4, FOB_DECK + 1.5], [zMax - 0.12, zMax], '#d8d0c0');
  b.box([fobX - 2.3, fobX + 2.3], [FOB_DECK + 3.0, FOB_DECK + 3.15], [zMin, zMax], style.roof, { mat: 'roof' });
  for (const pf of PLATFORMS) {
    const zm = (zOf(pf.lat[0]) + zOf(pf.lat[1])) / 2;
    b.box([fobX - 0.3, fobX + 0.3], [PLATFORM_TOP, FOB_DECK], [zm - 0.3, zm + 0.3], style.canopy);
    // sloping staircase slab, rising towards the bridge
    const run = (FOB_DECK - PLATFORM_TOP) * 1.6;
    const len = Math.hypot(run, FOB_DECK - PLATFORM_TOP);
    const ang = Math.atan2(FOB_DECK - PLATFORM_TOP, run);
    b.add(new THREE.BoxGeometry(len, 0.3, 2.2), {
      color: '#bfb7a8',
      position: [fobX - 2 - run / 2, (PLATFORM_TOP + FOB_DECK) / 2, zm + 1.6],
      rotation: [0, 0, ang],
    });
  }

}

/** Big station building behind PF1: long block with bands, a central tower and chhatri kiosks. */
function buildGrandBuilding(b, PLATFORMS, style, buildingSide, lights) {
  // Station building behind PF1: long red-sandstone block with cream bands
  const pf1Far = PLATFORMS[0].lat[1];
  const bz0 = zOf(pf1Far) - 16 * buildingSide;
  const bz1 = zOf(pf1Far) - 1 * buildingSide;
  const [zA, zB] = [Math.min(bz0, bz1), Math.max(bz0, bz1)];
  b.box([-60, 60], [0, 10], [zA, zB], style.building, { mat: 'facade', uvScale: 3.4 });
  b.box([-61, 61], [10, 11], [zA - 0.5, zB + 0.5], style.trim);
  b.box([-61, 61], [3.6, 4.0], [zA - 0.3, zB + 0.3], style.trim);
  b.box([-16, 16], [11, 15], [zA + 2, zB - 2], style.building);
  b.box([-17, 17], [15, 15.8], [zA + 1.5, zB - 1.5], style.trim);
  // chhatri-style kiosks on the roof corners
  for (const x of [-55, 55, -14, 14]) {
    b.box([x - 1.5, x + 1.5], [11, 13.5], [zA + 1, zA + 4], style.trim);
    b.add(new THREE.SphereGeometry(1.8, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), { color: style.trim, position: [x, 13.5, zA + 2.5] });
  }
  // lit windows / porch lamps along the station building
  for (let x = -54; x <= 54; x += 12) lights.posts.push({ x, y: 4.6, z: zOf(pf1Far) - 0.5 * buildingSide, small: true });
}

/** Wayside station: a single-storey office with a veranda and a sloping tiled roof. */
function buildSmallBuilding(b, PLATFORMS, style, buildingSide, lights) {
  const pf1Far = PLATFORMS[0].lat[1];
  const z0 = zOf(pf1Far) - 9 * buildingSide;
  const z1 = zOf(pf1Far) - 0.6 * buildingSide;
  const [zA, zB] = [Math.min(z0, z1), Math.max(z0, z1)];
  const zFront = zOf(pf1Far) - 0.6 * buildingSide; // facing the platform
  b.box([-16, 16], [0, PLATFORM_TOP + 4.2], [zA + 2.2, zB - 0.2], style.building, { mat: 'facade', uvScale: 3.4 });
  b.box([-16.3, 16.3], [PLATFORM_TOP + 4.2, PLATFORM_TOP + 4.5], [zA + 2, zB], style.trim);
  // sloping roof in two planes
  for (const [za, zb, tilt] of [
    [zA - 0.5, (zA + zB) / 2, 0.32],
    [(zA + zB) / 2, zB + 2.4, -0.32],
  ]) {
    const w = zb - za;
    b.add(new THREE.BoxGeometry(34, 0.25, w / Math.cos(0.32)), { color: style.roof, mat: 'roof', position: [0, PLATFORM_TOP + 5.2, (za + zb) / 2], rotation: [tilt * buildingSide, 0, 0] });
  }
  // veranda posts along the platform side
  for (let x = -14; x <= 14; x += 4) b.box([x - 0.12, x + 0.12], [PLATFORM_TOP, PLATFORM_TOP + 4.2], [zFront - 0.12 + buildingSide * 0.3, zFront + 0.12 + buildingSide * 0.3], style.trim);
  // station master's board above the door
  b.box([-3, 3], [PLATFORM_TOP + 2.9, PLATFORM_TOP + 3.6], [zFront - 0.06, zFront + 0.06], '#f5c518');
  for (let x = -12; x <= 12; x += 6) lights.posts.push({ x, y: PLATFORM_TOP + 3.9, z: zFront + buildingSide * 0.4, small: true });
}

export default function Station({ station }) {
  const length = station.platformEnd - station.platformStart;
  const centerS = station.centerS;
  const layout = station.layout;
  const PLATFORMS = layout.platforms;
  useGameValue((s) => s.difficulty); // the stop zone size follows the difficulty
  const stops = journeyCfg.stops.filter((st) => st.stationId === station.id);
  // wayside stations use the 3D station-building model once it has loaded
  const [buildingModel, setBuildingModel] = useState(null);
  useEffect(() => {
    if (layout.building === 'grand') return undefined;
    let alive = true;
    loadMergedModel(STATION_MODEL_URL, { forwardAxis: 'x' })
      .then((m) => alive && setBuildingModel(m))
      .catch(() => {}); // keep the procedural building
    return () => {
      alive = false;
    };
  }, [layout.building]);
  const useModel = !!buildingModel;

  const built = useMemo(() => {
    const pose = route.sample(centerS, {});
    const { geos, lights } = buildStation(length, layout, station.style, station.side, { modelBuilding: useModel });
    const platformTex = makeNoiseTexture({ base: '#ffffff', speckles: ['#e2ddd4', '#f0ece4', '#d3cdc2'], density: 1.5, seed: 3 });
    const facade = makeFacadeTexture();
    const materials = {
      body: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
      platform: new THREE.MeshStandardMaterial({ vertexColors: true, map: platformTex, roughness: 0.95 }),
      roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }),
      facade: new THREE.MeshStandardMaterial({ vertexColors: true, map: facade, roughness: 0.9, emissive: '#ffffff', emissiveMap: makeFacadeGlowTexture(), emissiveIntensity: 0 }),
      lamp: new THREE.MeshStandardMaterial({ vertexColors: true, emissive: '#fff4d6', emissiveIntensity: 0.6 }),
    };
    // Night: glow sprites at every lamp and soft pools of light on the platforms
    const glowMat = createGlowMaterial();
    const poolMat = createPoolMaterial({ strength: 0.75 });
    const glowItems = [
      ...lights.tubes.map((l) => ({ ...l, size: 2.4, color: '#fff3dc' })),
      ...lights.posts.map((l) => ({ ...l, size: l.small ? 2.4 : 5.5, color: '#ffe7c2' })),
      ...lights.boards.map((l) => ({ ...l, size: 1.1, color: '#ff9a1f' })),
    ];
    const poolItems = [
      ...lights.tubes.map((l) => ({ x: l.x, y: PLATFORM_TOP + 0.02, z: l.z, size: 7.5, color: '#ffeccc' })),
      ...lights.posts.filter((l) => !l.small).map((l) => ({ x: l.x, y: PLATFORM_TOP + 0.02, z: l.z, size: 13, color: '#ffe2b5' })),
    ];
    const glows = makeGlowMesh(glowItems, glowMat);
    const pools = makeGlowMesh(poolItems, poolMat, { ground: true });
    const boardTex = makeStationBoardTexture(station.hindi, station.name, station.regional, station.regionalScript);
    const pfTextures = PLATFORMS.map((pf) =>
      makePlateTexture(pf.id.replace(' ', ' | '), { bg: '#123c7a', fg: '#ffffff', width: 256, height: 128, font: 'bold 80px Helvetica, Arial, sans-serif' }),
    );
    const stopTex = stops.length ? makePlateTexture('STOP', { bg: '#ffffff', fg: '#c4161c' }) : null;
    return { pose, geos, materials, boardTex, pfTextures, stopTex, glows, pools };
  }, [centerS, length, station, layout, PLATFORMS, stops.length, useModel]);

  useEffect(
    () =>
      onEnvironmentChange((env) => {
        built.materials.lamp.emissiveIntensity = 0.45 + 2.4 * env.lamps;
        built.materials.facade.emissiveIntensity = 0.9 * env.lamps * env.night;
      }),
    [built],
  );

  useEffect(
    () => () => {
      Object.values(built.geos).forEach((g) => g.dispose());
      Object.values(built.materials).forEach((m) => {
        m.map?.dispose();
        m.emissiveMap?.dispose();
        m.dispose();
      });
      for (const mesh of [built.glows, built.pools]) {
        disposeGlowMaterial(mesh.material);
        mesh.dispose();
      }
      built.boardTex.dispose();
      built.pfTextures.forEach((t) => t.dispose());
      built.stopTex?.dispose();
    },
    [built],
  );

  const { pose, geos, materials } = built;
  const pf1Edge = zOf(PLATFORMS[0].lat[0]);
  const canopyLen = Math.min(layout.canopy, length - 60);
  const boardW = 4.2;
  const boardH = boardW / (built.boardTex.userData.aspect ?? 3.2);
  const pfBoardX = Math.min(60, canopyLen / 2 - 6);

  return (
    <group position={[pose.x, station.elevation, pose.z]} rotation={[0, -pose.heading, 0]}>
      {Object.entries(geos).map(([key, geo]) => (
        <mesh key={key} geometry={geo} material={materials[key]} receiveShadow castShadow={key === 'roof'} />
      ))}
      {useModel &&
        buildingModel.parts.map((p, k) => {
          const side = station.side ?? 1;
          const zFront = zOf(PLATFORMS[0].lat[1]) - 0.6 * side; // just behind platform 1
          return (
            <mesh
              key={k}
              geometry={p.geometry}
              material={p.material}
              position={[0, 0, zFront - (side * STATION_MODEL_DEPTH) / 2]}
              rotation={[0, side * STATION_MODEL_FRONT > 0 ? 0 : Math.PI, 0]}
              castShadow
              receiveShadow
            />
          );
        })}
      <primitive object={built.glows} />
      <primitive object={built.pools} />

      {/* yellow name boards, double-sided, along each platform */}
      {PLATFORMS.map((pf) => {
        const zm = (zOf(pf.lat[0]) + zOf(pf.lat[1])) / 2;
        return [-length / 2 + 30, length / 2 - 30, 0].map((x) => (
          <group key={`${pf.id}${x}`} position={[x === 0 ? -40 : x, PLATFORM_TOP, zm]}>
            {[-1.7, 1.7].map((px) => (
              <mesh key={px} position={[px, 1.5 + (boardH - 1.3) / 2, 0]}>
                <boxGeometry args={[0.1, 3 + boardH - 1.3, 0.1]} />
                <meshStandardMaterial color="#2d2d2d" />
              </mesh>
            ))}
            <mesh position={[0, 2.45 + boardH / 2, 0.03]}>
              <planeGeometry args={[boardW, boardH]} />
              <meshStandardMaterial map={built.boardTex} />
            </mesh>
            <mesh position={[0, 2.45 + boardH / 2, -0.03]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[boardW, boardH]} />
              <meshStandardMaterial map={built.boardTex} />
            </mesh>
          </group>
        ));
      })}

      {/* blue platform-number boards hanging under each canopy */}
      {PLATFORMS.map((pf, i) => {
        const zm = (zOf(pf.lat[0]) + zOf(pf.lat[1])) / 2;
        return [-pfBoardX, pfBoardX].map((x) => (
          <mesh key={`${pf.id}n${x}`} position={[x, CANOPY_H - 1.0, zm]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[1.6, 0.8]} />
            <meshStandardMaterial map={built.pfTextures[i]} side={THREE.DoubleSide} />
          </mesh>
        ));
      })}

      {/* name board on the station building, facing the tracks */}
      {layout.building === 'grand' ? (
        <mesh position={[0, 7.2, zOf(PLATFORMS[0].lat[1]) - 1 + 0.04]}>
          <planeGeometry args={[16, 16 / (built.boardTex.userData.aspect ?? 3.2)]} />
          <meshStandardMaterial map={built.boardTex} />
        </mesh>
      ) : (
        <mesh position={[0, PLATFORM_TOP + 5.6, zOf(PLATFORMS[0].lat[1]) - 0.4]}>
          <planeGeometry args={[7, 7 / (built.boardTex.userData.aspect ?? 3.2)]} />
          <meshStandardMaterial map={built.boardTex} />
        </mesh>
      )}

      {/* STOP board and green stop zone for every halt the train makes here */}
      {stops.map((stop) => (
        <group key={stop.marker}>
          <group position={[stop.marker - centerS, PLATFORM_TOP, pf1Edge - 0.9]}>
            <mesh position={[0, 1.3, 0]}>
              <boxGeometry args={[0.1, 2.6, 0.1]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[-0.06, 2.9, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[1.1, 1.1]} />
              <meshStandardMaterial map={built.stopTex} emissive="#ffffff" emissiveIntensity={0.2} emissiveMap={built.stopTex} />
            </mesh>
          </group>
          <mesh position={[stop.marker - centerS, PLATFORM_TOP + 0.015, pf1Edge - 0.3]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[stop.halfLength * 2, 0.35]} />
            <meshStandardMaterial color="#2fbf5b" emissive="#2fbf5b" emissiveIntensity={0.35} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

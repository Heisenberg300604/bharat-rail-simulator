// A simple original station: raised platform, canopy, building and the
// familiar yellow Hindi/English name boards. Stations sit on straight track,
// so the whole station is one group aligned with the route.
import { useMemo } from 'react';
import { route } from '../../state/gameStore.js';
import { TRACK, JOURNEY } from '../../config/gameConfig.js';
import { makeNoiseTexture, makePlateTexture, makeStationBoardTexture } from '../../world/textures.js';
import { stopZone } from '../../simulation/journeyManager.js';

const PLATFORM_EDGE = 1.78; // distance from track centre to platform edge
const PLATFORM_WIDTH = 9;
const PLATFORM_TOP = TRACK.railTop + 0.76; // Indian high-level platform ≈ 760 mm above rail

let platformTexture = null;
function getPlatformTexture() {
  platformTexture ??= makeNoiseTexture({ base: '#a9a196', speckles: ['#9a9287', '#b8b0a4', '#8f887e'], density: 1.2, seed: 3 });
  return platformTexture;
}

export default function Station({ station, isDestination }) {
  const length = station.platformEnd - station.platformStart;
  const centerS = (station.platformStart + station.platformEnd) / 2;

  const { pose, boardTex, stopTex, platformTex } = useMemo(() => {
    const pose = route.sample(centerS, {});
    const platformTex = getPlatformTexture().clone();
    platformTex.repeat.set(length / 6, PLATFORM_WIDTH / 6);
    platformTex.needsUpdate = true;
    return {
      pose,
      platformTex,
      boardTex: makeStationBoardTexture(station.hindi, station.name),
      stopTex: isDestination ? makePlateTexture('STOP', { bg: '#ffffff', fg: '#c4161c' }) : null,
    };
  }, [centerS, length, station, isDestination]);

  // Station-local frame: x along the track, z to the right. Left side = -z.
  const side = station.side; // +1 left, -1 right
  const zNear = -side * PLATFORM_EDGE;
  const zFar = -side * (PLATFORM_EDGE + PLATFORM_WIDTH);
  const zMid = (zNear + zFar) / 2;
  const faceTrack = side > 0 ? 0 : Math.PI; // plane normal pointing at the track
  const canopyLen = Math.min(170, length - 40);

  const zone = stopZone(JOURNEY);

  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, -pose.heading, 0]}>
      {/* platform */}
      <mesh position={[0, PLATFORM_TOP / 2, zMid]} receiveShadow>
        <boxGeometry args={[length, PLATFORM_TOP, PLATFORM_WIDTH]} />
        <meshStandardMaterial map={platformTex} roughness={0.95} />
      </mesh>
      {/* yellow safety line + white edge */}
      <mesh position={[0, PLATFORM_TOP + 0.005, zNear - side * 0.6]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, 0.25]} />
        <meshStandardMaterial color="#f2c230" />
      </mesh>
      <mesh position={[0, PLATFORM_TOP + 0.005, zNear - side * 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[length, 0.2]} />
        <meshStandardMaterial color="#e8e6df" />
      </mesh>

      {/* canopy: posts + roof */}
      {Array.from({ length: Math.floor(canopyLen / 12) + 1 }, (_, i) => -canopyLen / 2 + i * 12).map((x) => (
        <mesh key={x} position={[x, PLATFORM_TOP + 2.2, zMid]}>
          <boxGeometry args={[0.3, 4.4, 0.3]} />
          <meshStandardMaterial color="#6b4a2f" />
        </mesh>
      ))}
      <mesh position={[0, PLATFORM_TOP + 4.5, zMid]} castShadow receiveShadow>
        <boxGeometry args={[canopyLen + 4, 0.25, PLATFORM_WIDTH - 0.6]} />
        <meshStandardMaterial color="#3f6650" roughness={0.8} />
      </mesh>

      {/* station building behind the platform */}
      <group position={[0, 0, zFar - side * 8]}>
        <mesh position={[0, 5, 0]} castShadow receiveShadow>
          <boxGeometry args={[70, 10, 14]} />
          <meshStandardMaterial color="#b5523b" roughness={0.9} />
        </mesh>
        <mesh position={[0, 10.4, 0]}>
          <boxGeometry args={[71, 0.8, 14.6]} />
          <meshStandardMaterial color="#efe4c8" />
        </mesh>
        <mesh position={[0, 12.5, 0]} castShadow>
          <boxGeometry args={[18, 4, 10]} />
          <meshStandardMaterial color="#efe4c8" />
        </mesh>
        {/* arched-looking openings facing the platform */}
        {[-26, -18, -10, 10, 18, 26].map((x) => (
          <mesh key={x} position={[x, 3.2, side * 7.02]} rotation={[0, faceTrack, 0]}>
            <planeGeometry args={[3.2, 4.6]} />
            <meshStandardMaterial color="#3b2a22" />
          </mesh>
        ))}
        <mesh position={[0, 8, side * 7.03]} rotation={[0, faceTrack, 0]}>
          <planeGeometry args={[14, 4.4]} />
          <meshStandardMaterial map={boardTex} />
        </mesh>
      </group>

      {/* name boards along the platform, readable from the train */}
      {[-length / 2 + 25, 0, length / 2 - 25].map((x) => (
        <group key={x} position={[x, PLATFORM_TOP, zNear - side * 2.4]}>
          {[-1.6, 1.6].map((px) => (
            <mesh key={px} position={[px, 1.4, 0]}>
              <boxGeometry args={[0.1, 2.8, 0.1]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
          <mesh position={[0, 3.0, 0]} rotation={[0, faceTrack, 0]}>
            <planeGeometry args={[4, 1.25]} />
            <meshStandardMaterial map={boardTex} />
          </mesh>
          <mesh position={[0, 3.0, side * -0.01]} rotation={[0, faceTrack + Math.PI, 0]}>
            <planeGeometry args={[4, 1.25]} />
            <meshStandardMaterial map={boardTex} />
          </mesh>
        </group>
      ))}

      {isDestination && (
        <group>
          {/* STOP board facing the arriving train, at the platform edge */}
          <group position={[JOURNEY.stopMarker - centerS, PLATFORM_TOP, zNear - side * 0.9]}>
            <mesh position={[0, 1.2, 0]}>
              <boxGeometry args={[0.1, 2.4, 0.1]} />
              <meshStandardMaterial color="#333" />
            </mesh>
            <mesh position={[-0.06, 2.7, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <planeGeometry args={[1.0, 1.0]} />
              <meshStandardMaterial map={stopTex} emissive="#ffffff" emissiveIntensity={0.15} emissiveMap={stopTex} />
            </mesh>
          </group>
          {/* green painted stop zone on the platform edge (where the loco front should stop) */}
          <mesh position={[(zone.start + zone.end) / 2 - centerS, PLATFORM_TOP + 0.01, zNear - side * 0.35]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[zone.end - zone.start, 0.3]} />
            <meshStandardMaterial color="#2fbf5b" emissive="#2fbf5b" emissiveIntensity={0.3} />
          </mesh>
        </group>
      )}
    </group>
  );
}

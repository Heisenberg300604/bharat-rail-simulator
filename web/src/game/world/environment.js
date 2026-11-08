// Time of day + weather.
//
// computeEnvironment() turns the player's choice (e.g. "night" + "fog") into a
// flat set of numbers and colours: sun, sky, fog, exposure, how strongly lamps
// glow, rain amount… The EnvironmentController blends the live `envState`
// towards that target over ~2 s, then notifies subscribers.
//
// Performance: components never poll the environment every frame. They
// subscribe with onEnvironmentChange(cb); callbacks run only while a
// transition is in progress (and once on subscribe), so a steady scene costs
// nothing.
import * as THREE from 'three';

const deg = Math.PI / 180;
function sunVector(elevationDeg, azimuthDeg) {
  const el = elevationDeg * deg;
  const az = azimuthDeg * deg;
  return new THREE.Vector3(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)).normalize();
}

// clock: in-game time (seconds after midnight) when the journey starts.
export const TIME_OF_DAY = {
  morning: {
    label: 'Morning · 07:10',
    clock: 7 * 3600 + 10 * 60,
    sunDir: sunVector(14, -30),
    sunColor: '#ffd2a1',
    sunIntensity: 2.1,
    hemiSky: '#dbe3ee',
    hemiGround: '#7c7356',
    hemiIntensity: 0.62,
    horizon: '#efd7b7',
    zenith: '#7fa6d4',
    glowColor: '#ffcf9a',
    night: 0,
    lamps: 0.15,
    exposure: 1.0,
    stars: 0,
    envIntensity: 0.5,
  },
  noon: {
    label: 'Afternoon · 13:00',
    clock: 13 * 3600,
    sunDir: new THREE.Vector3(0.55, 0.78, 0.3).normalize(),
    sunColor: '#fff0d4',
    sunIntensity: 2.8,
    hemiSky: '#e3ebf2',
    hemiGround: '#7a7250',
    hemiIntensity: 0.75,
    horizon: '#d9dccf',
    zenith: '#6a9bd0',
    glowColor: '#fff1d6',
    night: 0,
    lamps: 0,
    exposure: 1.0,
    stars: 0,
    envIntensity: 0.55,
  },
  evening: {
    label: 'Evening · 17:50',
    clock: 17 * 3600 + 50 * 60,
    sunDir: sunVector(6, 160),
    sunColor: '#ffad66',
    sunIntensity: 1.7,
    hemiSky: '#c7b9c9',
    hemiGround: '#5e5242',
    hemiIntensity: 0.5,
    horizon: '#f2a96f',
    zenith: '#4a68a3',
    glowColor: '#ff9c52',
    night: 0.35,
    lamps: 0.75,
    exposure: 1.05,
    stars: 0,
    envIntensity: 0.4,
  },
  night: {
    label: 'Night · 22:15',
    clock: 22 * 3600 + 15 * 60,
    sunDir: sunVector(48, 110), // the moon
    sunColor: '#93a9e8',
    sunIntensity: 0.45,
    hemiSky: '#34466d',
    hemiGround: '#11141c',
    hemiIntensity: 0.5,
    horizon: '#262a3a', // a little urban sky-glow near the horizon
    zenith: '#03060f',
    glowColor: '#d6e0ff',
    night: 1,
    lamps: 1,
    exposure: 1.3,
    stars: 1,
    envIntensity: 0.08,
  },
};

export const WEATHER = {
  clear: { label: 'Clear', fogNear: 300, fogFar: Infinity, sunScale: 1, hemiScale: 1, haze: 0, rain: 0, halo: 1, speedLimitKmh: null },
  // Dense North-Indian winter fog: visibility ~150–250 m. Railways cap speeds in fog.
  fog: { label: 'Dense fog', fogNear: 8, fogFar: 240, sunScale: 0.3, hemiScale: 1.15, haze: 0.85, rain: 0, halo: 2.2, speedLimitKmh: 75 },
  rain: { label: 'Monsoon rain', fogNear: 40, fogFar: 650, sunScale: 0.25, hemiScale: 0.8, haze: 0.55, rain: 1, halo: 1.5, speedLimitKmh: null },
};

const FOG_TINT_DAY = new THREE.Color('#c8ccc9');
const FOG_TINT_NIGHT = new THREE.Color('#1d222c');
const RAIN_TINT_DAY = new THREE.Color('#8f979e');
const RAIN_TINT_NIGHT = new THREE.Color('#151a22');

/** Target environment for a time/weather choice. `qualityFogFar` = the preset's view distance. */
export function computeEnvironment(timeKey, weatherKey, qualityFogFar = 1500) {
  const t = TIME_OF_DAY[timeKey] ?? TIME_OF_DAY.noon;
  const w = WEATHER[weatherKey] ?? WEATHER.clear;
  const horizon = new THREE.Color(t.horizon);
  const zenith = new THREE.Color(t.zenith);
  const tint = weatherKey === 'rain' ? RAIN_TINT_DAY.clone().lerp(RAIN_TINT_NIGHT, t.night) : FOG_TINT_DAY.clone().lerp(FOG_TINT_NIGHT, t.night);
  // Haze pulls the whole sky towards the fog colour
  horizon.lerp(tint, w.haze);
  zenith.lerp(tint, w.haze * 0.9);
  const fogFar = Math.min(qualityFogFar, w.fogFar);
  return {
    timeKey,
    weatherKey,
    sunDir: t.sunDir.clone(),
    sunColor: new THREE.Color(t.sunColor),
    sunIntensity: t.sunIntensity * w.sunScale,
    hemiSky: new THREE.Color(t.hemiSky).lerp(tint, w.haze * 0.5),
    hemiGround: new THREE.Color(t.hemiGround),
    hemiIntensity: t.hemiIntensity * w.hemiScale,
    horizon,
    zenith,
    fogColor: horizon.clone(),
    fogNear: Math.min(w.fogNear, fogFar * 0.3),
    fogFar,
    sunGlow: new THREE.Color(t.glowColor),
    sunVisible: 1 - w.haze,
    night: t.night,
    lamps: Math.max(t.lamps, w.haze > 0.5 ? 0.6 : 0), // lamps come on in fog/rain too
    exposure: t.exposure,
    stars: t.stars * (1 - w.haze),
    envIntensity: t.envIntensity * (1 - w.haze * 0.4),
    rain: w.rain,
    halo: w.halo,
    speedLimitKmh: w.speedLimitKmh,
  };
}

// ---------------------------------------------------------------- live state
/** Current (blended) environment. Replaced in place by the controller. */
export const envState = computeEnvironment('noon', 'clear');
envState.lightning = 0; // 0..1 flash, set by the rain system

const listeners = new Set();

/** Subscribe to environment changes. Called immediately, then on every change. Returns unsubscribe. */
export function onEnvironmentChange(cb) {
  listeners.add(cb);
  cb(envState);
  return () => listeners.delete(cb);
}

export function notifyEnvironment() {
  for (const cb of listeners) cb(envState);
}

const lerp = (a, b, k) => a + (b - a) * k;

/** Blend envState towards target by factor k (0..1). Returns true if anything is still changing. */
export function blendEnvironment(target, k) {
  let moving = false;
  const num = (key) => {
    const from = envState[key];
    const to = target[key];
    if (!Number.isFinite(to)) {
      envState[key] = to;
      return;
    }
    const next = lerp(from, to, k);
    if (Math.abs(next - to) > 1e-3 * Math.max(1, Math.abs(to))) moving = true;
    envState[key] = Math.abs(next - to) < 1e-4 ? to : next;
  };
  const col = (key) => {
    envState[key].lerp(target[key], k);
    const c = envState[key];
    const d = Math.abs(c.r - target[key].r) + Math.abs(c.g - target[key].g) + Math.abs(c.b - target[key].b);
    if (d > 2e-3) moving = true;
  };
  for (const key of ['sunIntensity', 'hemiIntensity', 'fogNear', 'fogFar', 'sunVisible', 'night', 'lamps', 'exposure', 'stars', 'envIntensity', 'rain', 'halo'])
    num(key);
  for (const key of ['sunColor', 'hemiSky', 'hemiGround', 'horizon', 'zenith', 'fogColor', 'sunGlow']) col(key);
  envState.sunDir.lerp(target.sunDir, k).normalize();
  if (envState.sunDir.distanceTo(target.sunDir) > 1e-3) moving = true;
  envState.timeKey = target.timeKey;
  envState.weatherKey = target.weatherKey;
  envState.speedLimitKmh = target.speedLimitKmh;
  return moving;
}

/** Snap instantly (first frame, or when a new journey starts). */
export function snapEnvironment(target) {
  blendEnvironment(target, 1);
}

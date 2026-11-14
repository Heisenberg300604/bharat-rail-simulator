// The game's sound files and mix levels. Licences and sources for every file:
// docs/ASSET_CREDITS.md, public/assets/audio/rail/CREDITS.md and
// public/assets/audio/ambience/CREDITS.md.
//
// Rail recordings (rolling beds per speed band, single wheel-over-joint
// impacts, turnouts, squeal, loco sounds) are DISCOVERED from
// rail/sounds.json at runtime, so adding a recording needs no code change:
// the engine groups files by name prefix (roll-ext-*, roll-int-*, joint-ext-*,
// joint-int-*, turnout-*, squeal-*, brake-squeal-*, loco-*) and reads each
// bed's recordedSpeedKmh for pitch mapping. Anything missing falls back to a
// synthesized version.
const A = `${import.meta.env.BASE_URL}assets/audio/`;

export const AUDIO_BASE = A;

export const RAIL_INDEX_URL = `${A}rail/sounds.json`;

/** Horn library: player horns (high/low tone) and distant horns, with loop points. */
export const HORN_INDEX_URL = `${A}horns/horns.json`;

/** Fixed files (always the same name). */
export const AUDIO_FILES = {
  horn: `${A}horn-india.mp3`,
  brakeRelease: `${A}brake-release.mp3`,
  station: `${A}station-new-delhi.mp3`,
  announcement: `${A}announcement-india.mp3`,
  passby: `${A}train-passby-india.mp3`,
  // ambience (see ambience/CREDITS.md)
  birds: `${A}ambience/day-birds.mp3`,
  insects: `${A}ambience/night-insects.mp3`,
  rain: `${A}ambience/rain-loop.mp3`,
  rainRoof: `${A}ambience/rain-roof.mp3`,
  thunder1: `${A}ambience/thunder-1.mp3`,
  thunder2: `${A}ambience/thunder-2.mp3`,
  traffic: `${A}ambience/road-traffic.mp3`,
  honk1: `${A}ambience/honk-1.mp3`,
  honk2: `${A}ambience/honk-2.mp3`,
  honk3: `${A}ambience/honk-3.mp3`,
  honk4: `${A}ambience/honk-4.mp3`,
  honk5: `${A}ambience/honk-5.mp3`,
  honk6: `${A}ambience/honk-6.mp3`,
  lcBell: `${A}ambience/lc-bell.mp3`,
  guardWhistle: `${A}ambience/guard-whistle-long.mp3`,
  stationBusy1: `${A}ambience/station-busy-1.mp3`,
  stationBusy2: `${A}ambience/station-busy-2.mp3`,
  click1: `${A}ambience/cab-click-1.mp3`,
  click2: `${A}ambience/cab-click-2.mp3`,
  click3: `${A}ambience/cab-click-3.mp3`,
  click4: `${A}ambience/cab-click-4.mp3`,
  buzzer: `${A}ambience/buzzer.mp3`,
  wind: `${A}ambience/wind-loop.mp3`,
  kids: `${A}ambience/kids-wave.mp3`,
};

/** Files that are loops (get a seamless crossfaded loop built at load time). */
export const LOOPED = new Set(['birds', 'insects', 'rain', 'rainRoof', 'traffic', 'lcBell', 'stationBusy1', 'stationBusy2', 'station', 'wind', 'buzzer']);

export const MIX = {
  master: 1.0,
  rolling: 0.9, // rolling bed at full speed
  joint: 0.85, // a single wheel-over-joint impact right under the listener
  frog: 1.6, // turnout crossing nose (relative to joint)
  heel: 1.15,
  lc: 1.25,
  squeal: 0.22,
  brakeSqueal: 0.32,
  horn: 0.75,
  hornSynth: 0.3,
  brakeRelease: 0.6,
  brakeHiss: 0.1,
  announcement: 0.75,
  passby: 1.0,
  aiRoll: 0.55, // D4: the opposing train's rolling noise (Doppler-shifted moving source)
  hum: 0.05,
  blower: 0.22,
  inverter: 0.035,
  compressor: 0.16,
  wind: 0.55,
  station: 0.45,
  birds: 0.55,
  insects: 0.5,
  rain: 0.7,
  rainRoof: 0.6,
  traffic: 0.55,
  honk: 0.35,
  lcBell: 0.4,
  thunder: 0.9,
  whistle: 0.55,
  click: 0.35,
  buzzer: 0.9,
  kids: 0.6,
};

// Synth fallback for the horn (three-chime air horn)
export const HORN = { loopStart: 1.5, loopEnd: 6.8, synthFrequencies: [311, 370, 466] };

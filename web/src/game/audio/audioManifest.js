// The game's sounds, their mix levels and their sources.
// Real recordings (from Freesound, licences verified on each page — see
// docs/ASSET_CREDITS.md) are layered with synthesized sounds:
//   recordings: horn, rolling (in-coach), brake release, station ambience
//   synthesized: WAP-7 traction-motor whine, blowers/compressor, wind,
//                rail-joint clicks synced to the train's real speed.
// If a recording fails to load, the synthesized fallback plays instead.
const A = `${import.meta.env.BASE_URL}assets/audio/`;

export const AUDIO_MANIFEST = {
  masterLevel: 1.0, // overall loudness at volume slider = 100%
  horn: {
    url: `${A}horn-india.mp3`,
    level: 0.75,
    loopStart: 1.5, // seconds: steady part of the blast, looped while H is held
    loopEnd: 6.8,
    synthFrequencies: [311, 370, 466],
    synthLevel: 0.3,
  },
  rolling: { url: `${A}rolling-coach-india.mp3`, level: 1.1, synthLevel: 1.4 },
  brakeRelease: { url: `${A}brake-release.mp3`, level: 0.6 },
  station: { url: `${A}station-new-delhi.mp3`, level: 0.5 },
  idle: { level: 0.8 },
  wind: { level: 0.3 },
  motor: { level: 0.08 },
  brakeHiss: { level: 0.12 },
  clack: { level: 0.9 },
};

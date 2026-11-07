// List of the game's sounds and their mix levels.
// All of these are PLACEHOLDERS synthesized in audioEngine.js (no audio files).
// To use a real recording later (e.g. a verified-licence Indian loco horn):
// put the file in public/assets/audio/, record its source & licence in
// docs/ASSET_CREDITS.md, and load it in audioEngine.js with
// fetch() + AudioContext.decodeAudioData().
export const AUDIO_MANIFEST = {
  masterLevel: 0.6, // overall loudness at volume slider = 100%
  horn: { source: 'synth', level: 0.18, frequencies: [311, 370, 466] },
  rolling: { source: 'synth', level: 0.5 },
  wind: { source: 'synth', level: 0.12 },
  motor: { source: 'synth', level: 0.035 },
  brakeHiss: { source: 'synth', level: 0.06 },
  clack: { source: 'synth', level: 0.5 },
};

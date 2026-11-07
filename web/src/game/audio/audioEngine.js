// PLACEHOLDER AUDIO — every sound here is synthesized in code with the
// Web Audio API (no downloaded files), so there are no licensing questions.
// See audioManifest.js for what each sound is and how to replace it later.
//
// Browsers block audio until the user interacts with the page, so init() is
// called from the "Start Journey" button click.
import { AUDIO_MANIFEST } from './audioManifest.js';

const RAIL_LENGTH = 13; // metres between rail joints ("clickety-clack")
const AXLE_PAIR_GAP = 2.5; // metres between the two axles of a bogie

function makeNoiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function makeClackBuffer(ctx) {
  const len = Math.floor(ctx.sampleRate * 0.09);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const t = i / len;
    data[i] = (Math.random() * 2 - 1) * Math.exp(-t * 9) + Math.sin(i * 0.05) * Math.exp(-t * 6) * 0.6;
  }
  return buffer;
}

class AudioEngine {
  ctx = null;
  ready = false;
  lastJointDistance = 0;
  hornOn = false;
  lastBrake = 0;

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // very old browser: play silently
    const ctx = (this.ctx = new Ctx());
    const m = AUDIO_MANIFEST;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    // Gentle limiter so nothing ever clips or blasts the player.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 8;
    this.master.connect(limiter).connect(ctx.destination);

    const noise = makeNoiseBuffer(ctx, 2);
    const loopNoise = () => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      src.start();
      return src;
    };

    // Rolling rumble: low-passed noise, louder & brighter with speed.
    this.rollFilter = ctx.createBiquadFilter();
    this.rollFilter.type = 'lowpass';
    this.rollFilter.frequency.value = 150;
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    loopNoise().connect(this.rollFilter).connect(this.rollGain).connect(this.master);

    // Wind: band-passed noise, grows with speed².
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 900;
    windFilter.Q.value = 0.4;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    loopNoise().connect(windFilter).connect(this.windGain).connect(this.master);

    // Traction motor whine (electric locomotive): pitch follows speed.
    this.motorOsc = ctx.createOscillator();
    this.motorOsc.type = 'sawtooth';
    this.motorOsc.frequency.value = 60;
    const motorFilter = ctx.createBiquadFilter();
    motorFilter.type = 'lowpass';
    motorFilter.frequency.value = 700;
    this.motorGain = ctx.createGain();
    this.motorGain.gain.value = 0;
    this.motorOsc.connect(motorFilter).connect(this.motorGain).connect(this.master);
    this.motorOsc.start();

    // Brake air hiss: high-passed noise, on while brake is being applied/released.
    const hissFilter = ctx.createBiquadFilter();
    hissFilter.type = 'highpass';
    hissFilter.frequency.value = 2500;
    this.hissGain = ctx.createGain();
    this.hissGain.gain.value = 0;
    loopNoise().connect(hissFilter).connect(this.hissGain).connect(this.master);

    // Horn: chord of detuned sawtooth oscillators through a low-pass filter.
    this.hornGain = ctx.createGain();
    this.hornGain.gain.value = 0;
    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 2200;
    hornFilter.connect(this.hornGain).connect(this.master);
    for (const f of m.horn.frequencies) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(hornFilter);
      osc.start();
    }

    this.clackBuffer = makeClackBuffer(ctx);
    this.clackFilter = ctx.createBiquadFilter();
    this.clackFilter.type = 'lowpass';
    this.clackFilter.frequency.value = 1200;
    this.clackFilter.connect(this.master);

    this.ready = true;
  }

  setVolume(volume, muted) {
    if (!this.ready) return;
    const target = muted ? 0 : volume * AUDIO_MANIFEST.masterLevel;
    this.master.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
  }

  setPaused(paused) {
    if (!this.ready) return;
    if (paused) this.ctx.suspend();
    else this.ctx.resume();
  }

  playClack(when, level) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.clackBuffer;
    const g = this.ctx.createGain();
    g.gain.value = level;
    src.connect(g).connect(this.clackFilter);
    src.start(when);
  }

  /** Called every frame with the current game state. Cheap: only sets targets. */
  update(train, input, maxSpeedMps) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const m = AUDIO_MANIFEST;
    const v = train.speedMps;
    const r = Math.min(v / maxSpeedMps, 1);
    const moving = v > 0.2 ? 1 : 0;
    const smooth = 0.15;

    this.rollGain.gain.setTargetAtTime(moving * m.rolling.level * (0.25 + 0.75 * r), now, smooth);
    this.rollFilter.frequency.setTargetAtTime(150 + 650 * r, now, smooth);
    this.windGain.gain.setTargetAtTime(m.wind.level * r * r, now, smooth);
    this.motorOsc.frequency.setTargetAtTime(55 + 260 * r, now, smooth);
    this.motorGain.gain.setTargetAtTime(m.motor.level * train.throttle * (0.4 + 0.6 * r), now, smooth);

    // Brake hiss while the handle is moving.
    const brakeMoving = Math.abs(train.brake - this.lastBrake) > 1e-4;
    this.lastBrake = train.brake;
    this.hissGain.gain.setTargetAtTime(brakeMoving ? m.brakeHiss.level : 0, now, brakeMoving ? 0.05 : 0.3);

    // Horn: quick attack, short release.
    if (input.horn !== this.hornOn) {
      this.hornOn = input.horn;
      this.hornGain.gain.setTargetAtTime(input.horn ? m.horn.level : 0, now, input.horn ? 0.03 : 0.12);
    }

    // Rail-joint clacks: two clicks (one per axle of a bogie) every rail length.
    const d = train.distanceTravelled;
    if (d < this.lastJointDistance) this.lastJointDistance = d; // journey restarted
    if (d - this.lastJointDistance >= RAIL_LENGTH) {
      this.lastJointDistance = d;
      if (v > 1) {
        const level = m.clack.level * Math.min(1, v / 15);
        this.playClack(now, level);
        this.playClack(now + AXLE_PAIR_GAP / v, level * 0.8);
      }
    }
  }
}

export const audioEngine = new AudioEngine();

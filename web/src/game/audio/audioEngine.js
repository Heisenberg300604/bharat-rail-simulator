// Game audio (Web Audio API). Real Indian Railways recordings are loaded in the
// background after the Start click; until they arrive (or if they fail), the
// synthesized versions play. See audioManifest.js for the sound list.
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
  buffers = {};
  hornSource = null;
  lastReleaseSound = -10;

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
    this.rollFilter.type = 'bandpass'; // mid band: audible on laptop speakers too
    this.rollFilter.frequency.value = 300;
    this.rollFilter.Q.value = 0.7;
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

    // Idle: traction-motor blowers + compressor hum, audible even at a standstill.
    const blowerFilter = ctx.createBiquadFilter();
    blowerFilter.type = 'bandpass';
    blowerFilter.frequency.value = 520;
    blowerFilter.Q.value = 1.2;
    this.idleGain = ctx.createGain();
    this.idleGain.gain.value = 0;
    loopNoise().connect(blowerFilter).connect(this.idleGain).connect(this.master);
    const hum = ctx.createOscillator();
    hum.type = 'sawtooth';
    hum.frequency.value = 100; // mains-frequency transformer hum harmonic
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 500;
    const humGain = ctx.createGain();
    humGain.gain.value = 0.25;
    hum.connect(humFilter).connect(humGain).connect(this.idleGain);
    hum.start();

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
    for (const f of m.horn.synthFrequencies) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(hornFilter);
      osc.start();
    }

    this.clackBuffer = makeClackBuffer(ctx);
    this.clackFilter = ctx.createBiquadFilter();
    this.clackFilter.type = 'lowpass';
    this.clackFilter.frequency.value = 2600;
    this.clackFilter.connect(this.master);

    // Bus for recorded samples
    this.rollSampleGain = ctx.createGain();
    this.rollSampleGain.gain.value = 0;
    this.rollSampleGain.connect(this.master);
    this.stationGain = ctx.createGain();
    this.stationGain.gain.value = 0;
    this.stationGain.connect(this.master);

    this.ready = true;
    this.burstHiss(); // audible confirmation that sound is working
    this.loadSamples();
  }

  /** Fetch + decode the recordings without blocking the game. */
  async loadSamples() {
    const entries = Object.entries(AUDIO_MANIFEST).filter(([, v]) => v && v.url);
    await Promise.all(
      entries.map(async ([key, def]) => {
        try {
          const res = await fetch(def.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          this.buffers[key] = await this.ctx.decodeAudioData(await res.arrayBuffer());
        } catch (err) {
          console.warn(`Audio "${key}" unavailable, using synthesized fallback:`, err.message);
        }
      }),
    );
    // Start the looping beds once their recordings are available
    if (this.buffers.rolling) this.startLoop(this.buffers.rolling, this.rollSampleGain, (src) => (this.rollSource = src));
    if (this.buffers.station) this.startLoop(this.buffers.station, this.stationGain);
  }

  startLoop(buffer, destination, keep) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // skip MP3 encoder padding at both ends so the loop point is seamless
    src.loopStart = 0.03;
    src.loopEnd = buffer.duration - 0.06;
    src.connect(destination);
    src.start(0, 0.03);
    keep?.(src);
  }

  playOneShot(buffer, level) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const g = this.ctx.createGain();
    g.gain.value = level;
    src.connect(g).connect(this.master);
    src.start();
  }

  hornStart(now) {
    const h = AUDIO_MANIFEST.horn;
    if (!this.buffers.horn) {
      this.hornGain.gain.setTargetAtTime(h.synthLevel, now, 0.03);
      return;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.horn;
    src.loop = true; // the steady middle loops for as long as H is held
    src.loopStart = h.loopStart;
    src.loopEnd = h.loopEnd;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(h.level, now + 0.06);
    src.connect(g).connect(this.master);
    src.start(now);
    this.hornSource = { src, g };
  }

  hornStop(now) {
    this.hornGain.gain.setTargetAtTime(0, now, 0.12);
    if (this.hornSource) {
      const { src, g } = this.hornSource;
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.setTargetAtTime(0, now, 0.1);
      src.stop(now + 0.7);
      this.hornSource = null;
    }
  }

  /** Short "pssh" of air (brake release), also played when the journey starts. */
  burstHiss() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    this.hissGain.gain.cancelScheduledValues(now);
    this.hissGain.gain.setValueAtTime(AUDIO_MANIFEST.brakeHiss.level * 2.5, now);
    this.hissGain.gain.setTargetAtTime(0, now + 0.3, 0.35);
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
  update(train, input, maxSpeedMps, env = {}) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const m = AUDIO_MANIFEST;
    const v = train.speedMps;
    const r = Math.min(v / maxSpeedMps, 1);
    const moving = v > 0.2 ? 1 : 0;
    const smooth = 0.15;

    // Rolling: the real in-coach recording (pitch and level follow speed);
    // the synthesized rumble only fills in until it has loaded.
    const hasRoll = !!this.buffers.rolling;
    this.rollGain.gain.setTargetAtTime(moving * m.rolling.synthLevel * (hasRoll ? 0.25 : 1) * (0.25 + 0.75 * r), now, smooth);
    this.rollFilter.frequency.setTargetAtTime(300 + 900 * r, now, smooth);
    if (hasRoll) {
      const level = v > 0.2 ? m.rolling.level * Math.min(1, 0.12 + 1.1 * Math.sqrt(r)) : 0;
      this.rollSampleGain.gain.setTargetAtTime(level, now, 0.25);
      this.rollSource?.playbackRate.setTargetAtTime(0.7 + 0.45 * r, now, 0.3);
    }
    // Station ambience fades in near the platforms
    this.stationGain.gain.setTargetAtTime(m.station.level * (env.stationProximity ?? 0), now, 0.6);
    this.windGain.gain.setTargetAtTime(m.wind.level * r * r, now, smooth);
    this.idleGain.gain.setTargetAtTime(m.idle.level * (1 + 0.6 * train.throttle), now, 0.4);
    this.motorOsc.frequency.setTargetAtTime(55 + 260 * r, now, smooth);
    this.motorGain.gain.setTargetAtTime(m.motor.level * train.throttle * (0.4 + 0.6 * r), now, smooth);

    // Brake hiss while the handle is moving; real air-release "pssh" on release.
    const brakeMoving = Math.abs(train.brake - this.lastBrake) > 1e-4;
    const releasing = train.brake < this.lastBrake - 1e-4;
    if (releasing && this.buffers.brakeRelease && now - this.lastReleaseSound > 4) {
      this.playOneShot(this.buffers.brakeRelease, m.brakeRelease.level);
      this.lastReleaseSound = now;
    }
    this.lastBrake = train.brake;
    this.hissGain.gain.setTargetAtTime(brakeMoving ? m.brakeHiss.level : 0, now, brakeMoving ? 0.05 : 0.3);

    // Horn: quick attack, short release.
    if (input.horn !== this.hornOn) {
      this.hornOn = input.horn;
      if (input.horn) this.hornStart(now);
      else this.hornStop(now);
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

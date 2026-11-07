// Game audio (Web Audio API). Real Indian Railways recordings are loaded in the
// background after the Start click; until they arrive (or if they fail), the
// synthesized versions play. See audioManifest.js for the sound list.
//
// Browsers block audio until the user interacts with the page, so init() is
// called from the "Start Journey" button click.
import { AUDIO_MANIFEST } from './audioManifest.js';

const RAIL_LENGTH = 13; // metres between broad-gauge rail joints (RDSO 13 m standard)
const ICF_BOGIE_WHEELBASE = 2.896; // metres between axles in an ICF bogie
const ICF_BOGIE_CENTRES = 14.783; // metres between the two bogie pivots of an ICF coach

function makeNoiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Authentic Indian Railways broad-gauge rail joint impact buffer.
 * Synthesizes the distinctive multi-layered acoustic signature:
 *  1. Sharp steel-on-steel expansion gap impact transient (1800-2400 Hz)
 *  2. Broad-gauge steel railhead & wheel-rim resonant ringing (500-600 Hz)
 *  3. Heavy sleeper & ballast low-frequency punch (85-110 Hz)
 *  4. Ballast scatter / underframe vibration
 */
function makeAuthenticIndianRailClackBuffer(ctx, variant = 0) {
  const len = Math.floor(ctx.sampleRate * 0.22);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buffer.getChannelData(0);

  const baseFreq = [560, 510, 580, 490][variant % 4];
  const ringFreq = [1900, 2150, 1800, 2250][variant % 4];
  const thudFreq = [95, 88, 98, 84][variant % 4];

  for (let i = 0; i < len; i++) {
    const t = i / ctx.sampleRate;
    // 1. Sharp metallic impact transient
    const snap = (Math.random() * 2 - 1) * Math.exp(-t * 90);
    // 2. High metallic wheel rim ping
    const ring = Math.sin(2 * Math.PI * ringFreq * t) * Math.exp(-t * 48) * 0.45;
    // 3. Steel rail structural harmonic
    const rail = Math.sin(2 * Math.PI * baseFreq * t) * Math.exp(-t * 26) * 0.65;
    // 4. Heavy sleeper / ballast low punch
    const thud = Math.sin(2 * Math.PI * (thudFreq - 30 * t) * t) * Math.exp(-t * 34) * 0.85;
    // 5. Ballast gravel rattle
    const rattle = (Math.random() * 2 - 1) * Math.sin(2 * Math.PI * 450 * t) * Math.exp(-t * 22) * 0.25;

    data[i] = snap * 0.75 + ring + rail + thud + rattle;
  }
  return buffer;
}

function makeClackBuffer(ctx) {
  return makeAuthenticIndianRailClackBuffer(ctx, 0);
}

class AudioEngine {
  ctx = null;
  ready = false;
  lastJointDistance = 0;
  hornOn = false;
  lastBrake = 0;
  buffers = {};
  hornSource = null;
  announcementSource = null;
  lastReleaseSound = -10;
  lastAnnouncementTime = -100;
  lastPassbyTime = -100;
  lastAiHornTime = -100;
  jointBuffers = [];

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
    this.rollFilter.type = 'bandpass';
    this.rollFilter.frequency.value = 300;
    this.rollFilter.Q.value = 0.7;
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    loopNoise().connect(this.rollFilter).connect(this.rollGain).connect(this.master);

    // Continuous wheel-on-rail track friction roar (classic Indian Railways track sound)
    this.trackRoarFilter = ctx.createBiquadFilter();
    this.trackRoarFilter.type = 'bandpass';
    this.trackRoarFilter.frequency.value = 460;
    this.trackRoarFilter.Q.value = 0.85;
    this.trackRoarGain = ctx.createGain();
    this.trackRoarGain.gain.value = 0;
    loopNoise().connect(this.trackRoarFilter).connect(this.trackRoarGain).connect(this.master);

    // Coach suspension creak & interior body movement rumble
    this.coachRattleFilter = ctx.createBiquadFilter();
    this.coachRattleFilter.type = 'lowpass';
    this.coachRattleFilter.frequency.value = 320;
    this.coachRattleGain = ctx.createGain();
    this.coachRattleGain.gain.value = 0;
    loopNoise().connect(this.coachRattleFilter).connect(this.coachRattleGain).connect(this.master);

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

    // Bank of authentic broad-gauge rail-joint impact buffers (4 variants for 4 axles)
    this.jointBuffers = [0, 1, 2, 3].map((v) => makeAuthenticIndianRailClackBuffer(ctx, v));
    this.clackBuffer = this.jointBuffers[0];
    this.clackFilter = ctx.createBiquadFilter();
    this.clackFilter.type = 'lowpass';
    this.clackFilter.frequency.value = 3200;
    this.clackFilter.connect(this.master);

    // Bus for recorded samples
    this.rollSampleGain = ctx.createGain();
    this.rollSampleGain.gain.value = 0;
    this.rollSampleGain.connect(this.master);
    this.stationGain = ctx.createGain();
    this.stationGain.gain.value = 0;
    this.stationGain.connect(this.master);

    // Dedicated bus for platform announcement so it fades smoothly as train departs
    this.announcementGain = ctx.createGain();
    this.announcementGain.gain.value = 0;
    this.announcementGain.connect(this.master);

    // Dedicated buses for authentic ICF and LHB track recordings
    this.icfTrackGain = ctx.createGain();
    this.icfTrackGain.gain.value = 0;
    this.icfTrackGain.connect(this.master);

    this.lhbTrackGain = ctx.createGain();
    this.lhbTrackGain.gain.value = 0;
    this.lhbTrackGain.connect(this.master);

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
    if (this.buffers.icfTrack) this.startLoop(this.buffers.icfTrack, this.icfTrackGain, (src) => (this.icfSource = src));
    if (this.buffers.lhbTrack) this.startLoop(this.buffers.lhbTrack, this.lhbTrackGain, (src) => (this.lhbSource = src));

    // Update joint impact buffers with real recordings when loaded
    for (let i = 0; i < 4; i++) {
      if (this.buffers[`clack${i}`]) {
        this.jointBuffers[i] = this.buffers[`clack${i}`];
      }
    }
    if (this.jointBuffers[0]) this.clackBuffer = this.jointBuffers[0];
  }

  startLoop(buffer, destination, keep) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
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
    src.loop = true;
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

  playAiHorn() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this.lastAiHornTime < 10) return;
    this.lastAiHornTime = now;

    if (this.buffers.horn) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.horn;
      src.playbackRate.value = 1.06;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.65, now + 0.08);
      g.gain.setValueAtTime(0.65, now + 1.2);
      g.gain.linearRampToValueAtTime(0, now + 1.8);
      src.connect(g).connect(this.master);
      src.start(now);
      src.stop(now + 1.9);
    }
  }

  playPassby() {
    if (!this.ready || !this.buffers.passby) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPassbyTime < 12) return;
    this.lastPassbyTime = now;
    this.playOneShot(this.buffers.passby, AUDIO_MANIFEST.passby.level);
  }

  /**
   * Plays the platform arrival/departure announcement. Routed through
   * announcementGain so it automatically fades away as the train departs.
   */
  playAnnouncement() {
    if (!this.ready || !this.buffers.announcement) return;
    const now = this.ctx.currentTime;
    if (now - this.lastAnnouncementTime < 45) return;
    this.lastAnnouncementTime = now;
    if (this.announcementSource) {
      try {
        this.announcementSource.stop();
      } catch {
        /* already ended */
      }
      this.announcementSource = null;
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.announcement;
    src.connect(this.announcementGain);
    src.start();
    this.announcementSource = src;
  }

  /**
   * Play an authentic broad-gauge rail-joint clack for a specific axle.
   */
  playJointClack(when, level, variant = 0) {
    if (!this.ready) return;
    const buf = this.jointBuffers?.[variant % 4] || this.clackBuffer;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + (variant % 3) * 0.05 + Math.random() * 0.04;
    const g = this.ctx.createGain();
    g.gain.value = level;
    src.connect(g).connect(this.clackFilter);
    src.start(when);
  }

  /**
   * Legacy playClack compatibility helper.
   */
  playClack(when, level) {
    this.playJointClack(when, level, 0);
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
    const isInterior = env.cameraMode === 'interior';

    if (env.passingAiTrain) {
      this.playPassby();
    }
    if ((env.stationProximity ?? 0) > 0.65 && v < 12) {
      this.playAnnouncement();
    }

    // 1. Platform Announcement: fades out smoothly as train leaves the station platform
    const stationProx = env.stationProximity ?? 0;
    const announceVol = stationProx > 0.04 ? m.announcement.level * Math.pow(stationProx, 1.8) : 0;
    this.announcementGain.gain.setTargetAtTime(announceVol, now, 0.25);
    if (stationProx <= 0.02 && this.announcementSource) {
      try {
        this.announcementSource.stop();
      } catch {
        /* already ended */
      }
      this.announcementSource = null;
    }

    // 2. Continuous ICF Wheel-on-Rail Track Roar
    const trackRoarLevel = moving * (0.18 + 0.82 * r) * (isInterior ? 0.95 : 0.65);
    this.trackRoarGain.gain.setTargetAtTime(trackRoarLevel, now, smooth);
    this.trackRoarFilter.frequency.setTargetAtTime(380 + 520 * r, now, smooth);

    // 3. Coach Movement & Interior Cabin Suspension Rumble (boosted inside coach)
    const coachRattleLevel = moving * (0.12 + 0.88 * Math.sqrt(r)) * (isInterior ? 0.85 : 0.32);
    this.coachRattleGain.gain.setTargetAtTime(coachRattleLevel, now, smooth);
    this.coachRattleFilter.frequency.setTargetAtTime(220 + 260 * r, now, smooth);

    // 4. Authentic Coach Track Recording (ICF vs LHB)
    const isIcf = env.coachLivery === 'icfBlue';
    const hasRoll = !!this.buffers.rolling;
    const rollBoost = isInterior ? 2.0 : 1.0;
    this.rollGain.gain.setTargetAtTime(moving * m.rolling.synthLevel * (hasRoll ? 0.25 : 1) * (0.25 + 0.75 * r) * rollBoost, now, smooth);
    this.rollFilter.frequency.setTargetAtTime(300 + 900 * r, now, smooth);

    if (this.buffers.icfTrack && isIcf) {
      const level = moving ? m.icfTrack.level * Math.min(1.25, 0.18 + 0.82 * r) * (isInterior ? 1.6 : 0.95) : 0;
      this.icfTrackGain.gain.setTargetAtTime(level, now, 0.2);
      this.icfSource?.playbackRate.setTargetAtTime(0.72 + 0.45 * r, now, 0.25);
      this.lhbTrackGain.gain.setTargetAtTime(0, now, 0.2);
      this.rollSampleGain.gain.setTargetAtTime(0, now, 0.2);
    } else if (this.buffers.lhbTrack && !isIcf) {
      const level = moving ? m.lhbTrack.level * Math.min(1.15, 0.18 + 0.82 * r) * (isInterior ? 1.4 : 0.9) : 0;
      this.lhbTrackGain.gain.setTargetAtTime(level, now, 0.2);
      this.lhbSource?.playbackRate.setTargetAtTime(0.75 + 0.42 * r, now, 0.25);
      this.icfTrackGain.gain.setTargetAtTime(0, now, 0.2);
      this.rollSampleGain.gain.setTargetAtTime(0, now, 0.2);
    } else if (hasRoll) {
      const level = v > 0.2 ? m.rolling.level * Math.min(1, 0.15 + 1.15 * Math.sqrt(r)) * rollBoost : 0;
      this.rollSampleGain.gain.setTargetAtTime(level, now, 0.25);
      this.rollSource?.playbackRate.setTargetAtTime(0.72 + 0.45 * r, now, 0.3);
    }

    // Station ambience fades in near the platforms
    this.stationGain.gain.setTargetAtTime(m.station.level * stationProx, now, 0.6);
    this.windGain.gain.setTargetAtTime(m.wind.level * r * r * (isInterior ? 0.65 : 1), now, smooth);

    // In interior coach view, locomotive sounds are naturally subdued by distance
    const locoDistAtten = isInterior ? 0.28 : 1.0;
    this.idleGain.gain.setTargetAtTime(m.idle.level * (1 + 0.6 * train.throttle) * locoDistAtten, now, 0.4);
    this.motorOsc.frequency.setTargetAtTime(55 + 260 * r, now, smooth);
    this.motorGain.gain.setTargetAtTime(m.motor.level * train.throttle * (0.4 + 0.6 * r) * locoDistAtten, now, smooth);

    // Brake hiss while handle is moving; air-release "pssh" on release
    const brakeMoving = Math.abs(train.brake - this.lastBrake) > 1e-4;
    const releasing = train.brake < this.lastBrake - 1e-4;
    if (releasing && this.buffers.brakeRelease && now - this.lastReleaseSound > 4) {
      this.playOneShot(this.buffers.brakeRelease, m.brakeRelease.level);
      this.lastReleaseSound = now;
    }
    this.lastBrake = train.brake;
    this.hissGain.gain.setTargetAtTime(brakeMoving ? m.brakeHiss.level : 0, now, brakeMoving ? 0.05 : 0.3);

    // Horn
    if (input.horn !== this.hornOn) {
      this.hornOn = input.horn;
      if (input.horn) this.hornStart(now);
      else this.hornStop(now);
    }

    // 5. Authentic Indian Railways ICF Bogie Cadence ("TA-dak ... TA-dak") on rail joints
    const d = train.distanceTravelled;
    if (d < this.lastJointDistance) this.lastJointDistance = d; // journey restarted
    if (d - this.lastJointDistance >= RAIL_LENGTH) {
      this.lastJointDistance = d;
      if (v > 0.8) {
        const level = m.clack.level * Math.min(1.25, 0.35 + 0.65 * (v / 18)) * (isInterior ? 1.55 : 1.0);
        const bogieAxleGap = ICF_BOGIE_WHEELBASE / v;
        const bogieSpan = ICF_BOGIE_CENTRES / v;

        // Front bogie: axle 1, then axle 2 ("TA-dak")
        this.playJointClack(now, level, 0);
        this.playJointClack(now + bogieAxleGap, level * 0.9, 1);

        // Rear bogie: axle 3, then axle 4 ("TA-dak")
        if (bogieSpan < 2.2) {
          this.playJointClack(now + bogieSpan, level * 0.95, 2);
          this.playJointClack(now + bogieSpan + bogieAxleGap, level * 0.85, 3);
        }
      }
    }
  }
}

export const audioEngine = new AudioEngine();

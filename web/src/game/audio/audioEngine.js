// Game audio (Web Audio API).
//
// How the train sound is built (and why it no longer sounds "cringe"):
//   1. ROLLING BEDS — steady wheel-on-rail recordings, one per speed band
//      (exterior and in-coach sets). They are crossfaded by speed with only a
//      small pitch change (±15 %), instead of one clip stretched 0.7–1.2× and
//      buried under white noise.
//   2. JOINT IMPACTS — every axle of the train is tracked against every rail
//      joint (railAcoustics.js). Each impact is scheduled on the audio clock a
//      few ms ahead, so the rhythm is sample-accurate: the loco's Co-Co bogies
//      go "da-da-dak", each LHB/ICF bogie "da-dak", joints far down the train
//      are quieter and later, turnouts give a heavy "clank", long-welded-rail
//      stretches go quiet apart from the odd joint.
//   3. PERSPECTIVE — cab, coach interior (AC LHB sealed vs. ICF open windows)
//      and outside views each get their own balance and muffling, and outside
//      the impacts are panned and delayed by their real distance.
//   4. LOCO — transformer hum, traction-motor blowers, compressor and the
//      three-phase converter's stepping "song" (railAcoustics.inverterTone).
//   5. WORLD — birds by day, crickets at night, rain, road traffic and horns,
//      the level-crossing bell, stations, thunder, waving kids, guard whistle.
// Recordings load in the background after the Start click; anything that is
// missing falls back to a synthesized version so the game is never silent.
import { AUDIO_FILES, LOOPED, MIX, HORN, RAIL_INDEX_URL, HORN_INDEX_URL, AUDIO_BASE } from './audioManifest.js';
import { trainAxles, nextJoint, specialJoints, timeToJoint, inverterTone, bandWeights, RAIL_JOINTS } from './railAcoustics.js';
import { onRouteChange } from '../routes/activeRoute.js';

let SPECIALS = [];
onRouteChange(() => {
  SPECIALS = specialJoints(RAIL_JOINTS);
});
const MIX_SEA = 0.5;
const SPEED_OF_SOUND = 343;
const LOOKAHEAD = 0.14; // s: schedule joint impacts this far ahead
const MAX_VOICES = 48;
const RAIL_TOP = 0.66;

// Perspective balance: train = rolling + joints, loco = loco machinery,
// amb = outdoor ambience; lp = low-pass cutoff (muffling by walls/glass).
const PERSPECTIVE = {
  cab: { train: 0.62, trainLp: 4200, loco: 1.0, locoLp: 9000, amb: 0.5, ambLp: 3800, wind: 0.45, roof: 0.8 },
  interiorAc: { train: 0.85, trainLp: 1700, loco: 0.1, locoLp: 900, amb: 0.22, ambLp: 1500, wind: 0.06, roof: 0.6 },
  interiorOpen: { train: 1.05, trainLp: 5200, loco: 0.16, locoLp: 1600, amb: 0.85, ambLp: 9000, wind: 0.75, roof: 0.45 },
  exterior: { train: 1.0, trainLp: 16000, loco: 0.85, locoLp: 16000, amb: 1.0, ambLp: 18000, wind: 0.35, roof: 0 },
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// ------------------------------------------------------------------ helpers
function makeBrownNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    d[i] = last * 3.5;
  }
  return makeSeamless(ctx, buffer, 0.25);
}

function makeWhiteNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buffer;
}

/**
 * Turn any recording into a click-free loop: trim near-silent ends (MP3
 * encoder padding) and equal-power crossfade the tail into the head.
 */
function makeSeamless(ctx, buffer, fadeSeconds = 0.6) {
  const ch = buffer.numberOfChannels;
  const src = buffer.getChannelData(0);
  const thr = 0.0015;
  let a = 0;
  let b = src.length - 1;
  while (a < src.length && Math.abs(src[a]) < thr) a++;
  while (b > a && Math.abs(src[b]) < thr) b--;
  const n = b - a + 1;
  const X = Math.min(Math.floor(fadeSeconds * buffer.sampleRate), Math.floor(n / 3));
  if (n < 2048 || X < 64) return buffer;
  const L = n - X;
  const out = ctx.createBuffer(ch, L, buffer.sampleRate);
  for (let c = 0; c < ch; c++) {
    const s = buffer.getChannelData(c);
    const o = out.getChannelData(c);
    for (let j = 0; j < L; j++) {
      const k = j - (L - X);
      if (k < 0) o[j] = s[a + j + X];
      else {
        const t = k / X;
        o[j] = s[a + j + X] * Math.cos(t * Math.PI * 0.5) + s[a + k] * Math.sin(t * Math.PI * 0.5);
      }
    }
  }
  return out;
}

/** Fallback single wheel-over-joint impact: a hard steel transient + a short sleeper "thud". */
function makeSynthImpact(ctx, variant, heavy = false) {
  const len = Math.floor(ctx.sampleRate * 0.32);
  const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  const sr = ctx.sampleRate;
  const f1 = [620, 560, 690, 590][variant % 4] * (heavy ? 0.8 : 1);
  const f2 = [1480, 1710, 1390, 1620][variant % 4] * (heavy ? 0.85 : 1);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr;
    const n = Math.random() * 2 - 1;
    lp += (n - lp) * 0.35; // softened noise for the impact body
    const crack = lp * Math.exp(-t * 160);
    const ring = (Math.sin(2 * Math.PI * f1 * t) * 0.5 + Math.sin(2 * Math.PI * f2 * t) * 0.22) * Math.exp(-t * 42);
    const thud = Math.sin(2 * Math.PI * (78 - 25 * t) * t) * Math.exp(-t * 26) * (heavy ? 1.3 : 0.95);
    d[i] = (crack * 0.9 + ring * 0.55 + thud) * 0.6;
  }
  return buffer;
}

function rand(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// ------------------------------------------------------------------ engine
class AudioEngine {
  ctx = null;
  ready = false;
  buffers = {};
  rail = { rollExt: [], rollInt: [], jointExt: [], jointInt: [], turnout: [], squeal: null, brakeSqueal: null, locoIdle: null, locoBlower: null, locoCompressor: null };
  voices = 0;
  axles = [];
  axleState = [];
  lastFront = null;
  lastDir = 1;
  coachType = null;
  hornOn = false;
  hornVoice = null;
  horns = {};
  lastBrake = 0;
  lastReleaseSound = -10;
  lastAnnouncementTime = -100;
  lastPassbyTime = -100;
  lastAiHornTime = -100;
  nextHonk = 4;
  lastLever = 0;
  stopClunkArmed = false;
  pulses = 0;
  perspectiveKey = 'exterior';

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return; // very old browser: play silently
    const ctx = (this.ctx = new Ctx({ latencyHint: 'interactive' }));

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 6;
    limiter.ratio.value = 10;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    this.master.connect(limiter).connect(ctx.destination);

    const bus = (lp) => {
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lp;
      f.Q.value = 0.5;
      g.connect(f).connect(this.master);
      return { in: g, gain: g, filter: f };
    };
    this.trainBus = bus(16000);
    this.locoBus = bus(16000);
    this.ambBus = bus(18000);
    this.roofBus = ctx.createGain();
    this.roofBus.connect(this.master);
    // Tunnel echo: the train and loco buses feed a short slap-back delay
    this.echoSend = ctx.createGain();
    this.echoSend.gain.value = 0;
    const echo = ctx.createDelay(0.5);
    echo.delayTime.value = 0.075;
    const echoFb = ctx.createGain();
    echoFb.gain.value = 0.42;
    const echoLp = ctx.createBiquadFilter();
    echoLp.type = 'lowpass';
    echoLp.frequency.value = 2400;
    this.trainBus.filter.connect(this.echoSend);
    this.locoBus.filter.connect(this.echoSend);
    this.echoSend.connect(echo).connect(echoLp).connect(this.master);
    echoLp.connect(echoFb).connect(echo);
    this.uiBus = ctx.createGain();
    this.uiBus.connect(this.master);

    this.brown = makeBrownNoise(ctx, 4);
    this.white = makeWhiteNoise(ctx, 2);

    // Synth rolling fallback (brown noise = rumble, never hiss)
    this.synthRoll = this.loopVoice(this.brown, this.trainBus.in, { filter: 'lowpass', freq: 250 });

    // Sea surf (synthesized): low-passed rumble swelling with slow "waves"
    {
      const src = ctx.createBufferSource();
      src.buffer = this.brown;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 900;
      const wave = ctx.createGain();
      wave.gain.value = 0.55;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.09;
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = 0.45;
      lfo.connect(lfoAmt).connect(wave.gain);
      const level = ctx.createGain();
      level.gain.value = 0;
      src.connect(f).connect(wave).connect(level).connect(this.ambBus.in);
      src.start(0, Math.random() * 3);
      lfo.start();
      this.sea = { gain: level };
    }

    // Loco machinery (synth layers; recordings replace them when available)
    this.hum = ctx.createGain();
    this.hum.gain.value = 0;
    this.hum.connect(this.locoBus.in);
    for (const [f, g] of [
      [100, 0.55],
      [200, 0.3],
      [300, 0.16],
      [400, 0.06],
    ]) {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.hum);
      o.start();
    }
    this.blower = this.loopVoice(this.brown, this.locoBus.in, { filter: 'bandpass', freq: 420, q: 0.7 });
    this.compressor = this.loopVoice(this.brown, this.locoBus.in, { filter: 'lowpass', freq: 220 });
    this.compressorLfo = ctx.createOscillator();
    this.compressorLfo.type = 'square';
    this.compressorLfo.frequency.value = 6.5;
    this.compressorLfoGain = ctx.createGain();
    this.compressorLfoGain.gain.value = 0;
    this.compressorLfo.connect(this.compressorLfoGain).connect(this.compressor.gain.gain);
    this.compressorLfo.start();

    // three-phase converter tone: carrier + two sidebands
    this.inverter = ctx.createGain();
    this.inverter.gain.value = 0;
    const invFilter = ctx.createBiquadFilter();
    invFilter.type = 'bandpass';
    invFilter.frequency.value = 900;
    invFilter.Q.value = 0.4;
    this.inverter.connect(invFilter).connect(this.locoBus.in);
    this.invOsc = [0.55, 0.22, 0.22].map((g) => {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = 200;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.inverter);
      o.start();
      return o;
    });

    // Brake air hiss (A9 exhaust) — high-passed noise
    this.hiss = this.loopVoice(this.white, this.locoBus.in, { filter: 'highpass', freq: 2600 });

    // Squeals (synth fallbacks): flange squeal and brake-block squeal
    this.flange = this.makeSqueal([2850, 4120, 5600]);
    this.brakeSq = this.makeSqueal([1930, 3870]);

    // Horn synth fallback
    this.hornGain = ctx.createGain();
    this.hornGain.gain.value = 0;
    const hornFilter = ctx.createBiquadFilter();
    hornFilter.type = 'lowpass';
    hornFilter.frequency.value = 2200;
    hornFilter.connect(this.hornGain).connect(this.locoBus.in);
    for (const f of HORN.synthFrequencies) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(hornFilter);
      osc.start();
    }

    this.announcementGain = ctx.createGain();
    this.announcementGain.gain.value = 0;
    this.announcementGain.connect(this.ambBus.in);

    this.synthJoints = [0, 1, 2, 3].map((v) => makeSynthImpact(ctx, v));
    this.synthFrog = [0, 1].map((v) => makeSynthImpact(ctx, v, true));

    this.ready = true;
    this.burstHiss();
    this.loadSamples();
  }

  /** A looping source → filter → gain (gain starts at 0). */
  loopVoice(buffer, dest, { filter, freq = 1000, q = 0.7, rate = 1 } = {}) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.playbackRate.value = rate;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    let node = src;
    let f = null;
    if (filter) {
      f = ctx.createBiquadFilter();
      f.type = filter;
      f.frequency.value = freq;
      f.Q.value = q;
      node = node.connect(f);
    }
    node.connect(gain).connect(dest);
    src.start(0, Math.random() * Math.max(0, buffer.duration - 0.1));
    return { src, gain, filter: f };
  }

  makeSqueal(freqs) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(this.trainBus.in);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.3;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 25;
    lfo.connect(lfoGain);
    lfo.start();
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      o.frequency.value = f;
      lfoGain.connect(o.frequency);
      const og = ctx.createGain();
      og.gain.value = 0.5 / (i + 1);
      o.connect(og).connect(g);
      o.start();
    });
    return { gain: g, sample: null };
  }

  async fetchBuffer(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return this.ctx.decodeAudioData(await res.arrayBuffer());
  }

  /** Fetch + decode everything without blocking the game. Rail first (most important). */
  async loadSamples() {
    await Promise.all([this.loadRail(), this.loadHorns()]);
    const entries = Object.entries(AUDIO_FILES);
    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const buf = await this.fetchBuffer(url);
          this.buffers[key] = LOOPED.has(key) ? makeSeamless(this.ctx, buf, key === 'buzzer' ? 0.05 : 0.8) : buf;
        } catch (err) {
          console.warn(`Audio "${key}" unavailable:`, err.message);
        }
      }),
    );
    const b = this.buffers;
    const amb = this.ambBus.in;
    const loop = (key, dest = amb) => (b[key] ? this.loopVoice(b[key], dest) : null);
    this.amb = {
      birds: loop('birds'),
      insects: loop('insects'),
      rain: loop('rain'),
      rainRoof: loop('rainRoof', this.roofBus),
      traffic: loop('traffic'),
      lcBell: loop('lcBell'),
      station: loop('station'),
      stationBusy1: loop('stationBusy1'),
      stationBusy2: loop('stationBusy2'),
      wind: loop('wind', this.trainBus.in),
      buzzer: loop('buzzer', this.uiBus),
    };
  }

  /** Discover the rail recordings from rail/sounds.json (see audioManifest.js). */
  async loadRail() {
    let index = [];
    try {
      const res = await fetch(RAIL_INDEX_URL);
      if (res.ok) index = await res.json();
      if (!Array.isArray(index)) index = index.sounds ?? index.files ?? [];
    } catch {
      index = [];
    }
    const r = this.rail;
    await Promise.all(
      index.map(async (e) => {
        const file = String(e.file || '').replace(/^.*\//, '');
        if (!/\.(mp3|ogg|wav|m4a)$/i.test(file)) return;
        try {
          const buf = await this.fetchBuffer(`${AUDIO_BASE}rail/${file}`);
          const name = file.replace(/\.[^.]+$/, '');
          const speed = Number(e.recordedSpeedKmh) || null;
          if (name.startsWith('roll-ext')) r.rollExt.push({ buffer: makeSeamless(this.ctx, buf, 1.0), speed: speed ?? 70, name });
          else if (name.startsWith('roll-int')) r.rollInt.push({ buffer: makeSeamless(this.ctx, buf, 1.0), speed: speed ?? 70, name });
          else if (name.startsWith('joint-ext')) r.jointExt.push(buf);
          else if (name.startsWith('joint-int')) r.jointInt.push(buf);
          else if (name.startsWith('turnout')) r.turnout.push(buf);
          else if (name.startsWith('brake-squeal')) r.brakeSqueal ??= makeSeamless(this.ctx, buf, 0.3);
          else if (name.startsWith('squeal')) r.squeal ??= makeSeamless(this.ctx, buf, 0.4);
          else if (name.startsWith('passby')) (r.passby ??= []).push({ name, buf });
          else if (name.startsWith('horn-alt-onboard')) this.buffers.hornOnboard = buf;
          else if (/^loco-.*(traction-idle|transformer)/.test(name)) r.locoIdle ??= makeSeamless(this.ctx, buf, 0.6);
          else if (/^loco-.*(aux|blower|fan)/.test(name)) r.locoBlower ??= makeSeamless(this.ctx, buf, 0.6);
          else if (/^loco-.*compressor/.test(name)) r.locoCompressor ??= makeSeamless(this.ctx, buf, 0.4);
        } catch (err) {
          console.warn(`Rail sound "${file}" unavailable:`, err.message);
        }
      }),
    );
    // one bed per speed band (alphabetically first wins a tie, e.g. roll-ext-fast over -fast-b)
    const sortBands = (list) => {
      list.sort((a, b) => a.speed - b.speed || a.name.localeCompare(b.name));
      for (let i = list.length - 1; i > 0; i--) if (list[i].speed === list[i - 1].speed) list.splice(i, 1);
      return list;
    };
    sortBands(r.rollExt);
    sortBands(r.rollInt);
    // Indian passby recordings first
    r.passby?.sort((a, b) => a.name.localeCompare(b.name));
    // one looping voice per bed band, all running, crossfaded by speed
    const mk = (list) => list.map((band) => ({ ...band, voice: this.loopVoice(band.buffer, this.trainBus.in) }));
    this.bedsExt = mk(r.rollExt);
    this.bedsInt = mk(r.rollInt);
    if (r.squeal) this.flange.sample = this.loopVoice(r.squeal, this.trainBus.in);
    if (r.brakeSqueal) this.brakeSq.sample = this.loopVoice(r.brakeSqueal, this.trainBus.in);
    if (r.locoIdle) this.locoIdle = this.loopVoice(r.locoIdle, this.locoBus.in);
    if (r.locoBlower) this.locoBlower = this.loopVoice(r.locoBlower, this.locoBus.in);
    if (r.locoCompressor) this.locoCompressor = this.loopVoice(r.locoCompressor, this.locoBus.in);
    if (r.rollExt.length || r.jointExt.length) {
      console.info(`Rail audio: ${r.rollExt.length} exterior beds, ${r.rollInt.length} interior beds, ${r.jointExt.length}+${r.jointInt.length} joint impacts, ${r.turnout.length} turnout`);
    }
  }

  playOneShot(buffer, level, dest = this.master, { rate = 1, when = 0, pan = 0 } = {}) {
    if (!this.ready || !buffer) return null;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = level;
    let node = src.connect(g);
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      node = node.connect(p);
    }
    node.connect(dest);
    src.start(when || ctx.currentTime);
    return src;
  }

  // ----------------------------------------------------------- horns
  /** Load the horn library (horns/horns.json): player horns + distant horns. */
  async loadHorns() {
    let index = [];
    try {
      const res = await fetch(HORN_INDEX_URL);
      if (res.ok) index = await res.json();
      if (!Array.isArray(index)) index = index.horns ?? [];
    } catch {
      index = [];
    }
    await Promise.all(
      index.map(async (e) => {
        try {
          const buf = await this.fetchBuffer(`${AUDIO_BASE}horns/${String(e.file).replace(/^.*\//, '')}`);
          const short = e.shortFile ? await this.fetchBuffer(`${AUDIO_BASE}horns/${String(e.shortFile).replace(/^.*\//, '')}`).catch(() => null) : null;
          const loopStart = Number(e.loopStart);
          const loopEnd = Number(e.loopEnd);
          const ok = Number.isFinite(loopStart) && Number.isFinite(loopEnd) && loopEnd - loopStart > 0.2 && loopEnd < buf.duration;
          this.horns[e.id] = { ...e, buf, short, loopStart: ok ? loopStart : buf.duration * 0.3, loopEnd: ok ? loopEnd : buf.duration * 0.7 };
        } catch (err) {
          console.warn(`Horn "${e.id}" unavailable:`, err.message);
        }
      }),
    );
  }

  /** The player's horn recording: the chosen one, else the first library horn, else the original. */
  hornRecording() {
    const chosen = this.horns[this.hornChoice];
    if (chosen) return chosen;
    const player = Object.values(this.horns).find((h) => h.kind !== 'distant');
    if (player) return player;
    // the original recording: no measured release, so it simply fades out
    return this.buffers.horn ? { buf: this.buffers.horn, loopStart: HORN.loopStart, loopEnd: HORN.loopEnd, releaseS: 0 } : null;
  }

  /**
   * Start the horn. The recording plays its natural attack, then loops its
   * steady part for as long as H is held (see hornStop for the release).
   */
  hornStart(now) {
    if (this.hornVoice) this.hornStop(now);
    // inside the coach: the real recording of a loco horn heard from a coach
    if (this.perspectiveKey.startsWith('interior') && this.buffers.hornOnboard) {
      const buf = this.buffers.hornOnboard;
      this.hornVoice = this.startHornVoice({ buf, loopStart: Math.min(1.2, buf.duration * 0.2), loopEnd: Math.max(1.7, buf.duration - 1.0), releaseS: 0 }, MIX.horn * 1.4, this.master, now);
      return;
    }
    const h = this.hornRecording();
    if (!h) {
      this.hornGain.gain.setTargetAtTime(MIX.hornSynth, now, 0.03);
      return;
    }
    this.hornVoice = this.startHornVoice(h, MIX.horn, this.locoBus.in, now);
  }

  startHornVoice(h, level, dest, now) {
    const src = this.ctx.createBufferSource();
    src.buffer = h.buf;
    src.loop = true;
    src.loopStart = h.loopStart;
    src.loopEnd = h.loopEnd;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(level, now);
    src.connect(g).connect(dest);
    src.start(now);
    return { src, g, h, level, dest };
  }

  /**
   * Release. A horn from the library has a measured natural decay right after
   * its loop (releaseS): crossfade into exactly that much of it and stop —
   * never into whatever else the recording contains. Otherwise a short fade.
   */
  hornStop(now) {
    this.hornGain.gain.setTargetAtTime(0, now, 0.12);
    const v = this.hornVoice;
    if (!v) return;
    this.hornVoice = null;
    const release = Math.min(Number(v.h.releaseS) || 0, 1.5, v.h.buf.duration - v.h.loopEnd);
    const X = release > 0.05 ? 0.045 : 0.12;
    v.g.gain.cancelScheduledValues(now);
    v.g.gain.setValueAtTime(v.g.gain.value, now);
    v.g.gain.linearRampToValueAtTime(0, now + X);
    v.src.stop(now + X + 0.02);
    if (release > 0.05) {
      const src = this.ctx.createBufferSource();
      src.buffer = v.h.buf;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(v.level, now + X);
      g.gain.setValueAtTime(v.level, now + release * 0.8);
      g.gain.linearRampToValueAtTime(0, now + release);
      src.connect(g).connect(v.dest);
      src.start(now, v.h.loopEnd);
      src.stop(now + release + 0.02);
    }
  }

  /** Another train's horn: a distant recording when available. */
  playAiHorn(level = 0.65) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    if (now - this.lastAiHornTime < 10) return;
    this.lastAiHornTime = now;
    const distant = Object.values(this.horns).filter((h) => h.kind === 'distant');
    if (distant.length) {
      const h = distant[Math.floor(Math.random() * distant.length)];
      this.playOneShot(h.buf, level * 1.2, this.ambBus.in, { rate: 0.97 + Math.random() * 0.06 });
      return;
    }
    const players = Object.values(this.horns).filter((h) => h.kind !== 'distant');
    const buf = players.length ? players[Math.floor(Math.random() * players.length)].buf : this.buffers.horn;
    if (!buf) return;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 1.04;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(level, now + 0.08);
    g.gain.setValueAtTime(level, now + 1.2);
    g.gain.linearRampToValueAtTime(0, now + 1.8);
    src.connect(g).connect(this.ambBus.in);
    src.start(now);
    src.stop(now + 1.9);
  }

  /** Short "pssh" of air (brake release), also played when the journey starts. */
  burstHiss() {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const g = this.hiss.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(MIX.brakeHiss * 2.5, now);
    g.setTargetAtTime(0, now + 0.3, 0.35);
  }

  setVolume(volume, muted) {
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(muted ? 0 : volume * MIX.master, this.ctx.currentTime, 0.1);
  }

  setPaused(paused) {
    if (!this.ready) return;
    if (paused) this.ctx.suspend();
    else this.ctx.resume();
  }

  playPassby(level = 1) {
    const list = this.rail.passby;
    const buf = list?.length ? list[Math.floor(Math.random() * list.length)].buf : this.buffers.passby;
    if (!this.ready || !buf) return;
    const now = this.ctx.currentTime;
    if (now - this.lastPassbyTime < 12) return;
    this.lastPassbyTime = now;
    this.playOneShot(buf, MIX.passby * level, this.ambBus.in);
  }

  playAnnouncement() {
    if (!this.ready || !this.buffers.announcement) return;
    const now = this.ctx.currentTime;
    if (now - this.lastAnnouncementTime < 45) return;
    this.lastAnnouncementTime = now;
    try {
      this.announcementSource?.stop();
    } catch {
      /* already ended */
    }
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.announcement;
    src.connect(this.announcementGain);
    src.start();
    this.announcementSource = src;
  }

  /** Thunder `delay` seconds from now (light travels faster than sound). */
  playThunder(delay = 3, level = 1) {
    if (!this.ready) return;
    const buf = Math.random() < 0.5 ? this.buffers.thunder1 : this.buffers.thunder2;
    this.playOneShot(buf, MIX.thunder * level, this.master, { when: this.ctx.currentTime + delay, rate: 0.9 + Math.random() * 0.15 });
  }

  /** Guard's whistle from the rear of the train ("right away"). */
  playGuardWhistle(level = 1) {
    this.playOneShot(this.buffers.guardWhistle, MIX.whistle * level, this.ambBus.in);
  }

  /** Children shouting as the train passes (once per group). */
  playKids(level = 1) {
    if (this.ambienceMode === 'off') return;
    this.playOneShot(this.buffers.kids, MIX.kids * level, this.ambBus.in);
  }

  /** Cab control clicks: 'lever' | 'switch' | 'handle' | 'heavy'. */
  playClick(kind = 'switch') {
    const key = { switch: 'click1', lever: 'click3', handle: 'click2', heavy: 'click4' }[kind] ?? 'click1';
    this.playOneShot(this.buffers[key], MIX.click, this.uiBus, { rate: 0.95 + Math.random() * 0.1 });
  }

  /** Vigilance-control alarm buzzer (looped while on). */
  setBuzzer(on) {
    if (!this.ready || !this.amb?.buzzer) return;
    this.amb.buzzer.gain.gain.setTargetAtTime(on ? MIX.buzzer : 0, this.ctx.currentTime, 0.02);
  }

  playHonk(level = 1, pan = 0) {
    const key = `honk${1 + Math.floor(Math.random() * 6)}`;
    this.playOneShot(this.buffers[key], MIX.honk * level, this.ambBus.in, { pan, rate: 0.96 + Math.random() * 0.08 });
  }

  // ----------------------------------------------------------- joints
  /** Rebuild the axle list when the coach type changes. */
  setFormation(coachType, count) {
    const key = `${coachType}:${count}`;
    if (key === this.formationKey) return;
    this.formationKey = key;
    this.coachType = coachType;
    this.axles = trainAxles(coachType, count);
    this.lastFront = null; // re-seed every axle's next joint
    this.axleState = this.axles.map(() => ({ next: null }));
    this.firstCoachCenter = this.axles.find((a) => a.vehicle === 1)?.vehicleCenter ?? 33;
  }

  /**
   * Schedule every axle's impacts that fall inside the lookahead window.
   * L = listener { s, lat, h, ext } in route coordinates.
   */
  scheduleJoints(front, v, dir, L, persp, panFn) {
    const now = this.ctx.currentTime;
    // Restart/teleport or direction change → re-seed every axle's next joint
    const jumped = this.lastFront === null || Math.abs(front - this.lastFront) > 30 || dir !== this.lastDir;
    this.lastFront = front;
    this.lastDir = dir;
    if (v < 0.25) return;
    const r = this.rail;
    const interior = persp !== 'cab' && persp !== 'exterior';
    const joints = interior && r.jointInt.length ? r.jointInt : r.jointExt.length ? r.jointExt : this.synthJoints;
    const frogs = r.turnout.length ? r.turnout : this.synthFrog;
    const hard = 0.25 + 0.75 * smoothstep(0, 24, v);
    for (let i = 0; i < this.axles.length; i++) {
      const ax = this.axles[i];
      const st = this.axleState[i];
      const a = front - ax.offset; // axle position (direction only changes which joint is next)
      if (jumped || !st.next || (st.next.s - a) * dir < -0.05) st.next = nextJoint(a, dir, RAIL_JOINTS, SPECIALS);
      let guard = 0;
      while (guard++ < 4) {
        const t = timeToJoint(a, st.next.s, v, dir);
        if (!(t < LOOKAHEAD)) break;
        const j = st.next;
        st.next = nextJoint(j.s, dir, RAIL_JOINTS, SPECIALS);
        // listener distance at the moment of impact
        const along = j.s - L.s;
        const d = Math.hypot(along, L.lat, L.h);
        const kindGain = j.kind === 'frog' ? MIX.frog : j.kind === 'heel' ? MIX.heel : j.kind === 'lc' ? MIX.lc : 1;
        const heavy = ax.kind === 'loco' ? 1.12 : 1;
        const g = (MIX.joint * kindGain * hard * heavy) / (1 + Math.pow(d / 4.5, 1.6));
        if (g < 0.012 || this.voices >= MAX_VOICES) continue;
        const delay = L.ext ? d / SPEED_OF_SOUND : 0;
        const buf = j.kind === 'frog' ? rand(frogs) : rand(joints);
        // loco axles are heavier (20.5 t vs ~13 t); the turnout recording is a tram, so lower it
        const rate = (ax.kind === 'loco' ? 0.9 : 1) * (j.kind === 'frog' && r.turnout.length ? 0.85 : 1) * (0.94 + Math.random() * 0.1);
        const pan = L.ext ? panFn(j.s) : 0;
        const src = this.playOneShot(buf, g, this.trainBus.in, { when: now + t + delay, rate, pan });
        if (src) {
          this.voices++;
          src.onended = () => this.voices--;
        }
      }
    }
  }

  // ----------------------------------------------------------- per frame
  /**
   * Called every frame. Cheap: sets parameter targets and schedules impacts.
   * env: { route, camera, cameraMode, coachType, stationProximity, stationId,
   *        roadProximity, lcBell, lcDistance, passingAiTrain, env (environment),
   *        curveRadius, coachEyeX }
   */
  update(train, input, maxSpeedMps, env = {}) {
    if (!this.ready) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const v = train.speedMps;
    const vk = v * 3.6;
    const r = clamp(v / maxSpeedMps, 0, 1);
    const dir = train.direction === -1 ? -1 : 1;
    const front = train.routeDistance;
    const coachType = env.coachType ?? 'lhb';
    this.setFormation(coachType, env.coachCount);

    // ---- perspective & listener position (route coordinates)
    const mode = env.cameraMode;
    const pKey = mode === 'cab' ? 'cab' : mode === 'interior' ? (coachType === 'icf' ? 'interiorOpen' : 'interiorAc') : 'exterior';
    const P = PERSPECTIVE[pKey];
    let L;
    let panFn = () => 0;
    if (pKey === 'cab') L = { s: front - 1.4, lat: 0.4, h: 2.2, ext: false };
    else if (pKey !== 'exterior') L = { s: front - this.firstCoachCenter + (env.coachEyeX ?? 0), lat: 0.6, h: 1.6, ext: false };
    else L = this.projectListener(env.route, env.camera, front);
    if (L.ext && env.route && env.camera) panFn = (s) => this.panFor(env.route, env.camera, s);

    // the rest of the train relative to the listener (for outside views)
    const rear = front - (this.axles.at(-1)?.offset ?? 200);
    const dTrain = L.ext ? Math.hypot(Math.max(0, L.s - front, rear - L.s), L.lat) : 0;
    const dLoco = L.ext ? Math.hypot(L.s - (front - 10), L.lat, L.h - 3) : 0;
    const trainAtten = L.ext ? 1 / (1 + dTrain / 22) : 1;
    const locoAtten = L.ext ? 1 / (1 + dLoco / 14) : 1;

    // smooth perspective changes
    if (pKey !== this.perspectiveKey) this.perspectiveKey = pKey;
    const k = 0.12;
    const encl = env.enclosure ?? 0; // 1 inside a tunnel: louder, echoing train, no outside world
    this.trainBus.gain.gain.setTargetAtTime(P.train * trainAtten * (1 + 0.85 * encl), now, k);
    this.echoSend.gain.setTargetAtTime(0.5 * encl, now, 0.2);
    this.trainBus.filter.frequency.setTargetAtTime(L.ext ? P.trainLp / (1 + dTrain / 400) : P.trainLp, now, k);
    this.locoBus.gain.gain.setTargetAtTime(P.loco * locoAtten, now, k);
    this.locoBus.filter.frequency.setTargetAtTime(P.locoLp, now, k);
    this.ambBus.gain.gain.setTargetAtTime(P.amb * (1 - 0.88 * encl), now, k);
    this.ambBus.filter.frequency.setTargetAtTime(P.ambLp, now, k);
    this.roofBus.gain.setTargetAtTime(P.roof, now, k);

    // ---- 1. rolling beds, crossfaded by speed
    const moving = smoothstep(0.3, 4, v);
    // open-deck bridges drum: the rolling sound swells while the train is on one
    const bedLevel = MIX.rolling * moving * (0.35 + 0.65 * smoothstep(0, 30, v)) * (env.onBridge ? 1.3 : 1);
    const beds = pKey.startsWith('interior') && this.bedsInt?.length ? this.bedsInt : this.bedsExt ?? [];
    const otherBeds = beds === this.bedsInt ? this.bedsExt ?? [] : this.bedsInt ?? [];
    for (const b of otherBeds) b.voice.gain.gain.setTargetAtTime(0, now, 0.25);
    if (beds.length) {
      const w = bandWeights(beds, Math.max(vk, 1));
      beds.forEach((b, i) => {
        b.voice.gain.gain.setTargetAtTime(bedLevel * w[i], now, 0.2);
        b.voice.src.playbackRate.setTargetAtTime(clamp(Math.sqrt(Math.max(vk, 5) / b.speed), 0.82, 1.18), now, 0.3);
      });
      this.synthRoll.gain.gain.setTargetAtTime(0, now, 0.3);
    } else {
      this.synthRoll.gain.gain.setTargetAtTime(bedLevel * 0.9, now, 0.2);
      this.synthRoll.filter.frequency.setTargetAtTime(160 + 9 * vk, now, 0.2);
      this.synthRoll.src.playbackRate.setTargetAtTime(0.7 + 0.5 * r, now, 0.3);
    }

    // ---- 2. joint impacts
    this.scheduleJoints(front, v, dir, L, pKey, panFn);

    // ---- 3. squeals
    const curveR = env.curveRadius ?? Infinity;
    const onTurnout = SPECIALS.some((j) => (j.kind === 'frog' || j.kind === 'heel') && front - j.s > -5 && front - j.s < 250);
    const flange = MIX.squeal * (curveR < 1700 ? smoothstep(3, 8, v) * (1 - smoothstep(18, 28, v)) * 0.6 : 0) + (onTurnout ? MIX.squeal * smoothstep(1.5, 4, v) * (1 - smoothstep(9, 14, v)) : 0);
    this.setSqueal(this.flange, flange, now);
    const stopping = train.bc > 0.6 && v > 0.05 && v < 3.2;
    this.setSqueal(this.brakeSq, stopping ? MIX.brakeSqueal * (1 - v / 3.2) * smoothstep(0.05, 0.4, v) : 0, now);
    if (stopping) this.stopClunkArmed = true;
    if (this.stopClunkArmed && v === 0) {
      // the final stop: couplers settle with a soft clunk down the train
      this.stopClunkArmed = false;
      for (let i = 0; i < 4; i++) this.playOneShot(rand(this.synthFrog), 0.18 / (i + 1), this.trainBus.in, { when: now + i * 0.11, rate: 0.6 });
    }

    // ---- 4. loco machinery
    const te = Math.abs(train.teActual ?? 0) / 322;
    const humLevel = MIX.hum * (this.locoIdle ? 0.3 : 1);
    this.hum.gain.setTargetAtTime(humLevel, now, 0.4);
    if (this.locoIdle) this.locoIdle.gain.gain.setTargetAtTime(0.5, now, 0.4);
    const blowerLevel = MIX.blower * (0.55 + 0.45 * smoothstep(0, 0.4, te));
    if (this.locoBlower) {
      this.locoBlower.gain.gain.setTargetAtTime(blowerLevel * 1.6, now, 0.8);
      this.blower.gain.gain.setTargetAtTime(0, now, 0.5);
    } else {
      this.blower.gain.gain.setTargetAtTime(blowerLevel, now, 0.8);
      this.blower.filter.frequency.setTargetAtTime(380 + 160 * te, now, 0.8);
    }
    // compressor runs ~25 s in every 90 s (main reservoir topping up)
    const comp = (now % 90) < 25 ? 1 : 0;
    if (this.locoCompressor) this.locoCompressor.gain.gain.setTargetAtTime(comp * MIX.compressor * 2, now, 0.6);
    else {
      this.compressor.gain.gain.setTargetAtTime(comp * MIX.compressor * 0.5, now, 0.6);
      this.compressorLfoGain.gain.setTargetAtTime(comp * MIX.compressor * 0.5, now, 0.6);
    }
    // converter "song": discrete pulse-mode jumps, glide within a mode
    const tone = inverterTone(v);
    const invLevel = MIX.inverter * smoothstep(0.02, 0.25, te) * (1 - smoothstep(30, 40, v) * 0.6);
    this.inverter.gain.setTargetAtTime(invLevel, now, 0.08);
    const set = (o, f) => (tone.pulses !== this.pulses ? o.frequency.setValueAtTime(f, now) : o.frequency.setTargetAtTime(f, now, 0.05));
    set(this.invOsc[0], tone.freq);
    set(this.invOsc[1], Math.max(30, tone.freq - 2 * tone.motorHz));
    set(this.invOsc[2], tone.freq + 2 * tone.motorHz);
    this.pulses = tone.pulses;

    // brake hiss while the A9 handle moves; "pssh" on release
    const brakeMoving = Math.abs(train.brake - this.lastBrake) > 1e-4;
    const releasing = train.brake < this.lastBrake - 1e-4;
    if (releasing && this.buffers.brakeRelease && now - this.lastReleaseSound > 4) {
      this.playOneShot(this.buffers.brakeRelease, MIX.brakeRelease, this.locoBus.in);
      this.lastReleaseSound = now;
    }
    if (brakeMoving && Math.abs(this.lastBrake - train.brake) > 0 && !this.brakeWasMoving) this.playClick('handle');
    this.brakeWasMoving = brakeMoving;
    this.lastBrake = train.brake;
    this.hiss.gain.gain.setTargetAtTime(brakeMoving ? MIX.brakeHiss : 0, now, brakeMoving ? 0.05 : 0.3);
    // TE/BE lever detent clicks every 10 %
    const notch = Math.round((train.lever ?? 0) * 10);
    if (notch !== this.lastLever && pKey === 'cab') this.playClick('lever');
    this.lastLever = notch;

    // horn (H, held)
    this.hornChoice = env.hornChoice ?? null;
    if (input.horn !== this.hornOn) {
      this.hornOn = input.horn;
      if (input.horn) this.hornStart(now);
      else this.hornStop(now);
    }

    // wind past the train
    if (this.amb?.wind) this.amb.wind.gain.gain.setTargetAtTime(MIX.wind * P.wind * Math.pow(smoothstep(4, 34, v), 1.6), now, 0.3);

    // ---- 5. world ambience
    this.ambienceMode = env.ambienceMode;
    this.updateAmbience(env, now, v, pKey, L);
  }

  setSqueal(sq, level, now) {
    if (sq.sample) {
      sq.sample.gain.gain.setTargetAtTime(level * 2.2, now, 0.15);
      sq.gain.gain.setTargetAtTime(0, now, 0.1);
    } else sq.gain.gain.setTargetAtTime(level * 0.25, now, 0.15);
  }

  /**
   * Background beds come and go in "episodes" instead of playing for the
   * whole journey: e.g. a bird chorus for 20–45 s, then quiet for a minute or
   * two. Returns a smoothed 0..1 factor per bed. mode: 'occasional' | 'always' | 'off'.
   */
  episode(key, mode, dt, on = [20, 45], off = [50, 120]) {
    if (mode === 'always') return 1;
    if (mode === 'off') return 0;
    const ep = (this.episodes ??= {});
    const st = (ep[key] ??= { on: Math.random() < 0.4, timer: 6 + Math.random() * 20 });
    st.timer -= dt;
    if (st.timer <= 0) {
      st.on = !st.on;
      const [lo, hi] = st.on ? on : off;
      st.timer = lo + Math.random() * (hi - lo);
    }
    return st.on ? 1 : 0;
  }

  updateAmbience(env, now, v, pKey, L) {
    const e = env.env ?? { night: 0, rain: 0 };
    const a = this.amb;
    const mode = env.ambienceMode ?? 'occasional';
    const dt = clamp(now - (this.lastAmbTime ?? now), 0, 0.25);
    this.lastAmbTime = now;
    const station = env.stationProximity ?? 0;
    const road = env.roadProximity ?? 0;
    if (env.passingAiTrain) this.playPassby(L.ext ? 1 : 0.8);
    if (station > 0.65 && v < 12) this.playAnnouncement();
    this.announcementGain.gain.setTargetAtTime(station > 0.04 ? MIX.announcement * Math.pow(station, 1.8) : 0, now, 0.25);
    if (station <= 0.02 && this.announcementSource) {
      try {
        this.announcementSource.stop();
      } catch {
        /* already ended */
      }
      this.announcementSource = null;
    }
    if (!a) return;
    const rural = 1 - station;
    const t = (voice, level, tau = 1.2) => voice?.gain.gain.setTargetAtTime(level, now, tau);
    // nature and road beds fade in and out over a few seconds per episode
    const birdsEp = this.episode('birds', mode, dt);
    const insectsEp = this.episode('insects', mode, dt, [25, 55], [40, 100]);
    const trafficEp = this.episode('traffic', mode, dt, [25, 50], [30, 80]);
    t(a.birds, MIX.birds * birdsEp * (1 - e.night) * (1 - e.rain * 0.85) * (0.3 + 0.7 * rural) * (1 - road * 0.4), 3);
    t(a.insects, MIX.insects * insectsEp * e.night * (1 - e.rain * 0.7) * (0.35 + 0.65 * rural), 3);
    t(a.rain, MIX.rain * e.rain);
    t(a.rainRoof, MIX.rainRoof * e.rain * (pKey === 'exterior' ? 0 : 1));
    t(a.traffic, MIX.traffic * trafficEp * road * (1 - e.night * 0.5), 3);
    // stations: big city termini get the busy concourse recording, others the quieter platform
    const atOrigin = !!env.stationBusy;
    // the sea (Pamban, the Konkan estuaries): surf comes and goes like the other beds
    const seaEp = this.episode('sea', mode, dt, [35, 75], [25, 60]);
    t(this.sea, MIX_SEA * (env.water ?? 0) * seaEp * (1 - e.rain * 0.4), 2.5);
    t(a.station, MIX.station * station * (atOrigin ? 1 : 0.35));
    t(a.stationBusy1, MIX.station * 0.8 * station * (atOrigin ? 0.7 : 0.2));
    t(a.stationBusy2, MIX.station * 0.9 * station * (atOrigin ? 0.15 : 1));
    // level-crossing bell while the gates close/are closed, by distance
    const lcD = env.lcDistance ?? Infinity;
    t(a.lcBell, env.lcBell ? MIX.lcBell / (1 + lcD / 60) : 0, 0.15);
    // horns on the road: more often when traffic queues at the closed gates
    this.nextHonk -= dt;
    // casual honking only while the traffic bed is audible; queues at the gates always honk
    const honkRate = (mode === 'off' ? 0 : road * trafficEp * (1 - e.night * 0.6)) + (env.lcBell ? 1 / (1 + lcD / 120) : 0);
    if (this.nextHonk <= 0) {
      this.nextHonk = 2 + Math.random() * 7;
      if (honkRate > 0.08 && Math.random() < Math.min(1, honkRate * 1.4)) this.playHonk(Math.min(1, honkRate), (Math.random() - 0.5) * 1.2);
    }
  }

  /** Nearest point on the line to the camera, as { s, lat, h } (outside views). */
  projectListener(route, camera, front) {
    if (!route || !camera) return { s: front - 40, lat: 12, h: 3, ext: true };
    const p = this._p ?? (this._p = {});
    const cx = camera.position.x;
    const cz = camera.position.z;
    let best = front;
    let bestD = Infinity;
    for (let s = front - 320; s <= front + 320; s += 16) {
      route.sample(s, p);
      const d = (p.x - cx) ** 2 + (p.z - cz) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    for (let s = best - 16; s <= best + 16; s += 1) {
      route.sample(s, p);
      const d = (p.x - cx) ** 2 + (p.z - cz) ** 2;
      if (d < bestD) {
        bestD = d;
        best = s;
      }
    }
    route.sample(best, p);
    const lat = (cx - p.x) * p.lx + (cz - p.z) * p.lz;
    return { s: best, lat, h: camera.position.y - RAIL_TOP, ext: true };
  }

  /** −1 (left) … +1 (right) for a point on the line, as heard by the camera. */
  panFor(route, camera, s) {
    const p = this._pp ?? (this._pp = {});
    route.sample(s, p);
    const e = camera.matrixWorld.elements; // column 0 = camera right vector
    const dx = p.x - camera.position.x;
    const dz = p.z - camera.position.z;
    const dist = Math.hypot(dx, dz) || 1;
    return clamp(((dx * e[0] + dz * e[2]) / dist) * 0.85, -0.85, 0.85);
  }
}

export const audioEngine = new AudioEngine();

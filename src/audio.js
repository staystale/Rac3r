// audio.js — procedural Web Audio API engine synthesis, tyre screech, and surface textures.
// Runs purely client-side; safely no-ops in Node or headless test runners (CLAUDE.md §5).

// remembered between sessions (the pause menu's SOUND slider / MUTE)
/**
 * Reads a stored setting.
 * @param {string} key localStorage key
 * @param {string} fallback value when nothing is stored or storage is blocked
 * @returns {string} the stored or fallback value
 */
function load(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored === null ? fallback : stored;
  } catch { return fallback; }
}

/**
 * Stores the volume and mute settings.
 * @param {object} state the audio state
 * @returns {void}
 */
function save(state) {
  try {
    localStorage.setItem('rac3r.vol', String(state.volume));
    localStorage.setItem('rac3r.mute', state.muted ? '1' : '0');
  } catch { /* private mode */ }
}

// Sigmoid soft-clipping saturation curve for warm combustion rumble (eliminates harsh buzz)
/**
 * Builds the wave-shaper curve.
 * @param {number} amount sharpness
 * @returns {Float32Array} the curve
 */
function makeSaturationCurve(amount = 8) {
  const sharpness = amount;
  const samples = 1024;
  const curve = new Float32Array(samples);
  for (let i = 0; i < samples; ++i) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + sharpness) * x) / (1 + sharpness * Math.abs(x));
  }
  return curve;
}

/**
 * Builds the engine voice (oscillators -> shaper -> filter -> formant -> gain -> master).
 * @param {object} state the audio state
 * @returns {void}
 */
function buildEngineVoice(state) {
  const { ctx, masterGain, engine } = state;
  // --- 1. ENGINE SYNTHESIS (Warm, wave-shaped combustion rumble + dual formants) ---
  engine.gain = ctx.createGain();
  engine.gain.gain.setValueAtTime(0.0, ctx.currentTime);

  engine.shaper = ctx.createWaveShaper();
  engine.shaper.curve = makeSaturationCurve(10);
  engine.shaper.oversample = '2x';

  engine.filter = ctx.createBiquadFilter();
  engine.filter.type = 'lowpass';
  engine.filter.frequency.setValueAtTime(320, ctx.currentTime);
  engine.filter.Q.setValueAtTime(1.8, ctx.currentTime);

  engine.formant = ctx.createBiquadFilter();
  engine.formant.type = 'peaking';
  engine.formant.frequency.setValueAtTime(360, ctx.currentTime);
  engine.formant.Q.setValueAtTime(1.4, ctx.currentTime);
  engine.formant.gain.setValueAtTime(4.0, ctx.currentTime);

  engine.oscCore = ctx.createOscillator();
  engine.oscCore.type = 'triangle';
  engine.oscCore.frequency.setValueAtTime(50, ctx.currentTime);

  engine.oscHarmonic = ctx.createOscillator();
  engine.oscHarmonic.type = 'sine';
  engine.oscHarmonic.frequency.setValueAtTime(100, ctx.currentTime);

  engine.oscSub = ctx.createOscillator();
  engine.oscSub.type = 'sine';
  engine.oscSub.frequency.setValueAtTime(25, ctx.currentTime);

  engine.oscCore.connect(engine.shaper);
  engine.oscHarmonic.connect(engine.shaper);
  engine.oscSub.connect(engine.filter);

  engine.shaper.connect(engine.filter);
  engine.filter.connect(engine.formant);
  engine.formant.connect(engine.gain);
  engine.gain.connect(masterGain);

  engine.oscCore.start();
  engine.oscHarmonic.start();
  engine.oscSub.start();
}

/**
 * Builds the shared 2 s looping white-noise buffer.
 * @param {object} state the audio state
 * @returns {AudioBuffer} the noise buffer
 */
function buildNoiseBuffer(state) {
  const { ctx } = state;
  // --- 2. NOISE BUFFER (Used for tyre screech, surface textures, and bumps) ---
  const bufSize = ctx.sampleRate * 2; // 2s looping white noise
  const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const output = noiseBuf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

/**
 * Builds the tyre screech and braking scrub voice.
 * @param {object} state the audio state
 * @param {AudioBuffer} noiseBuf the noise buffer
 * @returns {void}
 */
function buildTyreNoise(state, noiseBuf) {
  const { ctx, masterGain, tyre } = state;
  // --- 2A. TYRE SCREECH & BRAKING SCRUB ---
  tyre.noiseSource = ctx.createBufferSource();
  tyre.noiseSource.buffer = noiseBuf;
  tyre.noiseSource.loop = true;

  tyre.filter = ctx.createBiquadFilter();
  tyre.filter.type = 'bandpass';
  tyre.filter.frequency.setValueAtTime(950, ctx.currentTime);
  tyre.filter.Q.setValueAtTime(3.2, ctx.currentTime);

  tyre.gain = ctx.createGain();
  tyre.gain.gain.setValueAtTime(0.0, ctx.currentTime);

  tyre.noiseSource.connect(tyre.filter);
  tyre.filter.connect(tyre.gain);
  tyre.gain.connect(masterGain);

  tyre.noiseSource.start();
}

/**
 * Builds the continuous surface rolling texture voice.
 * @param {object} state the audio state
 * @param {AudioBuffer} noiseBuf the noise buffer
 * @returns {void}
 */
function buildSurfaceNoise(state, noiseBuf) {
  const { ctx, masterGain, surface } = state;
  // --- 2B. CONTINUOUS SURFACE ROLLING TEXTURE (Gravel crunch / dirt roar / grass swish) ---
  surface.noiseSource = ctx.createBufferSource();
  surface.noiseSource.buffer = noiseBuf;
  surface.noiseSource.loop = true;

  surface.filter = ctx.createBiquadFilter();
  surface.filter.type = 'bandpass';
  surface.filter.frequency.setValueAtTime(600, ctx.currentTime);
  surface.filter.Q.setValueAtTime(1.5, ctx.currentTime);

  surface.gain = ctx.createGain();
  surface.gain.gain.setValueAtTime(0.0, ctx.currentTime);

  surface.noiseSource.connect(surface.filter);
  surface.filter.connect(surface.gain);
  surface.gain.connect(masterGain);

  surface.noiseSource.start();
}

/**
 * Builds the surface bump and kerb chatter voice.
 * @param {object} state the audio state
 * @param {AudioBuffer} noiseBuf the noise buffer
 * @returns {void}
 */
function buildBumpVoice(state, noiseBuf) {
  const { ctx, masterGain, bump } = state;
  // --- 2C. SURFACE BUMPS & KERB CHATTER ---
  const bumpNoiseSource = ctx.createBufferSource();
  bumpNoiseSource.buffer = noiseBuf;
  bumpNoiseSource.loop = true;

  bump.filter = ctx.createBiquadFilter();
  bump.filter.type = 'lowpass';
  bump.filter.frequency.setValueAtTime(260, ctx.currentTime);

  bump.gain = ctx.createGain();
  bump.gain.gain.setValueAtTime(0.0, ctx.currentTime);

  bumpNoiseSource.connect(bump.filter);
  bump.filter.connect(bump.gain);
  bump.gain.connect(masterGain);

  bumpNoiseSource.start();
}

/**
 * Creates the context on first call (later calls just resume it) and builds every voice.
 * @param {object} state the audio state
 * @param {Function} AudioCtx the AudioContext constructor
 * @returns {void}
 */
function initAudio(state, AudioCtx) {
  if (state.ctx) {
    if (state.ctx.state === 'suspended') state.ctx.resume().catch(() => {});
    return;
  }

  try {
    const ctx = state.ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    // Master output gain
    const masterGain = state.masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(state.muted ? 0 : state.volume, ctx.currentTime);
    masterGain.connect(ctx.destination);

    // Auto-unlock on any user gesture across the document
    if (typeof window !== 'undefined') {
      const unlock = () => {
        if (state.ctx && state.ctx.state === 'suspended') state.ctx.resume().catch(() => {});
      };
      for (const evName of ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown']) {
        window.addEventListener(evName, unlock, { passive: true });
      }
    }

    buildEngineVoice(state);
    const noiseBuf = buildNoiseBuffer(state);
    buildTyreNoise(state, noiseBuf);
    buildSurfaceNoise(state, noiseBuf);
    buildBumpVoice(state, noiseBuf);
  } catch {
    // AudioContext policy blocked or unsupported
  }
}

/**
 * Engine voice per frame: pitch glide, intake filter and gain from rpm and throttle.
 * @param {object} state the audio state
 * @param {object} car the car being heard
 * @param {number} now audio clock time
 * @returns {void}
 */
function updateEngineVoice(state, car, now) {
  const { engine } = state;
  const spec = car.spec;
  const rpm = Math.max(spec.idleRpm * 0.9, car.rpm || spec.idleRpm);

  // Firing frequency from cylinders
  const cyl = spec.cyl
    || (spec.id === 'muscle-rwd' ? 8
      : spec.id === 'tractor' ? 6 : spec.id === 'track-rwd' ? 6 : 4);
  const baseFreq = (rpm / 60) * (cyl / 2);

  // Smooth engine pitch glide
  engine.oscCore.frequency.setTargetAtTime(baseFreq, now, 0.04);
  engine.oscHarmonic.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.04);
  engine.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

  // Throttle load opens acoustic intake filter
  const throttle = Math.max(0, Math.min(1,
    car.gear < 0 ? (car.brakeLight || 0) : (car.in ? car.in.throttle : 0)));
  const filterTarget = 240 + (rpm / spec.redline) * 1100 + throttle * 1200;
  engine.filter.frequency.setTargetAtTime(filterTarget, now, 0.06);

  const targetGain = 0.22 + (rpm / spec.redline) * 0.18 + throttle * 0.24;
  engine.gain.gain.setTargetAtTime(targetGain, now, 0.04);
}

/**
 * Whether a surface is loose (gravel, dirt, grass, snow ...) for tyre noise.
 * @param {string} surfId surface id under the car
 * @returns {boolean} true on a loose surface
 */
function isLooseSurface(surfId) {
  return surfId === 'gravel' || surfId === 'rally' || surfId === 'dirt'
    || surfId === 'mud' || surfId === 'grass' || surfId === 'grassShort'
    || surfId === 'grassLong' || surfId === 'snow' || surfId === 'sand'
    || surfId === 'thickMud';
}

/**
 * Tyre screech per frame: level and pitch from slip demand and surface looseness.
 * @param {object} state the audio state
 * @param {object} car the car being heard
 * @param {number} now audio clock time
 * @param {number} speed car speed
 * @param {string} surfId surface id under the car
 * @returns {void}
 */
function updateTyreNoise(state, car, now, speed, surfId) {
  const { tyre } = state;
  // --- 2. RESPONSIVE TYRE SCREECH (From Turning, Braking, and Burnouts) ---
  // Reads telemetry `car.t` (rule 10: live physical state)
  const telem = car.t || {};
  const latSlip = Math.max(Math.abs(telem.satF || 0), Math.abs(telem.satR || 0));
  const longSlip = Math.max(Math.abs(telem.slipSpeedF || 0), Math.abs(telem.slipSpeedR || 0));
  const isLocked = Boolean(telem.lockedF || telem.lockedR);

  // Demand: 1.0 = full friction limit reached
  const slipDemand = Math.max(
    latSlip,                         // turning scrub
    Math.min(2.5, longSlip / 3.5),   // wheelspin / braking slip
    isLocked ? 1.6 : 0               // locked wheels under hard brake
  );

  const isLoose = isLooseSurface(surfId);

  // Screech activates when cornering hard (>0.62) or braking (>0.50)
  const squealThresh = isLoose ? 0.70 : 0.62;
  let targetSqueal = 0;
  if (speed > 1.8 && slipDemand > squealThresh) {
    targetSqueal = Math.min(0.42, (slipDemand - squealThresh) * 0.48 * Math.min(1, speed / 5.5));
  }
  tyre.gain.gain.setTargetAtTime(targetSqueal, now, 0.04);

  // Screech pitch: high asphalt whine on tarmac, lower gritty churn on loose dirt/gravel
  if (isLoose) {
    tyre.filter.frequency.setTargetAtTime(450 + Math.min(300, speed * 10), now, 0.05);
    tyre.filter.Q.setTargetAtTime(1.8, now, 0.05);
  } else {
    tyre.filter.frequency.setTargetAtTime(950 + Math.min(650, speed * 22), now, 0.05);
    tyre.filter.Q.setTargetAtTime(3.2, now, 0.05);
  }
}

/**
 * Continuous surface rolling texture per frame: level and pitch from surface and speed.
 * @param {object} state the audio state
 * @param {number} now audio clock time
 * @param {number} speed car speed
 * @param {string} surfId surface id under the car
 * @returns {void}
 */
function updateSurfaceNoise(state, now, speed, surfId) {
  const { surface } = state;
  // --- 3. CONTINUOUS SURFACE ROLLING TEXTURES ---
  if (surface.gain && surface.filter) {
    let surfTarget = 0;
    let surfFreq = 600;

    if (speed > 1.0) {
      if (surfId === 'gravel' || surfId === 'rally') {
        surfTarget = Math.min(0.28, speed * 0.014);
        surfFreq = 580;
      } else if (surfId === 'dirt' || surfId === 'mud') {
        surfTarget = Math.min(0.24, speed * 0.012);
        surfFreq = 420;
      } else if (surfId === 'grass' || surfId === 'grassShort' || surfId === 'grassLong') {
        surfTarget = Math.min(0.18, speed * 0.009);
        surfFreq = 750;
      } else if (surfId === 'kerb') {
        surfTarget = Math.min(0.32, speed * 0.016);
        surfFreq = 320;
      } else {
        // Subtle high-speed road hiss on tarmac
        surfTarget = Math.min(0.08, speed * 0.003);
        surfFreq = 1200;
      }
    }
    surface.gain.gain.setTargetAtTime(surfTarget, now, 0.05);
    surface.filter.frequency.setTargetAtTime(surfFreq, now, 0.05);
  }
}

/**
 * Bump and kerb vertical impacts per frame.
 * @param {object} state the audio state
 * @param {object} car the car being heard
 * @param {number} now audio clock time
 * @param {number} speed car speed
 * @param {string} surfId surface id under the car
 * @returns {void}
 */
function updateBumpVoice(state, car, now, speed, surfId) {
  const { bump } = state;
  // --- 4. BUMP & KERB VERTICAL IMPACTS ---
  const vertSpeed = Math.abs(car.groundVF || 0) + Math.abs(car.groundVR || 0);
  const onKerb = surfId === 'kerb';
  let targetBump = 0;
  if (speed > 2.0 && (vertSpeed > 0.35 || onKerb)) {
    targetBump = Math.min(0.24, (vertSpeed * 0.10) + (onKerb ? 0.14 : 0));
  }
  bump.gain.gain.setTargetAtTime(targetBump, now, 0.03);
}

/**
 * Per-frame audio update: resumes the context and drives every voice from the car.
 * @param {object} state the audio state
 * @param {object} car the car being heard
 * @returns {void}
 */
function updateAudio(state, car) {
  const { ctx } = state;
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  if (ctx.state !== 'running' || state.muted || state.volume <= 0.001) return;

  const now = ctx.currentTime;
  const speed = Math.hypot(car.vx, car.vy);
  updateEngineVoice(state, car, now);
  const surfId = car.surface ? car.surface.id : 'tarmac';
  updateTyreNoise(state, car, now, speed, surfId);
  updateSurfaceNoise(state, now, speed, surfId);
  updateBumpVoice(state, car, now, speed, surfId);
}

/**
 * Sets and stores the master volume.
 * @param {object} state the audio state
 * @param {number} level 0..1
 * @returns {number} the clamped volume
 */
function setVolume(state, level) {
  state.volume = Math.max(0, Math.min(1, level));
  save(state);
  if (state.masterGain && state.ctx) {
    state.masterGain.gain.setTargetAtTime(state.muted ? 0.0 : state.volume,
      state.ctx.currentTime, 0.02);
  }
  return state.volume;
}

/**
 * Toggles and stores the mute flag.
 * @param {object} state the audio state
 * @returns {boolean} the new muted flag
 */
function toggleMute(state) {
  state.muted = !state.muted;
  save(state);
  if (state.masterGain && state.ctx) {
    state.masterGain.gain.setTargetAtTime(state.muted ? 0.0 : state.volume,
      state.ctx.currentTime, 0.03);
  }
  return state.muted;
}

/**
 * Creates the audio engine.
 * @param {boolean} [enabled] false (?noaudio=1, a judder test): never start Web Audio at all
 * @returns {object} the engine: init, update, volume and mute
 */
export function createAudio(enabled = true) {
  const AudioCtx = typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!AudioCtx || !enabled) {
    return {
      init: () => {},
      update: () => {},
      toggleMute: () => false,
      setVolume: () => {},
      get volume() { return 0; },
      get muted() { return true; },
      get state() { return 'disabled'; },
    };
  }

  const state = {
    ctx: null,
    masterGain: null,
    // remembered between sessions (the pause menu's SOUND slider / MUTE)
    volume: Math.max(0, Math.min(1, +load('rac3r.vol', 0.5) || 0)),
    muted: load('rac3r.mute', '0') === '1',
    // Engine audio nodes
    engine: { gain: null, filter: null, formant: null, shaper: null, oscCore: null,
      oscSub: null, oscHarmonic: null },
    // Tyre screech & scrub nodes
    tyre: { noiseSource: null, filter: null, gain: null },
    // Continuous surface rolling texture nodes (gravel / dirt / grass / tarmac)
    surface: { noiseSource: null, filter: null, gain: null },
    // Surface bump & kerb chatter nodes
    bump: { filter: null, gain: null },
  };

  return {
    init: () => initAudio(state, AudioCtx),
    update: (car) => updateAudio(state, car),
    setVolume: (level) => setVolume(state, level),
    toggleMute: () => toggleMute(state),
    get volume() { return state.volume; },
    get muted() { return state.muted; },
    get state() { return state.ctx ? state.ctx.state : 'uninitialized'; },
    get ctx() { return state.ctx; },
  };
}

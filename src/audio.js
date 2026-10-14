// audio.js — procedural Web Audio API engine synthesis, tyre screech, and surface textures.
// Runs purely client-side; safely no-ops in Node or headless test runners (CLAUDE.md §5).

export function createAudio() {
  const AudioCtx = typeof window !== 'undefined'
    ? (window.AudioContext || window.webkitAudioContext) : null;
  if (!AudioCtx) {
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

  let ctx = null;
  let masterGain = null;
  // remembered between sessions (the pause menu's SOUND slider / MUTE, 2026-10-07)
  const load = (key, fallback) => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? fallback : stored;
    } catch { return fallback; }
  };
  const save = () => {
    try {
      localStorage.setItem('rac3r.vol', String(volume));
      localStorage.setItem('rac3r.mute', muted ? '1' : '0');
    } catch { /* private mode */ }
  };
  let volume = Math.max(0, Math.min(1, +load('rac3r.vol', 0.5) || 0));
  let muted = load('rac3r.mute', '0') === '1';

  // Engine audio nodes
  let engineGain = null;
  let engineFilter = null;
  let engineFormant = null;
  let engineShaper = null;
  let oscCore = null;
  let oscSub = null;
  let oscHarmonic = null;

  // Tyre screech & scrub nodes
  let tyreNoiseSource = null;
  let tyreFilter = null;
  let tyreGain = null;

  // Continuous surface rolling texture nodes (gravel / dirt / grass / tarmac)
  let surfaceNoiseSource = null;
  let surfaceFilter = null;
  let surfaceGain = null;

  // Surface bump & kerb chatter nodes
  let bumpFilter = null;
  let bumpGain = null;

  // Sigmoid soft-clipping saturation curve for warm combustion rumble (eliminates harsh buzz)
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

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return;
    }

    try {
      ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      // Master output gain
      masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(muted ? 0 : volume, ctx.currentTime);
      masterGain.connect(ctx.destination);

      // Auto-unlock on any user gesture across the document
      if (typeof window !== 'undefined') {
        const unlock = () => {
          if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
        };
        for (const evName of ['click', 'touchstart', 'touchend', 'pointerdown', 'keydown']) {
          window.addEventListener(evName, unlock, { passive: true });
        }
      }

      // --- 1. ENGINE SYNTHESIS (Warm, wave-shaped combustion rumble + dual formants) ---
      engineGain = ctx.createGain();
      engineGain.gain.setValueAtTime(0.0, ctx.currentTime);

      engineShaper = ctx.createWaveShaper();
      engineShaper.curve = makeSaturationCurve(10);
      engineShaper.oversample = '2x';

      engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.setValueAtTime(320, ctx.currentTime);
      engineFilter.Q.setValueAtTime(1.8, ctx.currentTime);

      engineFormant = ctx.createBiquadFilter();
      engineFormant.type = 'peaking';
      engineFormant.frequency.setValueAtTime(360, ctx.currentTime);
      engineFormant.Q.setValueAtTime(1.4, ctx.currentTime);
      engineFormant.gain.setValueAtTime(4.0, ctx.currentTime);

      oscCore = ctx.createOscillator();
      oscCore.type = 'triangle';
      oscCore.frequency.setValueAtTime(50, ctx.currentTime);

      oscHarmonic = ctx.createOscillator();
      oscHarmonic.type = 'sine';
      oscHarmonic.frequency.setValueAtTime(100, ctx.currentTime);

      oscSub = ctx.createOscillator();
      oscSub.type = 'sine';
      oscSub.frequency.setValueAtTime(25, ctx.currentTime);

      oscCore.connect(engineShaper);
      oscHarmonic.connect(engineShaper);
      oscSub.connect(engineFilter);

      engineShaper.connect(engineFilter);
      engineFilter.connect(engineFormant);
      engineFormant.connect(engineGain);
      engineGain.connect(masterGain);

      oscCore.start();
      oscHarmonic.start();
      oscSub.start();

      // --- 2. NOISE BUFFER (Used for tyre screech, surface textures, and bumps) ---
      const bufSize = ctx.sampleRate * 2; // 2s looping white noise
      const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const output = noiseBuf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      // --- 2A. TYRE SCREECH & BRAKING SCRUB ---
      tyreNoiseSource = ctx.createBufferSource();
      tyreNoiseSource.buffer = noiseBuf;
      tyreNoiseSource.loop = true;

      tyreFilter = ctx.createBiquadFilter();
      tyreFilter.type = 'bandpass';
      tyreFilter.frequency.setValueAtTime(950, ctx.currentTime);
      tyreFilter.Q.setValueAtTime(3.2, ctx.currentTime);

      tyreGain = ctx.createGain();
      tyreGain.gain.setValueAtTime(0.0, ctx.currentTime);

      tyreNoiseSource.connect(tyreFilter);
      tyreFilter.connect(tyreGain);
      tyreGain.connect(masterGain);

      tyreNoiseSource.start();

      // --- 2B. CONTINUOUS SURFACE ROLLING TEXTURE (Gravel crunch / dirt roar / grass swish) ---
      surfaceNoiseSource = ctx.createBufferSource();
      surfaceNoiseSource.buffer = noiseBuf;
      surfaceNoiseSource.loop = true;

      surfaceFilter = ctx.createBiquadFilter();
      surfaceFilter.type = 'bandpass';
      surfaceFilter.frequency.setValueAtTime(600, ctx.currentTime);
      surfaceFilter.Q.setValueAtTime(1.5, ctx.currentTime);

      surfaceGain = ctx.createGain();
      surfaceGain.gain.setValueAtTime(0.0, ctx.currentTime);

      surfaceNoiseSource.connect(surfaceFilter);
      surfaceFilter.connect(surfaceGain);
      surfaceGain.connect(masterGain);

      surfaceNoiseSource.start();

      // --- 2C. SURFACE BUMPS & KERB CHATTER ---
      const bumpNoiseSource = ctx.createBufferSource();
      bumpNoiseSource.buffer = noiseBuf;
      bumpNoiseSource.loop = true;

      bumpFilter = ctx.createBiquadFilter();
      bumpFilter.type = 'lowpass';
      bumpFilter.frequency.setValueAtTime(260, ctx.currentTime);

      bumpGain = ctx.createGain();
      bumpGain.gain.setValueAtTime(0.0, ctx.currentTime);

      bumpNoiseSource.connect(bumpFilter);
      bumpFilter.connect(bumpGain);
      bumpGain.connect(masterGain);

      bumpNoiseSource.start();
    } catch {
      // AudioContext policy blocked or unsupported
    }
  }

  function update(car) {
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx.state !== 'running' || muted || volume <= 0.001) return;

    const now = ctx.currentTime;
    const spec = car.spec;
    const rpm = Math.max(spec.idleRpm * 0.9, car.rpm || spec.idleRpm);
    const speed = Math.hypot(car.vx, car.vy);

    // Firing frequency from cylinders
    const cyl = spec.cyl
      || (spec.id === 'muscle-rwd' ? 8
        : spec.id === 'tractor' ? 6 : spec.id === 'track-rwd' ? 6 : 4);
    const baseFreq = (rpm / 60) * (cyl / 2);

    // Smooth engine pitch glide
    oscCore.frequency.setTargetAtTime(baseFreq, now, 0.04);
    oscHarmonic.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.04);
    oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.05);

    // Throttle load opens acoustic intake filter
    const throttle = Math.max(0, Math.min(1,
      car.gear < 0 ? (car.brakeLight || 0) : (car.in ? car.in.throttle : 0)));
    const filterTarget = 240 + (rpm / spec.redline) * 1100 + throttle * 1200;
    engineFilter.frequency.setTargetAtTime(filterTarget, now, 0.06);

    const targetGain = 0.22 + (rpm / spec.redline) * 0.18 + throttle * 0.24;
    engineGain.gain.setTargetAtTime(targetGain, now, 0.04);

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

    const surfId = car.surface ? car.surface.id : 'tarmac';
    const isLoose = surfId === 'gravel' || surfId === 'rally' || surfId === 'dirt'
      || surfId === 'mud' || surfId === 'grass' || surfId === 'grassShort'
      || surfId === 'grassLong' || surfId === 'snow' || surfId === 'sand'
      || surfId === 'thickMud';

    // Screech activates when cornering hard (>0.62) or braking (>0.50)
    const squealThresh = isLoose ? 0.70 : 0.62;
    let targetSqueal = 0;
    if (speed > 1.8 && slipDemand > squealThresh) {
      targetSqueal = Math.min(0.42, (slipDemand - squealThresh) * 0.48 * Math.min(1, speed / 5.5));
    }
    tyreGain.gain.setTargetAtTime(targetSqueal, now, 0.04);

    // Screech pitch: high asphalt whine on tarmac, lower gritty churn on loose dirt/gravel
    if (isLoose) {
      tyreFilter.frequency.setTargetAtTime(450 + Math.min(300, speed * 10), now, 0.05);
      tyreFilter.Q.setTargetAtTime(1.8, now, 0.05);
    } else {
      tyreFilter.frequency.setTargetAtTime(950 + Math.min(650, speed * 22), now, 0.05);
      tyreFilter.Q.setTargetAtTime(3.2, now, 0.05);
    }

    // --- 3. CONTINUOUS SURFACE ROLLING TEXTURES ---
    if (surfaceGain && surfaceFilter) {
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
      surfaceGain.gain.setTargetAtTime(surfTarget, now, 0.05);
      surfaceFilter.frequency.setTargetAtTime(surfFreq, now, 0.05);
    }

    // --- 4. BUMP & KERB VERTICAL IMPACTS ---
    const vertSpeed = Math.abs(car.groundVF || 0) + Math.abs(car.groundVR || 0);
    const onKerb = surfId === 'kerb';
    let targetBump = 0;
    if (speed > 2.0 && (vertSpeed > 0.35 || onKerb)) {
      targetBump = Math.min(0.24, (vertSpeed * 0.10) + (onKerb ? 0.14 : 0));
    }
    bumpGain.gain.setTargetAtTime(targetBump, now, 0.03);
  }

  function setVolume(level) {
    volume = Math.max(0, Math.min(1, level));
    save();
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0.0 : volume, ctx.currentTime, 0.02);
    }
    return volume;
  }

  function toggleMute() {
    muted = !muted;
    save();
    if (masterGain && ctx) {
      masterGain.gain.setTargetAtTime(muted ? 0.0 : volume, ctx.currentTime, 0.03);
    }
    return muted;
  }

  return {
    init,
    update,
    setVolume,
    toggleMute,
    get volume() { return volume; },
    get muted() { return muted; },
    get state() { return ctx ? ctx.state : 'uninitialized'; },
    get ctx() { return ctx; },
  };
}

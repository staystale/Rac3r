import fs from 'node:fs';
const p = 'src/audio.ts';
let s = fs.readFileSync(p, 'utf8');
const r = (a, b) => { if (!s.includes(a)) throw new Error(a); s = s.replace(a, b); };
r(`interface AudioCar {
  vx: number; vy: number; rpm: number; gear: number;
  spec: { redline: number; idleRpm: number };
  surface?: { id: string };
  t: Record<string, number | boolean>;
  [field: string]: unknown;
}`, `interface AudioCar {
  vx: number; vy: number; rpm: number; gear: number;
  brakeLight?: number;   // the reverse throttle while backing up (gear < 0)
  groundVF?: number; groundVR?: number;   // the axles' vertical speed over bumps, m/s
  in?: { throttle: number };
  spec: { id: string; redline: number; idleRpm: number; cyl?: number };
  surface?: { id: string };
  t?: { satF?: number; satR?: number; slipSpeedF?: number; slipSpeedR?: number; lockedF?: boolean;
    lockedR?: boolean };
}`);
r(`    buildEngineVoice(state);
    const noiseBuf = buildNoiseBuffer(state);
    buildTyreNoise(state, noiseBuf);
    buildSurfaceNoise(state, noiseBuf);
    buildBumpVoice(state, noiseBuf);`, `    const live = state as LiveAudio;   // ctx and masterGain set just above
    buildEngineVoice(live);
    const noiseBuf = buildNoiseBuffer(live);
    buildTyreNoise(live, noiseBuf);
    buildSurfaceNoise(live, noiseBuf);
    buildBumpVoice(live, noiseBuf);`);
r(`  updateEngineVoice(state, car, now);
  const surfId = car.surface ? car.surface.id : 'tarmac';
  updateTyreNoise(state, car, now, speed, surfId);
  updateSurfaceNoise(state, now, speed, surfId);
  updateBumpVoice(state, car, now, speed, surfId);`, `  const live = state as LiveAudio;   // initAudio made the context and the master gain together
  updateEngineVoice(live, car, now);
  const surfId = car.surface ? car.surface.id : 'tarmac';
  updateTyreNoise(live, car, now, speed, surfId);
  updateSurfaceNoise(live, now, speed, surfId);
  updateBumpVoice(live, car, now, speed, surfId);`);
r('  const telem = car.t || {};', '  const telem: NonNullable<AudioCar[\'t\']> = car.t || {};');
r('function load(key: string, fallback: string) {', 'function load(key: string, fallback: string | number) {');
r('    ? (window.AudioContext || window.webkitAudioContext) : null;',
  '    ? (window.AudioContext\n      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)\n    : null;');
s = s.replace(/  const state = \{\n    ctx: null,/, '  const state = {\n    ctx: null,');
const i = s.indexOf('  const state = {\n    ctx: null,');
const j = s.indexOf('\n  };\n', i);
s = s.slice(0, j) + '\n  } as unknown as AudioState;   // the voices are built by initAudio' + s.slice(j + 5);
r('    update: (car) => updateAudio(state, car),', '    update: (car: AudioCar) => updateAudio(state, car),');
r('    setVolume: (level) => setVolume(state, level),', '    setVolume: (level: number) => setVolume(state, level),');
fs.writeFileSync(p, s);
console.log('ok');

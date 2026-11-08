import fs from 'node:fs';
const p = 'src/audio.ts';
let s = fs.readFileSync(p, 'utf8');
const head = `/** The engine voice: oscillators -> shaper -> filter -> formant -> gain. */
interface EngineVoice {
  gain: GainNode; filter: BiquadFilterNode; formant: BiquadFilterNode; shaper: WaveShaperNode;
  oscCore: OscillatorNode; oscSub: OscillatorNode; oscHarmonic: OscillatorNode;
}
/** A noise voice: looping noise -> filter -> gain. */
interface NoiseVoice { noiseSource: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode }
/** The audio state. The voices' nodes are built by initAudio before any update reads them. */
interface AudioState {
  ctx: AudioContext | null; masterGain: GainNode | null;
  volume: number; muted: boolean;   // remembered between sessions
  engine: EngineVoice; tyre: NoiseVoice; surface: NoiseVoice;
  bump: { filter: BiquadFilterNode; gain: GainNode };
}
/** The audio state once its context and master gain exist. */
type LiveAudio = AudioState & { ctx: AudioContext; masterGain: GainNode };
/** What the audio reads of the car. */
interface AudioCar {
  vx: number; vy: number; rpm: number; gear: number;
  spec: { redline: number; idleRpm: number };
  surface?: { id: string };
  t: Record<string, number | boolean>;
  [field: string]: unknown;
}

`;
const i = s.indexOf('/**\n * Reads a stored setting.');
if (i < 0) throw new Error('head');
s = s.slice(0, i) + head + s.slice(i);
fs.writeFileSync(p, s);
console.log('ok');

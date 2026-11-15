// audiosiren.ts - THE POLICE SIREN (?siren=1): voices of the sound engine (audio.ts), one for each
// of the nearest chasing police cars (game/sirens.ts picks them), synthesised as the engine is -
// no sound files. A square-wave carrier's pitch is swept by a slow oscillator (the sweep) on the
// audio thread, so the pattern itself costs no per-frame work; per frame only each voice's level,
// pan and brightness follow its car. Its visual twin is the flashing light bar
// (render/lightbar.ts), which shows the same state: a police car chasing.

/** A siren pattern: the two pitches it moves between, how fast, and the sweep's shape. */
export interface SirenTone {
  lowHz: number;
  highHz: number;
  // whole cycles (low and high) a second
  cycleHz: number;
  // the sweep: 'square' steps between the two pitches, 'triangle' slides between them
  shape: 'square' | 'triangle' | 'sine' | 'sawtooth';
  // Hz, the sweep's smoothing low-pass: a square's step takes about 1 / (2 pi glideHz) s
  glideHz: number;
}

/** The patterns: SIREN_TONE picks the one the game plays. */
export const SIREN_TONES: Record<'twotone' | 'wail' | 'yelp', SirenTone> = {
  // the UK two-tone (hi-lo, "nee-naw"): two pitches a fourth apart, ~0.6 s each, a short glide
  twotone: { lowHz: 600, highHz: 800, cycleHz: 0.85, shape: 'square', glideHz: 12 },
  // the wail: a slow rise and fall, ~4.5 s a cycle
  wail: { lowHz: 600, highHz: 1350, cycleHz: 0.22, shape: 'triangle', glideHz: 200 },
  // the yelp: the same sweep, ~3 times a second
  yelp: { lowHz: 600, highHz: 1350, cycleHz: 3.2, shape: 'triangle', glideHz: 200 },
};
/** The pattern the game plays (the two-tone reads as British and as police at once). */
export const SIREN_TONE: keyof typeof SIREN_TONES = 'twotone';

/** Sirens heard at once at most: the nearest chasers (more would be a wall of noise). */
export const SIREN_VOICES = 2;
// a voice's level right beside you: measured (tools/scratch/_sirenwav.mjs) at 25 m about 10 dB
// under the engine at a steady 110 km/h; higher in pitch, it reads over it
const SIREN_GAIN = 0.5;
// m at which a siren is at half its level beside you (a gentle fall: a siren carries)
const NEAR_M = 30;
// m beyond which a siren is not heard, and the m before that over which it fades to nothing
const HEAR_M = 260, FADE_M = 80;
// m across (east-west: the view is north-up) at which a siren is panned fully to its side, and
// how far that side goes (never all in one ear)
const PAN_M = 40, PAN_MAX = 0.8;
// Hz, the tone's low-pass beside you and far off: a distant siren is duller (the air takes the
// highs), a near one bright
const BRIGHT_NEAR_HZ = 4200, BRIGHT_FAR_HZ = 1400;
// s, the time constant of the level, pan and brightness following the car: a chase's start or
// end is heard within ~0.2 s, a car's move glides
const FOLLOW_TC_S = 0.06;
// s the second voice's pattern starts after the first's: two sirens never in step
const PHASE_S = 0.37;

/** One siren voice: carrier -> tone -> level -> pan -> out; the sweep drives the carrier. */
export interface SirenVoice {
  carrier: OscillatorNode;
  sweep: OscillatorNode;
  tone: BiquadFilterNode;
  level: GainNode;
  pan: StereoPannerNode | null;
  // its level target is above zero (a silent voice is not re-set every frame)
  isSounding: boolean;
}

/** A voice's car this frame: whether it sounds, and where, m from the listener (world axes). */
export interface SirenSpot { isOn: boolean; dx: number; dy: number }

/**
 * Builds one siren voice, silent, its pattern running from startS.
 * @param ctx the audio context (a live or an offline one)
 * @param out the node it plays into (the master gain)
 * @param tone the pattern
 * @param startS audio clock time its pattern starts, s
 * @returns the voice
 */
export function buildSirenVoice(ctx: BaseAudioContext, out: AudioNode, tone: SirenTone,
  startS: number): SirenVoice {
  const carrier = ctx.createOscillator();
  carrier.type = 'square';
  carrier.frequency.value = (tone.lowHz + tone.highHz) / 2;
  const sweep = ctx.createOscillator();
  sweep.type = tone.shape;
  sweep.frequency.value = tone.cycleHz;
  const glide = ctx.createBiquadFilter();
  glide.type = 'lowpass';
  glide.frequency.value = tone.glideHz;
  // dB: about a Butterworth response, so a step neither rings nor overshoots the pitch
  glide.Q.value = -3;
  const depth = ctx.createGain();
  depth.gain.value = (tone.highHz - tone.lowHz) / 2;
  sweep.connect(glide);
  glide.connect(depth);
  depth.connect(carrier.frequency);
  const voiceTone = ctx.createBiquadFilter();
  voiceTone.type = 'lowpass';
  voiceTone.frequency.value = BRIGHT_FAR_HZ;
  const level = ctx.createGain();
  level.gain.value = 0;
  carrier.connect(voiceTone);
  voiceTone.connect(level);
  const pan = typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  if (pan) {
    level.connect(pan);
    pan.connect(out);
  } else level.connect(out);
  carrier.start(startS);
  sweep.start(startS);
  return { carrier, sweep, tone: voiceTone, level, pan, isSounding: false };
}

/**
 * Builds the siren voices (SIREN_VOICES, each pattern a little after the last), silent; in a page,
 * they fall silent while it is hidden (no frame runs then to end a chase's siren).
 * @param ctx the audio context
 * @param out the node they play into (the master gain)
 * @param tone the pattern (SIREN_TONE's by default)
 * @returns the voices
 */
export function buildSirens(ctx: BaseAudioContext, out: AudioNode,
  tone: SirenTone = SIREN_TONES[SIREN_TONE]): SirenVoice[] {
  const voices: SirenVoice[] = [];
  for (let i = 0; i < SIREN_VOICES; i++)
    voices.push(buildSirenVoice(ctx, out, tone, ctx.currentTime + i * PHASE_S));
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      for (const voice of voices) silenceSiren(voice, ctx.currentTime);
    });
  }
  return voices;
}

/**
 * How near a siren sounds: 1 beside you, 0.5 at NEAR_M, fading to 0 by HEAR_M.
 * @param distM its distance from the listener, m
 * @returns 0..1
 */
export function sirenNearness(distM: number): number {
  const fall = NEAR_M / (NEAR_M + distM);
  const edge = Math.min(1, Math.max(0, (HEAR_M - distM) / FADE_M));
  return fall * edge;
}

/**
 * A voice's level to nothing (once: a silent voice is left alone).
 * @param voice the voice
 * @param now audio clock time, s
 */
function silenceSiren(voice: SirenVoice, now: number) {
  if (!voice.isSounding) return;
  voice.level.gain.setTargetAtTime(0, now, FOLLOW_TC_S);
  voice.isSounding = false;
}

/**
 * How many siren voices are sounding (tools read it: the hidden number behind the sound).
 * @param voices the voices
 * @returns the count
 */
export function countSounding(voices: SirenVoice[]): number {
  let count = 0;
  for (const voice of voices) if (voice.isSounding) count++;
  return count;
}

/**
 * One frame of the sirens: each voice's level, pan and brightness follow its car, a voice with no
 * car falls silent. No allocation.
 * @param voices the voices
 * @param spots each voice's car this frame (as many as the voices)
 * @param now audio clock time, s
 */
export function updateSirenVoices(voices: SirenVoice[], spots: SirenSpot[], now: number) {
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i], spot = spots[i];
    if (!spot || !spot.isOn) {
      silenceSiren(voice, now);
      continue;
    }
    const nearness = sirenNearness(Math.hypot(spot.dx, spot.dy));
    voice.level.gain.setTargetAtTime(SIREN_GAIN * nearness, now, FOLLOW_TC_S);
    voice.isSounding = nearness > 0;
    voice.tone.frequency.setTargetAtTime(
      BRIGHT_FAR_HZ + (BRIGHT_NEAR_HZ - BRIGHT_FAR_HZ) * nearness, now, FOLLOW_TC_S);
    if (voice.pan) {
      const across = Math.min(1, Math.max(-1, spot.dx / PAN_M));
      voice.pan.pan.setTargetAtTime(across * PAN_MAX, now, FOLLOW_TC_S);
    }
  }
}

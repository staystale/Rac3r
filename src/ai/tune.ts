// ai/tune.ts - THE AI DRIVERS SLIDERS (the AI rework R3 + K15, passed 11-04; owner: "leave
// em for now and discuss how it works with me"). Six field-wide dials, each 0..1, that a difficulty
// presets: SKILL (the field's centre), SPREAD (how different its drivers are: 0.5 = the spread
// the game always had), RISK, AGGRESSION, DEFENCE (each the field's centre, 0.5 = as before) and
// MISTAKES (0.5 = x1). A dial moves the whole field; each driver keeps its own place round it
// (persona + chance, ai/traits.ts), so a better driver stays better.
// A seventh, PACE (passed 11-15; 0.5 = x1): every driver's speed plan - its corner and braking grip
// (ai/line.ts K_CORNER, K_BRAKE) - x paceOf(pace).

import { debugValue } from "../core/debug.ts";

/** The field's AI dials, each 0..1; custom once a dial moved off the difficulty's preset. */
export interface AiTune {
  skill: number; spread: number; risk: number; aggression: number; defence: number;
  mistakes: number; custom?: boolean;
  pace?: number;   // absent (dials kept before PACE): 0.5
}

// the speed plan's grip x this at PACE 0 and at PACE 1 (0.5 = x1). MEASURED (bug 9, _aislip): the
// plan x1.15 was 6-8 % a lap quicker on tarmac and stayed on the road; x1.3-1.5 went off
const PACE_LOW = 0.8, PACE_HIGH = 1.3;

/**
 * The speed plan's multiplier for a PACE dial, rounded to 0.01 (the plans are cached per value).
 * @param pace the dial, 0..1 (0.5 = x1)
 * @returns the multiplier
 */
export function paceOf(pace: number): number {
  const dial = Math.max(0, Math.min(1, pace));
  const mul = dial < 0.5 ? 1 - (1 - PACE_LOW) * (0.5 - dial) / 0.5
    : 1 + (PACE_HIGH - 1) * (dial - 0.5) / 0.5;
  return Math.round(mul * 100) / 100;
}

// the field's SKILL centre by difficulty, Mobile .. Real (owner 11-04: "smaller championships
// have less skilled drivers than national events"); Realish, the default, 0.5
export const SKILL_CENTRE = [0.3, 0.4, 0.5, 0.6, 0.7];
// (passed 11-04; owner: "skilled drivers would take more risks maybe but control the car and
// crash less and overtake more"): the field's RISK and AGGRESSION rise with the difficulty too;
// Realish keeps 0.5
export const RISK_CENTRE = [0.38, 0.44, 0.5, 0.56, 0.62];
export const AGG_CENTRE = [0.4, 0.45, 0.5, 0.55, 0.6];
// THE PRESETS (owner 11-15, after tuning the dials live: "slightly higher skill overall and ever
// slightly on those other settings / That's a better baseline for realish ... keep the lean so they
// are faster still at real"): every difficulty's preset is its centre above + SKILL_UP skill and
// + LEAN_UP risk, aggression and pace - the same shift on each, so the lean between them stays.
// (Added to the preset, not to the centres: the centres are also the pace reference a driver's
// skill is read against, ai/traits.ts - as the owner moved the dials, not the centres.)
const SKILL_UP = 0.1, LEAN_UP = 0.03;
// the PACE dial's preset (0.5 = x1)
const PACE_PRESET = 0.5 + LEAN_UP;

// ?gapcommit, THE SLIDING SCALE (owner 11-21: "a tunable value per driver type, to taste"): the
// share of the gap picker's bonus for keeping its chosen line (ai/gapPick.ts COMMIT) a driver keeps
// while that line is the one holding it boxed - 1 = sticks to it (as before), 0 = none (moves for
// any roomier line). THE LEAN (owner 11-21): RACERS are loose with lanes and weave for gaps - the
// loose end; SPEEDERS (and police chasers: the racing driver at a traffic car's wheel,
// ai/trafficSpeeder.ts seatRacer) keep to lanes more, each its own value from the strict end up to
// a racer's, seeded per driver. The tools try others: __AI_COMMIT_RACER (the racers' value) and
// __AI_COMMIT_SPEEDER (the speeders' strict end).
export const COMMIT_BOXED = { racer: 0, speederStrict: 1 };

/**
 * A racer's share of the keep-the-line bonus while boxed (COMMIT_BOXED.racer, or a tool's dial).
 * @returns 0..1
 */
export function racerCommitBoxed(): number {
  const dial = debugValue('AI_COMMIT_RACER');
  return Math.max(0, Math.min(1, typeof dial === 'number' ? dial : COMMIT_BOXED.racer));
}

/**
 * A speeder's share: its own place between the strict end and a racer's, by its seed (the same
 * driver always the same; no draw from the traffic's random stream).
 * @param seed the driver's seed
 * @returns 0..1
 */
export function speederCommitBoxed(seed: number): number {
  const dial = debugValue('AI_COMMIT_SPEEDER');
  const strict = Math.max(0, Math.min(1, typeof dial === 'number' ? dial
    : COMMIT_BOXED.speederStrict));
  const share = (Math.imul(seed | 0, 2654435761) >>> 0) / 4294967296;
  return strict + (racerCommitBoxed() - strict) * share;
}

/**
 * A difficulty's preset dials.
 * @param diff the difficulty, 0 (Mobile) .. 4 (Real)
 * @returns the dials
 */
export function tuneOf(diff: number): AiTune {
  const row = Math.max(0, Math.min(4, diff | 0));
  const unit = (value: number) => Math.max(0, Math.min(1, value));
  return { skill: unit(SKILL_CENTRE[row] + SKILL_UP), spread: 0.5,
    risk: unit(RISK_CENTRE[row] + LEAN_UP), aggression: unit(AGG_CENTRE[row] + LEAN_UP),
    defence: 0.5, mistakes: 0.5, pace: PACE_PRESET };
}

/** The dials as the panel shows them: key, name, what it does. */
export const TUNE_DIALS: [keyof Omit<AiTune, 'custom'>, string, string][] = [
  ['skill', 'SKILL', 'PACE, LINE, REACTION, DODGING, FEWER ERRORS'],
  ['spread', 'SPREAD', 'HOW DIFFERENT THE DRIVERS ARE: ALL ALIKE .. ROOKIES WITH PROS'],
  ['risk', 'RISK', 'LATER BRAKING, FASTER ENTRIES - QUICKER; A WEAK DRIVER CRASHES MORE FOR IT'],
  ['aggression', 'AGGRESSION', 'GOES FOR GAPS, ATTACKS SOONER, BUMPS'],
  ['defence', 'DEFENCE', 'COVERS THE INSIDE, HARD TO PASS'],
  ['mistakes', 'MISTAKES', 'ERRORS A CORNER FOR EVERYONE - A BETTER DRIVER STILL MAKES FEWER'],
  ['pace', 'PACE', 'HOW HARD EVERY DRIVER PUSHES: CORNER SPEED AND BRAKING - '
    + 'HIGHER IS QUICKER UNTIL THEY RUN OFF'],
];

/**
 * A dial's value as the panel writes it.
 * @param key the dial
 * @param value 0..1
 * @returns the words
 */
export function dialWords(key: string, value: number): string {
  if (key === 'mistakes') return 'x' + (value * 2).toFixed(1);
  if (key === 'pace') return 'x' + paceOf(value).toFixed(2);
  if (key === 'spread') {
    return value < 0.15 ? 'ALL ALIKE' : value < 0.4 ? 'CLOSE' : value < 0.65 ? 'MIXED'
      : value < 0.85 ? 'WIDE' : 'ROOKIES + PROS';
  }
  return value.toFixed(2);
}

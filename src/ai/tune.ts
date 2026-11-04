// ai/tune.ts - THE AI DRIVERS SLIDERS (the AI rework R3 + K15, passed 11-04; owner: "leave
// em for now and discuss how it works with me"). Six field-wide dials, each 0..1, that a difficulty
// presets: SKILL (the field's centre), SPREAD (how different its drivers are: 0.5 = the spread
// the game always had), RISK, AGGRESSION, DEFENCE (each the field's centre, 0.5 = as before) and
// MISTAKES (0.5 = x1). A dial moves the whole field; each driver keeps its own place round it
// (persona + chance, ai/traits.ts), so a better driver stays better.


/** The field's AI dials, each 0..1; custom once a dial moved off the difficulty's preset. */
export interface AiTune {
  skill: number; spread: number; risk: number; aggression: number; defence: number;
  mistakes: number; custom?: boolean;
}

// the field's SKILL centre by difficulty, Mobile .. Real (owner 11-04: "smaller championships
// have less skilled drivers than national events"); Realish, the default, 0.5
export const SKILL_CENTRE = [0.3, 0.4, 0.5, 0.6, 0.7];
// (passed 11-04; owner: "skilled drivers would take more risks maybe but control the car and
// crash less and overtake more"): the field's RISK and AGGRESSION rise with the difficulty too;
// Realish keeps 0.5
export const RISK_CENTRE = [0.38, 0.44, 0.5, 0.56, 0.62];
export const AGG_CENTRE = [0.4, 0.45, 0.5, 0.55, 0.6];

/**
 * A difficulty's preset dials.
 * @param diff the difficulty, 0 (Mobile) .. 4 (Real)
 * @returns the dials
 */
export function tuneOf(diff: number): AiTune {
  const row = Math.max(0, Math.min(4, diff | 0));
  return { skill: SKILL_CENTRE[row], spread: 0.5, risk: RISK_CENTRE[row],
    aggression: AGG_CENTRE[row], defence: 0.5, mistakes: 0.5 };
}

/** The dials as the panel shows them: key, name, what it does. */
export const TUNE_DIALS: [keyof Omit<AiTune, 'custom'>, string, string][] = [
  ['skill', 'SKILL', 'PACE, LINE, REACTION, DODGING, FEWER ERRORS'],
  ['spread', 'SPREAD', 'HOW DIFFERENT THE DRIVERS ARE: ALL ALIKE .. ROOKIES WITH PROS'],
  ['risk', 'RISK', 'LATER BRAKING, FASTER ENTRIES - QUICKER; A WEAK DRIVER CRASHES MORE FOR IT'],
  ['aggression', 'AGGRESSION', 'GOES FOR GAPS, ATTACKS SOONER, BUMPS'],
  ['defence', 'DEFENCE', 'COVERS THE INSIDE, HARD TO PASS'],
  ['mistakes', 'MISTAKES', 'ERRORS A CORNER FOR EVERYONE - A BETTER DRIVER STILL MAKES FEWER'],
];

/**
 * A dial's value as the panel writes it.
 * @param key the dial
 * @param value 0..1
 * @returns the words
 */
export function dialWords(key: string, value: number): string {
  if (key === 'mistakes') return 'x' + (value * 2).toFixed(1);
  if (key === 'spread') {
    return value < 0.15 ? 'ALL ALIKE' : value < 0.4 ? 'CLOSE' : value < 0.65 ? 'MIXED'
      : value < 0.85 ? 'WIDE' : 'ROOKIES + PROS';
  }
  return value.toFixed(2);
}

// ai/traits.js — the 5 difficulties, the personalities and aiTraits (from aidriver.js).
// ---- the 5 difficulties (PLAN.md §4): the CENTRE of the field's spread. pace = fraction of the profile; lineQ = how much of the racing
// line's width they use (the rest: nearer the middle); wander = m of slow drift off it; mistake = chance per corner of an error;
// slip = chance of a joker-tactics blunder (forgetting it, so +30 s).
export const DIFFICULTIES = [
  { id: 'mobile', name: 'Mobile game', pace: 0.80, lineQ: 0.55, wander: 1.8, mistake: 0.20, slip: 0.12 },
  { id: 'game', name: 'Game', pace: 0.86, lineQ: 0.72, wander: 1.2, mistake: 0.12, slip: 0.06 },
  { id: 'realish', name: 'Realish', pace: 0.91, lineQ: 0.86, wander: 0.7, mistake: 0.07, slip: 0.02 },
  { id: 'rich', name: "Real but you're rich", pace: 0.95, lineQ: 0.94, wander: 0.35, mistake: 0.035, slip: 0.005 },
  { id: 'real', name: 'Real', pace: 0.985, lineQ: 1.0, wander: 0.12, mistake: 0.015, slip: 0 },
];
// the GRADIENT: each AI is one PERSONALITY (user: "some drive better / some quicker / some more defensive / some more aggressive"),
// dealt round the field from a seed, plus a little noise, all centred on the chosen difficulty.
const PERSONAS = [
  { id: 'quick', pace: +0.02, skill: -0.15, aggression: 0.6, defence: 0.4 },        // faster, ragged
  { id: 'steady', pace: -0.015, skill: +0.3, aggression: 0.3, defence: 0.5 },      // drives better: on line, few errors
  { id: 'aggressive', pace: +0.01, skill: -0.05, aggression: 0.9, defence: 0.3 },  // goes for gaps, follows close, bumps
  { id: 'defensive', pace: -0.005, skill: +0.1, aggression: 0.25, defence: 0.9 },  // covers the inside, hard to pass
  { id: 'balanced', pace: 0, skill: 0, aggression: 0.5, defence: 0.5 },
];
export function aiTraits(diffIndex, i, n, seed = 1) {
  const D = DIFFICULTIES[Math.max(0, Math.min(4, diffIndex | 0))];
  let sd = (seed * 48271 + i * 7919 + 13) % 2147483647 || 1; const rnd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const P = PERSONAS[(i + Math.floor(seed)) % PERSONAS.length];
  const skill = Math.max(0, Math.min(1, 0.5 + P.skill + (rnd() - 0.5) * 0.3));
  const loose = 1.4 - skill * 0.8;   // 0.6 (skill 1) .. 1.4 (skill 0)
  return {
    diff: D.id, persona: P.id, skill,
    // PRECISION (user, 2026-10-04: "a little bit messy is good, but tighter, faster driving at harder difficulty, like real life";
    // "crashing should reduce with higher difficulty"): 0 Mobile .. 1 Real, nudged by skill. Tighter gaps, and the car ahead's braking
    // for the corner is ANTICIPATED (below) instead of reacted to.
    prec: Math.max(0, Math.min(1, (diffIndex | 0) / 4 + (skill - 0.5) * 0.2)),
    pace: Math.min(1, D.pace * (1 + P.pace + (rnd() - 0.5) * 0.01)),
    lineQ: Math.min(1, D.lineQ + (skill - 0.5) * 0.1),
    wander: D.wander * loose, mistake: D.mistake * loose, slip: D.slip * loose,
    aggression: Math.max(0, Math.min(1, P.aggression + (rnd() - 0.5) * 0.2)),
    defence: Math.max(0, Math.min(1, P.defence + (rnd() - 0.5) * 0.2)),
    seed: sd,
  };
}

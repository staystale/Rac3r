// ai/traits.js — the 5 difficulties, the personalities and aiTraits (from aidriver.js).
import type { Difficulty, Traits } from "./types.ts";
import { K_BRAKE } from "./line.ts";
import { SKILL_CENTRE, tuneOf } from "./tune.ts";
import type { AiTune } from "./tune.ts";

// ---- the 5 difficulties (PLAN.md §4): the CENTRE of the field's spread. pace = fraction of the
// profile; lineQ = how much of the racing line's width they use (the rest: nearer the middle);
// wander = m of the highway driver's sway; mistake = chance per corner of an error; slip =
// chance of a joker-tactics blunder (forgetting it, so +30 s).
export const DIFFICULTIES: Difficulty[] = [
  {
    id: 'mobile', name: 'Mobile game',
    pace: 0.80, lineQ: 0.55, wander: 1.8, mistake: 0.20, slip: 0.12,
  },
  { id: 'game', name: 'Game', pace: 0.86, lineQ: 0.72, wander: 1.2, mistake: 0.12, slip: 0.06 },
  {
    id: 'realish', name: 'Realish',
    pace: 0.91, lineQ: 0.86, wander: 0.7, mistake: 0.07, slip: 0.02,
  },
  {
    id: 'rich', name: "Real but you're rich",
    pace: 0.95, lineQ: 0.94, wander: 0.35, mistake: 0.035, slip: 0.005,
  },
  { id: 'real', name: 'Real', pace: 0.985, lineQ: 1.0, wander: 0.12, mistake: 0.015, slip: 0 },
];
// the GRADIENT: each AI is one PERSONALITY (requirement: some drive better / some quicker / some
// more defensive / some more aggressive), dealt round the field from a seed, plus a little noise,
// all centred on the chosen difficulty.
const PERSONAS = [
  // faster, ragged
  { id: 'quick', pace: +0.02, skill: -0.15, aggression: 0.6, defence: 0.4 },
  // drives better: on line, few errors
  { id: 'steady', pace: -0.015, skill: +0.3, aggression: 0.3, defence: 0.5 },
  // goes for gaps, follows close, bumps
  { id: 'aggressive', pace: +0.01, skill: -0.05, aggression: 0.9, defence: 0.3 },
  // covers the inside, hard to pass
  { id: 'defensive', pace: -0.005, skill: +0.1, aggression: 0.25, defence: 0.9 },
  { id: 'balanced', pace: 0, skill: 0, aggression: 0.5, defence: 0.5 },
];
// SKILL BY DIFFICULTY (owner 11-04: "less skilled at lower difficulties and more skilled at
// higher ... it should vary over the grid ... like real life, smaller championships have less
// skilled drivers than national events"): the field's SKILL centre by difficulty, Mobile ..
// Real; each driver keeps its persona's offset and its own spread round it, so the fields
// overlap. Realish (the default) keeps 0.5. (SKILL_CENTRE lives in ai/tune.ts.)

/**
 * One AI's traits: its difficulty and its place in the field round the field's dials (R3, passed
 * 11-04; the AI DRIVERS panel, or the difficulty's preset).
 * @param diffIndex the difficulty, 0..4
 * @param i the AI's place in the field
 * @param fieldSize the field's size (unused: the deal is by place)
 * @param seed the race's seed
 * @param tune the dials (the difficulty's preset by default)
 * @returns the traits
 */
export function aiTraits(diffIndex: number, i: number, fieldSize: number, seed = 1,
  tune: AiTune = tuneOf(diffIndex)): Traits {
  return tunedTraits(diffIndex, i, seed, tune);
}

// (R3) each persona's RISK, as an offset from the field's (quick and aggressive
// drivers brake later, steady ones earlier)
const PERSONA_RISK: Record<string, number> = { quick: 0.2, steady: -0.15, aggressive: 0.15,
  defensive: -0.05, balanced: 0 };
// pace a unit of skill above the difficulty's centre gives (owner 11-04: "higher skill drivers
// should just be faster"), and a unit of risk above 0.5
const SKILL_PACE = 0.06, RISK_PACE = 0.03;
// braking grip planned a unit of risk above 0.5 (K_BRAKE 0.70; 0.80 ran hot on gravel, line.ts)
const RISK_BRAKE = 0.1;
// a risky WEAK driver crashes more for it (x up to 1 + RISK_ERR at risk 1, skill 0); a skilled
// one hardly (owner: "higher skill drivers ... still not crash too much")
const RISK_ERR = 1.2;
// aggression a unit of skill above 0.5 adds (owner: "faster and more aggressive")
const SKILL_AGG = 0.2;
// risk a unit of skill above the field's centre adds (a better driver in a field pushes
// harder; the crash cost of risk still falls on the weak - RISK_ERR)
const SKILL_RISK = 0.3;
// engine power at skill 0 (the top speed a weak driver gives away; owner: "not that extreme")
const WEAK_POWER = 0.95;

const unit = (value: number) => Math.max(0, Math.min(1, value));

/**
 * One AI's traits from the field's dials (ai/tune.ts) - the dial is the field's
 * centre, the persona and chance its own place round it, scaled by SPREAD.
 * @param diffIndex the difficulty, 0..4 (pace, line, mistakes)
 * @param i the AI's place in the field
 * @param seed the race's seed
 * @param tune the dials
 * @returns the traits
 */
function tunedTraits(diffIndex: number, i: number, seed: number, tune: AiTune): Traits {
  const diff = Math.max(0, Math.min(4, diffIndex | 0)), difficulty = DIFFICULTIES[diff];
  let rngState = (seed * 48271 + i * 7919 + 13) % 2147483647 || 1;
  const rnd = () => {
    rngState = (rngState * 16807) % 2147483647;
    return rngState / 2147483647;
  };
  const persona = PERSONAS[(i + Math.floor(seed)) % PERSONAS.length], wide = tune.spread * 2;
  const skill = unit(tune.skill + (persona.skill + (rnd() - 0.5) * 0.3) * wide);
  const risk = unit(tune.risk + (PERSONA_RISK[persona.id] + (rnd() - 0.5) * 0.3) * wide
    + SKILL_RISK * (skill - tune.skill));
  const loose = 1.4 - skill * 0.8;   // 0.6 (skill 1) .. 1.4 (skill 0)
  const errors = tune.mistakes * 2 * (1 + RISK_ERR * (risk - 0.5) * (1 - skill));
  const pace = difficulty.pace * (1 + persona.pace * wide + (rnd() - 0.5) * 0.01)
    * (1 + SKILL_PACE * (skill - SKILL_CENTRE[diff])) * (1 + RISK_PACE * (risk - 0.5));
  return {
    diff: difficulty.id, persona: persona.id, skill, risk,
    prec: unit(diff / 4 + (skill - 0.5) * 0.2),
    pace: Math.min(1, pace),
    lineQ: Math.min(1, difficulty.lineQ + (skill - 0.5) * 0.1),
    wander: difficulty.wander * loose,
    mistake: Math.max(0, difficulty.mistake * loose * errors),
    slip: difficulty.slip * loose,
    aggression: unit(persona.aggression + (tune.aggression - 0.5) + SKILL_AGG * (skill - 0.5)
      + (rnd() - 0.5) * 0.2),
    defence: unit(persona.defence + (tune.defence - 0.5) + (rnd() - 0.5) * 0.2),
    // PRECISION (requirement: tighter, faster driving at harder difficulty; "crashing should
    // reduce with higher difficulty") is above: 0 Mobile .. 1 Real, nudged by skill
    // (rounded so the drivers share speed profiles: line.ts caches one per braking grip)
    kBrake: Math.round((K_BRAKE + RISK_BRAKE * (risk - 0.5)) * 100) / 100,
    power: skill < 0.5 ? 1 - (1 - WEAK_POWER) * (0.5 - skill) / 0.5 : 1,
    seed: rngState,
  };
}

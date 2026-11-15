// game/aitune.ts - THE AI DRIVERS DIALS, LIVE (?aipace=1, test mode): from the pause menu
// (menu/aidrivers.ts showLiveDials) a dial moves the field racing now. Each racer is dealt again
// from its own place in the field (game/grid.ts seat: its index, the field's size, the race's
// seed) with the new dials, and its traits are changed in place - its driver's steps read them
// as they go (pace, line, mistakes, risk, aggression, defence, the speed plan's PACE); its engine
// share (a weak driver's power) follows its skill. Not live: its reaction time (ai/reaction.ts,
// set from its skill when the driver was made) and its random stream.
import { aiTraits } from '../ai/traits.ts';
import { tuneOf } from '../ai/tune.ts';
import type { AiTune } from '../ai/tune.ts';
import { shared, game } from './state.ts';

/**
 * The dials the field races with now.
 * @returns the dials
 */
export function fieldTune(): AiTune {
  return shared.aiTune || tuneOf(shared.aiDiff);
}

/**
 * The dials the field was launched with.
 * @returns the dials
 */
export function fieldTuneStart(): AiTune {
  return shared.aiTuneStart || tuneOf(shared.aiDiff);
}

/**
 * Deals the field racing now again with these dials (and keeps them for a RESTART).
 * @param tune the dials
 */
export function retuneField(tune: AiTune): void {
  shared.aiTune = tune;
  for (const entry of game.ai) {
    if (!entry.seat) continue;
    const traits = entry.drv.traits, { index, count, seed } = entry.seat;
    const fresh = aiTraits(shared.aiDiff, index, count, seed, tune);
    entry.car.mods.power *= (fresh.power ?? 1) / (traits.power ?? 1);
    Object.assign(traits, fresh);
  }
}

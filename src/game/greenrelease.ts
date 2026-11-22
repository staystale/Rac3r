// game/greenrelease.ts - THE ROLLING START'S RELEASE, PER AI DRIVER (owner 11-21, item
// 10: "a few drivers rarely jump the green slightly", "reaction at the green by skill and
// personality", two by two to the line as now). MEASURED before (tools/scratch/_rollgreen.mjs, 4
// seeds): the whole field let go of the formation on the same step at the green, every car gaining
// speed 0.9-1.1 s later; Dieatona's order did not change in 10 s in 3 of 4 seeds. Now each driver
// keeps its formation place until its own REACTION after the green - quicker for a more skilled
// driver, quicker for the quick and aggressive, slower for the steady and defensive - and now and
// then (a share by its risk) a driver JUMPS: it goes a fraction of a second before the green. The
// values are a driver's own, from its seed (no draw from the game's random stream). The start phase
// it then races (ai/driverLane.ts goT) begins at its release, not at the formation's first move.
import { game } from './state.ts';
import type { AiEntry } from './state.ts';
import type { Traits } from '../ai/types.ts';

// s a driver takes to react to the green: skill 1, skill 0 (a real driver: ~0.2-0.4 s)
export const REACT_TOP_S = 0.15, REACT_WEAK_S = 0.45;
// s quicker (-) or slower (+) by personality
const PERSONA_REACT_S: Record<string, number> = { quick: -0.05, aggressive: -0.05, steady: 0.05,
  defensive: 0.05, balanced: 0 };
// the share of drivers that go on the green itself (once they jumped it): at risk 0, plus this
// much at risk 1
export const JUMP_SHARE = 0.05, JUMP_SHARE_RISK = 0.1;

/** A driver's release at the green: s after it. */
type Release = { atS: number };
const RELEASES = new WeakMap<AiEntry, Release>();

/**
 * A number 0..1 from a driver's seed and a salt (the same driver, the same number).
 * @param seed the driver's seed
 * @param salt which number
 * @returns 0..1
 */
const seeded = (seed: number, salt: number) => (Math.imul((seed | 0) ^ salt, 2654435761)
  >>> 0) / 4294967296;

/**
 * A driver's release: its reaction by skill and personality, or now and then a jump.
 * @param traits the driver's traits
 * @returns its release
 */
export function releaseOf(traits: Traits): Release {
  const skill = Math.max(0, Math.min(1, traits.skill));
  const react = REACT_WEAK_S + (REACT_TOP_S - REACT_WEAK_S) * skill
    + (PERSONA_REACT_S[traits.persona] ?? 0);
  // (a driver who would have jumped it goes on the green itself: no early starts, owner 11-22)
  const jumps = seeded(traits.seed, 0x51ed) < JUMP_SHARE + JUMP_SHARE_RISK * (traits.risk ?? 0.5);
  return { atS: jumps ? 0 : Math.max(0.05, react) };
}

/**
 * Whether an AI is still held by the start: as the field (game/order.ts startHeld), or - on a
 * rolling start - until its own release (a reaction after the green, or on it).
 * @param entry the AI
 * @param fieldHeld the field's hold (startHeld)
 * @returns held
 */
export function heldAtGreen(entry: AiEntry, fieldHeld: boolean): boolean {
  if (!game.start.on || !game.start.rolling) return fieldHeld;
  let release = RELEASES.get(entry);
  if (!release) {
    release = releaseOf(entry.drv.traits as Traits);
    RELEASES.set(entry, release);
  }
  // (no car goes before the green: owner 11-22)
  if (fieldHeld) return true;
  return game.start.t - game.start.tGreen < release.atS;
}

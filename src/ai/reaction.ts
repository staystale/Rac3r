// ai/reaction.ts - REACTION TIME (?aireact, the AI rework R1; docs/specs/ai-rework.md). A driver
// THINKS every THINK_TOP s (skill 1) .. THINK_WEAK s (skill 0) instead of every physics step, its
// first think staggered by its seed so the field never all thinks on the same step; between
// thinks its pedals and steering GLIDE from where they were to the new aim, reaching it as the
// next think comes - never a step change (the car rate-limits the steering wheel on top). A real
// driver reacts in 0.15-0.3 s, so 2-4 steps is well inside it; the thinking (~1/3 of an AI car's
// cost, MEASURED 11-03) runs 2-4x less often.
import type { AiCar, DriveCtx, DriveInput } from './types.ts';

// s between thinks: a top driver (skill 1), a weak one (skill 0)
export const THINK_TOP = 1 / 60, THINK_WEAK = 1 / 30;
// s: slack on the think clock (the steps' sum drifts in floating point)
const CLOCK_SLACK = 1e-6;

/** A drive function, as the circuit and highway drivers have. */
type DriveFn = (car: AiCar, dt?: number, ctx?: DriveCtx) => DriveInput;
/** The context, or a maker run only when the driver thinks (the game's: a list of every car). */
export type CtxOrMaker = DriveCtx | (() => DriveCtx);

/**
 * The context itself, made if it is a maker.
 * @param ctx the context or its maker
 * @returns the context
 */
export const ctxOf = (ctx: CtxOrMaker): DriveCtx => (typeof ctx === 'function' ? ctx() : ctx);

/**
 * The seconds between one driver's thinks.
 * @param skill the driver's skill, 0..1
 * @returns s
 */
export function thinkEvery(skill: number): number {
  const sure = Math.max(0, Math.min(1, skill));
  return THINK_TOP + (1 - sure) * (THINK_WEAK - THINK_TOP);
}

/**
 * A driver with a reaction time: the drive function run every thinkEvery(skill) s with the time
 * since its last think, its controls gliding between.
 * @param inner the driver's own drive
 * @param skill the driver's skill, 0..1
 * @param seed the driver's seed (its first think's stagger)
 * @param hands the steering between thinks, onto the line the last think chose (null: glide)
 * @returns drive, the function the game calls every step, and forget (a reset car: think at once)
 */
export function withReaction(inner: DriveFn, skill: number, seed: number,
  hands?: (car: AiCar) => number | null) {
  const every = thinkEvery(skill);
  // s until the next think (the stagger: a share of the gap from the seed), s since the last
  let wait = ((Math.abs(seed) * 0.6180339887) % 1) * every, since = 0;
  let aim: DriveInput | null = null, from = { steer: 0, throttle: 0, brake: 0 };
  let out: DriveInput = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
  const drive = (car: AiCar, dt = 1 / 120, ctx: CtxOrMaker = {}): DriveInput => {
    const made = () => ctxOf(ctx);
    // a look without time passing (the formation's steer): straight through, the clock untouched
    if (dt <= 0) return inner(car, dt, made());
    since += dt;
    wait -= dt;
    if (!aim || wait <= CLOCK_SLACK) {
      const first = !aim;
      from = { steer: out.steer, throttle: out.throttle, brake: out.brake };
      aim = inner(car, since, made());
      // the first think is where it starts, no glide from rest
      if (first) from = { steer: aim.steer, throttle: aim.throttle, brake: aim.brake };
      since = 0;
      wait = Math.max(wait + every, dt / 2);
    }
    // the share of the way to the aim: all of it by the step before the next think
    const share = Math.max(0, Math.min(1, (every - wait + dt) / every));
    const glide = (key: 'steer' | 'throttle' | 'brake') => from[key] + (aim![key] - from[key])
      * share;
    // the hands keep steering onto the chosen line every step (not a handbrake turn's full lock)
    // (on a think step the think's own steer: it was just worked out from here)
    const held = !hands || aim.handbrake ? null : since > 0 ? hands(car) : aim.steer;
    out = { ...aim, steer: held ?? glide('steer'), throttle: glide('throttle'),
      brake: glide('brake') };
    return out;
  };
  const forget = () => { aim = null; since = 0; wait = 0; };
  return { drive, forget };
}

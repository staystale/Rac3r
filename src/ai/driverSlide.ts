// ai/driverSlide.ts - THE AI'S SLIDES BY THE GROUND (passed 11-15, TODO 3a2 bug 9). MEASURED before
// (tools/scratch/_aislip.mjs, one AI alone): the driver lifted, caught and tidied its slides at
// FIXED slip angles (rear 0.18 rad, front 0.14-0.20, the slip feel 0.07-0.19) while each ground's
// tyre peaks at its own (the physics' peak this step, car.t.aPeakR: tarmac ~0.12, gravel ~0.19,
// sand ~0.16, wet / snow / ice the 0.10 floor) - on gravel it never let the rear reach its peak,
// and on ice a slide past 0.18 was caught with the throttle shut to 0.2 (a hatch on Thruston's
// ice: 39 s a lap catching, no lap finished in 420 s).
// On SLIPPERY ground only (mu under SLIPPERY_MU; tarmac, wet or dry, as before -
// on wet tarmac the hold sent the cars off 3x as long, MEASURED):
// - HOLD A SLIDE: a rear slide in a corner, going the corner's way, is HELD on the throttle at
//   holdSlip (HOLD_K x the rear tyre's peak, HOLD_MIN..HOLD_MAX) - the drift law the loose
//   hairpins had (driverSteps.ts driftHold) - in any corner, for every driver, caught only past
//   CATCH_K x that or near the edge; on ice and snow (the floor peak) that is a slide of ~9 deg
//   driven through instead of a lift.
// - the catch, the understeer lift and the slip feel read the ground's peak too (OVER_K, UNDER_K,
//   the feel x the peak over tarmac's).
import { debugValue } from "../core/debug.ts";
import type { AiCar, Mistake } from "./types.ts";

// mu under which the ground is slippery (gravel 0.62, sand 0.55 ... ice 0.12; wet tarmac 0.72 not)
export const SLIPPERY_MU = 0.7;
// the slide held: x the rear tyre's peak slip angle, within these rad (the tools' dials
// __AI_HOLDK / __AI_HOLDMAX try others: tools/scratch/_aislip.mjs HOLDK / HOLDMAX)
const HOLD_K = 1.25, HOLD_MIN = 0.15, HOLD_MAX = 0.3;
// a held slide is caught past this many times the hold
const CATCH_K = 1.8;
// a slide not held (no corner, the wrong way) is caught past this many times the rear peak (never
// under the 0.18 rad of before)
const OVER_K = 1.6;
// the understeer lift past this many times the front peak (never under before's)
const UNDER_K = 1.3;
// rad: tarmac's rear peak, the slip feel's reference (driverPedals.ts throttleFor)
const FEEL_PEAK = 0.124;
// m from the edge a slide is held only with (driverSteps.ts EDGE_DRIFT's 2 m) x sqrt(ROOM_MU / mu)
// on lower grip - a slide on ice carries further (ice ~4.5 m, snow ~2.7 m, gravel 2 m)
const ROOM_M = 2, ROOM_MU = 0.6;
// MISTAKES THAT SLIDE (any ground): while a 'late' (in too fast) or 'throttle' (too much out of
// the corner) mistake runs in its corner (ai/driverLane.ts: drawn per corner by the driver's own
// random stream, its severity 0..1 larger the lower the skill), the slide is caught late - the
// catch angle x (1 + MIST_CATCH x severity) - and never held; a 'late' one is not tidied by the
// understeer lift either: it slides wide. MEASURED before (_aislip, realish, 5 drivers, 4 laps):
// of 90 mistakes none spun or left the road, on tarmac or gravel
const MIST_CATCH = 1.5;
// ... and the mistake itself bigger: a 'late' one's extra speed (1.06 + 0.14 x severity) and a
// 'throttle' one's time (0.3 + 0.5 x severity s) x this, so a weak driver's overcooked corner
// slides wide and its throttle slide can spin
export const MIST_GROW = 2;
// MISTAKES THAT SPIN (owner: "yes but rare-ish"): a 'late' or 'throttle' mistake is, by the
// driver's own random stream, one that SPINS with this chance x (1 - skill) - none at skill 1: its
// slide is never caught (no countersteer, no lift) and past the apex the throttle is held
// SPIN_THROTTLE_S s, so the rear comes round. A front-driven car seldom spins on the throttle.
const SPIN_SHARE = 0.25;
export const SPIN_THROTTLE_S = 1.2;
// ... and the wheel held turned in, this share of the lock, the corner's way: the hands keep
// turning instead of catching it (the steering law's own heading term catches a slide by itself)
const SPIN_LOCK = 0.7;

/**
 * The steer while a mistake spins: the wheel held into the corner (null: none running).
 * @param state the driver's state (spinUntil, spinTurn, its clock)
 * @param state.t s
 * @param state.spinUntil s
 * @param state.spinTurn the corner's way, +1 / -1
 * @returns the steer, -1..1, or null
 */
export function spinSteer(state: { t: number; spinUntil?: number; spinTurn?: number }) {
  if (!(state.t < (state.spinUntil ?? -Infinity))) return null;
  return (state.spinTurn || 1) * SPIN_LOCK;
}

/**
 * The chance a 'late' or 'throttle' mistake spins.
 * @param skill the driver's skill, 0..1
 * @returns 0..1
 */
export function spinChance(skill: number): number {
  return SPIN_SHARE * (1 - Math.max(0, Math.min(1, skill)));
}

/** What the driver feels of the ground's slide this step (the switch on, slippery ground). */
export interface SlideFeel {
  hold: number;     // rad of rear slip a slide is held at
  holdMax: number;  // rad past which a held slide is caught
  overAt: number;   // rad of rear slip past which a slide not held is caught
  underAt: number;  // rad of front slip past which it lifts (understeer)
  feelK: number;    // the slip feel's angles x this
  room: number;     // m from the edge a slide is held only with
}

const feel: SlideFeel = { hold: 0, holdMax: 0, overAt: 0, underAt: 0, feelK: 1, room: 0 };

/**
 * The slide feel for this step, or null: the switch off, or grippy ground (as before).
 * @param car the car
 * @param underBefore rad: the understeer lift's angle as before (by the ground's looseness)
 * @returns the feel (shared: read before the next call), or null
 */
export function slideFeel(car: AiCar, underBefore: number): SlideFeel | null {
  if (!(car.surface.mu < SLIPPERY_MU)) return null;
  const peakRear = car.t.aPeakR ?? 0.1, peakFront = car.t.aPeakF ?? 0.1;
  const holdK = debugValue("AI_HOLDK") as number || HOLD_K;
  const holdMax = debugValue("AI_HOLDMAX") as number || HOLD_MAX;
  feel.hold = Math.max(HOLD_MIN, Math.min(holdMax, holdK * peakRear));
  feel.holdMax = CATCH_K * feel.hold;
  feel.overAt = Math.max(0.18, OVER_K * peakRear);
  feel.underAt = Math.max(underBefore, UNDER_K * peakFront);
  feel.feelK = Math.max(1, peakRear / FEEL_PEAK);
  feel.room = ROOM_M * Math.max(1, Math.sqrt(ROOM_MU / Math.max(0.05, car.surface.mu)));
  return feel;
}

// the slide limits this step (reused: no allocation per step)
const limits = { overAt: 0, underAt: 0, mistaken: false };

/**
 * The rear slip a slide is caught past and the front slip the understeer lift starts at: as before
 * without the switch (0.18 rad, the ground's looseness), the ground's own on slippery ground, later
 * while a mistake runs.
 * @param slide the slide feel, or null
 * @param mist the driver's running mistake, or null
 * @param underBefore rad, the understeer lift's angle as before
 * @returns the limits (shared: read before the next call)
 */
export function slideLimits(slide: SlideFeel | null, mist: Mistake | null, underBefore: number) {
  limits.overAt = slide ? slide.overAt : 0.18;
  limits.underAt = slide ? slide.underAt : underBefore;
  limits.mistaken = false;
  if (mist && mist.inside && (mist.kind === 'late' || mist.kind === 'throttle')) {
    limits.overAt *= 1 + MIST_CATCH * mist.sev;
    if (mist.kind === 'late') limits.underAt = Infinity;
    // (a spinning one: never caught)
    if (mist.spin) {
      limits.overAt = Infinity;
      limits.underAt = Infinity;
    }
    limits.mistaken = true;
  }
  return limits;
}

/**
 * Whether a rear slide in a corner is HELD: the drive at the back (a front-driven car cannot hold
 * one on the throttle), the slip between half the hold and the catch, moving, and going the
 * corner's way - the car rotating as the line turns there (or barely rotating), so holding it
 * carries the car round; one rotating against the bend is caught.
 * @param car the car
 * @param slide the slide feel
 * @param slipRear rad, the rear slip now
 * @param speed m/s
 * @param turn the line's turn there (+1 / -1 / 0)
 * @returns true when held
 */
export function slideHeld(car: AiCar, slide: SlideFeel, slipRear: number, speed: number,
  turn: number): boolean {
  const goesRound = turn !== 0 && (Math.sign(car.yawRate) === turn || Math.abs(car.yawRate) < 0.1);
  return (car.spec.drive ?? 1) < 0.5 && slipRear > 0.5 * slide.hold && slipRear < slide.holdMax
    && speed > 6 && goesRound;
}

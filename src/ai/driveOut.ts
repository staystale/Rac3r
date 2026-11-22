// ai/driveOut.ts - a driver DRIVES ITSELF OUT when stuck (every AI driver; was in the highway
// weaver, ai/weaver.ts, deleted 11-04 with the one AI).
import { envValue } from "../core/debug.ts";
import type { AiCar, DriveCtx, DriveOutState } from "./types.ts";

// Nearly still for STUCK_T s after the green, wanting to go (nose in a wall, beached, tangled)
// -> REVERSE ~1-1.5 s with the wheel turned to swing the nose back toward the road direction
// roadH; three tries inside 15 s and still stuck -> state.giveUp (the game puts a stuck car back
// by its own watch, game/aistuck.ts; tools/aifieldcheck.mjs reads giveUp). Returns the reversing
// controls, or null = drive on. (NOOUT=1 env: node A/B only - proves the highway merge changed
// nothing else)
const NOOUT = !!envValue("NOOUT");
// s nearly still from which a car gaining speed is trying, not stuck
const DRIVE_OUT_T = 1.2;
// REVERSE ONLY WHEN STUCK (passed 11-22): s still, wanting to go, before a reverse (a real driver
// waits a little longer before he decides he is stuck; at 1.2 s, MEASURED tools/scratch/
// _revcount.mjs, Brands + Moanaco, 2 seeds: half the reverses were behind a car ahead), and the
// target m/s from which the plan wants to go
const STUCK_T = 2.5, WANTS_GO = 2;
// s still while held before the hold counts as a blockage, not a wait (MEASURED,
// tools/scratch/_stopside.mjs: cars boxed in behind stopped cars never reversed out - held to
// the stopped car ahead's speed, 0, they "waited" for good)
const HELD_T = 4;

/**
 * Whether a car's stillness is not being stuck - a car ahead holds it to its speed,
 * or its own plan stands still (a queue, a stopped car, the start): it waits, it does not reverse.
 * @param state the driver's state (the last think's follow, capBinds, vT)
 * @returns waiting, not stuck
 */
const waiting = (state: DriveOutState) => (!!state.follow && !!state.capBinds)
  || (state.vT ?? Infinity) < WANTS_GO;
// (A9) m/s gained since it went slow that says TRYING (an icy start creeping away), not
// stuck - MEASURED: a hatch at 0.9 m/s and climbing reversed on ice and spun its wheels backwards
const TRYING_GAIN = 0.08;
/**
 * Counts the seconds a car has been nearly still (state.slowT); going forwards and
 * gaining since it went slow, it is pulling away, so the count starts again.
 * @param state the driver's drive-out state
 * @param car the car
 * @param speed m/s
 * @param dt s
 */
function noteSlow(state: DriveOutState, car: AiCar, speed: number, dt: number) {
  state.heldT = waiting(state) && speed < 1.5 ? (state.heldT ?? 0) + dt : 0;
  if (state.heldT > 0 && state.heldT < HELD_T) {
    state.slowT = 0;
    state.slowFrom = undefined;
    return;
  }
  if (!(speed < 1.5)) state.slowFrom = undefined;
  else if (state.slowFrom === undefined) state.slowFrom = speed;
  state.slowT = speed < 1.5 ? (state.slowT || 0) + dt : 0;
  const forward = ((car.t as { vLong?: number }).vLong ?? 0) > 0;
  if (state.slowT > DRIVE_OUT_T && forward
    && speed - (state.slowFrom ?? speed) > TRYING_GAIN) {
    state.slowT = 0;
    state.slowFrom = speed;
  }
}

/**
 * The reversing controls while driving itself out, or null (drive on).
 * @param state the driver's drive-out state
 * @param car the car
 * @param speed m/s
 * @param dt s
 * @param ctx what the driver is told (hold: the start)
 * @param rnd the driver's random stream
 * @param roadH the road's heading here
 * @returns the controls, or null
 */
export function driveOut(
  state: DriveOutState, car: AiCar, speed: number, dt: number, ctx: DriveCtx,
  rnd: () => number, roadH: () => number,
) {
  if (ctx.hold || !(state.t > 3) || NOOUT) return null;
  if (state.t < (state.revUntil || 0)) {
    let headErr = roadH() - car.heading;
    headErr = Math.atan2(Math.sin(headErr), Math.cos(headErr));
    return { steer: -Math.sign(headErr || 1), throttle: 0, brake: 0, handbrake: 0, reverse: 1 };
  }
  noteSlow(state, car, speed, dt);
  if (state.slowT! > STUCK_T) {
    state.slowT = 0;
    state.revUntil = state.t + 1 + 0.5 * rnd();
    state.nOut = (state.nOut || 0) + 1;
    state.outN = state.t - (state.outAt ?? -99) < 15 ? (state.outN || 0) + 1 : 1;
    state.outAt = state.t;
    if (state.outN >= 3) state.giveUp = true;
  }
  return null;
}

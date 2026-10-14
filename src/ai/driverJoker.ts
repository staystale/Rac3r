// ai/driverJoker.ts: the circuit driver's joker tactics: who threatens, whether to take the
// joker this lap, and the approach to the switch point. Functions take the driver context.
import { GRAVITY } from "../cars.ts";
import { K_BRAKE, carGrip, profileOf } from "./line.ts";
import type { AiCar, DriveCtx, JokerCtx } from "./types.ts";
import type { Drv, AiPath } from "./driverCtx.ts";

/** TACTICS: a car close ahead (stuck behind it) / a jokered rival close behind. */
export function jokerThreats(drv: Drv, ctx: JokerCtx) {
  const selfCar = ctx.self; let ahead = false, coverIt = false;
  for (const other of ctx.cars || []) {
    const dx = other.x - selfCar.x, dy = other.y - selfCar.y, along = dx * Math.cos(
        selfCar.heading) + dy * Math.sin(selfCar.heading), gap = Math.hypot(dx, dy);
    if (along > 0 && gap < 30) ahead = true;
    if (along < 0 && gap < 25 && (other._jokers || 0) > 0) coverIt = true;
  }
  return { ahead, coverIt };
}

/** Decides, once per lap, whether this lap is the joker lap. */
export function decideJoker(drv: Drv, ctx: JokerCtx, lap: number, laps: number) {
  const { traits, rnd, branches, state } = drv;
  state.jDecLap = lap;
  if (!branches.joker || state.jokers > 0) { state.jWant = false; return; }
  // last chance (a low-skill driver may simply forget: +30 s)
  if (lap >= laps) {
    state.jWant = !state.jForget;
    return;
  }
  if (lap === state.jPlan) { state.jWant = true; return; }
  // TACTICS: stuck behind someone -> "jump" them with the joker (more likely the more
  // aggressive); a rival right behind who has
  // already jokered -> cover them now before they gain the clean air (more likely the more
  // defensive)
  const { ahead, coverIt } = jokerThreats(drv, ctx);
  state.jWant = (ahead && rnd() < 0.2 + 0.5 * traits.aggression) || (
      coverIt && rnd() < 0.2 + 0.5 * traits.defence);
}

/** Decides the joker once per lap, takes it at the switch point; returns the speed cap. */
export function jokerStep(drv: Drv, car: AiCar, ctx: DriveCtx, path: AiPath, nearIdx: number,
    lap: number, laps: number) {
  const { line, main, branches, count, state } = drv;
  const spec = car.spec;
  let jCap = Infinity;
  if (branches.joker && path === main) {
    const dSw = (((branches.joker.switchI! - nearIdx) % count) + count) % count * line.sp;
    if (dSw < 220 && state.jDecLap !== lap) decideJoker(drv, { ...ctx, self: car }, lap, laps);
    if (state.jWant) {
      const jokerSpeed = profileOf(branches.joker, spec, main)[0],
          brakeDecel = K_BRAKE * carGrip(spec).brakeG * GRAVITY * 0.8;
      jCap = Math.sqrt(jokerSpeed * jokerSpeed + 2 * brakeDecel * dSw);
      if (dSw <= 3) {
        state.path = branches.joker;
        state.i = 0;
        state.jokers++;
        state.jWant = false;
      }
    }
  }
  return jCap;
}

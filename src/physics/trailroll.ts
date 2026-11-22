// physics/trailroll.ts - THE TRAILER TIPS AND ROLLS (?trailroll; owner 11-22: "can the truck and
// trailer roll, or just the truck?" - the trailer too, realistic: a loaded semi-trailer goes over
// at ~0.45 g, before its cab). Was: only the tractor could tip or roll; its trailer, a second body
// on the pin (physics/trailer.ts), had no roll at all. MEASURED (tools/scratch/_rigg.mjs, flat
// tarmac): the tractor tipped at ~1 g (its static tip point track / 2 cg = 0.93 g) while the
// trailer stayed upright at 0.44-0.54 g - its static point 0.68 g, 0.60 g with the springs' roll.
// Now the trailer has the cars' two-wheel state (physics/tip.ts) on its own sideways acceleration,
// its springs, tyres and half load giving TRAILER_TIP_G; past its balance it goes over - the pin
// snaps and the trailer rolls and slides on its own (roll.ts stepRoll, game/sim.ts). A reset rights
// it (trailer.ts lineUpTrailer). Any tractor's trailer (the AI's and the traffic's tow none yet).
import { stepTipping } from './tip.ts';
import { rolling } from '../roll.ts';
import type { Spec } from '../cars.ts';
import type { Trailer } from './trailer.ts';

// g at which a loaded semi-trailer's inside wheels lift (the rollover-threshold literature's
// 0.35-0.45 g for a loaded articulated lorry; owner 11-22: realistic, ~0.45 g)
export const TRAILER_TIP_G = 0.45;

/**
 * The share of its static tip point a trailer's springs, tyres and load take off (tip.ts geometry's
 * give), so that it lifts at TRAILER_TIP_G.
 * @param spec the trailer's spec (its track and centre of gravity's height)
 * @returns 0..1
 */
export function trailerTipGive(spec: Spec): number {
  const halfT = (spec.trackWidth || 2) / 2, high = spec.cg || 1.5;
  return Math.max(0, 1 - TRAILER_TIP_G * high / halfT);
}

/**
 * After the trailer's step on its pin: its sideways acceleration (from its velocity's change this
 * step, the world's clamps included - a side hit too) feeds the two-wheel state; past its balance
 * it is rolling, and the pin snaps.
 * @param trailer the trailer
 * @param vx0 its velocity before the step, m/s
 * @param vy0 its velocity before the step, m/s
 * @param dt the step, s
 * @returns true when it went over this step
 */
export function stepTrailerTip(trailer: Trailer, vx0: number, vy0: number, dt: number): boolean {
  const accelX = (trailer.vx - vx0) / dt, accelY = (trailer.vy - vy0) / dt;
  const body = trailer as Trailer & { t?: { ay?: number } };
  // (its sideways acceleration, + toward its own left - as a car's car.t.ay)
  body.t = { ...body.t,
    ay: -accelX * Math.sin(trailer.heading) + accelY * Math.cos(trailer.heading) };
  stepTipping(body, dt);
  if (!rolling(trailer)) return false;
  trailer.pinFree = true;
  return true;
}

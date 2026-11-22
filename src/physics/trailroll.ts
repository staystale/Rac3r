// physics/trailroll.ts - THE TRAILER TIPS AND ROLLS (passed 11-22; owner 11-22: "can the truck and
// trailer roll, or just the truck?" - the trailer too, realistic: a loaded semi-trailer goes over
// at ~0.45 g, before its cab). Was: only the tractor could tip or roll; its trailer, a second body
// on the pin (physics/trailer.ts), had no roll at all. MEASURED (tools/scratch/_rigg.mjs, flat
// tarmac): the tractor tipped at ~1 g (its static tip point track / 2 cg = 0.93 g) while the
// trailer stayed upright at 0.44-0.54 g - its static point 0.68 g, 0.60 g with the springs' roll.
// Now the trailer has the cars' two-wheel state (physics/tip.ts) on its own sideways acceleration,
// its springs, tyres and half load giving TRAILER_TIP_G; past its balance it goes over - the pin
// snaps and the trailer rolls and slides on its own (roll.ts stepRoll, game/sim.ts). A reset rights
// it (trailer.ts lineUpTrailer). Any tractor's trailer (the AI's and the traffic's tow none yet).
import { stepTipping, tipPoint } from './tip.ts';
import { rolling } from '../roll.ts';
import type { Spec } from '../cars.ts';
import { holdOnPin } from './trailer.ts';
import type { Trailer } from './trailer.ts';
import type { Car } from '../vehicle.ts';

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
 * it is rolling (stepRigRoll: its cab with it, or the pin snapped).
 * @param trailer the trailer
 * @param vx0 its velocity before the step, m/s
 * @param vy0 its velocity before the step, m/s
 * @param dt the step, s
 * @returns true when it went over this step
 */
function stepTrailerTipOver(trailer: Trailer, vx0: number, vy0: number, dt: number): boolean {
  const accelX = (trailer.vx - vx0) / dt, accelY = (trailer.vy - vy0) / dt;
  const body = trailer as Trailer & { t?: { ay?: number } };
  // (its sideways acceleration, + toward its own left - as a car's car.t.ay)
  body.t = { ...body.t,
    ay: -accelX * Math.sin(trailer.heading) + accelY * Math.cos(trailer.heading) };
  stepTipping(body, dt);
  // (the hardest pull since it lifted: a side hit's, though the lean goes over later - coupleRoll)
  const tip = body as Trailer & { _tipPull?: number; _tipPeak?: number };
  tip._tipPeak = trailer.roll ? Math.max(tip._tipPeak ?? 0, Math.abs(tip._tipPull ?? 0)) : 0;
  return rolling(trailer);
}

// STEP 3: ROLLING TOGETHER (owner 11-22: "when a trailer tips: the cab follows if it's a gentler
// tip; the pin snaps and the trailer rolls alone if it's violent" - and the reverse): the fifth
// wheel carries so much roll moment. A body going over at a roll rate under ROLL_SNAP_W (a tip
// over its wheels goes at tip.ts OVER_W, 3.2 rad/s; a crash's or a jack-knife's trip faster -
// roll.ts startRoll, up to 14) drags the other over with it, at its rate, the pin held; faster,
// the pin snaps and it rolls alone. rad/s. And going over through its two-wheel state (always at
// OVER_W, however hard it was hit) after a pull past ROLL_SNAP_PULL times its own tip point since
// it lifted (a side hit, not a bend: a bend tips it at about its tip point) - violent too
export const ROLL_SNAP_W = 5, ROLL_SNAP_PULL = 1.6;

/** A rig's roll state on its trailer: rolling together, and the tractor's phase last step. */
type RigTrailer = Trailer & { rollTogether?: boolean; _cabRolled?: boolean };

/**
 * The other body taken over with one going over (the same way, the same rate), or the pin snapped.
 * @param from the body that went over (its roll rate)
 * @param other the other body
 * @param trailer the trailer (its pin, its together flag)
 * @returns true when they roll together
 */
function coupleRoll(from: Car, other: Car, trailer: RigTrailer): boolean {
  const tip = from as Car & { _tipPull?: number; _tipPeak?: number };
  const rate = from.roll?.w ?? 0, pull = Math.max(tip._tipPeak ?? 0, Math.abs(tip._tipPull ?? 0));
  // (one up on two wheels already goes over with it; one already rolling cannot be dragged)
  if (Math.abs(rate) > ROLL_SNAP_W || pull > ROLL_SNAP_PULL * tipPoint(from) || rolling(other)) {
    trailer.pinFree = true;
    trailer.rollTogether = false;
    return false;
  }
  other.roll = { phase: 'rolling', phi: Math.sign(rate) * 0.05, w: rate, still: 0 };
  trailer.rollTogether = true;
  return true;
}

/**
 * The trailer's step with the roll (game/sim.ts stepPlayerTrailer, after the tractor's
 * own step): a cab that went over this step drags its trailer or snaps the pin; a rolling trailer
 * tumbles (roll.ts stepRoll), held on the pin while it rolls with its cab; else its step on the pin
 * and its two-wheel state - going over, it drags its cab or snaps the pin.
 * @param car the tractor
 * @param trailer its trailer
 * @param before its velocity before this step's clamps (a side hit counts), m/s
 * @param before.vx m/s
 * @param before.vy m/s
 * @param step the trailer's step on its pin (physics/trailer.ts stepTrailer)
 * @param roll a rolling body's step (roll.ts stepRoll, with its hits)
 * @param dt the step, s
 */
export function stepRigRoll(car: Car, trailer: Trailer, before: { vx: number; vy: number },
  step: () => void, roll: (body: Car) => void, dt: number): void {
  const rig = trailer as RigTrailer;
  // (the cab went over this step: its trailer with it, or the pin snapped)
  if (rolling(car) && !rig._cabRolled && !rolling(trailer) && !trailer.pinFree)
    coupleRoll(car, trailer, rig);
  rig._cabRolled = rolling(car);
  // (rolling together: one roll - the trailer turns as the cab does, its kingpin on the fifth
  // wheel, and lands on the same face; the cab back on its wheels, so is it)
  if (rig.rollTogether && !trailer.pinFree) {
    trailer.roll = car.roll ? { ...car.roll } : null;
    rig.rollTogether = rolling(car);
    if (rolling(trailer)) {
      holdOnPin(car, trailer);
      return;
    }
  }
  if (rolling(trailer)) {
    roll(trailer);
    return;
  }
  step();
  if (!stepTrailerTipOver(trailer, before.vx, before.vy, dt)) return;
  // (the trailer went over: its cab with it, or alone)
  if (!rolling(car) && !trailer.pinFree) coupleRoll(trailer, car, rig);
  else trailer.pinFree = true;
}

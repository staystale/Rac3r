// Tyre heat: friction work per axle and the tyre temperature update of step.

import { CORNER_OF_WHEEL } from '../world/wheels.ts';
import type { Spec } from '../cars.ts';
import { clamp, TYRE_HEAT, TYRE_FLEX, TYRE_T_MAX } from '../vehicle.ts';
import { WEATHER } from '../world/weather.ts';
import { coolTowardC } from './tyrecool.ts';
import type { Car } from '../vehicle.ts';
import { axleForce } from './tyres.ts';
import { wearTyres } from './tyrewear.ts';
import type { AxleTick } from './tyres.ts';

// MEASURED (tools/tyrecheck.mjs): 0.020 + 0.0022/(m/s) cooled with a ~17 s time
// constant, so a clean 0.8 g corner held 30 s only reached 30 C. Real tyres hold heat for minutes:
// 0.010 + 0.0010.
// 1/s toward ambient, always (0.010 before the "harder to build" pass)
const TYRE_COOL = 0.008;
// TYRE FEEL (owner: tyres "a
// little bit hard to get hot" and cool "a little bit too easy"; they should heat faster from
// sliding). MEASURED before (hatch, tarmac, 18 C): 30 s of hard cornering just reaches the
// window, 85 C falls below it after 15 s of a 90 km/h straight, AI laps in the window 43-73 % of
// the time. With it, while a tyre is no hotter than the top of its window: the always-on and the
// air cooling (1/s, 1/s per m/s; less with speed, which stands in for the rolling heat at speed;
// wet, loose and cold ground cool as before) and a scrubbing axle's slip heat x FEEL_SLIDE_HEAT;
// the flex warm-up rate (TYRE_FLEX.k) always. Above the window everything is as before, so a tyre
// holds its working heat but overheating (and popping) takes as long as it did (requirement:
// you'd have to try to overheat them)
const FEEL_COOL = 0.0135, FEEL_AIR = 0.00025, FEEL_FLEX_K = 0.1, FEEL_SLIDE_HEAT = 1.4;
// LOCK HEAT (owner: "hand braking should heat up the rear wheels slightly as any harsh
// braking / sliding should"). MEASURED before (tools/scratch/_spinwear.mjs, hatch, tarmac, 18 C):
// a 1.5 s handbrake slide from 54 km/h warmed the rears +2.7 C (the turning fronts +4.8), a locked
// stop from 72 km/h the fronts +5.5, the rears +1.3 - a locked axle's slide work saturates. A
// LOCKED axle (brakes or handbrake) puts LOCK_HEAT x its slide work into its tyres.
const LOCK_HEAT = 2;

/** A locked axle's slide-work factor for its tyres' heat. */
const lockFactor = (locked: boolean) => (locked ? LOCK_HEAT : 1);
// the temperature the tyres cool toward this step, C (updateTyreTemps; tyrecool.ts)
let ambientC = 18;
// each wheel's slip speed this step while its axle scrubs (0 rolling), for the wear (reused)
const wheelSlip = [0, 0, 0, 0];

/**
 * Whether an axle's tyres scrub (spin, lock or slide) rather than roll: the heat model's switch
 * between its two friction-work laws.
 */
export function scrubs(axleState: ReturnType<typeof axleForce>, locked: boolean): boolean {
  return axleState.spinning || locked || (axleState.sliding && axleState.slipSpeed > 2);
}

/** What updateTyreTemps reads from the two axle blocks of step. */
export interface AxleOutcome {
  frontAxle: ReturnType<typeof axleForce>; rearAxle: ReturnType<typeof axleForce>;
  lockedF: boolean; lockedR: boolean; FzF: number; FzR: number; FzNomF: number; FzNomR: number;
  workF: number; workR: number; gripTF: number; gripTR: number;
}

/** Fills wheelSlip: each wheel's slip speed while its axle scrubs (0 rolling). */
function fillWheelSlip(frontAxle: ReturnType<typeof axleForce>, lockedF: boolean,
    rearAxle: ReturnType<typeof axleForce>, lockedR: boolean): void {
  const front = scrubs(frontAxle, lockedF) ? frontAxle.slipSpeed : 0;
  const rear = scrubs(rearAxle, lockedR) ? rearAxle.slipSpeed : 0;
  wheelSlip[0] = wheelSlip[1] = front;
  wheelSlip[2] = wheelSlip[3] = rear;
}

/**
 * One tyre's temperature change, C/s: slip heat, flex heat and cooling toward the TRACK
 * temperature (weather.ts; 18 C with no weather; ambientC, the track / air mix). A tyre no
 * hotter than its window's top holds its heat (heldCool) and a slide warms it sooner.
 */
function tyreRate(temp: number, slipHeat: number, flexHeat: number, slip: number,
    windowTop: number, cool: number, heldCool: number): number {
  const held = temp <= windowTop;
  const slideK = held && slip > 0 ? FEEL_SLIDE_HEAT : 1;
  return slipHeat * slideK + flexHeat - (held ? heldCool : cool) * (temp - ambientC);
}

/**
 * Tyre temperature section of step: slip heat, flex heat and cooling for the four tyres, kept in
 * car.tyreT, plus the axle grip telemetry.
 */
export function updateTyreTemps(car: Car, carSpec: Spec, tick: AxleTick, out: AxleOutcome,
    vLong: number, vLat: number, accelLat: number) {
  const { gravity, muBase, dt } = tick;
  const { frontAxle, rearAxle, lockedF, lockedR, FzF, FzR, FzNomF, FzNomR, workF, workR, gripTF,
    gripTR } = out;
  const telem = car.t, tyreTemps = car.tyreT;
  // share of each axle's load (and work) on the +y side: cornering moves it to the outside
  const frontShare = clamp(0.5 - (accelLat * carSpec.cgH) / (carSpec.trackWidth * gravity), 0.1,
      0.9);
  const speed = Math.hypot(vLong, vLat), groundCool = car.surface.coolK || 0;
  const cool = TYRE_COOL + TYRE_HEAT.air * speed + groundCool;
  ambientC = coolTowardC(WEATHER.trackC, WEATHER.tempC, speed);
  const heldCool = FEEL_COOL + FEEL_AIR * speed + groundCool;
  const heatScale = (car.surface.heatK ?? 1)
      * (car.surface.hard && carSpec.tyre ? carSpec.tyre.heatHard || 1 : 1);
  // tyre thermal mass scales with the car (a tractor tyre holds far more rubber than a hatch's).
  // MEASURED: at one capacity for every car the 5.2 t tractor popped in a 14 s burnout.
  // Reference: the 1440 kg hatch.
  // share of the slip heat that goes into the TYRE (loose ground takes most of it)
  const capK = TYRE_HEAT.cap * (carSpec.mass || 1440) / TYRE_HEAT.massRef;
  const lockF = lockFactor(lockedF), lockR = lockFactor(lockedR);
  const wheelWork = [workF * lockF * frontShare, workF * lockF * (1 - frontShare),
    workR * lockR * frontShare, workR * lockR * (1 - frontShare)];
  fillWheelSlip(frontAxle, lockedF, rearAxle, lockedR);
  const flexK = FEEL_FLEX_K;
  const window = carSpec.tyreOpt || [65, 110];
  // FLEX HEAT (requirement: should be semi easy to get warm but you'd have to try to over heat
  // them). A tyre working in a corner flexes, and that warms it toward TYRE_FLEX.T — INSIDE the
  // working window — and no further: above it this term is zero, so only sliding (the slip
  // work above) can overheat a tyre. Rate = how hard the axle is working (force / load) x this
  // tyre's share x speed; on loose ground x heatK like everything else. GRIPPING axles only: a
  // sliding / spinning / locked axle already heats by slip work, and adding flex on top MEASURED
  // took the tarmac drift from too-hot-at-27 s to 17 s (the user wants overheating to stay hard).
  const grips = (axleState: ReturnType<typeof axleForce>, locked: boolean) =>
    !(axleState.spinning || locked || axleState.sliding);
  // CORNERING force only. MEASURED: with |Fx| included, holding 90 km/h on a straight (throttle
  // on, then engine braking off) warmed the rears to 46 C in 30 s; the rule is that a cruise
  // barely warms them. Drive and brake heat still arrive through the slip work above. MEASURED
  // BUG (requirement: tyres heat up like crazy if you brake or slide over jumps): over the
  // Test Track table with the handbrake on, the fronts gained +203 C in ONE step — the axle was
  // airborne (Fz 0) but still carried 7.6 kN of lagged lateral force, so force / max(1, Fz) read
  // as ~7600 x "working hard". Now: grounded axles only, load floored at a quarter of static,
  // utilisation capped at the tyre's own grip (it cannot work harder than that).
  const utilOf = (
    axleState: ReturnType<typeof axleForce>, locked: boolean, load: number, FzNom: number,
  ) => (grips(axleState, locked) && load > 0.05 * FzNom)
    ? Math.min(muBase, Math.abs(axleState.Fy) / Math.max(0.25 * FzNom, load)) : 0;
  const utilF = utilOf(frontAxle, lockedF, FzF, FzNomF),
      utilR = utilOf(rearAxle, lockedR, FzR, FzNomR);
  const speedFrac = Math.min(1, Math.hypot(vLong, vLat) / TYRE_FLEX.vRef);
  const flex = [utilF * frontShare, utilF * (1 - frontShare), utilR * frontShare,
      utilR * (1 - frontShare)];
  for (let i = 0; i < 4; i++) {
    // never overshoot: the flex step can at most close the gap to TYRE_FLEX.T this step
    // (CLAUDE.md rule 11 — explicit integration with a big rate overshoots; the +203 C step went
    // straight past 85 C to 249 C)
    const flexHeat = Math.min(1 / dt, flexK * 2 * flex[i] * speedFrac * heatScale)
        * Math.max(0, TYRE_FLEX.T - tyreTemps[i]);
    tyreTemps[i] += tyreRate(tyreTemps[i], (wheelWork[i] * heatScale) / capK, flexHeat,
      wheelSlip[i], window[1], cool, heldCool) * dt;
    // NaN guard ONLY. MEASURED BUG (requirement: tyres that get too hot just roll over the temp
    // table and start cold again — they should pop or hold temp until cooled): this used to reset
    // anything over 400 C to ambient. Now a real number is CAPPED and HELD until it cools;
    // bursting arrives with the damage system.
    if (!Number.isFinite(tyreTemps[i])) tyreTemps[i] = WEATHER.trackC;
    else if (tyreTemps[i] > TYRE_T_MAX) tyreTemps[i] = TYRE_T_MAX;
    // a lost wheel has no tyre (owner): it reads 0 until a repair puts one back
    if (car.wheelOff && car.wheelOff[CORNER_OF_WHEEL[i]]) tyreTemps[i] = 0;
  }
  // TYRE WEAR: the same work wears the rubber; a hot or worn tyre may burst
  const burst = wearTyres(car, carSpec.tyre, window, carSpec.mass, wheelWork, dt, wheelSlip);
  if (burst >= 0) car.burstTyre = burst;
  telem.gripTF = gripTF; telem.gripTR = gripTR;
}

/**
 * Friction work of one axle (W), from the tyre heat model: how hard its tyres scrub this step.
 */
export function axleFrictionWork(
  axleState: ReturnType<typeof axleForce>, syl: number, locked: boolean, load: number,
  vLong: number, vLat: number, vLongAbs: number, muBase: number,
) {
  return scrubs(axleState, locked)
    ? Math.hypot(axleState.Fx, axleState.Fy) * TYRE_HEAT.slipSat
        * Math.tanh(axleState.slipSpeed / TYRE_HEAT.slipSat)
            / (1 + Math.hypot(vLong, vLat) / TYRE_HEAT.roadV)
    : Math.abs(axleState.Fy) * Math.abs(syl) + Math.abs(axleState.Fx) * 0.08 * vLongAbs
        * Math.min(1, Math.abs(axleState.Fx) / (muBase * load + 1));
}

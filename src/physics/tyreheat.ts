// Tyre heat: friction work per axle and the tyre temperature update of step.

import type { Spec } from '../cars.ts';
import { clamp, TYRE_HEAT, TYRE_FLEX, TYRE_AMBIENT, TYRE_T_MAX } from '../vehicle.ts';
import type { Car } from '../vehicle.ts';
import { axleForce } from './tyres.ts';
import type { AxleTick } from './tyres.ts';

// MEASURED (tools/tyrecheck.mjs): 0.020 + 0.0022/(m/s) cooled with a ~17 s time
// constant, so a clean 0.8 g corner held 30 s only reached 30 C. Real tyres hold heat for minutes:
// 0.010 + 0.0010.
// 1/s toward ambient, always (0.010 before the "harder to build" pass)
const TYRE_COOL = 0.008;

/** What updateTyreTemps reads from the two axle blocks of step. */
export interface AxleOutcome {
  frontAxle: ReturnType<typeof axleForce>; rearAxle: ReturnType<typeof axleForce>;
  lockedF: boolean; lockedR: boolean; FzF: number; FzR: number; FzNomF: number; FzNomR: number;
  workF: number; workR: number; gripTF: number; gripTR: number;
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
  const cool = TYRE_COOL + TYRE_HEAT.air * Math.hypot(vLong, vLat) + (car.surface.coolK || 0);
  const heatScale = (car.surface.heatK ?? 1)
      * (car.surface.hard && carSpec.tyre ? carSpec.tyre.heatHard || 1 : 1);
  // tyre thermal mass scales with the car (a tractor tyre holds far more rubber than a hatch's).
  // MEASURED: at one capacity for every car the 5.2 t tractor popped in a 14 s burnout.
  // Reference: the 1440 kg hatch.
  // share of the slip heat that goes into the TYRE (loose ground takes most of it)
  const capK = TYRE_HEAT.cap * (carSpec.mass || 1440) / TYRE_HEAT.massRef;
  const wheelWork = [workF * frontShare, workF * (1 - frontShare), workR * frontShare,
      workR * (1 - frontShare)];
  // FLEX HEAT (user: "should be semi easy to get warm but you'd have to try to over
  // heat them"). A tyre working in a corner flexes, and that warms it toward TYRE_FLEX.T — INSIDE
  // the working window — and no further: above it this term is zero, so only sliding (the slip
  // work above) can overheat a tyre. Rate = how hard the axle is working (force / load) x this
  // tyre's share x speed; on loose ground x heatK like everything else. GRIPPING axles only: a
  // sliding / spinning / locked axle already heats by slip work, and adding flex on top MEASURED
  // took the tarmac drift from too-hot-at-27 s to 17 s (the user wants overheating to stay hard).
  const grips = (axleState: ReturnType<typeof axleForce>, locked: boolean) =>
    !(axleState.spinning || locked || axleState.sliding);
  // CORNERING force only. MEASURED: with |Fx| included, holding 90 km/h on a straight (throttle
  // on, then engine braking off) warmed the rears to 46 C in 30 s; the rule is that a cruise
  // barely warms them. Drive and brake heat still arrive through the slip work above. MEASURED
  // BUG (user: "tyres heat up like crazy if you brake or slide over jumps"): over the
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
    const flexHeat = Math.min(1 / dt, TYRE_FLEX.k * 2 * flex[i] * speedFrac * heatScale)
        * Math.max(0, TYRE_FLEX.T - tyreTemps[i]);
    tyreTemps[i] += ((wheelWork[i] * heatScale) / capK + flexHeat - cool
        * (tyreTemps[i] - TYRE_AMBIENT)) * dt;
    // NaN guard ONLY. MEASURED BUG (user: "tyres that get too hot just roll over the
    // temp table and start cold again — they should pop or hold temp until cooled"): this used to
    // reset anything over 400 C to ambient. Now a real number is CAPPED and HELD until it cools;
    // bursting arrives with the damage system.
    if (!Number.isFinite(tyreTemps[i])) tyreTemps[i] = TYRE_AMBIENT;
    else if (tyreTemps[i] > TYRE_T_MAX) tyreTemps[i] = TYRE_T_MAX;
  }
  telem.gripTF = gripTF; telem.gripTR = gripTR;
}

/**
 * Friction work of one axle (W), from the tyre heat model: how hard its tyres scrub this step.
 */
export function axleFrictionWork(
  axleState: ReturnType<typeof axleForce>, syl: number, locked: boolean, load: number,
  vLong: number, vLat: number, vLongAbs: number, muBase: number,
) {
  return (axleState.spinning || locked || (axleState.sliding && axleState.slipSpeed > 2))
    ? Math.hypot(axleState.Fx, axleState.Fy) * TYRE_HEAT.slipSat
        * Math.tanh(axleState.slipSpeed / TYRE_HEAT.slipSat)
            / (1 + Math.hypot(vLong, vLat) / TYRE_HEAT.roadV)
    : Math.abs(axleState.Fy) * Math.abs(syl) + Math.abs(axleState.Fx) * 0.08 * vLongAbs
        * Math.min(1, Math.abs(axleState.Fx) / (muBase * load + 1));
}

// BUSHES (?bushes=1; owner D): a bush is ground you drive THROUGH - the 'bush' surface (its drag
// in surfaces.ts / physics/tyres.ts), laid as patches by world/bushplan.ts, flattened to long
// grass by passes like any worn ground (wear.ts BASE_WEAR). This file holds the switch and what a
// wheel pushing into a bush does to the car: a fairly high chance of a PUNCTURE (thorns, stems,
// hidden wood) and a chance of a light SCRATCH on that corner, likelier the faster you go.
import { bushScratch } from '../damage.js';

// the chance a wheel entering one bush cell (1.5 m) punctures. MEASURED (_bushes.mjs, 40 bushes
// at 25 m/s; round bushes 1.2 %: 5 %, 2 %: 13 %; square 1.5 %: 23 %): 0.7 % aims at ~10 %
const PUNCTURE_CHANCE = 0.007;
// m/s under which a wheel rolls the stems down without harm (no puncture, no scratch)
const HARM_FROM = 3;
// the chance a wheel's bush cell scratches its corner: SCRATCH_CHANCE at SCRATCH_FULL m/s and
// above, falling to none at HARM_FROM. MEASURED at 25 m/s: 0.05 scratched 47 %, square 0.025 38 %;
// 0.015 aims at ~25 % of bushes driven through
const SCRATCH_CHANCE = 0.015, SCRATCH_FULL = 30;
// the damage a scratch adds, 0..1 of a corner: SCRATCH_BASE plus SCRATCH_PER per m/s
const SCRATCH_BASE = 0.008, SCRATCH_PER = 0.0008;

let isOn = false;

/**
 * Turns the bushes on or off (?bushes=1).
 * @param isWanted true for bushes
 */
export function setBushes(isWanted: boolean): void {
  isOn = isWanted;
}

/**
 * Whether the bushes are on.
 * @returns true when on
 */
export function bushesOn(): boolean {
  return isOn;
}

/** The car field a bush sets (vehicle.ts; damage.js applyBurst skips a tyre already flat). */
interface BushCar { burstTyre?: number }

/**
 * A wheel has pushed into a bush cell: it may puncture, and may scratch that corner.
 * @param car the car
 * @param tyre the wheel (vehicle.js tyre index 0..3)
 * @param speed the car's speed, m/s
 * @param rnd the random draw (Math.random in the game)
 */
export function bushPass(car: object, tyre: number, speed: number,
  rnd: () => number = Math.random): void {
  if (speed < HARM_FROM) return;
  if (rnd() < PUNCTURE_CHANCE) (car as BushCar).burstTyre = tyre;
  const share = Math.min(1, (speed - HARM_FROM) / (SCRATCH_FULL - HARM_FROM));
  if (rnd() < SCRATCH_CHANCE * share) bushScratch(car, tyre, SCRATCH_BASE + SCRATCH_PER * speed);
}

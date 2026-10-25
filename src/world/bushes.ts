// BUSHES (owner D): a bush is ground you drive THROUGH - the 'bush' surface (its drag
// in surfaces.ts / physics/tyres.ts), laid as patches by world/bushplan.ts, flattened to long
// grass by passes like any worn ground (wear.ts BASE_WEAR). This file holds what a wheel
// pushing into a bush does to the car: a fairly high chance of a PUNCTURE (thorns, stems,
// hidden wood) and a chance of a light dent on that corner, likelier the faster you go.
import { bushScratch, type DamageCar } from '../damage.ts';

// the chance a wheel entering one bush cell (1.5 m) punctures. MEASURED (_bushes.mjs, Killder
// bushes at 25 m/s): 0.7 % punctured 13 of 80 (16 %); owner: "a tiny bit higher" -> 0.8 %
const PUNCTURE_CHANCE = 0.008;
// m/s under which a wheel rolls the stems down without harm (no puncture, no scratch)
const HARM_FROM = 3;
// the chance a wheel's bush cell scratches its corner: SCRATCH_CHANCE at SCRATCH_FULL m/s and
// above, falling to none at HARM_FROM. MEASURED at 25 m/s: 0.015 scratched 31 of 80 bushes;
// owner: bushes should slightly damage cars -> 0.03 (most bushes driven through at speed)
const SCRATCH_CHANCE = 0.03, SCRATCH_FULL = 30;
// the damage a scratch adds, 0..1 of a corner: SCRATCH_BASE plus SCRATCH_PER per m/s (0.07 at
// 25 m/s: a light dent; a 20 km/h head-on is ~0.15)
const SCRATCH_BASE = 0.03, SCRATCH_PER = 0.0016;

/** The car field a bush sets (vehicle.ts; damage.ts applyBurst skips a tyre already flat). */
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
  if (rnd() < SCRATCH_CHANCE * share) {
    bushScratch(car as DamageCar, tyre, SCRATCH_BASE + SCRATCH_PER * speed);
  }
}

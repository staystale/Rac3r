// pass.ts - THE WHEEL MAKING THIS PASS. wear.ts stepWear notes each wheel before it passes over
// its cells, so the cover rules that answer a pass can tell which way it went (oil.ts: oil spreads
// the way the wheel went) and whose tyre it was (debris.ts: glass may puncture that tyre).

/** A car as a pass reads it: the tyre that burst this step (damage.ts applyBurst takes it). */
export interface PassCar { vx: number; vy: number; burstTyre?: number; burstSlow?: boolean }

/** The wheel passing now: its car, its tyre (vehicle.ts index 0..3) and its motion this step, m. */
export const PASS: { car: PassCar | null; tyre: number; dx: number; dy: number } = {
  car: null, tyre: -1, dx: 0, dy: 0,
};

/**
 * Notes the wheel about to pass over its cells this step (wear.ts stepWear).
 * @param car the car
 * @param tyre its tyre index, 0..3
 * @param dx the wheel's motion this step, x, m
 * @param dy the wheel's motion this step, y, m
 */
export function notePass(car: PassCar, tyre: number, dx: number, dy: number): void {
  PASS.car = car;
  PASS.tyre = tyre;
  PASS.dx = dx;
  PASS.dy = dy;
}

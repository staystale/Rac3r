// Where a car's four wheels touch the ground (wear.ts: the tyre paths that wear the surface).
import type { CarBody, Wheel } from "./types.ts";

// carWheels / vehicle.ts tyre index (0 FL +y, 1 FR -y, 2 RL +y, 3 RR -y) <-> damage corner (0 front
// -y, 1 front +y, 2 rear -y, 3 rear +y). It is its own inverse: the same table maps either way.
export const CORNER_OF_WHEEL: readonly number[] = [1, 0, 3, 2];

/** What carWheels reads of a car. */
export type WheelBase = Pick<CarBody, 'x' | 'y' | 'heading'>
  & { spec: { lf: number; lr: number; trackWidth?: number } };

/**
 * The four wheel contact points of a car, FL FR RL RR (L = +lateral, as vehicle.js indexes tyres).
 * @param car the car
 * @returns the wheels, world m
 */
export function carWheels(car: WheelBase): Wheel[] {
  const spec = car.spec;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const halfTrack = (spec.trackWidth || 1.5) / 2;
  const frontX = car.x + cosH * spec.lf, frontY = car.y + sinH * spec.lf;
  const rearX = car.x - cosH * spec.lr, rearY = car.y - sinH * spec.lr;
  return [
    { x: frontX - sinH * halfTrack, y: frontY + cosH * halfTrack }, // FL
    { x: frontX + sinH * halfTrack, y: frontY - cosH * halfTrack }, // FR
    { x: rearX - sinH * halfTrack, y: rearY + cosH * halfTrack }, // RL
    { x: rearX + sinH * halfTrack, y: rearY - cosH * halfTrack }, // RR
  ];
}

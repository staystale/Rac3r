// flipramps.ts - FLIP RAMPS (owner: "something like the angled start of an armco that can flip a
// vehicle; place it near the spike strip in the lab level" - to test rolling and sliding
// sparks). A barrier end turned down into the ground: a steel strip rising from the road to
// RAMP_RISE_M along its length, narrower than a car's track, so only one side's wheels run up
// it. Driven up at speed it lifts that side and the car rolls AWAY from it - through roll.js
// startRoll (tripCheck asks here), the one way any car starts to roll. Behind ?flipramp=1.
// Drawn by render/flipramps.ts.

import { carWheels, type WheelBase } from './wheels.ts';

/** One flip ramp: its middle, the direction it rises along, rad. */
export interface FlipRamp { x: number; y: number; rot: number }

// m: its length (the rise), its width (under one side's wheels only) and its top's height
export const RAMP_LEN_M = 5, RAMP_WID_M = 0.6, RAMP_RISE_M = 0.8;
// m/s along the ramp below which a car only bumps up it and drops off
const FLIP_FROM_MPS = 7;
// m: past the low end a wheel must be (well up the slope) for the lift to throw the car
const LIFTED_FROM_M = 1.5;
// the flip ramps of each level: the Lab's, just past the end of its stinger (world/stingers.ts),
// rising the same way the cars leave the start
const RAMPS: Record<string, FlipRamp[]> = {
  lab: [{ x: 26, y: 21.6, rot: 0 }],
};

let rampsOn = false;
/**
 * ?flipramp=1: the Lab's flip ramp (owner test).
 * @param isOn the switch
 */
export function setFlipRamps(isOn: boolean): void { rampsOn = isOn; }

/**
 * The flip ramps laid on a level (none without ?flipramp=1).
 * @param levelId the level
 * @returns its ramps
 */
export function levelFlipRamps(levelId: string): FlipRamp[] {
  return rampsOn ? RAMPS[levelId] ?? [] : [];
}

/** A car as the ramps read it. */
type RampCar = WheelBase & { vx: number; vy: number };

/**
 * Whether a flip ramp throws this car over this step, and which way (roll.js tripCheck).
 * @param car the car (on its wheels)
 * @param ramps the level's ramps
 * @returns the roll's direction and lateral speed for startRoll, or null
 */
export function rampFlip(car: RampCar, ramps: FlipRamp[]): { dir: number; vLat: number } | null {
  for (const ramp of ramps) {
    if (Math.abs(car.x - ramp.x) > RAMP_LEN_M || Math.abs(car.y - ramp.y) > RAMP_LEN_M) continue;
    const alongX = Math.cos(ramp.rot), alongY = Math.sin(ramp.rot);
    const climb = car.vx * alongX + car.vy * alongY;
    if (climb < FLIP_FROM_MPS) continue;
    const wheels = carWheels(car);
    for (let tyre = 0; tyre < 4; tyre++) {
      const dx = wheels[tyre].x - ramp.x, dy = wheels[tyre].y - ramp.y;
      const along = dx * alongX + dy * alongY, across = -dx * alongY + dy * alongX;
      if (Math.abs(across) > RAMP_WID_M / 2 || along > RAMP_LEN_M / 2
        || along < LIFTED_FROM_M - RAMP_LEN_M / 2) continue;
      // carWheels: tyres 0 and 2 are the +y side. That side lifts: the car rolls toward -y.
      const side = tyre % 2 === 0 ? 1 : -1;
      return { dir: -side, vLat: climb * (0.4 + along / RAMP_LEN_M) };
    }
  }
  return null;
}

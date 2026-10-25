// stingers.ts - TYRE SPIKES, a police stinger (owner: "a stationary object about 5 squares long
// and 1/2 a square wide, grey and spikey; it should instantly puncture / pop any tyre that passes
// over it - this will help me test the flats"). A strip laid across the road on the test levels:
// every wheel that rolls onto it bursts at once (damage.ts
// burstCorner, as a big hit's puncture). Drawn by render/stingers.ts. A "square" is read as the
// 1.5 m ground cell: 7.5 m long (a road's width), 0.75 m wide.

import { carWheels, type WheelBase } from './wheels.ts';

/** One stinger: its centre and the direction its LONG side runs, rad. */
export interface Stinger { x: number; y: number; rot: number }

// m: 5 ground cells long, half a cell wide
export const STINGER_LEN_M = 7.5, STINGER_WID_M = 0.75;
// m a wheel may reach past the strip's middle line and still be on a spike (half the width)
const HALF_W = STINGER_WID_M / 2, HALF_L = STINGER_LEN_M / 2;
// m: a car whose centre is further than this from a stinger cannot have a wheel on it
const NEAR_M = HALF_L + 4;
// the stingers of each level: 50 m past the start, across the road
const STINGERS: Record<string, Stinger[]> = {
  lab: [{ x: 21.7, y: 28.3, rot: Math.PI / 2 }],
  'test-track': [{ x: -12, y: -95.9, rot: 0.0109 + Math.PI / 2 }],
};

// the tyres found on a spike this step, reused (no allocation per step)
const onSpikes: number[] = [];

/**
 * The stingers laid on a level.
 * @param levelId the level
 * @returns its stingers
 */
export function levelStingers(levelId: string): Stinger[] {
  return STINGERS[levelId] ?? [];
}

/**
 * The car's tyres (vehicle.ts tyre index) standing on a stinger this step.
 * @param car the car
 * @param stingers the level's stingers
 * @returns the tyre indexes on a spike (empty for most cars, most steps); reused, read it at once
 */
export function tyresOnStinger(car: WheelBase, stingers: Stinger[]): number[] {
  const hits = onSpikes;
  hits.length = 0;
  for (const strip of stingers) {
    if (Math.abs(car.x - strip.x) > NEAR_M || Math.abs(car.y - strip.y) > NEAR_M) continue;
    const alongX = Math.cos(strip.rot), alongY = Math.sin(strip.rot);
    carWheels(car).forEach((wheel, tyre) => {
      const dx = wheel.x - strip.x, dy = wheel.y - strip.y;
      if (Math.abs(dx * alongX + dy * alongY) <= HALF_L
        && Math.abs(-dx * alongY + dy * alongX) <= HALF_W) hits.push(tyre);
    });
  }
  return hits;
}

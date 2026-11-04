// ai/rejoin.ts - THE WEAVE FIX (the AI rework R2, passed 11-04; docs/specs/ai-rework.md). Owner:
// "off the line the AI slows to get back on it. WANTED: go fast, follow the line SOFTLY from
// wherever they are; deviation only as a RESULT". MEASURED 11-04 (tools/scratch/_rejoin.mjs,
// Thruston, a lone car knocked 3 m aside at six places): the steering SNAPPED back (0.3-0.55 of
// the lock), swung up to 1.9 m past the line, and braked / lifted for corners as if it would
// still be off line there - ~6 m lost a knock. Now:
// - a car off its target and not making a move (a dodge, an attack, a cover) steers back along
//   a SOFT REJOIN: the steering's lateral error is capped at REJOIN_WEAK m (skill 0) ..
//   REJOIN_TOP m (skill 1, a calmer driver: a longer, gentler rejoin);
// - it takes the bends ahead at the speed of where it really IS and will be: its own place now,
//   closing on its target at the rejoin's pace (not the target it aims for), and never its own
//   mistake (a driver does not know it is about to make one).
import type { AiCar } from './types.ts';
import type { AiPath } from './driverCtx.ts';

// m: the steering's lateral error at most while rejoining, skill 0 / skill 1
const REJOIN_WEAK = 1.2, REJOIN_TOP = 0.7;
// the Stanley cross gain (ai/driverSteps.ts steerAim): the lateral m/s a capped error makes is
// about this x the cap at speed
const CROSS_GAIN = 1.2;
// m/s: the slowest speed the closing is reckoned at (a crawl would put the rejoin miles away)
const SLOW_FLOOR = 5;

/** Where a car really is against its target, for the bends ahead. */
export interface RejoinAim {
  actual: number;    // m off its path now (+ left), the car's centre
  mistLat: number;   // m of the target that is a mistake in progress
  rate: number;      // m/s it closes on its target
}

/**
 * The cap on the steering's lateral error while rejoining.
 * @param skill the driver's skill, 0..1
 * @returns m
 */
export function rejoinCross(skill: number): number {
  return REJOIN_WEAK + (REJOIN_TOP - REJOIN_WEAK) * Math.max(0, Math.min(1, skill));
}

/**
 * The car's centre, m off its path at a point (+ left of the path's heading).
 * @param car the car
 * @param path the path
 * @param nearIdx the path point it is at
 * @returns m
 */
export function lateralOf(car: AiCar, path: AiPath, nearIdx: number): number {
  const point = path.pts[nearIdx];
  return (car.x - point.x) * -Math.sin(point.h) + (car.y - point.y) * Math.cos(point.h);
}

/**
 * The rejoin facts the corner speed needs.
 * @param car the car
 * @param path its path
 * @param nearIdx its place
 * @param mistLat m of the target that is a mistake
 * @param cross the steering's cap (rejoinCross)
 * @returns the aim
 */
export function rejoinAim(car: AiCar, path: AiPath, nearIdx: number, mistLat: number,
  cross: number): RejoinAim {
  return { actual: lateralOf(car, path, nearIdx), mistLat, rate: CROSS_GAIN * cross };
}

/**
 * Where the car will be against its path dist m ahead: its place now, closing on the target.
 * @param aim the rejoin facts
 * @param target m off the path it aims for (the mistake taken out)
 * @param dist m ahead
 * @param speed m/s
 * @returns m off the path there
 */
export function lateralAhead(aim: RejoinAim, target: number, dist: number, speed: number) {
  const gap = aim.actual - target;
  const left = Math.max(0, Math.abs(gap) - aim.rate * dist / Math.max(SLOW_FLOOR, speed));
  return target + Math.sign(gap) * left;
}

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
import { FIX } from '../core/fixes.ts';
import type { AiPath } from './driverCtx.ts';

// m: the steering's lateral error at most while rejoining, skill 0 / skill 1
const REJOIN_WEAK = 1.2, REJOIN_TOP = 0.7;
// ?rejoinfast: a driver comes back AT AN ANGLE, as a racer does - the cap is the cross error that
// aims it RETURN_ANGLE across its line (the steering law's cross term: atan(CROSS_GAIN x cap /
// (speed + 2))), never more than the gap left, so it eases in at the end (~4 m/s across at 30
// m/s; the fixed cap's ~1 m/s). MEASURED (tools/scratch/_ovalfield.mjs, the real game, the stock
// car oval, 20 AI): the fixed cap left a car 11 m off after a mistake driving on along the grass
// 5-11 m out for 10 s at up to 29 m/s. 6 deg: still up to 10 s on the grass; 10 deg: cut back
// across the pack - 7-10 spins, 58-62 km/h (70-72); 8 deg: 3-5 spins, 68-72 km/h, the longest
// trip 4-5 s; circuit fields incidents 54 -> 49, passes 95 = 95. A cap growing with the gap
// (0.5 m a m) asked more turn than the grip has at speed - full lock, lifting (_rejoin.mjs 8 m
// knocks: 32 -> 59 m lost).
const RETURN_ANGLE = 0.14;   // rad, 8 deg
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
  // its own line through the corner - the nudge here and at a point (ai/cornerLine.ts)
  shape?: { here: number; nudgeAt: (pos: number) => number } | null;
}

/**
 * The cap on the steering's lateral error while rejoining.
 * @param skill the driver's skill, 0..1
 * @param gap m the car is off its target (?rejoinfast: back at a racer's angle, the gap at most)
 * @param speed m/s
 * @returns m
 */
export function rejoinCross(skill: number, gap = 0, speed = 0): number {
  const base = REJOIN_WEAK + (REJOIN_TOP - REJOIN_WEAK) * Math.max(0, Math.min(1, skill));
  if (!FIX.rejoinfast) return base;
  const angled = Math.tan(RETURN_ANGLE) * (speed + 2) / CROSS_GAIN;
  return Math.max(base, Math.min(Math.abs(gap), angled));
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
 * @param shape the driver's own line through the corner
 * @returns the aim
 */
export function rejoinAim(car: AiCar, path: AiPath, nearIdx: number, mistLat: number,
  cross: number, shape: RejoinAim['shape'] = null): RejoinAim {
  return { actual: lateralOf(car, path, nearIdx), mistLat, rate: CROSS_GAIN * cross, shape };
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

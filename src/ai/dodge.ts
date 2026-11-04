// ai/dodge.ts - DODGING BY SKILL (?aidodge, the AI rework R5; owner 11-04: "maybe more skilled
// drivers can avoid collisions even more"; "AI should try to avoid crashing, especially high
// skilled"). MEASURED (tools/scratch/_stopcar.mjs: a car stopped across the racing line, 6 AI x 3
// laps): 11-34 hits on it at 50-90 km/h on Thruston / Brands / Castle Cum, the most skilled driver
// no better (4-14 hits). Three causes: a car was a POINT (kept ~2.1 m from its centre - a car
// across the road is ~4 m long); it was seen 1.1 s ahead for everyone while its 2.5 m/s swerve
// needed more (3.5 m at 30 m/s is ~40 m); and it never braked to make the swerve. Now a car has
// its real size across my path, a driver sees LOOK_WEAK .. LOOK_TOP s ahead by skill (a better
// one starts earlier, so it swerves smaller and smoother), and when the swerve cannot be made in
// time at this speed it brakes until it can. All cheap: a little arithmetic per car near it.
import type { AiCar } from './types.ts';

// s of travel ahead a driver reads the cars in, skill 0 / skill 1 (was 1.1 for everyone)
export const LOOK_WEAK = 0.6, LOOK_TOP = 1.6;
// m kept between the two cars' sides going round
const MARGIN = 0.6;
// m/s sideways a driver swerves at round a car in the way (the dodge's rate, driverDrive.ts)
export const SWERVE_RATE = 3;

/**
 * The s ahead a driver reads the cars in.
 * @param skill 0..1
 * @returns s
 */
export const lookAhead = (skill: number) => LOOK_WEAK + (LOOK_TOP - LOOK_WEAK)
  * Math.max(0, Math.min(1, skill));

/**
 * How far a car reaches across a path and along it, from its middle.
 * @param other the car
 * @param pathH the path's heading there
 * @returns m across, m along
 */
export function reachOf(other: AiCar, pathH: number): { across: number; along: number } {
  const turn = other.heading - pathH;
  const cos = Math.abs(Math.cos(turn)), sin = Math.abs(Math.sin(turn));
  const halfL = other.spec.len / 2, halfW = other.spec.wid / 2;
  return { across: sin * halfL + cos * halfW, along: cos * halfL + sin * halfW };
}

/**
 * The m between two cars' middles, across the path, that keeps them apart going round.
 * @param car my car
 * @param across the other's reach across the path (reachOf)
 * @returns m
 */
export const clearOf = (car: AiCar, across: number) => car.spec.wid / 2 + across + MARGIN;

/**
 * The speed that leaves time to swerve round a car ahead (Infinity when there is time already).
 * @param need m to move across
 * @param room m before I am level with it
 * @param speed my m/s
 * @param vAlong its m/s along my way
 * @returns m/s
 */
export function swerveCap(need: number, room: number, speed: number, vAlong: number): number {
  const closing = Math.max(0.5, speed - vAlong), time = Math.max(0.05, room) / closing;
  if (need <= SWERVE_RATE * time) return Infinity;
  return vAlong + SWERVE_RATE * Math.max(0.5, room) / need;
}

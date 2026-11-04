// ai/dodge.ts - DODGING BY SKILL (the AI rework R5, passed 11-04; owner: "maybe more skilled
// drivers can avoid collisions even more"; "AI should try to avoid crashing, especially high
// skilled"). MEASURED (tools/scratch/_stopcar.mjs: a car stopped across the racing line, 6 AI x 3
// laps): 11-34 hits on it at 50-90 km/h on Thruston / Brands / Castle Cum, the most skilled driver
// no better (4-14 hits). Three causes: a car was a POINT (kept ~2.1 m from its centre - a car
// across the road is ~4 m long); it was seen 1.1 s ahead for everyone while its 2.5 m/s swerve
// needed more (3.5 m at 30 m/s is ~40 m); and it never braked to make the swerve. Now a car has
// its real size across my path, a driver reads further ahead by skill (driverTraffic.ts
// GAP_LOOK_*: 2.6 .. 3.8 s since the one AI, 11-04; was 0.8 .. 2.1) - a better one starts earlier,
// so it swerves smaller and smoother -, and when the swerve cannot be made in
// time at this speed it brakes until it can. All cheap: a little arithmetic per car near it.
import type { AiCar } from './types.ts';

// s more of travel ahead a driver sees a loose object in (driverTraffic.ts obstacleStep)
export const OBJECT_MORE = 0.3;
// m kept between the two cars' sides going round
const MARGIN = 0.6;
// m/s sideways a driver swerves at round a car in the way (the dodge's rate, driverDrive.ts)
export const SWERVE_RATE = 3;

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

// the share of the car ahead's braking a driver reads, skill 0 / skill 1 (a top driver
// sees the brake lights at once; a weak one half of it), and the s a speed is read over
const READ_WEAK = 0.5, READ_TOP = 1, READ_S = 0.1;

/**
 * how fast a car is slowing, as a driver reads it (its speed along my way, kept per
 * car and differenced over READ_S).
 * @param seenV the driver's speeds read
 * @param other the car
 * @param vAlong its m/s along my way
 * @param now the driver's clock, s
 * @param skill the driver's skill, 0..1
 * @returns m/s/s it slows (0 when it is not)
 */
export function readBraking(seenV: WeakMap<object, { v: number; t: number; dec: number }>,
  other: object, vAlong: number, now: number, skill: number): number {
  const last = seenV.get(other);
  if (!last || now - last.t > 1) { seenV.set(other, { v: vAlong, t: now, dec: 0 }); return 0; }
  if (now - last.t >= READ_S) {
    const raw = Math.max(0, (last.v - vAlong) / (now - last.t));
    last.dec += (raw - last.dec) * 0.5;
    last.v = vAlong;
    last.t = now;
  }
  return last.dec * (READ_WEAK + (READ_TOP - READ_WEAK) * Math.max(0, Math.min(1, skill)));
}

/**
 * the most I may go to still match a car ahead that is slowing, by the gap I have:
 * I brake at brakeDecel, it at dec - the closing ends where our speeds meet.
 * @param vAhead its m/s along my way
 * @param dec how fast it slows, m/s/s
 * @param brakeDecel how hard I plan to brake, m/s/s
 * @param gap m I have to close in
 * @returns m/s
 */
export function matchSpeed(vAhead: number, dec: number, brakeDecel: number, gap: number): number {
  const spare = brakeDecel - dec;
  return spare <= 0 ? vAhead : vAhead + Math.sqrt(2 * spare * Math.max(0, gap));
}

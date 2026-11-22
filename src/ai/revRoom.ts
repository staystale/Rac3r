// ai/revRoom.ts - ?revroom, REVERSE OUT WITH ROOM (owner 11-22: "if stuck behind a car they don't
// reverse quick enough perhaps and they also don't reverse enough to steer clear when they go
// forward n keep getting stuck"; "they should reverse quicker rather than resetting"). The car in
// my way and the car close behind, read for the drive-out (ai/driveOut.ts): a stopped car in my way
// makes a hold stuck sooner; the reverse goes on until there is room to steer round it (or a car
// is close behind), the nose swung away from it.
import type { AiCar } from './types.ts';

/** The car in my way: m between my nose and it, m across (+ left of my heading), its m/s. */
export interface Blocker { gap: number; lat: number; v: number }

// m between my nose and a car from which it is not in my way; m past our sides it still is
const BLOCK_AHEAD_M = 8, BLOCK_SIDE_M = 0.4;
// m between my tail and a car behind at which a reverse stops
const BEHIND_M = 1.5;

/**
 * Another car's half extents along and across my heading.
 * @param car my car
 * @param other the other car
 * @returns its half length along my heading and half width across it, m
 */
function reachOf(car: AiCar, other: AiCar): { along: number; across: number } {
  const turn = other.heading - car.heading;
  const cos = Math.abs(Math.cos(turn)), sin = Math.abs(Math.sin(turn));
  const halfLen = other.spec.len / 2, halfWid = other.spec.wid / 2;
  return { along: cos * halfLen + sin * halfWid, across: sin * halfLen + cos * halfWid };
}

/**
 * Where another car is from me, by my heading.
 * @param car my car
 * @param other the other car
 * @returns m ahead and m across (+ left)
 */
function placeOf(car: AiCar, other: AiCar): { fwd: number; lat: number } {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const dx = other.x - car.x, dy = other.y - car.y;
  return { fwd: dx * cos + dy * sin, lat: -dx * sin + dy * cos };
}

/**
 * The nearest car in my way ahead (within BLOCK_AHEAD_M of my nose and across my width), or null.
 * @param car my car
 * @param cars the other cars
 * @returns the car in my way
 */
export function blockerOf(car: AiCar, cars: AiCar[] | undefined): Blocker | null {
  let best: Blocker | null = null;
  for (const other of cars ?? []) {
    if (other === car) continue;
    const { fwd, lat } = placeOf(car, other);
    if (fwd <= 0) continue;
    const reach = reachOf(car, other);
    const gap = fwd - car.spec.len / 2 - reach.along;
    if (gap > BLOCK_AHEAD_M || Math.abs(lat) > car.spec.wid / 2 + reach.across + BLOCK_SIDE_M) {
      continue;
    }
    if (!best || gap < best.gap) best = { gap, lat, v: Math.hypot(other.vx, other.vy) };
  }
  return best;
}

/**
 * Whether a car is close behind me, across my width (a reverse stops for it).
 * @param car my car
 * @param cars the other cars
 * @returns close behind
 */
export function carBehind(car: AiCar, cars: AiCar[] | undefined): boolean {
  for (const other of cars ?? []) {
    if (other === car) continue;
    const { fwd, lat } = placeOf(car, other);
    if (fwd >= 0) continue;
    const reach = reachOf(car, other);
    if (-fwd - car.spec.len / 2 - reach.along < BEHIND_M
      && Math.abs(lat) < car.spec.wid / 2 + reach.across) return true;
  }
  return false;
}

// m past a car length the lock needs to steer round a car in my way from standstill
const ROOM_LOCK_M = 2.5;

/**
 * The m between my nose and the car in my way at which there is room to steer round it: a car
 * length and the room the lock needs.
 * @param car my car
 * @returns m
 */
export const roomOf = (car: AiCar) => car.spec.len + ROOM_LOCK_M;

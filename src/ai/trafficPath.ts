// ai/trafficPath.ts - A TRAFFIC CAR ON A PATH OFF THE LANES (TODO 3a2 item 15, ?hwtrips=1): a car
// leaving by a slip road, or coming down an on-ramp, follows that road's centre line (world
// points) instead of a lane. Carried out of reach of a real car, it is put on the line at its
// speed (nose along the line a few metres on); near one it is a real car steered by the traffic's
// own pursuit law (ai/trafficPhys.ts pursuitInput) at a point on the line ahead. Its speed: its
// cruise, eased for the bends ahead (BEND_ACCEL_MS2 sideways), stopped at a dead end, behind a
// car in its way.
import { drivePhysics, pursuitInput } from './trafficPhys.ts';
import type { TrafficCtx } from './trafficCtx.ts';
import type { DriveEnv } from './trafficLane.ts';
import type { TrafficCar } from './types.ts';
import type { Point } from '../world/types.ts';

/** A path being followed: its points (world m), the distance to each, where the car is on it. */
export interface TripPath {
  pts: Point[];
  lens: number[];
  total: number;
  along: number;
  // m/s along it (carried: its own - the road's frame reads only the share along the road)
  speed: number;
  // m before its end the car stops (a dead end: a gate), or null - it runs on to the end
  stopShort: number | null;
}

// m/s^2 sideways a car takes a bend at (an everyday driver, not a racer); m/s^2 it slows at for a
// bend or a stop ahead, and speeds up at
const BEND_ACCEL_MS2 = 2.5, SLOW_MS2 = 2.5, SPEED_UP_MS2 = 2;
// m either side of a point its bend is read over; m the bends are looked ahead in
const BEND_HALF_M = 4, BEND_STEP_M = 5;
// m ahead of a carried car its nose points at (the line's corners rounded)
const NOSE_M = 6;
// m ahead along its path / off it within which another car is in its way; m bumper to bumper it
// keeps; m between the points of its path looked at
const BLOCK_AHEAD_M = 45, BLOCK_ACROSS_M = 2.2, BLOCK_GAP_M = 5, BLOCK_STEP_M = 2;
// m/s^2 a carried car slows at, at most (as a carried lane car)
const CARRIED_BRAKE_MS2 = 7;
// points worked out each step, kept (no allocation per step): two for a chord, one held over it
const CHORD_FROM = { x: 0, y: 0 }, CHORD_TO = { x: 0, y: 0 }, HELD = { x: 0, y: 0 };
// the car in the way, kept (blockerOf)
const BLOCKER = { gap: 0, v: 0 };

/**
 * A path along points (repeats dropped).
 * @param pts the points, world m
 * @param stopShort m before the end it stops at, or null
 * @param speed m/s the car is doing
 * @returns the path, the car at its start
 */
export function makePath(pts: Point[], stopShort: number | null, speed: number): TripPath {
  const kept: Point[] = [], lens: number[] = [];
  let total = 0;
  for (const point of pts) {
    const last = kept[kept.length - 1];
    const step = last ? Math.hypot(point[0] - last[0], point[1] - last[1]) : 0;
    if (last && step < 0.05) continue;
    total += step;
    kept.push(point);
    lens.push(total);
  }
  return { pts: kept, lens, total, along: 0, speed, stopShort };
}

/**
 * The segment a distance along a path lies on.
 * @param path the path
 * @param along m along it
 * @returns the segment's first point's index
 */
function segmentAt(path: TripPath, along: number): number {
  const { lens } = path;
  let low = 0, high = lens.length - 2;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (lens[mid] <= along) low = mid;
    else high = mid - 1;
  }
  return Math.max(0, low);
}

/**
 * The point a distance along a path (clamped to its start; past its end, on along its last
 * heading).
 * @param path the path
 * @param along m along it
 * @param out where the point is written
 * @param out.x world m
 * @param out.y world m
 * @returns out
 */
function pointOnPath(path: TripPath, along: number, out: { x: number; y: number }) {
  const { pts, lens } = path;
  if (pts.length < 2) {
    out.x = pts[0][0];
    out.y = pts[0][1];
    return out;
  }
  const i = segmentAt(path, Math.max(0, along)), from = pts[i], next = pts[i + 1];
  const span = lens[i + 1] - lens[i] || 1, share = (Math.max(0, along) - lens[i]) / span;
  out.x = from[0] + (next[0] - from[0]) * share;
  out.y = from[1] + (next[1] - from[1]) * share;
  return out;
}

/**
 * The heading of the chord from one distance along a path to another.
 * @param path the path
 * @param from m along
 * @param toAlong m along (further)
 * @returns radians
 */
function chordHeading(path: TripPath, from: number, toAlong: number): number {
  const start = pointOnPath(path, from, CHORD_FROM), end = pointOnPath(path, toAlong, CHORD_TO);
  return Math.atan2(end.y - start.y, end.x - start.x);
}

/**
 * The path's curvature round a distance along it (its heading's turn over 2 x BEND_HALF_M).
 * @param path the path
 * @param along m along it
 * @returns 1/m, unsigned
 */
function bendAt(path: TripPath, along: number): number {
  const before = chordHeading(path, along - BEND_HALF_M, along);
  const after = chordHeading(path, along, along + BEND_HALF_M);
  const turn = Math.atan2(Math.sin(after - before), Math.cos(after - before));
  return Math.abs(turn) / BEND_HALF_M;
}

/**
 * Where a car is along a path: the nearest point of the segments from just behind where it was
 * to a little ahead (it never goes back).
 * @param path the path
 * @param x the car, world m
 * @param y the car, world m
 * @returns m along
 */
function nearestAlong(path: TripPath, x: number, y: number): number {
  const { pts, lens } = path;
  let best = path.along, bestDist2 = Infinity;
  for (let i = segmentAt(path, path.along - 2); i < pts.length - 1; i++) {
    if (lens[i] > path.along + 30) break;
    const [fromX, fromY] = pts[i], segX = pts[i + 1][0] - fromX, segY = pts[i + 1][1] - fromY;
    const len2 = segX * segX + segY * segY || 1;
    const share = Math.max(0, Math.min(1, ((x - fromX) * segX + (y - fromY) * segY) / len2));
    const nearX = fromX + segX * share, nearY = fromY + segY * share;
    const dist2 = (x - nearX) ** 2 + (y - nearY) ** 2;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      best = lens[i] + share * (lens[i + 1] - lens[i]);
    }
  }
  return Math.max(path.along, best);
}

/**
 * The speed a car holds on a path now: its wish, no faster than it can slow to each bend ahead
 * and to its stop.
 * @param path the path
 * @param want its wish, m/s
 * @param speed its speed, m/s
 * @returns m/s
 */
function pathSpeed(path: TripPath, want: number, speed: number): number {
  let target = want;
  const reach = speed * speed / (2 * SLOW_MS2) + 2 * BEND_STEP_M;
  for (let ahead = 0; ahead <= reach; ahead += BEND_STEP_M) {
    const bend = bendAt(path, path.along + ahead);
    if (bend < 1e-4) continue;
    const bendSpeed = Math.sqrt(BEND_ACCEL_MS2 / bend);
    target = Math.min(target, Math.sqrt(bendSpeed * bendSpeed + 2 * SLOW_MS2 * ahead));
  }
  if (path.stopShort != null) {
    const toStop = path.total - path.stopShort - path.along;
    target = Math.min(target, Math.sqrt(2 * SLOW_MS2 * Math.max(0, toStop)));
  }
  return target;
}

/**
 * Where another car sits on a path ahead: the first point of the path (every BLOCK_STEP_M from
 * where the car is, out to BLOCK_AHEAD_M) within BLOCK_ACROSS_M of it.
 * @param path the path
 * @param x the other car, world m
 * @param y the other car, world m
 * @returns m along the path, or null: not on it
 */
function alongOnPath(path: TripPath, x: number, y: number): number | null {
  for (let ahead = BLOCK_STEP_M; ahead <= BLOCK_AHEAD_M; ahead += BLOCK_STEP_M) {
    const point = pointOnPath(path, path.along + ahead, HELD);
    if (Math.hypot(point.x - x, point.y - y) < BLOCK_ACROSS_M) return path.along + ahead;
  }
  return null;
}

/**
 * The nearest car in a path car's way: on its path ahead (alongOnPath) - a car in the lane it is
 * leaving is not, once the path has left the lane.
 * @param slot the car
 * @param env the step's road (everyone on it)
 * @param path its path
 * @returns the gap bumper to bumper (m) and that car's speed along the path (m/s), or null
 */
function blockerOf(slot: TrafficCar, env: DriveEnv, path: TripPath)
  : { gap: number; v: number } | null {
  const car = slot.car;
  let isFound = false;
  for (const ent of env.ents) {
    const other = ent.car;
    if (other === car || Math.hypot(other.x - car.x, other.y - car.y) > BLOCK_AHEAD_M + 5)
      continue;
    const otherAlong = alongOnPath(path, other.x, other.y);
    if (otherAlong == null) continue;
    const gap = otherAlong - path.along - (car.spec.len + other.spec.len) / 2;
    if (isFound && gap >= BLOCKER.gap) continue;
    const heading = chordHeading(path, otherAlong - 2, otherAlong + 2);
    isFound = true;
    BLOCKER.gap = gap;
    BLOCKER.v = Math.max(0, other.vx * Math.cos(heading) + other.vy * Math.sin(heading));
  }
  return isFound ? BLOCKER : null;
}

/**
 * The speed to hold and the brake: the path's, behind a car in the way (followed as a lane car
 * follows, braking hard when closing fast).
 * @param slot the car
 * @param env the step's road
 * @param path its path
 * @param speed its speed, m/s
 * @returns the target (m/s) and an emergency brake 0..1
 */
function pathTarget(slot: TrafficCar, env: DriveEnv, path: TripPath, speed: number) {
  let vTarget = pathSpeed(path, slot.vWant, speed), brakeX = 0;
  const blocker = blockerOf(slot, env, path);
  if (blocker) {
    vTarget = Math.min(vTarget, Math.max(0, blocker.v + (blocker.gap - BLOCK_GAP_M) * 0.4));
    if (blocker.gap < 2.5) vTarget = 0;
    const closing = speed - blocker.v;
    if (closing > 0.5 && blocker.gap / closing < 2.5)
      brakeX = Math.min(1, (2.5 - blocker.gap / closing) / 1.8);
  }
  return { vTarget, brakeX };
}

/**
 * A carried car moved along its path at its speed: on the line, its nose to the line NOSE_M on.
 * @param slot the car
 * @param path its path
 * @param vTarget m/s
 * @param brakeX the emergency brake 0..1
 * @param dt the step, s
 */
function carryOnPath(slot: TrafficCar, path: TripPath, vTarget: number, brakeX: number,
  dt: number) {
  const car = slot.car;
  const slowest = (brakeX > 0 ? -9 : -CARRIED_BRAKE_MS2) * dt;
  path.speed = Math.max(0, path.speed + Math.max(slowest, Math.min(SPEED_UP_MS2 * dt,
    vTarget - path.speed)));
  path.along = Math.min(path.total, path.along + path.speed * dt);
  slot.vAl = path.speed;
  const here = pointOnPath(path, path.along, HELD);
  const heading = chordHeading(path, path.along, path.along + NOSE_M);
  const bend = bendAt(path, path.along + NOSE_M / 2);
  car.x = here.x;
  car.y = here.y;
  car.heading = heading;
  car.vx = Math.cos(heading) * slot.vAl;
  car.vy = Math.sin(heading) * slot.vAl;
  car.yawRate = slot.vAl * bend;
  car.delta = Math.atan(bend * car.spec.L);
  car.brakeLight = brakeX > 0 || vTarget < slot.vAl - 0.5 ? 1 : 0;
  slot.deadT = 0;
  slot.kin = true;
}

/**
 * One step of a car on its path: carried, or driven by the real physics at the line ahead.
 * @param ctx the traffic
 * @param slot the car (its trip's path)
 * @param env the step's road
 * @param speed its speed, m/s
 * @param path its path
 * @returns true once it is at the path's end (or its stop)
 */
export function drivePath(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number,
  path: TripPath): boolean {
  const { vTarget, brakeX } = pathTarget(slot, env, path, speed);
  if (!slot.phys) carryOnPath(slot, path, vTarget, brakeX, env.dt);
  else {
    const car = slot.car;
    path.along = nearestAlong(path, car.x, car.y);
    path.speed = slot.vAl = Math.max(0, car.vx * Math.cos(car.heading)
      + car.vy * Math.sin(car.heading));
    const lookAhead = Math.max(8, Math.min(24, 6 + 0.5 * speed));
    const aim = pointOnPath(path, path.along + lookAhead, HELD);
    const input = pursuitInput(car, aim, speed, vTarget, slot.vAl, brakeX);
    drivePhysics(ctx, slot, env, speed, vTarget, brakeX, input);
  }
  const end = path.total - (path.stopShort ?? 0);
  return path.along >= end - 0.5;
}

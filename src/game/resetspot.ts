// game/resetspot.ts - WHERE A RESET MAY PUT YOUR CAR (TODO-DONE 11-15): never ahead
// of where the car is when the reset comes - in line or behind only, so a reset can never gain a
// place - and never onto another car: a spot with a car in it gives way to the next free spot
// behind. Used by every reset of yours (game/session.ts doReset, the endless road's guard in
// game/sim.ts, a big cut's put-back in game/order.ts).
import { game } from './state.ts';
import { LEVEL } from '../world/state.ts';
import { clearOfUnder, trackSpotOf } from '../world/trackunder.ts';
import { highwayRespawn, roadSpan } from '../highway.ts';
import type { HwLevel } from '../highway/hwtypes.ts';
import type { Subtrack } from '../world/types.ts';
import { isTowing } from './gridlen.ts';
import { trailerBehind } from '../physics/trailer.ts';

// m kept clear in front of and behind the reset car's body, and beside it: room to drive off
const CLEAR_ALONG_M = 1.5, CLEAR_ACROSS_M = 0.4;
// m further back each try when a spot is taken, and how many tries (240 m)
export const FREE_STEP_M = 6, FREE_TRIES = 40;
// s of a rolling put-back's speed kept clear ahead of it (the guard's: 15 m/s and up)
export const ROLL_CLEAR_S = 1.5;

/** A car as the spot test reads it: where, which way, how big. */
export interface SpotBody {
  x: number; y: number; heading: number; spec: { len: number; wid: number };
}

/**
 * Whether a car of this size put down at a pose touches no other car, each tested on the pose's
 * own axes with a margin (a car beside the spot in the next lane is not in the way).
 * @param pose where the car would stand and its heading, radians
 * @param pose.x world x, m
 * @param pose.y world y, m
 * @param pose.heading heading, radians
 * @param spec its length and width, m
 * @param spec.len length, m
 * @param spec.wid width, m
 * @param others the other cars
 * @param aheadM m more kept clear in front (a rolling put-back), 0 for a standing one
 * @returns true when the spot is free
 */
export function spotFree(pose: { x: number; y: number; heading: number },
  spec: { len: number; wid: number }, others: readonly SpotBody[], aheadM = 0): boolean {
  const cos = Math.cos(pose.heading), sin = Math.sin(pose.heading);
  for (const other of others) {
    const dx = other.x - pose.x, dy = other.y - pose.y;
    const along = dx * cos + dy * sin, across = -dx * sin + dy * cos;
    const turn = other.heading - pose.heading;
    const reachAlong = other.spec.len / 2 * Math.abs(Math.cos(turn))
      + other.spec.wid / 2 * Math.abs(Math.sin(turn));
    const reachAcross = other.spec.len / 2 * Math.abs(Math.sin(turn))
      + other.spec.wid / 2 * Math.abs(Math.cos(turn));
    const front = spec.len / 2 + CLEAR_ALONG_M + (along > 0 ? aheadM : 0);
    if (Math.abs(along) < front + reachAlong
      && Math.abs(across) < spec.wid / 2 + CLEAR_ACROSS_M + reachAcross) return false;
  }
  return true;
}

/**
 * The cars a reset of yours keeps clear of: the racing AI, and on the endless roads the police
 * (the other traffic is cleared from round the spot, as before: game/session.ts).
 * @returns the cars
 */
export function resetOthers(): SpotBody[] {
  const cars: SpotBody[] = game.ai.map((entry) => entry.car);
  if (LEVEL.endless) {
    for (const slot of game.traffic.list) if (!slot.parked && slot.police) cars.push(slot.car);
  }
  return cars;
}

/**
 * The first free spot from a reset's spot backwards: the spot itself when no car is in the way,
 * else each spot further back in turn (FREE_TRIES at most; the last one tried when none is free).
 * @param first the reset's own spot
 * @param poseOf where a spot puts the car and which way it faces
 * @param next the spot one try further back, or null when there is no road further back
 * @param aheadM m more kept clear in front (a rolling put-back), 0 for a standing one
 * @param mover the car put back and the cars it keeps clear of (default: yours, resetOthers)
 * @param mover.spec its length and width, m
 * @param mover.others the cars in the way
 * @returns the spot
 */
export function firstFree<T>(first: T, poseOf: (spot: T) => { x: number; y: number;
  heading: number }, next: (spot: T) => T | null, aheadM = 0,
mover?: { spec: { len: number; wid: number }; others: readonly SpotBody[] }): T {
  const others = mover ? mover.others : resetOthers(), spec = mover ? mover.spec : game.car.spec;
  // (your rig's trailer, lined up behind, must stand clear too)
  const trailer = !mover && isTowing(game.car) ? trailerBehind(game.car) : null;
  let spot = first;
  for (let tries = 0; tries < FREE_TRIES; tries++) {
    const pose = poseOf(spot);
    if (spotFree(pose, spec, others, aheadM)
      && (!trailer || spotFree(behindPose(pose, trailer.back), trailer, others))) return spot;
    const behind = next(spot);
    if (behind === null) return spot;
    spot = behind;
  }
  return spot;
}

/**
 * A pose a distance straight back from another (a trailer lined up behind its tractor).
 * @param pose the tractor's pose
 * @param back m back
 * @returns the pose behind
 */
function behindPose(pose: { x: number; y: number; heading: number }, back: number) {
  return { x: pose.x - Math.cos(pose.heading) * back, y: pose.y - Math.sin(pose.heading) * back,
    heading: pose.heading };
}

/**
 * The road distance a circuit or stage reset starts from: where the car last was on the road,
 * unless the car is now further back along the lap (it went off and came back down the run-off),
 * then where it is now, on its side of the road.
 * @param sub the road
 * @param rec where the car last was on the road: road distance and offset, m
 * @param rec.dist road distance, m
 * @param rec.off offset from the centre line, m
 * @param car the car
 * @param car.x world x, m
 * @param car.y world y, m
 * @param car.crossing the crossing it is on (world/crossings.ts)
 * @returns the record to reset from
 */
export function notAheadOf(sub: Subtrack, rec: { dist: number; off: number },
  car: { x: number; y: number; crossing?: number }): { dist: number; off: number } {
  const here = trackSpotOf(sub, car.x, car.y, car);
  if (!here || lapAhead(sub, here.dist, rec.dist) <= 0) return rec;
  return { dist: here.dist, off: (car.x - here.x) * here.nx + (car.y - here.y) * here.ny };
}

/**
 * The signed road distance from one point of a lap to another, the short way round: > 0 when
 * `onto` is ahead of `from`.
 * @param sub the road
 * @param from road distance, m
 * @param onto road distance, m
 * @returns m, -half a lap .. half a lap
 */
export function lapAhead(sub: Subtrack, from: number, onto: number): number {
  const total = sub.totalDist;
  return ((onto - from) % total + total * 1.5) % total - total / 2;
}

/**
 * A road distance stepped back along a lap: round past the line on a circuit; on a road with a
 * gap (a stage's ghost segment between its stop zone and its run-up) never into the gap.
 * @param sub the road
 * @param dist road distance, m
 * @param backM m back
 * @returns the road distance, m, or null when there is no road further back
 */
export function lapBack(sub: Subtrack, dist: number, backM: number): number | null {
  const total = sub.totalDist, back = ((dist - backM) % total + total) % total;
  const gap = sub.ghost;
  if (gap && (back >= gap.d0 && back < gap.d1 || (dist >= gap.d1 && back > dist))) return null;
  return back;
}

/**
 * One try further back along a lap for firstFree: FREE_STEP_M back, short of the race road's own
 * underpass (a reset never lands in its cut: world/trackunder.ts).
 * @param sub the road
 * @returns the step: road distance -> the one further back, or null
 */
export const lapStepBack = (sub: Subtrack) => (dist: number): number | null => {
  const back = lapBack(sub, dist, FREE_STEP_M);
  return back === null ? null : clearOfUnder(sub, back);
};

/**
 * The endless road's put-back (the guard's, or a reset from too far off the road to say where
 * you are): highway.ts highwayRespawn from the car's own road distance, the first spot free of
 * cars from there back.
 * @param level the highway level
 * @param fromS the car's road distance, m
 * @param aheadM m kept clear in front (the put-back rolls on at its speed)
 * @returns the pose and its road distance
 */
export function respawnBehind(level: HwLevel, fromS: number, aheadM: number) {
  const floor = roadSpan(level).s0 + 20;
  return firstFree(highwayRespawn(level, fromS),
    (spot) => ({ x: spot.x, y: spot.y, heading: spot.h }),
    (spot) => (spot.s - FREE_STEP_M > floor ? highwayRespawn(level, spot.s - FREE_STEP_M)
      : null), aheadM);
}

// game/rigreset.ts - A TOWING RIG'S RESET (passed 11-22; owner 11-22, option b: "articulated
// lorries reset fully inside the road's edge, on the bend's line, ready to drive off"). Was: the
// tractor put down as any car (half on the edge, its nose turned back 5-15 deg) and its trailer
// straight behind it (physics/trailer.ts lineUpTrailer) - on a tight bend across the run-off (a
// 15.8 m rig on a 30 m bend strays ~4 m off the road's line). Now the tractor stands along the
// road, its whole width inside the edge, and the trailer as if it had followed the road there: its
// kingpin on the tractor's fifth wheel, its axle group on the road's line one trailer wheelbase
// back from the pin (where a towed axle runs round a bend: inside the tractor's path), facing the
// pin. A spot whose hitch angle passes RIG_HITCH_MAX, or where a trailer corner stands off the
// road, is not used: the reset tries the next one back (game/resetspot.ts firstFree).
import { lineUpTrailer, rigGeometry } from '../physics/trailer.ts';
import type { Tractor } from '../physics/trailer.ts';
import { onTrack, querySubtrack } from '../world/tyrewall.ts';
import type { Car } from '../vehicle.ts';
import type { Subtrack } from '../world/types.ts';

/** A place and heading, world m and rad. */
export interface RigPose { x: number; y: number; heading: number }

// the most the trailer may stand turned from the tractor at a reset (the hitch's stop is 85 deg:
// a reset never starts near a fold), rad
const RIG_HITCH_MAX = 45 * Math.PI / 180;
// m the rig's widest half keeps inside the road's edge; m a step back along the road's line while
// the trailer's axle is looked for
const RIG_EDGE_MARGIN_M = 0.4, LINE_STEP_M = 0.5;

/**
 * The m across from the road's middle a rig's reset puts it (its side of the road): its widest
 * half and RIG_EDGE_MARGIN_M inside the edge, none past the middle.
 * @param car the tractor
 * @param halfRoadM the road's half width, m
 * @returns m from the middle (>= 0; the caller gives it its side)
 */
export function rigInset(car: Car, halfRoadM: number): number {
  const half = Math.max(car.spec.wid, rigGeometry(car).wid) / 2;
  return Math.max(0, halfRoadM - half - RIG_EDGE_MARGIN_M);
}

/**
 * Where the trailer stands behind a tractor put at a spot, following the road's line there.
 * @param car the tractor (its lengths)
 * @param tractor the tractor's pose
 * @param lineAt a point on the road's line the reset uses, m along the road
 * @param dist the tractor's spot along the road, m
 * @returns the trailer's pose, or null (turned past RIG_HITCH_MAX, or no line far enough back)
 */
export function followedTrailer(car: Car, tractor: RigPose,
  lineAt: (dist: number) => { x: number; y: number }, dist: number): RigPose | null {
  const geo = rigGeometry(car);
  const pinX = tractor.x - Math.cos(tractor.heading) * geo.pinBack,
    pinY = tractor.y - Math.sin(tractor.heading) * geo.pinBack;
  let prev = lineAt(dist - geo.pinBack), prevGap = Math.hypot(prev.x - pinX, prev.y - pinY);
  for (let back = LINE_STEP_M; back <= 3 * geo.wheelbase; back += LINE_STEP_M) {
    const here = lineAt(dist - geo.pinBack - back);
    const gap = Math.hypot(here.x - pinX, here.y - pinY);
    if (gap >= geo.wheelbase) {
      // (the axle where the line is one wheelbase from the pin, between the two points)
      const share = (geo.wheelbase - prevGap) / Math.max(1e-6, gap - prevGap);
      const axleX = prev.x + (here.x - prev.x) * share, axleY = prev.y + (here.y - prev.y) * share;
      const heading = Math.atan2(pinY - axleY, pinX - axleX);
      const hitch = Math.atan2(Math.sin(heading - tractor.heading),
        Math.cos(heading - tractor.heading));
      if (Math.abs(hitch) > RIG_HITCH_MAX) return null;
      return { x: pinX - Math.cos(heading) * geo.lf, y: pinY - Math.sin(heading) * geo.lf,
        heading };
    }
    prev = here;
    prevGap = gap;
  }
  return null;
}

/**
 * Whether every corner of the trailer at a pose stands on the road.
 * @param car the tractor (its trailer's size)
 * @param pose the trailer's pose
 * @param isOnRoad whether a world point is on the road
 * @returns all four are
 */
export function trailerOnRoad(car: Car, pose: RigPose,
  isOnRoad: (x: number, y: number) => boolean): boolean {
  const geo = rigGeometry(car), cos = Math.cos(pose.heading), sin = Math.sin(pose.heading);
  return [[1, 1], [1, -1], [-1, 1], [-1, -1]].every(([along, across]) => {
    const offA = along * geo.len / 2, offB = across * geo.wid / 2;
    return isOnRoad(pose.x + cos * offA - sin * offB, pose.y + sin * offA + cos * offB);
  });
}

/**
 * A circuit's or stage's rig reset: the trailer behind the tractor's pose at a road distance,
 * following the road's line at the tractor's offset, every corner on the road (else none).
 * @param car the tractor
 * @param sub the road
 * @param across the reset's m from the road's middle
 * @param tractor the tractor's pose
 * @param dist its road distance, m
 * @returns the trailer's pose, or null
 */
export function circuitTrailer(car: Car, sub: Subtrack, across: number, tractor: RigPose,
  dist: number): RigPose | null {
  const total = sub.totalDist;
  const lineAt = (along: number) => onTrack(sub, ((along % total) + total) % total, across, {});
  const pose = followedTrailer(car, tractor, lineAt, dist);
  const isOnRoad = (x: number, y: number) => querySubtrack(sub, x, y).dist <= sub.width / 2;
  return pose && trailerOnRoad(car, pose, isOnRoad) ? pose : null;
}

/**
 * Puts the rig's trailer where the reset found for it (none found: lined up straight behind, as
 * before).
 * @param car the tractor
 * @param pose the trailer's pose, or null
 */
export function placeTrailer(car: Tractor, pose: RigPose | null): void {
  if (!car.trailer) return;
  car.trailer.resetPose = pose;
  lineUpTrailer(car, car.trailer);
}

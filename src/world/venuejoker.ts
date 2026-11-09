// world/venuejoker.ts - A RALLYCROSS LAYOUT'S JOKER (spec.joker, world/venue.ts): the part of
// another layout's loop round a spot that this layout does not race, as the lane a car must take
// once in a race (game/rules.ts). Knobhill's: the rallycross lap cuts up the escape road from the
// Railway Straight to the start straight; the joker runs on round the circuit's hairpin.
import { SURFACES } from "./surfaces.ts";
import { querySubtrack } from "./tyrewall.ts";
import { HALF_ROAD, VENUE_ROAD_M } from "./venuegeo.ts";
import type { VenueBuild } from "./venue.ts";
import type { Lane } from "./types.ts";

// m past the raced road's edge a point of the other loop lies to be off it (the joker's own road)
const OFF_M = 1;
// m on along the shared road the lane reaches before and after its own road (its mouths, on the
// raced road: the driver's line branches off and rejoins there, ai/line.ts)
const MOUTH_M = 20;

/**
 * A layout's joker lane, in driving order (the other loop runs the same way round).
 * @param build the venue at game scale
 * @param layout the layout raced
 * @returns the lane, or null when the layout has no joker
 */
export function venueJoker(build: VenueBuild, layout: string): Lane | null {
  const joker = build.spec.joker;
  if (!joker || joker.layout !== layout) return null;
  const own = build.loops[layout], via = build.loops[joker.loop];
  const pts = via.pts, count = pts.length, wrap = (i: number) => ((i % count) + count) % count;
  const off = (i: number) => {
    const point = pts[wrap(i)];
    return querySubtrack(own, point.x, point.y).dist > HALF_ROAD + OFF_M;
  };
  const nearX = joker.near[0] * build.scale, nearY = joker.near[1] * build.scale;
  let mid = 0, best = Infinity;
  pts.forEach((point, i) => {
    const gap = Math.hypot(point.x - nearX, point.y - nearY);
    if (gap < best) [best, mid] = [gap, i];
  });
  if (!off(mid)) return null;
  let first = mid, last = mid;
  while (off(first - 1) && mid - first < count) first--;
  while (off(last + 1) && last - mid < count) last++;
  // lap m between two of the loop's points, forward
  const ahead = (from: number, until: number) =>
    ((pts[wrap(until)].dist - pts[wrap(from)].dist) % via.totalDist + via.totalDist)
      % via.totalDist;
  const offFirst = first, offLast = last;
  while (ahead(first - 1, offFirst) < MOUTH_M) first--;
  while (ahead(offLast, last + 1) < MOUTH_M) last++;
  const lane: [number, number][] = [];
  for (let i = first; i <= last; i++) lane.push([pts[wrap(i)].x, pts[wrap(i)].y]);
  return { pts: lane, width: VENUE_ROAD_M, surface: SURFACES.racetarmac };
}

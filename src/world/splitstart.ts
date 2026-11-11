// world/splitstart.ts - THE SPLIT START'S OTHER LINE (Level.splitStart, the Race of Champions'
// stadiums): the path crosses itself, its two lanes side by side, so the line alongside the start
// line lies on the path's other half - the rival's start and finish (game/grid.ts) and its painted
// line (world/venue.ts).
import { onTrack } from './tyrewall.ts';
import type { Subtrack } from './types.ts';

// the share of a lap on from the start line the other line is looked for in (the half's middle)
const SPLIT_FROM = 0.3, SPLIT_TO = 0.7;
const splitLines = new WeakMap<Subtrack, number>();

/**
 * The split start's other line: the point of the path's other half nearest the start line - the
 * lane alongside it.
 * @param sub the race road
 * @returns its road m
 */
export function splitLineDist(sub: Subtrack): number {
  const known = splitLines.get(sub);
  if (known !== undefined) return known;
  const line = onTrack(sub, 0, 0, {});
  let best = sub.totalDist / 2, bestGap = Infinity;
  for (let dist = SPLIT_FROM * sub.totalDist; dist <= SPLIT_TO * sub.totalDist; dist += 1) {
    const point = onTrack(sub, dist, 0, {}), gap = Math.hypot(point.x - line.x, point.y - line.y);
    if (gap < bestGap) {
      best = dist;
      bestGap = gap;
    }
  }
  splitLines.set(sub, best);
  return best;
}

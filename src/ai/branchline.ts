// ai/branchline.ts - A RACING LINE THROUGH A BRANCH (passed 11-04; owner: "some cars still turn
// slow for jokers tho rather than flowing in / out naturally"). MEASURED (tools/scratch/
// _jokerexit.mjs, Knobhill): the joker branch was the joker lane's CENTRELINE glued onto the
// racing line - an R 19 m kink where it leaves the line (the AI braked 85 -> 32 km/h for it) and
// R 18-26 m where it rejoins (out at 34-41 km/h where the line runs 70-80) - though the lane is
// 12 m wide. Now the branch gets the main line's treatment: MINIMUM-CURVATURE descent of each
// point's sideways offset inside the ground a car may use there (the road or the lane, LINE_MARGIN
// from their edges), its two ends pinned to the racing line so it leaves and rejoins tangent.
import type { PathPoint } from './types.ts';

// m kept from the edge of the road / lane (as the main line's LINE_MARGIN)
const MARGIN = 1.6;
// m: the furthest sideways a branch point is looked at, and the step it is looked at in
const REACH = 9, PROBE = 0.5;
// points at each end held on the racing line (so the branch leaves and rejoins it tangent)
const PINNED = 3;
// descent: spacings (m, coarse to fine), rounds at each, the step
const GAPS_M = [20, 10, 5, 2.5], ROUNDS = 300, FINAL_ROUNDS = 400, RATE = 0.05;

/**
 * The sideways room at each point of an open path: the offsets (m, + left) from the point that
 * stay on usable ground, as one unbroken run through 0.
 * @param pts the path, its points about 1 m apart
 * @param usable whether a car's centre may be at (x, y), MARGIN in from any edge
 * @returns low and high offsets per point, and each point's left normal
 */
function room(pts: PathPoint[], usable: (x: number, y: number, margin: number) => boolean) {
  const count = pts.length, low = new Float64Array(count), high = new Float64Array(count);
  const nx = new Float64Array(count), ny = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const before = pts[Math.max(0, i - 1)], after = pts[Math.min(count - 1, i + 1)];
    const head = Math.atan2(after.y - before.y, after.x - before.x);
    nx[i] = -Math.sin(head); ny[i] = Math.cos(head);
    const fits = (off: number) => usable(pts[i].x + nx[i] * off, pts[i].y + ny[i] * off, MARGIN);
    let left = 0, right = 0;
    while (left + PROBE <= REACH && fits(left + PROBE)) left += PROBE;
    while (right - PROBE >= -REACH && fits(right - PROBE)) right -= PROBE;
    low[i] = i < PINNED || i >= count - PINNED ? 0 : right;
    high[i] = i < PINNED || i >= count - PINNED ? 0 : left;
  }
  return { low, high, nx, ny };
}

/**
 * Moves an open path's points sideways onto a minimum-curvature line inside its room, ends
 * pinned (the same descent as the main racing line, line.ts smoothLine).
 * @param pts the path (changed in place), points about 1 m apart
 * @param usable whether a car's centre may be at (x, y), margin m in from any edge
 * @returns the path's new length, m
 */
export function flowBranch(pts: PathPoint[],
  usable: (x: number, y: number, margin: number) => boolean): number {
  const count = pts.length;
  const { low, high, nx, ny } = room(pts, usable);
  const off = new Float64Array(count), posX = new Float64Array(count),
    posY = new Float64Array(count), dx = new Float64Array(count), dy = new Float64Array(count);
  const baseX = pts.map((point) => point.x), baseY = pts.map((point) => point.y);
  const smooth = (gap: number, rounds: number) => {
    for (let round = 0; round < rounds; round++) {
      for (let i = 0; i < count; i++) {
        posX[i] = baseX[i] + nx[i] * off[i];
        posY[i] = baseY[i] + ny[i] * off[i];
      }
      for (let i = gap; i < count - gap; i++) {
        dx[i] = posX[i - gap] - 2 * posX[i] + posX[i + gap];
        dy[i] = posY[i - gap] - 2 * posY[i] + posY[i + gap];
      }
      for (let i = 2 * gap; i < count - 2 * gap; i++) {
        const gradX = dx[i - gap] - 2 * dx[i] + dx[i + gap],
          gradY = dy[i - gap] - 2 * dy[i] + dy[i + gap];
        const target = off[i] - RATE * (gradX * nx[i] + gradY * ny[i]);
        off[i] = Math.max(low[i], Math.min(high[i], target));
      }
    }
  };
  for (const metres of GAPS_M) smooth(Math.max(1, Math.round(metres)), ROUNDS);
  smooth(1, FINAL_ROUNDS);
  let total = 0;
  for (let i = 0; i < count; i++) {
    pts[i].x = baseX[i] + nx[i] * off[i];
    pts[i].y = baseY[i] + ny[i] * off[i];
    if (i > 0) total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return total;
}

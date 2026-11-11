// world/venuetidy.ts - A STREET VENUE'S BARRIERS TIDIED (owner 11-11 on Moanaco: "tidy up the
// placement of the barriers etc - they look messy and cheap"). The edge (world/venueedge.ts) lays a
// barrier at the run-off's rim of every stretch; where a street circuit's bends are tighter than
// the rim's offset and its stretches run close (a hairpin's legs, Portier inside Mirabeau Bas, the
// pool's chicanes by the pit lane) that left loops where a rim folded back on itself, short stubs
// beside a barrier already standing, and ends a few metres short of the next. VenueSpec.tidyEdge
// (Moanaco's only) runs four passes over the Armco and walls: a loop cut out at its crossing, a
// run's fold back along itself dropped, a short run doubling another dropped, two ends that
// nearly meet joined where the join keeps clear of the road and every lane (a pit lane's mouth
// stays open).
import { distToLine } from "./venuegeo.ts";
import { onGroundQuery, querySubtrack } from "./tyrewall.ts";
import type { Barrier, Lane, Point, Subtrack } from "./types.ts";

// m: a run this short lying within DOUBLE_M of another barrier all along is a stub; two ends this
// near are joined; a join keeps this far off the race road's centre (its half, 2.5 m: the edge's
// road clearance) and a lane's edge
const STUB_M = 14, DOUBLE_M = 3, JOIN_M = 7, JOIN_ROAD_M = 9, JOIN_LANE_M = 1;
// a fold: the run's heading over FOLD_PTS points either side turns back past this (cos); the part
// after it, this short and within FOLD_DOUBLE_M of the part before all along, is dropped (a rim
// round the inside of a narrow U laid up one side and back down the other)
const FOLD_COS = -0.6, FOLD_PTS = 3, FOLD_M = 30, FOLD_DOUBLE_M = 6;
// points (about a metre apart) back from the joint a fold's end comes back beside
const FOLD_BACK_PTS = 8;
// a joined run's point its neighbours turn back on sharper than this (cos) is a spike
const SPIKE_COS = -0.8;
// the barrier kinds tidied (a catch fence, a pit wall or a building's outline are left as laid)
const TIDIED = new Set<Barrier['kind']>(['armco', 'wall']);

/**
 * Where two segments cross: the share along the first, or null.
 * @param from1 the first's start
 * @param to1 its end
 * @param from2 the second's start
 * @param to2 its end
 * @returns the share, or null
 */
function crossAt(from1: Point, to1: Point, from2: Point, to2: Point): number | null {
  const dx1 = to1[0] - from1[0], dy1 = to1[1] - from1[1];
  const dx2 = to2[0] - from2[0], dy2 = to2[1] - from2[1];
  const den = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(den) < 1e-9) return null;
  const gapX = from2[0] - from1[0], gapY = from2[1] - from1[1];
  const along = (gapX * dy2 - gapY * dx2) / den, across = (gapX * dy1 - gapY * dx1) / den;
  return along > 0 && along < 1 && across > 0 && across < 1 ? along : null;
}

/**
 * A line with each loop cut out: where a later segment crosses an earlier one, the points between
 * are dropped and the crossing point kept.
 * @param pts the line
 * @returns the line without loops
 */
export function withoutLoops(pts: Point[]): Point[] {
  const out = pts.slice();
  for (let i = 0; i + 1 < out.length; i++)
    for (let j = out.length - 2; j > i + 1; j--) {
      const share = crossAt(out[i], out[i + 1], out[j], out[j + 1]);
      if (share === null) continue;
      const meet: Point = [out[i][0] + (out[i + 1][0] - out[i][0]) * share,
        out[i][1] + (out[i + 1][1] - out[i][1]) * share];
      out.splice(i + 1, j - i, meet);
      break;
    }
  return out;
}

/**
 * The unit heading from one point of a line to another (a zero step: none).
 * @param from the start
 * @param until the end
 * @returns the heading
 */
function headingOf(from: Point, until: Point): Point {
  const len = Math.hypot(until[0] - from[0], until[1] - from[1]) || 1;
  return [(until[0] - from[0]) / len, (until[1] - from[1]) / len];
}

/**
 * A line split where it turns back on itself.
 * @param pts the line
 * @returns the parts, in order (each fold's point in both)
 */
function splitFolds(pts: Point[]): Point[][] {
  const parts: Point[][] = [];
  let from = 0;
  for (let i = FOLD_PTS; i + FOLD_PTS < pts.length; i++) {
    const before = headingOf(pts[i - FOLD_PTS], pts[i]);
    const after = headingOf(pts[i], pts[i + FOLD_PTS]);
    if (before[0] * after[0] + before[1] * after[1] > FOLD_COS || i - from < FOLD_PTS) continue;
    parts.push(pts.slice(from, i + 1));
    from = i;
  }
  parts.push(pts.slice(from));
  return parts;
}

/**
 * Whether a part folds back along the part before it: short, near the part before all along, and
 * coming back beside it short of the joint.
 * @param prior the part before
 * @param pts the part
 * @returns true when it does
 */
function foldsBack(prior: Point[] | null, pts: Point[]): boolean {
  if (!prior || prior.length <= FOLD_PTS || pts.length <= FOLD_PTS || lengthOf(pts) >= FOLD_M)
    return false;
  // (it comes back: its end beside the part before well short of the joint)
  const [endX, endY] = pts[pts.length - 1], early = prior.slice(0, -FOLD_BACK_PTS);
  return early.length > 1 && distToLine(early, endX, endY) < FOLD_DOUBLE_M
    && pts.every(([x, y]) => distToLine(prior, x, y) < FOLD_DOUBLE_M);
}

/**
 * Drops the parts of the runs that fold back along the part before them (in one run, or a run's
 * next chunk starting at the fold).
 * @param runs the runs
 * @returns the runs kept, split at their folds
 */
function withoutFolds(runs: Barrier[]): Barrier[] {
  const out: Barrier[] = [];
  for (const run of runs) {
    if (!TIDIED.has(run.kind)) { out.push(run); continue; }
    splitFolds(run.pts).forEach((pts, i, parts) => {
      // (the chunk before, ending where this one starts)
      const last = out[out.length - 1], end = last?.pts[last.pts.length - 1];
      const joined = i === 0 && last && TIDIED.has(last.kind) && end
        && Math.hypot(end[0] - pts[0][0], end[1] - pts[0][1]) < 0.01 ? last.pts : null;
      if (foldsBack(i > 0 ? parts[i - 1] : joined, pts)) return;
      if (pts.length > 1) out.push({ ...run, pts });
    });
  }
  return out;
}

/**
 * A line's length.
 * @param pts the line
 * @returns m
 */
const lengthOf = (pts: Point[]) => pts.slice(1).reduce((sum, point, i) =>
  sum + Math.hypot(point[0] - pts[i][0], point[1] - pts[i][1]), 0);

/**
 * Whether a short run only doubles another barrier: every point of it within DOUBLE_M of one.
 * @param run the run
 * @param others the barriers (a longer one it doubles)
 * @returns true when it does
 */
function isStub(run: Barrier, others: Barrier[]): boolean {
  const length = lengthOf(run.pts);
  if (length >= STUB_M) return false;
  // (of two stubs doubling each other the longer is kept)
  const bigger = others.filter((other) => other !== run && lengthOf(other.pts) > length);
  return run.pts.every(([x, y]) => bigger.some((other) => distToLine(other.pts, x, y) < DOUBLE_M));
}

/**
 * Whether a straight join between two ends keeps clear of the race road and every lane.
 * @param from one end
 * @param until the other
 * @param sub the race road
 * @param lanes the lanes
 * @returns true when it does
 */
function joinClear(from: Point, until: Point, sub: Subtrack, lanes: Lane[]): boolean {
  for (let share = 0; share <= 1.0001; share += 0.1) {
    const x = from[0] + (until[0] - from[0]) * share, y = from[1] + (until[1] - from[1]) * share;
    if (onGroundQuery(() => querySubtrack(sub, x, y)).dist < JOIN_ROAD_M) return false;
    if (lanes.some((lane) => distToLine(lane.pts, x, y) < lane.width / 2 + JOIN_LANE_M))
      return false;
  }
  return true;
}

/**
 * Joins the runs whose ends nearly meet (the nearest pair first), each end joined once.
 * @param runs the tidied runs (changed: an end gets the other's end added)
 * @param sub the race road
 * @param lanes the lanes
 */
function joinEnds(runs: Barrier[], sub: Subtrack, lanes: Lane[]): void {
  const ends = runs.flatMap((run) => [{ run, first: true }, { run, first: false }]);
  // (the run carried on to meet the other: a tidied one - a fence keeps its own ends)
  const ownsJoin = (one: number, two: number) => (TIDIED.has(ends[one].run.kind) ? [one, two]
    : TIDIED.has(ends[two].run.kind) ? [two, one] : null);
  const endOf = (end: { run: Barrier; first: boolean }) =>
    (end.first ? end.run.pts[0] : end.run.pts[end.run.pts.length - 1]);
  const pairs: { gap: number; one: number; two: number }[] = [];
  for (let one = 0; one < ends.length; one++)
    for (let two = one + 1; two < ends.length; two++) {
      if (ends[one].run === ends[two].run || !ownsJoin(one, two)) continue;
      const [oneX, oneY] = endOf(ends[one]), [twoX, twoY] = endOf(ends[two]);
      const gap = Math.hypot(twoX - oneX, twoY - oneY);
      if (gap > 0.01 && gap < JOIN_M) pairs.push({ gap, one, two });
    }
  const used = new Set<number>();
  for (const { one, two } of pairs.sort((first, second) => first.gap - second.gap)) {
    if (used.has(one) || used.has(two)) continue;
    if (!joinClear(endOf(ends[one]), endOf(ends[two]), sub, lanes)) continue;
    used.add(one);
    used.add(two);
    const [own, met] = ownsJoin(one, two)!, end = ends[own], other = endOf(ends[met]);
    if (end.first) end.run.pts.unshift([other[0], other[1]]);
    else end.run.pts.push([other[0], other[1]]);
  }
}

/**
 * A line without its spikes: a point its neighbours turn back on (a flared end a join carried on
 * past), and a point on the one before it, dropped until none is left.
 * @param pts the line (changed)
 */
function despike(pts: Point[]): void {
  for (let i = 1; i + 1 < pts.length; i++) {
    const [prevX, prevY] = pts[i - 1], [x, y] = pts[i], [nextX, nextY] = pts[i + 1];
    const inX = x - prevX, inY = y - prevY, outX = nextX - x, outY = nextY - y;
    const lens = Math.hypot(inX, inY) * Math.hypot(outX, outY);
    if (lens < 0.01 || (inX * outX + inY * outY) / lens < SPIKE_COS) {
      pts.splice(i, 1);
      i = Math.max(0, i - 2);
    }
  }
}

/**
 * A venue's barriers tidied (VenueSpec.tidyEdge): loops and folds cut out, stubs dropped, near
 * ends joined.
 * @param barriers the barriers as laid
 * @param sub the race road
 * @param lanes the lanes (a join keeps off them)
 * @param joinFences an Armco end may be carried on to a catch fence's
 * @returns the barriers
 */
export function tidyBarriers(barriers: Barrier[], sub: Subtrack, lanes: Lane[],
  joinFences = false): Barrier[] {
  const tidied = withoutFolds(barriers.map((barrier) => (TIDIED.has(barrier.kind)
    ? { ...barrier, pts: withoutLoops(barrier.pts) } : barrier)));
  const kept = tidied.filter((barrier) => !TIDIED.has(barrier.kind) || !isStub(barrier, tidied));
  // (an Armco end carried on to a catch fence's too where the venue asks: a stadium's)
  joinEnds(kept.filter((barrier) => TIDIED.has(barrier.kind)
    || (joinFences && barrier.kind === 'catchfence')), sub, lanes);
  for (const barrier of kept) if (TIDIED.has(barrier.kind)) despike(barrier.pts);
  return kept;
}

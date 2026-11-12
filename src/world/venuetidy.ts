// world/venuetidy.ts - A STREET VENUE'S BARRIERS TIDIED (owner 11-11 on Moanaco: "tidy up the
// placement of the barriers etc - they look messy and cheap"). The edge (world/venueedge.ts) lays a
// barrier at the run-off's rim of every stretch; where a street circuit's bends are tighter than
// the rim's offset and its stretches run close (a hairpin's legs, Portier inside Mirabeau Bas, the
// pool's chicanes by the pit lane) that left loops where a rim folded back on itself, short stubs
// beside a barrier already standing, and ends a few metres short of the next. VenueSpec.tidyEdge
// (Moanaco's, the stadiums') runs its passes over the Armco and walls: a loop cut out at its
// crossing, a run's fold back along itself dropped, a short run doubling another dropped, a run's
// end along another trimmed (the stadiums'), two ends that nearly meet joined where the join
// keeps clear of the road and every lane (a pit lane's mouth stays open); a stadium's barrier
// ends by a crossover's portals carried on to the portals' wall corners.
import { distToLine } from "./venuegeo.ts";
import { portalCorners, underPortals } from "./venuecross.ts";
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
// m: a free barrier end this near an underpass portal's wall corner is carried on to it; the
// carried stretch keeps this far off the race road's centre on the ground (half the road and half
// a car: the corner itself stands 7.7 m off its own road)
const TUCK_M = 9, TUCK_ROAD_M = 7.2;
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
export function joinClear(from: Point, until: Point, sub: Subtrack, lanes: Lane[],
  roadM = JOIN_ROAD_M): boolean {
  for (let share = 0; share <= 1.0001; share += 0.1) {
    const x = from[0] + (until[0] - from[0]) * share, y = from[1] + (until[1] - from[1]) * share;
    if (onGroundQuery(() => querySubtrack(sub, x, y)).dist < roadM) return false;
    if (lanes.some((lane) => distToLine(lane.pts, x, y) < lane.width / 2 + JOIN_LANE_M))
      return false;
  }
  return true;
}

// m from a portal's corner within which two ends are not joined into a sharp V
const V_CLEAR_M = TUCK_M + 2;

/**
 * Whether joining two ends would turn the barrier back sharper than a right angle (a V) near a
 * portal's corner.
 * @param one an end
 * @param two the other
 * @param corners the portals' wall corners
 * @returns true when it would
 */
function makesV(one: RunEnd, two: RunEnd, corners: Point[]): boolean {
  const tipOf = (end: RunEnd) => (end.first ? end.run.pts[0] : end.run.pts[end.run.pts.length - 1]);
  const nextOf = (end: RunEnd) => (end.first ? end.run.pts[1] : end.run.pts[end.run.pts.length
    - 2]);
  if (!nextOf(one) || !nextOf(two)) return false;
  const [x, y] = tipOf(one), [inX, inY] = nextOf(one), [outX, outY] = nextOf(two);
  if (!corners.some(([atX, atY]) => Math.hypot(atX - x, atY - y) < V_CLEAR_M)) return false;
  return (x - inX) * (outX - tipOf(two)[0]) + (y - inY) * (outY - tipOf(two)[1]) < 0;
}

/**
 * One end of a join carried on to the other's point: cut back first where the point lies behind
 * it (else a hook: a stadium's, away from its portals), else as laid.
 * @param end the end (its run changed)
 * @param point the other end's point
 * @param cutBack cut back first (a stadium's)
 */
function joinTo(end: RunEnd, point: Point, cutBack: boolean): void {
  if (cutBack) carryEndTo(end, point);
  else if (end.first) end.run.pts.unshift([point[0], point[1]]);
  else end.run.pts.push([point[0], point[1]]);
}

/**
 * Joins the runs whose ends nearly meet (the nearest pair first), each end joined once - not into
 * a sharp V near a crossover portal's corner (a stadium's: each end is carried on to a corner of
 * its own there, tuckToPortals).
 * @param runs the tidied runs (changed: an end gets the other's end added)
 * @param sub the race road
 * @param lanes the lanes
 * @param corners the portals' wall corners a V keeps off (none: any join)
 */
function joinEnds(runs: Barrier[], sub: Subtrack, lanes: Lane[], corners: Point[] = []): void {
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
    if (corners.length && makesV(ends[one], ends[two], corners)) continue;
    used.add(one);
    used.add(two);
    const [own, met] = ownsJoin(one, two)!, end = ends[own], other = endOf(ends[met]);
    // (away from a portal: by one the end is carried on to its corner after, tuckToPortals)
    joinTo(end, other, corners.length > 0 && corners.every(([atX, atY]) =>
      Math.hypot(atX - other[0], atY - other[1]) >= V_CLEAR_M));
  }
}

/**
 * A run's ends trimmed where they double another barrier (one not carried on from that end: a run
 * from the edge laid on along a bridge's parapet), at least two points kept.
 * @param run the run (changed)
 * @param others the barriers
 */
function trimDoubledEnds(run: Barrier, others: Barrier[]): void {
  for (const first of [true, false]) {
    const end = first ? run.pts[0] : run.pts[run.pts.length - 1];
    const touches = (other: Barrier) => [other.pts[0], other.pts[other.pts.length - 1]]
      .some(([x, y]) => Math.hypot(x - end[0], y - end[1]) < 0.01);
    const beside = others.filter((other) => other !== run && TIDIED.has(other.kind)
      && !touches(other));
    const doubled = ([x, y]: Point) => beside.some((other) => distToLine(other.pts, x, y)
      < DOUBLE_M);
    while (run.pts.length > 2 && doubled(first ? run.pts[0] : run.pts[run.pts.length - 1])
      && doubled(first ? run.pts[1] : run.pts[run.pts.length - 2])) {
      if (first) run.pts.shift();
      else run.pts.pop();
    }
  }
}

/** One end of a barrier run. */
interface RunEnd { run: Barrier; first: boolean }

/**
 * A run's end carried on to a point: cut back first while the point lies behind its last step
 * (down to one point, the corner then its second: an end run on past the corner turned back to
 * it - a fold), then the point added.
 * @param end the end (its run changed)
 * @param corner the point
 */
function carryEndTo(end: RunEnd, corner: Point): void {
  const pts = end.run.pts;
  const behind = (tip: Point, before: Point) => (corner[0] - tip[0]) * (tip[0] - before[0])
    + (corner[1] - tip[1]) * (tip[1] - before[1]) < 0;
  if (end.first) {
    while (pts.length > 1 && behind(pts[0], pts[1])) pts.shift();
    pts.unshift([corner[0], corner[1]]);
  } else {
    while (pts.length > 1 && behind(pts[pts.length - 1], pts[pts.length - 2])) pts.pop();
    pts.push([corner[0], corner[1]]);
  }
}

/**
 * The end of another run meeting this one (by a portal: the apex of the wedge between two roads
 * parting, at whatever angle the two barriers meet), or null.
 * @param end the end
 * @param ends every end
 * @returns the other end at the joint
 */
function apexPartner(end: RunEnd, ends: RunEnd[]): RunEnd | null {
  const tipOf = (item: RunEnd) => (item.first ? item.run.pts[0] : item.run.pts[item.run.pts.length
    - 1]);
  const nextOf = (item: RunEnd) => (item.first ? item.run.pts[1] : item.run.pts[item.run.pts.length
    - 2]);
  const [x, y] = tipOf(end);
  const other = ends.find((item) => item !== end && item.run !== end.run
    && Math.hypot(tipOf(item)[0] - x, tipOf(item)[1] - y) < 0.01);
  return other && nextOf(end) && nextOf(other) ? other : null;
}

/**
 * A stadium's barriers tucked into its crossover's portals (where they stopped short, a car caught
 * on the wall's corner and the gap let it out): each wall corner takes the nearest free barrier end
 * (one meeting no other run's end) or V apex (two runs meeting sharply: both its arms) within
 * TUCK_M, carried on to the corner where the stretch keeps TUCK_ROAD_M off the road - so the
 * barrier ends against the wall, no gap or pocket between. A run then under STUB_M from a corner
 * to an end meeting nothing is a leftover sticking out.
 * @param runs the barriers (changed)
 * @param sub the race road
 * @param lanes the lanes (a join keeps off them)
 * @returns the leftovers (to drop)
 */
function tuckToPortals(runs: Barrier[], sub: Subtrack, lanes: Lane[]): Barrier[] {
  const ends: RunEnd[] = runs.flatMap((run) => [{ run, first: true }, { run, first: false }]);
  const endOf = (end: RunEnd) => (end.first ? end.run.pts[0] : end.run.pts[end.run.pts.length - 1]);
  const meets = (point: Point, self: RunEnd) => ends.some((other) =>
    other !== self && Math.hypot(endOf(other)[0] - point[0], endOf(other)[1] - point[1]) < 0.01);
  // (each candidate: a free end, or a V apex's two ends)
  const candidates = ends.map((end) => (meets(endOf(end), end)
    ? (apexPartner(end, ends) ? [end, apexPartner(end, ends)!] : null) : [end]))
    .filter((group): group is RunEnd[] => !!group);
  const used = new Set<RunEnd>(), tuckedRuns = new Set<Barrier>();
  for (const corner of underPortals(sub).flatMap(portalCorners)) {
    let best: RunEnd[] | null = null, bestGap = TUCK_M;
    for (const group of candidates) {
      const [x, y] = endOf(group[0]), gap = Math.hypot(x - corner[0], y - corner[1]);
      if (group.some((end) => used.has(end)) || gap >= bestGap) continue;
      if (!joinClear([x, y], corner, sub, lanes, TUCK_ROAD_M)) continue;
      best = group;
      bestGap = gap;
    }
    if (!best) continue;
    // (a V between a wall's two corners: the arm heading away from this corner cut back to it, the
    // other left free for the wall's other corner - each arm to the corner on its own side, so the
    // two never cross)
    const heading = (end: RunEnd) => {
      const tip = endOf(end);
      const next = end.first ? end.run.pts[1] : end.run.pts[end.run.pts.length - 2];
      const stepX = tip[0] - next[0], stepY = tip[1] - next[1];
      const toX = corner[0] - tip[0], toY = corner[1] - tip[1];
      return (stepX * toX + stepY * toY) / ((Math.hypot(stepX, stepY) * Math.hypot(toX, toY)) || 1);
    };
    const carried = best.length > 1 && heading(best[1]) < heading(best[0]) ? best[1] : best[0];
    used.add(carried);
    tuckedRuns.add(carried.run);
    carryEndTo(carried, corner);
    if (best.length > 1) candidates.push([best[0] === carried ? best[1] : best[0]]);
  }
  const loose = (run: Barrier) => ends.filter((end) => end.run === run && !used.has(end)
    && !meets(endOf(end), end)).length > 0;
  return [...tuckedRuns].filter((run) => lengthOf(run.pts) < STUB_M && loose(run));
}

/**
 * Runs of one kind whose ends meet made one run (a stadium's: its corner joins one line with the
 * barrier they meet, not a short run of their own), until none meet - not where they meet at a
 * sharp V (the apex of the wedge between two roads parting: two barriers, rightly), nor by a
 * portal's corner (each carried on to a corner of its own there, tuckToPortals).
 * @param runs the barriers
 * @param corners the portals' wall corners
 * @returns the barriers, merged
 */
function mergeMeeting(runs: Barrier[], corners: Point[]): Barrier[] {
  const byPortal = (point: Point) => corners.some(([atX, atY]) => Math.hypot(atX - point[0],
    atY - point[1]) < V_CLEAR_M);
  // (a step turning more than a right angle from the one before at the joint)
  const foldsAt = (pts: Point[], index: number) => index > 0 && index + 1 < pts.length
    && (pts[index][0] - pts[index - 1][0]) * (pts[index + 1][0] - pts[index][0])
    + (pts[index][1] - pts[index - 1][1]) * (pts[index + 1][1] - pts[index][1]) < 0;
  const out = runs.map((run) => ({ ...run, pts: run.pts.slice() }));
  const meet = (first: Point, second: Point) => Math.hypot(first[0] - second[0],
    first[1] - second[1]) < 0.01;
  for (let one = 0; one < out.length; one++) {
    for (let two = 0; two < out.length; two++) {
      const run = out[one], other = out[two];
      if (one === two || run.kind !== other.kind || !TIDIED.has(run.kind)) continue;
      const head = run.pts[0], tail = run.pts[run.pts.length - 1], kept = run.pts;
      const joint = meet(tail, other.pts[0]) || meet(tail, other.pts[other.pts.length - 1])
        ? run.pts.length - 1 : other.pts.length - 1;
      const start = other.pts[0], end = other.pts[other.pts.length - 1];
      if (meet(tail, start)) run.pts = [...run.pts, ...other.pts.slice(1)];
      else if (meet(tail, end)) run.pts = [...run.pts, ...other.pts.slice(0, -1).reverse()];
      else if (meet(head, end)) run.pts = [...other.pts, ...run.pts.slice(1)];
      else if (meet(head, start)) run.pts = [...other.pts.slice(1).reverse(), ...run.pts];
      else continue;
      if (foldsAt(run.pts, joint) || byPortal(run.pts[joint])) {
        run.pts = kept;
        continue;
      }
      out.splice(two, 1);
      if (two < one) one--;
      two = -1;
    }
  }
  return out;
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
 * @param joinFences an Armco end may be carried on to a catch fence's, and an end along another
 *   barrier trimmed (a stadium's)
 * @returns the barriers
 */
export function tidyBarriers(barriers: Barrier[], sub: Subtrack, lanes: Lane[],
  joinFences = false): Barrier[] {
  const tidied = withoutFolds(barriers.map((barrier) => (TIDIED.has(barrier.kind)
    ? { ...barrier, pts: withoutLoops(barrier.pts) } : barrier)));
  const kept = tidied.filter((barrier) => !TIDIED.has(barrier.kind) || !isStub(barrier, tidied));
  // (an Armco end carried on to a catch fence's too where the venue asks: a stadium's)
  joinEnds(kept.filter((barrier) => TIDIED.has(barrier.kind)
    || (joinFences && barrier.kind === 'catchfence')), sub, lanes,
  joinFences ? underPortals(sub).flatMap(portalCorners) : []);
  // (a stadium's abutment ends trimmed where they lie along a parapet; Moanaco's edge as it was)
  const trimmed = joinFences ? kept.filter((barrier) => TIDIED.has(barrier.kind)) : [];
  for (const barrier of trimmed) trimDoubledEnds(barrier, kept);
  // (and its ends by a crossover's portals carried on to their walls - before the spikes go: an
  // end that ran on past the corner turned back to it - once a join has left no stub doubling
  // another)
  // (the runs that meet made one first, so a cut back runs along the whole line)
  // (and a short run between two ends by a portal - a connector the edge laid across the wedge's
  // apex - dropped: the ends it joined are each carried on to a corner of their own)
  const corners = underPortals(sub).flatMap(portalCorners);
  const byPortal = (point: Point) => corners.some(([atX, atY]) => Math.hypot(atX - point[0],
    atY - point[1]) < V_CLEAR_M);
  const connector = (barrier: Barrier) => TIDIED.has(barrier.kind) && lengthOf(barrier.pts) < STUB_M
    && byPortal(barrier.pts[0]) && byPortal(barrier.pts[barrier.pts.length - 1]);
  const joined = joinFences ? mergeMeeting(kept.filter((barrier) => !connector(barrier)
    && (!TIDIED.has(barrier.kind) || !isStub(barrier, kept))), corners) : kept;
  const tucked = joinFences ? joined.filter((barrier) => TIDIED.has(barrier.kind)
    || barrier.kind === 'catchfence') : [];
  const leftovers = new Set(tuckToPortals(tucked, sub, lanes));
  const done = joined.filter((barrier) => !leftovers.has(barrier));
  for (const barrier of done) if (TIDIED.has(barrier.kind) || tucked.includes(barrier))
    despike(barrier.pts);
  return done;
}

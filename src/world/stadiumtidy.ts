// world/stadiumtidy.ts - A STADIUM'S BARRIERS MADE EVEN (VenueSpec.evenEdge; owner 11-12 on The
// Bird's Mess: "slightly messy Armco / fences"). After the tidy (world/venuetidy.ts) a stadium's
// edge still showed where its two lanes run apart (the corners either side of the crossover, where
// the inner lane runs 32 m in, not 20): the Armco between them followed one lane's rim then the
// other's, a zig-zag of half a metre to a metre and a half; and two runs there stopped a few
// metres short of the run beside them. Here each Armco run and catch fence is eased (its points
// but its ends and those by a crossover's portals, where the flares are laid exactly) and each free
// end carried on to the nearest run beside it.
import { joinClear } from "./venuetidy.ts";
import { onGroundQuery, querySubtrack } from "./tyrewall.ts";
import type { Barrier, Lane, Point, Subtrack } from "./types.ts";

// the runs eased (Taubin's smoothing, the points about a metre apart): EASE_PASSES pairs of passes,
// each a share EASE_LAMBDA toward the neighbours' middle and EASE_MU back - its pass band about a
// tenth of the sampling (a wave under ~10 m long damped, a bend's radius kept)
const EASE_PASSES = 12, EASE_LAMBDA = 0.5, EASE_MU = -0.53;
// m: the most an eased point moves from where it was laid (the zig-zag's half; a real corner -
// a hook into a portal's wall, a lens's end - keeps its shape)
const EASE_MAX_M = 0.8;
// m: a point this near a crossover portal's wall corner keeps its place (the flares into a mouth,
// laid exactly by the tidy); an eased point keeps this far off the race road's centre (the rims
// stand 9.5 m off; barriercheck's limit 8.5) or stays where it was
const PORTAL_KEEP_M = 14, EASE_ROAD_M = 9;
// m: an end this near another barrier meets it already; one up to FREE_JOIN_M away is carried on
// to the nearest point of it
const MEET_M = 0.5, FREE_JOIN_M = 6;
// m: a free end's points this near the run it is carried on to are cut back first (venueaudit's
// doubling: two barriers within 2.5 m over 8 m)
const BESIDE_M = 3;
// m: a join this near the met run's own end goes to that end (no stub split off it)
const SPLIT_END_M = 3;
const EASED = new Set<Barrier['kind']>(['armco', 'catchfence']);

/** The nearest point of a line to a point: where, how far, on which of its segments. */
interface LineFoot { spot: Point; gap: number; seg: number }

/**
 * The nearest point on a line to a point.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @returns the point, its distance and its segment
 */
function nearestOn(pts: Point[], x: number, y: number): LineFoot {
  let foot: LineFoot = { spot: pts[0], gap: Infinity, seg: 0 };
  for (let i = 0; i + 1 < pts.length; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1], dx = toX - fromX, dy = toY - fromY;
    const share = Math.max(0, Math.min(1, ((x - fromX) * dx + (y - fromY) * dy)
      / (dx * dx + dy * dy || 1e-9)));
    const pointX = fromX + dx * share, pointY = fromY + dy * share;
    const dist = Math.hypot(pointX - x, pointY - y);
    if (dist < foot.gap) foot = { spot: [pointX, pointY], gap: dist, seg: i };
  }
  return foot;
}

/**
 * A run split where another's end is carried on to it (a T): the two parts and the joined end
 * then meet end to end, a joint as at any bend.
 * @param runs the barriers (the second part added)
 * @param run the run met
 * @param foot where, and on which of its segments
 */
function splitAt(runs: Barrier[], run: Barrier, foot: LineFoot): void {
  const isNear = (point: Point) => Math.hypot(point[0] - foot.spot[0], point[1] - foot.spot[1])
    < SPLIT_END_M;
  if (isNear(run.pts[0]) || isNear(run.pts[run.pts.length - 1])) return;
  const rest: Point[] = [foot.spot, ...run.pts.slice(foot.seg + 1)];
  run.pts = [...run.pts.slice(0, foot.seg + 1), foot.spot];
  runs.push({ ...run, pts: rest });
}

/**
 * How far a point is from the race road's centre, on the ground (the road over a crossover's cut
 * is not the road below it).
 * @param sub the race road
 * @param x world x
 * @param y world y
 * @returns metres
 */
const roadGap = (sub: Subtrack, x: number, y: number): number =>
  onGroundQuery(() => querySubtrack(sub, x, y)).dist;

/**
 * A point moved by a share of the way to its two neighbours' middle (negative: away from it),
 * never more than EASE_MAX_M in all from where it was laid (a corner keeps its shape).
 * @param was the run as the last pass left it
 * @param laid the run as laid
 * @param index the point
 * @param share the share (Taubin's lambda, or mu)
 * @returns the moved point
 */
function easedPoint(was: Point[], laid: Point[], index: number, share: number): Point {
  const [prevX, prevY] = was[index - 1], [x, y] = was[index], [nextX, nextY] = was[index + 1];
  const movedX = x + share * ((prevX + nextX) / 2 - x);
  const movedY = y + share * ((prevY + nextY) / 2 - y);
  const [laidX, laidY] = laid[index], moveX = movedX - laidX, moveY = movedY - laidY;
  const shift = Math.hypot(moveX, moveY), keep = shift > EASE_MAX_M ? EASE_MAX_M / shift : 1;
  return [laidX + moveX * keep, laidY + moveY * keep];
}

/**
 * One run eased by Taubin's smoothing (a pass toward the neighbours, EASE_LAMBDA, then one back,
 * EASE_MU): a zig-zag a few metres long goes, a bend keeps its radius (plain averaging pulled a
 * hairpin's Armco in onto its tyre rows). Its ends and the points by a portal stay; a point that
 * would come nearer the road than EASE_ROAD_M (and nearer than it was) stays where it was.
 * @param pts the run (changed)
 * @param sub the race road
 * @param corners the crossover portals' wall corners
 */
function easeRun(pts: Point[], sub: Subtrack, corners: Point[]): void {
  const laid = pts.map(([x, y]): Point => [x, y]);
  const isFixed = pts.map(([x, y], i) => i === 0 || i === pts.length - 1
    || corners.some(([cornerX, cornerY]) => Math.hypot(cornerX - x, cornerY - y)
      < PORTAL_KEEP_M));
  for (let pass = 0; pass < EASE_PASSES * 2; pass++) {
    const was = pts.map(([x, y]): Point => [x, y]), share = pass % 2 ? EASE_MU : EASE_LAMBDA;
    for (let i = 1; i + 1 < pts.length; i++) {
      if (isFixed[i]) continue;
      const [x, y] = easedPoint(was, laid, i, share), gap = roadGap(sub, x, y);
      if (gap >= EASE_ROAD_M || gap >= roadGap(sub, was[i][0], was[i][1])) pts[i] = [x, y];
    }
  }
}

/**
 * The barrier nearest a point, but one.
 * @param runs the barriers
 * @param skip the one left out
 * @param point the point
 * @returns the barrier and the foot on it, or null with none
 */
function nearestRun(runs: Barrier[], skip: Barrier, point: Point):
  { run: Barrier; foot: LineFoot } | null {
  let best: { run: Barrier; foot: LineFoot } | null = null;
  for (const run of runs) {
    if (run === skip || run.kind === 'line') continue;
    const foot = nearestOn(run.pts, point[0], point[1]);
    if (!best || foot.gap < best.foot.gap) best = { run, foot };
  }
  return best;
}

/**
 * One free end of a run carried on to the nearest run beside it: cut back first while it runs in
 * beside that run at a shallow angle (so the join meets it square and nothing doubles it), then
 * joined where the join keeps clear of the road and the lanes; the run met split there.
 * @param runs the barriers (changed)
 * @param run the run whose end it is (changed)
 * @param first its first end, else its last
 * @param keep the race road and the lanes a join keeps off
 * @param keep.sub the race road
 * @param keep.lanes the lanes
 */
function joinEnd(runs: Barrier[], run: Barrier, first: boolean,
  keep: { sub: Subtrack; lanes: Lane[] }): void {
  const end = first ? run.pts[0] : run.pts[run.pts.length - 1];
  const met = nearestRun(runs, run, end);
  if (!met || met.foot.gap < MEET_M || met.foot.gap > FREE_JOIN_M) return;
  const pts = first ? run.pts.slice().reverse() : run.pts.slice();
  const tip = () => pts[pts.length - 1];
  while (pts.length > 2 && nearestOn(met.run.pts, tip()[0], tip()[1]).gap < BESIDE_M) pts.pop();
  const foot = nearestOn(met.run.pts, tip()[0], tip()[1]);
  // (a foot this near the run's own end goes to that end: a joint, not a stub split off)
  for (const runEnd of [met.run.pts[0], met.run.pts[met.run.pts.length - 1]])
    if (Math.hypot(runEnd[0] - foot.spot[0], runEnd[1] - foot.spot[1]) < SPLIT_END_M)
      foot.spot = [runEnd[0], runEnd[1]];
  if (foot.gap > FREE_JOIN_M || !joinClear(tip(), foot.spot, keep.sub, keep.lanes, EASE_ROAD_M))
    return;
  pts.push(foot.spot);
  run.pts = first ? pts.reverse() : pts;
  splitAt(runs, met.run, foot);
}

/**
 * Each free end (meeting no other barrier and no portal corner) carried on to the nearest point
 * of the barrier beside it.
 * @param runs the barriers (changed)
 * @param sub the race road
 * @param lanes the lanes
 * @param corners the crossover portals' wall corners
 */
function joinFreeEnds(runs: Barrier[], sub: Subtrack, lanes: Lane[], corners: Point[]): void {
  const onCorner = ([x, y]: Point) => corners.some(([cornerX, cornerY]) =>
    Math.hypot(cornerX - x, cornerY - y) < MEET_M);
  for (const run of runs) {
    if (!EASED.has(run.kind)) continue;
    if (!onCorner(run.pts[0])) joinEnd(runs, run, true, { sub, lanes });
    if (!onCorner(run.pts[run.pts.length - 1])) joinEnd(runs, run, false, { sub, lanes });
  }
}

/**
 * A stadium's barriers made even (VenueSpec.evenEdge): every Armco run and catch fence eased, then
 * each free end carried on to the run beside it.
 * @param barriers the tidied barriers (changed in place)
 * @param sub the race road
 * @param lanes the lanes (a join keeps off them)
 * @param corners the crossover portals' wall corners
 * @returns the barriers
 */
export function evenStadiumEdge(barriers: Barrier[], sub: Subtrack, lanes: Lane[],
  corners: Point[]): Barrier[] {
  // (eased first: a join's end lies on the run as it stays)
  for (const run of barriers) if (EASED.has(run.kind)) easeRun(run.pts, sub, corners);
  joinFreeEnds(barriers, sub, lanes, corners);
  return barriers;
}

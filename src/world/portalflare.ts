// world/portalflare.ts - A STADIUM'S ARMCO MEETING A CROSSOVER PORTAL'S MOUTH (VenueSpec.evenEdge;
// owner 11-12 on The Bird's Mess: "Armco are close to the tunnel too and a bit messy still"). The
// tidy (world/venuetidy.ts tuckToPortals) carries each run's end on to the mouth's wall corner -
// so a car sliding along is led into the cut, never onto the wall's end - but in a hook: 3-5 m
// square across from the run to the corner (a 44-70 deg turn), the run between the lanes heading
// off at once toward the lens beside the crossover. Here the run's last stretch is laid along the
// road instead: from the corner it follows the road out of the mouth at the corner's own offset
// for FLARE_LEAD_M (in line with the wall), then eases out to the run's offset - a taper parallel
// to the road's own bend, as a real circuit's barrier meets a tunnel mouth.
import { centreBetween } from "./venuegeo.ts";
import { portalCorners } from "./venuecross.ts";
import { onGroundQuery, querySubtrack } from "./tyrewall.ts";
import type { Barrier, Point, Prop, Subtrack } from "./types.ts";

// m: the taper in line with the wall out of the mouth; where along the run it may end (from, to,
// step: the nearest it reaches at no more than FLARE_SLOPE across per metre along, else the
// gentlest up to FLARE_MAX_SLOPE); its points' spacing along the road
const FLARE_LEAD_M = 3, FLARE_FROM_M = 10, FLARE_TO_M = 40, FLARE_STEP_M = 2, FLARE_POINT_M = 1;
// across per metre along, the taper's slope and the run's turn off the road added: tan 17 deg; at
// most (a short run between the lanes heading off into the lens beside the crossover) tan 48 deg
const FLARE_SLOPE = 0.3, FLARE_MAX_SLOPE = 1.1;
// m: an end this near a mouth's corner is on it; a taper's points keep this far off the race
// road's centre on the ground (barriercheck's half road + 2 m)
const MOUTH_MEET_M = 0.5, FLARE_ROAD_M = 8.5;
// m: the window either side of the corner a point's foot on the road is looked for in (the path
// crosses itself: the road over the cut is not this one)
const FOOT_WINDOW_M = 60;

/** A portal mouth's wall corner: its foot on the road below, its offset and the way out, and the
 * same wall's corner at the lintel (the bridge's end of the wall). */
interface Mouth { corner: Point; lintel: Point; dist: number; offset: number; way: number }

/** A point's foot on the road: metres along it and the signed offset off its centre. */
interface RoadFoot { dist: number; offset: number }

/**
 * A point's foot on the road among the samples within FOOT_WINDOW_M of a distance along it.
 * @param sub the race road
 * @param point the point
 * @param around metres along the road
 * @returns the foot
 */
function footNear(sub: Subtrack, point: Point, around: number): RoadFoot {
  const total = sub.totalDist;
  let best = sub.pts[0], bestGap = Infinity;
  for (const sample of sub.pts) {
    const apart = Math.abs(((sample.dist - around + total * 1.5) % total) - total / 2);
    if (apart > FOOT_WINDOW_M) continue;
    const gap = Math.hypot(sample.x - point[0], sample.y - point[1]);
    if (gap < bestGap) [best, bestGap] = [sample, gap];
  }
  // (along the sample's heading - its left normal turned back a right angle - to the foot itself:
  // the nearest sample alone set a corner's foot a metre off, and the taper folded back by it)
  const dx = point[0] - best.x, dy = point[1] - best.y;
  return { dist: (best.dist + dx * best.ny - dy * best.nx + total) % total,
    offset: dx * best.nx + dy * best.ny };
}

/**
 * Each underpass portal's two mouth corners (portalCorners' first two) on the road below them.
 * @param sub the race road
 * @param portals the race road's underpass portals
 * @returns the mouths
 */
export function portalMouths(sub: Subtrack, portals: Prop[]): Mouth[] {
  return portals.flatMap((portal) => {
    const cosR = Math.cos(portal.rot || 0), sinR = Math.sin(portal.rot || 0);
    // (a point out of the mouth, on the ground: which way the road leaves it)
    const outX = portal.x - cosR * (portal.w! / 2 + FLARE_LEAD_M);
    const outY = portal.y - sinR * (portal.w! / 2 + FLARE_LEAD_M);
    const out = onGroundQuery(() => querySubtrack(sub, outX, outY)).trackDist;
    const corners = portalCorners(portal);
    return corners.slice(0, 2).map((corner, side): Mouth => {
      const foot = footNear(sub, corner, out), total = sub.totalDist;
      const ahead = ((out - foot.dist + total * 1.5) % total) - total / 2;
      return { corner, lintel: corners[side + 2], dist: foot.dist, offset: foot.offset,
        way: ahead >= 0 ? 1 : -1 };
    });
  });
}

/**
 * The point a distance back along a line from its last point, and the index it lies before.
 * @param pts the line (its last point the end)
 * @param back metres back
 * @returns the point and the index of the first point past it, or null when the line is shorter
 */
function pointBack(pts: Point[], back: number): { spot: Point; index: number } | null {
  let run = 0;
  for (let i = pts.length - 1; i > 0; i--) {
    const [toX, toY] = pts[i], [fromX, fromY] = pts[i - 1];
    const step = Math.hypot(toX - fromX, toY - fromY);
    if (run + step >= back) {
      const share = (back - run) / (step || 1);
      return { spot: [toX + (fromX - toX) * share, toY + (fromY - toY) * share], index: i };
    }
    run += step;
  }
  return null;
}

/**
 * A line's length.
 * @param pts the line
 * @returns metres
 */
const runLength = (pts: Point[]): number => pts.slice(1).reduce((sum, [x, y], i) =>
  sum + Math.hypot(x - pts[i][0], y - pts[i][1]), 0);

/** Where a taper ends on the run: the point, its index, its foot's metres out and offset. */
interface TaperEnd { spot: Point; index: number; along: number; offset: number }

/**
 * Where along the run its taper from a mouth ends: the nearest point (FLARE_FROM_M..FLARE_TO_M
 * back) the taper reaches at no more than FLARE_SLOPE, else the gentlest up to FLARE_MAX_SLOPE -
 * on the mouth's side of the road, out of the mouth.
 * @param pts the run, its end at the mouth last
 * @param mouth the mouth
 * @param sub the race road
 * @returns the end, or null with none fit
 */
function taperEnd(pts: Point[], mouth: Mouth, sub: Subtrack): TaperEnd | null {
  let best: TaperEnd | null = null, bestScore = FLARE_MAX_SLOPE;
  const total = sub.totalDist;
  // (and the run's own far end, a short run's: the lens's joint beside a crossover)
  const length = runLength(pts), backs: number[] = [];
  for (let back = FLARE_FROM_M; back <= Math.min(FLARE_TO_M, length); back += FLARE_STEP_M)
    backs.push(back);
  if (length < FLARE_TO_M) backs.push(length - 0.01);
  for (const back of backs) {
    const start = pointBack(pts, back);
    if (!start) break;
    const foot = footNear(sub, start.spot, mouth.dist);
    const along = (((foot.dist - mouth.dist) * mouth.way + total * 1.5) % total) - total / 2;
    if (along <= FLARE_LEAD_M + 2 || foot.offset * mouth.offset <= 0) continue;
    const slope = Math.abs(foot.offset - mouth.offset) / (along - FLARE_LEAD_M);
    // (and how far the run there turns off the road's line: the taper meets it along the road)
    const score = slope + runTurn(pts, start.index, sub, foot.dist);
    if (score > bestScore) continue;
    const end = { ...start, along, offset: foot.offset };
    if (score <= FLARE_SLOPE) return end;
    [best, bestScore] = [end, score];
  }
  return best;
}

/**
 * How far a run's heading at a point turns off the road's there (the tangent of the angle).
 * @param pts the run
 * @param index the point's segment end
 * @param sub the race road
 * @param dist the point's foot along the road
 * @returns the tangent (Infinity: square across)
 */
function runTurn(pts: Point[], index: number, sub: Subtrack, dist: number): number {
  const [fromX, fromY] = pts[index - 1], [toX, toY] = pts[index];
  const len = Math.hypot(toX - fromX, toY - fromY) || 1, centre = centreBetween(sub, dist);
  // (the road's heading: its normal turned a right angle)
  const along = Math.abs(((toX - fromX) * -centre.ny + (toY - fromY) * centre.nx) / len);
  const across = Math.abs(((toX - fromX) * centre.nx + (toY - fromY) * centre.ny) / len);
  return along > 1e-6 ? across / along : Infinity;
}

/**
 * A taper's points along the road from a mouth's corner out to where it meets the run (the
 * corner's offset for FLARE_LEAD_M, then eased to the run's), nearest the run first.
 * @param mouth the mouth
 * @param end where it meets the run
 * @param sub the race road
 * @returns the points, or null where one would come nearer the road than FLARE_ROAD_M
 */
function taperPoints(mouth: Mouth, end: TaperEnd, sub: Subtrack): Point[] | null {
  const pts: Point[] = [];
  for (let along = end.along - FLARE_POINT_M; along > 0; along -= FLARE_POINT_M) {
    const share = Math.max(0, (along - FLARE_LEAD_M) / (end.along - FLARE_LEAD_M));
    const eased = share * share * (3 - 2 * share);
    const offset = mouth.offset + (end.offset - mouth.offset) * eased;
    const centre = centreBetween(sub, mouth.dist + mouth.way * along);
    const point: Point = [centre.x + centre.nx * offset, centre.y + centre.ny * offset];
    if (onGroundQuery(() => querySubtrack(sub, point[0], point[1])).dist < FLARE_ROAD_M)
      return null;
    pts.push(point);
  }
  return [...pts, [mouth.corner[0], mouth.corner[1]]];
}

/**
 * Whether a point is within MOUTH_MEET_M of another.
 * @param one a point
 * @param two another
 * @returns true when it is
 */
const meets = (one: Point, two: Point): boolean =>
  Math.hypot(one[0] - two[0], one[1] - two[1]) < MOUTH_MEET_M;

/**
 * The mouth a run's end is laid to: the one whose corner it is on, or - where the tidy carried a
 * run round the wall to its lintel corner and no run ends on that wall's mouth corner (L.A.
 * Lively's south portal: the run hooked 45 deg in behind the wall, the wall's end left standing
 * 1.2 m nearer the road than the run) - that wall's mouth.
 * @param end the run's end
 * @param mouths the portals' mouths
 * @param runs every barrier (whose ends take a mouth corner)
 * @returns the mouth, or none
 */
function mouthFor(end: Point, mouths: Mouth[], runs: Barrier[]): Mouth | undefined {
  return mouths.find(({ corner }) => meets(corner, end))
    ?? mouths.find(({ corner, lintel }) => meets(lintel, end) && !runs.some(({ pts }) =>
      meets(pts[0], corner) || meets(pts[pts.length - 1], corner)));
}

/**
 * A run's ends on a portal's mouth corners laid as tapers along the road (none fits: as it was).
 * @param run the run (changed)
 * @param mouths the portals' mouths
 * @param sub the race road
 * @param runs every barrier (a lintel's end goes to its mouth only while no run ends there)
 */
export function flareToMouths(run: Barrier, mouths: Mouth[], sub: Subtrack, runs: Barrier[]): void {
  for (const first of [true, false]) {
    const pts = first ? run.pts.slice().reverse() : run.pts.slice();
    const mouth = mouthFor(pts[pts.length - 1], mouths, runs);
    const end = mouth && taperEnd(pts, mouth, sub);
    const taper = mouth && end && taperPoints(mouth, end, sub);
    if (!taper) continue;
    const laid = [...pts.slice(0, end!.index), end!.spot, ...taper];
    run.pts = first ? laid.reverse() : laid;
  }
}

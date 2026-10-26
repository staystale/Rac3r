// ARMCO DENTS (owner C9): the steel rail gives where a car hits it. Measured before
// (tools/scratch/_c9measure.mjs): armco was a concrete wall - it never moved, never gave and
// remembered nothing. Now an impact INTO the rail (its speed along the rail's normal) pushes the
// rail back there, a smooth bow DENT_HALF_M each side (points added every DENT_STEP_M so it curves,
// not kinks), deeper the harder the hit, up to DENT_MAX_M; a second hit on a dent deepens it. The
// rail is also a little softer than a wall (ARMCO_E, the bounce, and ARMCO_GIVE, the damage: owner
// "softer but only a bit").
// A hit that would push it past TEAR_DEPTH_M TEARS it open (owner: "very fast it can tear"): a gap
// the car goes on through, losing part of its speed. What is drawn is what is hit: the rail's
// points move, so the drawing (render/props/fence.ts) and the collision segments
// (world/barriers.ts prepBarriers) follow them. RESTART puts every rail back straight.
// Only the level's armco barriers: the arena's edge fence is left out (owner).
import type { Barrier, BarrierSeg, Point } from './types.ts';

// m/s into the rail below which it does not dent; m of dent per m/s above that (50 km/h square
// on ~0.4 m, 80 km/h ~0.77 m); the deepest a dent goes, m
const DENT_FROM = 3, DENT_PER_V = 0.04, DENT_MAX_M = 0.8;
// a hit that would take the rail this deep tears it (one square hit from ~115 km/h, or a second
// hard one on a deep dent)
const TEAR_DEPTH_M = 1.1;
// the dent's half width along the rail and the spacing of the points added there, m
const DENT_HALF_M = 3, DENT_STEP_M = 0.5;
// the gap a tear opens each side of the hit, m; the share of its speed into the rail a car
// loses going through
const TEAR_HALF_M = 2, TEAR_LOSS = 0.4;
// the rail's bounce (a wall's BARRIER_E is 0.3), and the share of a hit's damage the car still
// takes (the rail's give takes the rest; measured, the softer bounce alone took only ~3 % off)
export const ARMCO_E = 0.2;
const ARMCO_GIVE = 0.9;

/**
 * Whether a barrier dents (an armco rail).
 * @param barrier the barrier
 * @returns true when it dents
 */
export const dents = (barrier: Barrier): boolean => barrier.kind === 'armco';

/**
 * The scale on a hit's damage for what was hit: an armco rail gives a little (damage.ts hit).
 * @param kind what the car hit this step (physics/punctures.ts noteHit), or null
 * @returns the scale
 */
export const railGive = (kind: string | null | undefined): number =>
  (kind === 'armco' ? ARMCO_GIVE : 1);

// how far each moved rail point has been pushed back, m; the points a torn gap starts at; the
// rails as they were before their first dent (RESTART)
let depthOf = new WeakMap<Point, number>();
let tornAfter = new WeakSet<Point>();
const straight = new Map<Barrier, Point[]>();

/** The hardest hit on the rail in this step, waiting to dent it. */
interface RailHit { seg: BarrierSeg; frac: number; into: number; nx: number; ny: number }
let pending: RailHit | null = null;
// a rail torn this step (its segments need building again)
let tornNow = false;

/**
 * Whether the rail is torn open on the stretch from this point to the next.
 * @param point a rail point
 * @returns true when torn
 */
export const isTornAfter = (point: Point): boolean => tornAfter.has(point);

/**
 * How far the rail is already pushed back at a spot.
 * @param barrier the rail
 * @param seg the segment
 * @param frac 0..1 along it
 * @returns m
 */
function depthAt(barrier: Barrier, seg: BarrierSeg, frac: number): number {
  const fromDepth = depthOf.get(barrier.pts[seg.i0!]) || 0;
  const toDepth = depthOf.get(barrier.pts[seg.i0! + 1]) || 0;
  return fromDepth + (toDepth - fromDepth) * frac;
}

/**
 * The arc length along a rail at each of its points, m.
 * @param pts the rail's points
 * @returns one per point
 */
function arcLengths(pts: Point[]): number[] {
  const lengths = [0];
  for (let i = 1; i < pts.length; i++) {
    lengths.push(lengths[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  return lengths;
}

/**
 * Keeps a copy of the rail as it was before its first dent (RESTART puts it back).
 * @param barrier the rail
 */
function keepStraight(barrier: Barrier): void {
  if (!straight.has(barrier)) straight.set(barrier, barrier.pts.map(([x, y]): Point => [x, y]));
}

/**
 * A car corner in the rail. A hard enough hit into it is kept for the dent (applyRailHit, after
 * the rail's clamp); one that would push it past TEAR_DEPTH_M tears it open.
 * @param barrier the rail
 * @param seg the segment touched
 * @param frac 0..1 along it
 * @param nx the normal toward the car, unit x
 * @param ny unit y
 * @param car the car's velocity, m/s (changed when it tears through)
 * @param car.vx velocity x
 * @param car.vy velocity y
 * @returns true when it tore (the car goes on through: no bounce)
 */
export function railContact(barrier: Barrier, seg: BarrierSeg, frac: number, nx: number, ny: number,
    car: { vx: number; vy: number }): boolean {
  const into = -(car.vx * nx + car.vy * ny);
  if (!(into > DENT_FROM)) return false;
  if (depthAt(barrier, seg, frac) + DENT_PER_V * (into - DENT_FROM) >= TEAR_DEPTH_M) {
    tear(barrier, seg, frac);
    car.vx += nx * into * TEAR_LOSS;
    car.vy += ny * into * TEAR_LOSS;
    return true;
  }
  if (!pending || into > pending.into) pending = { seg, frac, into, nx, ny };
  return false;
}

/**
 * The rail's points with more every DENT_STEP_M within half of a spot (a new point takes its
 * neighbours' depth and gap), so a dent bows and a tear is the size it should be.
 * @param old the rail's points
 * @param oldLengths their arc lengths
 * @param hitAt the spot, m along the rail
 * @param half how far each side, m
 * @returns the new points (the old ones kept, in order)
 */
function finePoints(old: Point[], oldLengths: number[], hitAt: number, half: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < old.length; i++) {
    pts.push(old[i]);
    if (i === old.length - 1) continue;
    const segLen = oldLengths[i + 1] - oldLengths[i];
    if (oldLengths[i + 1] < hitAt - half || oldLengths[i] > hitAt + half
        || segLen < DENT_STEP_M * 1.5) continue;
    const count = Math.floor(segLen / DENT_STEP_M);
    const fromDepth = depthOf.get(old[i]) || 0, toDepth = depthOf.get(old[i + 1]) || 0;
    for (let step = 1; step < count; step++) {
      const frac = step / count;
      const point: Point = [old[i][0] + (old[i + 1][0] - old[i][0]) * frac,
        old[i][1] + (old[i + 1][1] - old[i][1]) * frac];
      depthOf.set(point, fromDepth + (toDepth - fromDepth) * frac);
      if (tornAfter.has(old[i])) tornAfter.add(point);
      pts.push(point);
    }
  }
  return pts;
}

/**
 * Opens a gap in the rail round a spot: the stretches within TEAR_HALF_M are no longer there.
 * @param barrier the rail
 * @param seg the segment hit
 * @param frac 0..1 along it
 */
function tear(barrier: Barrier, seg: BarrierSeg, frac: number): void {
  keepStraight(barrier);
  const old = barrier.pts, oldLengths = arcLengths(old), start = seg.i0!;
  const hitAt = oldLengths[start] + (oldLengths[start + 1] - oldLengths[start]) * frac;
  // the segments this step still clamps against across the gap are not solid from now (the
  // car's other corners)
  for (const other of barrier._segs || []) {
    if (oldLengths[other.i0! + 1] > hitAt - TEAR_HALF_M
        && oldLengths[other.i0!] < hitAt + TEAR_HALF_M) other.torn = true;
  }
  const pts = finePoints(old, oldLengths, hitAt, TEAR_HALF_M), lengths = arcLengths(pts);
  for (let i = 0; i < pts.length - 1; i++) {
    if (Math.abs((lengths[i] + lengths[i + 1]) / 2 - hitAt) < TEAR_HALF_M) tornAfter.add(pts[i]);
  }
  barrier.pts = pts;
  pending = null;
  tornNow = true;
}

/**
 * Dents the rail with this step's hardest hit, if any (after its clamp).
 * @param barrier the rail
 * @returns true when it changed - dented or torn (its segments need building again)
 */
export function applyRailHit(barrier: Barrier): boolean {
  const hit = pending, torn = tornNow;
  pending = null;
  tornNow = false;
  if (!hit) return torn;
  keepStraight(barrier);
  const old = barrier.pts, oldLengths = arcLengths(old), start = hit.seg.i0!;
  const hitAt = oldLengths[start] + (oldLengths[start + 1] - oldLengths[start]) * hit.frac;
  const pts = finePoints(old, oldLengths, hitAt, DENT_HALF_M);
  // push them back: a cos^2 bow, deepest at the hit, each point no deeper than DENT_MAX_M
  const lengths = arcLengths(pts), deepest = DENT_PER_V * (hit.into - DENT_FROM);
  for (let i = 0; i < pts.length; i++) {
    const off = Math.abs(lengths[i] - hitAt);
    if (off >= DENT_HALF_M) continue;
    const before = depthOf.get(pts[i]) || 0;
    const add = Math.min(deepest * Math.cos((Math.PI / 2) * (off / DENT_HALF_M)) ** 2,
      DENT_MAX_M - before);
    if (add <= 0) continue;
    pts[i][0] -= hit.nx * add;
    pts[i][1] -= hit.ny * add;
    depthOf.set(pts[i], before + add);
  }
  barrier.pts = pts;
  return true;
}

/**
 * Puts every dented or torn rail back straight (RESTART).
 * @returns the rails put back (their segments need building again)
 */
export function straightenRails(): Barrier[] {
  const rails = [...straight.keys()];
  for (const [barrier, pts] of straight) barrier.pts = pts.map(([x, y]): Point => [x, y]);
  straight.clear();
  depthOf = new WeakMap();
  tornAfter = new WeakSet();
  pending = null;
  tornNow = false;
  return rails;
}

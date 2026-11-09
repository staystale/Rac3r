// ARMCO DENTS (owner C9): the steel rail gives where a car hits it. Measured before
// (tools/scratch/_c9measure.mjs): armco was a concrete wall - it never moved, never gave and
// remembered nothing. Now an impact INTO the rail (its speed along the rail's normal) pushes the
// rail back there, a smooth bow DENT_HALF_M each side (points added every DENT_STEP_M so it curves,
// not kinks), deeper the harder the hit, up to its deepest (RAIL_FEEL); a second hit on a dent
// deepens it. The
// rail is also a little softer than a wall (RAIL_FEEL: the bounce and the give: owner
// "softer but only a bit").
// A hit that would push it past its tear depth TEARS it open (owner: "very fast it can tear"): a
// gap the car goes on through, losing part of its speed. What is drawn is what is hit: the rail's
// points move, so the drawing (render/props/fence.ts) and the collision segments
// (world/barriers.ts prepBarriers) follow them. RESTART puts every rail back straight.
// Only the level's armco barriers: the arena's edge fence is left out (owner).
import type { Barrier, BarrierSeg, Point } from './types.ts';

/** How a rail gives: when it dents, how deep, when it tears, its bounce, how much of a hit's
 * damage the car still takes, the share of the car's speed along it kept a contact step (its
 * grab), and the share of its speed into it a car tearing through loses at once. */
interface RailFeel { from: number; perV: number; max: number; tear: number; bounce: number;
  give: number; scrape: number; tearLoss: number }
// THE ARMCO: m/s into the rail below which it does not dent (from); m of dent per m/s above that
// (perV: 50 km/h square on ~0.4 m, 80 km/h ~0.77 m); the deepest a dent goes (max, m); a hit that
// would take it this deep tears it (tear: one square hit from ~115 km/h, or a second hard one on
// a deep dent); its bounce (a wall's BARRIER_E is 0.3) and the share of a hit's damage the car
// still takes (give: measured, the softer bounce alone took only ~3 % off).
// THE CATCH FENCE (owner 11-07: weaker than the Armco, as real ones are; 11-08: "slightly weaker
// and shred to bits when hit", then "still too strong ... catch n drag"): mesh on posts - it gives
// from 1 m/s and deeper, tears from ~40 km/h square, barely bounces, takes most of the hit off
// the car, GRABS a car sliding along it (keeps 0.6 of its speed along a contact step, the Armco
// 0.85), and a tear SHREDS it (the torn stretch flies off as scraps of mesh and bent posts: loose
// objects, world/debris.ts) and TANGLES the car: less speed lost at once, then the mesh drags it
// (TANGLE_*) as it tears loose.
const RAIL_FEEL: Record<string, RailFeel> = {
  armco: { from: 3, perV: 0.04, max: 0.8, tear: 1.1, bounce: 0.2, give: 0.9, scrape: 0.85,
    tearLoss: 0.4 },
  catchfence: { from: 1, perV: 0.1, max: 0.95, tear: 1, bounce: 0.05, give: 0.3, scrape: 0.6,
    tearLoss: 0.2 },
  // THE WOODEN FENCE (a central reservation's, highway/medians.ts; owner 11-09: "Wooden Fences
  // should be weaker and emit Broken bits of wood when broke"): posts and rails - it barely
  // gives, breaks from ~20 km/h square (MEASURED, tools/scratch/_woodfencecheck.mjs), its broken
  // stretch flies off as rails, posts and bits of wood
  woodfence: { from: 0.8, perV: 0.12, max: 0.4, tear: 0.35, bounce: 0.05, give: 0.25,
    scrape: 0.6, tearLoss: 0.12 },
};
// what a torn rail's stretch flies off as: each piece and how many
const SHREDS: Record<string, [string, number][]> = {
  catchfence: [['mesh', 6], ['fencepost', 2]],
  woodfence: [['woodrail', 2], ['woodpost', 2], ['woodchip', 8]] };
// a car torn through a catch fence is dragged by the mesh this long, s, slowing it this hard at
// first, m/s^2, easing off as it tears loose
const TANGLE_S = 1, TANGLE_DECEL = 6;
// a torn catch fence's shreds: scraps of mesh and posts a gap throws, the share of the car's speed
// into it they fly off with (least, most), their spread along the fence, m/s
const SHRED_SPEED: [number, number] = [0.35, 0.8],
  SHRED_SPREAD = 2.5;
/** The loose-object kinds a torn catch fence throws (cones/coneConsts.ts DEBRIS has each). */
export const SHRED_KINDS = ['mesh', 'fencepost', 'woodrail', 'woodpost', 'woodchip'];

/** One shred of a torn fence on its way to the loose objects (world/debris.ts throwParts). */
export interface FenceShred { kind: string; x: number; y: number; vx: number; vy: number;
  ang: number; spin: number }
// the shreds torn fences threw since the game last took them
const shreds: FenceShred[] = [];

/**
 * The shreds torn catch fences have thrown since the last call (the game adds them to its loose
 * objects).
 * @returns the shreds
 */
export function takeFenceShreds(): FenceShred[] {
  return shreds.splice(0, shreds.length);
}

/**
 * A torn catch fence's stretch flies off as shreds: scraps of mesh and posts along the gap,
 * thrown on the way the car went through.
 * @param from the gap's start, world m
 * @param till the gap's end
 * @param nx the normal toward the car, unit x
 * @param ny unit y
 * @param into the car's speed into the fence, m/s
 * @param pieces what it flies off as (SHREDS: the catch fence's mesh and posts)
 */
function shredFence(from: Point, till: Point, nx: number, ny: number, into: number,
  pieces: [string, number][] = SHREDS.catchfence): void {
  const alongX = till[0] - from[0], alongY = till[1] - from[1];
  const len = Math.hypot(alongX, alongY) || 1;
  const kinds = pieces.flatMap(([kind, count]) => Array<string>(count).fill(kind));
  for (const kind of kinds) {
    const share = Math.random(), push = into * (SHRED_SPEED[0]
      + Math.random() * (SHRED_SPEED[1] - SHRED_SPEED[0]));
    const spread = (Math.random() * 2 - 1) * SHRED_SPREAD;
    shreds.push({ kind,
      x: from[0] + alongX * share, y: from[1] + alongY * share,
      vx: -nx * push + (alongX / len) * spread, vy: -ny * push + (alongY / len) * spread,
      ang: Math.atan2(alongY, alongX) + (Math.random() - 0.5), spin: (Math.random() - 0.5) * 10 });
  }
}
// the dent's half width along the rail and the spacing of the points added there, m
const DENT_HALF_M = 3, DENT_STEP_M = 0.5;
// the gap a tear opens each side of the hit, m
const TEAR_HALF_M = 2;

/**
 * Whether a barrier dents (an armco rail).
 * @param barrier the barrier
 * @returns true when it dents
 */
export const dents = (barrier: Barrier): boolean => barrier.kind in RAIL_FEEL;

/**
 * A rail's bounce (world/barriers.ts).
 * @param barrier the rail
 * @returns the restitution
 */
export const railBounce = (barrier: Barrier): number => RAIL_FEEL[barrier.kind].bounce;

/**
 * A rail's grab on a car sliding along it (world/barriers.ts): the share of its speed along it
 * kept a contact step.
 * @param barrier the rail
 * @returns the share
 */
export const railScrape = (barrier: Barrier): number => RAIL_FEEL[barrier.kind].scrape;

/**
 * A car tangled in a torn catch fence is dragged by the mesh (world/crossings.ts clampWorld, each
 * step): slowed along its way, less as it tears loose.
 * @param car the car (its tangle, s left)
 * @param car.vx velocity x, m/s
 * @param car.vy velocity y, m/s
 * @param car.tangleT s of drag left (set by a tear)
 * @param dt the step, s
 */
export function dragTangled(car: { vx: number; vy: number; tangleT?: number }, dt: number): void {
  if (!car.tangleT || car.tangleT <= 0) return;
  const speed = Math.hypot(car.vx, car.vy);
  const slow = Math.min(speed, TANGLE_DECEL * (car.tangleT / TANGLE_S) * dt);
  if (speed > 0) {
    car.vx -= (car.vx / speed) * slow;
    car.vy -= (car.vy / speed) * slow;
  }
  car.tangleT = Math.max(0, car.tangleT - dt);
}

/**
 * The scale on a hit's damage for what was hit: an armco rail gives a little (damage.ts hit).
 * @param kind what the car hit this step (physics/punctures.ts noteHit), or null
 * @returns the scale
 */
export const railGive = (kind: string | null | undefined): number =>
  (kind && kind in RAIL_FEEL ? RAIL_FEEL[kind].give : 1);

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
 * the rail's clamp); one that would push it past its tear depth tears it open.
 * @param barrier the rail
 * @param seg the segment touched
 * @param frac 0..1 along it
 * @param nx the normal toward the car, unit x
 * @param ny unit y
 * @param car the car's velocity, m/s (changed when it tears through)
 * @param car.vx velocity x
 * @param car.vy velocity y
 * @param car.tangleT s a torn catch fence drags it (set when it tears one)
 * @returns true when it tore (the car goes on through: no bounce)
 */
export function railContact(barrier: Barrier, seg: BarrierSeg, frac: number, nx: number, ny: number,
    car: { vx: number; vy: number; tangleT?: number }): boolean {
  const into = -(car.vx * nx + car.vy * ny), feel = RAIL_FEEL[barrier.kind];
  if (!(into > feel.from)) return false;
  if (depthAt(barrier, seg, frac) + feel.perV * (into - feel.from) >= feel.tear) {
    const mesh = barrier.kind === 'catchfence';
    tear(barrier, seg, frac, SHREDS[barrier.kind] ? { nx, ny, into } : null);
    car.vx += nx * into * feel.tearLoss;
    car.vy += ny * into * feel.tearLoss;
    if (mesh) car.tangleT = TANGLE_S;
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
 * Opens a gap in the rail round a spot: the stretches within TEAR_HALF_M are no longer there (a
 * catch fence's fly off as shreds).
 * @param barrier the rail
 * @param seg the segment hit
 * @param frac 0..1 along it
 * @param shred the way the car went through, for a catch fence's shreds (null: none)
 * @param shred.nx the normal toward the car, unit x
 * @param shred.ny unit y
 * @param shred.into the car's speed into it, m/s
 */
function tear(barrier: Barrier, seg: BarrierSeg, frac: number,
  shred: { nx: number; ny: number; into: number } | null): void {
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
  const gap: Point[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    if (Math.abs((lengths[i] + lengths[i + 1]) / 2 - hitAt) >= TEAR_HALF_M) continue;
    tornAfter.add(pts[i]);
    gap.push(pts[i], pts[i + 1]);
  }
  if (shred && gap.length) shredFence(gap[0], gap[gap.length - 1], shred.nx, shred.ny,
    shred.into, SHREDS[barrier.kind]);
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
  const pts = finePoints(old, oldLengths, hitAt, DENT_HALF_M), feel = RAIL_FEEL[barrier.kind];
  // push them back: a cos^2 bow, deepest at the hit, each point no deeper than feel.max
  const lengths = arcLengths(pts), deepest = feel.perV * (hit.into - feel.from);
  for (let i = 0; i < pts.length; i++) {
    const off = Math.abs(lengths[i] - hitAt);
    if (off >= DENT_HALF_M) continue;
    const before = depthOf.get(pts[i]) || 0;
    const add = Math.min(deepest * Math.cos((Math.PI / 2) * (off / DENT_HALF_M)) ** 2,
      feel.max - before);
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
  shreds.length = 0;
  return rails;
}

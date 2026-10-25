// WHERE BUSHES GROW (?bushes=1; owner D): each level that has a plan (Level.bushes, data in its
// level file or its stage theme) gets clumps of bushes - one to three overlapping SQUARES of the
// 'bush' surface (the trees' pixel style), as ground patches (load.ts adds them after the blend
// and inclusions, so they draw on top and the lookup grid finds them). Two kinds of spot:
//   ROADSIDE - every `every` m of road on each side, taken by chance, a clump `band` m beyond the
//     road's edge: close on rally stages (the bush you clip cutting a corner), well back on
//     circuits (behind the verges, by the woods).
//   UNDER TREES - `treeShare` of the level's trees get a clump at their foot (a wood's edge).
// Every bush keeps `clear` m off the road's edge and stays off lanes, water, solids, barriers,
// props and loose objects, on grass / long grass / dirt only. Own random stream (seeded by the
// level id), so nothing else about a level moves.
import { seededRng } from './blend.ts';
import { smoothOnTrack } from './barriers.ts';
import { FX0, FX1, FY0, FY1 } from './bounds.ts';
import { staticCoverHere } from './coverlookup.ts';
import { SURFACES } from './surfaces.ts';
import { querySubtrack } from './tyrewall.ts';
import { groundSurfaceAt } from './wear.ts';
import { laneAt } from './zones.ts';
import type { BushPlan, Level, Patch, Point, Subtrack } from './types.ts';

// the grounds a bush grows on
const GROWS_ON = new Set(['grass', 'grassShort', 'grassLong', 'dirt']);
// a clump's main bush, m across (its side)
const MAIN_MIN = 1.8, MAIN_MAX = 3.2;
// m between clump centres at least
const CLUMP_GAP = 6;
// m a bush keeps from a floor edge, a barrier, a prop or a loose object (beyond its own reach)
const EDGE_CLEAR = 8, THING_CLEAR = 1.2;
// m a bush's centre keeps from a tree's trunk (it may sit under the canopy)
const TRUNK_CLEAR = 1.4;
// the kinds of bush (render/ground/art.ts addBushLooks)
const BUSH_LOOKS = ['bush', 'bushOlive', 'bushTeal'];
// the most bushes a level gets (each is a patch: drawn and looked up through the patch grid)
const MAX_BUSHES = 260;

/** What a candidate bush is checked against: the level and the clumps placed so far. */
interface PlanCtx {
  level: Level;
  sub: Subtrack | undefined;
  plan: BushPlan;
  rnd: () => number;
  out: Patch[];
  clumps: Point[];
}

/**
 * The distance from a point to a segment.
 * @returns the distance, m
 */
function segmentDistance(x: number, y: number, from: Point, end: Point): number {
  const dx = end[0] - from[0], dy = end[1] - from[1], lenSq = dx * dx + dy * dy || 1e-6;
  const along = Math.max(0, Math.min(1, ((x - from[0]) * dx + (y - from[1]) * dy) / lenSq));
  return Math.hypot(x - from[0] - along * dx, y - from[1] - along * dy);
}

/**
 * Whether the ground round a point is somewhere a bush grows: grass / long grass / dirt at its
 * centre and four rim points, off every lane and any lying water.
 * @returns true when it may grow
 */
function isGrowingGround(x: number, y: number, reach: number): boolean {
  for (const [offX, offY] of [[0, 0], [reach, 0], [-reach, 0], [0, reach], [0, -reach]]) {
    const atX = x + offX, atY = y + offY;
    if (!GROWS_ON.has(groundSurfaceAt(atX, atY).id)) return false;
    if (laneAt(atX, atY) || staticCoverHere(atX, atY)) return false;
  }
  return true;
}

/**
 * Whether a bush of this reach at this point touches a solid (a tree only by its trunk) or a
 * prop.
 * @returns true when one is in the way
 */
function touchesSolids(level: Level, x: number, y: number, reach: number): boolean {
  for (const solid of level.solids || []) {
    const need = solid.kind === 'tree' ? TRUNK_CLEAR
      : (solid.r || Math.max(solid.w, solid.h) / 2) + reach + THING_CLEAR;
    if (Math.hypot(x - solid.x, y - solid.y) < need) return true;
  }
  for (const prop of level.props || []) {
    if (prop.kind === 'tree') continue;
    const size = Math.max(prop.w || 0, prop.h || 0, prop.size || 0, prop.wid || 0, prop.s || 0, 2);
    if (Math.hypot(x - prop.x, y - prop.y) < size / 2 + reach + THING_CLEAR) return true;
  }
  return false;
}

/**
 * Whether a bush of this reach at this point touches a loose object or a barrier.
 * @returns true when one is in the way
 */
function touchesLoose(level: Level, x: number, y: number, reach: number): boolean {
  for (const cone of level.cones || [])
    if (Math.hypot(x - cone.x, y - cone.y) < reach + THING_CLEAR) return true;
  for (const barrier of level.barriers || []) {
    const pts = barrier.pts;
    for (let i = 0; i + 1 < pts.length; i++)
      if (segmentDistance(x, y, pts[i], pts[i + 1]) < reach + THING_CLEAR) return true;
  }
  return false;
}

/**
 * Whether a bush may stand here: inside the floor, clear of the road's edge, on growing ground,
 * touching nothing.
 * @returns true when it fits
 */
function bushFits(ctx: PlanCtx, x: number, y: number, reach: number): boolean {
  if (x - reach < FX0 + EDGE_CLEAR || x + reach > FX1 - EDGE_CLEAR
    || y - reach < FY0 + EDGE_CLEAR || y + reach > FY1 - EDGE_CLEAR) return false;
  const sub = ctx.sub;
  if (sub && querySubtrack(sub, x, y).dist < sub.width / 2 + ctx.plan.clear + reach) return false;
  return isGrowingGround(x, y, reach) && !touchesSolids(ctx.level, x, y, reach)
    && !touchesLoose(ctx.level, x, y, reach);
}

/**
 * Grows one clump at a spot: a main bush and up to two smaller ones overlapping it, each kept
 * only where it fits.
 * @returns how many bushes it added
 */
function growClump(ctx: PlanCtx, x: number, y: number): number {
  if (ctx.clumps.some(([clumpX, clumpY]) => Math.hypot(x - clumpX, y - clumpY) < CLUMP_GAP))
    return 0;
  const { rnd } = ctx;
  const main = MAIN_MIN + rnd() * (MAIN_MAX - MAIN_MIN);
  const parts = 1 + Math.floor(rnd() * 3);
  // one kind of bush a clump (render/ground/art.ts addBushLooks)
  const art = BUSH_LOOKS[Math.floor(rnd() * BUSH_LOOKS.length)];
  let added = 0;
  for (let part = 0; part < parts && ctx.out.length < MAX_BUSHES; part++) {
    const side = part === 0 ? main : main * (0.5 + rnd() * 0.3);
    const ang = rnd() * Math.PI * 2, away = part === 0 ? 0 : main * (0.35 + rnd() * 0.25);
    const bushX = x + Math.cos(ang) * away, bushY = y + Math.sin(ang) * away;
    // a square reaches its corners: half its diagonal
    if (!bushFits(ctx, bushX, bushY, side * Math.SQRT1_2)) continue;
    ctx.out.push({ x: bushX, y: bushY, w: side, h: side, sq: true, surface: SURFACES.bush,
      bush: true, art });
    added++;
  }
  if (added) ctx.clumps.push([x, y]);
  return added;
}

/**
 * The roadside spots: one every `every` m (+-40 %) on each side, each taken by chance.
 * @param spots receives the spots
 */
function roadsideSpots(ctx: PlanCtx, spots: Point[]): void {
  const { sub, plan, rnd } = ctx;
  if (!sub || !(plan.every > 0)) return;
  const halfWidth = sub.width / 2;
  for (const side of [-1, 1]) {
    for (let dist = rnd() * plan.every; dist < sub.totalDist;
      dist += plan.every * (0.6 + rnd() * 0.8)) {
      if (rnd() < 0.4) continue;
      const off = halfWidth + plan.band[0] + rnd() * (plan.band[1] - plan.band[0]);
      const point = smoothOnTrack(sub, dist, side * off);
      spots.push([point.x, point.y]);
    }
  }
}

/**
 * The spots at the foot of trees: `treeShare` of them, 2-4 m out from the trunk.
 * @param spots receives the spots
 */
function treeSpots(ctx: PlanCtx, spots: Point[]): void {
  const { level, plan, rnd } = ctx;
  for (const prop of level.props || []) {
    if (prop.kind !== 'tree' || rnd() >= plan.treeShare) continue;
    const ang = rnd() * Math.PI * 2, away = 2 + rnd() * 2;
    spots.push([prop.x + Math.cos(ang) * away, prop.y + Math.sin(ang) * away]);
  }
}

/**
 * The bushes of a level by its plan (none without a plan or a road).
 * @param level the level being prepared (its patch grid already indexed: the ground is read)
 * @returns the bush patches
 */
export function planBushes(level: Level): Patch[] {
  const plan = level.bushes, sub = level.subtrack;
  if (!plan || level.endless) return [];
  const ctx: PlanCtx = { level, sub, plan, rnd: seededRng(level.id + ':bush'), out: [],
    clumps: [] };
  const spots: Point[] = [...(plan.beds || [])];
  roadsideSpots(ctx, spots);
  treeSpots(ctx, spots);
  // shuffled, so a level with more spots than MAX_BUSHES thins evenly along its whole length
  for (let i = spots.length - 1; i > 0; i--) {
    const pick = Math.floor(ctx.rnd() * (i + 1));
    [spots[i], spots[pick]] = [spots[pick], spots[i]];
  }
  for (const [x, y] of spots) {
    if (ctx.out.length >= MAX_BUSHES) break;
    growClump(ctx, x, y);
  }
  return ctx.out;
}

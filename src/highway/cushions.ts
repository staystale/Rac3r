// highway/cushions.ts - THE HIGHWAYS' CRASH-CUSHION BARRELS (?hwbarrels=1, FIX.hwbarrels; TODO 3a2
// item 13; the owner 11-15: "placed just before the tips of the arm coat or the ends of the arm
// coat to protect like crashes coming onto them, like in real life ... in little triangle
// formations or in like threes in front of it"). Water-filled barrels as real impact attenuators
// stand: ONLY in front of an EXPOSED barrier END that traffic drives at -
//  - the NOSE of the barrier between the road and a slip that leaves it: the first point where
//    the left barrier (the walled road's wall, Armco) starts again after the gap a leaving slip
//    opened (a junction's off-slip, a slip through the wall); a slip with no barrier beside it
//    has no nose, so no barrels;
//  - the ENDS of the central reservation's Jersey barrier / Armco where the reservation opens: its
//    start for our way's traffic, its end for the other carriageway's.
// Never along a barrier's side, never where two pieces of one barrier join. A TRIANGLE pointing at
// the traffic: one barrel, then two, then three nearest the end, rows 0.9 m apart, centred on the
// end, the back row just clear of it; a row that would stand on a lane loses barrels (1-2-2,
// 1-2-1 ...), down to none. Blue on the countryside, yellow on Deaf Valley. Loose objects
// (cones/coneCushion.ts: a hit leaks or pops one, spraying water); laid with the stretch, so they
// are back the next time it is built. No random stream is read: the switch adds the barrels and
// moves nothing else.
import { COL } from '../world/colours.ts';
import { FIX } from '../core/fixes.ts';
import { roadPose } from './road.ts';
import type { BarrierKind } from '../world/types.ts';
import type { DressCtx, HwLevel } from './hwtypes.ts';
import type { LevelObj } from '../cones/coneTypes.ts';

/** Barrels a row, the front (facing the traffic) first: the triangle. */
export const CUSHION_ROWS = [1, 2, 3];
// m centre to centre across a row (a barrel is 0.9 m across: cones/coneConsts.ts DEBRIS.cushion)
// and between rows (the owner's foreman: "rows ~0.9 m apart")
const ACROSS_M = 0.95, ALONG_M = 0.9;
// m: a barrel's radius
const BARREL_R = 0.45;
// m between the back row's barrels and the barrier's end ("just clear of the steel")
const END_CLEAR_M = 0.15;
// m a barrel keeps off the tarmac's edge (a carriageway, a slip, a junction's roads): the
// reservation's 3 m holds a row of three (2.8 m) with this either side
const LANE_CLEAR_M = 0.05;
// m along the road after a slip leaves within which the left barrier starting again is its nose
// (a slip through the walled road's wall: 128 m; a junction's off-slip: 64 m)
const NOSE_REACH_M = 200;
// the reservation's barriers that end in a hard nose (a fence's end needs no cushion)
const RIGID = new Set<string>(['jersey', 'armco']);
// m past a barrel's edge the roadside litter is cleared (a litter object's own reach, ~0.5)
const LITTER_CLEAR_M = 0.5;

/**
 * Distance from a point to a polyline.
 * @param pts the line
 * @param x m
 * @param y m
 * @returns m
 */
function toLine(pts: [number, number][], x: number, y: number) {
  let best = Infinity;
  for (let seg = 1; seg < pts.length; seg++) {
    const [fromX, fromY] = pts[seg - 1], dx = pts[seg][0] - fromX, dy = pts[seg][1] - fromY;
    const share = Math.max(0, Math.min(1, ((x - fromX) * dx + (y - fromY) * dy)
      / (dx * dx + dy * dy || 1e-9)));
    best = Math.min(best, Math.hypot(fromX + dx * share - x, fromY + dy * share - y));
  }
  return best;
}

/**
 * Whether a barrel at an offset from the road's centre line stands clear of the carriageways'
 * tarmac (their hard shoulders and edge strips too) and of every lane laid beside the road.
 * @param level the highway level
 * @param off its offset, m (+ = the driver's right)
 * @param x its world x, m
 * @param y its world y, m
 * @returns true when clear
 */
function isClearOfLanes(level: HwLevel, off: number, x: number, y: number) {
  const geo = level._hw.geo, reach = BARREL_R + LANE_CLEAR_M;
  if (off + reach > -geo.hw && off - reach < geo.ownR) return false;
  if (geo.median != null && off + reach > geo.oppL && off - reach < geo.hw) return false;
  return level.lanes.every((lane) => toLine(lane.pts, x, y) >= lane.width / 2 + reach);
}

/**
 * A triangle of barrels in front of a barrier's end: its back row END_CLEAR_M from the end, each
 * row ALONG_M further toward the traffic, centred on the end; a row loses barrels where one would
 * stand on a lane.
 * @param level the highway level
 * @param endS the end's road distance, m
 * @param centre the end's offset from the road's centre line, m
 * @param away -1: the traffic comes from behind (lower s), +1: from ahead
 * @param out receives the barrels
 */
function layTriangle(level: HwLevel, endS: number, centre: number, away: number,
  out: LevelObj[]) {
  const paint = level._cfg.theme === 'canyon' ? COL.cushionYellow : COL.cushionBlue;
  for (let back = 0; back < CUSHION_ROWS.length; back++) {
    const dist = endS + away * (END_CLEAR_M + BARREL_R + back * ALONG_M);
    for (let across = CUSHION_ROWS[CUSHION_ROWS.length - 1 - back]; across >= 1; across--) {
      const row: LevelObj[] = [];
      for (let slot = 0; slot < across; slot++) {
        const off = centre + (slot - (across - 1) / 2) * ACROSS_M;
        const pose = roadPose(level, dist, off);
        if (!isClearOfLanes(level, off, pose.x, pose.y)) break;
        row.push({ kind: 'cushion', x: pose.x, y: pose.y, rot: pose.h, paint, _s: dist });
      }
      if (row.length === across) {
        out.push(...row);
        break;
      }
    }
  }
}

/**
 * Notes a slip leaving the left edge (a slip, a junction's off-slip): the left barrier's next
 * start within NOSE_REACH_M is its nose (noteLeftBarrier).
 * @param level the highway level
 * @param dist the road distance it leaves at, m
 */
export function noteSlipLeaving(level: HwLevel, dist: number) {
  (level._hw.noseDue ||= []).push(dist);
}

/** Whether road point j is in a gap of the left verge (not where the side road swings out). */
const isGapAt = (ctx: DressCtx, j: number) => j >= 0 && !!ctx.road[j].gapL && !ctx.road[j].sideOff;

/**
 * A point of an edge barrier as dress.ts layWalls / layArmco lay it (every 1 or 2 road points):
 * where the LEFT one starts again after a gap a leaving slip opened, that end is the nose between
 * the road and the slip - a triangle before it, for our way's traffic.
 * @param ctx the dress context
 * @param j the road point
 * @param off the barrier's offset there, m
 * @param side its side: -1 the left
 */
export function noteLeftBarrier(ctx: DressCtx, j: number, off: number, side: number) {
  if (!FIX.hwbarrels || side >= 0 || isGapAt(ctx, j) || ctx.road[j].sideOff
    || !(isGapAt(ctx, j - 1) || isGapAt(ctx, j - 2))) return;
  const due = ctx.state.noseDue, dist = ctx.road[j].s;
  if (!due) return;
  const slip = due.findIndex((from) => dist >= from && dist <= from + NOSE_REACH_M);
  if (slip < 0) return;
  due.splice(slip, 1);
  layTriangle(ctx.level, dist, off, -1, ctx.loose);
}

/**
 * Notes one piece of the central reservation's barrier as it is laid (dress.ts layMedian, in road
 * order): a Jersey barrier or Armco starting after an open reservation gets a triangle before its
 * start (our way's traffic), one ending before an open reservation a triangle past its end (the
 * other carriageway's traffic). A change to or from a fence, between the two, or a join of two
 * pieces of one kind gets none.
 * @param ctx the dress context
 * @param startIdx the piece's first road point
 * @param lastIdx its last road point
 * @param kind its barrier (null: none)
 */
export function noteMedianPiece(ctx: DressCtx, startIdx: number, lastIdx: number,
  kind: BarrierKind | null) {
  const state = ctx.level._hw, last = state.medianLast, road = ctx.road;
  const centre = state.geo.median ?? 0;
  if (last && kind === null && last.kind && RIGID.has(last.kind))
    layTriangle(ctx.level, last.endS, centre, 1, ctx.loose);
  if (last && last.kind === null && kind && RIGID.has(kind))
    layTriangle(ctx.level, road[startIdx].s, centre, -1, ctx.loose);
  // (a piece of the same kind overlapping the last one carries its end on)
  if (!last || last.kind !== kind || road[lastIdx].s > last.endS)
    state.medianLast = { kind, endS: road[lastIdx].s };
}

/**
 * After a stretch is dressed: the litter under the barrels taken, the slips whose nose can no
 * longer come (no barrier started within NOSE_REACH_M: an open verge) forgotten.
 * @param ctx the dress context
 */
export function layCushions(ctx: DressCtx) {
  const { state, road, endIdx, loose } = ctx;
  const dressedS = road[Math.min(road.length - 1, endIdx - 1)].s;
  if (state.noseDue) state.noseDue = state.noseDue.filter((from) => from + NOSE_REACH_M
    >= dressedS);
  clearUnderBarrels(loose);
}

/**
 * Takes the roadside litter laid where a barrel now stands - the barrels are the road's own
 * furniture; the litter is strewn.
 * @param loose the loose objects not yet handed to the game
 */
function clearUnderBarrels(loose: LevelObj[]) {
  const barrels = loose.filter((obj) => obj.kind === 'cushion');
  if (!barrels.length) return;
  const reach = BARREL_R + LITTER_CLEAR_M;
  const kept = loose.filter((obj) => obj.kind === 'cushion' || !barrels.some((barrel) =>
    Math.abs(barrel.x - obj.x) < reach && Math.hypot(barrel.x - obj.x, barrel.y - obj.y) < reach));
  if (kept.length === loose.length) return;
  loose.length = 0;
  loose.push(...kept);
}

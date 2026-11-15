// highway/cushions.ts - THE HIGHWAYS' CRASH-CUSHION BARRELS (passed 11-15; TODO-DONE
// item 13; the owner 11-15: "placed just before the tips of the arm coat or the ends of the arm
// coat to protect like crashes coming onto them, like in real life ... in little triangle
// formations or in like threes in front of it"; then "It should cover barriers at the side
// too"). Water-filled barrels as real impact attenuators stand: ONLY in front of an EXPOSED
// barrier END that traffic drives at -
//  - the LEADING end of every ROADSIDE barrier (Armco on a bend or a gorge's lip, the walled
//    road's wall, a river bridge's parapet): on the left its start (our way's traffic), on the
//    right its end (the other way's) - so the nose of the barrier between the road and a leaving
//    slip, where the wall starts again after the slip's gap, is one; never its trailing end;
//  - the ENDS of the central reservation's Jersey barrier / Armco where the reservation opens: its
//    start for our way's traffic, its end for the far carriageway's.
// Never along a barrier's side, never where two pieces of one barrier join or a run carries on
// into the next stretch (another barrier within JOIN_M of the end: judged once the next stretch
// is laid). A TRIANGLE pointing at the traffic: one barrel, then two, then three nearest the end,
// rows 0.9 m apart, centred on the end, the back row just clear of it; a row that would stand on
// tarmac loses barrels (1-2-2 before a wall 1.2 m off the edge). Blue on the countryside, yellow
// on Deaf Valley. Loose objects (cones/coneCushion.ts: a hit leaks or pops one, spraying water);
// laid with the stretch, so they are back the next time it is built. No random stream is read:
// the switch adds the barrels and moves nothing else.
import { COL } from '../world/colours.ts';
import { roadFrame, roadPose } from './road.ts';
import type { Barrier, BarrierKind } from '../world/types.ts';
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
// m: no other barrier within this of an end - it is exposed (two pieces of one barrier overlap by
// a point; a run carried into the next stretch starts on the last one's line)
const JOIN_M = 1.0;
// m: no triangle before this road distance (the road's first metres, behind the start)
const FIRST_END_S = 200;
// m between the spots read from an end in to the road's edge for a barrier shielding it
const SHIELD_STEP_M = 0.5;
// m a barrel keeps off a barrier's line (less than END_CLEAR_M + BARREL_R: the back row stands
// before its own end); a street light's post's radius with its base
const BARRIER_CLEAR_M = 0.1, POST_R = 0.3;
// the roadside barriers whose leading end gets a triangle (Deaf Valley's rock faces are not one)
const ROADSIDE = new Set<string>(['armco', 'wall', 'jersey']);
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
 * Whether a barrel's spot is clear of every barrier (a wall beside the one it guards) and every
 * street light's post.
 * @param level the highway level
 * @param spot its centre
 * @returns true when clear
 */
function isClearOfBarriers(level: HwLevel, spot: { x: number; y: number }) {
  return level.barriers.every((barrier) => toLine(barrier.pts, spot.x, spot.y) > BARREL_R
    + BARRIER_CLEAR_M) && level.lamps.every((lamp) => Math.hypot(lamp.x - spot.x,
    lamp.y - spot.y) > BARREL_R + POST_R);
}

/**
 * A triangle of barrels in front of a barrier's end: its back row END_CLEAR_M from the end, each
 * row ALONG_M further toward the traffic, centred on the end; a row loses barrels where one would
 * stand on a lane or a barrier.
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
        if (!isClearOfLanes(level, off, pose.x, pose.y) || !isClearOfBarriers(level, pose)) break;
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

/** A roadside barrier's end that may be exposed: where, its road distance and offset, which way
 * its triangle lies (-1 toward lower s), and the barrier it ends. */
interface EndDue { x: number; y: number; s: number; off: number; away: number; from: Barrier }

/**
 * Notes where this stretch's barriers start in the level's list (dress.ts dressStretch), so
 * layCushions reads only the ones it lays.
 * @param ctx the dress context
 */
export function markBarriers(ctx: DressCtx) {
  ctx.state.barrierMark = ctx.level.barriers.length;
}

/**
 * The LEADING end of each ROADSIDE barrier this stretch laid (not the reservation's): on the left
 * (our way's traffic, rising s) its start, on the right (the other way's: the far carriageway, or
 * the single carriageway's other lane) its end - the one that side's traffic drives at.
 * @param ctx the dress context
 * @returns the ends, to be judged once the next stretch is laid
 */
function roadsideEnds(ctx: DressCtx): EndDue[] {
  const { level, state } = ctx, out: EndDue[] = [];
  for (const barrier of level.barriers.slice(state.barrierMark ?? level.barriers.length)) {
    if (!ROADSIDE.has(barrier.kind) || barrier.pts.length < 2) continue;
    const ends = [barrier.pts[0], barrier.pts[barrier.pts.length - 1]].map(([x, y]) => ({ x, y,
      frame: roadFrame(level, x, y, barrier._s) }));
    if (!ends[0].frame || !ends[1].frame) continue;
    const side = Math.sign(ends[0].frame.off);
    // (the reservation's own barriers are noteMedianPiece's)
    if (Math.abs(ends[0].frame.off) < state.geo.hw) continue;
    const rising = ends[0].frame.s <= ends[1].frame.s;
    const lead = (side < 0) === rising ? ends[0] : ends[1];
    if (lead.frame!.s < FIRST_END_S) continue;
    out.push({ x: lead.x, y: lead.y, s: lead.frame!.s, off: lead.frame!.off, away: side < 0 ? -1
      : 1, from: barrier });
  }
  return out;
}

/**
 * Whether a barrier's end is EXPOSED: no other barrier runs on from it or past it within JOIN_M,
 * none stands between it and the road
 * (a join of two pieces, a run carried on into the next stretch, a parapet against a wall, a
 * rock face).
 * @param level the highway level
 * @param end the end
 * @returns true when exposed
 */
function isExposed(level: HwLevel, end: EndDue) {
  if (!level.barriers.every((barrier) => barrier === end.from
    || toLine(barrier.pts, end.x, end.y) > JOIN_M)) return false;
  // (shielded: another barrier between it and the road - MEASURED _hwbarrelwhere.mjs, a gorge's
  // lip Armco 1.2 m behind the walled road's wall had triangles along the wall)
  const toRoad = -Math.sign(end.off), halfWidth = level._hw.geo.hw;
  for (let off = end.off + toRoad * SHIELD_STEP_M; Math.abs(off) > halfWidth;
    off += toRoad * SHIELD_STEP_M) {
    const spot = roadPose(level, end.s, off);
    if (level.barriers.some((barrier) => barrier !== end.from
      && toLine(barrier.pts, spot.x, spot.y) < SHIELD_STEP_M)) return false;
  }
  return true;
}

/**
 * After a stretch is dressed: the triangles before the exposed roadside ends the stretch before
 * laid (judged now, with the barriers that carry them on laid), its own ends kept for the next
 * one, and the litter under the barrels taken.
 * @param ctx the dress context
 */
export function layCushions(ctx: DressCtx) {
  const { state, level, loose } = ctx, ready = state.endsDue || [];
  state.endsDue = roadsideEnds(ctx);
  for (const end of ready) if (isExposed(level, end))
    layTriangle(level, end.s, end.off, end.away, loose);
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

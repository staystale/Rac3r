// highway/cushions.ts - THE HIGHWAYS' CRASH-CUSHION BARRELS (?hwbarrels=1, FIX.hwbarrels; TODO 3a2
// item 13, the owner's answers 11-15): water-filled barrels in clusters of 3-9, as real impact
// attenuators stand - at the NOSE where a slip road leaves (the gore between the slip and the
// carriageway, where the gap has room for a row of three) and at the ends of the central
// reservation's barriers (a Jersey barrier's or Armco's end with an open reservation beyond, one
// cluster before the end that faces each way's traffic). Infinite highways only. Blue on the
// countryside, yellow on Deaf Valley. A cluster tapers to one barrel facing the traffic, its widest
// row at the hazard. Loose objects (cones/coneCushion.ts: a hit leaks or pops one, spraying
// water); laid fresh each time the stretch is built, so they are back the next time it streams in.
// Their count is rolled from the road's seed and their spot, never from the road's random streams:
// the switch adds the barrels and moves nothing else.
import { COL } from '../world/colours.ts';
import { hash2d } from '../core/random.ts';
import { roadFrame, roadPose } from './road.ts';
import { SLIP_W } from './cuts.ts';
import type { BarrierKind, Point } from '../world/types.ts';
import type { DressCtx, HwLevel } from './hwtypes.ts';
import type { LevelObj } from '../cones/coneTypes.ts';

// m centre to centre across a row and along the cluster (a barrel is 0.9 m across: cones/
// coneConsts.ts DEBRIS.cushion)
const ACROSS_M = 0.95, ALONG_M = 1.0;
// m: a barrel's radius
const BARREL_R = 0.45;
// m: the clear gap between a slip's edge and the carriageway's edge where the nose stands - a row
// of three (2.8 m) and 0.4 m each side
const NOSE_GAP_M = 3.6;
// m kept between a row's barrels and the tarmac either side of the gore
const ROW_MARGIN_M = 0.3;
// m between a barrier's end and the row nearest it
const END_GAP_M = 0.5;
// barrels in a cluster, fewest and most (the owner: "~3-9")
const LEAST = 3, MOST = 9;
// most barrels across a row: in the central reservation (3 m between the carriageways' edge
// strips), in a gore
const MEDIAN_WIDE = 2, GORE_WIDE = 3;
// the reservation's barriers that end in a hard nose (a fence's end needs no cushion)
const RIGID = new Set<string>(['jersey', 'armco']);
// m past a barrel's edge the roadside litter is cleared (a litter object's own reach, ~0.5)
const LITTER_CLEAR_M = 0.5;
// road points back and ahead a services' side road is read for its nose
const SIDE_BACK = 10, SIDE_AHEAD = 3;

/** A slip's gap to the carriageway at a road distance: s, m; gap, m (negative: on the road). */
interface GorePoint { s: number; gap: number }

/**
 * The rows of a cluster from its front (the one barrel facing the traffic) to its back (at the
 * hazard): each a row one wider than the one before up to `wide`, the rest in front, narrowest
 * first - 3: 1 2; 6: 1 2 3; 7: 1 1 2 3; 9: 1 2 3 3.
 * @param count barrels
 * @param wide most across a row
 * @returns barrels a row, front first
 */
export function clusterRows(count: number, wide: number): number[] {
  const rows = [1];
  let left = count - 1;
  while (left > 0) {
    const across = Math.min(wide, rows[rows.length - 1] + 1, left);
    rows.push(across);
    left -= across;
  }
  return rows.sort((first, second) => first - second);
}

/**
 * How many barrels a cluster has, rolled from the road's seed and the cluster's spot.
 * @param seed the road's seed
 * @param dist the cluster's road distance, m
 * @param side which kind of cluster (a different roll for each at one spot)
 * @returns LEAST..MOST
 */
function countAt(seed: number, dist: number, side: number) {
  const roll = hash2d(seed)(Math.round(dist), side);
  return LEAST + Math.min(MOST - LEAST, Math.floor(roll * (MOST - LEAST + 1)));
}

/**
 * One barrel as a loose object.
 * @param level the highway level
 * @param dist its road distance, m
 * @param off its offset from the road's centre line, m (+ = the driver's right)
 * @returns the barrel
 */
function barrelAt(level: HwLevel, dist: number, off: number): LevelObj {
  const pose = roadPose(level, dist, off);
  const paint = level._cfg.theme === 'canyon' ? COL.cushionYellow : COL.cushionBlue;
  return { kind: 'cushion', x: pose.x, y: pose.y, rot: pose.h, paint, _s: dist };
}

/**
 * The barrels across one row, centred on an offset.
 * @param level the highway level
 * @param dist the row's road distance, m
 * @param centre its centre's offset, m
 * @param across barrels in it
 * @param out receives them
 */
function layRow(level: HwLevel, dist: number, centre: number, across: number, out: LevelObj[]) {
  for (let slot = 0; slot < across; slot++)
    out.push(barrelAt(level, dist, centre + (slot - (across - 1) / 2) * ACROSS_M));
}

/**
 * A slip's gap at a road distance, read between the profile's points.
 * @param profile the gap along the slip, by rising s
 * @param dist m
 * @returns the gap, m (-Infinity before the profile)
 */
function gapAt(profile: GorePoint[], dist: number) {
  if (!profile.length || dist < profile[0].s) return -Infinity;
  for (let point = 1; point < profile.length; point++) {
    const from = profile[point - 1], next = profile[point];
    if (dist <= next.s) return from.gap + (next.gap - from.gap) * ((dist - from.s)
      / Math.max(1e-6, next.s - from.s));
  }
  return profile[profile.length - 1].gap;
}

/**
 * A cluster in the gore of a slip leaving the left edge: its back row where the gap first reaches
 * NOSE_GAP_M, its rows narrowing toward the split (each no wider than its gap holds), centred
 * between the slip's edge and the carriageway's.
 * @param level the highway level
 * @param profile the gap along the slip, by rising s
 * @param out receives the barrels
 */
function layGore(level: HwLevel, profile: GorePoint[], out: LevelObj[]) {
  const nose = profile.findIndex((point) => point.gap >= NOSE_GAP_M);
  if (nose < 1) return;
  const before = profile[nose - 1], after = profile[nose];
  const noseS = before.s + (after.s - before.s) * ((NOSE_GAP_M - before.gap)
    / Math.max(1e-6, after.gap - before.gap));
  const rows = clusterRows(countAt(level._hw.seed, noseS, 1), GORE_WIDE);
  const halfWidth = level._hw.geo.hw;
  for (let back = 0; back < rows.length; back++) {
    const dist = noseS - back * ALONG_M, gap = gapAt(profile, dist);
    const fits = Math.floor((gap - 2 * ROW_MARGIN_M + ACROSS_M - 2 * BARREL_R) / ACROSS_M);
    const across = Math.min(rows[rows.length - 1 - back], fits);
    if (!(across >= 1)) break;
    layRow(level, dist, -(halfWidth + gap / 2), across, out);
  }
}

/**
 * Notes a slip that leaves the left edge: its cluster at the nose, handed to the stretch's loose
 * objects when it is dressed (layCushions).
 * @param level the highway level
 * @param line the slip's centre line, from where it leaves
 * @param widthM the slip's width, m
 * @param dist the road distance it leaves at, m
 */
export function noteSlipNose(level: HwLevel, line: Point[], widthM: number, dist: number) {
  const halfWidth = level._hw.geo.hw, profile: GorePoint[] = [];
  for (let point = 0; point < line.length; point++) {
    const [x, y] = line[point], frame = roadFrame(level, x, y, dist);
    if (!frame) continue;
    if (profile.length && frame.s <= profile[profile.length - 1].s) break;
    // (the slip's edge across the road: its half width over the cosine of its angle to the road -
    // MEASURED: taken square, a junction slip's nose row stood 0.04 m onto its tarmac)
    const [nextX, nextY] = line[Math.min(line.length - 1, point + 1)],
      [prevX, prevY] = line[Math.max(0, point - 1)];
    const span = Math.hypot(nextX - prevX, nextY - prevY) || 1;
    const along = Math.max(0.5, ((nextX - prevX) * frame.dx + (nextY - prevY) * frame.dy) / span);
    profile.push({ s: frame.s, gap: -frame.off - widthM / 2 / along - halfWidth });
  }
  layGore(level, profile, level._hw.cushionDue ||= []);
}

/**
 * A services' side road's nose (it eases off the left edge, highway/cuts.ts sideStep): where its
 * gap first reaches NOSE_GAP_M on the way out.
 * @param ctx the dress context
 * @param i the road point
 */
function layServicesNose(ctx: DressCtx, i: number) {
  const { level, road, halfWidth, loose } = ctx;
  const gapOf = (j: number) => (road[j].sideOff ?? 0) - SLIP_W / 2 - halfWidth;
  if (!road[i].sideOff || !road[i - 1].sideOff || road[i].sideOff! <= road[i - 1].sideOff!
    || gapOf(i) < NOSE_GAP_M || gapOf(i - 1) >= NOSE_GAP_M) return;
  const profile: GorePoint[] = [];
  for (let j = Math.max(0, i - SIDE_BACK); j <= Math.min(road.length - 1, i + SIDE_AHEAD); j++)
    profile.push({ s: road[j].s, gap: road[j].sideOff ? gapOf(j) : -halfWidth });
  layGore(level, profile, loose);
}

/**
 * A cluster before a central reservation barrier's end, on the reservation's line: its back row
 * END_GAP_M from the end, its front (one barrel) toward the traffic coming at that end.
 * @param ctx the dress context
 * @param endS the end's road distance, m
 * @param away +1: the cluster lies beyond the end (the other way's traffic meets it), -1 before it
 */
function layMedianEnd(ctx: DressCtx, endS: number, away: number) {
  const { level, loose } = ctx, centre = level._hw.geo.median ?? 0;
  const rows = clusterRows(countAt(level._hw.seed, endS, 2 + away), MEDIAN_WIDE);
  for (let back = 0; back < rows.length; back++)
    layRow(level, endS + away * (END_GAP_M + BARREL_R + back * ALONG_M), centre,
      rows[rows.length - 1 - back], loose);
}

/**
 * Notes one piece of the central reservation's barrier as it is laid (dress.ts layMedian, in road
 * order): a Jersey barrier or Armco starting after an open reservation gets a cluster before its
 * start (our way's traffic), one ending before an open reservation a cluster past its end (the
 * other way's). A change to or from a fence, or between the two, gets none.
 * @param ctx the dress context
 * @param startIdx the piece's first road point
 * @param lastIdx its last road point
 * @param kind its barrier (null: none)
 */
export function noteMedianPiece(ctx: DressCtx, startIdx: number, lastIdx: number,
  kind: BarrierKind | null) {
  const state = ctx.level._hw, last = state.medianLast, road = ctx.road;
  if (last && kind === null && last.kind && RIGID.has(last.kind)) layMedianEnd(ctx, last.endS, 1);
  if (last && last.kind === null && kind && RIGID.has(kind))
    layMedianEnd(ctx, road[startIdx].s, -1);
  // (a piece of the same kind overlapping the last one carries its end on)
  if (!last || last.kind !== kind || road[lastIdx].s > last.endS)
    state.medianLast = { kind, endS: road[lastIdx].s };
}

/**
 * The stretch's barrels: the slips' noted with them, the services' side road's nose.
 * @param ctx the dress context
 */
export function layCushions(ctx: DressCtx) {
  const { state, firstIdx, endIdx, loose } = ctx;
  if (state.cushionDue && state.cushionDue.length) {
    loose.push(...state.cushionDue);
    state.cushionDue.length = 0;
  }
  for (let i = Math.max(1, firstIdx); i < endIdx; i++) layServicesNose(ctx, i);
  clearUnderBarrels(loose);
}

/**
 * Takes the roadside litter laid where a barrel now stands (a tyre, a pallet on the verge in a
 * gore: MEASURED _hwbarrelcount.mjs, 9 on the motorway's first 20 km) - the barrels are the
 * road's own furniture; the litter is strewn.
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

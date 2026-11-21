// highway/city.ts - GETAWAY STOCKHOLM's roadside (owner 11-21, step 1, behind ?stockholm): the
// road runs through CITY stretches and GREEN ones (the countryside's forest: pines and rocks), in
// a random order (highway/dress.ts biomeAtDist, CITY_BIOMES). In the city each side is lined with
// LOTS: a concrete block LOT_OUT_M past the road edge, a noise wall (a 'wall' barrier) along its
// side facing the road, a street down its middle and a row of buildings either side of that -
// modern (slabs of flats, offices: flat roofs, rooftop plant) or the old town's (narrow houses
// under ochre, red and copper roofs, now and then a church). A lot is a keep rect with a field id,
// as a village is (highway/fields.ts): anything later that needs the ground (a slip, a bridge's
// approach, a river) drops it whole - its wall, its street and its buildings with it.
import { SURFACES } from '../world/surfaces.ts';
import { STEP } from './presets.ts';
import { keepOut } from './cuts.ts';
import { roomFor } from './fields.ts';
import type { Point, Prop } from '../world/types.ts';
import type { DressCtx, HwPose } from './hwtypes.ts';

/** the city's stretches and their weights (highway/dress.ts biomeAtDist) */
export const CITY_BIOMES: [string, number][] = [['city', 0.65], ['green', 0.35]];
// m: a lot's length along the road (a range), the gap to the next (a range), and its near edge
// past the road edge (the noise wall stands on it)
// (MEASURED, _cityshot.mjs: 60-110 m lots found no room on the bends - a lot is straight - and
// left 13-16 lots in the window there, 22-24 on the straighter road)
const LOT_LEN_M = [40, 90], LOT_GAP_M = [4, 14], LOT_OUT_M = 6;
// m of verge between the noise wall and the lot's concrete (photographed: a wall on the concrete
// did not show)
const GROUND_IN_M = 2;
// m across from the lot's near edge: the near row's middle, the street's, the far row's; the lot's
// depth; the street's width
const NEAR_ROW_M = 9, STREET_M = 21, FAR_ROW_M = 33, LOT_DEPTH_M = 44, STREET_W_M = 6;
// m deep: a modern row's buildings (near, far), an old row's; m long: a modern building (a range),
// an old house (a range), a church; m between two buildings in a row (a range)
const MODERN_DEEP_M = [12, 14], OLD_DEEP_M = 10, MODERN_LEN_M = [22, 46], OLD_LEN_M = [9, 15];
const CHURCH_LEN_M = 18, CHURCH_DEEP_M = 8, BUILD_GAP_M = [2, 6];
// a modern lot's roofs (tar and gravel greys), the old town's (ochre, brick red, copper green)
const FLAT_ROOFS = ['#4a4f57', '#5b626b', '#3f444b', '#676b70'];
const OLD_ROOFS = ['#b5652e', '#a2452f', '#c08a3e', '#5f9e8a', '#7a3b2c', '#c9a25a'];
const COPPER_ROOF = '#5f9e8a';
// the share of lots in the old town's style, and of those with a church in the far row
const OLD_SHARE = 0.4, CHURCH_SHARE = 0.3;
// m a lot keeps clear of the road (its corners: fields.ts roomFor)
const LOT_MARGIN_M = 3;

/** A lot as it is laid: its side, first road point, length, field id and style. */
interface Lot {
  side: number; i: number; len: number; fieldId: number; dist: number; isOld: boolean;
  pointAt: (i: number, off: number) => HwPose; near: number;
}

/**
 * A point on a lot: `along` m from its start, `across` m in from its near edge.
 * @param lot the lot
 * @param along m along the road
 * @param across m away from the road
 * @returns the point and the road's heading there
 */
const lotPoint = (lot: Lot, along: number, across: number): HwPose =>
  lot.pointAt(lot.i + Math.round(along / STEP), lot.side * (lot.near + across));

/**
 * A row of buildings along a lot, `across` m in from its near edge: modern slabs, or the old
 * town's houses (the far row of an old lot may start with a church).
 * @param ctx the dress context
 * @param lot the lot
 * @param across the row's middle, m in from the lot's near edge
 * @param deep the row's buildings' depth, m
 * @param hasChurch the row starts with a church
 */
function layRow(ctx: DressCtx, lot: Lot, across: number, deep: number, hasChurch: boolean) {
  const rand = ctx.state.frnd;
  let along = 1 + rand() * 3, isChurch = hasChurch;
  for (;;) {
    const span = isChurch ? CHURCH_LEN_M : lot.isOld
      ? OLD_LEN_M[0] + rand() * (OLD_LEN_M[1] - OLD_LEN_M[0])
      : MODERN_LEN_M[0] + rand() * (MODERN_LEN_M[1] - MODERN_LEN_M[0]);
    if (along + span > lot.len - 1) return;
    const pos = lotPoint(lot, along + span / 2, across);
    const building: Prop = { kind: 'block', x: pos.x, y: pos.y, w: span,
      h: isChurch ? CHURCH_DEEP_M : deep, rot: pos.rot, field: lot.fieldId, _s: lot.dist,
      roof: isChurch ? COPPER_ROOF : lot.isOld ? OLD_ROOFS[(rand() * OLD_ROOFS.length) | 0]
        : FLAT_ROOFS[(rand() * FLAT_ROOFS.length) | 0] };
    if (isChurch) building.church = true;
    else if (lot.isOld) building.house = true;
    ctx.level.props.push(building);
    along += span + BUILD_GAP_M[0] + rand() * (BUILD_GAP_M[1] - BUILD_GAP_M[0]);
    isChurch = false;
  }
}

/**
 * A lot's ground (concrete, past a strip of verge), its noise wall along the road side and its
 * street down the middle.
 * @param ctx the dress context
 * @param lot the lot
 */
function layLotGround(ctx: DressCtx, lot: Lot) {
  const { level } = ctx, ground = lotPoint(lot, lot.len / 2, (LOT_DEPTH_M + GROUND_IN_M) / 2);
  level.zones.push({ x: ground.x, y: ground.y, w: lot.len, h: LOT_DEPTH_M - GROUND_IN_M,
    rot: ground.rot, surface: SURFACES.concrete, field: lot.fieldId, _s: lot.dist });
  const wall: Point[] = [], street: Point[] = [];
  for (let along = 0; along <= lot.len; along += 2 * STEP) {
    const onWall = lotPoint(lot, along, 0), onStreet = lotPoint(lot, along, STREET_M);
    wall.push([onWall.x, onWall.y]);
    street.push([onStreet.x, onStreet.y]);
  }
  level.barriers.push({ kind: 'wall', pts: wall, field: lot.fieldId, _s: lot.dist });
  level.lanes.push({ pts: street, width: STREET_W_M, surface: SURFACES.tarmac,
    field: lot.fieldId, _s: lot.dist });
}

/**
 * Lays a lot on one side from road point i, when it has room (clear of the road, of every keep
 * rect - a slip, a bridge's approach, a river, a lay-by - and of the other lots).
 * @param ctx the dress context
 * @param side -1 / +1
 * @param i the road point it starts at
 * @param len its length, m
 * @returns it was laid
 */
function layLot(ctx: DressCtx, side: number, i: number, len: number): boolean {
  const { level, state, pointAt } = ctx, rand = state.frnd;
  // (the right side: clear of the road, not of the left's side road)
  const clear = side > 0 ? ctx.clearRight : ctx.clear;
  const lot: Lot = { side, i, len, fieldId: 0, dist: state.pts[i].s, isOld: rand() < OLD_SHARE,
    pointAt, near: ctx.halfWidth + LOT_OUT_M };
  const centre = lotPoint(lot, len / 2, LOT_DEPTH_M / 2);
  const rect = { x: centre.x, y: centre.y, ax: Math.cos(centre.rot), ay: Math.sin(centre.rot),
    hu: len / 2, hv: LOT_DEPTH_M / 2, field: 0 };
  if (!roomFor(state, rect, clear, LOT_MARGIN_M)) return false;
  lot.fieldId = rect.field = ++state.fieldId;
  keepOut(level, rect, lot.dist);
  layLotGround(ctx, lot);
  const deep = lot.isOld ? [OLD_DEEP_M, OLD_DEEP_M] : MODERN_DEEP_M;
  layRow(ctx, lot, NEAR_ROW_M, deep[0], false);
  layRow(ctx, lot, FAR_ROW_M, deep[1], lot.isOld && rand() < CHURCH_SHARE);
  return true;
}

/**
 * The lot due on one side (state.lotDue), laid once road point i is its last: by then the side
 * road along it is known (highway/cuts.ts sideStep marks each point as it is dressed - MEASURED,
 * _citylots.mjs: decided at its first point, a lot ran into a side road starting along it, 11 of
 * 4,500 buildings and walls on a lane).
 * @param ctx the dress context
 * @param i the road point
 * @param side -1 / +1
 * @returns the length laid, m (0: no room); null when it is not due yet
 */
function layDueLot(ctx: DressCtx, i: number, side: number): number | null {
  const { state, road } = ctx, due = state.lotDue![side]!;
  const firstIdx = i - Math.round((road[i].s - due.s) / STEP);
  if (firstIdx < 0) return 0;
  if (firstIdx + Math.ceil(due.len / STEP) > i) return null;
  if (layLot(ctx, side, firstIdx, due.len)) return due.len;
  // (a lot is straight: on a bend a long one finds no room where the shortest does)
  return due.len > LOT_LEN_M[0] && layLot(ctx, side, firstIdx, LOT_LEN_M[0]) ? LOT_LEN_M[0] : 0;
}

/**
 * The city's lots at road point i: on each side, once the last lot there has ended, the next one
 * is due (a CITY stretch only; a GREEN one keeps the schedule moving), and laid when the dressing
 * reaches its last point; with no room there it tries again a point on.
 * @param ctx the dress context
 * @param i the road point
 * @param biome the stretch here (CITY_BIOMES)
 */
export function layCityLots(ctx: DressCtx, i: number, biome: string) {
  const { state, road } = ctx, rand = state.frnd, dist = road[i].s;
  const next = (state.lotNext ||= { '-1': 0, 1: 0 });
  const dueBy = (state.lotDue ||= { '-1': null, 1: null });
  for (const side of [-1, 1]) {
    if (!dueBy[side]) {
      if (dist < next[side]) continue;
      if (biome !== 'city') {
        next[side] = dist;
        continue;
      }
      dueBy[side] = { s: dist, len: LOT_LEN_M[0] + rand() * (LOT_LEN_M[1] - LOT_LEN_M[0]) };
    }
    const due = dueBy[side]!, laidLen = layDueLot(ctx, i, side);
    if (laidLen === null) continue;
    // (no room: it is due again a point on - tried once the dressing reaches its new last point)
    if (!laidLen && biome === 'city') {
      dueBy[side] = { s: due.s + STEP, len: due.len };
      continue;
    }
    dueBy[side] = null;
    next[side] = laidLen ? due.s + laidLen + LOT_GAP_M[0] + rand() * (LOT_GAP_M[1] - LOT_GAP_M[0])
      : dist;
  }
}

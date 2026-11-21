// highway/city.ts - GETAWAY STOCKHOLM's LOTS (behind ?stockholm; owner 11-21 on step 1: "very
// boring and not varied enough ... like a city, much busier"): on every built-up stretch
// (highway/cityplan.ts: the city, a cutting's and a tunnel's tops, below a raised stretch) each
// side
// is lined with LOTS - concrete past a strip of verge, a street down the middle with cars parked
// along it, a row of buildings either side of the street - in four styles: MODERN (slabs of flats
// and offices: flat roofs, rooftop plant), the OLD TOWN (narrow houses under ochre, red and copper
// roofs, now and then a church), TOWERS (one or two big blocks behind a modern row) and SHOPS (a
// row of small units, their car park behind full of cars). A city stretch's lot has a noise wall
// on its road side. Wheelie bins stand by the doors. A lot is a keep rect with a field id, as a
// village is (highway/fields.ts): anything later that needs the ground (a slip, a bridge's
// approach, a river) drops it whole - its wall, its street, its buildings and cars with it.
import { SURFACES } from '../world/surfaces.ts';
import { STEP } from './presets.ts';
import { keepOut } from './cuts.ts';
import { roomFor } from './fields.ts';
import type { Point, Prop } from '../world/types.ts';
import type { LevelObj } from '../cones/coneTypes.ts';
import type { DressCtx, HwPose } from './hwtypes.ts';

// m: a lot's length along the road (a range), the gap to the next (a range)
// (MEASURED, _cityshot.mjs: 60-110 m lots found no room on the bends - a lot is straight - and
// left 13-16 lots in the window there, 22-24 on the straighter road)
const LOT_LEN_M = [40, 90], LOT_GAP_M = [2, 7];
// m its near edge stands past the road edge by stretch: the city's (its noise wall on it); past a
// cutting's or tunnel's retaining wall and slope (on the ground above); past a raised stretch's
// embankment foot (highway/cityplan.ts cityGround)
const LOT_OUT_M: Record<string, number> = { city: 6, cutting: 9, tunnel: 9, raised: 11 };
// m of verge between the lot's road edge and its concrete (photographed: a wall on the concrete
// did not show)
const GROUND_IN_M = 2;
// m across from the lot's near edge: the near row's middle, the street's, the far row's; the lot's
// depth; the street's width; a parked car's kerb line off the street's middle
const NEAR_ROW_M = 9, STREET_M = 21, FAR_ROW_M = 33, LOT_DEPTH_M = 44, STREET_W_M = 6;
const KERB_M = 3.9;
// m deep: a modern row's buildings (near, far), an old row's, a shop's; m long: a modern building
// (a range), an old house, a shop, a tower; a tower's depth; a church; between two buildings
const MODERN_DEEP_M = [12, 14], OLD_DEEP_M = 10, SHOP_DEEP_M = 9;
const MODERN_LEN_M = [22, 46], OLD_LEN_M = [9, 15], SHOP_LEN_M = [6, 10], TOWER_LEN_M = [20, 30];
const TOWER_DEEP_M = [18, 22], CHURCH_LEN_M = 18, CHURCH_DEEP_M = 8, BUILD_GAP_M = [2, 6];
// a modern lot's roofs (tar and gravel greys), the old town's (ochre, brick red, copper green), a
// tower's (dark), a shop's (painted)
const FLAT_ROOFS = ['#4a4f57', '#5b626b', '#3f444b', '#676b70'];
const OLD_ROOFS = ['#b5652e', '#a2452f', '#c08a3e', '#5f9e8a', '#7a3b2c', '#c9a25a'];
const TOWER_ROOFS = ['#2f3338', '#3a3f46', '#454b53'];
const SHOP_ROOFS = ['#d8d2c4', '#9aa3ad', '#c4513a', '#3d6fa8', '#e0b040', '#8a9a5b'];
const COPPER_ROOF = '#5f9e8a';
// the lot styles and how often each is picked
const STYLES: [Style, number][] = [['modern', 0.35], ['old', 0.3], ['tower', 0.15],
  ['shops', 0.2]];
// an old lot's chance of a church in its far row; a parked car's chance at each kerb spot and the
// spots' spacing, m (a range); a bin's chance by a building's door
const CHURCH_SHARE = 0.3, PARK_SHARE = 0.55, PARK_EVERY_M = [5.5, 9], BIN_SHARE = 0.35;
// parked cars' paints (the traffic's real-road colours: mostly silver, white, black, grey)
const CAR_PAINTS = ['#b9bdc4', '#e6e8ea', '#22252b', '#5b626d', '#1f3a6e', '#9c2a2a', '#2f5d3a'];
const BIN_COLS = ['#2f5d3a', '#3a3f47', '#2b56b5', '#6a4a2a'];
// m a lot keeps clear of the road (its corners: fields.ts roomFor)
const LOT_MARGIN_M = 3;

type Style = 'modern' | 'old' | 'tower' | 'shops';
/** A lot as it is laid: its side, first road point, length, field id, style, near edge. */
interface Lot {
  side: number; i: number; len: number; fieldId: number; dist: number; style: Style;
  pointAt: (i: number, off: number) => HwPose; near: number;
}
/** A row's buildings: m deep, a length range, their roofs, and what they are. */
interface RowLook { deep: number; len: number[]; roofs: string[]; flag?: 'house' }

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
 * A pick from a list by the fields' stream.
 * @param ctx the dress context
 * @param list the list
 * @returns one of it
 */
const pickOf = <T>(ctx: DressCtx, list: T[]): T => list[(ctx.state.frnd() * list.length) | 0];

/**
 * A row of buildings along a lot, `across` m in from its near edge (the first a church when asked),
 * a bin by some of their doors on the street side.
 * @param ctx the dress context
 * @param lot the lot
 * @param across the row's middle, m in from the lot's near edge
 * @param look the row's buildings
 * @param hasChurch the row starts with a church
 */
function layRow(ctx: DressCtx, lot: Lot, across: number, look: RowLook, hasChurch: boolean) {
  const rand = ctx.state.frnd, toStreet = Math.sign(STREET_M - across);
  let along = 1 + rand() * 3, isChurch = hasChurch;
  for (;;) {
    const span = isChurch ? CHURCH_LEN_M : look.len[0] + rand() * (look.len[1] - look.len[0]);
    if (along + span > lot.len - 1) return;
    const deep = isChurch ? CHURCH_DEEP_M : look.deep;
    const pos = lotPoint(lot, along + span / 2, across);
    const building: Prop = { kind: 'block', x: pos.x, y: pos.y, w: span, h: deep, rot: pos.rot,
      field: lot.fieldId, _s: lot.dist, roof: isChurch ? COPPER_ROOF : pickOf(ctx, look.roofs) };
    if (isChurch) building.church = true;
    else if (look.flag === 'house') building.house = true;
    ctx.level.props.push(building);
    if (rand() < BIN_SHARE) addBin(ctx, lot, along + span * rand(), across + toStreet
      * (deep / 2 + 0.8));
    along += span + BUILD_GAP_M[0] + rand() * (BUILD_GAP_M[1] - BUILD_GAP_M[0]);
    isChurch = false;
  }
}

/**
 * A wheelie bin (a loose object, knocked about) on a lot.
 * @param ctx the dress context
 * @param lot the lot
 * @param along m along it
 * @param across m in from its near edge
 */
function addBin(ctx: DressCtx, lot: Lot, along: number, across: number) {
  const pos = lotPoint(lot, along, across);
  ctx.loose.push({ kind: 'bin', x: pos.x, y: pos.y, rot: pos.rot, col: pickOf(ctx, BIN_COLS),
    field: lot.fieldId, _s: lot.dist } as LevelObj);
}

/**
 * Cars parked along a line of a lot (a kerb, a car park's row), nose along the road one way or the
 * other.
 * @param ctx the dress context
 * @param lot the lot
 * @param across the line, m in from the lot's near edge
 * @param share each spot's chance of a car
 */
function parkCars(ctx: DressCtx, lot: Lot, across: number, share: number) {
  const rand = ctx.state.frnd;
  for (let along = 3; along < lot.len - 3; along += PARK_EVERY_M[0] + rand()
    * (PARK_EVERY_M[1] - PARK_EVERY_M[0])) {
    if (rand() >= share) continue;
    const pos = lotPoint(lot, along, across);
    ctx.level.props.push({ kind: 'parkedcar', x: pos.x, y: pos.y,
      rot: pos.rot + (rand() < 0.5 ? 0 : Math.PI), col: pickOf(ctx, CAR_PAINTS),
      field: lot.fieldId, _s: lot.dist });
  }
}

/**
 * A lot's ground (concrete, past a strip of verge), its noise wall along the road side (a city
 * stretch's), its street down the middle.
 * @param ctx the dress context
 * @param lot the lot
 * @param hasWall a noise wall on its road side
 */
function layLotGround(ctx: DressCtx, lot: Lot, hasWall: boolean) {
  const { level } = ctx, ground = lotPoint(lot, lot.len / 2, (LOT_DEPTH_M + GROUND_IN_M) / 2);
  level.zones.push({ x: ground.x, y: ground.y, w: lot.len, h: LOT_DEPTH_M - GROUND_IN_M,
    rot: ground.rot, surface: SURFACES.concrete, field: lot.fieldId, _s: lot.dist });
  const wall: Point[] = [], street: Point[] = [];
  for (let along = 0; along <= lot.len; along += 2 * STEP) {
    const onWall = lotPoint(lot, along, 0), onStreet = lotPoint(lot, along, STREET_M);
    wall.push([onWall.x, onWall.y]);
    street.push([onStreet.x, onStreet.y]);
  }
  if (hasWall) level.barriers.push({ kind: 'wall', pts: wall, field: lot.fieldId, _s: lot.dist });
  level.lanes.push({ pts: street, width: STREET_W_M, surface: SURFACES.tarmac,
    field: lot.fieldId, _s: lot.dist });
}

/**
 * A lot's buildings and cars by its style: its two rows either side of the street (a tower lot's
 * far row its towers; a shops lot's far half its car park), cars parked along the street.
 * @param ctx the dress context
 * @param lot the lot
 */
function layLotBuildings(ctx: DressCtx, lot: Lot) {
  const modern = (deep: number): RowLook => ({ deep, len: MODERN_LEN_M, roofs: FLAT_ROOFS });
  if (lot.style === 'old') {
    const old: RowLook = { deep: OLD_DEEP_M, len: OLD_LEN_M, roofs: OLD_ROOFS, flag: 'house' };
    layRow(ctx, lot, NEAR_ROW_M, old, false);
    layRow(ctx, lot, FAR_ROW_M, old, ctx.state.frnd() < CHURCH_SHARE);
  } else if (lot.style === 'tower') {
    layRow(ctx, lot, NEAR_ROW_M, modern(MODERN_DEEP_M[0]), false);
    const deep = TOWER_DEEP_M[0] + ctx.state.frnd() * (TOWER_DEEP_M[1] - TOWER_DEEP_M[0]);
    layRow(ctx, lot, FAR_ROW_M + (deep - MODERN_DEEP_M[1]) / 2, { deep, len: TOWER_LEN_M,
      roofs: TOWER_ROOFS }, false);
  } else if (lot.style === 'shops') {
    layRow(ctx, lot, NEAR_ROW_M + 2, { deep: SHOP_DEEP_M, len: SHOP_LEN_M, roofs: SHOP_ROOFS },
      false);
    // (the car park: two rows of cars behind the street)
    parkCars(ctx, lot, FAR_ROW_M - 4, PARK_SHARE + 0.25);
    parkCars(ctx, lot, FAR_ROW_M + 2, PARK_SHARE + 0.25);
  } else {
    layRow(ctx, lot, NEAR_ROW_M, modern(MODERN_DEEP_M[0]), false);
    layRow(ctx, lot, FAR_ROW_M, modern(MODERN_DEEP_M[1]), false);
  }
  parkCars(ctx, lot, STREET_M - KERB_M, PARK_SHARE);
  if (lot.style !== 'shops') parkCars(ctx, lot, STREET_M + KERB_M, PARK_SHARE);
}

/**
 * The lot's style, by its weight.
 * @param ctx the dress context
 * @returns the style
 */
function pickStyle(ctx: DressCtx): Style {
  let roll = ctx.state.frnd() * STYLES.reduce((sum, [, weight]) => sum + weight, 0);
  for (const [style, weight] of STYLES) if ((roll -= weight) < 0) return style;
  return 'modern';
}

/**
 * Lays a lot on one side from road point i, when it has room (clear of the road, of every keep
 * rect - a slip, a bridge's approach, a river, a lay-by - and of the other lots).
 * @param ctx the dress context
 * @param side -1 / +1
 * @param i the road point it starts at
 * @param due its length and the stretch it is on
 * @param due.len m
 * @param due.kind the stretch (highway/cityplan.ts)
 * @returns it was laid
 */
function layLot(ctx: DressCtx, side: number, i: number, due: { len: number; kind: string })
  : boolean {
  const { level, state, pointAt } = ctx;
  // (the right side: clear of the road, not of the left's side road)
  const clear = side > 0 ? ctx.clearRight : ctx.clear;
  const lot: Lot = { side, i, len: due.len, fieldId: 0, dist: state.pts[i].s,
    style: pickStyle(ctx), pointAt, near: ctx.halfWidth + (LOT_OUT_M[due.kind] ?? 6) };
  const centre = lotPoint(lot, due.len / 2, LOT_DEPTH_M / 2);
  const rect = { x: centre.x, y: centre.y, ax: Math.cos(centre.rot), ay: Math.sin(centre.rot),
    hu: due.len / 2, hv: LOT_DEPTH_M / 2, field: 0 };
  if (!roomFor(state, rect, clear, LOT_MARGIN_M)) return false;
  lot.fieldId = rect.field = ++state.fieldId;
  keepOut(level, rect, lot.dist);
  layLotGround(ctx, lot, due.kind === 'city');
  layLotBuildings(ctx, lot);
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
  if (layLot(ctx, side, firstIdx, due)) return due.len;
  // (a lot is straight: on a bend a long one finds no room where the shortest does)
  return due.len > LOT_LEN_M[0] && layLot(ctx, side, firstIdx, { ...due, len: LOT_LEN_M[0] })
    ? LOT_LEN_M[0] : 0;
}

/**
 * The city's lots at road point i: on each side, once the last lot there has ended, the next one
 * is due (on a built-up stretch: LOT_OUT_M's; the water and a park keep the schedule moving), and
 * laid when the dressing reaches its last point; with no room there it tries again a point on.
 * @param ctx the dress context
 * @param i the road point
 * @param kind the stretch here (highway/cityplan.ts)
 */
export function layCityLots(ctx: DressCtx, i: number, kind: string) {
  const { state, road } = ctx, rand = state.frnd, dist = road[i].s;
  const next = (state.lotNext ||= { '-1': 0, 1: 0 });
  const dueBy = (state.lotDue ||= { '-1': null, 1: null });
  const isBuilt = LOT_OUT_M[kind] !== undefined;
  for (const side of [-1, 1]) {
    if (!dueBy[side]) {
      if (dist < next[side]) continue;
      if (!isBuilt) {
        next[side] = dist;
        continue;
      }
      dueBy[side] = { s: dist, len: LOT_LEN_M[0] + rand() * (LOT_LEN_M[1] - LOT_LEN_M[0]), kind };
    }
    const due = dueBy[side]!, laidLen = layDueLot(ctx, i, side);
    if (laidLen === null) continue;
    // (no room: it is due again a point on - tried once the dressing reaches its new last point)
    if (!laidLen && isBuilt) {
      dueBy[side] = { ...due, s: due.s + STEP };
      continue;
    }
    dueBy[side] = null;
    next[side] = laidLen ? due.s + laidLen + LOT_GAP_M[0] + rand() * (LOT_GAP_M[1] - LOT_GAP_M[0])
      : dist;
  }
}

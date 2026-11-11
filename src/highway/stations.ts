// highway/stations.ts - PETROL STATIONS ON THE OTHER ROADS (?hwstations=1; owner 11-10: "petrol
// stations on other highway levels (also reset spots)", services with their own slip road on the
// motorways "yeah", the names "perfect"). On a road with lay-bys (the dual carriageway on our
// side, the single lane either side; not Deaf Valley, which has its own) now and then a lay-by is
// a ROADSIDE STATION (highway/laybys.ts): deeper, on concrete - its forecourt, two pumps under a
// canopy in its brand's colours, the shop behind, its board before it; a reset there is a reset
// in a lay-by. On a road with a hard shoulder (the motorway, the interstate) and the walled road a
// SERVICES every SERVICES_EVERY m (highway/extras.ts): the side road (highway/cuts.ts sideStep)
// signed with its name, and part way along its run a station and the services hall off its far
// edge. The guard (highway.ts) counts both as road.
import { SURFACES } from '../world/surfaces.ts';
import { BRANDS, SERVICE_NAMES } from '../world/stationbrands.ts';
import type { Brand } from '../world/stationbrands.ts';
import { keepOut } from './cuts.ts';
import { STEP } from './presets.ts';
import type { DressCtx, HwLevel, HwPose } from './hwtypes.ts';
import type { Point, Prop } from '../world/types.ts';

// m from the road edge to a station prop's middle (the shop and pumps are laid round it: world/
// desertjunk.ts, as LAST GASP's); m before the station's lay-by its board stands
const STATION_OUT_M = 10, BOARD_BEFORE_M = 8;
// m from a station's middle to its shop's, away from the road (world/desertjunk.ts GAS_SHOP)
const SHOP_M = 13;
// (the services) m along the side road's run its station's middle is; its forecourt's road
// points behind and ahead of that (the near edge; the far edge a few in from each end), its depth
// off the side road's edge, m; the hall's points ahead and m out
const SERVICES_AT_M = 60, YARD_BACK = 7, YARD_AHEAD = 22, YARD_TAPER = 3, YARD_DEEP_M = 32;
const HALL_AHEAD = 13, HALL_OUT_M = 22;
// the side road's half width, m (highway/cuts.ts SLIP_W / 2)
const SIDE_HALF_M = 2.5;

/**
 * A fraction 0..1 fixed by a number and the road's seed (the same every build).
 * @param value the number (a road distance)
 * @param seed the road's seed
 * @returns 0..1
 */
export const hash01 = (value: number, seed: number) =>
  Math.abs(Math.sin(value * 12.9898 + seed * 78.233) * 43758.5453) % 1;

/**
 * The brand of a station at a road distance.
 * @param dist its road distance, m
 * @param seed the road's seed
 * @returns the brand
 */
export const brandAt = (dist: number, seed: number): Brand =>
  BRANDS[Math.floor(hash01(dist + 7.7, seed) * BRANDS.length) % BRANDS.length];

/**
 * The station's shop, pumps and canopy round its middle, facing the road; the shop kept clear of
 * the scenery.
 * @param level the highway level
 * @param pose the station's middle
 * @param shop where its shop stands (13 m further from the road: world/desertjunk.ts GAS_SHOP)
 * @param side -1 / +1
 * @param brand its brand
 * @param dist its road distance, m
 */
function stationProps(level: HwLevel, pose: HwPose, shop: HwPose, side: number, brand: Brand,
  dist: number) {
  const rot = pose.rot + (side < 0 ? Math.PI : 0);
  level.props.push({ kind: 'gasstation', x: pose.x, y: pose.y, rot, brand: brand.name,
    _s: dist } as Prop, { kind: 'canopy', x: pose.x, y: pose.y, rot, brand: brand.name,
    _s: dist } as Prop);
  keepOut(level, { x: shop.x, y: shop.y, ax: Math.cos(pose.rot), ay: Math.sin(pose.rot), hu: 9,
    hv: 5.5 }, dist);
}

/**
 * A ROADSIDE STATION in its lay-by (highway/laybys.ts): the props at its middle point, the board
 * before it.
 * @param ctx the dress context
 * @param i the road point at its middle
 * @param side -1 / +1
 * @param half m from its middle to either end of its lay-by
 */
export function layStation(ctx: DressCtx, i: number, side: number, half: number) {
  const { level, road, halfWidth, pointAt } = ctx, dist = road[i].s;
  const brand = brandAt(dist, level._hw.seed);
  stationProps(level, pointAt(i, side * (halfWidth + STATION_OUT_M)),
    pointAt(i, side * (halfWidth + STATION_OUT_M + SHOP_M)), side, brand, dist);
  // (before it as you come up the road, either side)
  const boardIdx = i - Math.round((half + BOARD_BEFORE_M) / STEP);
  if (boardIdx < 0 || boardIdx >= road.length) return;
  const board = pointAt(boardIdx, side * (halfWidth + 3.5));
  level.props.push({ kind: 'board', x: board.x, y: board.y, rot: board.rot, label: brand.name,
    _s: dist } as Prop);
}

/** A services on the side road: its name and brand, and whether its station is laid yet. */
export interface Services { name: string; brand: string; laid: boolean }

/**
 * A new services' name and brand (the names in turn, the brand by the road distance).
 * @param count how many services the road has had
 * @param dist its road distance, m
 * @param seed the road's seed
 * @returns the services
 */
export function newServices(count: number, dist: number, seed: number): Services {
  return { name: SERVICE_NAMES[count % SERVICE_NAMES.length], brand: brandAt(dist, seed).name,
    laid: false };
}

/**
 * The m past the side road's far edge a services' ground reaches at a point of its run (the
 * walled road's wall goes round it; the guard counts it as road), 0 outside it.
 * @param along m along the side road from where it leaves the road
 * @param out the side road's lead-out, m (highway/cuts.ts SIDE_OUT)
 * @returns m
 */
export function servicesOut(along: number, out: number): number {
  const from = out + SERVICES_AT_M - YARD_BACK * STEP, till = out + SERVICES_AT_M
    + (YARD_AHEAD + 4) * STEP;
  return along >= from && along <= till ? YARD_DEEP_M + 2 : 0;
}

/**
 * Whether a services' station is due at a point of the side road's run.
 * @param services the services (null: an ordinary side road)
 * @param along m along the side road
 * @param out the side road's lead-out, m
 * @returns due
 */
export const servicesDue = (services: Services | null | undefined, along: number, out: number) =>
  !!services && !services.laid && along >= out + SERVICES_AT_M;

/**
 * A SERVICES' yard off the side road's far edge at road point i: the concrete forecourt and car
 * park, the station on it, the services hall further along, its brand's board, the scenery kept
 * off the lot.
 * @param level the highway level
 * @param i the road point
 * @param sideOff the side road's centre's offset to the left, m
 * @param pointAt road point at (index, offset)
 * @param services the services
 */
export function layServices(level: HwLevel, i: number, sideOff: number,
  pointAt: (i: number, off: number) => HwPose, services: Services) {
  services.laid = true;
  const road = level._hw.pts, last = road.length - 1, dist = road[i].s;
  const edge = sideOff + SIDE_HALF_M, poly: Point[] = [];
  for (let j = Math.max(0, i - YARD_BACK); j <= Math.min(last, i + YARD_AHEAD); j++) {
    const pos = pointAt(j, -(edge - 0.3));
    poly.push([pos.x, pos.y]);
  }
  for (let j = Math.min(last, i + YARD_AHEAD - YARD_TAPER);
    j >= Math.max(0, i - YARD_BACK + YARD_TAPER); j--) {
    const pos = pointAt(j, -(edge + YARD_DEEP_M));
    poly.push([pos.x, pos.y]);
  }
  const allX = poly.map(([x]) => x), allY = poly.map(([, y]) => y), minX = Math.min(...allX),
    maxX = Math.max(...allX), minY = Math.min(...allY), maxY = Math.max(...allY);
  level.zones.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY,
    poly, surface: SURFACES.concrete, art: null, boxed: true, _s: dist });
  for (let j = Math.max(0, i - YARD_BACK); j <= Math.min(last, i + YARD_AHEAD); j += 3) {
    const pos = pointAt(j, -(edge + YARD_DEEP_M / 2));
    keepOut(level, { x: pos.x, y: pos.y, ax: Math.cos(pos.rot), ay: Math.sin(pos.rot),
      hu: STEP * 1.6, hv: YARD_DEEP_M / 2 + 1 }, road[j].s);
  }
  const brand = BRANDS.find((each) => each.name === services.brand) ?? BRANDS[0];
  stationProps(level, pointAt(i, -(edge + STATION_OUT_M)), pointAt(i, -(edge + STATION_OUT_M
    + SHOP_M)), -1, brand, dist);
  const hallIdx = Math.min(last, i + HALL_AHEAD), hall = pointAt(hallIdx, -(edge + HALL_OUT_M));
  level.props.push({ kind: 'services', x: hall.x, y: hall.y, rot: hall.rot + Math.PI,
    label: services.name, brand: brand.name, _s: dist } as Prop);
  const boardIdx = Math.max(0, i - YARD_BACK - 2), board = pointAt(boardIdx, -(edge + 3));
  level.props.push({ kind: 'board', x: board.x, y: board.y, rot: board.rot, label: brand.name,
    _s: dist } as Prop);
}

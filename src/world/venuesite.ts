// world/venuesite.ts - what a venue's scenery builders share (world/venuescenery.ts and
// venueroads.ts):
// the site state (the roads, rims, placer, dice, lanes, buildings, the Armco's cells) and the
// questions they all ask of it - near a race road, on a lane, in a building, near the Armco.
import { HALF_ROAD, centreAt, distToLine, isNearLine, nearestLoop, roadDistance }
  from "./venuegeo.ts";
import { pastRim } from "./venueedge.ts";
import { insidePolygon } from "./zones.ts";
import { gridKey } from "../core/pointgrid.ts";
import type { Rim } from "./venueedge.ts";
import type { VenueBuild } from "./venue.ts";
import type { Lane, Point, Prop, Subtrack } from "./types.ts";

// m (game) from a venue road beyond which nothing of the map is taken: the venue's reach
export const REACH_M = 130;

/** What every builder here shares. */
export interface Site {
  build: VenueBuild; loops: Subtrack[]; rims: Rim[]; place: (pt: Point) => Point;
  rnd: () => number; lanes: Lane[]; buildings: Prop[];
  portals: Prop[];   // the tunnels' portals (laid before the roads, which keep off them)
  armco: Set<string>;   // the 2 m cells the Armco runs through (roads keep out of them)
  pitPts: Point[][];   // the pit lanes' lines (trucks and cars keep off their aprons)
}

export const placeAll = (site: Site, pts: Point[]): Point[] => pts.map(site.place);

export const nearRace = (site: Site, x: number, y: number, pad: number) =>
  roadDistance(site.loops, x, y) < HALF_ROAD + pad;

export const onLanes = (lanes: Lane[], x: number, y: number, pad: number) =>
  lanes.some((lane) => isNearLine(lane.pts, x, y, lane.width / 2 + pad));

/** A garage row's outline (front, then back reversed) and its bounding box. */
interface RowOutline { outline: Point[]; minX: number; minY: number; maxX: number; maxY: number }
const ROW_OUTLINES = new WeakMap<Prop, RowOutline>();

/**
 * A garage row's outline, built once per row (inBuilding is asked it thousands of times a build).
 * @param prop the garage row (front and back)
 * @returns its outline and box
 */
function rowOutline(prop: Prop): RowOutline {
  const cached = ROW_OUTLINES.get(prop);
  if (cached) return cached;
  const outline = [...prop.front!, ...prop.back!.slice().reverse()];
  const allX = outline.map(([x]) => x), allY = outline.map(([, y]) => y);
  const row = { outline, minX: Math.min(...allX), minY: Math.min(...allY), maxX: Math.max(...allX),
    maxY: Math.max(...allY) };
  ROW_OUTLINES.set(prop, row);
  return row;
}

/**
 * Whether a point lies within pad of a building's turned box.
 * @param buildings the building props
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when in or that near one
 */
export function inBuilding(buildings: Prop[], x: number, y: number, pad: number): boolean {
  // (a box building is within pad only inside its circle grown by pad x sqrt 2: so near its box)
  const reach = Math.max(0, pad) * BOX_PAD_SHARE;
  const fromX = Math.floor((x - reach) / BUILDING_CELL_M);
  const toX = Math.floor((x + reach) / BUILDING_CELL_M);
  const fromY = Math.floor((y - reach) / BUILDING_CELL_M);
  const toY = Math.floor((y + reach) / BUILDING_CELL_M);
  // (one building asked about - a list made for the one question - by its own cells:
  // what its grid would answer, without filing it; MEASURED, Sillystone's buildings asked one at a
  // time against each other built a grid per question, ~0.15 s)
  if (buildings.length === 1) {
    const box = buildingBox(buildings[0]);
    const cell = (value: number) => Math.floor(value / BUILDING_CELL_M);
    return !!box && cell(box[0]) <= toX && cell(box[2]) >= fromX && cell(box[1]) <= toY
      && cell(box[3]) >= fromY && isInOne(buildings[0], x, y, pad);
  }
  const grid = buildingGrid(buildings);
  for (let cellX = fromX; cellX <= toX; cellX++) {
    for (let cellY = fromY; cellY <= toY; cellY++) {
      const cell = grid.cells.get(gridKey(cellX, cellY));
      if (cell && cell.some((prop) => isInOne(prop, x, y, pad))) return true;
    }
  }
  return false;
}

// m the building grid's cells; the share of pad a query reaches out (over sqrt 2: a turned box)
const BUILDING_CELL_M = 16, BOX_PAD_SHARE = 1.5;
/** The buildings filed by the cells their boxes cover (rebuilt if the list's length changed). */
interface BuildingGrid { cells: Map<number, Prop[]>; length: number }
const BUILDING_GRIDS = new WeakMap<Prop[], BuildingGrid>();

/**
 * A building list's grid: each building in every cell its box (a garage row's outline's, a box
 * building's circle's) covers; a building with no size in none (it is never hit).
 * @param buildings the building props
 * @returns the grid
 */
function buildingGrid(buildings: Prop[]): BuildingGrid {
  const cached = BUILDING_GRIDS.get(buildings);
  if (cached && cached.length === buildings.length) return cached;
  const cells = new Map<number, Prop[]>();
  for (const prop of buildings) {
    const box = buildingBox(prop);
    if (!box) continue;
    for (let cellX = Math.floor(box[0] / BUILDING_CELL_M);
      cellX <= Math.floor(box[2] / BUILDING_CELL_M); cellX++) {
      for (let cellY = Math.floor(box[1] / BUILDING_CELL_M);
        cellY <= Math.floor(box[3] / BUILDING_CELL_M); cellY++) {
        const key = gridKey(cellX, cellY), cell = cells.get(key);
        if (cell) cell.push(prop);
        else cells.set(key, [prop]);
      }
    }
  }
  const grid = { cells, length: buildings.length };
  BUILDING_GRIDS.set(buildings, grid);
  return grid;
}

/**
 * A building's box (minX, minY, maxX, maxY): a garage row's outline's; a box building's circle's.
 * @param prop the building
 * @returns its box, or null with no size
 */
function buildingBox(prop: Prop): [number, number, number, number] | null {
  if (prop.front && prop.back) {
    const row = rowOutline(prop);
    return [row.minX, row.minY, row.maxX, row.maxY];
  }
  if (!prop.w || !prop.h) return null;
  const radius = Math.hypot(prop.w, prop.h) / 2;
  return [prop.x - radius, prop.y - radius, prop.x + radius, prop.y + radius];
}

/**
 * Whether a point lies within pad of one building.
 * @param prop the building
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when in or that near it
 */
function isInOne(prop: Prop, x: number, y: number, pad: number): boolean {
  // the garage row: its outline (front and back)
  if (prop.front && prop.back) {
    const row = rowOutline(prop);
    // (beyond its box by more than pad: neither inside it nor within pad of its sides)
    if (x < row.minX - pad || x > row.maxX + pad || y < row.minY - pad || y > row.maxY + pad)
      return false;
    return insidePolygon(row.outline, x, y) || distToLine(prop.front, x, y) < pad
      || distToLine(prop.back, x, y) < pad;
  }
  if (!prop.w || !prop.h) return false;
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  const along = (x - prop.x) * cosR + (y - prop.y) * sinR;
  const across = -(x - prop.x) * sinR + (y - prop.y) * cosR;
  return Math.abs(along) <= prop.w / 2 + pad && Math.abs(across) <= prop.h / 2 + pad;
}

/**
 * Whether a point lies within pad of a building or a tunnel's portal: what roads, parked cars and
 * posts keep off.
 * @param site the venue's builders' state
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when in or that near one
 */
export const inSolid = (site: Site, x: number, y: number, pad: number): boolean =>
  inBuilding(site.buildings, x, y, pad) || inBuilding(site.portals, x, y, pad);

// m: the side of the cells the Armco is indexed by
export const ARMCO_CELL_M = 2;

export const cellKey = (x: number, y: number) =>
  `${Math.floor(x / ARMCO_CELL_M)},${Math.floor(y / ARMCO_CELL_M)}`;

/**
 * Whether an Armco run passes within about pad of a point (by its 2 m cells).
 * @param site the venue's builders' state
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when one is that near
 */
export function nearArmco(site: Site, x: number, y: number, pad: number): boolean {
  const reach = Math.ceil(pad / ARMCO_CELL_M);
  const cellX = Math.floor(x / ARMCO_CELL_M), cellY = Math.floor(y / ARMCO_CELL_M);
  for (let stepX = -reach; stepX <= reach; stepX++)
    for (let stepY = -reach; stepY <= reach; stepY++)
      if (site.armco.has(`${cellX + stepX},${cellY + stepY}`)) return true;
  return false;
}

/**
 * A point outside the edge but within need of it moved straight out until it is need outside;
 * a point more than limit inside the edge (across the run-off or the track) stays where it is.
 * @param site the venue's builders' state
 * @param point the point
 * @param need metres outside the edge it should stand
 * @param limit metres inside the edge beyond which it is not moved
 * @returns the point
 */
export function stepOut(site: Site, point: Point, need: number, limit: number): Point {
  const past = pastRim(site.rims, point[0], point[1]);
  if (!Number.isFinite(past) || past >= need || past < -limit) return point;
  const { sub, hit } = nearestLoop(site.loops, point[0], point[1]);
  const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
  const step = need - past;
  return [point[0] + centre.nx * side * step, point[1] + centre.ny * side * step];
}

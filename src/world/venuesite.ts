// world/venuesite.ts - what a venue's scenery builders share (world/venuescenery.ts and
// venueroads.ts):
// the site state (the roads, rims, placer, dice, lanes, buildings, the Armco's cells) and the
// questions they all ask of it - near a race road, on a lane, in a building, near the Armco.
import { HALF_ROAD, centreAt, distToLine, nearestLoop, roadDistance } from "./venuegeo.ts";
import { pastRim } from "./venueedge.ts";
import { insidePolygon } from "./zones.ts";
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
  pitPts: Point[];   // the pit lane's line (trucks and cars keep off its apron)
}

export const placeAll = (site: Site, pts: Point[]): Point[] => pts.map(site.place);

export const nearRace = (site: Site, x: number, y: number, pad: number) =>
  roadDistance(site.loops, x, y) < HALF_ROAD + pad;

export const onLanes = (lanes: Lane[], x: number, y: number, pad: number) =>
  lanes.some((lane) => distToLine(lane.pts, x, y) < lane.width / 2 + pad);

/**
 * Whether a point lies within pad of a building's turned box.
 * @param buildings the building props
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when in or that near one
 */
export function inBuilding(buildings: Prop[], x: number, y: number, pad: number): boolean {
  return buildings.some((prop) => {
    // the garage row: its outline (front and back)
    if (prop.front && prop.back) {
      const outline = [...prop.front, ...prop.back.slice().reverse()];
      return insidePolygon(outline, x, y) || distToLine(prop.front, x, y) < pad
        || distToLine(prop.back, x, y) < pad;
    }
    if (!prop.w || !prop.h) return false;
    const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
    const along = (x - prop.x) * cosR + (y - prop.y) * sinR;
    const across = -(x - prop.x) * sinR + (y - prop.y) * cosR;
    return Math.abs(along) <= prop.w / 2 + pad && Math.abs(across) <= prop.h / 2 + pad;
  });
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

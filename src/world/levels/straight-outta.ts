// STRAIGHT OUTTA SWINDON - the new highway, step 1 (requirement: a new highway built from the
// ground up, phone-tested at every step). The old endless highway hitches about every 140-170 m of
// new road on the phone (?report=1), and its streaming does everything at once (road, fields,
// armco, trees, extras, traffic), so the cause cannot be pulled apart. This level is the bare
// minimum: ONE straight road on grass, built once at load, nothing streamed. Contents: a
// STRAIGHT_KM straight, two lanes' width, grass either side with the usual surface inclusions,
// the terrain's own gentle noise; the floor is a strip VERGE_M round the road. Intended failure:
// none - it is a measuring stick. If it hitches every ~150 m too, the cause is in driving into new
// ground (renderer or Safari); if not, it is in the old highway's generation, and step 2 adds
// streaming back piece by piece.
import { SURFACES } from "../surfaces.ts";
import { createSubtrack, ghostSegment } from "../subtrack.ts";
import type { Level, Point } from "../types.ts";

const STRAIGHT_KM = 30;          // km of road (13 min at 140 km/h)
const POINT_SPACING_M = 10;      // m between centreline points
const ROAD_WIDTH_M = 12;         // two motorway lanes and a margin
// m of grass either side of the road and past each end: the floor is a STRIP along the road (as a
// square, 62 km a side, it held ~1e8 scan cells of surface inclusions)
const VERGE_M = 200;

/**
 * The straight centreline: from the origin due east, one point every POINT_SPACING_M.
 * @returns the points
 */
function straightPoints(): Point[] {
  const count = Math.round((STRAIGHT_KM * 1000) / POINT_SPACING_M) + 1;
  const points: Point[] = [];
  for (let i = 0; i < count; i++) points.push([i * POINT_SPACING_M, 0]);
  return points;
}

/**
 * The road: the straight as a point-to-point track, its closing segment (end back to start) a
 * ghost, never drawn or driven (as a rally stage's).
 * @returns the subtrack
 */
function straightRoad() {
  const points = straightPoints();
  return ghostSegment(createSubtrack(points, ROAD_WIDTH_M, [], [], true), points.length - 1);
}

export const STRAIGHT_OUTTA_LEVEL: Level = {
  id: 'straight-outta',
  name: 'Straight Outta Swindon',
  base: SURFACES.grass,
  floor: STRAIGHT_KM * 1000 + VERGE_M,
  bounds: { x0: -VERGE_M, x1: STRAIGHT_KM * 1000 + VERGE_M, y0: -VERGE_M, y1: VERGE_M },
  subtrack: straightRoad(),
  zones: [],
  bumps: [],
  covers: [],
  paint: [],
  boards: [],
  props: [],
  seams: false,
  cones: [],
  spawn: { x: 60, y: -2, heading: 0 },
};

// world/venuetyres.ts - A VENUE'S MAPPED TYRE WALLS (data.tyres: the map's barrier=tyres lines),
// spaced along each line, none on a road - nor where the edge already stands its two rows along it
// (laid again, the wall stood three deep at Dongington).
// TIDIED (VenueSpec.tidyTyres; Pembreezy's, where the map draws tyre walls round both the circuit
// and the rallycross): a wall that stands well away from every road the level races is left out
// (it guards a road the level does not have - the rallycross section's wall on the circuit, the
// circuit's Speedway and Brooklands walls on the rallycross); a wall the edge's rows already stand
// along is left out where it runs within MAP_WALL_NEAR_M of them, not only on them (its fringe
// beside them read as a second, jagged wall); and what is left of a wall in runs shorter than
// MIN_RUN_REAL_M (a lone tyre, a stub cut off by a road or the edge's rows) is left out.
// MEASURED (tools/scratch/_tyrechains.mjs, TODO 3b PEMBREEZY): circuit 1366 -> 1231 stacks, the RX
// 2746 -> 1336.
import { isAnyPointWithin, makePointGrid } from "../core/pointgrid.ts";
import type { PointGrid } from "../core/pointgrid.ts";
import { HALF_ROAD, evenly } from "./venuegeo.ts";
import { onLanes, placeAll } from "./venuesite.ts";
import type { Site } from "./venuesite.ts";
import type { Cone, Point } from "./types.ts";

// m between a mapped wall's stacks (a stack's width: touching)
const STACK_EVERY_M = 1;
// m within which a mapped tyre wall's stack stands on the edge's own rows (a stack's width)
const MAP_WALL_CLEAR_M = 1;
// tidied: m from the edge's rows within which a mapped wall is the same wall (the edge lays its
// two rows 1-2.5 m off the mapped line where the rim bends away from it)
const MAP_WALL_NEAR_M = 3;
// tidied: real m past the raced roads' edges the most of a wall may stand and still guard them
// (Pembreezy: the walls round its raced roads a median 4-32 m out, the others 44-121 m)
const GUARD_REAL_M = 40;
// m: the raced roads' grid cell (about the guard's reach)
const GUARD_CELL_M = 16;
// tidied: real m the shortest run of a wall kept (Pembreezy: the stubs 1-13 stacks)
const MIN_RUN_REAL_M = 20;

/**
 * Whether a wall guards a raced road: the most of its stacks within GUARD_REAL_M of one's edge.
 * @param pts the wall's stacks
 * @param raced the raced roads' centrelines (a point grid)
 * @param scale the venue's scale (game m a real m)
 * @returns it guards one
 */
function guardsRacedRoad(pts: Point[], raced: PointGrid, scale: number) {
  const reach = HALF_ROAD + GUARD_REAL_M * scale;
  const near = pts.filter(([x, y]) => isAnyPointWithin(raced, x, y, reach)).length;
  return near * 2 > pts.length;
}

/**
 * The runs of consecutive kept points along a line, each at least the shortest run long.
 * @param pts the line's points, STACK_EVERY_M apart
 * @param kept whether each is kept
 * @param fewest the fewest points a run keeps
 * @returns the points of the runs kept
 */
function longRuns(pts: Point[], kept: boolean[], fewest: number): Point[] {
  const out: Point[] = [];
  let run: Point[] = [];
  for (let i = 0; i <= pts.length; i++) {
    if (i < pts.length && kept[i]) {
      run.push(pts[i]);
      continue;
    }
    if (run.length >= fewest) out.push(...run);
    run = [];
  }
  return out;
}

/**
 * One mapped wall's stacks: none on a lane or on the edge's rows; tidied, none of a wall that
 * guards no raced road, none near the edge's rows, no short runs.
 * @param site the venue's builders' state
 * @param line the wall's line, real m
 * @param grids the edge's tyre stacks; tidied, the raced roads' centrelines (else null)
 * @returns the stacks' spots
 */
function wallSpots(site: Site, line: Point[], grids: { edgeTyres: PointGrid;
  raced: PointGrid | null }): Point[] {
  const { edgeTyres, raced } = grids;
  const pts = evenly(placeAll(site, line), STACK_EVERY_M), scale = site.build.scale;
  const offLanes = pts.map(([x, y]) => !onLanes(site.lanes, x, y, 0.6));
  if (!raced) return pts.filter(([x, y], i) => offLanes[i]
    && !isAnyPointWithin(edgeTyres, x, y, MAP_WALL_CLEAR_M));
  if (!guardsRacedRoad(pts, raced, scale)) return [];
  const kept = pts.map(([x, y], i) => offLanes[i]
    && !isAnyPointWithin(edgeTyres, x, y, MAP_WALL_NEAR_M));
  return longRuns(pts, kept, Math.ceil(MIN_RUN_REAL_M * scale / STACK_EVERY_M));
}

/**
 * The venue's mapped tyre walls as tyre stacks.
 * @param site the venue's builders' state
 * @param edgeCones the edge's own tyres (its rows in front of the Armco and along the walls)
 * @returns the stacks
 */
export function mappedTyreWalls(site: Site, edgeCones: Cone[]): Cone[] {
  const spec = site.build.spec;
  const edgeTyres = makePointGrid(edgeCones.map((tyre): Point => [tyre.x, tyre.y]));
  const raced = spec.tidyTyres ? makePointGrid(site.loops.flatMap((loop) => loop.pts.map(
    (point): Point => [point.x, point.y])), GUARD_CELL_M) : null;
  return spec.data.tyres.flatMap((wall) => wallSpots(site, wall.pts, { edgeTyres, raced }))
    .map(([x, y]) => ({ x, y, kind: 'tyrestack' }));
}

// lanereach.ts - THE LANE REACH GRID: onLane asked of a grid of each lane's segments
// instead of a walk of every segment of every lane, every car, every step. Each segment is filed
// in every cell its box, grown by the lane's reach (half width + 1 m) and a small slack, touches;
// a point meets the segments of its cell with the very test the walk uses, so the answer is the
// same (a segment the point is within reach of always lies in the point's cell). Built per lane
// the first time it is asked; rebuilt if the lane's points or width change.
import { cellKey } from '../core/cellgrid.ts';
import type { CellGrid } from '../core/cellgrid.ts';
import type { Lane } from '../world/types.ts';

// cell size, m: about a car-length-and-a-half; a cell meets 1-3 segments of a lane
const REACH_CELL_M = 16;
// slack past the reach, m: covers the rounding of the nearest point (1e-12 m), never decides
const REACH_SLACK_M = 0.01;

interface ReachGrid { pts: Lane['pts']; count: number; width: number; cells: CellGrid<number> }
const REACH_GRIDS = new WeakMap<Lane, ReachGrid>();

/**
 * Files a lane's segments by cell.
 * @param lane the lane
 * @returns its grid
 */
function buildReachGrid(lane: Lane): ReachGrid {
  const pts = lane.pts, pad = lane.width / 2 + 1 + REACH_SLACK_M;
  const cells: CellGrid<number> = new Map();
  for (let i = 0; i < pts.length - 1; i++) {
    const [startX, startY] = pts[i], [endX, endY] = pts[i + 1];
    const lowX = Math.floor((Math.min(startX, endX) - pad) / REACH_CELL_M),
      highX = Math.floor((Math.max(startX, endX) + pad) / REACH_CELL_M),
      lowY = Math.floor((Math.min(startY, endY) - pad) / REACH_CELL_M),
      highY = Math.floor((Math.max(startY, endY) + pad) / REACH_CELL_M);
    for (let cellX = lowX; cellX <= highX; cellX++) {
      for (let cellY = lowY; cellY <= highY; cellY++) {
        const key = cellKey(cellX, cellY), cell = cells.get(key);
        if (cell) cell.push(i);
        else cells.set(key, [i]);
      }
    }
  }
  return { pts, count: pts.length, width: lane.width, cells };
}

/**
 * A lane's grid, built or rebuilt as needed.
 * @param lane the lane
 * @returns its grid
 */
function reachGrid(lane: Lane): ReachGrid {
  const known = REACH_GRIDS.get(lane);
  if (known && known.pts === lane.pts && known.count === lane.pts.length
    && known.width === lane.width) return known;
  const grid = buildReachGrid(lane);
  REACH_GRIDS.set(lane, grid);
  return grid;
}

/**
 * Whether a point is within reach (half width + 1 m) of any lane: the same answer as the walk.
 * @param lanes the level's lanes
 * @param x world x, m
 * @param y world y, m
 * @returns true when on a lane
 */
export function onLaneGrid(lanes: Lane[], x: number, y: number): boolean {
  const key = cellKey(Math.floor(x / REACH_CELL_M), Math.floor(y / REACH_CELL_M));
  for (const lane of lanes) {
    const near = reachGrid(lane).cells.get(key);
    if (!near) continue;
    const pts = lane.pts, reach2 = (lane.width / 2 + 1) ** 2;
    for (const i of near) {
      const [startX, startY] = pts[i], [endX, endY] = pts[i + 1], vx = endX - startX,
        vy = endY - startY, len2 = vx * vx + vy * vy || 1;
      const frac = Math.max(0, Math.min(1, ((x - startX) * vx + (y - startY) * vy) / len2)),
        missX = startX + vx * frac - x, missY = startY + vy * frac - y;
      if (missX * missX + missY * missY < reach2) return true;
    }
  }
  return false;
}

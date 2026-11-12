// core/pointgrid.ts - A UNIFORM GRID OF POINTS for the level builders' "is any point near here"
// questions: a point filed by its cell, a query reading only the cells within reach - not every
// point (a venue asked every tree against every barrier point: Spa's 8000 props x 20000 points).
// Exact: it answers what testing every point would.
import type { Point } from '../world/types.ts';

/** Points filed by their grid cell. */
export interface PointGrid { cellM: number; cells: Map<number, Point[]> }

// cells a row of the key holds (2^20: a world ±500 km at 1 m cells)
const KEY_ROW = 1 << 20;
// m a builder's grid cell by default (about the reach its queries ask)
export const BUILD_CELL_M = 4;
/** A grid cell's key, from its column and row. */
export const gridKey = (cellX: number, cellY: number): number => cellX * KEY_ROW + cellY;

/**
 * Files the points into a grid.
 * @param points the points
 * @param cellM the cell's side, m (about the reach most queries ask)
 * @returns the grid
 */
export function makePointGrid(points: Point[], cellM = BUILD_CELL_M): PointGrid {
  const cells = new Map<number, Point[]>();
  for (const point of points) {
    const key = gridKey(Math.floor(point[0] / cellM), Math.floor(point[1] / cellM));
    const cell = cells.get(key);
    if (cell) cell.push(point);
    else cells.set(key, [point]);
  }
  return { cellM, cells };
}

/**
 * Whether any filed point within reach (on each axis) of x, y passes a test.
 * @param grid the grid
 * @param x world x
 * @param y world y
 * @param reach m either way on each axis the points are looked for
 * @param test the test (true: found)
 * @returns true when one passes
 */
export function isAnyPointNear(grid: PointGrid, x: number, y: number, reach: number,
  test: (point: Point) => boolean): boolean {
  const { cellM, cells } = grid;
  const fromX = Math.floor((x - reach) / cellM), toX = Math.floor((x + reach) / cellM);
  const fromY = Math.floor((y - reach) / cellM), toY = Math.floor((y + reach) / cellM);
  for (let cellX = fromX; cellX <= toX; cellX++) {
    for (let cellY = fromY; cellY <= toY; cellY++) {
      const cell = cells.get(gridKey(cellX, cellY));
      if (cell && cell.some(test)) return true;
    }
  }
  return false;
}

/**
 * Whether any filed point lies in the axis box of half-side reach round x, y.
 * @param grid the grid
 * @param x world x
 * @param y world y
 * @param reach m, the box's half-side
 * @returns true when one does
 */
export const isAnyPointInBox = (grid: PointGrid, x: number, y: number, reach: number): boolean =>
  isAnyPointNear(grid, x, y, reach, ([pointX, pointY]) =>
    Math.abs(pointX - x) <= reach && Math.abs(pointY - y) <= reach);

/**
 * Whether any filed point lies within reach of x, y.
 * @param grid the grid
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns true when one does
 */
export const isAnyPointWithin = (grid: PointGrid, x: number, y: number, reach: number): boolean =>
  isAnyPointNear(grid, x, y, reach, ([pointX, pointY]) =>
    Math.hypot(pointX - x, pointY - y) <= reach);

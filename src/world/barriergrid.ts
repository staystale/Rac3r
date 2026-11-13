// barriergrid.ts - THE BARRIER SEGMENT GRID (FIX.perfpass): which barriers of a list, and which
// segments of a barrier, a car in a cell can touch, so clampToBarriers (world/barriers.ts) tests
// those instead of every barrier and every segment of each. A segment is filed in every cell its
// box (already SEG_BOX_PAD past its ends), grown by GRID_REACH_M, touches; a barrier in every cell
// one of its segments is in. Both lists are kept in order (barrier indices, segment indices), so
// the same segments clamp in the same order. A car longer than the reach is not served (the walk).
// A barrier's segment cells are built again when its segments are (a dent, a tear, a restart:
// keyed on the segment list); a dented barrier is filed into any new cells its rail reaches at
// once (refileBarrier); a list is filed again when it changes length or a new barrier is built.
import { cellKey } from '../core/cellgrid.ts';
import type { CellGrid } from '../core/cellgrid.ts';
import type { Barrier, BarrierSeg } from './types.ts';

// cell size, m: a car-length and a half; a cell meets a few segments of the barriers near it
const BARRIER_CELL_M = 16;
// m: how far past a segment's box a car's centre may be and still be tested (the walk's reach is
// the car's length: 5.1 m the longest car); the slack covers rounding, never decides
export const GRID_REACH_M = 8;
const GRID_SLACK_M = 0.01;
const NONE: number[] = [];

interface ListGrid { length: number; builds: number; first: Barrier; cells: CellGrid<number> }
const LIST_GRIDS = new WeakMap<Barrier[], ListGrid>();
const SEG_GRIDS = new WeakMap<BarrierSeg[], CellGrid<number>>();
// the list grid a barrier is filed in, and its index there (for refileBarrier)
const FILED_IN = new WeakMap<Barrier, { grid: ListGrid; index: number }>();
// barriers whose segments were built for the first time (a list holding one is filed again)
let firstBuilds = 0;

/** A barrier's segments were built for the first time: lists are filed again when next asked. */
export function noteBarrierBuilt(): void {
  firstBuilds++;
}

/**
 * The cell a point is in.
 * @param x world x, m
 * @param y world y, m
 * @returns its key
 */
export function barrierCellOf(x: number, y: number): number {
  return cellKey(Math.floor(x / BARRIER_CELL_M), Math.floor(y / BARRIER_CELL_M));
}

/**
 * Calls back with every cell a segment's grown box touches.
 * @param seg the segment
 * @param visit called with each cell key
 */
function forSegCells(seg: BarrierSeg, visit: (key: number) => void): void {
  const pad = GRID_REACH_M + GRID_SLACK_M;
  const lowX = Math.floor((seg.minX - pad) / BARRIER_CELL_M),
    highX = Math.floor((seg.maxX + pad) / BARRIER_CELL_M),
    lowY = Math.floor((seg.minY - pad) / BARRIER_CELL_M),
    highY = Math.floor((seg.maxY + pad) / BARRIER_CELL_M);
  for (let cellX = lowX; cellX <= highX; cellX++)
    for (let cellY = lowY; cellY <= highY; cellY++) visit(cellKey(cellX, cellY));
}

/**
 * Files a barrier's index in every cell its segments reach that does not hold it yet, keeping
 * each cell's indices in order. Filing again replaces a cell's list rather than changing it, as
 * a clamp may be walking it.
 * @param cells the list's cells
 * @param barrier the barrier
 * @param index its index in the list
 * @param isBuilding true while the list is filed in order (its cells are appended to)
 */
function fileBarrier(cells: CellGrid<number>, barrier: Barrier, index: number,
    isBuilding: boolean): void {
  for (const seg of barrier._segs || []) forSegCells(seg, (key) => {
    const cell = cells.get(key);
    if (!cell) { cells.set(key, [index]); return; }
    if (cell[cell.length - 1] === index) return;
    if (isBuilding) { cell.push(index); return; }
    if (cell.includes(index)) return;
    let insertAt = cell.length;
    while (insertAt > 0 && cell[insertAt - 1] > index) insertAt--;
    cells.set(key, [...cell.slice(0, insertAt), index, ...cell.slice(insertAt)]);
  });
}

/**
 * A list's grid, filed again when the list changed.
 * @param list the barriers
 * @returns its grid
 */
function listGrid(list: Barrier[]): ListGrid {
  const known = LIST_GRIDS.get(list);
  if (known && known.length === list.length && known.builds === firstBuilds
    && known.first === list[0]) return known;
  const grid: ListGrid = { length: list.length, builds: firstBuilds, first: list[0],
    cells: new Map() };
  list.forEach((barrier, index) => {
    fileBarrier(grid.cells, barrier, index, true);
    FILED_IN.set(barrier, { grid, index });
  });
  LIST_GRIDS.set(list, grid);
  return grid;
}

/**
 * A barrier's segments were built again (a dent, a tear, a restart): it is filed into any new
 * cells they reach, so its list's cells still hold every barrier near them.
 * @param barrier the barrier
 */
export function refileBarrier(barrier: Barrier): void {
  const filed = FILED_IN.get(barrier);
  if (filed) fileBarrier(filed.grid.cells, barrier, filed.index, false);
}

/**
 * The barriers of a list with a segment within reach of a cell, by index in list order.
 * @param list the barriers
 * @param cell the cell's key
 * @returns their indices (shared: not to be changed)
 */
export function barriersNear(list: Barrier[], cell: number): number[] {
  return listGrid(list).cells.get(cell) || NONE;
}

/**
 * The segments of a barrier within reach of a cell, by index in order.
 * @param barrier the barrier (with _segs)
 * @param cell the cell's key
 * @returns their indices (shared: not to be changed)
 */
export function segsNear(barrier: Barrier, cell: number): number[] {
  const segs = barrier._segs!;
  let cells = SEG_GRIDS.get(segs);
  if (!cells) {
    const built: CellGrid<number> = new Map();
    segs.forEach((seg, index) => forSegCells(seg, (key) => {
      const filed = built.get(key);
      if (filed) filed.push(index);
      else built.set(key, [index]);
    }));
    SEG_GRIDS.set(segs, built);
    cells = built;
  }
  return cells.get(cell) || NONE;
}

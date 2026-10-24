// A UNIFORM GRID INDEX: items filed by square cell, each item in every cell its reach touches and
// kept in the list's order, so a lookup meets the items near a point in the same order as a walk
// of the whole list - the answers are identical, only quicker. Used by the cover index
// (world/covergrid.ts), the bump grid (world/terrain.ts) and the solid grid (world/solidgrid.ts).

// a cell key is (x cell * KEY_SPAN + y cell): unique while |y cell| < KEY_SPAN / 2 (16 m cells:
// 33 000 km either way)
const KEY_SPAN = 4194304;

/** A grid index: the items whose reach touches each cell, by cell key. */
export type CellGrid<T> = Map<number, T[]>;

/**
 * The key of a cell.
 * @param cellX the cell's column (floor of x / cell size)
 * @param cellY the cell's row
 * @returns the key
 */
export function cellKey(cellX: number, cellY: number): number {
  return cellX * KEY_SPAN + cellY;
}

/**
 * Files an item in every cell within its reach of a point (after the items filed before it).
 * @param grid the grid
 * @param item the item
 * @param x the item's centre, m
 * @param y the item's centre, m
 * @param reach how far from its centre it can be found, m
 * @param cellM the grid's cell size, m
 */
export function addToGrid<T>(grid: CellGrid<T>, item: T, x: number, y: number, reach: number,
    cellM: number): void {
  for (let cellX = Math.floor((x - reach) / cellM); cellX <= Math.floor((x + reach) / cellM);
    cellX++) {
    for (let cellY = Math.floor((y - reach) / cellM); cellY <= Math.floor((y + reach) / cellM);
      cellY++) {
      const key = cellKey(cellX, cellY), cell = grid.get(key);
      if (cell) cell.push(item);
      else grid.set(key, [item]);
    }
  }
}

/**
 * The items filed in the cell holding a point.
 * @param grid the grid
 * @param x world x, m
 * @param y world y, m
 * @param cellM the grid's cell size, m
 * @returns the cell's items in list order, or undefined for an empty cell
 */
export function cellAt<T>(grid: CellGrid<T>, x: number, y: number, cellM: number): T[] | undefined {
  return grid.get(cellKey(Math.floor(x / cellM), Math.floor(y / cellM)));
}

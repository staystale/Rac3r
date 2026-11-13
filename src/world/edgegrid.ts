// world/edgegrid.ts - THE EDGE BUILDER'S INDEXES (?fastbuild=1; world/venueedge.ts buildEdge): its
// two all-against-all questions asked of a uniform grid instead - is any point already standing
// this near (withoutDoubles), does an earlier rim sample face this one (dropFacing). MEASURED
// (node --cpu-prof, a cold build): the Nordschleife's 20 km rim spent ~0.9 s in them, every
// sample against every earlier one. Exact: the grid only skips points too far to pass, the same
// test decides.
import { gridKey } from "../core/pointgrid.ts";
import type { PointGrid } from "../core/pointgrid.ts";
import type { Point } from "./types.ts";

// m: the used points' grid cells (about withoutDoubles' gap)
const USED_CELL_M = 4;
// each growing list's grid and how many of its points are filed
const USED_GRIDS = new WeakMap<Point[], { grid: PointGrid; filed: number }>();

/**
 * The grid of a growing list of points (points are only ever added to its end): built on the
 * first ask, the points added since filed on each later one. Held only while the list is.
 * @param used the points
 * @returns its grid
 */
export function usedGrid(used: Point[]): PointGrid {
  let entry = USED_GRIDS.get(used);
  if (!entry) {
    entry = { grid: { cellM: USED_CELL_M, cells: new Map() }, filed: 0 };
    USED_GRIDS.set(used, entry);
  }
  const { cells } = entry.grid;
  for (; entry.filed < used.length; entry.filed++) {
    const point = used[entry.filed];
    const key = gridKey(Math.floor(point[0] / USED_CELL_M), Math.floor(point[1] / USED_CELL_M));
    const cell = cells.get(key);
    if (cell) cell.push(point);
    else cells.set(key, [point]);
  }
  return entry.grid;
}

/** dropFacing's terms: the kind that carries nothing, samples apart along, m apart across. */
export interface FacingTerms { none: number; apart: number; facingM: number }

/**
 * A rim's samples that face an earlier one carry nothing (venueedge.ts dropFacing, by a grid of
 * the samples): a sample drops when any earlier sample that still carries something, more than
 * apart samples along, stands within facingM on both axes - only the samples in its cell and the
 * next asked.
 * @param line the rim line (a point a sample)
 * @param kinds what stands at each sample (changed)
 * @param terms the kind that is nothing, the samples apart, the metres
 */
export function dropFacingByGrid(line: Point[], kinds: Uint8Array, terms: FacingTerms): void {
  const { none, apart, facingM } = terms, count = kinds.length;
  const cells = new Map<number, number[]>();
  const cellOf = (value: number) => Math.floor(value / facingM);
  for (let i = 0; i < count; i++) {
    const key = gridKey(cellOf(line[i][0]), cellOf(line[i][1])), cell = cells.get(key);
    if (cell) cell.push(i);
    else cells.set(key, [i]);
  }
  const faces = (i: number, j: number) => j < i && kinds[j] !== none
    && Math.min(i - j, count - i + j) > apart
    && Math.abs(line[i][0] - line[j][0]) < facingM && Math.abs(line[i][1] - line[j][1]) < facingM;
  for (let i = 0; i < count; i++) {
    if (kinds[i] === none) continue;
    const cellX = cellOf(line[i][0]), cellY = cellOf(line[i][1]);
    let found = false;
    for (let stepX = -1; stepX <= 1 && !found; stepX++)
      for (let stepY = -1; stepY <= 1 && !found; stepY++)
        found = !!cells.get(gridKey(cellX + stepX, cellY + stepY))?.some((j) => faces(i, j));
    if (found) kinds[i] = none;
  }
}

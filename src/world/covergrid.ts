// A GRID INDEX OF THE LEVEL'S COVERS for wear.ts coverAt: the covers that can hold a point, so a
// ground lookup tests a few covers, not all of them. The weather puts puddle and snow sites all
// over a level (puddles.ts), a hundred and more covers; every wheel asks the ground ~12 times a
// physics step. Rebuilt when the covers list changes (a new array: puddles.ts applyLooks, a new
// level). Each cell keeps the covers in the list's order, so the first match is the same cover a
// scan of the whole list finds - the answers are identical, only quicker.
import { addToGrid, cellAt, type CellGrid } from "../core/cellgrid.ts";
import type { Cover } from "./types.ts";

// m: a cell of the index; and the margin each cover's reach gets (coverAt tests a point at the
// centre of its 0.5 m square, up to ~0.36 m from the point asked)
const CELL_M = 16, MARGIN_M = 0.5;

let indexOf: Cover[] | null = null;
let index: CellGrid<Cover> = new Map();
const NONE: Cover[] = [];

/** Builds the index of a covers list. */
function build(list: Cover[]): void {
  index = new Map();
  // coverAt's cheap reject: a match lies within the larger half side of the centre on both axes
  for (const cover of list)
    addToGrid(index, cover, cover.x, cover.y, Math.max(cover.w, cover.h) / 2 + MARGIN_M, CELL_M);
  indexOf = list;
}

/**
 * The covers that can hold a point, in the list's order (none: an empty list).
 * @param list the level's covers (LEVEL.covers), or none
 * @param x world x, m
 * @param y world y, m
 * @returns the covers near the point
 */
export function coversNear(list: Cover[] | undefined, x: number, y: number): Cover[] {
  if (!list) return NONE;
  if (list !== indexOf) build(list);
  return cellAt(index, x, y, CELL_M) || NONE;
}

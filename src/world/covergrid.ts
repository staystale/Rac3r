// A GRID INDEX OF THE LEVEL'S COVERS for wear.ts coverAt: the covers that can hold a point, so a
// ground lookup tests a few covers, not all of them. The weather puts puddle and snow sites all
// over a level (puddles.ts), a hundred and more covers; every wheel asks the ground ~12 times a
// physics step. Rebuilt when the covers list changes (a new array: puddles.ts applyLooks, a new
// level). Each cell keeps the covers in the list's order, so the first match is the same cover a
// scan of the whole list finds - the answers are identical, only quicker.
import type { Cover } from "./types.ts";

// m: a cell of the index; and the margin each cover's reach gets (coverAt tests a point at the
// centre of its 0.5 m square, up to ~0.36 m from the point asked)
const CELL_M = 16, MARGIN_M = 0.5;

let indexOf: Cover[] | null = null;
let index = new Map<number, Cover[]>();
const NONE: Cover[] = [];

const cellKey = (cellI: number, cellJ: number) => cellI * 65536 + cellJ;

/** Builds the index of a covers list. */
function build(list: Cover[]): void {
  index = new Map();
  for (const cover of list) {
    // coverAt's cheap reject: a match lies within the larger half side of the centre on both axes
    const reach = Math.max(cover.w, cover.h) / 2 + MARGIN_M;
    for (let cellI = Math.floor((cover.x - reach) / CELL_M);
      cellI <= Math.floor((cover.x + reach) / CELL_M); cellI++) {
      for (let cellJ = Math.floor((cover.y - reach) / CELL_M);
        cellJ <= Math.floor((cover.y + reach) / CELL_M); cellJ++) {
        const key = cellKey(cellI, cellJ);
        const cell = index.get(key);
        if (cell) cell.push(cover);
        else index.set(key, [cover]);
      }
    }
  }
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
  return index.get(cellKey(Math.floor(x / CELL_M), Math.floor(y / CELL_M))) || NONE;
}

// The ground tiles' per-frame painting budget (tiles.ts): how many tiles a frame may paint.
import type { TileBudget } from "./types.ts";

// Tiles painted per frame: ONE always, then more while the frame has spent < TILE_MS painting, up
// to TILE_BUDGET (a fast phone fills a gap in a frame or two, a slow one never stalls); the level
// overview stands in for the rest.
export const TILE_BUDGET = 4, TILE_MS = 6;
// ?drawlite=1: tiles that trace only their own ribbon are cheap, so more of them fitted in TILE_MS
// and their GPU uploads came in bunches (the suspected cause of the 10-16 ribbon-cull judder)
export const LITE_TILE_BUDGET = 2;

/**
 * A fresh frame budget: `count` tiles at most, the first always, the rest inside TILE_MS.
 * @param count the most tiles this frame may paint
 * @returns the budget object
 */
export const tileBudget = (count = TILE_BUDGET): TileBudget => ({ n: count, first: true,
  until: performance.now() + TILE_MS });

/**
 * May this frame paint one more tile? (the first always; then only inside the time budget)
 * @param budget the frame budget, spent by one when a tile may be painted
 * @returns true when a tile may be painted
 */
export function takeTile(budget: TileBudget) {
  if (budget.n <= 0 || (!budget.first && budget.until != null && performance.now()
      > budget.until)) return false;
  budget.n--;
  budget.first = false;
  return true;
}


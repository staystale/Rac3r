// The ground tiles' per-frame painting budget (tiles.ts): how many tiles a frame may paint.
import type { TileBudget } from "./types.ts";

// Tiles painted per frame: ONE always, then more while the frame has spent < TILE_MS painting, up
// to TILE_BUDGET (a fast phone fills a gap in a frame or two, a slow one never stalls); the level
// overview stands in for the rest.
export const TILE_BUDGET = 4, TILE_MS = 6;

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

/**
 * May this frame repaint one more STALE tile (wear changed under it)? A stale tile keeps showing,
 * so it can wait. With ?stalecap=1 at most one a frame: the wear drain marks the worn tiles every
 * 0.15 s, and with nothing missing the frame's budget is unlimited, so they were all repainted in
 * one frame. MEASURED in the menu's race, zoomed out: 2-6 stale repaints every 9th frame (laptop
 * 8-11 ms draw; the owner's phone 16-21 ms, a hitch).
 * @param state the tile counters: this frame's number and the frame of the last stale repaint
 * @param capped ?stalecap=1
 * @param budget the frame budget
 * @returns true when a stale tile may be repainted
 */
export function takeStaleTile(state: { tileFrame: number; staleFrame: number }, capped: boolean,
    budget: TileBudget) {
  if (!capped) return takeTile(budget);
  if (state.staleFrame === state.tileFrame || !takeTile(budget)) return false;
  state.staleFrame = state.tileFrame;
  return true;
}

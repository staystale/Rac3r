// The ground tiles and the wear (tiles.ts): wear is painted into the tiles, so worn cells mark the
// tiles over them stale, to be repainted within the frame budget.
import { WEAR_CELL, wearDirty, wearEpoch } from "../world/wear.ts";
import { groundDirtyAreas } from "../world/puddles.ts";
import type { Tile, View } from "./types.ts";

/** What the wear reads of the tile cache (tiles.ts TilesCtx) */
export interface WearTiles {
  view: View;
  tiles: Map<string, Tile>;
  TILE_PX: number;
  state: { seenEpoch: number; wearDrainT: number };
  helpers: { heightsChanged: (rect: { x0: number; y0: number; x1: number; y1: number }) => void };
  /** the tile canvases painted with worn cells in them (a wear reset stales only these) */
  WORN_TILES: WeakSet<HTMLCanvasElement>;
}

// Wear is baked into the tiles: a changed cell only marks the tiles over it STALE; they keep
// showing until repainted within TILE_BUDGET. Dirty cells are drained at most every WEAR_DRAIN s,
// which batches a drift that changes many cells into one repaint of the tiles involved.
const WEAR_DRAIN = 0.15;

/**
 * Marks the tiles over the dirty wear cells stale, and clears the dirty list.
 * @param tcx the tile cache
 * @param zOfStep the zoom of a tile step
 */
function markStaleTiles(tcx: WearTiles, zOfStep: (step: number) => number) {
  const { view, tiles } = tcx;
  for (const [key, tile] of tiles) {
    if (tile.stale) continue;
    const [step, i, j] = key.split('|').map(Number);
    const tileWidth = tcx.TILE_PX / (view.PPM * zOfStep(step)), left = i * tileWidth, top = j
        * tileWidth;
    for (const cell of wearDirty) {
      const cellX = cell.cx * WEAR_CELL, cellY = cell.cy * WEAR_CELL;
      if (cellX + WEAR_CELL >= left && cellX <= left + tileWidth && cellY + WEAR_CELL >= top
          && cellY <= top + tileWidth) {
        tile.stale = true;
        break;
      }
    }
  }
  // worn cells can be rutted: the GPU hill shading is computed again there
  for (const cell of wearDirty) {
    const cellX = cell.cx * WEAR_CELL, cellY = cell.cy * WEAR_CELL;
    tcx.helpers.heightsChanged({
      x0: cellX, y0: cellY, x1: cellX + WEAR_CELL, y1: cellY + WEAR_CELL,
    });
  }
  wearDirty.length = 0;
}

/**
 * Marks stale the tiles over the areas whose covers changed (a weather puddle or snow patch grew
 * or shrank, world/puddles.ts), and clears the list.
 * @param tcx the tile cache
 * @param zOfStep the zoom of a tile step
 */
function staleCoverAreas(tcx: WearTiles, zOfStep: (step: number) => number) {
  const { view, tiles } = tcx;
  for (const [key, tile] of tiles) {
    if (tile.stale) continue;
    const [step, i, j] = key.split('|').map(Number);
    const tileWidth = tcx.TILE_PX / (view.PPM * zOfStep(step)), left = i * tileWidth,
      top = j * tileWidth;
    for (const area of groundDirtyAreas) {
      if (area.x1 >= left && area.x0 <= left + tileWidth && area.y1 >= top
          && area.y0 <= top + tileWidth) {
        tile.stale = true;
        break;
      }
    }
  }
  // the ground under them may have changed (a dried mud speck): the GPU field's mud mask and
  // the hill shading are read again there
  for (const area of groundDirtyAreas) tcx.helpers.heightsChanged(area);
  groundDirtyAreas.length = 0;
}

/**
 * Drains the dirty wear cells into stale tiles, at most every WEAR_DRAIN s; a new wear epoch
 * makes every tile stale - only those holding wear. MEASURED on the owner's phone:
 * a race start (clearWear) staled every tile painted before it, and the fly-in hand-over then
 * repainted them all in one frame (48 tiles, 61 ms), with no wear in any of them.
 * @param tcx the tile cache
 * @param wallDt the wall-clock seconds since the last frame
 * @param zOfStep the zoom of a tile step
 */
export function drainWear(tcx: WearTiles, wallDt: number,
    zOfStep: (step: number) => number) {
  const { tiles, state } = tcx;
  if (state.seenEpoch !== wearEpoch) {
    state.seenEpoch = wearEpoch;
    for (const tile of tiles.values()) {
      if (tcx.WORN_TILES.has(tile.c)) tile.stale = true;
    }
    wearDirty.length = 0;
    return;
  }
  if (groundDirtyAreas.length) staleCoverAreas(tcx, zOfStep);
  state.wearDrainT += wallDt;
  if (state.wearDrainT < WEAR_DRAIN || wearDirty.length === 0) return;
  state.wearDrainT = 0;
  markStaleTiles(tcx, zOfStep);
}

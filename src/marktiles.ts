// marktiles.ts - ?marksage: THE TYRE MARKS OF A BIG LEVEL KEPT WHOLE, the oldest fading first,
// never cut off in a straight line. A level bigger than the marks layer (marks.ts MARK_EXTENT)
// moved that layer's window with the player and wiped each strip of ground that left it, so marks
// more than ~300 m behind were cut along a straight line. Here the same marks (4.2 px/m, the same
// strokes) are kept in 256 px tiles (61 m) made where a mark is first laid, over the whole level:
// nothing is wiped by a move. A tile goes when the aged fade has cleared it (marks.ts: every cell
// gone ~154 s after its newest mark). MEASURED (tools/scratch/_marksize.mjs): the tiles within
// 25 m of the lap - Spa 122, the Nordschlep 383; so the tiles held are capped at TILE_CAP (the old
// layer's 26 MB) and, over it, the tile whose newest mark is oldest fades out first (one fade step
// a tick, ~4 s), so the oldest marks go first.

import { trackCanvas } from './core/memorybudget.ts';

// px a tile's side (61 m at 4.2 px/m)
export const TILE_PX = 256;
// px a fade cell's side (the aged fade's, marks.ts FADE_CELL) and cells a tile's side
const CELL_PX = 8, TILE_CELLS = TILE_PX / CELL_PX;
// tiles held at most: 104 x 256 KB = the old wrap-around layer's 26 MB (2537 px square)
export const TILE_CAP = 104;
// a tile key's offset: tile indices from -OFFSET up fit (a 32768-tile span = 2000 km)
const KEY_OFFSET = 32768, KEY_SPAN = 65536;

/** One tile: its canvas, its place (tile indices) and its fade cells. */
export interface MarkTile {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; tileX: number; tileY: number;
  cellT: Float64Array; cellStep: Uint8Array; live: Set<number>;
  newest: number;   // s of marks time: the newest mark laid in it
  forced: boolean;   // fading out early to stay within TILE_CAP
}

/** A level's tiles, by key, and the cleared ones kept for reuse. */
export interface MarkTiles { byKey: Map<number, MarkTile>; pool: MarkTile[] }

/** The aged fade's timing (marks.ts): when a cell starts, each step's wait and alpha, how many. */
export interface TileFade { fromS: number; stepS: number; steps: number; alpha: number }

/**
 * A new, empty set of tiles.
 * @returns the tiles
 */
export function createMarkTiles(): MarkTiles {
  return { byKey: new Map(), pool: [] };
}

const keyOf = (tileX: number, tileY: number) => (tileX + KEY_OFFSET) * KEY_SPAN + tileY
  + KEY_OFFSET;

/**
 * A tile made (or taken from the pool) for a place.
 * @param tiles the tiles
 * @param tileX tile index across
 * @param tileY tile index down
 * @returns the tile, empty
 */
function makeTile(tiles: MarkTiles, tileX: number, tileY: number): MarkTile {
  let tile = tiles.pool.pop();
  if (!tile) {
    const canvas = trackCanvas(document.createElement('canvas'));
    canvas.width = TILE_PX;
    canvas.height = TILE_PX;
    const ctx = canvas.getContext('2d')!;
    ctx.lineCap = 'round';
    tile = { canvas, ctx, tileX, tileY, cellT: new Float64Array(TILE_CELLS * TILE_CELLS),
      cellStep: new Uint8Array(TILE_CELLS * TILE_CELLS), live: new Set(), newest: 0,
      forced: false };
  }
  tile.tileX = tileX;
  tile.tileY = tileY;
  tile.forced = false;
  tiles.byKey.set(keyOf(tileX, tileY), tile);
  return tile;
}

/**
 * Puts a tile back in the pool, cleared.
 * @param tiles the tiles
 * @param tile the tile
 */
function dropTile(tiles: MarkTiles, tile: MarkTile) {
  tiles.byKey.delete(keyOf(tile.tileX, tile.tileY));
  tile.ctx.clearRect(0, 0, TILE_PX, TILE_PX);
  tile.live.clear();
  tiles.pool.push(tile);
}

/**
 * Empties every tile (a restart, a new level): back into the pool.
 * @param tiles the tiles
 */
export function clearMarkTiles(tiles: MarkTiles): void {
  for (const tile of [...tiles.byKey.values()]) dropTile(tiles, tile);
}

/**
 * Calls draw for each tile that touches a box of layer px (made where missing when asked to).
 * @param tiles the tiles
 * @param box the box: low x, low y, high x, high y (layer px, unwrapped)
 * @param make make the missing tiles
 * @param draw called with each tile
 */
export function forTilesIn(tiles: MarkTiles, box: number[], make: boolean,
  draw: (tile: MarkTile) => void): void {
  const [lowX, lowY, highX, highY] = box;
  for (let tileY = Math.floor(lowY / TILE_PX); tileY <= Math.floor(highY / TILE_PX); tileY++) {
    for (let tileX = Math.floor(lowX / TILE_PX); tileX <= Math.floor(highX / TILE_PX); tileX++) {
      const tile = tiles.byKey.get(keyOf(tileX, tileY))
        || (make ? makeTile(tiles, tileX, tileY) : null);
      if (tile) draw(tile);
    }
  }
}

/**
 * Strokes a segment (layer px, unwrapped) on every tile it touches, in the style of `style`.
 * @param tiles the tiles
 * @param style the context holding the stroke's style and width (marks.ts strokeMark)
 * @param from the [x, y] start
 * @param dest the [x, y] end
 */
export function strokeTiles(tiles: MarkTiles, style: CanvasRenderingContext2D, from: number[],
  dest: number[]): void {
  const reach = style.lineWidth;
  const box = [Math.min(from[0], dest[0]) - reach, Math.min(from[1], dest[1]) - reach,
    Math.max(from[0], dest[0]) + reach, Math.max(from[1], dest[1]) + reach];
  forTilesIn(tiles, box, true, (tile) => {
    const offX = tile.tileX * TILE_PX, offY = tile.tileY * TILE_PX, ctx = tile.ctx;
    ctx.strokeStyle = style.strokeStyle;
    ctx.lineWidth = reach;
    ctx.beginPath();
    ctx.moveTo(from[0] - offX, from[1] - offY);
    ctx.lineTo(dest[0] - offX, dest[1] - offY);
    ctx.stroke();
  });
}

/**
 * Fills a dot (layer px, unwrapped) on every tile it touches (a rubber ball).
 * @param tiles the tiles
 * @param fill its colour
 * @param centre the [x, y] centre
 * @param radius px
 */
export function dotTiles(tiles: MarkTiles, fill: string, centre: number[], radius: number): void {
  const box = [centre[0] - radius, centre[1] - radius, centre[0] + radius, centre[1] + radius];
  forTilesIn(tiles, box, true, (tile) => {
    tile.ctx.fillStyle = fill;
    tile.ctx.beginPath();
    tile.ctx.arc(centre[0] - tile.tileX * TILE_PX, centre[1] - tile.tileY * TILE_PX, radius, 0,
      Math.PI * 2);
    tile.ctx.fill();
  });
}

/**
 * Notes a box's fade cells as just marked (the aged fade).
 * @param tiles the tiles
 * @param box low x, low y, high x, high y (layer px, unwrapped)
 * @param clock s of marks time now
 */
export function noteTiles(tiles: MarkTiles, box: number[], clock: number): void {
  forTilesIn(tiles, box, true, (tile) => {
    const offX = tile.tileX * TILE_PX, offY = tile.tileY * TILE_PX;
    const cell = (value: number) => Math.max(0, Math.min(TILE_CELLS - 1,
      Math.floor(value / CELL_PX)));
    for (let row = cell(box[1] - offY); row <= cell(box[3] - offY); row++) {
      for (let col = cell(box[0] - offX); col <= cell(box[2] - offX); col++) {
        const index = row * TILE_CELLS + col;
        tile.cellT[index] = clock;
        tile.cellStep[index] = 0;
        tile.live.add(index);
      }
    }
    tile.newest = clock;
    tile.forced = false;
  });
}

/**
 * Over TILE_CAP: the tile whose newest mark is oldest starts fading out now.
 * @param tiles the tiles
 */
function forceOldest(tiles: MarkTiles) {
  let held = 0, oldest: MarkTile | null = null;
  for (const tile of tiles.byKey.values()) {
    if (tile.forced) continue;
    held++;
    if (!oldest || tile.newest < oldest.newest) oldest = tile;
  }
  if (held > TILE_CAP && oldest) oldest.forced = true;
}

/**
 * One fade tick: each cell old enough (or in a tile fading out early) fades a step, the last
 * clears it; a tile left with nothing goes back to the pool.
 * @param tiles the tiles
 * @param clock s of marks time now
 * @param fade the aged fade's timing
 */
export function fadeTiles(tiles: MarkTiles, clock: number, fade: TileFade): void {
  forceOldest(tiles);
  for (const tile of [...tiles.byKey.values()]) {
    const ctx = tile.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = `rgba(0,0,0,${fade.alpha})`;
    for (const index of tile.live) {
      const step = tile.cellStep[index];
      if (!tile.forced && clock - tile.cellT[index] < fade.fromS + step * fade.stepS) continue;
      const x = (index % TILE_CELLS) * CELL_PX, y = Math.floor(index / TILE_CELLS) * CELL_PX;
      if (step + 1 >= fade.steps) {
        ctx.clearRect(x, y, CELL_PX, CELL_PX);
        tile.live.delete(index);
      } else {
        ctx.fillRect(x, y, CELL_PX, CELL_PX);
        tile.cellStep[index] = step + 1;
      }
    }
    ctx.restore();
    if (!tile.live.size) dropTile(tiles, tile);
  }
}

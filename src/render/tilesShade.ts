// HILL-SHADING baked into a ground tile: stepped light and shadow bands on square cells, from the
// same heights the physics drives on.
import { BUMPS, LEVEL } from "../world/state.ts";
import { groundAt } from "../world/wear.ts";
import { visualHeightAt } from "../world/terrain.ts";

// Hill-shading: light from the TOP-LEFT: ground sloping toward it is brighter, away from it
// darker, in STEPPED bands on square cells (pixel art: squares, no smooth gradients). It reads the
// SAME height the physics drives on, so what you see is what you drive. Applied AFTER the palette
// snap so a shaded patch of grass can never snap to another surface's colour. depth: how far a
// full band moves a colour toward white (lit) or black (shadow). Light is ADDED toward white: a
// plain brightness MULTIPLY was invisible on dark race tarmac. Height outweighs slope so a bump
// reads LIGHTER overall and a dip DARKER. 4 bands: at 3 the Naffcar bank flipped a whole band at
// the turn apex and read as a seam.
const SHADE = {
  cellM: 0.5, maxCells: 200, gain: 3.0, bands: 4, depth: 0.36, hRef: 0.25, hGain: 0.9,
  slopeK: 0.55
};
// toward the light, world frame (screen up-left)
const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2];
// warm (bright ground only), neutral, cool shadow
const LIT = [255, 226, 150], LIT_N = [255, 255, 255], SHD = [26, 34, 58];

/**
 * Heights on the full grid of cell centres, with a one-cell border.
 * @param heights the grid to fill, (cells + 2) squared
 * @param side the grid side
 * @param minX the west edge of the tile, m
 * @param minY the north edge of the tile, m
 * @param cell the cell size, m
 */
function sampleHeightsFine(heights: Float32Array, side: number, minX: number, minY: number,
    cell: number) {
  for (let rowNum = 0; rowNum < side; rowNum++) for (let colNum = 0; colNum
      < side; colNum++) heights[rowNum * side + colNum] = visualHeightAt(minX + (colNum - 0.5)
      * cell, minY + (rowNum - 0.5) * cell);
}

/**
 * Heights sampled on a 2x COARSER grid and interpolated: terrain changes over metres, so heights
 * every 1 m are enough - 4x fewer lookups.
 * @param heights the grid to fill, (cells + 2) squared
 * @param side the grid side
 * @param minX the west edge of the tile, m
 * @param minY the north edge of the tile, m
 * @param cell the cell size, m
 */
function sampleHeightsCoarse(heights: Float32Array, side: number, minX: number, minY: number,
    cell: number) {
  const coarseSide = Math.ceil(side / 2) + 1, coarse = new Float32Array(coarseSide
      * coarseSide);
  for (let rowNum = 0; rowNum < coarseSide; rowNum++) for (let colNum = 0; colNum
      < coarseSide; colNum++) coarse[rowNum * coarseSide + colNum] = visualHeightAt(minX + (2
      * colNum - 0.5) * cell, minY + (2 * rowNum - 0.5) * cell);
  for (let rowNum = 0; rowNum < side; rowNum++) for (let colNum = 0; colNum < side; colNum++) {
    const coarseCol = colNum >> 1, coarseRow = rowNum >> 1, fracCol = (colNum & 1) * 0.5,
        fracRow = (rowNum & 1) * 0.5;
    const h00 = coarse[coarseRow * coarseSide + coarseCol], h10 = coarse[coarseRow
        * coarseSide + coarseCol + 1], h01 = coarse[(coarseRow + 1) * coarseSide + coarseCol],
        h11 = coarse[(coarseRow + 1) * coarseSide + coarseCol + 1];
    heights[rowNum * side + colNum] = (h00 * (1 - fracCol) + h10 * fracCol) * (1 - fracRow)
        + (h01 * (1 - fracCol) + h11 * fracCol) * fracRow;
  }
}

/**
 * HEIGHTS ONCE on a grid of cell centres with a one-cell border; slopes come from the
 * neighbours. MEASURED: 5 lookups per cell made a tile ~12 ms on a PC; now (n+2)^2 lookups in
 * all. Tiles that contain WASHBOARD (0.9 m ripples) keep the full grid so the ripples still show.
 * @param cells the cells per tile side
 * @param cell the cell size, m
 * @param tileWidth the tile width, m
 * @param centreX the tile centre x, m
 * @param centreY the tile centre y, m
 * @returns the (cells + 2) squared heights
 */
function sampleHeights(cells: number, cell: number, tileWidth: number, centreX: number,
    centreY: number) {
  const minX = centreX - tileWidth / 2, minY = centreY - tileWidth / 2;
  const side = cells + 2, heights = new Float32Array(side * side);
  const fine = BUMPS.some((bump) => bump.kind === 'washboard' && Math.abs(bump.x - centreX)
      < tileWidth / 2 + bump.len! / 2 && Math.abs(bump.y - centreY) < tileWidth / 2 + bump.len!
      / 2);
  if (fine || cells < 8) sampleHeightsFine(heights, side, minX, minY, cell);
  else sampleHeightsCoarse(heights, side, minX, minY, cell);
  return heights;
}

/**
 * The stepped shade of every cell: + toward white, - toward black.
 * @param heights the (cells + 2) squared heights
 * @param cells the cells per tile side
 * @param cell the cell size, m
 * @returns the levels and whether any is not zero
 */
function shadeLevels(heights: Float32Array, cells: number, cell: number) {
  const side = cells + 2;
  const levels = new Float32Array(cells * cells);
  let any = false;
  for (let rowNum = 0; rowNum < cells; rowNum++) for (let colNum = 0; colNum < cells; colNum++) {
    const centre = (rowNum + 1) * side + (colNum + 1);
    const slope = {
      gx: (heights[centre + 1] - heights[centre - 1]) / (2 * cell), gy: (heights[centre + side]
          - heights[centre - side]) / (2 * cell)
    };
    const raw = (-slope.gx * LIGHT[0] - slope.gy * LIGHT[1]) * SHADE.gain;
    const height = heights[centre];
    const shade = Math.max(-1, Math.min(1, Math.sign(raw) * Math.sqrt(Math.abs(raw))
        * SHADE.slopeK + Math.tanh(height / SHADE.hRef) * SHADE.hGain));
    const quant = Math.round(shade * SHADE.bands) / SHADE.bands;
    if (quant !== 0) any = true;
    // + toward white, - toward black
    levels[rowNum * cells + colNum] = SHADE.depth * quant;
  }
  return { levels, any };
}

/** the shade cells: world origin and size, tile pixels per metre, pixel offset of the origin */
type ShadeGrid = {
  minX: number; minY: number; cell: number; pxPerM: number; offX: number; offY: number;
};

/** a style of shade cell: its colour, strength and the rects (x, y, w, h runs) to fill with it */
type ShadeGroup = { col: number[]; k: number; r: number[] };

/**
 * Gathers the shaded cells into one group per style: ~9 styles (2 x SHADE.bands levels x lit /
 * lit-lab / shadow), the same integer-edged rects per style.
 * @param canvas the tile canvas
 * @param levels the shade level of every cell
 * @param cells the cells per tile side
 * @param minX the west edge of the tile, m
 * @param minY the north edge of the tile, m
 * @param cell the cell size, m
 * @returns the groups
 */
function groupShadeRects(canvas: HTMLCanvasElement, levels: Float32Array, cells: number,
    grid: ShadeGrid) {
  const { minX, minY, cell, pxPerM, offX, offY } = grid;
  const groups = new Map<number, ShadeGroup>();
  for (let rowNum = 0; rowNum < cells; rowNum++) for (let colNum = 0; colNum < cells; colNum++) {
    const level = levels[rowNum * cells + colNum];
    if (level === 0) continue;
    let col;
    if (level > 0) {
      // only the lab level has the near-white floor; a full ground lookup per cell cost more
      // than the shading itself
      col = LEVEL.id === 'lab' && groundAt(minX + (colNum + 0.5) * cell, minY + (rowNum + 0.5)
          * cell).surface.id === 'lab' ? LIT : LIT_N;
    } else col = SHD;
    const key = (col === SHD ? 0 : col === LIT ? 1 : 2) * 1000 + Math.round(Math.abs(level)
        * 1000);
    let group = groups.get(key);
    if (!group) { group = { col, k: Math.abs(level), r: [] }; groups.set(key, group); }
    const px0 = Math.round(offX + colNum * cell * pxPerM);
    const py0 = Math.round(offY + rowNum * cell * pxPerM);
    group.r.push(px0, py0, Math.round(offX + (colNum + 1) * cell * pxPerM) - px0,
        Math.round(offY + (rowNum + 1) * cell * pxPerM) - py0);
  }
  return groups;
}

/**
 * HILL-SHADING baked into a tile, DRAWN AS TRANSLUCENT SQUARES, not per pixel: "move toward
 * white by k" IS "draw white at opacity k", so the colours are identical - but there is no
 * getImageData / putImageData readback. ONE PATH PER SHADE, not one fillRect per cell: up to 4096
 * fillRects a tile, each with a fresh rgba string, were ~half of every ground tile. The rects
 * abut, never overlap, so one fill blends each pixel exactly once. The warm light (for near-white
 * ground, where white cannot show) is chosen per cell from the surface underneath.
 * @param noShade perf A/B: skip the shading
 * @param canvas the tile canvas
 * @param tileWidth the tile width, m
 * @param centreX the tile centre x, m
 * @param centreY the tile centre y, m
 */
export function hillShade(noShade: boolean, canvas: HTMLCanvasElement, tileWidth: number,
    centreX: number, centreY: number) {
  if (noShade) return;
  // the cells sit on a WORLD grid (a fixed size per metre, an even index at the tile's west and
  // north), so the same ground gets the same bands at every zoom step; the cell stays 0.5 m
  // down to about zoom 0.12 and only doubles beyond that (a tile holds more than maxCells)
  let cell: number = SHADE.cellM;
  while (tileWidth / cell + 2 > SHADE.maxCells) cell *= 2;
  const tileX = centreX - tileWidth / 2, tileY = centreY - tileWidth / 2;
  const minX = 2 * cell * Math.floor(tileX / (2 * cell));
  const minY = 2 * cell * Math.floor(tileY / (2 * cell));
  const cells = Math.ceil((tileWidth + Math.max(tileX - minX, tileY - minY)) / cell);
  const span = cells * cell, pxPerM = canvas.width / tileWidth;
  const heights = sampleHeights(cells, cell, span, minX + span / 2, minY + span / 2);
  const { levels, any } = shadeLevels(heights, cells, cell);
  if (!any) return;                                   // flat tile: nothing to do
  const ctx = canvas.getContext('2d')!;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  const groups = groupShadeRects(canvas, levels, cells, {
    minX, minY, cell, pxPerM, offX: (minX - tileX) * pxPerM, offY: (minY - tileY) * pxPerM,
  });
  for (const group of groups.values()) {
    ctx.fillStyle = `rgba(${group.col[0]},${group.col[1]},${group.col[2]},${
      group.k.toFixed(3)})`;
    ctx.beginPath();
    const rects = group.r;
    for (let pos = 0; pos < rects.length; pos += 4) ctx.rect(rects[pos], rects[pos + 1],
        rects[pos + 2], rects[pos + 3]);
    ctx.fill();
  }
  ctx.restore();
}

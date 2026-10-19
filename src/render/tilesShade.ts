// HILL-SHADING: the heights, bands and colours of the stepped light and shadow on square cells,
// from the same heights the physics drives on (the GPU draws them over the ground, glshade.ts).
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
// the shade cell side, m (the GPU shade grid uses the same cells, glshade.ts)
export const SHADE_CELL_M = SHADE.cellM;
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
export function sampleHeights(cells: number, cell: number, tileWidth: number, centreX: number,
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
export function shadeLevels(heights: Float32Array, cells: number, cell: number) {
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

/**
 * The colour a shade cell moves toward: the warm light (only on the lab's near-white floor, where
 * white cannot show), white, or the cool shadow.
 * @param level the cell's shade level (+ toward the light, - toward the shadow, 0 none)
 * @param centreX the cell centre x, m
 * @param centreY the cell centre y, m
 * @returns the RGB colour
 */
export function shadeTint(level: number, centreX: number, centreY: number) {
  if (level < 0) return SHD;
  // only the lab-floor levels have the near-white floor; a full ground lookup per cell cost more
  // than the shading itself
  return LEVEL.base!.id === 'lab' && groundAt(centreX, centreY).surface.id === 'lab' ? LIT : LIT_N;
}

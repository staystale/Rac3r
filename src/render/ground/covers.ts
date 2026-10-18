// The covers of the ground painter: random patches and covers such as puddles and snow,
// merged per kind and drawn over the surface.
import { LEVEL } from "../../world/state.ts";
import {
  coverCut, layersAt, PATCH_CELL, PATCH_GRID, PATCH_ORDER, patchKey,
} from "../../world/wear.ts";
import type {
  Cover, CoverCells, CoverId, MergedCell, MergedCover, Patch,
} from "../../world/types.ts";
import type { GroundCtx, ViewRect } from "./types.ts";
import { paintLayers, artBase } from "./art.ts";
import { coverFieldOn } from "../../world/coverfield.ts";

// COVERS — snow, ice and puddles lying ON any surface (LEVEL.covers, lab.js).
// Static, so they are painted into the ground tiles. Snow and ice are opaque and use their own
// SURFACE_ART; a puddle is TRANSLUCENT water over whatever is under it, so you can see it is a
// puddle on grass, on dirt or on tarmac. When wear changes a cell under a cover (snow packed to
// ice, ice scrubbed through), drawWear paints that cell's new state over this. A cover is drawn
// as the 0.5 m world-grid squares whose centre is inside it (the same inside test as lab.js
// coverAt), cached per cover — squares, not ovals (requirement: no circles). Physics keeps the
// exact shape; the drawn edge is within ~0.35 m of it, the same as the square blend patches.
// `rim` = squares with an outside neighbour, filled as the edge line (stroking the squares would
// outline every one of them).

/**
 * Returns the 0.5 m world-grid cells whose centre is inside a cover, cached on the cover.
 *
 * @param cover the cover to measure
 * @returns the cells: all of them and the rim
 */
function coverCells(cover: Cover): CoverCells {
  if (cover._cells) return cover._cells;
  const cellSize = 0.5, cosRot = Math.cos(cover.rot || 0), sinRot = Math.sin(cover.rot || 0),
    halfW = cover.w / 2, halfH = cover.h / 2;
  // scan the ROTATED box's extents, not a square of the long side (a 160 x 14 m river was a 160 m
  // square: 100k tests -> ~10k)
  const reachX = halfW * Math.abs(cosRot) + halfH * Math.abs(sinRot) + cellSize,
    reachY = halfW * Math.abs(sinRot) + halfH * Math.abs(cosRot) + cellSize;
  const inside = (x: number, y: number) => {
    // the river's dry band under the motorway (lab.js coverAt)
    if (cover.cut && coverCut(cover, x, y)) return false;
    const offX = x - cover.x, offY = y - cover.y,
      dx = offX * cosRot + offY * sinRot, dy = -offX * sinRot + offY * cosRot;
    return cover.shape === 'ellipse'
      ? (dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH) <= 1
      : Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
  };
  const all: number[] = [], rim: number[] = [];
  for (let x = Math.floor((cover.x - reachX) / cellSize) * cellSize;
    x < cover.x + reachX; x += cellSize)
    for (let y = Math.floor((cover.y - reachY) / cellSize) * cellSize;
      y < cover.y + reachY; y += cellSize) {
      const midX = x + cellSize / 2, midY = y + cellSize / 2;
      if (!inside(midX, midY)) continue;
      all.push(x, y);
      if (
        !inside(midX + cellSize, midY) || !inside(midX - cellSize, midY) ||
        !inside(midX, midY + cellSize) || !inside(midX, midY - cellSize)
      ) rim.push(x, y);
    }
  return (cover._cells = { all, rim, G: cellSize });
}

// the tint of a puddle by the surface under it
export const PUDDLE_TINT: Record<string, string> = {
  dirt: 'rgba(86,64,42,0.62)', mud: 'rgba(62,46,32,0.66)', thickMud: 'rgba(46,34,24,0.70)',
  sand: 'rgba(150,128,90,0.55)', gravel: 'rgba(96,90,78,0.58)',
  // on hard ground, water is a dark mirror, not blue (user: puddles on tarmac looked
  // wrong)
  tarmac: 'rgba(16,19,26,0.62)', racetarmac: 'rgba(12,14,20,0.62)',
  broken: 'rgba(30,33,42,0.60)', lab: 'rgba(120,128,142,0.45)',
  // water on grass reads BLUE (it vanished into the grass as dark green)
  grass: 'rgba(74,104,150,0.62)', grassShort: 'rgba(74,104,150,0.62)',
  grassLong: 'rgba(66,96,140,0.64)',
};
// ONE PUDDLE LOOK (the default since 2026-10-18, ?onepuddle=0 off; owner: one type of puddle,
// and they hardly showed on the wet race surface): a puddle is translucent water tinted by the
// ground under it - as above, but on hard ground blue-grey (the dark mirror vanished into a wet
// road) - with the water's sheen and rain rings (art.ts 'puddle'); not the opaque wet tarmac look
// with its own blue blobs
const HARD_WATER = 'rgba(78,100,140,0.58)';
export const PUDDLE_WATER: Record<string, string> = {
  ...PUDDLE_TINT, tarmac: HARD_WATER, racetarmac: HARD_WATER, broken: HARD_WATER,
  concrete: HARD_WATER, kerb: HARD_WATER, lab: HARD_WATER,
};

/**
 * The water of a puddle over this ground (?onepuddle=1).
 * @param base the ground's surface id
 * @returns a CSS colour
 */
export const puddleWater = (base: string) => PUDDLE_WATER[base] || HARD_WATER;

// RANDOM PATCHES (Grass Track, re-rolled every load — lab.js randomiseGrassTrack): small ellipses
// of another base surface, drawn with that surface's own SURFACE_ART so a mud spot looks like
// mud.

// the patches one drawPatches call visits, reused (no allocation per tile)
const visiblePatches: Patch[] = [];
const seenPatches = new Set<Patch>();
const byDrawOrder = (left: Patch, right: Patch) =>
  PATCH_ORDER.get(left)! - PATCH_ORDER.get(right)!;

/**
 * The patches whose grid cells touch the view, in LEVEL.allPatches order (overlapping patches
 * draw as before). MEASURED: walking every patch of the level for each tile was 23 s of a 60 s
 * load-and-drive on a 30 km straight; the grid makes the cost scale with the view, not the level.
 * The whole list when the view covers more grid cells than there are patches (a flat overview).
 *
 * @param groundCtx the shared ground painter context
 * @param list LEVEL.allPatches
 * @returns the candidates (the caller still culls each to the screen)
 */
function patchesInView(groundCtx: GroundCtx, list: Patch[]): Patch[] {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  const ppm = PPMz();
  if (!PATCH_GRID.size || !(ppm > 0)) return list;
  const originX = toScreenX(0), originY = toScreenY(0);
  const cellX0 = Math.floor(-originX / ppm / PATCH_CELL);
  const cellX1 = Math.floor((view.W - originX) / ppm / PATCH_CELL);
  const cellY0 = Math.floor(-originY / ppm / PATCH_CELL);
  const cellY1 = Math.floor((view.H - originY) / ppm / PATCH_CELL);
  if ((cellX1 - cellX0 + 1) * (cellY1 - cellY0 + 1) > list.length) return list;
  visiblePatches.length = 0;
  seenPatches.clear();
  for (let cellX = cellX0; cellX <= cellX1; cellX++) {
    for (let cellY = cellY0; cellY <= cellY1; cellY++) {
      const cell = PATCH_GRID.get(patchKey(cellX, cellY));
      if (!cell) continue;
      for (const patch of cell) {
        if (seenPatches.has(patch)) continue;
        seenPatches.add(patch);
        visiblePatches.push(patch);
      }
    }
  }
  visiblePatches.sort(byDrawOrder);
  return visiblePatches;
}

/**
 * Paints the random patches of another base surface, each with its own surface art.
 *
 * @param groundCtx the shared ground painter context
 */
export function drawPatches(groundCtx: GroundCtx) {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  // random spots + blend patches (lab.js prepareLevel)
  const all = LEVEL.allPatches || LEVEL.patches;
  if (!all || !all.length) return;
  const list = all === LEVEL.allPatches ? patchesInView(groundCtx, all) : all;
  const ppm = PPMz();
  for (const patch of list) {
    const reach = Math.max(patch.w, patch.h) / 2;
    if (
      toScreenX(patch.x + reach) < 0 || toScreenX(patch.x - reach) > view.W ||
      toScreenY(patch.y + reach) < 0 || toScreenY(patch.y - reach) > view.H
    ) continue;
    view.ctx.save();
    view.ctx.beginPath();
    if (patch.sq) view.ctx.rect(
      toScreenX(patch.x - patch.w / 2), toScreenY(patch.y - patch.h / 2), patch.w * ppm,
        patch.h * ppm
    );
    else view.ctx.ellipse(
      toScreenX(patch.x), toScreenY(patch.y), (patch.w / 2) * ppm, (patch.h / 2) * ppm,
      patch.rot || 0, 0, Math.PI * 2
    );
    view.ctx.fillStyle = artBase(groundCtx, patch.surface.id, '#6b5644');
    view.ctx.fill();
    view.ctx.clip();
    view.ctx.translate(toScreenX(0), toScreenY(0));
    paintLayers(
      groundCtx, patch.surface.id, patch.x - reach, patch.y - reach, patch.x + reach,
      patch.y + reach
    );
    view.ctx.restore();
  }
}

// MERGED COVERS (requirement: puddles, streams or bodies of water should CONNECT together if
// touching). Each cover used to be drawn on its own — its own translucent fill and dark rim — so
// overlapping puddles darkened twice and showed rims inside each other: a stream read as a
// string of beads. Now, per cover KIND, the union of every cover's 0.5 m cells (the same cells
// coverAt answers for, so it still matches the physics); each tint fills once, the pattern is
// clipped to the union, one rim round the outside.

/**
 * Collects every cover's cells into one map of cells per cover kind.
 *
 * @param list the level covers
 * @param cellSize the cell size in metres
 * @returns the cells keyed by cover kind and grid position
 */
function collectCoverCells(
  list: Cover[], cellSize: number
): Map<CoverId, Map<number, MergedCell>> {
  const kinds = new Map<CoverId, Map<number, MergedCell>>();
  for (const cover of list) {
    let kindCells = kinds.get(cover.cover);
    if (!kindCells) kinds.set(cover.cover, (kindCells = new Map()));
    const own = coverCells(cover);
    for (let i = 0; i < own.all.length; i += 2) {
      const gridX = Math.round(own.all[i] / cellSize),
        gridY = Math.round(own.all[i + 1] / cellSize),
        key = gridX * 131071 + gridY;
      if (!kindCells.has(key))
        kindCells.set(key, {
          x: own.all[i], y: own.all[i + 1], gx: gridX, gy: gridY,
        });
    }
  }
  return kinds;
}

/**
 * Builds the merged covers of each kind: its cells, the rim cells and the bounding box.
 *
 * @param kinds the cells of each cover kind
 * @param cellSize the cell size in metres
 * @returns the merged covers
 */
function buildMergedCovers(
  kinds: Map<CoverId, Map<number, MergedCell>>, cellSize: number
): MergedCover[] {
  const out: MergedCover[] = [];
  for (const [kind, kindCells] of kinds) {
    const cells = [...kindCells.values()], rim: MergedCell[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const cell of cells) {
      if (
        !kindCells.has((cell.gx + 1) * 131071 + cell.gy) ||
        !kindCells.has((cell.gx - 1) * 131071 + cell.gy) ||
        !kindCells.has(cell.gx * 131071 + cell.gy + 1) ||
        !kindCells.has(cell.gx * 131071 + cell.gy - 1)
      ) rim.push(cell);
      minX = Math.min(minX, cell.x);
      minY = Math.min(minY, cell.y);
      maxX = Math.max(maxX, cell.x + cellSize);
      maxY = Math.max(maxY, cell.y + cellSize);
    }
    out.push({ kind, cells, rim, bb: [minX, minY, maxX, maxY], G: cellSize });
  }
  return out;
}

/**
 * Returns the union of the level covers per kind, cached on LEVEL.
 *
 * @param list the level covers
 * @returns the merged covers
 */
function mergedCovers(list: Cover[]): MergedCover[] {
  if (LEVEL._mergedOf === list) return LEVEL._merged!;   // set together with _mergedOf
  const cellSize = 0.5;
  const out = buildMergedCovers(collectCoverCells(list, cellSize), cellSize);
  LEVEL._mergedOf = list;
  LEVEL._merged = out;
  return out;
}

/**
 * Keeps the cells that touch the visible rectangle.
 *
 * @param cells the cells to test
 * @param cellSize the cell size in metres
 * @param viewRect the visible rectangle
 * @returns the cells in view
 */
function filterCellsInView(cells: MergedCell[], cellSize: number, viewRect: ViewRect) {
  const { vx0, vx1, vy0, vy1 } = viewRect;
  return cells.filter(
    (cell) => cell.x + cellSize >= vx0 && cell.x <= vx1 &&
      cell.y + cellSize >= vy0 && cell.y <= vy1
  );
}

/**
 * Adds the cells as squares to a new path.
 *
 * @param groundCtx the shared ground painter context
 * @param cells the cells to trace
 * @param cellSize the cell size in metres
 */
function pathCells(groundCtx: GroundCtx, cells: MergedCell[], cellSize: number) {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  const ppm = PPMz();
  view.ctx.beginPath();
  for (const cell of cells)
    view.ctx.rect(toScreenX(cell.x), toScreenY(cell.y), cellSize * ppm, cellSize * ppm);
}

/**
 * The cells of a puddle grouped by the ground under each (looked up once per cell).
 * @param vis the puddle's cells in view
 * @param cellSize the cell size in metres
 * @returns the cells of each ground
 */
function cellsByGround(vis: MergedCell[], cellSize: number): Map<string, MergedCell[]> {
  const groups = new Map<string, MergedCell[]>();
  for (const cell of vis) {
    cell.base ??= layersAt(cell.x + cellSize / 2, cell.y + cellSize / 2).base;
    let group = groups.get(cell.base);
    if (!group) groups.set(cell.base, (group = []));
    group.push(cell);
  }
  return groups;
}

/**
 * Paints a merged puddle (?onepuddle=1): water tinted by the ground under each part, the water's
 * sheen and rings, a dark rim.
 *
 * @param groundCtx the shared ground painter context
 * @param grp the merged cover
 * @param vis its cells in view
 * @param viewRect the visible rectangle
 * @param box [x0, y0, x1, y1] of its visible bounding box in metres
 */
function paintPuddleCover(
  groundCtx: GroundCtx, grp: MergedCover, vis: MergedCell[], viewRect: ViewRect,
  box: number[]
) {
  const { view, toScreenX, toScreenY } = groundCtx;
  const cellSize = grp.G, [bx0, by0, bx1, by1] = box;
  for (const [base, cells] of cellsByGround(vis, cellSize)) {
    pathCells(groundCtx, cells, cellSize);
    view.ctx.fillStyle = puddleWater(base);
    view.ctx.fill();
  }
  pathCells(groundCtx, vis, cellSize);
  view.ctx.save();
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(groundCtx, 'puddle', bx0, by0, bx1, by1);
  view.ctx.restore();
  pathCells(groundCtx, filterCellsInView(grp.rim, cellSize, viewRect), cellSize);
  view.ctx.fillStyle = 'rgba(30,40,58,0.30)';
  view.ctx.fill();
}

/**
 * Paints a merged WET cover: the wet surface art and a dark rim.
 *
 * @param groundCtx the shared ground painter context
 * @param grp the merged cover
 * @param vis its cells in view
 * @param viewRect the visible rectangle
 * @param box [x0, y0, x1, y1] of its visible bounding box in metres
 */
function paintWetCover(
  groundCtx: GroundCtx, grp: MergedCover, vis: MergedCell[], viewRect: ViewRect,
  box: number[]
) {
  const { view, toScreenX, toScreenY } = groundCtx;
  const cellSize = grp.G, [bx0, by0, bx1, by1] = box;
  // the wet surface art, the same water as a wet zone and a wet wear cell
  pathCells(groundCtx, vis, cellSize);
  view.ctx.fillStyle = artBase(groundCtx, 'wet', '#2c3039');
  view.ctx.fill();
  view.ctx.save();
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(groundCtx, 'wet', bx0, by0, bx1, by1);
  view.ctx.restore();
  pathCells(groundCtx, filterCellsInView(grp.rim, cellSize, viewRect), cellSize);
  view.ctx.fillStyle = 'rgba(30,40,58,0.30)';
  view.ctx.fill();
}

/**
 * Paints a merged snow or ice cover: its art clipped to the cells, and a light rim.
 *
 * @param groundCtx the shared ground painter context
 * @param grp the merged cover
 * @param vis its cells in view
 * @param viewRect the visible rectangle
 * @param box [x0, y0, x1, y1] of its visible bounding box in metres
 */
function paintSolidCover(
  groundCtx: GroundCtx, grp: MergedCover, vis: MergedCell[], viewRect: ViewRect,
  box: number[]
) {
  const { view, toScreenX, toScreenY } = groundCtx;
  const cellSize = grp.G, [bx0, by0, bx1, by1] = box;
  pathCells(groundCtx, vis, cellSize);
  view.ctx.fillStyle = artBase(groundCtx, grp.kind, '#ffffff');
  view.ctx.fill();
  view.ctx.save();
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(groundCtx, grp.kind, bx0, by0, bx1, by1);
  view.ctx.restore();
  pathCells(groundCtx, filterCellsInView(grp.rim, cellSize, viewRect), cellSize);
  view.ctx.fillStyle = grp.kind === 'snow'
    ? 'rgba(160,180,205,0.55)' : 'rgba(255,255,255,0.55)';
  view.ctx.fill();
}

/**
 * Paints the merged covers: each kind as one fill, one pattern clip and one rim.
 *
 * @param groundCtx the shared ground painter context
 * @param list the level covers
 */
function drawCoversMerged(groundCtx: GroundCtx, list: Cover[]) {
  const { view, cam, PPMz } = groundCtx;
  const ppm = PPMz();
  const vx0 = cam.x - view.W / 2 / ppm, vx1 = cam.x + view.W / 2 / ppm,
    vy0 = cam.y - view.H / 2 / ppm, vy1 = cam.y + view.H / 2 / ppm;
  const viewRect: ViewRect = { vx0, vx1, vy0, vy1 };
  for (const grp of mergedCovers(list)) {
    const [minX, minY, maxX, maxY] = grp.bb, cellSize = grp.G;
    if (maxX < vx0 || minX > vx1 || maxY < vy0 || minY > vy1) continue;
    const vis = filterCellsInView(grp.cells, cellSize, viewRect);
    if (!vis.length) continue;
    const bx0 = Math.max(minX, vx0), by0 = Math.max(minY, vy0),
      bx1 = Math.min(maxX, vx1), by1 = Math.min(maxY, vy1);
    const box = [bx0, by0, bx1, by1];
    if (grp.kind === 'wet' && groundCtx.onePuddle) {
      paintPuddleCover(groundCtx, grp, vis, viewRect, box);
    } else if (grp.kind === 'wet') paintWetCover(groundCtx, grp, vis, viewRect, box);
    else paintSolidCover(groundCtx, grp, vis, viewRect, box);
  }
}

/**
 * Paints the level's covers (snow, ice, puddles) lying on any surface.
 *
 * @param groundCtx the shared ground painter context
 */
export function drawCovers(groundCtx: GroundCtx) {
  const list = LEVEL.covers;
  if (!list) return;
  // the cover field draws the level's own snow / ice / puddles (its areas): scenery water here
  drawCoversMerged(groundCtx, coverFieldOn() ? sceneryWater(list) : list);
}

/** The scenery water of a covers list (cached on the list: a new list when covers change). */
const sceneryWaterOf = new WeakMap<Cover[], Cover[]>();
function sceneryWater(list: Cover[]): Cover[] {
  let water = sceneryWaterOf.get(list);
  if (!water) sceneryWaterOf.set(list, (water = list.filter((cover) => cover.water)));
  return water;
}

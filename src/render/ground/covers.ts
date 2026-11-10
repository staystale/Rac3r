// The covers of the ground painter: random patches and covers such as puddles and snow,
// merged per kind and drawn over the surface.
import { LEVEL } from "../../world/state.ts";
import {
  coverCut, layersAt, PATCH_CELL, PATCH_GRID, PATCH_ORDER, patchKey,
} from "../../world/wear.ts";
import type {
  Cover, CoverCells, CoverId, MergedCover, Patch,
} from "../../world/types.ts";
import type { GroundCtx, ViewRect } from "./types.ts";
import { paintLayers, artBase } from "./art.ts";
import { castBushShadow, lightBushTop, shadeBushSide } from "./bushes.ts";

// COVERS — snow, ice and puddles lying ON any surface (LEVEL.covers, lab.ts).
// Static, so they are painted into the ground tiles. Snow and ice are opaque and use their own
// SURFACE_ART; a puddle is TRANSLUCENT water over whatever is under it, so you can see it is a
// puddle on grass, on dirt or on tarmac. When wear changes a cell under a cover (snow packed to
// ice, ice scrubbed through), drawWear paints that cell's new state over this. A cover is drawn
// as the 0.5 m world-grid squares whose centre is inside it (the same inside test as lab.ts
// coverAt), cached per cover — squares, not ovals (requirement: no circles). Physics keeps the
// exact shape; the drawn edge is within ~0.35 m of it, the same as the square blend patches.
// `rim` = squares with an outside neighbour, filled as the edge line (stroking the squares would
// outline every one of them).

/**
 * Returns the 0.5 m world-grid cells whose centre is inside a cover, cached on the cover: their
 * grid coordinates (x / G, y / G) in pairs.
 *
 * @param cover the cover to measure
 * @returns the cells
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
    // the river's dry band under the motorway (lab.ts coverAt)
    if (cover.cut && coverCut(cover, x, y)) return false;
    const offX = x - cover.x, offY = y - cover.y,
      dx = offX * cosRot + offY * sinRot, dy = -offX * sinRot + offY * cosRot;
    return cover.shape === 'ellipse'
      ? (dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH) <= 1
      : Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
  };
  const all: number[] = [];
  for (let x = Math.floor((cover.x - reachX) / cellSize) * cellSize;
    x < cover.x + reachX; x += cellSize)
    for (let y = Math.floor((cover.y - reachY) / cellSize) * cellSize;
      y < cover.y + reachY; y += cellSize)
      if (inside(x + cellSize / 2, y + cellSize / 2))
        all.push(Math.round(x / cellSize), Math.round(y / cellSize));
  return (cover._cells = { all: Int32Array.from(all), G: cellSize });
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
// ONE PUDDLE LOOK (owner: one type of puddle,
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
 * The water of a puddle over this ground.
 * @param base the ground's surface id
 * @returns a CSS colour
 */
export const puddleWater = (base: string) => PUDDLE_WATER[base] || HARD_WATER;

// RANDOM PATCHES (Grass Track, re-rolled every load — lab.ts randomiseGrassTrack): small ellipses
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
  // random spots + blend patches (lab.ts prepareLevel)
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
    if (patch.bush) castBushShadow(view.ctx, patch,
      { x: toScreenX(patch.x - patch.w / 2), y: toScreenY(patch.y - patch.h / 2) }, ppm);
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
    const artId = patch.art || patch.surface.id;
    view.ctx.fillStyle = artBase(groundCtx, artId, '#6b5644');
    view.ctx.fill();
    view.ctx.clip();
    view.ctx.translate(toScreenX(0), toScreenY(0));
    paintPatchInside(groundCtx, patch, artId, reach, ppm);
    view.ctx.restore();
  }
}

/**
 * Paints a patch's pattern layers inside its clip (origin at the world's); a bush gets its lit
 * squares under them and its shaded side over them (ground/bushes.ts).
 *
 * @param groundCtx the shared ground painter context
 * @param patch the patch
 * @param artId the look it is painted with
 * @param reach its half size, m
 * @param ppm px a metre
 */
function paintPatchInside(groundCtx: GroundCtx, patch: Patch, artId: string, reach: number,
  ppm: number) {
  const ctx = groundCtx.view.ctx;
  if (patch.bush) lightBushTop(ctx, patch, ppm);
  paintLayers(
    groundCtx, artId, patch.x - reach, patch.y - reach, patch.x + reach, patch.y + reach
  );
  if (patch.bush) shadeBushSide(ctx, patch, ppm);
}

// MERGED COVERS (requirement: puddles, streams or bodies of water should CONNECT together if
// touching). Each cover used to be drawn on its own — its own translucent fill and dark rim — so
// overlapping puddles darkened twice and showed rims inside each other: a stream read as a
// string of beads. Now, per cover KIND, the union of every cover's 0.5 m cells (the same cells
// coverAt answers for, so it still matches the physics); each tint fills once, the pattern is
// clipped to the union, one rim round the outside.

// COMPACT (owner 11-10: "Yes" to Yass Marina's memory): a merged cover keeps its cells as grid
// coordinates in typed arrays and its rim, its ground lookups and its filing by place as indices
// into them - MEASURED (tools/scratch/_coverheap.mjs, Yass Marina, after a forced GC): 156 249
// cells held as objects (x, y, gx, gy, base), and each cover's cells as number arrays besides.
const KEY_ROW = 131071;
// the grounds a puddle's cells were looked up on (MergedCover.base: an index + 1, 0 not yet)
const GROUNDS: string[] = [], GROUND_OF = new Map<string, number>();

/**
 * Builds the merged covers of each kind: the union of its covers' cells (in the covers' order,
 * each cell once), the rim cells, the bounding box.
 *
 * @param list the level covers
 * @param cellSize the cell size in metres
 * @returns the merged covers
 */
function buildMergedCovers(list: Cover[], cellSize: number): MergedCover[] {
  const kinds = new Map<CoverId, { keys: Set<number>; gx: number[]; gy: number[] }>();
  for (const cover of list) {
    let kind = kinds.get(cover.cover);
    if (!kind) kinds.set(cover.cover, (kind = { keys: new Set(), gx: [], gy: [] }));
    const own = coverCells(cover).all;
    for (let i = 0; i < own.length; i += 2) {
      const key = own[i] * KEY_ROW + own[i + 1];
      if (kind.keys.has(key)) continue;
      kind.keys.add(key);
      kind.gx.push(own[i]);
      kind.gy.push(own[i + 1]);
    }
  }
  const out: MergedCover[] = [];
  for (const [kind, { keys, gx, gy }] of kinds) {
    const rim: number[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < gx.length; i++) {
      const cellX = gx[i], cellY = gy[i];
      if (!keys.has((cellX + 1) * KEY_ROW + cellY) || !keys.has((cellX - 1) * KEY_ROW + cellY)
        || !keys.has(cellX * KEY_ROW + cellY + 1) || !keys.has(cellX * KEY_ROW + cellY - 1))
        rim.push(i);
      minX = Math.min(minX, cellX * cellSize);
      minY = Math.min(minY, cellY * cellSize);
      maxX = Math.max(maxX, (cellX + 1) * cellSize);
      maxY = Math.max(maxY, (cellY + 1) * cellSize);
    }
    out.push({ kind, gx: Int32Array.from(gx), gy: Int32Array.from(gy),
      rim: Uint32Array.from(rim), base: new Uint8Array(gx.length), bb: [minX, minY, maxX, maxY],
      G: cellSize });
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
  const out = buildMergedCovers(list, 0.5);
  LEVEL._mergedOf = list;
  LEVEL._merged = out;
  return out;
}

// CELLS FILED BY PLACE (owner 11-10: "Yes"): a merged cover's cells, and its rim's, filed by
// FILE_M square once, so a tile paint looks only at the squares it touches (same cells, same
// order). MEASURED (the venue helper, Yass Marina): the marina is ~194 000 cells, all filtered on
// every tile painted - covers.ts 6.6 % of the CPU x4 profile, the p95 34.9-35.1 ms (Spa 26.9-42.7).
const FILE_M = 16;
/** A list of cells filed by FILE_M square: each square's places in the list, ascending. */
type CellFile = Map<number, Uint32Array>;
const files = new WeakMap<object, CellFile>();
const fileKey = (fileX: number, fileY: number) => fileX * 65537 + fileY;

/**
 * A list's cells filed by FILE_M square (built once per list).
 * @param grp the merged cover
 * @param list its rim (cell indices), or null for all its cells
 * @returns square -> places in the list
 */
function fileOf(grp: MergedCover, list: Uint32Array | null): CellFile {
  const owner = list || grp.gx;
  let file = files.get(owner);
  if (file) return file;
  const count = list ? list.length : grp.gx.length, per = grp.G / FILE_M;
  const keyAt = (place: number) => {
    const cell = list ? list[place] : place;
    return fileKey(Math.floor(grp.gx[cell] * per), Math.floor(grp.gy[cell] * per));
  };
  const sizes = new Map<number, number>();
  for (let place = 0; place < count; place++) {
    const key = keyAt(place);
    sizes.set(key, (sizes.get(key) || 0) + 1);
  }
  file = new Map();
  const filled = new Map<number, number>();
  for (const [key, size] of sizes) { file.set(key, new Uint32Array(size)); filled.set(key, 0); }
  for (let place = 0; place < count; place++) {
    const key = keyAt(place), slot = filled.get(key)!;
    file.get(key)![slot] = place;
    filled.set(key, slot + 1);
  }
  files.set(owner, file);
  return file;
}

/**
 * The cells of a list that touch the visible rectangle, in the list's order: those filed in the
 * squares it touches, tested.
 *
 * @param grp the merged cover
 * @param list its rim (cell indices), or null for all its cells
 * @param viewRect the visible rectangle
 * @returns the cell indices in view
 */
function filterCellsInView(grp: MergedCover, list: Uint32Array | null, viewRect: ViewRect) {
  const { vx0, vx1, vy0, vy1 } = viewRect, cellSize = grp.G, file = fileOf(grp, list),
    near: number[] = [];
  for (let fileX = Math.floor((vx0 - cellSize) / FILE_M); fileX <= Math.floor(vx1 / FILE_M);
    fileX++)
    for (let fileY = Math.floor((vy0 - cellSize) / FILE_M); fileY <= Math.floor(vy1 / FILE_M);
      fileY++) {
      const places = file.get(fileKey(fileX, fileY));
      if (places) for (const place of places) near.push(place);
    }
  near.sort((first, second) => first - second);
  const out: number[] = [];
  for (const place of near) {
    const cell = list ? list[place] : place, x = grp.gx[cell] * cellSize,
      y = grp.gy[cell] * cellSize;
    if (x + cellSize >= vx0 && x <= vx1 && y + cellSize >= vy0 && y <= vy1) out.push(cell);
  }
  return out;
}

/**
 * Adds the cells as squares to a new path.
 *
 * @param groundCtx the shared ground painter context
 * @param grp the merged cover
 * @param cells the cell indices to trace
 */
function pathCells(groundCtx: GroundCtx, grp: MergedCover, cells: number[]) {
  const { view, PPMz, toScreenX, toScreenY } = groundCtx;
  const ppm = PPMz(), cellSize = grp.G;
  view.ctx.beginPath();
  for (const cell of cells)
    view.ctx.rect(toScreenX(grp.gx[cell] * cellSize), toScreenY(grp.gy[cell] * cellSize),
      cellSize * ppm, cellSize * ppm);
}

/**
 * The cells of a puddle grouped by the ground under each (looked up once per cell).
 * @param grp the merged cover
 * @param vis the puddle's cell indices in view
 * @returns the cells of each ground
 */
function cellsByGround(grp: MergedCover, vis: number[]): Map<string, number[]> {
  const groups = new Map<string, number[]>(), cellSize = grp.G;
  for (const cell of vis) {
    if (!grp.base[cell]) {
      const base = layersAt((grp.gx[cell] + 0.5) * cellSize, (grp.gy[cell] + 0.5) * cellSize).base;
      let ground = GROUND_OF.get(base);
      if (ground === undefined) { ground = GROUNDS.push(base); GROUND_OF.set(base, ground); }
      grp.base[cell] = ground;
    }
    const base = GROUNDS[grp.base[cell] - 1];
    let group = groups.get(base);
    if (!group) groups.set(base, (group = []));
    group.push(cell);
  }
  return groups;
}

/**
 * Paints a merged puddle: water tinted by the ground under each part, the water's
 * sheen and rings, a dark rim.
 *
 * @param groundCtx the shared ground painter context
 * @param grp the merged cover
 * @param vis its cell indices in view
 * @param viewRect the visible rectangle
 * @param box [x0, y0, x1, y1] of its visible bounding box in metres
 */
function paintPuddleCover(
  groundCtx: GroundCtx, grp: MergedCover, vis: number[], viewRect: ViewRect, box: number[]
) {
  const { view, toScreenX, toScreenY } = groundCtx;
  const [bx0, by0, bx1, by1] = box;
  for (const [base, cells] of cellsByGround(grp, vis)) {
    pathCells(groundCtx, grp, cells);
    view.ctx.fillStyle = puddleWater(base);
    view.ctx.fill();
  }
  pathCells(groundCtx, grp, vis);
  view.ctx.save();
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(groundCtx, 'puddle', bx0, by0, bx1, by1);
  view.ctx.restore();
  pathCells(groundCtx, grp, filterCellsInView(grp, grp.rim, viewRect));
  view.ctx.fillStyle = 'rgba(30,40,58,0.30)';
  view.ctx.fill();
}

/**
 * Paints a merged snow or ice cover: its art clipped to the cells, and a light rim.
 *
 * @param groundCtx the shared ground painter context
 * @param grp the merged cover
 * @param vis its cell indices in view
 * @param viewRect the visible rectangle
 * @param box [x0, y0, x1, y1] of its visible bounding box in metres
 */
function paintSolidCover(
  groundCtx: GroundCtx, grp: MergedCover, vis: number[], viewRect: ViewRect, box: number[]
) {
  const { view, toScreenX, toScreenY } = groundCtx;
  const [bx0, by0, bx1, by1] = box;
  pathCells(groundCtx, grp, vis);
  view.ctx.fillStyle = artBase(groundCtx, grp.kind, '#ffffff');
  view.ctx.fill();
  view.ctx.save();
  view.ctx.clip();
  view.ctx.translate(toScreenX(0), toScreenY(0));
  paintLayers(groundCtx, grp.kind, bx0, by0, bx1, by1);
  view.ctx.restore();
  pathCells(groundCtx, grp, filterCellsInView(grp, grp.rim, viewRect));
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
    const [minX, minY, maxX, maxY] = grp.bb;
    if (maxX < vx0 || minX > vx1 || maxY < vy0 || minY > vy1) continue;
    const vis = filterCellsInView(grp, null, viewRect);
    if (!vis.length) continue;
    const bx0 = Math.max(minX, vx0), by0 = Math.max(minY, vy0),
      bx1 = Math.min(maxX, vx1), by1 = Math.min(maxY, vy1);
    const box = [bx0, by0, bx1, by1];
    if (grp.kind === 'wet') paintPuddleCover(groundCtx, grp, vis, viewRect, box);
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
  drawCoversMerged(groundCtx, sceneryWater(list));
}

/** The scenery water of a covers list (cached on the list: a new list when covers change). */
const sceneryWaterOf = new WeakMap<Cover[], Cover[]>();
function sceneryWater(list: Cover[]): Cover[] {
  let water = sceneryWaterOf.get(list);
  if (!water) sceneryWaterOf.set(list, (water = list.filter((cover) => cover.water)));
  return water;
}

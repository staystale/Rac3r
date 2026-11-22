// render/ground/covermerge.ts - THE COVERS' CELLS MERGED (render/ground/covers.ts draws them): each
// cover's 0.5 m world-grid cells (coverCells), and per cover kind the union of every cover's cells
// with its rim (buildMergedCovers: the whole list at once). ?waterinc (mergedChunks): the same
// union by CHUNK_M square, each square's kept while the covers touching it are the same - the
// endless road makes a new covers list at every window move that lays water (highway/cuts.ts
// syncCovers), and the whole window's water was merged again: GETAWAY STOCKHOLM's 18-30 water
// pieces of 68 x 90 m, ~0.6 M cells (c13, PC CPU x4: a ~1 s worst frame there, ~0.2 s in the
// countryside). A square's cells and rim are the union's in it exactly (a rim cell's outside
// neighbour asked of every cover it could lie in); its ground lookups and filing, kept on its
// group, survive with it.
import { coverCut } from "../../world/wear.ts";
import type { Cover, CoverCells, CoverId, MergedCover } from "../../world/types.ts";

// a cell's key: its grid x times KEY_ROW plus its grid y
const KEY_ROW = 131071;

/**
 * Whether a point is inside a cover (the same test as world/wear.ts coverAt): its rotated box or
 * ellipse, less a river's dry band under the motorway.
 * @param cover the cover
 * @param x world x, m
 * @param y world y, m
 * @returns it is
 */
export function coverHas(cover: Cover, x: number, y: number): boolean {
  // the river's dry band under the motorway (lab.ts coverAt)
  if (cover.cut && coverCut(cover, x, y)) return false;
  const cosRot = Math.cos(cover.rot || 0), sinRot = Math.sin(cover.rot || 0);
  const halfW = cover.w / 2, halfH = cover.h / 2;
  const offX = x - cover.x, offY = y - cover.y,
    dx = offX * cosRot + offY * sinRot, dy = -offX * sinRot + offY * cosRot;
  return cover.shape === 'ellipse'
    ? (dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH) <= 1
    : Math.abs(dx) <= halfW && Math.abs(dy) <= halfH;
}

/**
 * Returns the 0.5 m world-grid cells whose centre is inside a cover, cached on the cover: their
 * grid coordinates (x / G, y / G) in pairs.
 *
 * @param cover the cover to measure
 * @returns the cells
 */
export function coverCells(cover: Cover): CoverCells {
  if (cover._cells) return cover._cells;
  const cellSize = 0.5, cosRot = Math.cos(cover.rot || 0), sinRot = Math.sin(cover.rot || 0),
    halfW = cover.w / 2, halfH = cover.h / 2;
  // scan the ROTATED box's extents, not a square of the long side (a 160 x 14 m river was a 160 m
  // square: 100k tests -> ~10k)
  const reachX = halfW * Math.abs(cosRot) + halfH * Math.abs(sinRot) + cellSize,
    reachY = halfW * Math.abs(sinRot) + halfH * Math.abs(cosRot) + cellSize;
  const inside = (x: number, y: number) => coverHas(cover, x, y);
  const all: number[] = [];
  for (let x = Math.floor((cover.x - reachX) / cellSize) * cellSize;
    x < cover.x + reachX; x += cellSize)
    for (let y = Math.floor((cover.y - reachY) / cellSize) * cellSize;
      y < cover.y + reachY; y += cellSize)
      if (inside(x + cellSize / 2, y + cellSize / 2))
        all.push(Math.round(x / cellSize), Math.round(y / cellSize));
  return (cover._cells = { all: Int32Array.from(all), G: cellSize });
}

/**
 * Builds the merged covers of each kind: the union of its covers' cells (in the covers' order,
 * each cell once), the rim cells, the bounding box.
 *
 * @param list the level covers
 * @param cellSize the cell size in metres
 * @returns the merged covers
 */
export function buildMergedCovers(list: Cover[], cellSize: number): MergedCover[] {
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

// ?waterinc: a chunk's side in cells (64 m at 0.5 m) - a window move rebuilds only the chunks
// whose covers changed
const CHUNK_CELLS = 128;
/** A chunk's merge, kept while the same covers (the same objects, in order) touch it. */
interface Chunk { covers: Cover[]; groups: MergedCover[] }
// the chunks of the level being drawn, by key
const chunks = new Map<number, Chunk>();
let chunksOf: object | null = null;
// a cover's cells' bounding box (grid cells), kept on the cover
const boxes = new WeakMap<Cover, [number, number, number, number]>();
const chunkKey = (chunkX: number, chunkY: number) => chunkX * 65537 + chunkY;

/**
 * A cover's cells' bounding box in grid cells (from coverCells, kept).
 * @param cover the cover
 * @returns [minX, minY, maxX, maxY]
 */
function boxOf(cover: Cover): [number, number, number, number] {
  let box = boxes.get(cover);
  if (box) return box;
  const all = coverCells(cover).all;
  box = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < all.length; i += 2) {
    box[0] = Math.min(box[0], all[i]);
    box[1] = Math.min(box[1], all[i + 1]);
    box[2] = Math.max(box[2], all[i]);
    box[3] = Math.max(box[3], all[i + 1]);
  }
  boxes.set(cover, box);
  return box;
}

/**
 * Whether a grid cell (outside a chunk) is a cover's of a kind: asked of every cover of the list
 * whose cells' box holds it (the inside test coverCells makes its cells with).
 * @param list the covers
 * @param kind the kind
 * @param cellX grid x
 * @param cellY grid y
 * @param cellSize m
 * @returns it is
 */
function cellOfKind(list: Cover[], kind: CoverId, cellX: number, cellY: number,
  cellSize: number): boolean {
  for (const cover of list) {
    if (cover.cover !== kind) continue;
    const box = boxOf(cover);
    if (cellX < box[0] || cellX > box[2] || cellY < box[1] || cellY > box[3]) continue;
    if (coverHas(cover, cellX * cellSize + cellSize / 2, cellY * cellSize + cellSize / 2))
      return true;
  }
  return false;
}

/** A chunk's cells as grid cells: from (inclusive) and up to (exclusive), each way. */
interface ChunkBounds { fromX: number; fromY: number; uptoX: number; uptoY: number }
/** A kind's cells being gathered: their keys, their grid x and y. */
interface KindCells { keys: Set<number>; gx: number[]; gy: number[] }

/**
 * A chunk's cells per kind: the union of its covers' cells inside it, in the covers' order, each
 * once.
 * @param list the covers touching the chunk
 * @param bounds the chunk's cells
 * @returns each kind's cells
 */
function chunkCells(list: Cover[], bounds: ChunkBounds): Map<CoverId, KindCells> {
  const kinds = new Map<CoverId, KindCells>();
  for (const cover of list) {
    let kind = kinds.get(cover.cover);
    if (!kind) kinds.set(cover.cover, (kind = { keys: new Set(), gx: [], gy: [] }));
    const own = coverCells(cover).all;
    for (let i = 0; i < own.length; i += 2) {
      const cellX = own[i], cellY = own[i + 1];
      if (cellX < bounds.fromX || cellX >= bounds.uptoX || cellY < bounds.fromY
        || cellY >= bounds.uptoY) continue;
      const key = cellX * KEY_ROW + cellY;
      if (kind.keys.has(key)) continue;
      kind.keys.add(key);
      kind.gx.push(cellX);
      kind.gy.push(cellY);
    }
  }
  return kinds;
}

/**
 * One kind's merged cover in a chunk: its cells, the rim (an outside neighbour - beyond the chunk
 * asked of the covers), the box.
 * @param list the covers touching the chunk
 * @param bounds the chunk's cells
 * @param kind the kind
 * @param cells its cells in the chunk
 * @param cellSize m
 * @returns the merged cover
 */
function chunkGroup(list: Cover[], bounds: ChunkBounds, kind: CoverId, cells: KindCells,
  cellSize: number): MergedCover {
  const { keys, gx, gy } = cells;
  const has = (cellX: number, cellY: number) => (cellX >= bounds.fromX && cellX < bounds.uptoX
    && cellY >= bounds.fromY && cellY < bounds.uptoY ? keys.has(cellX * KEY_ROW + cellY)
    : cellOfKind(list, kind, cellX, cellY, cellSize));
  const rim: number[] = [];
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < gx.length; i++) {
    const cellX = gx[i], cellY = gy[i];
    if (!has(cellX + 1, cellY) || !has(cellX - 1, cellY) || !has(cellX, cellY + 1)
      || !has(cellX, cellY - 1)) rim.push(i);
    minX = Math.min(minX, cellX * cellSize);
    minY = Math.min(minY, cellY * cellSize);
    maxX = Math.max(maxX, (cellX + 1) * cellSize);
    maxY = Math.max(maxY, (cellY + 1) * cellSize);
  }
  return { kind, gx: Int32Array.from(gx), gy: Int32Array.from(gy), rim: Uint32Array.from(rim),
    base: new Uint8Array(gx.length), bb: [minX, minY, maxX, maxY], G: cellSize };
}

/**
 * One chunk's merged covers per kind.
 * @param list the covers touching the chunk
 * @param chunkX the chunk's x (in chunks)
 * @param chunkY its y
 * @param cellSize m
 * @returns its merged covers
 */
function buildChunk(list: Cover[], chunkX: number, chunkY: number, cellSize: number)
  : MergedCover[] {
  const bounds: ChunkBounds = { fromX: chunkX * CHUNK_CELLS, fromY: chunkY * CHUNK_CELLS,
    uptoX: (chunkX + 1) * CHUNK_CELLS, uptoY: (chunkY + 1) * CHUNK_CELLS };
  const out: MergedCover[] = [];
  for (const [kind, cells] of chunkCells(list, bounds))
    if (cells.gx.length) out.push(chunkGroup(list, bounds, kind, cells, cellSize));
  return out;
}

/**
 * ?waterinc: the merged covers of a list by chunk - each chunk's built again only when the covers
 * touching it (one cell's margin round it: its rim's neighbours) are not the same objects as last
 * time; a chunk no cover touches dropped. Its groups keep their ground lookups and filing.
 * @param list the covers
 * @param owner whose chunks these are (a new level forgets them)
 * @param cellSize m
 * @returns the merged covers, chunk by chunk
 */
export function mergedChunks(list: Cover[], owner: object, cellSize = 0.5): MergedCover[] {
  if (chunksOf !== owner) {
    chunks.clear();
    chunksOf = owner;
  }
  const touching = new Map<number, { chunkX: number; chunkY: number; covers: Cover[] }>();
  for (const cover of list) {
    const box = boxOf(cover);
    if (box[0] > box[2]) continue;
    for (let chunkX = Math.floor((box[0] - 1) / CHUNK_CELLS);
      chunkX <= Math.floor((box[2] + 1) / CHUNK_CELLS); chunkX++)
      for (let chunkY = Math.floor((box[1] - 1) / CHUNK_CELLS);
        chunkY <= Math.floor((box[3] + 1) / CHUNK_CELLS); chunkY++) {
        const key = chunkKey(chunkX, chunkY);
        const there = touching.get(key);
        if (there) there.covers.push(cover); else touching.set(key, { chunkX, chunkY,
          covers: [cover] });
      }
  }
  const out: MergedCover[] = [];
  for (const [key, { chunkX, chunkY, covers }] of touching) {
    let chunk = chunks.get(key);
    if (!chunk || chunk.covers.length !== covers.length
      || chunk.covers.some((cover, i) => cover !== covers[i])) {
      chunk = { covers, groups: buildChunk(covers, chunkX, chunkY, cellSize) };
      chunks.set(key, chunk);
    }
    out.push(...chunk.groups);
  }
  for (const key of [...chunks.keys()]) if (!touching.has(key)) chunks.delete(key);
  return out;
}

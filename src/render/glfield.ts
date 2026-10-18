// THE COVER FIELD ON THE GPU (?coverfield=1; world/coverfield.ts). The weather's water, ice and
// snow lie where its levels are above each point's catch; here every FIELD_SQ square's catch (the
// same numbers the physics reads, computed on the CPU per CHUNK_SQ-square chunk into a
// world-anchored grid texture that wraps every GRID_SQ squares, like the hill shading) is
// compared with the levels per screen pixel, so the coat grows and shrinks with no ground
// repainting: a frame costs one texture read per pixel. A MASK texture keeps the field off what
// the tiles show instead: the level's own covers (zones, LEVEL.covers) and the wear cells the
// tyres changed (cleared, packed, polished). Squares whose chunk is not computed yet show no
// field (masked) until it is, within CHUNK_BUDGET_MS a frame, the view first. The mask also
// carries each square's LEVEL AREA (1..4, coverfield.ts AREA_KINDS: the level's own snow, ice,
// water, packed snow), whose own levels are tried before the weather's.
import { LEVEL } from "../world/state.ts";
import { wearMap, wearEpoch, wearKey, WEAR_CELL, layersAt } from "../world/wear.ts";
import {
  AREA_KINDS, AREAS, FIELD, FIELD_SQ, areaKindOf, catchAt, cellOwned, coverFieldOn, SNOW_SEED,
  WATER_SEED,
} from "../world/coverfield.ts";
import type { Levels } from "../world/coverfield.ts";
import { buildProgram } from "./glprogram.ts";
import type { PaintCamera } from "./glpaint.ts";
import type { ShadeRect } from "./glshade.ts";

const CHUNK_SQ = 16;               // squares per chunk side (8 m)
const GRID_CHUNKS = 64;            // chunks per side of the wrapping grid: 1024 squares, 512 m
const GRID_SQ = CHUNK_SQ * GRID_CHUNKS;
const CHUNK_M = CHUNK_SQ * FIELD_SQ;
// ms a frame for computing chunks (the view first, then what the widest zoom shows)
const CHUNK_BUDGET_MS = 2;
// squares per wear cell side (a wear cell is 1.5 m, a square 0.5 m: they share the grid)
const CELL_SQ = Math.round(WEAR_CELL / FIELD_SQ);

// a full-screen quad without vertex data
const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

// each pixel reads its square's catch and mask; a square is water, ice or snow by the levels
// (coverfield.ts fieldCoverAt), with a rim where a neighbour is not; the camera's square and its
// place inside it come from the CPU in double precision, so far from the origin nothing jitters
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform float canvasHeight;
uniform vec2 cameraPx;
uniform float devPerMetre;
uniform vec2 camInSq;          // the camera inside its square, m
uniform ivec2 camSq;           // the camera's square
uniform vec4 levels;           // the weather's water, snow, ice, packed snow
uniform vec4 areaLevels[4];    // each level area's (coverfield.ts AREA_KINDS)
uniform highp sampler2D catchTex;
uniform highp sampler2D maskTex;
out vec4 colour;
const int GRID = ${GRID_SQ};
const float SQ = ${FIELD_SQ.toFixed(2)};
// a square this far under its level has no bare neighbour (the catch moves less per square)
const float RIM_DEPTH = 0.2;
ivec2 slotOf(ivec2 square) { return ((square % GRID) + GRID) % GRID; }
// 0 nothing, 1 water, 2 ice, 3 snow, 4 packed snow (the order of coverfield.ts coverOfLevels)
int kindIn(vec4 lv, vec2 catchValue, out float depth) {
  if (lv.y > 0.0 && lv.y > catchValue.g) { depth = lv.y - catchValue.g; return 3; }
  if (lv.w > 0.0 && lv.w > catchValue.g) { depth = lv.w - catchValue.g; return 4; }
  if (catchValue.r < lv.x) { depth = lv.x - catchValue.r; return 1; }
  if (catchValue.r < lv.x + lv.z) { depth = lv.x + lv.z - catchValue.r; return 2; }
  depth = 0.0;
  return 0;
}
// -1 the tiles show it (masked); else the square's area's cover, then the weather's
int kindOf(ivec2 square, out float depth) {
  ivec2 slot = slotOf(square);
  int code = int(texelFetch(maskTex, slot, 0).r * 255.0 + 0.5);
  depth = 0.0;
  if (code == 255) return -1;
  vec2 catchValue = texelFetch(catchTex, slot, 0).rg;
  int kind = code > 0 ? kindIn(areaLevels[code - 1], catchValue, depth) : 0;
  return kind > 0 ? kind : kindIn(levels, catchValue, depth);
}
void main() {
  vec2 device = vec2(gl_FragCoord.x, canvasHeight - gl_FragCoord.y);
  vec2 fromCamera = (device - cameraPx) / devPerMetre;
  ivec2 square = camSq + ivec2(floor((fromCamera + camInSq) / SQ));
  float depth, other;
  int kind = kindOf(square, depth);
  if (kind <= 0) discard;
  // the rim: where a neighbour is bare ground (not another cover, not the tiles' own); deep in a
  // patch (the level well above the catch) no neighbour can be, and the reads are skipped
  bool rim = depth < RIM_DEPTH && (kindOf(square + ivec2(1, 0), other) == 0
    || kindOf(square - ivec2(1, 0), other) == 0
    || kindOf(square + ivec2(0, 1), other) == 0
    || kindOf(square - ivec2(0, 1), other) == 0);
  float thick = clamp(depth * 8.0, 0.0, 1.0);
  // a faint diagonal sheen across water and ice, square by square
  float sheen = fract(float(square.x + square.y) * 0.083) < 0.12 ? 1.0 : 0.0;
  vec4 look;
  if (kind == 1) {
    look = rim ? vec4(0.12, 0.16, 0.23, 0.42)
      : vec4(mix(vec3(0.31, 0.39, 0.55), vec3(0.62, 0.70, 0.80), sheen * 0.35),
        0.32 + 0.26 * thick);
  } else if (kind == 2) {
    look = rim ? vec4(0.92, 0.95, 0.98, 0.7)
      : vec4(mix(vec3(0.70, 0.82, 0.90), vec3(0.92, 0.96, 1.0), sheen * 0.5), 0.62 + 0.2 * thick);
  } else if (kind == 3) {
    look = rim ? vec4(0.63, 0.71, 0.80, 0.6) : vec4(0.94, 0.95, 0.98, 0.72 + 0.26 * thick);
  } else {
    look = rim ? vec4(0.55, 0.60, 0.68, 0.7) : vec4(0.83, 0.86, 0.91, 0.82 + 0.16 * thick);
  }
  colour = vec4(look.rgb * look.a, look.a);
}`;

const UNIFORMS = [
  'canvasHeight', 'cameraPx', 'devPerMetre', 'camInSq', 'camSq', 'levels', 'areaLevels', 'catchTex',
  'maskTex',
] as const;
type Uniforms = Record<typeof UNIFORMS[number], WebGLUniformLocation | null>;

/** The grid: which chunk each slot holds, and what made it. */
interface FieldGrid {
  owner: Float64Array;       // per slot: the key of the chunk computed into it (NaN = none)
  blank: Float64Array;       // per slot: the key of the chunk it was masked for, not computed yet
  catchPixels: Uint8Array;   // one chunk of catch (RG), reused
  maskPixels: Uint8Array;    // one chunk of mask (R), reused
  level: unknown;            // the level, track layout and wear epoch the chunks were made for
  layout: number;
  epoch: number;
  everywhere: boolean;       // the level's ground is a level area: every square is tested
  anyArea: boolean;          // the level has a level area anywhere (then the field is drawn always)
}

/** Whether a set of levels covers anything at all. */
const levelsShow = (levels: Levels) => levels.water + levels.snow + levels.ice + levels.packed > 0;

/** a number modulo a count, never negative */
const wrapIndex = (index: number, count: number) => ((index % count) + count) % count;

/** the key of a chunk (chunk indices stay far inside +-500000) */
const chunkKey = (chunkX: number, chunkY: number) => chunkX * 1e6 + chunkY;

/**
 * A texture of the grid's size, one or two 8-bit channels, nearest filtered.
 * @param webgl the WebGL2 context
 * @param channels 1 (R) or 2 (RG)
 * @param fill the starting value of every byte
 * @returns the texture
 */
function gridTexture(webgl: WebGL2RenderingContext, channels: 1 | 2, fill: number) {
  const tex = webgl.createTexture()!;
  const [internal, format] = channels === 1 ? [webgl.R8, webgl.RED] : [webgl.RG8, webgl.RG];
  webgl.bindTexture(webgl.TEXTURE_2D, tex);
  webgl.pixelStorei(webgl.UNPACK_ALIGNMENT, 1);
  webgl.texImage2D(webgl.TEXTURE_2D, 0, internal, GRID_SQ, GRID_SQ, 0, format, webgl.UNSIGNED_BYTE,
    new Uint8Array(GRID_SQ * GRID_SQ * channels).fill(fill));
  for (const param of [webgl.TEXTURE_MIN_FILTER, webgl.TEXTURE_MAG_FILTER]) {
    webgl.texParameteri(webgl.TEXTURE_2D, param, webgl.NEAREST);
  }
  webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.CLAMP_TO_EDGE);
  webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.CLAMP_TO_EDGE);
  return tex;
}

/**
 * Whether the level's ground itself, its road or its lanes are a level area (a snow stage): then
 * every square is tested.
 * @returns true for such a level
 */
function groundIsArea(): boolean {
  if (LEVEL.base && areaKindOf(LEVEL.base.id)) return true;
  if (LEVEL.subtrack && LEVEL.subtrack.sectors.some((sector) => areaKindOf(sector.surface.id))) {
    return true;
  }
  return (LEVEL.lanes || []).some((lane) => areaKindOf(lane.surface.id));
}

/**
 * Whether the level lays a cover of its own anywhere over a world rectangle: its ground, an area
 * zone, or a level cover whose box reaches it (then the chunk's squares are tested one by one).
 * @param rect the rectangle, m
 * @param everywhere groundIsArea() for this level
 * @returns true when one may
 */
function levelCoversNear(rect: ShadeRect, everywhere: boolean): boolean {
  if (everywhere) return true;
  const reaches = (area: { x: number; y: number; w: number; h: number }) => {
    const reach = Math.hypot(area.w, area.h) / 2;
    return area.x + reach >= rect.x0 && area.x - reach <= rect.x1
      && area.y + reach >= rect.y0 && area.y - reach <= rect.y1;
  };
  for (const zone of LEVEL.zones || []) {
    if (areaKindOf(zone.surface.id) && reaches(zone)) return true;
  }
  for (const cover of LEVEL._staticCovers || LEVEL.covers || []) if (reaches(cover)) return true;
  return false;
}

/**
 * A square's mask byte: 255 the tiles show it (scenery water), else its level area's code
 * (1..4) or 0.
 * @param x the square's centre x, m
 * @param y the square's centre y, m
 * @returns the byte
 */
function squareCode(x: number, y: number): number {
  const layers = layersAt(x, y);
  if (layers.fixed) return 255;
  const kind = layers.area ? areaKindOf(layers.area) : null;
  return kind ? AREA_KINDS.indexOf(kind) + 1 : 0;
}

/**
 * Masks the squares of the wear cells the tyres changed (or the level fixed) inside a chunk.
 * @param grid the grid
 * @param chunkX the chunk column
 * @param chunkY the chunk row
 */
function maskWornCells(grid: FieldGrid, chunkX: number, chunkY: number) {
  const firstSq = { x: chunkX * CHUNK_SQ, y: chunkY * CHUNK_SQ };
  const cellX0 = Math.floor(firstSq.x / CELL_SQ), cellY0 = Math.floor(firstSq.y / CELL_SQ);
  const cellX1 = Math.floor((firstSq.x + CHUNK_SQ - 1) / CELL_SQ);
  const cellY1 = Math.floor((firstSq.y + CHUNK_SQ - 1) / CELL_SQ);
  for (let cellY = cellY0; cellY <= cellY1; cellY++) {
    for (let cellX = cellX0; cellX <= cellX1; cellX++) {
      const cell = wearMap.get(wearKey(cellX, cellY));
      if (cell && cellOwned(cell)) maskCellSquares(grid, cellX, cellY, firstSq);
    }
  }
}

/**
 * Masks one wear cell's squares in the chunk being computed.
 * @param grid the grid
 * @param cellX the cell column
 * @param cellY the cell row
 * @param firstSq the chunk's first square
 */
function maskCellSquares(grid: FieldGrid, cellX: number, cellY: number,
    firstSq: { x: number; y: number }) {
  for (let row = 0; row < CELL_SQ; row++) {
    for (let col = 0; col < CELL_SQ; col++) {
      const sqX = cellX * CELL_SQ + col - firstSq.x, sqY = cellY * CELL_SQ + row - firstSq.y;
      if (sqX >= 0 && sqX < CHUNK_SQ && sqY >= 0 && sqY < CHUNK_SQ) {
        grid.maskPixels[sqY * CHUNK_SQ + sqX] = 255;
      }
    }
  }
}

/**
 * Computes one chunk's catch and mask and uploads them into its slot.
 * @param webgl the WebGL2 context
 * @param tex the catch and mask textures
 * @param grid the grid
 * @param chunkX the chunk column (world x / CHUNK_M)
 * @param chunkY the chunk row
 */
function computeChunk(webgl: WebGL2RenderingContext, tex: { catchTex: WebGLTexture;
    maskTex: WebGLTexture }, grid: FieldGrid, chunkX: number, chunkY: number) {
  const minX = chunkX * CHUNK_M, minY = chunkY * CHUNK_M;
  const levelCovers = levelCoversNear({
    x0: minX, y0: minY, x1: minX + CHUNK_M, y1: minY + CHUNK_M,
  }, grid.everywhere);
  for (let row = 0; row < CHUNK_SQ; row++) {
    for (let col = 0; col < CHUNK_SQ; col++) {
      const x = minX + (col + 0.5) * FIELD_SQ, y = minY + (row + 0.5) * FIELD_SQ;
      const index = row * CHUNK_SQ + col;
      grid.catchPixels[index * 2] = Math.round(catchAt(x, y, WATER_SEED) * 255);
      grid.catchPixels[index * 2 + 1] = Math.round(catchAt(x, y, SNOW_SEED) * 255);
      grid.maskPixels[index] = levelCovers ? squareCode(x, y) : 0;
    }
  }
  maskWornCells(grid, chunkX, chunkY);
  const slotX = wrapIndex(chunkX, GRID_CHUNKS), slotY = wrapIndex(chunkY, GRID_CHUNKS);
  upload(webgl, tex.catchTex, webgl.RG, slotX * CHUNK_SQ, slotY * CHUNK_SQ, CHUNK_SQ, CHUNK_SQ,
    grid.catchPixels);
  upload(webgl, tex.maskTex, webgl.RED, slotX * CHUNK_SQ, slotY * CHUNK_SQ, CHUNK_SQ, CHUNK_SQ,
    grid.maskPixels);
  grid.owner[slotY * GRID_CHUNKS + slotX] = chunkKey(chunkX, chunkY);
}

/**
 * Uploads a block of 8-bit texels (bytes as they are: no premultiplying, tight rows).
 * @param webgl the WebGL2 context
 * @param tex the texture
 * @param format RED or RG
 * @param left the block's first column
 * @param top the block's first row
 * @param width its width
 * @param height its height
 * @param pixels its bytes
 */
function upload(webgl: WebGL2RenderingContext, tex: WebGLTexture, format: number, left: number,
    top: number, width: number, height: number, pixels: Uint8Array) {
  webgl.bindTexture(webgl.TEXTURE_2D, tex);
  webgl.pixelStorei(webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  webgl.pixelStorei(webgl.UNPACK_ALIGNMENT, 1);
  webgl.texSubImage2D(webgl.TEXTURE_2D, 0, left, top, width, height, format, webgl.UNSIGNED_BYTE,
    pixels);
  webgl.pixelStorei(webgl.UNPACK_ALIGNMENT, 4);
  webgl.pixelStorei(webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
}

/**
 * Sets one wear cell's squares in the mask (tyres own it, or the field shows), if its chunk is
 * computed (a chunk computed later masks its cells itself).
 * @param webgl the WebGL2 context
 * @param maskTex the mask texture
 * @param grid the grid
 * @param cellX the cell column
 * @param cellY the cell row
 * @param cellMask a reused CELL_SQ x CELL_SQ block
 */
function maskCell(webgl: WebGL2RenderingContext, maskTex: WebGLTexture, grid: FieldGrid,
    cellX: number, cellY: number, cellMask: Uint8Array) {
  const sqX = cellX * CELL_SQ, sqY = cellY * CELL_SQ;
  const chunkX = Math.floor(sqX / CHUNK_SQ), chunkY = Math.floor(sqY / CHUNK_SQ);
  const slot = wrapIndex(chunkY, GRID_CHUNKS) * GRID_CHUNKS + wrapIndex(chunkX, GRID_CHUNKS);
  if (grid.owner[slot] !== chunkKey(chunkX, chunkY)) return;
  const cell = wearMap.get(wearKey(cellX, cellY));
  if (cell && cellOwned(cell)) cellMask.fill(255);
  else {
    for (let row = 0; row < CELL_SQ; row++) {
      for (let col = 0; col < CELL_SQ; col++) {
        cellMask[row * CELL_SQ + col] = squareCode((sqX + col + 0.5) * FIELD_SQ,
          (sqY + row + 0.5) * FIELD_SQ);
      }
    }
  }
  upload(webgl, maskTex, webgl.RED, wrapIndex(sqX, GRID_SQ), wrapIndex(sqY, GRID_SQ), CELL_SQ,
    CELL_SQ, cellMask);
}

/**
 * Brings the chunks over a rectangle up to date: those still missing at the deadline are masked
 * (no field there yet, never another chunk's squares).
 * @param webgl the WebGL2 context
 * @param tex the textures
 * @param grid the grid
 * @param rect the rectangle, m
 * @param deadline performance.now() to stop computing at
 */
function fillRect(webgl: WebGL2RenderingContext, tex: { catchTex: WebGLTexture;
    maskTex: WebGLTexture }, grid: FieldGrid, rect: ShadeRect, deadline: number) {
  const left = Math.floor(rect.x0 / CHUNK_M), right = Math.floor(rect.x1 / CHUNK_M);
  const top = Math.floor(rect.y0 / CHUNK_M), bottom = Math.floor(rect.y1 / CHUNK_M);
  const fullMask = new Uint8Array(CHUNK_SQ * CHUNK_SQ).fill(255);
  for (let chunkY = top; chunkY <= bottom; chunkY++) {
    for (let chunkX = left; chunkX <= right; chunkX++) {
      const slotX = wrapIndex(chunkX, GRID_CHUNKS), slotY = wrapIndex(chunkY, GRID_CHUNKS);
      const slot = slotY * GRID_CHUNKS + slotX, key = chunkKey(chunkX, chunkY);
      if (grid.owner[slot] === key) continue;
      if (performance.now() < deadline) {
        computeChunk(webgl, tex, grid, chunkX, chunkY);
        continue;
      }
      if (grid.blank[slot] === key) continue;
      upload(webgl, tex.maskTex, webgl.RED, slotX * CHUNK_SQ, slotY * CHUNK_SQ, CHUNK_SQ, CHUNK_SQ,
        fullMask);
      grid.owner[slot] = NaN;
      grid.blank[slot] = key;
    }
  }
}

/**
 * Forgets every chunk when the level, its track layout or the wear epoch changed.
 * @param grid the grid
 * @returns true when it did
 */
function resetOnChange(grid: FieldGrid) {
  const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;
  if (grid.level === LEVEL && grid.layout === layout && grid.epoch === wearEpoch) return false;
  grid.owner.fill(NaN);
  grid.blank.fill(NaN);
  const everywhere = groundIsArea();
  const anyArea = everywhere || (LEVEL.zones || []).some((zone) => areaKindOf(zone.surface.id))
    || (LEVEL._staticCovers || LEVEL.covers || []).some((cover) => !cover.water);
  Object.assign(grid, { level: LEVEL, layout, epoch: wearEpoch, everywhere, anyArea });
  return true;
}

/**
 * Creates the cover field on the GPU ground's WebGL2 context.
 * @param webgl the context of the GPU ground canvas
 * @returns the field, or null when its shader does not compile
 */
export function createGlField(webgl: WebGL2RenderingContext) {
  let program: WebGLProgram;
  try { program = buildProgram(webgl, VERTEX, FRAGMENT, 'cover field'); } catch { return null; }
  const uniforms = {} as Uniforms;
  for (const name of UNIFORMS) uniforms[name] = webgl.getUniformLocation(program, name);
  const vao = webgl.createVertexArray();
  const tex = { catchTex: gridTexture(webgl, 2, 255), maskTex: gridTexture(webgl, 1, 255) };
  const grid: FieldGrid = {
    owner: new Float64Array(GRID_CHUNKS * GRID_CHUNKS).fill(NaN),
    blank: new Float64Array(GRID_CHUNKS * GRID_CHUNKS).fill(NaN),
    catchPixels: new Uint8Array(CHUNK_SQ * CHUNK_SQ * 2),
    maskPixels: new Uint8Array(CHUNK_SQ * CHUNK_SQ), level: null, layout: 0, epoch: -1,
    everywhere: false, anyArea: false,
  };
  const areaLevels = new Float32Array(AREA_KINDS.length * 4);
  const cellMask = new Uint8Array(CELL_SQ * CELL_SQ);
  return {
    /**
     * Brings the chunks up to date within the budget: the view first, then what the widest zoom
     * would show.
     * @param view the world rectangle on screen now, m
     * @param widest the world rectangle the widest zoom would show, with a margin, m
     */
    update(view: ShadeRect, widest: ShadeRect) {
      if (!coverFieldOn()) return;
      resetOnChange(grid);
      const deadline = performance.now() + CHUNK_BUDGET_MS;
      fillRect(webgl, tex, grid, view, deadline);
      fillRect(webgl, tex, grid, widest, deadline);
    },
    /**
     * The wear cells over a rectangle changed (the tyres): their squares' mask follows.
     * @param rect the rectangle, m
     */
    cellsChanged(rect: ShadeRect) {
      if (!coverFieldOn()) return;
      for (let cellY = Math.floor(rect.y0 / WEAR_CELL); cellY * WEAR_CELL < rect.y1; cellY++) {
        for (let cellX = Math.floor(rect.x0 / WEAR_CELL); cellX * WEAR_CELL < rect.x1; cellX++) {
          maskCell(webgl, tex.maskTex, grid, cellX, cellY, cellMask);
        }
      }
    },
    /**
     * Draws the field over the ground (before the hill shading).
     * @param size the canvas size, device px
     * @param camera where the world lands on the canvas this frame
     */
    draw(size: { width: number; height: number }, camera: PaintCamera) {
      if (!coverFieldOn() || (!levelsShow(FIELD) && !grid.anyArea)) return;
      webgl.useProgram(program);
      webgl.bindVertexArray(vao);
      webgl.activeTexture(webgl.TEXTURE2);
      webgl.bindTexture(webgl.TEXTURE_2D, tex.catchTex);
      webgl.activeTexture(webgl.TEXTURE3);
      webgl.bindTexture(webgl.TEXTURE_2D, tex.maskTex);
      webgl.activeTexture(webgl.TEXTURE0);
      webgl.uniform1i(uniforms.catchTex, 2);
      webgl.uniform1i(uniforms.maskTex, 3);
      webgl.uniform1f(uniforms.canvasHeight, size.height);
      webgl.uniform2f(uniforms.cameraPx, camera.screenX, camera.screenY);
      webgl.uniform1f(uniforms.devPerMetre, camera.devPerMetre);
      const sqX = Math.floor(camera.x / FIELD_SQ), sqY = Math.floor(camera.y / FIELD_SQ);
      webgl.uniform2f(uniforms.camInSq, camera.x - sqX * FIELD_SQ, camera.y - sqY * FIELD_SQ);
      webgl.uniform2i(uniforms.camSq, sqX, sqY);
      webgl.uniform4f(uniforms.levels, FIELD.water, FIELD.snow, FIELD.ice, FIELD.packed);
      AREA_KINDS.forEach((kind, index) => {
        const area = AREAS[kind];
        areaLevels.set([area.water, area.snow, area.ice, area.packed], index * 4);
      });
      webgl.uniform4fv(uniforms.areaLevels, areaLevels);
      webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

export type GlField = NonNullable<ReturnType<typeof createGlField>>;

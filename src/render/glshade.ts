// HILL SHADING ON THE GPU (the default, ?gpupaint=0 = off; step B of "ground on the GPU"). The
// tiles bake the hill shading into each zoom step's pictures, so when the zoom reached a new step
// the ground showed unshaded (brighter) until that step's tiles were painted. Here the same shade
// cells as the tiles (tilesShade.ts: a SHADE_CELL_M world grid, the same heights, bands and
// colours) are computed once per CHUNK_CELLS-square chunk on the CPU into a world-anchored grid
// texture that wraps every GRID_CELLS cells, kept for everything the widest zoom can show (plus a
// margin), and drawn over the ground every frame. A zoom change never needs a cell that is not
// there yet.
import { LEVEL } from "../world/state.ts";
import { wearEpoch } from "../world/wear.ts";
import { TEX_PPM } from "./textures.ts";
import { SHADE_CELL_M, sampleHeights, shadeLevels, shadeTint } from "./tilesShade.ts";
import { wrapTexels } from "./glpaint.ts";
import type { PaintCamera } from "./glpaint.ts";

const CHUNK_CELLS = 16;             // cells per chunk side (8 m)
const GRID_CHUNKS = 64;             // chunks per side of the wrapping grid: 1024 cells, 512 m
const GRID_CELLS = CHUNK_CELLS * GRID_CHUNKS;
const CHUNK_M = CHUNK_CELLS * SHADE_CELL_M;
// ms a frame for chunks outside the current view (the ones inside are always done at once)
const SHADE_BUDGET_MS = 2;

/** A world rectangle, m. */
export interface ShadeRect { x0: number; y0: number; x1: number; y1: number }

// a full-screen quad without vertex data
const VERTEX = `#version 300 es
void main() {
  vec2 corner = vec2(gl_VertexID & 1, gl_VertexID >> 1);
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

// each screen pixel reads the cell under it (under its texel's centre when a texel is bigger than
// a pixel, so cell edges sit on the same world texel grid as the ground); the camera's cell and
// its position inside it come from the CPU in double precision, so far from the origin the cells
// do not jitter
const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform float canvasHeight;
uniform vec2 cameraPx;
uniform float devPerMetre;
uniform float texPerMetre;
uniform vec2 camTexel;
uniform vec2 camInCell;      // the camera inside its shade cell, m
uniform ivec2 camCell;       // the camera's cell, wrapped to the grid
uniform float cellSize;
uniform highp sampler2D shade;
out vec4 colour;
const int GRID = ${GRID_CELLS};
void main() {
  vec2 device = vec2(gl_FragCoord.x, canvasHeight - gl_FragCoord.y);
  vec2 fromCamera = (device - cameraPx) / devPerMetre;
  if (devPerMetre >= texPerMetre) {
    vec2 texel = fromCamera * texPerMetre + camTexel;
    fromCamera = (floor(texel) + 0.5 - camTexel) / texPerMetre;
  }
  ivec2 slot = (camCell + ivec2(floor((fromCamera + camInCell) / cellSize))) % GRID;
  colour = texelFetch(shade, (slot + GRID) % GRID, 0);
}`;

const UNIFORMS = [
  'canvasHeight', 'cameraPx', 'devPerMetre', 'texPerMetre', 'camTexel', 'camInCell', 'camCell',
  'cellSize', 'shade',
] as const;
type Uniforms = Record<typeof UNIFORMS[number], WebGLUniformLocation | null>;

/** The grid: which chunk each slot holds, and what made the cells. */
interface ShadeGrid {
  owner: Float64Array;       // per slot: the key of the chunk it holds (NaN = none)
  stale: Uint8Array;         // per slot: 1 = the ground height changed there, refresh in budget
  pixels: Uint8Array;        // one chunk of premultiplied RGBA, reused
  level: unknown;            // the level, track layout and wear epoch the cells were made for
  layout: number;
  epoch: number;
  chunks: number;            // chunks computed so far (tools)
  ms: number;                // ms spent computing them (tools)
}

/**
 * Compiles and links the shade program.
 * @param webgl the WebGL2 context
 * @returns the program
 */
function buildShadeProgram(webgl: WebGL2RenderingContext) {
  const program = webgl.createProgram()!;
  for (const [kind, source] of [[webgl.VERTEX_SHADER, VERTEX], [webgl.FRAGMENT_SHADER, FRAGMENT]] as
      const) {
    const shader = webgl.createShader(kind)!;
    webgl.shaderSource(shader, source);
    webgl.compileShader(shader);
    if (!webgl.getShaderParameter(shader, webgl.COMPILE_STATUS)) {
      throw new Error('hill shade shader: ' + webgl.getShaderInfoLog(shader));
    }
    webgl.attachShader(program, shader);
  }
  webgl.linkProgram(program);
  if (!webgl.getProgramParameter(program, webgl.LINK_STATUS)) {
    throw new Error('hill shade program: ' + webgl.getProgramInfoLog(program));
  }
  return program;
}

/**
 * The empty grid texture (all cells unshaded).
 * @param webgl the WebGL2 context
 * @returns the texture
 */
function buildGridTexture(webgl: WebGL2RenderingContext) {
  const tex = webgl.createTexture()!;
  webgl.bindTexture(webgl.TEXTURE_2D, tex);
  webgl.texImage2D(webgl.TEXTURE_2D, 0, webgl.RGBA, GRID_CELLS, GRID_CELLS, 0, webgl.RGBA,
    webgl.UNSIGNED_BYTE, null);
  webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MIN_FILTER, webgl.NEAREST);
  webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_MAG_FILTER, webgl.NEAREST);
  webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_S, webgl.CLAMP_TO_EDGE);
  webgl.texParameteri(webgl.TEXTURE_2D, webgl.TEXTURE_WRAP_T, webgl.CLAMP_TO_EDGE);
  return tex;
}

/** a number modulo a count, never negative */
const wrapIndex = (index: number, count: number) => ((index % count) + count) % count;

/** the key of a chunk (chunk indices stay far inside +-500000) */
const chunkKey = (chunkX: number, chunkY: number) => chunkX * 1e6 + chunkY;

/**
 * Computes one chunk's cells (tilesShade.ts heights, bands and colours) and uploads them into its
 * slot of the grid texture.
 * @param webgl the WebGL2 context
 * @param grid the grid
 * @param chunkX the chunk column (world x / CHUNK_M)
 * @param chunkY the chunk row
 */
function computeChunk(webgl: WebGL2RenderingContext, grid: ShadeGrid, chunkX: number,
    chunkY: number) {
  const startMs = performance.now();
  const cells = CHUNK_CELLS, cell = SHADE_CELL_M, pixels = grid.pixels;
  const minX = chunkX * CHUNK_M, minY = chunkY * CHUNK_M;
  const heights = sampleHeights(cells, cell, CHUNK_M, minX + CHUNK_M / 2, minY + CHUNK_M / 2);
  const { levels } = shadeLevels(heights, cells, cell);
  for (let index = 0; index < levels.length; index++) {
    const level = levels[index], strength = Math.abs(level), offset = index * 4;
    const tint = level === 0 ? null : shadeTint(level, minX + ((index % cells) + 0.5) * cell,
      minY + (Math.floor(index / cells) + 0.5) * cell);
    pixels[offset] = tint ? Math.round(tint[0] * strength) : 0;
    pixels[offset + 1] = tint ? Math.round(tint[1] * strength) : 0;
    pixels[offset + 2] = tint ? Math.round(tint[2] * strength) : 0;
    pixels[offset + 3] = Math.round(strength * 255);
  }
  const slotX = wrapIndex(chunkX, GRID_CHUNKS), slotY = wrapIndex(chunkY, GRID_CHUNKS);
  // the cells are already premultiplied: the GPU ground's context premultiplies uploads otherwise
  webgl.pixelStorei(webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  webgl.texSubImage2D(webgl.TEXTURE_2D, 0, slotX * cells, slotY * cells, cells, cells, webgl.RGBA,
    webgl.UNSIGNED_BYTE, pixels);
  webgl.pixelStorei(webgl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  grid.owner[slotY * GRID_CHUNKS + slotX] = chunkKey(chunkX, chunkY);
  grid.chunks++;
  grid.ms += performance.now() - startMs;
}

/**
 * Computes every missing chunk over a world rectangle: all of them, or (with a deadline) until
 * the time is up.
 * @param webgl the WebGL2 context
 * @param grid the grid
 * @param rect the rectangle, m
 * @param deadline performance.now() to stop at, or Infinity
 */
function fillRect(webgl: WebGL2RenderingContext, grid: ShadeGrid, rect: ShadeRect,
    deadline: number) {
  const left = Math.floor(rect.x0 / CHUNK_M), right = Math.floor(rect.x1 / CHUNK_M);
  const top = Math.floor(rect.y0 / CHUNK_M), bottom = Math.floor(rect.y1 / CHUNK_M);
  for (let chunkY = top; chunkY <= bottom; chunkY++) {
    for (let chunkX = left; chunkX <= right; chunkX++) {
      const slot = wrapIndex(chunkY, GRID_CHUNKS) * GRID_CHUNKS + wrapIndex(chunkX, GRID_CHUNKS);
      if (grid.owner[slot] === chunkKey(chunkX, chunkY)) continue;
      if (performance.now() > deadline) return;
      computeChunk(webgl, grid, chunkX, chunkY);
    }
  }
}

/**
 * Forgets every chunk when the level, its track layout or the wear epoch changed.
 * @param grid the grid
 */
function resetOnChange(grid: ShadeGrid) {
  const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;
  if (grid.level === LEVEL && grid.layout === layout && grid.epoch === wearEpoch) return;
  grid.owner.fill(NaN);
  grid.stale.fill(0);
  Object.assign(grid, { level: LEVEL, layout, epoch: wearEpoch });
}

/**
 * Creates the GPU hill shading on the GPU ground's WebGL2 context.
 * @param webgl the context of the GPU ground canvas
 * @returns the shading, or null when its shader does not compile
 */
export function createGlShade(webgl: WebGL2RenderingContext) {
  let program: WebGLProgram;
  try { program = buildShadeProgram(webgl); } catch { return null; }
  const uniforms = {} as Uniforms;
  for (const name of UNIFORMS) uniforms[name] = webgl.getUniformLocation(program, name);
  const vao = webgl.createVertexArray();
  const tex = buildGridTexture(webgl);
  const grid: ShadeGrid = {
    owner: new Float64Array(GRID_CHUNKS * GRID_CHUNKS).fill(NaN),
    stale: new Uint8Array(GRID_CHUNKS * GRID_CHUNKS),
    pixels: new Uint8Array(CHUNK_CELLS * CHUNK_CELLS * 4), level: null, layout: 0, epoch: -1,
    chunks: 0, ms: 0,
  };
  return {
    /** chunks computed and the ms they took, for the tools */
    get stats() { return { chunks: grid.chunks, ms: grid.ms }; },
    /**
     * Brings the cells up to date: everything in view now, then (within SHADE_BUDGET_MS) the
     * rest of what the widest zoom would show.
     * @param view the world rectangle on screen now, m
     * @param widest the world rectangle the widest zoom would show, with a margin, m
     */
    update(view: ShadeRect, widest: ShadeRect) {
      resetOnChange(grid);
      webgl.bindTexture(webgl.TEXTURE_2D, tex);
      fillRect(webgl, grid, view, Infinity);
      const deadline = performance.now() + SHADE_BUDGET_MS;
      refreshStale(webgl, grid, deadline);
      fillRect(webgl, grid, widest, deadline);
    },
    /**
     * Marks the chunks over a world rectangle stale (the ground height changed there: ruts, or
     * wear pruned on the highway). They keep their shading until refreshed within the budget,
     * as the tiles do: computing them at once made frames of 30+ ms.
     * @param rect the rectangle, m; grown by a cell, since a cell's slope reads its neighbours
     */
    invalidate(rect: ShadeRect) {
      markStale(grid, rect);
    },
    /**
     * Draws the shading over everything on the GPU canvas.
     * @param size the canvas size, device px
     * @param camera where the world lands on the canvas this frame
     */
    draw(size: { width: number; height: number }, camera: PaintCamera) {
      webgl.useProgram(program);
      webgl.bindVertexArray(vao);
      webgl.bindTexture(webgl.TEXTURE_2D, tex);
      webgl.uniform1i(uniforms.shade, 0);
      webgl.uniform1f(uniforms.canvasHeight, size.height);
      webgl.uniform2f(uniforms.cameraPx, camera.screenX, camera.screenY);
      webgl.uniform1f(uniforms.devPerMetre, camera.devPerMetre);
      webgl.uniform1f(uniforms.texPerMetre, TEX_PPM);
      webgl.uniform2f(uniforms.camTexel, wrapTexels(camera.x), wrapTexels(camera.y));
      const cellX = Math.floor(camera.x / SHADE_CELL_M);
      const cellY = Math.floor(camera.y / SHADE_CELL_M);
      webgl.uniform2f(uniforms.camInCell, camera.x - cellX * SHADE_CELL_M,
        camera.y - cellY * SHADE_CELL_M);
      webgl.uniform2i(uniforms.camCell, wrapIndex(cellX, GRID_CELLS), wrapIndex(cellY, GRID_CELLS));
      webgl.uniform1f(uniforms.cellSize, SHADE_CELL_M);
      webgl.drawArrays(webgl.TRIANGLE_STRIP, 0, 4);
    },
  };
}

/**
 * Recomputes stale chunks until the deadline (the slot still holds the chunk that went stale).
 * @param webgl the WebGL2 context
 * @param grid the grid
 * @param deadline performance.now() to stop at
 */
function refreshStale(webgl: WebGL2RenderingContext, grid: ShadeGrid, deadline: number) {
  for (let slot = 0; slot < grid.stale.length; slot++) {
    if (!grid.stale[slot]) continue;
    if (performance.now() > deadline) return;
    grid.stale[slot] = 0;
    const key = grid.owner[slot];
    if (Number.isNaN(key)) continue;
    // chunkKey inverted: |chunkY| < 5e5, so the rounded quotient is chunkX
    const chunkX = Math.round(key / 1e6);
    computeChunk(webgl, grid, chunkX, key - chunkX * 1e6);
  }
}

/**
 * Marks stale every slot whose chunk overlaps a world rectangle (grown by one cell).
 * @param grid the grid
 * @param rect the rectangle, m
 */
function markStale(grid: ShadeGrid, rect: ShadeRect) {
  const left = Math.floor((rect.x0 - SHADE_CELL_M) / CHUNK_M);
  const right = Math.floor((rect.x1 + SHADE_CELL_M) / CHUNK_M);
  const top = Math.floor((rect.y0 - SHADE_CELL_M) / CHUNK_M);
  const bottom = Math.floor((rect.y1 + SHADE_CELL_M) / CHUNK_M);
  for (let chunkY = top; chunkY <= bottom; chunkY++) {
    for (let chunkX = left; chunkX <= right; chunkX++) {
      grid.stale[wrapIndex(chunkY, GRID_CHUNKS) * GRID_CHUNKS + wrapIndex(chunkX, GRID_CHUNKS)] = 1;
    }
  }
}

export type GlShade = NonNullable<ReturnType<typeof createGlShade>>;

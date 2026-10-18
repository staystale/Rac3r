// The GROUND TILES cache of the renderer: the floor, zones and track ribbon painted into
// world-aligned tiles (a few fixed zoom steps), blitted each frame, with stand-ins for tiles not
// painted yet, palette snapping and hill-shading baked once per tile, and wear marking tiles stale.
import { LEVEL } from "../world/state.ts";
import type { Settings } from "../core/settings.ts";
import { COL } from "../world/colours.ts";
import type { Level } from "../world/types.ts";
import { buildPalette } from "./tilesPalette.ts";
import { hillShade } from "./tilesShade.ts";
import { tileBudget, takeTile } from "./tilesBudget.ts";
import { drainWear } from "./tilesWear.ts";
import { paintAs } from "../world/coverfield.ts";
import type { GroundSink } from "./glground.ts";
import type {
  Cam, CamCar, Fly, Overview, SurfaceArt, Tile, TileBudget, TileState, View,
} from "./types.ts";
// ZOOM_MIN: read only inside functions (draw time), so the import cycle is harmless
import { ZOOM_MIN } from "../render.ts";

// what createTiles destructures from the renderer
interface TilesHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  drawFloor: () => void;
  drawZones: () => void;
  drawLanes: () => void;
  drawTrackRibbon: () => void;
  drawLaneDashes: () => void;
  drawPatches: () => void;
  drawCovers: () => void;
  drawWear: (pass?: string) => number;
  drawCurvedKerbs: () => void;
  SURFACE_ART: Record<string, SurfaceArt | null>;
  PUDDLE_TINT: Record<string, string>;
  getFly: () => Fly | null;
  FLY_HANDOVER: number;
  FLY_PREFETCH: number;
  levelOverview: () => Overview | null;
  artBase: (id: string, fallback: string) => string;
  groundSink: () => GroundSink | null;   // the GPU ground this frame, or null (2D art buffer)
  fillsOnGpu: () => boolean;   // the GPU paints the floor and zone fills (glpaint.ts)
  heightsChanged: (rect: { x0: number; y0: number; x1: number; y1: number }) => void;
}

/** the tile state: the public counters (TileState) plus the caches the painters share */
interface TilesState extends TileState {
  tileLevel: Level | null;
  tileDpr: number;
  tilePPM: number;
  tileLayout: number;
  /** the tiles leave the floor and zone fills to the GPU (transparent there) */
  tileFillsOnGpu: boolean;
  /** the pixel-mode palette lookup, built on first use */
  paletteLUT: Uint32Array | null;
  /** running average ms per tile (starts pessimistic = phone) */
  tileAvg: number;
  wearDrainT: number;
  seenEpoch: number;
}

/** what every moved function of the tile cache reads: the view, camera, settings and state */
interface TilesCtx {
  view: View;
  cam: Cam;
  helpers: TilesHelpers;
  state: TilesState;
  /** key "step|i|j" -> { c: canvas, used: frame number } */
  tiles: Map<string, Tile>;
  /** css px per tile side (?tilepx= for A/B, tools/hwjudder.mjs) */
  TILE_PX: number;
  /** cached tiles kept; oldest dropped first (~1 MB each at dpr 2) */
  TILE_MAX: number;
  /** ?tilegpu=1: the old path (tiles painted + read back on their own GPU canvas) */
  TILE_GPU: boolean;
  /** perf A/B: no hill-shading */
  NO_SHADE: boolean;
  /** on the GPU ground, tiles at their exact place (drawTileImage); ?exacttiles=0 off */
  EXACT_TILES: boolean;
  /** ?startfix=1: a wear reset makes stale only the tiles holding wear (WORN_TILES) */
  WORN_ONLY: boolean;
  /** the tile canvases painted with worn cells in them */
  WORN_TILES: WeakSet<HTMLCanvasElement>;
}

/** one tile being painted: its canvas, scratch, geometry and the strip it is on */
type TileJob = {
  k: number; i: number; j: number; c: HTMLCanvasElement;
  sc: ReturnType<typeof tileScratch> | null;
  g: CanvasRenderingContext2D; px: number; tw: number; strip: number; strips: number; t0: number;
  worn: number;   // worn cells painted into it so far
};

// The floor, the surface zones and the track ribbon never change while you drive (wear and marks
// are drawn separately, on top), so they are painted into cached TILES and each frame just blits
// tiles. Tiles are world-aligned squares at a few fixed ZOOM STEPS. A zoom between steps draws the
// nearest step's tiles scaled (<= 13% - invisible on ground texture). A tile not ready yet is
// painted in at most TILE_BUDGET per frame; until then the previous zoom step's tiles stand in
// (scaled), so a zoom change never shows a hole and never repaints the whole screen in one frame.
// 3 -> 2 steps per doubling: the speed zoom crosses steps all lap and every step is a fresh set of
// tiles. Tiles stretch up to 1.41x.
const ZSTEP = 2;                // zoom steps per doubling: 1, 0.71, 0.5, 0.35
// STRIPS: a tile is painted in this many bands of device rows, one band per stepTile
// (so a frame can do one strip)
const STRIPS = 4;
// look-ahead painting: only below this tile cost; view shifted this many s of travel
const AHEAD_MAX_MS = 9, AHEAD_S = 0.6;
// GPU path: the one zoom step the tiles are painted at (zoom 1), the widest view's margin (the
// prefetch covers the view at ZOOM_MIN / WIDE_MARGIN) and the tiles kept (the widest phone view
// is ~70 tiles of ~120 KB; behind and ahead of it fit too)
const FIXED_STEP = 0, WIDE_MARGIN = 1.25, FIXED_TILE_MAX = 200;
/**
 * The zoom step nearest a zoom.
 * @param z the zoom
 * @returns the step
 */
const zStepOf = (z: number) => Math.round(ZSTEP * Math.log2(z));

/**
 * The zoom of a zoom step.
 * @param step the step
 * @returns the zoom
 */
const zOfStep = (step: number) => Math.pow(2, step / ZSTEP);

/**
 * PIXEL MODE: snaps every pixel of a freshly painted ground tile to the LIMITED PALETTE. Removes
 * the anti-aliased in-between shades that made stones and blob edges soft. Done ONCE per tile
 * (cached). With `target`, reads `source` and writes the snapped pixels into `target` instead
 * (the tile scratch -> the tile).
 * @param tcx the tile context
 * @param source the canvas to read
 * @param target the canvas to write (default: the source)
 */
function paletteSnap(tcx: TilesCtx, source: HTMLCanvasElement, target = source) {
  const paletteLUT = tcx.state.paletteLUT ??= buildPalette(tcx.helpers);
  const img = source.getContext('2d')!.getImageData(0, 0, source.width, source.height),
      d32 = new Uint32Array(img.data.buffer);
  // over the GPU-painted fills a see-through pixel must stay see-through: snap opaque ones only
  const minAlpha = tcx.state.tileFillsOnGpu ? 255 : 8;
  for (let i = 0; i < d32.length; i++) {
    const pixel = d32[i]; if ((pixel >>> 24) < minAlpha) continue;
    d32[i] = paletteLUT[(((pixel & 255) >> 3) << 10) | ((((pixel >> 8) & 255) >> 3) << 5)
        | (((pixel >> 16) & 255) >> 3)];
  }
  target.getContext('2d')!.putImageData(img, 0, 0);
}

/**
 * Paints a whole tile and keeps the running average of the time it took.
 * @param tcx the tile context
 * @param step the zoom step
 * @param i the tile column
 * @param j the tile row
 * @returns the tile canvas
 */
function paintTile(tcx: TilesCtx, step: number, i: number, j: number) {
  const tp0 = performance.now();
  try {
    return paintTileInner(tcx, step, i, j);
  } finally { const dt = performance.now() - tp0; tcx.state.tileMs += dt; tcx.state.tileAvg += (dt
      - tcx.state.tileAvg) * 0.2; }
}

// TILES ARE PAINTED ON A CPU SCRATCH, KEPT ON THE GPU. MEASURED (highway at 130-240 km/h, CPU x4,
// phone landscape): ground tiles scroll in ~10 a second at speed and each cost 45 ms, of which
// paletteSnap's getImageData was ~half: reading back a GPU canvas stalls the GPU pipeline. A tile
// canvas with willReadFrequently halved the tile but then every frame re-uploaded every CPU tile
// it drew. So: draw + snap on ONE reusable CPU scratch (no readback stall), putImageData once into
// the tile's own GPU canvas (one upload). a FRESH scratch per tile: a reused one would carry
// drawing state (line dash, font, smoothing ...) from the last tile

/**
 * A fresh CPU scratch canvas for one tile.
 * @param size the side in device px
 * @returns the canvas and its 2D context
 */
function tileScratch(size: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  return { c: canvas, g: canvas.getContext('2d', { willReadFrequently: true })! };
}

/**
 * The layers of a ground tile, in drawing order - ONE place, used by the whole-tile and the
 * strip path.
 * @param tcx the tile context
 * @returns how many worn cells were painted
 */
function drawLayerCalls(tcx: TilesCtx) {
  const { drawFloor, drawZones, drawLanes, drawWear, drawTrackRibbon, drawLaneDashes,
    drawPatches, drawCovers, drawCurvedKerbs } = tcx.helpers;
  drawFloor();
  drawZones();
  // UNDER the ribbon: where a lane meets the track, the track wins (lab.js zoneAt does the
  // same)
  drawLanes();
  // ENDLESS: wear UNDER the ribbon: the motorway is all tarmac (it never wears),
  // but a worn verge cell's disc (0.72 x 1.5 m radius) reached ~1 m over the carriageway edge
  // and read as dirt ON the road
  const endless = !!LEVEL.endless;
  let worn = endless ? drawWear('base') : 0;
  drawTrackRibbon();
  drawLaneDashes();
  drawPatches();
  // baked in: see tilesWear.ts. Under the covers ...
  if (!endless) worn += drawWear('base');
  drawCovers();
  worn += drawWear('cover');    // ... except where the cover itself has changed
  drawCurvedKerbs();    // kerbs last: no surface ever paints over a kerb
  return worn;
}

/**
 * Starts a tile job: its canvas, scratch and geometry. Paints nothing.
 * @param tcx the tile context
 * @param step the zoom step
 * @param i the tile column
 * @param j the tile row
 * @returns the job
 */
function startTile(tcx: TilesCtx, step: number, i: number, j: number): TileJob {
  const { view, TILE_PX } = tcx;
  const startedAt = performance.now();      // start of the layers stage
  const tileWidth = TILE_PX / (view.PPM * zOfStep(step));     // world metres per tile
  const size = Math.round(TILE_PX * view.dpr);
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size;
  // GPU path: no scratch - nothing is read back (the GPU snaps the palette, glground.ts); the
  // tile itself is CPU-backed instead, because the surface textures are (textures.ts): on a GPU
  // canvas every pattern fill moved the texture (MEASURED, highway: 2.7 s of fills in 900 frames)
  // and WebGL uploads a CPU canvas with a plain copy
  const onGpu = tcx.state.tileFillsOnGpu;
  const scratch = tcx.TILE_GPU || onGpu ? null : tileScratch(size);
  const ctx = scratch ? scratch.g
    : canvas.getContext('2d', onGpu ? { willReadFrequently: true } : undefined)!;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  return {
    k: step, i, j, c: canvas, sc: scratch, g: ctx, px: size, tw: tileWidth, strip: 0,
        strips: STRIPS, t0: startedAt, worn: 0,
  };
}

/**
 * Paints the layers into the job's canvas; with `band`, only the device rows [y0px, y1px).
 * @param tcx the tile context
 * @param job the tile job
 * @param y0px the first device row
 * @param y1px the end device row
 * @param band whether to clip to the rows (a strip)
 */
function layersInto(tcx: TilesCtx, job: TileJob, y0px: number, y1px: number, band = true) {
  const { view, cam, TILE_PX } = tcx;
  const ctx = job.g;
  const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
  view.ctx = ctx; view.W = view.H = TILE_PX; view.zoom = zOfStep(job.k);
  view.fillsOnGpu = tcx.state.tileFillsOnGpu;
  cam.x = (job.i + 0.5) * job.tw; cam.y = (job.j + 0.5) * job.tw;
  if (band) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.beginPath();
    ctx.rect(0, y0px, job.px, y1px - y0px); ctx.clip();
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  }
  try {
    job.worn += drawLayerCalls(tcx);
  } finally {
    if (band) ctx.restore();
    Object.assign(view, {
      ctx: keep.ctx, W: keep.W, H: keep.H, zoom: keep.zoom, fillsOnGpu: false,
    });
    cam.x = keep.cx; cam.y = keep.cy;
  }
  // canvas 2D defers drawing until pixels are read: this makes the strip's cost land in this
  // call
  if (band) ctx.getImageData(0, y0px, 1, 1);
}

/**
 * Finishes a tile job: palette snap and hill-shading, with the timings.
 * @param tcx the tile context
 * @param job the tile job, all strips painted
 * @returns the tile canvas
 */
function finishTile(tcx: TilesCtx, job: TileJob) {
  const state = tcx.state;
  state.tilesPainted++;
  state.perStep[job.k] = (state.perStep[job.k] || 0) + 1;
  const ts0 = performance.now();
  state.msLayers += ts0 - job.t0;
  if (job.sc) paletteSnap(tcx, job.sc.c, job.c);
  else if (!state.tileFillsOnGpu) paletteSnap(tcx, job.c);
  const th0 = performance.now();
  state.msSnap += th0 - ts0;
  // on the GPU path the hill shading is drawn by the GPU over every tile (glshade.ts)
  hillShade(tcx.NO_SHADE || tcx.state.tileFillsOnGpu, job.c, job.tw, (job.i + 0.5) * job.tw,
    (job.j + 0.5) * job.tw);
  state.msShade += performance.now() - th0;
  if (job.worn > 0) tcx.WORN_TILES.add(job.c);
  return job.c;
}

/**
 * Paints the next strip of a tile job.
 * @param tcx the tile context
 * @param job the tile job
 * @returns true when all strips are done
 */
function stepTile(tcx: TilesCtx, job: TileJob) {
  const rows = Math.ceil(job.px / job.strips), top = job.strip * rows;
  const bottom = job.strip === job.strips - 1 ? job.px : Math.min(job.px, top + rows);
  layersInto(tcx, job, top, bottom);
  job.strip++;
  return job.strip >= job.strips;
}

/**
 * Paints a whole tile in one go.
 * @param tcx the tile context
 * @param step the zoom step
 * @param i the tile column
 * @param j the tile row
 * @returns the tile canvas
 */
function paintTileInner(tcx: TilesCtx, step: number, i: number, j: number) {
  const job = startTile(tcx, step, i, j);
  layersInto(tcx, job, 0, job.px, false);
  return finishTile(tcx, job);
}

/**
 * How many tiles of zoom step k that cover the view are not painted yet. Draws nothing.
 * @param tcx the tile context
 * @param step the zoom step
 * @returns the count
 */
function countMissing(tcx: TilesCtx, step: number) {
  const { view, cam, tiles } = tcx;
  const tileWidth = tcx.TILE_PX / (view.PPM * zOfStep(step)), ppm = tcx.helpers.PPMz();
  const vx0 = cam.x - view.W / 2 / ppm, vx1 = cam.x + view.W / 2 / ppm, vy0 = cam.y - view.H / 2
      / ppm, vy1 = cam.y + view.H / 2 / ppm;
  let missing = 0;
  for (let i = Math.floor(vx0 / tileWidth); i * tileWidth < vx1; i++)
    for (let j = Math.floor(vy0 / tileWidth); j * tileWidth < vy1; j++) if (!tiles.has(step
        + '|' + i + '|' + j)) missing++;
  return missing;
}

/**
 * Fills the whole view with one colour: on the GPU ground when it is on, else the art buffer.
 * @param tcx the tile context
 * @param colour the CSS colour
 */
function groundFill(tcx: TilesCtx, colour: string) {
  const sink = tcx.helpers.groundSink();
  if (sink) { sink.fill(colour); return; }
  tcx.view.ctx.fillStyle = colour; tcx.view.ctx.fillRect(0, 0, tcx.view.W, tcx.view.H);
}

/**
 * Draws a ground picture (a tile or the overview) at a CSS-px rectangle of the view: on the GPU
 * ground when it is on, else the art buffer.
 * @param tcx the tile context
 * @param source the picture
 * @param x the left edge, css px
 * @param y the top edge, css px
 * @param width the width, css px
 * @param height the height, css px
 */
function groundImage(tcx: TilesCtx, source: HTMLCanvasElement, x: number, y: number,
    width: number, height: number) {
  const sink = tcx.helpers.groundSink();
  if (sink) sink.image(source, x, y, width, height);
  else tcx.view.ctx.drawImage(source, x, y, width, height);
}

/**
 * Draws one cached tile on the view at integer art-pixel edges.
 * @param tcx the tile context
 * @param tile the tile
 * @param i the tile column
 * @param j the tile row
 * @param tileWidth the tile width, m
 */
function drawTileImage(tcx: TilesCtx, tile: Tile, i: number, j: number, tileWidth: number) {
  const { view } = tcx, { toScreenX, toScreenY } = tcx.helpers;
  // EXACT TILES (?exacttiles=0 = off). The GPU ground zooms smoothly (the zoom is not quantised to
  // art-pixel tiles), so whole-art-pixel edges moved each tile by up to half an art pixel (1.5
  // device px), differently every frame of a zoom move: the white edge line, the ribbon edge and
  // the kerbs jiggled against the GPU-painted grass. MEASURED (tools/edgecheck.mjs, Brands, zoom
  // moving): the line strayed 0.30 / 1.61 / 2.92 device px frame to frame (median / p95 / max),
  // exact 0.03 / 0.14 / 0.44 (a perfect line: 0.05 / 0.16 / 0.37). Neighbours share each edge's
  // exact value and the GPU draws without anti-aliasing, so tiles still meet with no seam.
  if (tcx.EXACT_TILES && tcx.helpers.fillsOnGpu()) {
    const exactLeft = toScreenX(i * tileWidth), exactTop = toScreenY(j * tileWidth);
    groundImage(tcx, tile.c, exactLeft, exactTop, toScreenX((i + 1) * tileWidth) - exactLeft,
      toScreenY((j + 1) * tileWidth) - exactTop);
    return;
  }
  // integer edges, so neighbouring tiles meet with no hairline seam
  // edges on whole ART pixels (dpr = art px per css px); with the pixel-locked view every
  // tile is the same width
  const left = Math.round(toScreenX(i * tileWidth) * view.dpr) / view.dpr,
    right = Math.round(toScreenX((i
      + 1) * tileWidth) * view.dpr) / view.dpr;
  const top = Math.round(toScreenY(j * tileWidth) * view.dpr) / view.dpr,
    bottom = Math.round(toScreenY((j
      + 1) * tileWidth) * view.dpr) / view.dpr;
  groundImage(tcx, tile.c, left, top, right - left, bottom - top);
}

/**
 * Blits every tile of zoom step k that covers the view. With `paint` it paints missing tiles
 * (budget permitting); without, it only draws what exists.
 * @param tcx the tile context
 * @param step the zoom step
 * @param paint whether to paint missing and stale tiles
 * @param budget the frame budget
 * @returns how many tiles were missing
 */
function blitStep(tcx: TilesCtx, step: number, paint: boolean, budget: TileBudget) {
  const { view, cam, tiles, state } = tcx;
  const stepZoom = zOfStep(step), tileWidth = tcx.TILE_PX / (view.PPM * stepZoom);
  const ppm = tcx.helpers.PPMz();
  const vx0 = cam.x - view.W / 2 / ppm, vx1 = cam.x + view.W / 2 / ppm, vy0 = cam.y - view.H / 2
      / ppm, vy1 = cam.y + view.H / 2 / ppm;
  let missing = 0;
  for (let i = Math.floor(vx0 / tileWidth); i * tileWidth < vx1; i++) {
    for (let j = Math.floor(vy0 / tileWidth); j * tileWidth < vy1; j++) {
      const key = step + '|' + i + '|' + j;
      let tile = tiles.get(key);
      if (!tile && paint && takeTile(budget)) {
        tile = { c: paintTile(tcx, step, i, j), used: 0 }; tiles.set(key, tile);
        state.newTiles++;
      }
      // a STALE tile (wear changed under it) keeps showing until the budget lets it be repainted
      else if (tile && tile.stale && paint && takeTile(budget)) {
        tile.c = paintTile(tcx, step, i, j);
        tile.stale = false;
        state.staleRepaints++;
      }
      if (!tile) { missing++; continue; }
      tile.used = state.tileFrame;
      drawTileImage(tcx, tile, i, j, tileWidth);
    }
  }
  return missing;
}

/**
 * Under a stand-in: the level's own ground colour where it has one (a missing patch reads as
 * grass, not as a hole).
 * @param tcx the tile context
 * @returns the fill colour
 */
const standInFill = (tcx: TilesCtx) => (LEVEL.base && LEVEL.base.id !== 'lab'
  ? tcx.helpers.artBase(paintAs(LEVEL.base.id, LEVEL.base.under, true), COL.floor) : COL.outside);

/**
 * Paints (without drawing) the tiles of step k covering a view centred on (cx, cy) at zoom z.
 * @param tcx the tile context
 * @param step the zoom step
 * @param centreX the view centre x, m
 * @param centreY the view centre y, m
 * @param z the zoom
 * @param budget the budget, spent by one per tile
 */
function prefetch(tcx: TilesCtx, step: number, centreX: number, centreY: number, z: number,
    budget: TileBudget) {
  const { view, tiles, state } = tcx;
  const tileWidth = tcx.TILE_PX / (view.PPM * zOfStep(step)), ppm = view.PPM * z;
  const vx0 = centreX - view.W / 2 / ppm, vx1 = centreX + view.W / 2 / ppm, vy0 = centreY
      - view.H / 2 / ppm, vy1 = centreY + view.H / 2 / ppm;
  for (let i = Math.floor(vx0 / tileWidth); i * tileWidth < vx1 && budget.n > 0; i++)
    for (let j = Math.floor(vy0 / tileWidth); j * tileWidth < vy1 && budget.n > 0; j++) {
      const key = step + '|' + i + '|' + j;
      if (!tiles.has(key)) {
        budget.n--; tiles.set(key, { c: paintTile(tcx, step, i, j), used: state.tileFrame });
        state.prefetched++;
      }
    }
}

/**
 * Drops every cached tile when the level, device pixel ratio, scale or track layout changed.
 * @param tcx the tile context
 */
function resetOnChange(tcx: TilesCtx) {
  const { view, tiles, state } = tcx;
  // a re-randomised track (Grass Track)
  const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;
  const fillsOnGpu = tcx.helpers.fillsOnGpu();
  if (state.tileLevel !== LEVEL || state.tileDpr !== view.dpr || state.tilePPM !== view.PPM
      || state.tileLayout !== layout || state.tileFillsOnGpu !== fillsOnGpu) {
    state.tileFillsOnGpu = fillsOnGpu;
    tiles.clear();
    state.tileLevel = LEVEL;
    state.tileDpr = view.dpr;
    state.tilePPM = view.PPM;
    state.tileLayout = layout;
    state.lastStep = null;
  }
}

/**
 * The fly-in's flat overview, with the tiles of the steps the camera passes after the hand-over
 * prefetched under it.
 * @param tcx the tile context
 * @param overview the level overview
 * @param car the car, or null
 */
function drawFlyOverview(tcx: TilesCtx, overview: Overview, car: CamCar | null) {
  const { toScreenX, toScreenY, PPMz, FLY_HANDOVER, FLY_PREFETCH } = tcx.helpers;
  groundFill(tcx, COL.outside);
  groundImage(tcx, overview.c, toScreenX(overview.x0), toScreenY(overview.y0),
    (overview.x1 - overview.x0) * PPMz(), (overview.y1 - overview.y0) * PPMz());
  if (car && tcx.WORN_ONLY && tcx.state.tileFillsOnGpu) prefetchFlyOnGpu(tcx, car);
  else if (car) {
    const budget = { n: FLY_PREFETCH };
    // the steps the camera will pass through after the hand-over, nearest-to-final first
    // only the EVEN steps are used during the flight (see below) - three steps, ~60 tiles,
    // not ~90
    for (let step = 0; step >= zStepOf(FLY_HANDOVER) - 1 && budget.n
        > 0; step -= 2) prefetch(tcx, step, car.x, car.y, zOfStep(step) / 1.6, budget);
  }
  tcx.state.lastStep = null;
}

/**
 * ?startfix=1 on the GPU ground: the fly-in pre-paints only the tiles drawn after it (the fixed
 * step) over the hand-over view, and uploads them FLY_PREFETCH a frame, keeping the rest from
 * expiring. MEASURED (owner's phone): the hand-over frame uploaded every tile in view at once
 * (59 uploads, 71 mipmaps, 32 ms); uploading all tiles already painted in the first fly-in frame
 * moved it there (46 uploads, 58 mipmaps, 54 ms). Steps -2 / -4 are never drawn on the GPU path.
 * @param tcx the tile context
 * @param car the car the fly-in ends on
 */
function prefetchFlyOnGpu(tcx: TilesCtx, car: CamCar) {
  const { view, tiles } = tcx, { FLY_HANDOVER, FLY_PREFETCH } = tcx.helpers;
  prefetch(tcx, FIXED_STEP, car.x, car.y, FLY_HANDOVER, { n: FLY_PREFETCH });
  const sink = tcx.helpers.groundSink();
  if (!sink) return;
  const tileWidth = tcx.TILE_PX / (view.PPM * zOfStep(FIXED_STEP)), ppm = view.PPM * FLY_HANDOVER;
  const halfW = view.W / 2 / ppm, halfH = view.H / 2 / ppm;
  let uploads = FLY_PREFETCH;
  for (let i = Math.floor((car.x - halfW) / tileWidth); i * tileWidth < car.x + halfW; i++) {
    for (let j = Math.floor((car.y - halfH) / tileWidth); j * tileWidth < car.y + halfH; j++) {
      const tile = tiles.get(FIXED_STEP + '|' + i + '|' + j);
      if (tile && sink.preload(tile.c, uploads > 0)) uploads--;
    }
  }
}

/**
 * Draws a zoom change: the previous step's tiles scaled as a stand-in, the wanted step's tiles
 * over them.
 * @param tcx the tile context
 * @param step the wanted zoom step
 * @param budget the frame budget
 */
function drawStepChange(tcx: TilesCtx, step: number, budget: TileBudget) {
  const { state } = tcx;
  // the stand-in: the step we were on, scaled. Drawn first, then whatever of k exists goes
  // over it.
  groundFill(tcx, standInFill(tcx));
  const sink = tcx.helpers.groundSink();
  let left;
  if (sink && state.tileFillsOnGpu) {
    // GPU path: the tiles are see-through, so an old-step tile under a new one showed its
    // translucent labels and rims twice for a frame (a flicker); the new step's tiles mask the
    // old step's instead
    sink.mask('write');
    left = blitStep(tcx, step, true, budget);
    sink.mask('under');
    blitStep(tcx, state.lastStep!, false, budget);
    sink.mask('off');
  } else {
    blitStep(tcx, state.lastStep!, false, budget);
    left = blitStep(tcx, step, true, budget);
  }
  state.standIn = left > 0;
  if (left === 0) state.lastStep = step;
}

/**
 * Draws the wanted step. STAND-IN FOR NEW GROUND: painting EVERY missing tile in the frame it
 * appeared made frames up to ~150 ms when ground scrolled in at speed (MEASURED at CPU x4). So the
 * whole-level overview goes down first, then at most TILE_BUDGET real tiles; the rest arrive over
 * the next frames, so a frame or two shows a softer patch at the edge instead of a stall.
 * @param tcx the tile context
 * @param step the wanted zoom step
 * @param budget the frame budget
 */
function drawNewGround(tcx: TilesCtx, step: number, budget: TileBudget) {
  const { state } = tcx, { toScreenX, toScreenY, PPMz, levelOverview } = tcx.helpers;
  if (countMissing(tcx, step) > 1) {
    // not on the GPU path: the GPU ground under the tiles is already the real ground there, and the
    // flat overview over it flashed for a frame at every zoom step (a jump in brightness)
    const overview = state.tileFillsOnGpu ? null : levelOverview();
    if (overview) {
      groundFill(tcx, standInFill(tcx));
      groundImage(tcx, overview.c, toScreenX(overview.x0), toScreenY(overview.y0),
        (overview.x1 - overview.x0) * PPMz(), (overview.y1 - overview.y0) * PPMz());
    }
    state.standIn = blitStep(tcx, step, true, budget) > 0;
  } else { blitStep(tcx, step, true, { n: Infinity }); state.standIn = false; }
  state.lastStep = step;
}

/**
 * Evicts the least recently used tiles above TILE_MAX.
 * @param tcx the tile context
 */
function evictTiles(tcx: TilesCtx) {
  const { tiles } = tcx;
  const most = tcx.state.tileFillsOnGpu ? FIXED_TILE_MAX : tcx.TILE_MAX;
  if (tiles.size > most) {
    const old = [...tiles.entries()].sort((first, second) => first[1].used - second[1].used);
    for (let index = 0, drop = tiles.size - most; index < drop; index++) {
      tiles.delete(old[index][0]);
    }
  }
}

/**
 * The zoom step to draw the ground at, with hysteresis on the current step.
 * @param tcx the tile context
 * @param fly the fly-in state, or a falsy value when not flying
 * @returns the zoom step
 */
function groundStep(tcx: TilesCtx, fly: unknown) {
  const { view, state } = tcx;
  // GPU path: ONE fixed density, the zoom-1 step, whatever the zoom - the GPU scales the tiles
  // (sharp-pixel filter, mipmaps), so there are no zoom steps to shift, stand in or flash
  if (state.tileFillsOnGpu) return FIXED_STEP;
  // flight: even steps only, finer side
  let step = fly ? 2 * Math.ceil(zStepOf(view.zoom) / 2) : zStepOf(view.zoom);
  if (!fly && state.lastStep !== null && Math.abs(ZSTEP * Math.log2(view.zoom)
      - state.lastStep) < 0.75) step = state.lastStep;
  return step;
}

/**
 * Paints one tile from the view AHEAD of the car when nothing is missing and tiles are cheap.
 * @param tcx the tile context
 * @param step the zoom step
 * @param fly the fly-in state, or a falsy value when not flying
 * @param car the car, or null
 */
function lookAhead(tcx: TilesCtx, step: number, fly: unknown, car: CamCar | null) {
  const { view, cam, state } = tcx;
  // GPU path: keep everything the widest zoom (plus a margin) would show painted, one tile a frame
  // while nothing in view is missing, so a zoom-out never meets ground without its tiles
  if (state.tileFillsOnGpu) {
    if (!state.standIn && !fly) {
      prefetch(tcx, step, cam.x, cam.y, ZOOM_MIN / WIDE_MARGIN, { n: 1 });
    }
    return;
  }
  // LOOK-AHEAD, GATED ON TILE COST: a big PC screen needs ~3x the tiles of a phone, so at 1 tile
  // a frame 27% of frames showed the flat stand-in. On a device that paints a tile in <
  // AHEAD_MAX_MS, a frame with NOTHING missing paints one tile from the view AHEAD of the car.
  // Phones (12-20 ms a tile at CPU x4) never qualify, so they keep the measured-better behaviour.
  if (!state.standIn && !fly && car && state.tileAvg < AHEAD_MAX_MS && Math.hypot(car.vx, car.vy)
      > 3) {
    prefetch(tcx, step, cam.x + car.vx * AHEAD_S, cam.y + car.vy * AHEAD_S, view.zoom, { n: 1 });
  }
}

/**
 * Draws the ground: the tiles of the zoom step in view, with stand-ins for what is not painted
 * yet. HYSTERESIS on the zoom step: the speed zoom wanders across step boundaries all the time
 * and every switch repaints the whole view, so it stays on the current step until the zoom is
 * 0.75 of a step away from it.
 * @param tcx the tile context
 * @param wallDt the wall-clock seconds since the last frame
 * @param car the car for the fly-in prefetch and look-ahead, or null
 */
function drawGround(tcx: TilesCtx, wallDt = 0, car: CamCar | null = null) {
  const { view, state } = tcx;
  drainWear(tcx, wallDt, zOfStep);
  state.tileFrame++;
  resetOnChange(tcx);
  const fly = tcx.helpers.getFly();
  if (fly && fly.ov && view.zoom < tcx.helpers.FLY_HANDOVER) {
    drawFlyOverview(tcx, fly.ov, car);
    return;
  }
  const step = groundStep(tcx, fly);
  const budget = tileBudget();
  // count what the wanted step is missing BEFORE painting, to decide whether a stand-in is
  // needed
  if (state.lastStep !== null && state.lastStep !== step && countMissing(tcx, step) > 0) {
    drawStepChange(tcx, step, budget);
  } else drawNewGround(tcx, step, budget);
  lookAhead(tcx, step, fly, car);
  evictTiles(tcx);
}

/**
 * Creates the ground tile cache.
 * @param view the view
 * @param cam the camera
 * @param settings the settings (tilePx, tileGpu, noShade, exactTiles)
 * @param helpers what the tiles use of the renderer
 * @returns the tile state and counters, the tile map, the zoom-step helpers and the painters
 */
export function createTiles(view: View, cam: Cam, settings: Settings, helpers: TilesHelpers) {
  const TILE_PX = settings.tilePx;
  const tiles = new Map<string, Tile>();
  const tileState: TilesState = {
    tileFrame: 0, tilesPainted: 0,
    tileMs: 0,                  // total ms spent painting tiles (tools: perf)
    staleRepaints: 0,           // of those, repaints of a tile wear made stale (tools: hwjudder)
    // ms drawing the layers of tiles, incl. scratch set-up (tools/tilecost.mjs)
    msLayers: 0,
    msSnap: 0,                  // ms in paletteSnap (tools/tilecost.mjs)
    msShade: 0,                 // ms in hillShade (tools/tilecost.mjs)
    // tiles painted because none existed at that key (tools/tilecost.mjs)
    newTiles: 0,
    perStep: {},                // tiles painted per zoom step k (tools/tilecost.mjs)
    prefetched: 0,              // tiles painted by prefetch (tools/tilecost.mjs)
    lastStep: null,
    drawnN: 0,                  // art px per tile the last frame was DRAWN at (tools/hwwobble.mjs)
    standIn: false,             // this frame showed a stand-in somewhere (tools: tile pop-in)
    tileLevel: null, tileDpr: 0, tilePPM: 0, tileLayout: 0, tileFillsOnGpu: false,
    paletteLUT: null,           // the pixel-mode palette lookup, built on first use
    tileAvg: 20,                // running average ms per tile (starts pessimistic = phone)
    wearDrainT: 0, seenEpoch: -1,
  };
  const tcx: TilesCtx = {
    view, cam, helpers, state: tileState, tiles, TILE_PX,
    // cached tiles kept; oldest dropped first (~1 MB each at dpr 2). Scaled with the tile AREA, so
    // smaller tiles keep the same ground in memory.
    TILE_MAX: Math.round(72 * (256 / TILE_PX) ** 2),
    TILE_GPU: settings.tileGpu,
    NO_SHADE: settings.noShade,
    EXACT_TILES: settings.exactTiles,
    WORN_ONLY: settings.startFix,
    WORN_TILES: new WeakSet(),
  };
  return {
    tileState, tiles, TILE_PX, ZSTEP, zStepOf, zOfStep,
    paletteSnap: (source: HTMLCanvasElement, target = source) => paletteSnap(tcx, source, target),
    /** the pixel-mode palette lookup (the GPU painter snaps to the same one) */
    paletteLUT: () => (tileState.paletteLUT ??= buildPalette(helpers)),
    paintTile: (step: number, i: number, j: number) => paintTile(tcx, step, i, j),
    startTile: (step: number, i: number, j: number) => startTile(tcx, step, i, j),
    stepTile: (job: TileJob) => stepTile(tcx, job),
    finishTile: (job: TileJob) => finishTile(tcx, job),
    drawGround: (wallDt = 0, car: CamCar | null = null) => drawGround(tcx, wallDt, car),
    prefetch: (step: number, centreX: number, centreY: number, z: number, budget: TileBudget) =>
      prefetch(tcx, step, centreX, centreY, z, budget),
  };
}

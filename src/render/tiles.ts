// The GROUND TILES cache of the renderer: the zones' details, the track ribbon, lanes, patches,
// covers, wear and kerbs painted into world-aligned tiles at ONE fixed density and drawn each
// frame by the GPU ground (glground.ts), which paints the floor and zone fills itself (glpaint.ts),
// snaps the palette and lays the hill shading over them (glshade.ts). Wear marks tiles stale.
import { LEVEL } from "../world/state.ts";
import type { Settings } from "../core/settings.ts";
import { COL } from "../world/colours.ts";
import type { Level } from "../world/types.ts";
import { buildPalette } from "./tilesPalette.ts";
import { tileBudget, takeTile } from "./tilesBudget.ts";
import { drainWear } from "./tilesWear.ts";
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
  artBase: (id: string, fallback: string) => string;
  groundSink: () => GroundSink | null;   // the GPU ground this frame, or null (it cannot draw)
  heightsChanged: (rect: { x0: number; y0: number; x1: number; y1: number }) => void;
}

/** the tile state: the public counters (TileState) plus the caches the painters share */
interface TilesState extends TileState {
  tileLevel: Level | null;
  tileDpr: number;
  tilePPM: number;
  tileLayout: number;
  /** the pixel-mode palette lookup, built on first use */
  paletteLUT: Uint32Array | null;
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
  /** the tile canvases painted with worn cells in them (a wear reset stales only these) */
  WORN_TILES: WeakSet<HTMLCanvasElement>;
}

/** one tile being painted: its canvas, geometry and the strip it is on */
type TileJob = {
  k: number; i: number; j: number; c: HTMLCanvasElement;
  g: CanvasRenderingContext2D; px: number; tw: number; strip: number; strips: number; t0: number;
  worn: number;   // worn cells painted into it so far
};

// The ribbon, lanes, patches and covers never change while you drive (wear and marks are drawn
// over them), so they are painted into cached TILES, world-aligned squares at ONE density (the
// zoom-1 step): the GPU scales them to any zoom (sharp-pixel filter, mipmaps), so no zoom step
// ever shifts, stands in or flashes. A tile not ready yet is painted in at most the frame's
// budget (tilesBudget.ts); the GPU-painted floor and zones under it are the real ground already.
// STRIPS: a tile is painted in this many bands of device rows, one band per stepTile (so a frame
// can do one strip)
const STRIPS = 4;
// the one zoom step the tiles are painted at (zoom 1), the widest view's margin (the prefetch
// covers the view at ZOOM_MIN / WIDE_MARGIN) and the tiles kept (the widest phone view is ~70
// tiles of ~120 KB; behind and ahead of it fit too)
const FIXED_STEP = 0, WIDE_MARGIN = 1.25, TILE_MAX = 200;

/**
 * The zoom of a zoom step.
 * @param step the step
 * @returns the zoom
 */
const zOfStep = (step: number) => Math.pow(2, step / 2);

/**
 * Paints a whole tile and keeps the time it took.
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
  } finally { tcx.state.tileMs += performance.now() - tp0; }
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
 * Starts a tile job: its canvas and geometry. Paints nothing. The tile is CPU-backed (nothing is
 * read back: the GPU snaps the palette, glground.ts), because the surface textures are
 * (textures.ts): on a GPU canvas every pattern fill moved the texture (MEASURED, highway: 2.7 s of
 * fills in 900 frames) and WebGL uploads a CPU canvas with a plain copy.
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
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  return {
    k: step, i, j, c: canvas, g: ctx, px: size, tw: tileWidth, strip: 0, strips: STRIPS,
    t0: startedAt, worn: 0,
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
  // the GPU paints the floor and zone fills: the tile is transparent there
  view.fillsOnGpu = true;
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
 * Finishes a tile job: its counters and the worn-tile mark.
 * @param tcx the tile context
 * @param job the tile job, all strips painted
 * @returns the tile canvas
 */
function finishTile(tcx: TilesCtx, job: TileJob) {
  const state = tcx.state;
  state.tilesPainted++;
  state.perStep[job.k] = (state.perStep[job.k] || 0) + 1;
  state.msLayers += performance.now() - job.t0;
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
 * Draws one cached tile on the GPU ground at its EXACT place. The GPU ground zooms smoothly (the
 * zoom is not quantised to art-pixel tiles), so whole-art-pixel edges moved each tile by up to
 * half an art pixel (1.5 device px), differently every frame of a zoom move: the white edge line,
 * the ribbon edge and the kerbs jiggled against the GPU-painted grass. MEASURED
 * (tools/edgecheck.mjs, Brands, zoom moving): the line strayed 0.30 / 1.61 / 2.92 device px frame
 * to frame (median / p95 / max), exact 0.03 / 0.14 / 0.44 (a perfect line: 0.05 / 0.16 / 0.37).
 * Neighbours share each edge's exact value and the GPU draws without anti-aliasing, so tiles still
 * meet with no seam.
 * @param tcx the tile context
 * @param sink the GPU ground
 * @param tile the tile
 * @param i the tile column
 * @param j the tile row
 * @param tileWidth the tile width, m
 */
function drawTileImage(tcx: TilesCtx, sink: GroundSink, tile: Tile, i: number, j: number,
    tileWidth: number) {
  const { toScreenX, toScreenY } = tcx.helpers;
  const exactLeft = toScreenX(i * tileWidth), exactTop = toScreenY(j * tileWidth);
  sink.image(tile.c, exactLeft, exactTop, toScreenX((i + 1) * tileWidth) - exactLeft,
    toScreenY((j + 1) * tileWidth) - exactTop);
}

/**
 * Draws every tile of zoom step k that covers the view, painting missing and stale tiles budget
 * permitting.
 * @param tcx the tile context
 * @param sink the GPU ground
 * @param step the zoom step
 * @param budget the frame budget
 * @returns how many tiles were missing
 */
function blitStep(tcx: TilesCtx, sink: GroundSink, step: number, budget: TileBudget) {
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
      if (!tile && takeTile(budget)) {
        tile = { c: paintTile(tcx, step, i, j), used: 0 }; tiles.set(key, tile);
        state.newTiles++;
      }
      // a STALE tile (wear changed under it) keeps showing until the budget lets it be repainted
      else if (tile && tile.stale && takeTile(budget)) {
        tile.c = paintTile(tcx, step, i, j);
        tile.stale = false;
        state.staleRepaints++;
      }
      if (!tile) { missing++; continue; }
      tile.used = state.tileFrame;
      drawTileImage(tcx, sink, tile, i, j, tileWidth);
    }
  }
  return missing;
}

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
  if (state.tileLevel !== LEVEL || state.tileDpr !== view.dpr || state.tilePPM !== view.PPM
      || state.tileLayout !== layout) {
    tiles.clear();
    state.tileLevel = LEVEL;
    state.tileDpr = view.dpr;
    state.tilePPM = view.PPM;
    state.tileLayout = layout;
    state.lastStep = null;
  }
}

/**
 * The fly-in's flat overview, with the tiles drawn after it prefetched under it.
 * @param tcx the tile context
 * @param sink the GPU ground
 * @param overview the level overview
 * @param car the car, or null
 */
function drawFlyOverview(tcx: TilesCtx, sink: GroundSink, overview: Overview,
    car: CamCar | null) {
  const { toScreenX, toScreenY, PPMz } = tcx.helpers;
  sink.fill(COL.outside);
  sink.image(overview.c, toScreenX(overview.x0), toScreenY(overview.y0),
    (overview.x1 - overview.x0) * PPMz(), (overview.y1 - overview.y0) * PPMz());
  if (car) prefetchFly(tcx, sink, car);
  tcx.state.lastStep = null;
}

/**
 * The fly-in pre-paints only the tiles drawn after it (the fixed step) over the hand-over view,
 * and uploads them FLY_PREFETCH a frame, keeping the rest from expiring. MEASURED (owner's
 * phone): the hand-over frame uploaded every tile in view at once (59 uploads, 71 mipmaps, 32 ms);
 * uploading all tiles already painted in the first fly-in frame moved it there (46 uploads, 58
 * mipmaps, 54 ms).
 * @param tcx the tile context
 * @param sink the GPU ground
 * @param car the car the fly-in ends on
 */
function prefetchFly(tcx: TilesCtx, sink: GroundSink, car: CamCar) {
  const { view, tiles } = tcx, { FLY_HANDOVER, FLY_PREFETCH } = tcx.helpers;
  prefetch(tcx, FIXED_STEP, car.x, car.y, FLY_HANDOVER, { n: FLY_PREFETCH });
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
 * Draws the tiles in view. Painting EVERY missing tile in the frame it appeared made frames up to
 * ~150 ms when ground scrolled in at speed (MEASURED at CPU x4), so at most the frame's budget is
 * painted and the rest arrive over the next frames (the GPU-painted floor and zones show
 * meanwhile).
 * @param tcx the tile context
 * @param sink the GPU ground
 * @param budget the frame budget
 */
function drawTilesInView(tcx: TilesCtx, sink: GroundSink, budget: TileBudget) {
  const { state } = tcx;
  if (countMissing(tcx, FIXED_STEP) > 1) {
    state.standIn = blitStep(tcx, sink, FIXED_STEP, budget) > 0;
  } else {
    blitStep(tcx, sink, FIXED_STEP, { n: Infinity });
    state.standIn = false;
  }
  state.lastStep = FIXED_STEP;
}

/**
 * Evicts the least recently used tiles above TILE_MAX.
 * @param tcx the tile context
 */
function evictTiles(tcx: TilesCtx) {
  const { tiles } = tcx;
  if (tiles.size > TILE_MAX) {
    const old = [...tiles.entries()].sort((first, second) => first[1].used - second[1].used);
    for (let index = 0, drop = tiles.size - TILE_MAX; index < drop; index++) {
      tiles.delete(old[index][0]);
    }
  }
}

/**
 * Keeps everything the widest zoom (plus a margin) would show painted, one tile a frame while
 * nothing in view is missing, so a zoom-out never meets ground without its tiles.
 * @param tcx the tile context
 * @param fly the fly-in state, or a falsy value when not flying
 */
function lookAhead(tcx: TilesCtx, fly: unknown) {
  const { cam, state } = tcx;
  if (!state.standIn && !fly) {
    prefetch(tcx, FIXED_STEP, cam.x, cam.y, ZOOM_MIN / WIDE_MARGIN, { n: 1 });
  }
}

/**
 * Draws the ground's tiles on the GPU ground (nothing while it cannot draw: a lost context comes
 * back by itself, glground.ts).
 * @param tcx the tile context
 * @param wallDt the wall-clock seconds since the last frame
 * @param car the car for the fly-in prefetch and look-ahead, or null
 */
function drawGround(tcx: TilesCtx, wallDt = 0, car: CamCar | null = null) {
  const { view, state } = tcx;
  drainWear(tcx, wallDt, zOfStep);
  state.tileFrame++;
  resetOnChange(tcx);
  const sink = tcx.helpers.groundSink();
  if (!sink) return;
  const fly = tcx.helpers.getFly();
  if (fly && fly.ov && view.zoom < tcx.helpers.FLY_HANDOVER) {
    drawFlyOverview(tcx, sink, fly.ov, car);
    return;
  }
  drawTilesInView(tcx, sink, tileBudget());
  lookAhead(tcx, fly);
  evictTiles(tcx);
}

/**
 * Creates the ground tile cache.
 * @param view the view
 * @param cam the camera
 * @param settings the settings (tilePx)
 * @param helpers what the tiles use of the renderer
 * @returns the tile state and counters, the tile map, the zoom-step helper and the painters
 */
export function createTiles(view: View, cam: Cam, settings: Settings, helpers: TilesHelpers) {
  const TILE_PX = settings.tilePx;
  const tiles = new Map<string, Tile>();
  const tileState: TilesState = {
    tileFrame: 0, tilesPainted: 0,
    tileMs: 0,                  // total ms spent painting tiles (tools: perf)
    staleRepaints: 0,           // of those, repaints of a tile wear made stale (tools: hwjudder)
    // ms drawing the layers of tiles (tools/tilecost.mjs)
    msLayers: 0,
    // tiles painted because none existed at that key (tools/tilecost.mjs)
    newTiles: 0,
    perStep: {},                // tiles painted per zoom step k (tools/tilecost.mjs)
    prefetched: 0,              // tiles painted by prefetch (tools/tilecost.mjs)
    lastStep: null,
    drawnN: 0,                  // art px per tile the last frame was DRAWN at (tools/hwwobble.mjs)
    standIn: false,             // this frame had tiles in view still to paint (tools: pop-in)
    tileLevel: null, tileDpr: 0, tilePPM: 0, tileLayout: 0,
    paletteLUT: null,           // the pixel-mode palette lookup, built on first use
    wearDrainT: 0, seenEpoch: -1,
  };
  const tcx: TilesCtx = {
    view, cam, helpers, state: tileState, tiles, TILE_PX, WORN_TILES: new WeakSet(),
  };
  return {
    tileState, tiles, TILE_PX, zOfStep,
    /** the pixel-mode palette lookup (the GPU painter snaps to it) */
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

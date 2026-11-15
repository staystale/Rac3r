// The ground tiles at a density matched to the zoom, under ?tiledensity=1 (FIX.tiledensity): the
// step drawn (tilesSteps.ts), a new step readied - painted and on the GPU over the whole view - a
// little a frame before it is drawn, so a step change never stands in, shifts or uploads a view
// at once; and the loading screen's PLAN: every tile the fly-in will show, on its path at the
// real screen's size, painted and uploaded behind the bar (game/loading.ts).
import {
  DENSITY_STEPS, lowestZoomOf, stepForZoom, wantedStep, zoomOfStep,
} from "./tilesSteps.ts";
import type { GroundSink } from "./glground.ts";
import { flyViewAt } from "./camera.ts";
import type { CamCar, Fly, Tile, TileBudget, View, Cam } from "./types.ts";

/** What the density path reads of the tile cache (tiles.ts) */
export interface DensityTiles {
  view: View;
  cam: Cam;
  tiles: Map<string, Tile>;
  TILE_PX: number;
  state: { tileFrame: number; standIn: boolean; lastStep: number | null };
  /** PPMz: css px a metre of the view now (PPM x zoom) */
  helpers: { PPMz: () => number };
}

/** The tile cache's own calls the density path uses (tiles.ts) */
export interface DensityOps {
  blitStep: (sink: GroundSink, step: number, budget: TileBudget) => number;
  countMissing: (step: number) => number;
  paintTile: (step: number, i: number, j: number) => HTMLCanvasElement;
  prefetch: (step: number, centreX: number, centreY: number, zoom: number, budget: TileBudget)
    => void;
}

// uploads a frame of a step being readied (the phone: a frame after 1-2 uploads misses no more
// often than a quiet one; after 6+ it does, 4.6-12 %)
const READY_UPLOADS = 2;
// the cache: the widest view of any step, this many times over (a margin ring, the step being
// readied)
const CACHE_VIEWS = 1.25;

const density = {
  drawn: null as number | null,
  // the fly-in's tiles ("step|i|j"), kept painted and on the GPU until it lands
  plan: [] as string[],
};

/**
 * The tile columns and rows a view of a step covers.
 * @param tcx the tiles
 * @param step the step
 * @param centreX the view's centre, m
 * @param centreY the view's centre, m
 * @param zoom the view's zoom
 * @param ring tiles of margin each side
 * @returns the first and last column and row
 */
function viewTiles(tcx: DensityTiles, step: number, centreX: number, centreY: number,
    zoom: number, ring = 0) {
  const { view, TILE_PX } = tcx;
  const width = TILE_PX / (view.PPM * zoomOfStep(step)), ppm = view.PPM * zoom;
  const halfW = view.W / 2 / ppm, halfH = view.H / 2 / ppm;
  return { i0: Math.floor((centreX - halfW) / width) - ring,
    i1: Math.ceil((centreX + halfW) / width) - 1 + ring,
    j0: Math.floor((centreY - halfH) / width) - ring,
    j1: Math.ceil((centreY + halfH) / width) - 1 + ring };
}

/**
 * Readies a step for the view now: one missing (or stale) tile painted if the frame painted none,
 * up to READY_UPLOADS painted ones uploaded, every one kept on the GPU and in the cache.
 * @param tcx the tiles
 * @param ops the cache's calls
 * @param sink the GPU ground
 * @param step the step
 * @param mayPaint whether this frame may paint a tile
 * @returns true when the whole view of the step is painted and on the GPU
 */
function readyStep(tcx: DensityTiles, ops: DensityOps, sink: GroundSink, step: number,
    mayPaint: boolean) {
  const { cam, tiles, state } = tcx;
  const range = viewTiles(tcx, step, cam.x, cam.y, tcx.helpers.PPMz() / tcx.view.PPM);
  let ready = true, paints = mayPaint ? 1 : 0, uploads = READY_UPLOADS;
  for (let i = range.i0; i <= range.i1; i++) {
    for (let j = range.j0; j <= range.j1; j++) {
      const key = step + '|' + i + '|' + j;
      let tile = tiles.get(key);
      if (!tile || tile.stale) {
        ready = false;
        if (paints-- <= 0) continue;
        tile = { c: ops.paintTile(step, i, j), used: state.tileFrame };
        tiles.set(key, tile);
      }
      tile.used = state.tileFrame;
      if (sink.has(tile.c)) sink.preload(tile.c, false);
      else {
        ready = false;
        if (uploads-- > 0) sink.preload(tile.c, true);
      }
    }
  }
  return ready;
}

/**
 * Draws the ground's tiles at the density step for the zoom: the drawn step until the wanted one
 * is ready, then the wanted one; the look-ahead keeps the drawn step's widest view painted.
 * @param tcx the tiles
 * @param ops the cache's calls
 * @param sink the GPU ground
 * @param budget the frame budget
 * @param fly the fly-in, or a falsy value
 * @param zoomMin the camera's widest zoom
 */
export function drawDensity(tcx: DensityTiles, ops: DensityOps, sink: GroundSink,
    budget: TileBudget, fly: unknown, zoomMin: number) {
  const { state, view, cam } = tcx;
  const zoom = tcx.helpers.PPMz() / view.PPM;
  if (density.drawn === null || state.lastStep === null) density.drawn = stepForZoom(zoom);
  // (the fly-in: its own zoom's step - its plan has them all - with no lag or early readying)
  const want = fly ? stepForZoom(zoom) : wantedStep(zoom, density.drawn);
  const step = density.drawn;
  if (ops.countMissing(step) > 1) state.standIn = ops.blitStep(sink, step, budget) > 0;
  else {
    ops.blitStep(sink, step, { n: Infinity });
    state.standIn = false;
  }
  state.lastStep = step;
  if (want !== step) {
    const mayPaint = budget.n > 0 && budget.first === true;
    if (readyStep(tcx, ops, sink, want, mayPaint)) density.drawn = want;
    return;
  }
  if (!state.standIn && !fly) {
    ops.prefetch(step, cam.x, cam.y, lowestZoomOf(step, zoomMin) / 1.25, { n: 1 });
  }
}

// views of the fly-in's path its plan is made from (one every ~1.5 % of the move: the zoom changes
// ~3 % between two, a fraction of a tile at the edge)
const FLY_SAMPLES = 64;

/**
 * The fly-in's views from the tiles' hand-over to the landing (render/camera.ts flyViewAt).
 * @param fly the fly-in, started
 * @param car the car it lands on
 * @param handover the zoom the tiles take over at
 * @returns the views (centre, m; zoom), the landing last
 */
export function flyPathViews(fly: Fly, car: CamCar, handover: number) {
  const views: { x: number; y: number; zoom: number }[] = [];
  for (let sample = 0; sample <= FLY_SAMPLES; sample++) {
    const view = flyViewAt(fly, car, sample / FLY_SAMPLES);
    if (view.zoom >= handover) views.push(view);
  }
  return views;
}

/**
 * Plans the fly-in's tiles behind the loading screen: the views along its path (from the tiles'
 * hand-over on) at their zoom's step, at the real screen; a tile's ring round the landing view
 * (the camera then leads the car and keeps it out from under the HUD).
 * @param tcx the tiles
 * @param views the path's views (centre, zoom), the landing last
 * @returns how many tiles the plan holds
 */
export function planFly(tcx: DensityTiles, views: { x: number; y: number; zoom: number }[]) {
  const keys = new Set<string>();
  views.forEach((view, index) => {
    const step = stepForZoom(view.zoom);
    const ring = index === views.length - 1 ? 1 : 0;
    const range = viewTiles(tcx, step, view.x, view.y, view.zoom, ring);
    for (let i = range.i0; i <= range.i1; i++)
      for (let j = range.j0; j <= range.j1; j++) keys.add(step + '|' + i + '|' + j);
  });
  density.plan = [...keys];
  density.drawn = null;
  return density.plan.length;
}

/**
 * Paints up to `most` of the plan's tiles not painted yet.
 * @param tcx the tiles
 * @param ops the cache's calls
 * @param most the most to paint now
 * @returns true while some are left
 */
export function paintPlan(tcx: DensityTiles, ops: DensityOps, most: number) {
  let left = most;
  for (const key of density.plan) {
    if (tcx.tiles.has(key)) continue;
    if (left-- <= 0) return true;
    const [step, i, j] = key.split('|').map(Number);
    tcx.tiles.set(key, { c: ops.paintTile(step, i, j), used: tcx.state.tileFrame });
  }
  return false;
}

/**
 * Uploads up to `most` of the plan's painted tiles not on the GPU yet.
 * @param tcx the tiles
 * @param sink the GPU ground
 * @param most the most to upload now
 * @returns true while some are left
 */
export function uploadPlan(tcx: DensityTiles, sink: GroundSink, most: number) {
  let left = most;
  for (const key of density.plan) {
    const tile = tcx.tiles.get(key);
    if (!tile || sink.has(tile.c)) continue;
    if (left-- <= 0) return true;
    sink.preload(tile.c, true);
  }
  return false;
}

/**
 * While the fly-in runs, its planned tiles are kept in the cache and on the GPU; once it has
 * landed the plan is let go.
 * @param tcx the tiles
 * @param sink the GPU ground
 * @param fly the fly-in, or a falsy value
 */
export function keepPlan(tcx: DensityTiles, sink: GroundSink, fly: unknown) {
  if (!fly) {
    density.plan = [];
    return;
  }
  for (const key of density.plan) {
    const tile = tcx.tiles.get(key);
    if (!tile) continue;
    tile.used = tcx.state.tileFrame;
    sink.preload(tile.c, false);
  }
}

/**
 * How many tiles the cache keeps: the widest view of any step CACHE_VIEWS times over (a big PC
 * screen shows ~300 zoom-1 tiles; 200 made it repaint a view's tiles each frame), and the
 * fly-in's plan while it runs; never fewer than `least`.
 * @param tcx the tiles
 * @param least the fixed size (tiles.ts TILE_MAX)
 * @param zoomMin the camera's widest zoom
 * @returns the tiles to keep
 */
export function tileLimit(tcx: DensityTiles, least: number, zoomMin: number) {
  const { view, TILE_PX } = tcx;
  let widest = 0;
  for (const step of DENSITY_STEPS) {
    const ratio = zoomOfStep(step) / lowestZoomOf(step, zoomMin);
    const cols = Math.ceil(view.W * ratio / TILE_PX) + 1,
      rows = Math.ceil(view.H * ratio / TILE_PX) + 1;
    widest = Math.max(widest, cols * rows);
  }
  return Math.max(least, Math.ceil(widest * CACHE_VIEWS), density.plan.length + widest);
}

/**
 * What the loading screen asks of the renderer under ?tiledensity=1 (game/loading.ts,
 * render.ts loadingHelpers): the started fly-in's tiles planned, then painted and uploaded a slice
 * at a time (true while some are left).
 * @param ctx the renderer: its fly-in, hand-over zoom and the tile cache's plan calls
 * @returns planStartGround (the plan's size; 0 with no fly-in), paintPlanned, uploadPlanned
 */
export function densityLoading(ctx: { camState: { fly: Fly | null }; FLY_HANDOVER: number;
  planFly: (views: { x: number; y: number; zoom: number }[]) => number;
  paintPlan: (most: number) => boolean; uploadPlan: (most: number) => boolean }) {
  return {
    planStartGround: (car: CamCar) => (ctx.camState.fly
      ? ctx.planFly(flyPathViews(ctx.camState.fly, car, ctx.FLY_HANDOVER)) : 0),
    paintPlanned: (most: number) => ctx.paintPlan(most),
    uploadPlanned: (most: number) => ctx.uploadPlan(most),
  };
}

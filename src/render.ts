// render.ts — camera, floor, cones, and the cars as PROCEDURAL ART.
//
// Device resolution, DPR capped at 2, PPM derived from the short side of the viewport. The
// world is drawn into a low-resolution art-pixel buffer and blitted to the screen with
// smoothing off; the HUD is drawn afterwards at full resolution. Cars are drawn, not blitted:
// one function per silhouette, scaled in metres, so the same code is crisp on a 390 px phone
// and a desktop and there is no asset pipeline to keep in sync.
//
// createRenderer builds ONE shared context (view, camera, helpers, the sub-painters and a
// small state object) and returns the public renderer object; resize, frame and the debug
// tools are module-level functions that take that context.
//
// Readability rules applied (CLAUDE.md §4): every car carries a DARK RIM so it never dissolves into
// the pale floor, the front end is unmistakable (lights + screen rake + steered wheels), and the
// thing the player must read at a glance — which way the front wheels point — is drawn at full
// contrast.
import type { Settings } from "./core/settings.ts";

import { COL } from "./world/colours.ts";
import { createCarSprite } from "./render/carsprite.ts";
import { createCarDamage } from "./render/cardamage.ts";
import { createCars } from "./render/cars.ts";
import { createParticles } from "./render/particles.ts";
import { createRoad } from "./render/road.ts";
import { createGround } from "./render/ground.ts";
import { createProps } from "./render/props.ts";
import { createObjects } from "./render/objects.ts";
import { createTiles } from "./render/tiles.ts";
import { createCamera } from "./render/camera.ts";
import {
  blitArt, drawCarLayers, drawMarksOnScreen, drawSharpCarLayers,
} from "./render/screen.ts";
import { createGlGround } from "./render/glground.ts";
import type { GlGround, GroundSink } from "./render/glground.ts";
import type { ShadeRect } from "./render/glshade.ts";
import type { GroundPatch, PaintCamera } from "./render/glpaint.ts";
import type { Cam, CamCar, RenderGame, TileBudget, View } from "./render/types.ts";

// PPM is derived from the SHORT side of the viewport, so the car is a consistent fraction of the
// screen everywhere (a flat PPM of 16 put a 4 m car at 64 px on a 1280 px desktop, too small
// to see any drawn detail):
//   390 px phone -> 23 px/m (car 92 px)     1280x720 desktop -> 26 px/m (car 104 px)
// Sizing off min(W,H) is the CLAUDE.md §3 rule for anything that must survive both
// orientations.
export const PPM_MIN = 18, PPM_MAX = 26, PPM_DIV = 17;
export const ZOOM_MIN = 0.30;   // how far out the camera pulls at high speed
// m of hill shading kept beyond the widest view (glshade.ts), so driving never shows an unshaded
// edge
const SHADE_MARGIN_M = 16;
export const LOOKAHEAD = 2.6;   // seconds of road kept in view at any speed
export const MAX_DPR = 2;

// =============================================================================================
// PIXEL-ART MODE — the only renderer. The WORLD is drawn into a low-resolution buffer — one art
// pixel = PIXEL_CSS css px (an integer number of device pixels) — and blitted to the screen with
// smoothing OFF, so every edge is a hard pixel step. The HUD is drawn afterwards at full resolution
// so buttons and numbers stay crisp. Cars are generated PIXEL SPRITES (pixelCar). css px per art
// pixel: a 4 m car is ~70 art px at zoom 1 on a phone
const PIXEL_CSS = 1.3;

/** The values the renderer changes after it is built. */
interface RenderState {
  blockPx: number;   // pixel mode: the device-px size of one art pixel
  realDpr: number;   // the real dpr of the screen canvas
  gpuOn: boolean;    // this frame draws the ground on the GPU canvas (art buffer transparent)
  sharpCars: boolean;   // the cars on the screen canvas (drawSharpCarLayers); ?sharpcars=0 off
  sharpMarks: boolean;  // ?sharpmarks=1: the skid marks on the screen canvas (drawMarksOnScreen)
  screenBegun: boolean; // this frame has blitted the art buffer to the screen at least once
}

/** What the pixel-locked view of one frame changed, so the end of the frame can undo it. */
interface ViewLock {
  wallDt: number;     // the frame's wall-clock step, s
  keepZoom: number;
  subX: number;
  subY: number;
  camTrue: { x: number; y: number } | null;
}

/** The context every moved renderer function takes. */
type RenderCtx = {
  canvas: HTMLCanvasElement;
  view: View;
  cam: Cam;
  state: RenderState;
  noLock: boolean;
  skip: (name: string) => boolean;
  mainCtx: CanvasRenderingContext2D;
  pcanvas: HTMLCanvasElement;
  pctx: CanvasRenderingContext2D;
  gpu: GlGround | null;
  groundPatches: GroundPatch[];   // the GPU painter's patch list, reused every frame
  gpuCamera: PaintCamera;         // where the world lands on the GPU canvas this frame
  noShade: boolean;               // ?noshade: no hill shading
  PPMz: () => number;
  toScreenX: (worldX: number) => number;
  toScreenY: (worldY: number) => number;
} & ReturnType<typeof createGround> & ReturnType<typeof createRoad>
  & ReturnType<typeof createParticles> & ReturnType<typeof createCars>
  & ReturnType<typeof createProps> & ReturnType<typeof createObjects>
  & ReturnType<typeof createCamera> & ReturnType<typeof createTiles>;

/**
 * Sizes the canvas, the art-pixel buffer and the PPM to the current viewport.
 *
 * @param ctx the renderer context
 */
function resizeRenderer(ctx: RenderCtx) {
  const { canvas, view, state, mainCtx, pcanvas, pctx } = ctx;
  state.realDpr = Math.min(MAX_DPR, devicePixelRatio || 1);
  view.dpr = state.realDpr;
  view.W = canvas.clientWidth;
  view.H = canvas.clientHeight;
  canvas.width = Math.round(view.W * state.realDpr);
  canvas.height = Math.round(view.H * state.realDpr);
  // draw in CSS px everywhere below
  mainCtx.setTransform(state.realDpr, 0, 0, state.realDpr, 0, 0);
  // an art pixel is a whole number of device pixels, so the upscale never smears
  state.blockPx = Math.max(2, Math.round(PIXEL_CSS * state.realDpr));
  pcanvas.width = Math.ceil(canvas.width / state.blockPx);
  pcanvas.height = Math.ceil(canvas.height / state.blockPx);
  // the EFFECTIVE dpr every world draw (and every tile) uses
  view.dpr = pcanvas.width / view.W;
  pctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  pctx.imageSmoothingEnabled = false;
  view.ctx = pctx;
  view.PPM = Math.max(PPM_MIN, Math.min(PPM_MAX, Math.min(view.W, view.H) / PPM_DIV));
}

/**
 * Traces a rounded rectangle path on a context.
 *
 * @param target the context to trace on
 * @param x left edge
 * @param y top edge
 * @param width the width
 * @param height the height
 * @param radius the corner radius
 */
function roundRect(
  target: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
  radius: number
) {
  target.beginPath();
  target.moveTo(x + radius, y);
  target.arcTo(x + width, y, x + width, y + height, radius);
  target.arcTo(x + width, y + height, x, y + height, radius);
  target.arcTo(x, y + height, x, y, radius);
  target.arcTo(x, y, x + width, y, radius);
  target.closePath();
}

/**
 * Quantises the zoom and snaps the camera so ground tiles blit on whole art pixels.
 *
 * PIXEL-LOCKED VIEW (requirement: tracks seem to quiver and shake at speed). MEASURED
 * (tools/shimmercheck, Brands GP at speed): every ground tile was blitted at a FRACTIONAL
 * art-pixel position (500/500 frames) and tiles of one frame at MIXED widths (317/500) —
 * each edge was rounded separately, in CSS px not art px — so the pixel-art ground was
 * resampled differently every frame: a shimmer.
 * For drawing only: the zoom is quantised so a tile of the current step is a WHOLE number of
 * art pixels wide (steps of ~0.5 %, invisible), and the camera snapped to a whole art pixel.
 * The smoothed zoom is restored at the end of the frame.
 *
 * @param ctx the renderer context
 * @param wallDt the frame's wall-clock step, s (carried in the lock)
 * @returns what was changed, for blitWorld to undo
 */
function applyViewLock(ctx: RenderCtx, wallDt: number): ViewLock {
  const { view, cam, state, camState, tileState, FLY_HANDOVER, TILE_PX, ZSTEP } = ctx;
  const keepZoom = view.zoom;
  let subX = 0, subY = 0, camTrue: { x: number; y: number } | null = null;
  if (!ctx.noLock && (!camState.fly || view.zoom >= FLY_HANDOVER)) {
    const step = (tileState.lastStep !== null
      && Math.abs(ZSTEP * Math.log2(view.zoom) - tileState.lastStep) < 0.75)
      ? tileState.lastStep : ctx.zStepOf(view.zoom);
    const stepZoom = ctx.zOfStep(step),
      tileArt = Math.max(1, Math.round(TILE_PX * view.dpr * view.zoom / stepZoom));
    // the GPU painter (the default) needs no whole-pixel tiles: the GPU draws them at screen
    // resolution, and a zoom rounded per tile step shifts the ground at every step (zoomcheck)
    if (!ctx.gpu?.painting) view.zoom = tileArt * stepZoom / (TILE_PX * view.dpr);
    tileState.drawnN = tileArt;
    const devPPM = view.PPM * view.zoom * view.dpr,
      halfW = (view.W * view.dpr) / 2,
      halfH = (view.H * view.dpr) / 2;
    // SUB-PIXEL BLIT (requirement: it is still shaking or wiggling as I drive). MEASURED
    // (tools/wobblecheck): snapping the camera to whole art pixels made the world move in uneven
    // 1-or-2-art-pixel steps — camera jerk median 1.46 px per frame, max
    // 8.8 (unlocked: 0.03). Now the world is DRAWN at the snapped camera (crisp, no shimmer) and
    // the finished art-pixel image is shifted on screen by the leftover fraction, in device
    // pixels — so motion is as smooth as before the lock.
    const trueX = cam.x, trueY = cam.y;
    cam.x = (Math.round(cam.x * devPPM - halfW) + halfW) / devPPM;
    cam.y = (Math.round(cam.y * devPPM - halfH) + halfH) / devPPM;
    subX = -(trueX - cam.x) * devPPM * state.blockPx;
    subY = -(trueY - cam.y) * devPPM * state.blockPx;
    camTrue = { x: trueX, y: trueY };
  } else {
    subX = 0;
    subY = 0;
    camTrue = null;
  }
  return { wallDt, keepZoom, subX, subY, camTrue };
}

/**
 * Draws the ground, the deck layers, the marks, the fence, barriers, props and cones.
 *
 * ORDER MATTERS. Everything that IS the ground goes down first, then the marks layer over all
 * of it, then the fence — which is a vertical object and belongs on top of everything on the
 * deck. MEASURED BUG: the run-off was filled AFTER the marks blit, so gravel tracks
 * were painted and then immediately buried under the gravel (requirement: we should leave little
 * tracks in the gravel trap). Check what a thing is drawn OVER — CLAUDE.md §4. ground = floor
 * + zones + ribbon + covers + WEAR, from the tile cache above
 *
 * @param ctx the renderer context
 * @param game the game to draw
 * @param lock what applyViewLock changed (and this frame's wall-clock step)
 * @param wallT the wall-clock time in seconds
 */
function drawWorldLayers(ctx: RenderCtx, game: RenderGame, lock: ViewLock, wallT: number) {
  const { skip } = ctx;
  if (!skip('ground')) ctx.drawGround(lock.wallDt, game.car);
  // the GPU hill shading lies over the whole ground, as the tiles baked it
  if (ctx.state.gpuOn && ctx.gpu!.painting && isGpuShadeOn(ctx)) ctx.gpu!.drawShade(ctx.gpuCamera);
  if (!skip('deck')) {
    ctx.drawRunoff();
    ctx.drawKerb();
    ctx.drawBumps();
    ctx.drawPaint();
    ctx.drawArrows(game, wallT);
  }
  if (!skip('marks')) {
    if (ctx.state.sharpMarks) drawMarksOnScreen(ctx, game, lock);
    else ctx.drawMarks(game.marks);
  }
  if (!skip('fence')) ctx.drawFence();
  if (!skip('barriers')) ctx.drawBarriers();
  if (!skip('props')) ctx.drawProps();
  if (!skip('cones')) {
    ctx.drawCones(game.cones.list);
    ctx.drawTape(game);
  }
}

/**
 * Adds and draws the particle effects: puffs, spray, smoke, damage smoke, chips and sparks.
 *
 * @param ctx the renderer context
 * @param game the game to draw
 * @param wallDt the wall-clock step in seconds
 */
function drawEffects(ctx: RenderCtx, game: RenderGame, wallDt: number) {
  const { skip } = ctx;
  ctx.addPuffs(game.cones.drainHits());
  ctx.addSpray(game.car, game.marks, wallDt);
  ctx.addSmoke(game.car, game.marks, wallDt);
  for (const car of [
    game.car,
    ...(game.ai || []).map((rival) => rival.car),
    ...(game.traffic
      ? game.traffic.cars.filter((vehicle) => vehicle.dmg
        && Math.abs(vehicle.x - game.car.x) < 90 && Math.abs(vehicle.y - game.car.y) < 90)
      : []),
  ]) {
    ctx.addDamageSmoke(car, wallDt);
    ctx.addChips(car);
    ctx.addSparks(car, wallDt);
  }
  if (!skip('fx')) ctx.drawPuffs(wallDt);
  // chips: paint chips on the ground, under the cars (dust over the bonnet reads as a fault)
  if (!skip('fx')) ctx.drawChips(wallDt);
}

/**
 * Blits the art-pixel buffer to the screen (unless the sharp cars already did) and restores the
 * zoom and camera.
 *
 * @param ctx the renderer context
 * @param lock what applyViewLock changed
 * @param blitted true when the art buffer is already on the screen
 */
function blitWorld(ctx: RenderCtx, lock: ViewLock, blitted = false) {
  const { view, cam } = ctx;
  if (!blitted) blitArt(ctx, lock);
  view.zoom = lock.keepZoom;
  if (lock.camTrue) {
    // the true camera for the next frame / tools
    cam.x = lock.camTrue.x;
    cam.y = lock.camTrue.y;
  }
}

/**
 * Draws one frame of the world into the art-pixel buffer and blits it to the screen.
 *
 * @param ctx the renderer context
 * @param game the game to draw
 * @param wallDt the wall-clock step in seconds
 * @param wallT the wall-clock time in seconds
 */
function drawFrame(ctx: RenderCtx, game: RenderGame, wallDt: number, wallT: number) {
  if (!ctx.updateFly(game.car, wallDt)) {
    ctx.follow(game.car, wallDt);
    ctx.updateZoom(game.car, wallDt);
  }
  const lock = applyViewLock(ctx, wallDt);
  ctx.state.screenBegun = false;
  beginGpuGround(ctx, lock);
  drawWorldLayers(ctx, game, lock, wallT);
  drawEffects(ctx, game, wallDt);
  if (ctx.state.sharpCars) drawSharpCarLayers(ctx, game, lock);
  else drawCarLayers(ctx, game);
  blitWorld(ctx, lock, ctx.state.sharpCars);
  if (ctx.state.gpuOn) ctx.gpu!.end();
}

/**
 * Starts the GPU ground for this frame when it is on: the art buffer is cleared to transparent
 * and the GPU canvas gets this frame's CSS px -> device px mapping (the pixel-locked camera and
 * its sub-pixel shift).
 *
 * @param ctx the renderer context
 * @param lock what applyViewLock changed
 */
function beginGpuGround(ctx: RenderCtx, lock: ViewLock) {
  const { gpu, state, pcanvas, pctx, view, canvas } = ctx;
  state.gpuOn = !!gpu && gpu.active && !ctx.skip('ground');
  if (!state.gpuOn) return;
  pctx.save();
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, pcanvas.width, pcanvas.height);
  pctx.restore();
  gpu!.begin({
    width: canvas.width, height: canvas.height, artDpr: view.dpr, blockPx: state.blockPx,
    subX: lock.subX, subY: lock.subY,
  });
  if (gpu!.painting) paintGpuGround(ctx, lock);
}

/**
 * Paints the floor and zones on the GPU (the default; ?gpupaint=0 = the tiles): the outside colour,
 * then the patches, placed by the same pixel-locked camera and sub-pixel shift as the art buffer.
 *
 * @param ctx the renderer context
 * @param lock what applyViewLock changed
 */
function paintGpuGround(ctx: RenderCtx, lock: ViewLock) {
  const { gpu, state, pcanvas, view, cam } = ctx;
  gpu!.sink.fill(COL.outside);
  const count = ctx.listGroundPatches(ctx.groundPatches);
  Object.assign(ctx.gpuCamera, {
    x: cam.x, y: cam.y, devPerMetre: ctx.PPMz() * view.dpr * state.blockPx,
    screenX: (pcanvas.width / 2) * state.blockPx + lock.subX,
    screenY: (pcanvas.height / 2) * state.blockPx + lock.subY,
  });
  gpu!.paint(ctx.gpuCamera, ctx.groundPatches, count, ctx.paletteLUT());
  if (isGpuShadeOn(ctx)) updateGpuShade(ctx);
}

/**
 * Whether the GPU hill shading is drawn this frame: not with ?noshade, and not over the fly-in's
 * whole-level picture.
 *
 * @param ctx the renderer context
 * @returns true to shade
 */
function isGpuShadeOn(ctx: RenderCtx) {
  return !ctx.noShade && !(ctx.camState.fly && ctx.view.zoom < ctx.FLY_HANDOVER);
}

/**
 * Brings the GPU hill shading's cells up to date: the view now, and what the widest zoom (plus
 * SHADE_MARGIN_M) would show, so a zoom-out never meets ground without its shading.
 *
 * @param ctx the renderer context
 */
function updateGpuShade(ctx: RenderCtx) {
  const { view, cam } = ctx;
  const halfW = view.W / 2 / ctx.PPMz(), halfH = view.H / 2 / ctx.PPMz();
  const wideW = view.W / 2 / (view.PPM * ZOOM_MIN) + SHADE_MARGIN_M;
  const wideH = view.H / 2 / (view.PPM * ZOOM_MIN) + SHADE_MARGIN_M;
  ctx.gpu!.updateShade(
    { x0: cam.x - halfW, y0: cam.y - halfH, x1: cam.x + halfW, y1: cam.y + halfH },
    { x0: cam.x - wideW, y0: cam.y - wideH, x1: cam.x + wideW, y1: cam.y + wideH },
  );
}

/**
 * Paints the level flat (no patterns) into a throw-away canvas at ppm px per metre.
 *
 * @param ctx the renderer context
 * @param minX the left edge in metres
 * @param minY the top edge in metres
 * @param maxX the right edge in metres
 * @param maxY the bottom edge in metres
 * @param ppm pixels per metre
 * @returns the width, height and RGBA data
 */
function paintFlat(
  ctx: RenderCtx, minX: number, minY: number, maxX: number, maxY: number, ppm: number
) {
  const { view, cam } = ctx;
  const outW = Math.round((maxX - minX) * ppm),
    outH = Math.round((maxY - minY) * ppm);
  const flatCanvas = document.createElement('canvas');
  flatCanvas.width = outW;
  flatCanvas.height = outH;
  const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
  view.ctx = flatCanvas.getContext('2d')!;
  view.W = outW;
  view.H = outH;
  view.zoom = ppm / view.PPM;
  cam.x = (minX + maxX) / 2;
  cam.y = (minY + maxY) / 2;
  view.noPatterns = true;
  // the same ground layers frame draws: the cached tiles' contents, then the live edge
  // (run-off + edge kerb)
  try {
    ctx.drawFloor();
    ctx.drawZones();
    ctx.drawLanes();
    ctx.drawTrackRibbon();
    ctx.drawPatches();
    ctx.drawCovers();
    ctx.drawCurvedKerbs();
    ctx.drawRunoff();
    ctx.drawKerb();
  } finally {
    view.ctx = keep.ctx;
    view.W = keep.W;
    view.H = keep.H;
    view.zoom = keep.zoom;
    cam.x = keep.cx;
    cam.y = keep.cy;
    view.noPatterns = false;
  }
  return {
    w: outW, h: outH,
    data: Array.from(flatCanvas.getContext('2d')!.getImageData(0, 0, outW, outH).data),
  };
}

/**
 * Builds the debug methods the tools call (zoom pin, colours, tile photos).
 *
 * @param ctx the renderer context
 * @returns the debug methods
 */
function makeDebugTools(ctx: RenderCtx) {
  const { view, camState } = ctx;
  return {
    // for the photo tools (tools/_sceneryshots.mjs): pin the camera zoom (null = back to
    // speed-driven)
    debugZoom(zoom: number | null) {
      camState.pinZoom = zoom;
      if (zoom) view.zoom = zoom;
    },
    // for tools/visualcheck.mjs (user rule: "surface visuals should be accurate to
    // their effects"): the level painted FLAT (each surface its base colour, no patterns, no
    // palette snap) at ppm px per metre, plus the colour each surface id is painted in, so the
    // tool can compare every drawn pixel with groundAt.
    debugFlat(minX: number, minY: number, maxX: number, maxY: number, ppm: number) {
      return paintFlat(ctx, minX, minY, maxX, maxY, ppm);
    },
    debugColours() {
      const base: Record<string, string> = {};
      for (const [surfaceId, art] of Object.entries(ctx.SURFACE_ART))
        if (art) base[surfaceId] = art.base;
      return { base, puddle: { ...ctx.PUDDLE_TINT }, col: { ...COL } };
    },
    // for tools/tilediff.mjs: ground tile (zoom step k, column i, row j) painted fresh -> its
    // pixels (not cached) for tools/tilestrips.mjs: the same tile painted strip by strip, each
    // stepTile timed
    debugTileStrips(step: number, col: number, row: number, strips: number) {
      const job = ctx.startTile(step, col, row), stripMs: number[] = [];
      job.strips = strips;
      for (let done = false; !done;) {
        const began = performance.now();
        done = ctx.stepTile(job);
        stripMs.push(performance.now() - began);
      }
      const tile = ctx.finishTile(job), size = tile.width;
      const data = tile.getContext('2d')!.getImageData(0, 0, size, size).data;
      return { w: size, h: size, stripMs, data: Array.from(data) };
    },
    debugTile(step: number, i: number, j: number) {
      const tile = ctx.paintTile(step, i, j);
      return {
        w: tile.width, h: tile.height,
        data: Array.from(tile.getContext('2d')!.getImageData(0, 0, tile.width, tile.height).data),
      };
    },
  };
}

/**
 * Builds the draw modules of the renderer (ground, road, particles, cars, props, objects, camera,
 * tiles), wired to the shared view, camera and metre-to-pixel helpers.
 *
 * @param view the shared drawing variables
 * @param cam the camera
 * @param settings the game settings
 * @param helpers the metre-to-pixel converters
 * @returns every module, for the render context
 */
function buildModules(view: View, cam: Cam, settings: Settings,
  helpers: { PPMz: () => number, toScreenX: (x: number) => number,
    toScreenY: (y: number) => number, groundSink: () => GroundSink | null,
    fillsOnGpu: () => boolean, heightsChanged: (rect: ShadeRect) => void }) {
  const { PPMz, toScreenX, toScreenY, groundSink, fillsOnGpu, heightsChanged } = helpers;
  // createGround and createRoad need each other (forSide / paintLayers, artBase): the wrapper
  // below is only called at draw time, after createRoad has returned forSide
  const ground = createGround(view, cam, { PPMz, toScreenX, toScreenY, roundRect,
    forSide: (...args) => road.forSide(...args),
    grassEnds: settings.grassEnds, surfaceTextures: settings.surfaceTextures,
    shareBlades: settings.menuFast });
  const road = createRoad(view, cam, {
    PPMz, toScreenX, toScreenY, paintLayers: ground.paintLayers, artBase: ground.artBase,
  });
  const particles = createParticles(view, cam, { PPMz, toScreenX, toScreenY });
  const { pixelCar } = createCarSprite();
  const { damagedSprite, silhouette, faceCache, rolledFaces, drawFaces } = createCarDamage(view);
  const cars = createCars(view, cam, {
    PPMz, toScreenX, toScreenY, pixelCar, damagedSprite, silhouette, rolledFaces, drawFaces,
    faceCache,
  });
  const props = createProps(view, cam, {
    PPMz, toScreenX, toScreenY, roundRect, forSide: road.forSide, drawSlip: road.drawSlip,
  });
  const objects = createObjects(view, cam, {
    PPMz, toScreenX, toScreenY, roundRect, chips: particles.chips, MAX_CHIPS: particles.MAX_CHIPS,
  });

  // createCamera needs paletteSnap / prefetch from the tiles (which need the camera): the wrappers
  // are only called at draw time, after createTiles has returned
  const camera = createCamera(view, cam, {
    PPMz, drawFloor: ground.drawFloor, drawZones: ground.drawZones, drawLanes: road.drawLanes,
    drawTrackRibbon: road.drawTrackRibbon, drawPatches: ground.drawPatches,
    drawCovers: ground.drawCovers, drawCurvedKerbs: road.drawCurvedKerbs,
    // the GPU path draws the overview shrunk, and it is flat palette colours already: no CPU
    // snap (MEASURED: ~0.5 s at CPU x4 in the fly-in's first frame)
    paletteSnap: (target: HTMLCanvasElement) => {
      if (!fillsOnGpu()) tiles.paletteSnap(target);
    },
    prefetch: (...args: [number, number, number, number, TileBudget]) => tiles.prefetch(...args),
    zoomHold: settings.zoomHold,
  });
  const tiles = createTiles(view, cam, settings, {
    PPMz, toScreenX, toScreenY, drawFloor: ground.drawFloor, drawZones: ground.drawZones,
    drawLanes: road.drawLanes, drawTrackRibbon: road.drawTrackRibbon,
    drawLaneDashes: road.drawLaneDashes, drawPatches: ground.drawPatches,
    drawCovers: ground.drawCovers, drawWear: ground.drawWear,
    drawCurvedKerbs: road.drawCurvedKerbs, SURFACE_ART: ground.SURFACE_ART,
    PUDDLE_TINT: ground.PUDDLE_TINT,
    getFly: () => camera.camState.fly, FLY_HANDOVER: camera.FLY_HANDOVER,
    FLY_PREFETCH: camera.FLY_PREFETCH, levelOverview: camera.levelOverview,
    artBase: ground.artBase, groundSink, fillsOnGpu, heightsChanged,
  });
  return { ground, road, particles, pixelCar, cars, props, objects, camera, tiles };
}

/**
 * What the tiles need to know of the GPU ground: where to draw, whether the GPU paints the fills,
 * and where to report changed ground heights.
 *
 * @param state the render state (gpuOn this frame)
 * @param gpu the GPU ground, or null
 * @returns the helpers
 */
function gpuHelpers(state: RenderState, gpu: GlGround | null) {
  return {
    groundSink: () => (state.gpuOn ? gpu!.sink : null),
    fillsOnGpu: () => state.gpuOn && gpu!.painting,
    heightsChanged: (rect: ShadeRect) => gpu?.invalidateShade(rect),
  };
}

/**
 * The GPU ground under the screen canvas, or null (?glground=0, or no WebGL2).
 *
 * @param canvas the screen canvas
 * @param settings the game settings (glGround, gpuPaint)
 * @returns the GPU ground, or null
 */
function createGpuGround(canvas: HTMLCanvasElement, settings: Settings) {
  return settings.glGround ? createGlGround(canvas, settings.gpuPaint) : null;
}

/**
 * A fresh renderer state for these settings.
 * @param settings the game settings (sharpCars, sharpMarks)
 * @returns the state
 */
const newRenderState = (settings: Settings): RenderState =>
  ({ blockPx: 1, realDpr: 1, gpuOn: false, sharpCars: settings.sharpCars,
    sharpMarks: settings.sharpMarks, screenBegun: false });

/**
 * Builds the renderer for a canvas.
 *
 * @param canvas the screen canvas
 * @param settings the game settings
 * @returns the renderer the game, the HUD and the tools use
 */
export function createRenderer(canvas: HTMLCanvasElement, settings: Settings) {
  // ?skip=<layers>: phone judder bisect. Safari records canvas commands and paints them
  // later, outside our timing, so the meter cannot show painting cost; skipping layers can.
  const SKIP = settings.skipLayers;
  const skip = (name: string) =>
    SKIP.has(name) || (SKIP.has('world') && name !== 'ground' && name !== 'car');
  const mainCtx = canvas.getContext('2d')!;   // a fresh canvas always gives a 2d context
  // the 7 most shared drawing variables in one object: zoom is the smoothed speed zoom,
  // noPatterns is set while painting the fly-in overview (flat colours only). The ground cache
  // points every draw function at an off-screen canvas by swapping view.ctx for one render.
  const view: View = { ctx: mainCtx, W: 0, H: 0, dpr: 1, PPM: 22, zoom: 1, noPatterns: false,
    fillsOnGpu: false };
  // pixel mode: the world buffer, its device-px block size, the real dpr of the screen canvas
  const pcanvas = document.createElement('canvas');
  const pctx = pcanvas.getContext('2d')!;   // likewise
  const state = newRenderState(settings);
  const gpu = createGpuGround(canvas, settings);
  const cam: Cam = { x: 0, y: 0, initialised: false };
  // ONE place converts metres to pixels, so nothing can miss the zoom
  const PPMz = () => view.PPM * view.zoom;
  const toScreenX = (worldX: number) => (worldX - cam.x) * PPMz() + view.W / 2;
  const toScreenY = (worldY: number) => (worldY - cam.y) * PPMz() + view.H / 2;

  const { ground, road, particles, pixelCar, cars, props, objects, camera, tiles } =
    buildModules(view, cam, settings, { PPMz, toScreenX, toScreenY, ...gpuHelpers(state, gpu) });

  const ctx: RenderCtx = {
    canvas, view, cam, state, noLock: settings.noLock, skip, mainCtx, pcanvas, pctx, gpu, PPMz,
    groundPatches: [], toScreenX, toScreenY, noShade: settings.noShade,
    gpuCamera: { x: 0, y: 0, devPerMetre: 1, screenX: 0, screenY: 0 },
    ...ground, ...road, ...particles, ...cars, ...props, ...objects, ...camera, ...tiles,
  };
  const { camState, tileState } = ctx;

  return {
    // the HUD draws on the full-resolution screen, even in pixel mode
    get ctx() { return mainCtx; },
    get W() { return view.W; },
    get H() { return view.H; },
    get dpr() { return view.dpr; },
    cam, toScreenX, toScreenY, roundRect, flyIn: ctx.flyIn, thumbnail: ctx.thumbnail,
    resize: () => resizeRenderer(ctx),
    frame: (game: RenderGame, wallDt: number, wallT: number) =>
      drawFrame(ctx, game, wallDt, wallT),
    snap(car: CamCar) {
      cam.x = car.x;
      cam.y = car.y;
      // the look-ahead restarts from the car (follow eases it back in)
      cam.lx = 0;
      cam.ly = 0;
      cam.initialised = true;
    },
    get flying() { return !!camState.fly; },
    get PPM() { return view.PPM * view.zoom; },
    get groundRenders() { return tileState.tilesPainted; },
    get tileMs() { return tileState.tileMs; },
    warmNextTexture: ctx.warmNextTexture, warmBladeTextures: ctx.warmBladeTextures,
    get gpuCounts() { return gpu ? gpu.counts : null; },
    get shadeStats() { return gpu ? gpu.shadeStats() : null; },
    get staleRepaints() { return tileState.staleRepaints; },
    get tileStats() { return { ...tileState, perStep: { ...tileState.perStep } }; },
    get drawnN() { return tileState.drawnN; },
    get overviewBounds() {
      const overview = camState.ovCache && camState.ovCache.ov;
      return overview ? [overview.x0, overview.y0, overview.x1, overview.y1] : null;
    },
    get viewBounds() {
      const ppm = PPMz();
      return [
        cam.x - view.W / 2 / ppm, cam.y - view.H / 2 / ppm,
        cam.x + view.W / 2 / ppm, cam.y + view.H / 2 / ppm,
      ];
    },
    get standInFrame() { return tileState.standIn; },
    pixelCar,                           // for tools/spritesheet.mjs
    pixelCarWithWheels: ctx.pixelCarWithWheels,   // for the garage
    get tileCount() { return ctx.tiles.size; },
    ...makeDebugTools(ctx),
  };
}

// multiply a hex colour's lightness; used for every shade of a car's paint so one `paint` value in
// cars.js produces a whole consistent palette
export function shade(hex: string, factor: number): string {
  const packed = parseInt(hex.slice(1), 16);
  const red = Math.min(255, Math.round(((packed >> 16) & 255) * factor));
  const green = Math.min(255, Math.round(((packed >> 8) & 255) * factor));
  const blue = Math.min(255, Math.round((packed & 255) * factor));
  return `rgb(${red},${green},${blue})`;
}

export type Renderer = ReturnType<typeof createRenderer>;

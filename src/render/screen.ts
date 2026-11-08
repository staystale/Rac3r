// The SCREEN canvas passes of a frame: the art buffer blitted (whole art pixels, shifted by the
// sub-pixel camera remainder), and what is drawn on the full-resolution screen between blits - the
// sharp cars (the default) and,, the skid marks. Everything here is the 2D
// canvas: never copy pixels between it and WebGL per frame (NOTES.md).
import { SPRITE_PPM } from "./shared.ts";
import { drawWetTrails } from "../wettrail.ts";
import { drawStingers } from "./stingers.ts";
import { drawFlipRamps } from "./flipramps.ts";
import type { CarPicture } from "./cars.ts";
import { crossingOf } from "../world/crossinggeo.ts";
import { CROSSING_MARK_MARGIN_M, MARK_PPM, forEachCrossingMarks } from "../marks.ts";
import { LEVEL } from "../world/state.ts";
import type { RenderCar, RenderGame, RenderMarks, View } from "./types.ts";
import type { Crossing } from "../world/types.ts";

/** What the screen passes read from the renderer (render.ts RenderCtx has all of it). */
export interface ScreenCtx {
  canvas: HTMLCanvasElement;
  view: View;
  state: { blockPx: number; gpuOn: boolean; screenBegun: boolean; wallDt: number };
  gpu: { canvas: HTMLCanvasElement } | null;
  mainCtx: CanvasRenderingContext2D;
  pcanvas: HTMLCanvasElement;
  pctx: CanvasRenderingContext2D;
  skip: (name: string) => boolean;
  PPMz: () => number;
  toScreenX: (worldX: number) => number;
  toScreenY: (worldY: number) => number;
  drawPixelCar: (car: RenderCar) => void;
  paintCarPicture: (car: RenderCar, enlarge: number) => CarPicture;
  drawProps: (overhead?: boolean) => void;
  drawCrossingGround: (kind: 'bridge' | 'tunnel') => void;
  drawMarks: (marks: RenderMarks) => void;
  drawRain: () => void;
  drawOverPuffs: (wallDt: number) => void;
  drawSparks: (wallDt: number, target: CanvasRenderingContext2D) => void;
}

/** The sub-pixel camera shift of the frame, device px (render.ts ViewLock). */
export interface ScreenLock {
  subX: number;
  subY: number;
}

/**
 * Calls draw for every car to draw, back to front: the highway traffic near the view, the AI
 * cars, then the player's.
 *
 * @param ctx the renderer context
 * @param game the game to draw
 * @param draw draws one car
 */
export function forEachDrawnCar(ctx: ScreenCtx, game: RenderGame,
    draw: (car: RenderCar) => void) {
  const { view, skip } = ctx;
  // HIGHWAY TRAFFIC (traffic.js), only the ones near the view (they are spread over ~800 m),
  // under the AI and the player
  if (game.traffic && !skip('traffic')) {
    const margin = 12 * ctx.PPMz();
    for (const car of game.traffic.cars) {
      const screenX = ctx.toScreenX(car.x), screenY = ctx.toScreenY(car.y);
      if (screenX < -margin || screenX > view.W + margin
        || screenY < -margin || screenY > view.H + margin) continue;
      draw(car);
    }
  }
  // AI cars under the player's
  if (!skip('ai')) for (const rival of game.ai || []) draw(rival.car);
  if (!skip('car')) draw(game.car);
}

/**
 * SHARP CARS: the cars drawn on the full-resolution screen canvas instead of the
 * art buffer, so their pixels stay crisp squares at any angle and zoom (look B, the owner's choice
 * from tools/scratch/carmock.html), with nothing copied to WebGL. The art buffer so far
 * (everything under the cars) is blitted first; each car's picture is painted enlarged by a whole
 * factor (nearest), then turned and scaled onto the screen with smoothing, which blends only
 * across its pixel edges; then the art buffer is cleared, takes the overhead props and is blitted
 * over the cars. A car on a bridge (world/crossings.ts) is drawn after that, over the bridge; one
 * in a tunnel only where it is not under the ground (there it is hidden). A crossing's tyre
 * marks (marks.ts) are drawn with its cars.
 *
 * @param ctx the renderer context
 * @param game the game to draw
 * @param lock what applyViewLock changed (the sub-pixel shift)
 */
export function drawSharpCarLayers(ctx: ScreenCtx, game: RenderGame, lock: ScreenLock) {
  const { state, mainCtx } = ctx;
  blitArt(ctx, lock);
  mainCtx.save();
  const sharp = sharpScale(ctx, lock);
  // the tunnels' tyre marks over their portals' cuts (none shows under the ground)
  if (LEVEL.crossings) drawCrossingMarks(ctx, sharp, 'tunnel');
  drawSparksOnScreen(ctx, lock);
  forEachDrawnCar(ctx, game, (car) => {
    const way = crossingOf(car);
    if (!way) drawSharpCar(ctx, car, sharp);
    else if (way.kind === 'tunnel') {
      // hidden only where it is under the ground: it goes under the lintel bit by bit
      mainCtx.save();
      clipAboveGround(ctx, way, sharp);
      drawSharpCar(ctx, car, sharp);
      mainCtx.restore();
    }
  });
  mainCtx.restore();
  clearArt(ctx);
  // steam and engine smoke rise off the bonnets, over the cars (render/enginesmoke.ts) - but under
  // what is overhead: a bridge's deck, a gantry, a tree's canopy covers the smoke beneath it
  if (!ctx.skip('fx')) ctx.drawOverPuffs(state.wallDt);
  if (!ctx.skip('props')) ctx.drawProps(true);
  // a bridge's own ground (its water, oil, glass) on its deck and ramps (world/deckwear.ts)
  if (LEVEL.crossings && !ctx.skip('ground')) ctx.drawCrossingGround('bridge');
  if (!ctx.skip('rain')) ctx.drawRain();
  blitArt(ctx, lock);
  if (!LEVEL.crossings) return;
  mainCtx.save();
  sharpScale(ctx, lock);
  // the bridges' tyre marks on their decks and ramps, then the cars on them
  drawCrossingMarks(ctx, sharp, 'bridge');
  forEachDrawnCar(ctx, game, (car) => {
    const way = crossingOf(car);
    if (way && way.kind === 'bridge') drawSharpCar(ctx, car, sharp);
  });
  mainCtx.restore();
}

/**
 * Draws the tyre marks laid on each bridge or each tunnel (marks.ts: each its own layer in its
 * own frame) - a tunnel's only outside its underground stretch.
 * @param ctx the renderer context
 * @param sharp the frame's sharp-car scale
 * @param kind the bridges' or the tunnels'
 */
function drawCrossingMarks(ctx: ScreenCtx, sharp: SharpScale, kind: Crossing['kind']) {
  const { mainCtx } = ctx, perPx = (ctx.PPMz() / MARK_PPM) * sharp.devPerCss;
  forEachCrossingMarks((way, layer) => {
    if (way.kind !== kind) return;
    mainCtx.save();
    if (kind === 'tunnel') clipAboveGround(ctx, way, sharp);
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.translate(ctx.toScreenX(way.ax) * sharp.devPerCss + sharp.subX,
      ctx.toScreenY(way.ay) * sharp.devPerCss + sharp.subY);
    mainCtx.rotate(Math.atan2(way.dirY, way.dirX));
    mainCtx.scale(perPx, perPx);
    // as the ground's marks: hard blocks (render/road.ts drawMarks)
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(layer, -CROSSING_MARK_MARGIN_M * MARK_PPM,
      (way.minAcross - CROSSING_MARK_MARGIN_M) * MARK_PPM);
    mainCtx.restore();
  });
}

/** How a frame's sharp cars are put on the screen: device px a CSS px, enlargement, scale. */
interface SharpScale { devPerCss: number; enlarge: number; scale: number; subX: number;
  subY: number }

/**
 * The frame's sharp-car scale, and the screen canvas set to smooth by it.
 * @param ctx the renderer context
 * @param lock what applyViewLock changed (the sub-pixel shift)
 * @returns the scale
 */
function sharpScale(ctx: ScreenCtx, lock: ScreenLock): SharpScale {
  const { view, state, mainCtx } = ctx;
  const devPerCss = view.dpr * state.blockPx;
  const devPerTexel = (ctx.PPMz() / SPRITE_PPM) * devPerCss;
  // enlarged so the final step only shrinks a little (an even edge blend); shrunk below one
  // device px per texel the browser's high-quality filter averages instead of dropping pixels
  const enlarge = Math.max(1, Math.ceil(devPerTexel - 0.01)), scale = devPerTexel / enlarge;
  mainCtx.imageSmoothingEnabled = true;
  mainCtx.imageSmoothingQuality = enlarge === 1 && scale < 1 ? 'high' : 'low';
  return { devPerCss, enlarge, scale, subX: lock.subX, subY: lock.subY };
}

/**
 * Draws one car's picture turned and scaled onto the screen canvas.
 * @param ctx the renderer context
 * @param car the car
 * @param sharp the frame's sharp-car scale
 */
function drawSharpCar(ctx: ScreenCtx, car: RenderCar, sharp: SharpScale) {
  const { mainCtx } = ctx, picture = ctx.paintCarPicture(car, sharp.enlarge);
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.translate(ctx.toScreenX(car.x) * sharp.devPerCss + sharp.subX,
    ctx.toScreenY(car.y) * sharp.devPerCss + sharp.subY);
  mainCtx.rotate(car.heading);
  mainCtx.scale(sharp.scale, sharp.scale);
  mainCtx.drawImage(picture.canvas, -picture.originX, -picture.originY);
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
}

// m: a tunnel's underground stretch reaches this far past its walls (a car's mirror over them)
const UNDERGROUND_MARGIN_M = 0.6;

/**
 * Clips the screen canvas to everything but a tunnel's underground stretch (from one portal's
 * lintel to the other's): what is in it is hidden.
 * @param ctx the renderer context
 * @param way the tunnel
 * @param sharp the frame's sharp-car scale
 */
function clipAboveGround(ctx: ScreenCtx, way: Crossing, sharp: SharpScale) {
  const { mainCtx } = ctx;
  const least = way.minAcross - UNDERGROUND_MARGIN_M, most = way.maxAcross + UNDERGROUND_MARGIN_M;
  const corner = (along: number, across: number, first: boolean) => {
    const x = way.ax + way.dirX * along - way.dirY * across;
    const y = way.ay + way.dirY * along + way.dirX * across;
    const screenX = ctx.toScreenX(x) * sharp.devPerCss + sharp.subX;
    const screenY = ctx.toScreenY(y) * sharp.devPerCss + sharp.subY;
    if (first) mainCtx.moveTo(screenX, screenY);
    else mainCtx.lineTo(screenX, screenY);
  };
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.beginPath();
  // the whole canvas, the stretch cut out of it (even-odd)
  mainCtx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
  corner(way.cut, least, true);
  corner(way.length - way.cut, least, false);
  corner(way.length - way.cut, most, false);
  corner(way.cut, most, false);
  mainCtx.closePath();
  mainCtx.clip('evenodd');
}

/**
 * SPARKS at screen resolution over the road and under the cars (render/particles.ts); the night's
 * light map opens the dark along them (render/light.ts). In art px like the marks; added as
 * light ('lighter').
 * @param ctx the renderer context
 * @param lock what applyViewLock changed
 */
export function drawSparksOnScreen(ctx: ScreenCtx, lock: ScreenLock) {
  const { view, state, mainCtx } = ctx;
  if (ctx.skip('fx')) return;
  const devPerCss = view.dpr * state.blockPx;
  mainCtx.save();
  mainCtx.setTransform(devPerCss, 0, 0, devPerCss, lock.subX, lock.subY);
  mainCtx.globalCompositeOperation = 'lighter';
  ctx.drawSparks(state.wallDt, mainCtx);
  mainCtx.restore();
}

/**
 * Blits the art-pixel buffer to the screen, shifted by the sub-pixel remainder.
 *
 * @param ctx the renderer context
 * @param lock what applyViewLock changed
 */
export function blitArt(ctx: ScreenCtx, lock: ScreenLock) {
  const { state, mainCtx, pcanvas } = ctx;
  mainCtx.save();
  mainCtx.setTransform(1, 0, 0, 1, 0, 0);
  mainCtx.imageSmoothingEnabled = false;
  // the frame's first blit: over the GPU ground the screen canvas is cleared, so the transparent
  // art buffer shows it
  if (!state.screenBegun && state.gpuOn) {
    mainCtx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  state.screenBegun = true;
  mainCtx.drawImage(pcanvas, lock.subX, lock.subY, pcanvas.width * state.blockPx,
    pcanvas.height * state.blockPx);
  mainCtx.restore();
}

/**
 * Clears the art buffer (after it was blitted, for the layers drawn over what came next).
 *
 * @param ctx the renderer context
 */
export function clearArt(ctx: ScreenCtx) {
  const { pcanvas, pctx } = ctx;
  pctx.save();
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, pcanvas.width, pcanvas.height);
  pctx.restore();
}

/**
 * SHARP MARKS: the skid-mark layer drawn on the full-resolution screen canvas
 * instead of the art buffer. Its pixels (4.2 per metre) were stretched ~3.6x with no smoothing
 * into art pixels (1.3 CSS px), so a mark pixel came out 3 or 4 art px wide by camera position and
 * its edges jumped as the camera moved (the quiver). On the screen they still land as hard blocks,
 * but an edge can only move by one device pixel. The art buffer so far (ground, deck) is blitted
 * first and cleared for the layers over the marks.
 *
 * @param ctx the renderer context
 * @param game the game to draw
 * @param lock what applyViewLock changed (the sub-pixel shift)
 */
export function drawMarksOnScreen(ctx: ScreenCtx, game: RenderGame, lock: ScreenLock) {
  const { view, state, mainCtx } = ctx;
  blitArt(ctx, lock);
  clearArt(ctx);
  const devPerCss = view.dpr * state.blockPx, keep = view.ctx;
  mainCtx.save();
  mainCtx.setTransform(devPerCss, 0, 0, devPerCss, lock.subX, lock.subY);
  view.ctx = mainCtx;
  try {
    ctx.drawMarks(game.marks);
    drawWetTrails(mainCtx, ctx.toScreenX, ctx.toScreenY, ctx.PPMz());
    // tyre spikes on the test levels
    drawStingers(mainCtx, ctx.toScreenX, ctx.toScreenY, ctx.PPMz());
    // the flip ramps on the test levels
    drawFlipRamps(mainCtx, ctx.toScreenX, ctx.toScreenY, ctx.PPMz());
  } finally {
    view.ctx = keep;
    mainCtx.restore();
  }
}

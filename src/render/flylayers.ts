// render/flylayers.ts - THE SMOOTH FLY-IN (?smoothfly=1, FIX.smoothfly): zoomed out, a fly-in frame
// drew every prop and loose object one by one - Spa's 8 000 trees and 3 329 cones. MEASURED
// (tools/scratch/_flycost.mjs, the second PC at CPU x1, Spa, 20 AI, behind the loading screen):
// the zoomed-out frames 117-133 ms apart, our drawing 97-124 ms of each; without the props 67 ms,
// without props and cones 13 ms, also without the fence, barriers and deck 5 ms.
// So the layers that do not move while the field waits at the lights - the deck (run-off, kerbs,
// bumps, paint), the fence, the barriers, the props, the tunnels' ground, the loose objects and
// the tape - are painted ONCE per fly-in into a picture, and the props over the cars (canopies,
// bridge decks, gantries) and the bridges' ground into a second; while the zoom is below the
// pictures' own (PICTURE_REACH times the fly-in's opening zoom, at most the tiles' hand-over) the
// frame draws the two pictures in place of those layers. Past it the live drawing takes over as
// before: the pictures are painted at the art buffer's px a metre AT that zoom, so the hand-over
// shows the same picture. The marks and the pulsing joker arrows stay live (over the picture);
// the cars, the effects, the night and the weather are drawn as before. Only while the field is
// held at the lights (nothing can move a cone or a prop); never on the endless road (its traffic
// moves under the fly-in). The pictures are let go when the fly-in ends.
import { LEVEL } from '../world/state.ts';
import { trackCanvas } from '../core/memorybudget.ts';
import { FIX } from '../core/fixes.ts';
import type { Cam, CamState, Fly, RenderGame, View } from './types.ts';

// x the fly-in's opening zoom: the pictures stand in up to this zoom. MEASURED (_flycost, Spa,
// CPU x1, the second PC): the live props and cones cost ~45 ms a frame at the opening zoom (0.02)
// and ~10 ms at 0.09-0.11; five times the opening zoom shows 1/25 of the level's objects
const PICTURE_REACH = 5;
// px: the longest side a picture may have (its reach is cut back to fit; two are held during the
// fly-in, ~16 MB each at most)
const PICTURE_MAX_PX = 2048;
// share of the opening view added round the pictures: the pan toward the car can take the view a
// little past the opening one (a frame whose view leaves the pictures is drawn live)
const RECT_MARGIN = 0.3;

/** What the pictures painter draws with (the renderer's painters and view). */
export interface FlyLayersCtx {
  view: View;
  cam: Cam;
  skip: (name: string) => boolean;
  PPMz: () => number;
  toScreenX: (worldX: number) => number;
  toScreenY: (worldY: number) => number;
  camState: CamState;
  FLY_HANDOVER: number;   // the tiles' hand-over zoom (render/camera.ts)
  drawRunoff: () => void;
  drawKerb: () => void;
  drawBumps: () => void;
  drawPaint: () => void;
  drawFence: () => void;
  drawBarriers: () => void;
  drawProps: (overhead?: boolean) => void;
  drawCrossingGround: (kind: 'bridge' | 'tunnel') => void;
  drawCones: (cones: RenderGame['cones']['list']) => void;
  drawTape: (game: RenderGame) => void;
}

/** The two pictures of one fly-in, the world rectangle they cover and the zoom they stand in to. */
interface FlyPictures {
  fly: Fly;
  under: HTMLCanvasElement;
  over: HTMLCanvasElement;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  reachZoom: number;
}

let pictures: FlyPictures | null = null;
// the pictures standing in this frame (under() decides, over() follows)
let standing: FlyPictures | null = null;

/**
 * Whether the field is still: the start armed and the lights not yet green (every car held).
 * @param game the game
 * @returns true while nothing can move a prop or a loose object
 */
function isFieldStill(game: RenderGame): boolean {
  return !!game.start && game.start.on && !game.start.green;
}

/**
 * Paints layers into a fresh canvas covering the fly-in's rectangle at a px a metre (the view
 * pointed at it, then put back).
 * @param ctx the painters
 * @param rect the world rectangle [x0, y0, x1, y1], m
 * @param pxPerMetre the picture's px a metre
 * @param paint draws the layers
 * @returns the canvas
 */
function paintPicture(ctx: FlyLayersCtx, rect: number[], pxPerMetre: number,
  paint: () => void): HTMLCanvasElement {
  const { view, cam } = ctx;
  const [left, top, right, bottom] = rect;
  const canvas = trackCanvas(document.createElement('canvas'));
  canvas.width = Math.max(1, Math.round((right - left) * pxPerMetre));
  canvas.height = Math.max(1, Math.round((bottom - top) * pxPerMetre));
  const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, dpr: view.dpr,
    x: cam.x, y: cam.y };
  view.ctx = canvas.getContext('2d')!;   // a fresh canvas always gives a 2d context
  view.W = canvas.width;
  view.H = canvas.height;
  view.dpr = 1;
  view.zoom = pxPerMetre / view.PPM;
  cam.x = (left + right) / 2;
  cam.y = (top + bottom) / 2;
  try {
    paint();
  } finally {
    Object.assign(view, { ctx: keep.ctx, W: keep.W, H: keep.H, zoom: keep.zoom, dpr: keep.dpr });
    cam.x = keep.x;
    cam.y = keep.y;
  }
  return canvas;
}

/**
 * The layers under the cars that hold still at the start, in drawWorldLayers' order.
 * @param ctx the painters
 * @param game the game
 */
function paintUnder(ctx: FlyLayersCtx, game: RenderGame) {
  const { skip } = ctx;
  if (!skip('deck')) {
    ctx.drawRunoff();
    ctx.drawKerb();
    ctx.drawBumps();
    ctx.drawPaint();
  }
  if (!skip('fence')) ctx.drawFence();
  if (!skip('barriers')) ctx.drawBarriers();
  if (!skip('props')) ctx.drawProps();
  if (LEVEL.crossings && !skip('ground')) ctx.drawCrossingGround('tunnel');
  if (!skip('cones')) {
    ctx.drawCones(game.cones.list);
    ctx.drawTape(game);
  }
}

/**
 * The layers over the cars (screen.ts drawSharpCarLayers' second pass, less the smoke and rain).
 * @param ctx the painters
 */
function paintOver(ctx: FlyLayersCtx) {
  if (!ctx.skip('props')) ctx.drawProps(true);
  if (LEVEL.crossings && !ctx.skip('ground')) ctx.drawCrossingGround('bridge');
}

/**
 * Paints the fly-in's two pictures (behind the loading screen, or on the fly-in's first frame).
 * @param ctx the painters
 * @param game the game
 * @param fly the fly-in
 * @returns the pictures
 */
function paintPictures(ctx: FlyLayersCtx, game: RenderGame, fly: Fly): FlyPictures {
  const { view } = ctx;
  // what the opening view shows (the level fitted, and past its ends the other way), and a margin
  const halfW = (view.W / 2 / (view.PPM * fly.z0)) * (1 + RECT_MARGIN);
  const halfH = (view.H / 2 / (view.PPM * fly.z0)) * (1 + RECT_MARGIN);
  const rect = [fly.cx - halfW, fly.cy - halfH, fly.cx + halfW, fly.cy + halfH];
  const longest = Math.max(rect[2] - rect[0], rect[3] - rect[1]);
  // art px a metre at zoom 1 (view.dpr: art px a CSS px)
  const artPerMetre = view.PPM * view.dpr;
  const reachZoom = Math.min(ctx.FLY_HANDOVER, fly.z0 * PICTURE_REACH,
    PICTURE_MAX_PX / (longest * artPerMetre));
  const pxPerMetre = artPerMetre * reachZoom;
  return {
    fly, reachZoom, x0: rect[0], y0: rect[1], x1: rect[2], y1: rect[3],
    under: paintPicture(ctx, rect, pxPerMetre, () => paintUnder(ctx, game)),
    over: paintPicture(ctx, rect, pxPerMetre, () => paintOver(ctx)),
  };
}

/**
 * Whether the view lies within the pictures.
 * @param ctx the view and camera
 * @param shown the pictures
 * @returns true when every screen pixel falls on them
 */
function isViewInside(ctx: FlyLayersCtx, shown: FlyPictures): boolean {
  const { view, cam, PPMz } = ctx;
  const halfW = view.W / 2 / PPMz(), halfH = view.H / 2 / PPMz();
  return cam.x - halfW >= shown.x0 && cam.x + halfW <= shown.x1 && cam.y - halfH >= shown.y0
    && cam.y + halfH <= shown.y1;
}

/**
 * The fly-in's pictures when they stand in this frame: the switch on, a fly-in under way zoomed
 * out below their zoom, the field still, not the endless road. Painted the first time asked
 * for a fly-in; let go when it ends.
 * @param ctx the painters
 * @param game the game
 * @returns the pictures, or null to draw live
 */
function picturesNow(ctx: FlyLayersCtx, game: RenderGame): FlyPictures | null {
  const fly = ctx.camState.fly;
  if (!fly) {
    pictures = null;
    return null;
  }
  if (LEVEL.endless || !isFieldStill(game)) return null;
  if (!pictures || pictures.fly !== fly) pictures = paintPictures(ctx, game, fly);
  return ctx.view.zoom < pictures.reachZoom && isViewInside(ctx, pictures) ? pictures : null;
}

/**
 * Draws a picture over its world rectangle on a context, smoothed (it is shrunk while zoomed
 * out).
 * @param ctx the painters
 * @param target the context
 * @param picture the canvas
 * @param shown the pictures (their rectangle)
 */
function drawPicture(ctx: FlyLayersCtx, target: CanvasRenderingContext2D,
  picture: HTMLCanvasElement, shown: FlyPictures) {
  const { toScreenX, toScreenY, PPMz } = ctx;
  target.save();
  target.imageSmoothingEnabled = false;
  target.drawImage(picture, toScreenX(shown.x0), toScreenY(shown.y0),
    (shown.x1 - shown.x0) * PPMz(), (shown.y1 - shown.y0) * PPMz());
  target.restore();
}

/** The fly-in's pictures layer as the frame asks it (render.ts, screen.ts). */
export interface FlyLayers {
  ready: (game: RenderGame) => void;
  under: (game: RenderGame) => boolean;
  over: () => boolean;
}

// the switch off: nothing painted, every layer drawn live
export const NO_FLY_LAYERS: FlyLayers = { ready: () => {}, under: () => false, over: () => false };

/**
 * Builds the fly-in's pictures layer (?smoothfly=1; off: NO_FLY_LAYERS).
 * @param ctx the painters, the view, the camera state and the tiles' hand-over zoom
 * @returns ready (paint them, behind the loading screen), under (the picture of the layers under
 * the cars drawn in the art buffer: true when it stood in for them) and over (the same over them)
 */
export function createFlyLayers(ctx: FlyLayersCtx): FlyLayers {
  if (!FIX.smoothfly) return NO_FLY_LAYERS;
  return {
    ready(game: RenderGame) {
      picturesNow(ctx, game);
    },
    under(game: RenderGame): boolean {
      standing = picturesNow(ctx, game);
      if (standing) drawPicture(ctx, ctx.view.ctx, standing.under, standing);
      return !!standing;
    },
    over(): boolean {
      if (standing) drawPicture(ctx, ctx.view.ctx, standing.over, standing);
      return !!standing;
    },
  };
}

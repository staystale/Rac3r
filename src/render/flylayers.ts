// render/flylayers.ts - THE SMOOTH FLY-IN (?smoothfly=1, FIX.smoothfly): zoomed out, a fly-in frame
// drew every prop and loose object one by one - Spa's 8 000 trees and 3 329 cones. MEASURED
// (tools/scratch/_flycost.mjs, the second PC at CPU x1, Spa, 20 AI, behind the loading screen):
// the zoomed-out frames 117-133 ms apart, our drawing 97-124 ms of each; without the props 67 ms,
// without props and cones 13 ms, also without the fence, barriers and deck 5 ms.
// So the layers that do not move while the field waits at the lights - the deck (run-off, kerbs,
// bumps, paint), the fence, the barriers, the props, the tunnels' ground, the loose objects and
// the tape - are painted into a picture, and the props over the cars (canopies, bridge decks,
// gantries) and the bridges' ground into a second, and the frame draws the two in place of those
// layers. The fly-in's path is known (camera.ts flyViewAt), so its zooms up to LIVE_FROM are cut
// into SETS of pictures, each covering the views of its part of the path, painted at the art
// buffer's px a metre at its top zoom: shrunk while zoomed out, 1:1 where the next set (or the
// live drawing) takes over, so a hand-over shows the same picture. The marks and the pulsing
// joker arrows stay live (over the picture); the cars, the effects, the night and the weather are
// drawn as before. Only while the field is held at the lights (nothing can move a cone or a
// prop), never on the endless road (its traffic moves under the fly-in); a frame whose view
// leaves its set's pictures is drawn live. Painted behind the loading screen (without it, each set
// the first time the fly-in reaches it); a set is let go once the fly-in has zoomed past it.
import { LEVEL } from '../world/state.ts';
import { trackCanvas } from '../core/memorybudget.ts';
import { FIX } from '../core/fixes.ts';
import { flyViewAt } from './camera.ts';
import type { Cam, CamCar, CamState, Fly, RenderGame, View } from './types.ts';

// the zoom from which the props and loose objects are drawn live. MEASURED (_flycost, Spa, CPU
// x1, the second PC): live, the frame's drawing took 48 ms at zoom 0.04, 25 at 0.07, 9-15 at
// 0.10-0.11, 5 from 0.16
const LIVE_FROM = 0.1;
// a set's top zoom over its bottom one: its pictures are about this many times the screen's size
// (and the pan's spread) at most
const SET_STEP = 2.5;
// px: the longest side a picture may have (a set's top zoom is cut back to fit)
const PICTURE_MAX_PX = 2048;
// share of a set's views added round its pictures (the path between two samples)
const RECT_MARGIN = 0.05;
// points of the fly-in's path read to find each set's views
const PATH_SAMPLES = 120;

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

/** One set: the zooms it stands in for, its world rectangle and its pictures (once painted). */
interface PictureSet {
  zoomFrom: number;
  zoomTo: number;
  rect: number[];   // [left, top, right, bottom], m
  under: HTMLCanvasElement | null;
  over: HTMLCanvasElement | null;
}

// the fly-in the sets were planned for, and the sets
let planned: { fly: Fly; sets: PictureSet[] } | null = null;
// the set standing in this frame (under() decides, over() follows)
let standing: PictureSet | null = null;

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
 * The union of the views along the path with a zoom in a range, with a margin.
 * @param ctx the view
 * @param path the path's views
 * @param zoomFrom the range's bottom
 * @param zoomTo the range's top
 * @returns [left, top, right, bottom], m
 */
function viewsRect(ctx: FlyLayersCtx, path: { x: number; y: number; zoom: number }[],
  zoomFrom: number, zoomTo: number): number[] {
  const { view } = ctx;
  const rect = [Infinity, Infinity, -Infinity, -Infinity];
  path.forEach((place, index) => {
    // (the next point too: the views between two points)
    const next = path[Math.min(path.length - 1, index + 1)];
    if (place.zoom > zoomTo || next.zoom < zoomFrom) return;
    const halfW = view.W / 2 / (view.PPM * place.zoom);
    const halfH = view.H / 2 / (view.PPM * place.zoom);
    rect[0] = Math.min(rect[0], place.x - halfW);
    rect[1] = Math.min(rect[1], place.y - halfH);
    rect[2] = Math.max(rect[2], place.x + halfW);
    rect[3] = Math.max(rect[3], place.y + halfH);
  });
  const padX = (rect[2] - rect[0]) * RECT_MARGIN, padY = (rect[3] - rect[1]) * RECT_MARGIN;
  return [rect[0] - padX, rect[1] - padY, rect[2] + padX, rect[3] + padY];
}

/**
 * Cuts the fly-in's zooms below LIVE_FROM into sets along its path.
 * @param ctx the view and the hand-over zoom
 * @param fly the fly-in
 * @param car the car it ends on
 * @returns the sets (not yet painted)
 */
function planSets(ctx: FlyLayersCtx, fly: Fly, car: CamCar): PictureSet[] {
  const { view } = ctx;
  const path = Array.from({ length: PATH_SAMPLES + 1 },
    (_unused, index) => flyViewAt(fly, car, index / PATH_SAMPLES));
  // art px a metre at zoom 1 (view.dpr: art px a CSS px)
  const artPerMetre = view.PPM * view.dpr;
  const liveFrom = Math.min(ctx.FLY_HANDOVER, LIVE_FROM);
  const sets: PictureSet[] = [];
  let zoomFrom = fly.z0;
  while (zoomFrom < liveFrom) {
    let zoomTo = Math.min(liveFrom, zoomFrom * SET_STEP);
    const rect = viewsRect(ctx, path, zoomFrom, zoomTo);
    const longest = Math.max(rect[2] - rect[0], rect[3] - rect[1]);
    zoomTo = Math.min(zoomTo, PICTURE_MAX_PX / (longest * artPerMetre));
    // (a picture too big to gain a step: the rest is drawn live)
    if (!(zoomTo > zoomFrom * 1.1)) break;
    sets.push({ zoomFrom, zoomTo, rect, under: null, over: null });
    zoomFrom = zoomTo;
  }
  return sets;
}

/**
 * Paints a set's two pictures at the art buffer's px a metre at its top zoom.
 * @param ctx the painters
 * @param game the game
 * @param set the set
 */
function paintSet(ctx: FlyLayersCtx, game: RenderGame, set: PictureSet) {
  const pxPerMetre = ctx.view.PPM * ctx.view.dpr * set.zoomTo;
  set.under = paintPicture(ctx, set.rect, pxPerMetre, () => paintUnder(ctx, game));
  set.over = paintPicture(ctx, set.rect, pxPerMetre, () => paintOver(ctx));
}

/**
 * Whether the view lies within a set's pictures.
 * @param ctx the view and camera
 * @param set the set
 * @returns true when every screen pixel falls on them
 */
function isViewInside(ctx: FlyLayersCtx, set: PictureSet): boolean {
  const { view, cam, PPMz } = ctx;
  const halfW = view.W / 2 / PPMz(), halfH = view.H / 2 / PPMz();
  return cam.x - halfW >= set.rect[0] && cam.x + halfW <= set.rect[2]
    && cam.y - halfH >= set.rect[1] && cam.y + halfH <= set.rect[3];
}

/**
 * The set standing in this frame: the switch on, a fly-in under way below LIVE_FROM, the field
 * still, not the endless road, the view inside the set. Planned the first time asked for a
 * fly-in; a set is painted the first time it is needed and let go once the zoom has passed it.
 * @param ctx the painters
 * @param game the game
 * @returns the set, or null to draw live
 */
function setNow(ctx: FlyLayersCtx, game: RenderGame): PictureSet | null {
  const fly = ctx.camState.fly;
  if (!fly) {
    planned = null;
    return null;
  }
  if (LEVEL.endless || !isFieldStill(game)) return null;
  if (!planned || planned.fly !== fly) planned = { fly, sets: planSets(ctx, fly, game.car) };
  const zoom = ctx.view.zoom;
  for (const set of planned.sets) {
    if (zoom >= set.zoomTo) set.under = set.over = null;
  }
  const set = planned.sets.find((each) => zoom < each.zoomTo);
  if (!set || !isViewInside(ctx, set)) return null;
  if (!set.under) paintSet(ctx, game, set);
  return set;
}

/**
 * Draws a picture over its world rectangle (point-sampled, as the art buffer draws).
 * @param ctx the painters
 * @param picture the canvas
 * @param rect its world rectangle
 */
function drawPicture(ctx: FlyLayersCtx, picture: HTMLCanvasElement, rect: number[]) {
  const { toScreenX, toScreenY, PPMz } = ctx;
  ctx.view.ctx.drawImage(picture, toScreenX(rect[0]), toScreenY(rect[1]),
    (rect[2] - rect[0]) * PPMz(), (rect[3] - rect[1]) * PPMz());
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
 * @returns ready (plan and paint every set: behind the loading screen), under (the picture of
 * the layers under the cars drawn in the art buffer: true when it stood in for them) and over
 * (the same over them)
 */
export function createFlyLayers(ctx: FlyLayersCtx): FlyLayers {
  if (!FIX.smoothfly) return NO_FLY_LAYERS;
  return {
    ready(game: RenderGame) {
      if (!setNow(ctx, game) || !planned) return;
      for (const set of planned.sets) if (!set.under) paintSet(ctx, game, set);
    },
    under(game: RenderGame): boolean {
      standing = setNow(ctx, game);
      if (standing && standing.under) drawPicture(ctx, standing.under, standing.rect);
      return !!standing;
    },
    over(): boolean {
      if (standing && standing.over) drawPicture(ctx, standing.over, standing.rect);
      return !!standing;
    },
  };
}

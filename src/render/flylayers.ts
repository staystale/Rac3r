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
// buffer's px a metre at its top zoom (fewer past PICTURE_MAX_PX or SETS_BUDGET_MB: softer),
// kept as image bitmaps: shrunk (smoothed) by up to SET_STEP while zoomed out, 1:1
// where the next set (or the live drawing) takes over, so a hand-over shows the same picture.
// The marks and the pulsing joker arrows stay live (over the picture); the cars, the effects,
// the night and the weather are drawn as before. Only while the field is held at the lights
// (nothing can move a cone or a prop), never on the endless road (its traffic moves under the
// fly-in); a frame whose view leaves its set's pictures is drawn live. Every set is painted at
// once, behind the loading screen (without it, on the fly-in's first frame); a set is let go once
// the fly-in has zoomed past it.
import { LEVEL } from '../world/state.ts';
import { trackCanvas } from '../core/memorybudget.ts';
import { FIX } from '../core/fixes.ts';
import { flyViewAt } from './camera.ts';
import type { Cam, CamCar, CamState, Fly, RenderGame, View } from './types.ts';

// the zoom from which the props and loose objects are drawn live. MEASURED (_flycost, Spa, CPU
// x1, the second PC): live, the frame's drawing took 48 ms at zoom 0.04, 25 at 0.07, 9-15 at
// 0.10-0.11, 5 from 0.16
const LIVE_FROM = 0.1;
// a set's top zoom over its bottom one: a picture is shrunk by this much at most. Point-sampled,
// 2.5 times shrunk lost what the live drawing keeps at a pixel or less (the barriers' lines went
// dotted, the cones went); smoothed, 2.5 blurred the trees. Smoothed at 1.25 at most, it keeps them
const SET_STEP = 1.25;
// px: the longest side a picture may have (a bigger one is painted at fewer px a metre, softer).
// iOS WebKit refuses a canvas over 4096 px a side or ~16.7 Mpx
const PICTURE_MAX_PX = 2048;
// MB all of a fly-in's pictures may take together (past it every set is painted at fewer px a
// metre). iOS WebKit also caps all canvases together, shared with the game's ~115 MB: on the
// owner's iPhone the sets were never drawn (the frames' JS as with the switch off)
const SETS_BUDGET_MB = 24;
const BYTES_MB = 1048576;
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
  pxPerMetre: number;   // its pictures' px a metre (at most the art buffer's at zoomTo)
  under: ImageBitmap | null;
  over: ImageBitmap | null;
}

// the fly-in the sets were planned for, and the sets
let planned: { fly: Fly; sets: PictureSet[] } | null = null;
// the set standing in this frame (under() decides, over() follows)
let standing: PictureSet | null = null;

/** What the sets did (?report=1 posts it, tools read renderer.flyStats): no silent fallback. */
export const FLY_STATS = {
  sets: 0,          // the sets the last fly-in planned
  setsMb: 0,        // MB its pictures took
  pictured: 0,      // fly-in frames drawn from a set (counted since the page opened)
  live: 0,          // frames of a fly-in below LIVE_FROM drawn live all the same (the field not
  //                   held, the view off its set, a picture not ready or refused, no set)
  liveWhy: '',      // why the last of those was drawn live
  failed: '',       // why the last fly-in made no set, or ''
};

// why setNow found no set this frame
let whyLive = '';

/**
 * Whether the field is still: the start armed and the lights not yet green (every car held), or
 * the race held by the loading screen's fly-in (a solo practice has no lights).
 * @param game the game
 * @returns true while nothing can move a prop or a loose object
 */
function isFieldStill(game: RenderGame): boolean {
  return (!!game.start && game.start.on && !game.start.green) || !!game.raceHeld;
}

/**
 * A picture's size in px.
 * @param rect the world rectangle [x0, y0, x1, y1], m
 * @param pxPerMetre its px a metre
 * @returns [width, height]
 */
const pictureSize = (rect: number[], pxPerMetre: number) => [
  Math.max(1, Math.round((rect[2] - rect[0]) * pxPerMetre)),
  Math.max(1, Math.round((rect[3] - rect[1]) * pxPerMetre)),
];

/**
 * Paints layers into the scratch canvas (resized and cleared) covering a rectangle at a px a
 * metre (the view pointed at it, then put back).
 * @param ctx the painters
 * @param scratch the canvas and its context
 * @param rect the world rectangle [x0, y0, x1, y1], m
 * @param pxPerMetre the picture's px a metre
 * @param paint draws the layers
 */
function paintPicture(ctx: FlyLayersCtx, scratch: { canvas: HTMLCanvasElement;
  c2d: CanvasRenderingContext2D }, rect: number[], pxPerMetre: number, paint: () => void) {
  const { view, cam } = ctx;
  const [left, top, right, bottom] = rect;
  const { canvas } = scratch;
  [canvas.width, canvas.height] = pictureSize(rect, pxPerMetre);
  const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, dpr: view.dpr,
    x: cam.x, y: cam.y };
  view.ctx = scratch.c2d;
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
  for (let zoomFrom = fly.z0; zoomFrom < liveFrom; zoomFrom *= SET_STEP) {
    const zoomTo = Math.min(liveFrom, zoomFrom * SET_STEP);
    const rect = viewsRect(ctx, path, zoomFrom, zoomTo);
    const longest = Math.max(rect[2] - rect[0], rect[3] - rect[1]);
    if (!(longest > 0 && Number.isFinite(longest))) continue;
    const pxPerMetre = Math.min(artPerMetre * zoomTo, PICTURE_MAX_PX / longest);
    sets.push({ zoomFrom, zoomTo, rect, pxPerMetre, under: null, over: null });
  }
  // two pictures a set; all of them within the budget
  const bytes = sets.reduce((sum, set) => {
    const [width, height] = pictureSize(set.rect, set.pxPerMetre);
    return sum + 2 * width * height * 4;
  }, 0);
  const shrink = Math.min(1, Math.sqrt(SETS_BUDGET_MB * BYTES_MB / Math.max(1, bytes)));
  for (const set of sets) set.pxPerMetre *= shrink;
  return sets;
}

/**
 * Paints the sets' pictures one at a time in one scratch canvas, each kept as an image bitmap
 * (a canvas drawn into another is copied again at each draw in WebKit; a bitmap is not), then
 * lets the canvas go: at most one picture's canvas is held. A refused canvas or bitmap is noted
 * in FLY_STATS.failed and its set is drawn live.
 * @param ctx the painters
 * @param game the game
 * @param plan the fly-in's sets
 */
function paintSets(ctx: FlyLayersCtx, game: RenderGame, plan: { sets: PictureSet[] }) {
  const canvas = trackCanvas(document.createElement('canvas'));
  const c2d = canvas.getContext('2d');
  if (!c2d) {
    FLY_STATS.failed = 'the canvas was refused (memory)';
    return;
  }
  const keep = (set: PictureSet, layer: 'under' | 'over') => {
    createImageBitmap(canvas).then((bitmap) => {
      if (planned === plan) set[layer] = trackCanvas(bitmap);
      else bitmap.close();
    }, () => {
      FLY_STATS.failed = 'a picture was refused (memory)';
    });
  };
  for (const set of plan.sets) {
    paintPicture(ctx, { canvas, c2d }, set.rect, set.pxPerMetre, () => paintUnder(ctx, game));
    keep(set, 'under');
    paintPicture(ctx, { canvas, c2d }, set.rect, set.pxPerMetre, () => paintOver(ctx));
    keep(set, 'over');
  }
  canvas.width = canvas.height = 0;
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
 * still, not the endless road, the view inside the set. Planned and painted the first time asked
 * for a fly-in; a set is let go once the zoom has passed it.
 * @param ctx the painters
 * @param game the game
 * @returns the set, or null to draw live
 */
function setNow(ctx: FlyLayersCtx, game: RenderGame): PictureSet | null {
  const fly = ctx.camState.fly;
  if (!fly) {
    if (planned) planned.sets.forEach(dropSet);
    planned = null;
    return null;
  }
  if (LEVEL.endless) return null;
  if (!isFieldStill(game)) {
    whyLive = 'the field not held';
    return null;
  }
  if (!planned || planned.fly !== fly) {
    planned = { fly, sets: planSets(ctx, fly, game.car) };
    noteSets(planned.sets);
    paintSets(ctx, game, planned);
  }
  const zoom = ctx.view.zoom;
  for (const set of planned.sets) {
    if (zoom >= set.zoomTo) dropSet(set);
  }
  const set = planned.sets.find((each) => zoom < each.zoomTo);
  if (!set) whyLive = 'no set';
  else if (!set.under || !set.over) whyLive = 'a picture not ready or refused';
  else if (!isViewInside(ctx, set)) whyLive = 'the view off its set';
  else return set;
  return null;
}

/**
 * Notes a fly-in's sets in FLY_STATS: how many, their MB, or why there are none.
 * @param sets the sets, painted
 */
function noteSets(sets: PictureSet[]) {
  const bytes = sets.reduce((sum, set) => {
    const [width, height] = pictureSize(set.rect, set.pxPerMetre);
    return sum + 2 * width * height * 4;
  }, 0);
  FLY_STATS.sets = sets.length;
  FLY_STATS.setsMb = Math.round((bytes / BYTES_MB) * 10) / 10;
  FLY_STATS.failed = sets.length ? '' : 'no set could be made';
}

/**
 * Lets a set's pictures go.
 * @param set the set
 */
function dropSet(set: PictureSet) {
  if (set.under) set.under.close();
  if (set.over) set.over.close();
  set.under = set.over = null;
}

/**
 * Draws a picture over its world rectangle, smoothed (it is shrunk by up to SET_STEP).
 * @param ctx the painters
 * @param picture the canvas
 * @param rect its world rectangle
 */
function drawPicture(ctx: FlyLayersCtx, picture: ImageBitmap, rect: number[]) {
  const { toScreenX, toScreenY, PPMz } = ctx;
  const target = ctx.view.ctx;
  target.imageSmoothingEnabled = true;
  target.drawImage(picture, toScreenX(rect[0]), toScreenY(rect[1]),
    (rect[2] - rect[0]) * PPMz(), (rect[3] - rect[1]) * PPMz());
  // (the art buffer draws point-sampled: render.ts resizeRenderer)
  target.imageSmoothingEnabled = false;
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
 * @returns ready (plan and paint the sets: behind the loading screen), under (the picture of
 * the layers under the cars drawn in the art buffer: true when it stood in for them) and over
 * (the same over them)
 */
export function createFlyLayers(ctx: FlyLayersCtx): FlyLayers {
  if (!FIX.smoothfly) return NO_FLY_LAYERS;
  return {
    ready(game: RenderGame) {
      setNow(ctx, game);
    },
    under(game: RenderGame): boolean {
      standing = setNow(ctx, game);
      if (standing) FLY_STATS.pictured++;
      else if (ctx.camState.fly && !LEVEL.endless
        && ctx.view.zoom < Math.min(ctx.FLY_HANDOVER, LIVE_FROM)) {
        FLY_STATS.live++;
        FLY_STATS.liveWhy = whyLive;
      }
      if (standing && standing.under) drawPicture(ctx, standing.under, standing.rect);
      return !!standing;
    },
    over(): boolean {
      if (standing && standing.over) drawPicture(ctx, standing.over, standing.rect);
      return !!standing;
    },
  };
}

// render.ts — camera, floor, cones, and the cars as PROCEDURAL ART.
//
// A1/A2: device resolution, DPR capped at 2, PPM = 16 CSS px per metre. No low-res pixel buffer —
// the brief's retro pixel art was retired in favour of "cute, realistic, detailed and clear"
// (user, 2026-09-27). Cars are drawn, not blitted: one function per silhouette, scaled in metres,
// so the same code is crisp on a 390 px phone and a desktop and there is no asset pipeline to
// keep in sync.
//
// Readability rules applied (CLAUDE.md §4): every car carries a DARK RIM so it never dissolves into
// the pale floor, the front end is unmistakable (lights + screen rake + steered wheels), and the
// thing the player must read at a glance — which way the front wheels point — is drawn at full
// contrast.
import { hash2d } from "./core/random.ts";
import type { Settings } from "./core/settings.ts";

import { FENCE } from "./world/bounds.ts";
import { CONES } from "./world/state.ts";
import { COL } from "./world/colours.ts";
import { visualSlopeAt } from "./world/terrain.ts";
import { MARK_PPM } from './marks.js';
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
import type { Cam, CamCar, RenderGame, TileBudget, View } from "./render/types.ts";

// A2 REVISED after photographing it, 2026-09-27. A flat PPM of 16 put a 4 m car at 64 px on a
// 1280 px desktop — a small orange blob with every drawn detail (mirrors, shut lines, lights,
// steered wheels) too small to see, which defeats the whole point of "detailed and clear". PPM is
// now derived from the SHORT side of the viewport, so the car is a consistent fraction of the
// screen everywhere:
//   390 px phone -> 23 px/m (car 92 px)     1280x720 desktop -> 26 px/m (car 104 px)
// Sizing off min(W,H) is the CLAUDE.md §3 rule for anything that must survive both
// orientations.
export const PPM_MIN = 18, PPM_MAX = 26, PPM_DIV = 17;
export const ZOOM_MIN = 0.30;   // how far out the camera pulls at high speed
const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
export const LOOKAHEAD = 2.6;   // seconds of road kept in view at any speed
export const MAX_DPR = 2;

// =============================================================================================
// PIXEL-ART MODE — the only renderer (approved 2026-10-03). Began as a ?pixel=1 mock-up (user,
// 2026-10-03: "everything pixel art, realistic-ish but in a pixel style", car ~70 px long like the
// reference sprites in art/reference/). The WORLD is drawn into a low-resolution buffer — one art
// pixel = PIXEL_CSS css px (an integer number of device pixels) — and blitted to the screen with
// smoothing OFF, so every edge is a hard pixel step. The HUD is drawn afterwards at full resolution
// so buttons and numbers stay crisp. Cars are generated PIXEL SPRITES (pixelCar). Everything else
// is the existing renderer, drawn small — the mock-up shows how far that alone gets. css px per art
// pixel: a 4 m car is ~70 art px at zoom 1 on a phone
const PIXEL_CSS = 1.3;

export function createRenderer(canvas: HTMLCanvasElement, settings: Settings) {
  const NO_LOCK = settings.noLock;
  // ?skip=<layers>: phone judder bisect. Safari records canvas commands and paints them
  // later, outside our timing, so the meter cannot show painting cost; skipping layers can.
  const SKIP = settings.skipLayers;
  const skip = (name: string) =>
    SKIP.has(name) || (SKIP.has('world') && name !== 'ground' && name !== 'car');
  // \`let\`, not const: the ground cache (below) points every draw function at an off-screen
  // canvas by swapping this for the duration of one render. Nothing else ever reassigns it.
  const mainCtx = canvas.getContext('2d')!;   // a fresh canvas always gives a 2d context
  // the 7 most shared drawing variables in one object (phase 4 of the render.js split): zoom is
  // the smoothed speed zoom (see SPEED ZOOM below), noPatterns is set while painting the fly-in
  // overview (flat colours only)
  const view: View = { ctx: mainCtx, W: 0, H: 0, dpr: 1, PPM: 22, zoom: 1, noPatterns: false };
  // pixel mode: the world buffer, its device-px block size (blockPx), and the real dpr of the
  // screen canvas
  const pcanvas = document.createElement('canvas');
  const pctx = pcanvas.getContext('2d')!;   // likewise
  let blockPx = 1, realDpr = 1;
  const cam: Cam = { x: 0, y: 0, initialised: false };
  // ONE place converts metres to pixels, so nothing can miss the zoom
  const PPMz = () => view.PPM * view.zoom;

  function resize() {
    realDpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    view.dpr = realDpr;
    view.W = canvas.clientWidth;
    view.H = canvas.clientHeight;
    canvas.width = Math.round(view.W * realDpr);
    canvas.height = Math.round(view.H * realDpr);
    mainCtx.setTransform(realDpr, 0, 0, realDpr, 0, 0);   // draw in CSS px everywhere below
    // an art pixel is a whole number of device pixels, so the upscale never smears
    blockPx = Math.max(2, Math.round(PIXEL_CSS * realDpr));
    pcanvas.width = Math.ceil(canvas.width / blockPx);
    pcanvas.height = Math.ceil(canvas.height / blockPx);
    // the EFFECTIVE dpr every world draw (and every tile) uses
    view.dpr = pcanvas.width / view.W;
    pctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    pctx.imageSmoothingEnabled = false;
    view.ctx = pctx;
    view.PPM = Math.max(PPM_MIN, Math.min(PPM_MAX, Math.min(view.W, view.H) / PPM_DIV));
  }

  const toScreenX = (worldX: number) => (worldX - cam.x) * PPMz() + view.W / 2;
  const toScreenY = (worldY: number) => (worldY - cam.y) * PPMz() + view.H / 2;

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

  // createGround and createRoad need each other (forSide / paintLayers, artBase): the wrapper
  // below is only called at draw time, after createRoad has returned forSide
  const {
    drawFloor, SURFACE_ART, paintLayers, artBase, drawZones, PUDDLE_TINT, drawPatches,
    drawCovers, drawWear, drawBumps, drawRunoff,
  } = createGround(view, cam, { PPMz, toScreenX, toScreenY, roundRect,
    forSide: (...args) => forSide(...args),
    grassEnds: settings.grassEnds, surfaceTextures: settings.surfaceTextures });
  const {
    drawLanes, drawTrackRibbon, drawLaneDashes, drawCurvedKerbs, drawPaint, forSide,
    drawKerb, drawSlip, drawMarks, drawArrows,
  } = createRoad(view, cam, { PPMz, toScreenX, toScreenY, paintLayers, artBase });
  const {
    chips, MAX_CHIPS, addPuffs, addSpray, addSmoke, addDamageSmoke,
    addChips, addSparks, drawChips, drawPuffs,
  } = createParticles(view, cam, { PPMz, toScreenX, toScreenY });
  const { pixelCar } = createCarSprite();
  const { damagedSprite, silhouette, faceCache, rolledFaces, drawFaces } = createCarDamage(view);
  const { drawPixelCar, pixelCarWithWheels } = createCars(view, cam, {
    PPMz, toScreenX, toScreenY, pixelCar, damagedSprite, silhouette, rolledFaces, drawFaces,
      faceCache,
  });
  const { drawFence, drawBarriers, drawProps } = createProps(view, cam, {
    PPMz, toScreenX, toScreenY, roundRect, forSide, drawSlip,
  });
  const { drawCones, drawTape } = createObjects(view, cam, {
    PPMz, toScreenX, toScreenY, roundRect, chips, MAX_CHIPS,
  });

  // createCamera needs paletteSnap / prefetch from the tiles (which need the camera): the wrappers
  // are only called at draw time, after createTiles has returned
  const {
    camState, follow, updateFly, updateZoom, flyIn, thumbnail, levelOverview, FLY_HANDOVER,
    FLY_PREFETCH,
  } = createCamera(view, cam, {
    PPMz, drawFloor, drawZones, drawLanes, drawTrackRibbon, drawPatches, drawCovers,
    drawCurvedKerbs, paletteSnap: (target: HTMLCanvasElement) => paletteSnap(target),
    prefetch: (...args: [number, number, number, number, TileBudget]) => prefetch(...args),
  });
  const {
    tileState, tiles, TILE_PX, ZSTEP, zStepOf, zOfStep, paletteSnap, paintTile, startTile,
    stepTile, finishTile, drawGround,
    prefetch,
  } = createTiles(view, cam, settings, {
    PPMz, toScreenX, toScreenY, drawFloor, drawZones, drawLanes, drawTrackRibbon, drawLaneDashes,
      drawPatches,
    drawCovers, drawWear, drawCurvedKerbs, SURFACE_ART, PUDDLE_TINT,
    getFly: () => camState.fly, FLY_HANDOVER, FLY_PREFETCH, levelOverview, artBase,
  });


  // ---------------------------------------------------------------- frame
  function frame(game: RenderGame, wallDt: number, wallT: number) {
    if (!updateFly(game.car, wallDt)) {
      follow(game.car, wallDt);
      updateZoom(game.car, wallDt);
    }
    // PIXEL-LOCKED VIEW (user, 2026-10-04: "tracks seem to quiver and shake at speed"). MEASURED
    // (tools/shimmercheck, Brands GP at speed): every ground tile was blitted at a FRACTIONAL
    // art-pixel position (500/500 frames) and tiles of one frame at MIXED widths (317/500) —
    // each edge was rounded separately, in CSS px not art px — so the pixel-art ground was
    // resampled differently every frame: a shimmer.
    // For drawing only: the zoom is quantised so a tile of the current step is a WHOLE number of
    // art pixels wide (steps of ~0.5 %, invisible), and the camera snapped to a whole art pixel.
    // The smoothed zoom is restored at the end of the frame.
    const keepZoom = view.zoom;
    let subX = 0, subY = 0, camTrue: { x: number; y: number } | null = null;
    if (!NO_LOCK && (!camState.fly || view.zoom >= FLY_HANDOVER)) {
      const step = (tileState.lastStep !== null
        && Math.abs(ZSTEP * Math.log2(view.zoom) - tileState.lastStep) < 0.75)
        ? tileState.lastStep : zStepOf(view.zoom);
      const stepZoom = zOfStep(step),
        tileArt = Math.max(1, Math.round(TILE_PX * view.dpr * view.zoom / stepZoom));
      view.zoom = tileArt * stepZoom / (TILE_PX * view.dpr);
      tileState.drawnN = tileArt;
      const devPPM = view.PPM * view.zoom * view.dpr,
        halfW = (view.W * view.dpr) / 2,
        halfH = (view.H * view.dpr) / 2;
      // SUB-PIXEL BLIT (user, 2026-10-04, after the lock: "it is still shaking or wiggling as I
      // drive"). MEASURED (tools/wobblecheck): snapping the camera to whole art pixels made the
      // world move in uneven 1-or-2-art-pixel steps — camera jerk median 1.46 px per frame, max
      // 8.8 (unlocked: 0.03). Now the world is DRAWN at the snapped camera (crisp, no shimmer) and
      // the finished art-pixel image is shifted on screen by the leftover fraction, in device
      // pixels — so motion is as smooth as before the lock.
      const trueX = cam.x, trueY = cam.y;
      cam.x = (Math.round(cam.x * devPPM - halfW) + halfW) / devPPM;
      cam.y = (Math.round(cam.y * devPPM - halfH) + halfH) / devPPM;
      subX = -(trueX - cam.x) * devPPM * blockPx;
      subY = -(trueY - cam.y) * devPPM * blockPx;
      camTrue = { x: trueX, y: trueY };
    } else {
      subX = 0;
      subY = 0;
      camTrue = null;
    }
    // ORDER MATTERS. Everything that IS the ground goes down first, then the marks layer over all
    // of it, then the fence — which is a vertical object and belongs on top of everything on the
    // deck. MEASURED BUG, 2026-09-28: the run-off was filled AFTER the marks blit, so gravel tracks
    // were painted and then immediately buried under the gravel (user: "we should leave little
    // tracks in the gravel trap"). Check what a thing is drawn OVER — CLAUDE.md §4. ground = floor
    // + zones + ribbon + covers + WEAR, from the tile cache above
    if (!skip('ground')) drawGround(wallDt, game.car);
    if (!skip('deck')) {
      drawRunoff();
      drawKerb();
      drawBumps();
      drawPaint();
      drawArrows(game, wallT);
    }
    if (!skip('marks')) drawMarks(game.marks);
    if (!skip('fence')) drawFence();
    if (!skip('barriers')) drawBarriers();
    if (!skip('props')) drawProps();
    if (!skip('cones')) {
      drawCones(game.cones.list);
      drawTape(game);
    }
    addPuffs(game.cones.drainHits());
    addSpray(game.car, game.marks, wallDt);
    addSmoke(game.car, game.marks, wallDt);
    for (const car of [
      game.car,
      ...(game.ai || []).map((rival) => rival.car),
      ...(game.traffic
        ? game.traffic.cars.filter((vehicle) => vehicle.dmg
          && Math.abs(vehicle.x - game.car.x) < 90 && Math.abs(vehicle.y - game.car.y) < 90)
        : []),
    ]) {
      addDamageSmoke(car, wallDt);
      addChips(car);
      addSparks(car, wallDt);
    }
    if (!skip('fx')) drawPuffs(wallDt);
    // chips: paint chips on the ground, under the cars (dust over the bonnet reads as a fault)
    if (!skip('fx')) drawChips(wallDt);
    // HIGHWAY TRAFFIC (traffic.js), only the ones near the view (they are spread over ~800 m),
    // under the AI and the player
    if (game.traffic && !skip('traffic')) {
      const margin = 12 * PPMz();
      for (const car of game.traffic.cars) {
        const screenX = toScreenX(car.x), screenY = toScreenY(car.y);
        if (screenX < -margin || screenX > view.W + margin
          || screenY < -margin || screenY > view.H + margin) continue;
        drawPixelCar(car);
      }
    }
    // AI cars under the player's
    if (!skip('ai')) for (const rival of game.ai || []) { drawPixelCar(rival.car); }
    if (!skip('car')) drawPixelCar(game.car);
    // overhead structures (gantry) pass OVER the cars
    if (!skip('props')) drawProps(true);
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(pcanvas, subX, subY, pcanvas.width * blockPx, pcanvas.height * blockPx);
    mainCtx.restore();
    view.zoom = keepZoom;
    if (camTrue) {
      // the true camera for the next frame / tools
      cam.x = camTrue.x;
      cam.y = camTrue.y;
    }
  }

  function snap(car: CamCar) {
    cam.x = car.x;
    cam.y = car.y;
    // the look-ahead restarts from the car (follow() eases it back in)
    cam.lx = 0;
    cam.ly = 0;
    cam.initialised = true;
  }

  return {
    // the HUD draws on the full-resolution screen, even in pixel mode
    get ctx() { return mainCtx; },
    get W() { return view.W; },
    get H() { return view.H; },
    get dpr() { return view.dpr; },
    cam, resize, frame, snap, toScreenX, toScreenY, roundRect, flyIn, thumbnail,
    get flying() { return !!camState.fly; },
    get PPM() { return view.PPM * view.zoom; },
    get groundRenders() { return tileState.tilesPainted; },
    get tileMs() { return tileState.tileMs; },
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
    pixelCarWithWheels,                 // for the garage
    // for tools/visualcheck.mjs (user rule, 2026-10-03: "surface visuals should be accurate to
    // their effects"): the level painted FLAT (each surface its base colour, no patterns, no
    // palette snap) at ppm px per metre, plus the colour each surface id is painted in, so the
    // tool can compare every drawn pixel with groundAt().
    // for the photo tools (tools/_sceneryshots.mjs): pin the camera zoom (null = back to
    // speed-driven)
    debugZoom(zoom: number | null) {
      camState.pinZoom = zoom;
      if (zoom) view.zoom = zoom;
    },
    debugFlat(minX: number, minY: number, maxX: number, maxY: number, ppm: number) {
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
      // the same ground layers frame() draws: the cached tiles' contents, then the live edge
      // (run-off + edge kerb)
      try {
        drawFloor();
        drawZones();
        drawLanes();
        drawTrackRibbon();
        drawPatches();
        drawCovers();
        drawCurvedKerbs();
        drawRunoff();
        drawKerb();
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
    },
    debugColours() {
      const base: Record<string, string> = {};
      for (const [surfaceId, art] of Object.entries(SURFACE_ART))
        if (art) base[surfaceId] = art.base;
      return { base, puddle: { ...PUDDLE_TINT }, col: { ...COL } };
    },
    get tileCount() { return tiles.size; },
    // for tools/tilediff.mjs: ground tile (zoom step k, column i, row j) painted fresh -> its
    // pixels (not cached) for tools/tilestrips.mjs: the same tile painted strip by strip, each
    // stepTile timed
    debugTileStrips(step: number, col: number, row: number, strips: number) {
      const job = startTile(step, col, row), stripMs: number[] = [];
      job.strips = strips;
      for (let done = false; !done;) {
        const began = performance.now();
        done = stepTile(job);
        stripMs.push(performance.now() - began);
      }
      const tile = finishTile(job), size = tile.width;
      const data = tile.getContext('2d')!.getImageData(0, 0, size, size).data;
      return { w: size, h: size, stripMs, data: Array.from(data) };
    },
    debugTile(step: number, i: number, j: number) {
      const tile = paintTile(step, i, j);
      return {
        w: tile.width, h: tile.height,
        data: Array.from(tile.getContext('2d')!.getImageData(0, 0, tile.width, tile.height).data),
      };
    },
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

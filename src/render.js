// render.js — camera, floor, cones, and the cars as PROCEDURAL ART.
//
// A1/A2: device resolution, DPR capped at 2, PPM = 16 CSS px per metre. No low-res pixel buffer — the
// brief's retro pixel art was retired in favour of "cute, realistic, detailed and clear" (user,
// 2026-09-27). Cars are drawn, not blitted: one function per silhouette, scaled in metres, so the same
// code is crisp on a 390 px phone and a desktop and there is no asset pipeline to keep in sync.
//
// Readability rules applied (CLAUDE.md §4): every car carries a DARK RIM so it never dissolves into the
// pale floor, the front end is unmistakable (lights + screen rake + steered wheels), and the thing the
// player must read at a glance — which way the front wheels point — is drawn at full contrast.
import { hash2d } from "./core/random.ts";

import "./world/load.ts";   // the world is set up before this file runs (as importing lab.js did)
import { FX0, FX1, FY0, FY1, FENCE } from "./world/bounds.ts";
import { CONES, LEVEL } from "./world/state.ts";
import { COL } from "./world/colours.ts";
import { visualSlopeAt } from "./world/terrain.ts";
import { MARK_PPM } from './marks.js';
import { createCarSprite } from "./render/carsprite.js";
import { createCarDamage } from "./render/cardamage.js";
import { createCars } from "./render/cars.js";
import { createParticles } from "./render/particles.js";
import { createRoad } from "./render/road.js";
import { createGround } from "./render/ground.js";
import { createProps } from "./render/props.js";
import { createObjects } from "./render/objects.js";
import { createTiles } from "./render/tiles.js";

// A2 REVISED after photographing it, 2026-09-27. A flat PPM of 16 put a 4 m car at 64 px on a 1280 px
// desktop — a small orange blob with every drawn detail (mirrors, shut lines, lights, steered wheels)
// too small to see, which defeats the whole point of "detailed and clear". PPM is now derived from the
// SHORT side of the viewport, so the car is a consistent fraction of the screen everywhere:
//   390 px phone -> 23 px/m (car 92 px)     1280x720 desktop -> 26 px/m (car 104 px)
// Sizing off min(W,H) is the CLAUDE.md §3 rule for anything that must survive both orientations.
export const PPM_MIN = 18, PPM_MAX = 26, PPM_DIV = 17;
export const ZOOM_MIN = 0.30;   // how far out the camera pulls at high speed
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const LOOKAHEAD = 2.6;   // seconds of road kept in view at any speed
export const MAX_DPR = 2;

// =============================================================================================
// PIXEL-ART MODE — the only renderer (approved 2026-10-03). Began as a ?pixel=1 mock-up (user, 2026-10-03:
// "everything pixel art, realistic-ish but in a pixel style", car ~70 px long like the reference sprites in
// art/reference/).
// The WORLD is drawn into a low-resolution buffer — one art pixel = PIXEL_CSS css px (an integer number of device
// pixels) — and blitted to the screen with smoothing OFF, so every edge is a hard pixel step. The HUD is drawn
// afterwards at full resolution so buttons and numbers stay crisp. Cars are generated PIXEL SPRITES (pixelCar).
// Everything else is the existing renderer, drawn small — the mock-up shows how far that alone gets.
// ?nolock=1 turns the pixel-locked view off (A/B for tools/wobblecheck)
const NO_LOCK = typeof location !== "undefined" && new URLSearchParams(location.search).has("nolock");
const PIXEL_CSS = 1.3;            // css px per art pixel: a 4 m car is ~70 art px at zoom 1 on a phone

export function createRenderer(canvas) {
  // \`let\`, not const: the ground cache (below) points every draw function at an off-screen canvas by
  // swapping this for the duration of one render. Nothing else ever reassigns it.
  const mainCtx = canvas.getContext('2d');
  // the 7 most shared drawing variables in one object (phase 4 of the render.js split): zoom is the
  // smoothed speed zoom (see SPEED ZOOM below), noPatterns is set while painting the fly-in overview
  // (flat colours only)
  const view = { ctx: mainCtx, W: 0, H: 0, dpr: 1, PPM: 22, zoom: 1, noPatterns: false };
  // pixel mode: the world buffer, its device-px block size (k), and the real dpr of the screen canvas
  const pcanvas = document.createElement('canvas');
  const pctx = pcanvas.getContext('2d');
  let pk = 1, realDpr = 1;
  const cam = { x: 0, y: 0, initialised: false };
  const PPMz = () => view.PPM * view.zoom;   // ONE place converts metres to pixels, so nothing can miss the zoom

  function resize() {
    realDpr = Math.min(MAX_DPR, devicePixelRatio || 1);
    view.dpr = realDpr;
    view.W = canvas.clientWidth; view.H = canvas.clientHeight;
    canvas.width = Math.round(view.W * realDpr);
    canvas.height = Math.round(view.H * realDpr);
    mainCtx.setTransform(realDpr, 0, 0, realDpr, 0, 0);   // draw in CSS px everywhere below
    // an art pixel is a whole number of device pixels, so the upscale never smears
    pk = Math.max(2, Math.round(PIXEL_CSS * realDpr));
    pcanvas.width = Math.ceil(canvas.width / pk); pcanvas.height = Math.ceil(canvas.height / pk);
    view.dpr = pcanvas.width / view.W;                       // the EFFECTIVE dpr every world draw (and every tile) uses
    pctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    pctx.imageSmoothingEnabled = false;
    view.ctx = pctx;
    view.PPM = Math.max(PPM_MIN, Math.min(PPM_MAX, Math.min(view.W, view.H) / PPM_DIV));
  }

  // camera follows with a lead in the direction of travel, smoothed on the WALL CLOCK (rule 5 — this
  // is something the player watches, so it must not run on sim time)
  function follow(car, wallDt) {
    // Lead scaled by the zoom: at 50 m/s a flat 0.35 s lead is 18 m, which on a zoomed-in view shoves
    // the car to the edge of the screen. Zoomed out there is room for it, zoomed in there is not.
    const lead = 0.35 * view.zoom;
    // LOCKED TO THE CAR, ONLY THE LEAD IS SMOOTHED (user, 2026-10-03: "camera / car tracking still seems jittery"). The
    // camera used to chase car + lead with an exponential lerp. MEASURED: with uneven frame times the lerp's lag changes
    // by ~v*dt/2 — half a metre at 200 km/h — so the car twitched against the camera even after the render
    // interpolation made the car itself smooth. Now the camera sits RIGIDLY on the (interpolated) car and only the
    // look-ahead offset eases, so the car holds still on screen and the view only drifts as speed / direction change.
    let lx = car.vx * lead, ly = car.vy * lead;
    // THE TREADMILL (endless highway, user 2026-10-05: "it can never drive off the screen"): the camera stays rigid on the car (as
    // everywhere) but the lead points UP THE ROAD (highway.js camDir, the next ~60 m), not along the velocity, and is a share of the
    // view: the car sits ~3/4 down the screen with the road ahead above it. Capped sideways so a 60 deg bend cannot push the car off
    // the side of a narrow portrait screen.
    const hwy = LEVEL.endless && LEVEL._hw;
    if (hwy && hwy.camDir) { const P = PPMz(), A = 0.26 * view.H / P, cx = 0.2 * view.W / P;
      lx = Math.max(-cx, Math.min(cx, hwy.camDir.x * A)); ly = hwy.camDir.y * A; }
    if (!cam.initialised) { cam.lx = lx; cam.ly = ly; cam.initialised = true; }
    if (cam.lx === undefined) { cam.lx = cam.x - car.x; cam.ly = cam.y - car.y; }   // hand-over from the fly-in
    const k = 1 - Math.exp(-4 * wallDt);
    cam.lx += (lx - cam.lx) * k; cam.ly += (ly - cam.ly) * k;
    cam.x = car.x + cam.lx; cam.y = car.y + cam.ly;
  }

  // SPEED ZOOM. Asked for by the user and by the playtesters: above ~120 km/h the car was running off
  // the screen because the view showed a fixed number of metres however fast you were going. Zoom out
  // with speed so the distance you can SEE scales with the distance you cover. Smoothed on the WALL
  // CLOCK (rule 5) — a zoom is something the player watches, and an unsmoothed one pumps on every
  // gearchange.
  // LEVEL FLY-IN (playtesters, re-asked by the user 2026-10-03 after DeepSeek's version was reverted): every
  // level start opens on the WHOLE level, then eases in to the car over FLY_TIME, so you see what is around
  // before you drive. Wall clock (rule 5: the player watches it). The player can drive during it.
  const FLY_HOLD = 0.45;          // s held on the whole-level view before moving
  const FLY_TIME = 1.5;           // s of the move itself (ease-in-out, in log zoom)
  // the camera state other layers read: fly (the fly-in, or null), ovCache (the overview picture), vZoom
  // (the slow-averaged speed), pinZoom (tools only: debugZoom - the photo tools pin the wide view)
  const camState = { fly: null, ovCache: null, vZoom: null, pinZoom: null };
  // the level's extent: the circuit plus a margin, or the whole floor (shared by the fly-in and the menu thumbnails)
  function levelBounds() {
    let x0 = FX0, x1 = FX1, y0 = FY0, y1 = FY1;   // the floor rectangle (S-B: the lab is 520 x 1000)
    if (LEVEL.subtrack) {
      x0 = y0 = Infinity; x1 = y1 = -Infinity;
      for (const p of LEVEL.subtrack.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      const m = LEVEL.subtrack.width + 12; x0 -= m; x1 += m; y0 -= m; y1 += m;
    }
    return [x0, y0, x1, y1];
  }
  // the whole level painted flat once (the fly-in's picture), kept per level: the stand-in while new ground tiles are painted
  // THE ENDLESS ROAD MOVES ON (2026-10-06, highway judder; tools/hwjudder.mjs "bare ground"): the overview was painted once over the FIRST
  // road window, so after ~1 km every stand-in frame showed dark "nothing" squares where the new ground was still to come (71 of 997
  // frames at CPU x4). On an endless level it is repainted over the CURRENT window once the road has moved on OV_REPAINT m since
  // (the window reaches 1100 m ahead, so the view never outruns it; 512 px — it only stands in for a frame or two). Off the road
  // the stand-in is the base colour (standInFill), so a view wider than the overview shows grass, not a hole.
  const OV_REPAINT = 500;
  const roadS0 = () => (LEVEL.endless && LEVEL._hw && LEVEL._hw.pts.length ? LEVEL._hw.pts[0].s : 0);
  function levelOverview() {
    const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;
    if (camState.ovCache && camState.ovCache.level === LEVEL && camState.ovCache.layout === layout && (!LEVEL.endless || Math.abs(roadS0() - camState.ovCache.s0) < OV_REPAINT)) return camState.ovCache.ov;
    if (!(view.W > 0)) return null;
    const [x0, y0, x1, y1] = levelBounds();
    camState.ovCache = { level: LEVEL, layout, s0: roadS0(), ov: paintOverview(x0, y0, x1, y1, LEVEL.endless ? 512 : 1024) };
    return camState.ovCache.ov;
  }
  // under a stand-in: the level's own ground colour where it has one (a missing patch reads as grass, not as a hole)
  const standInFill = () => (LEVEL.base && LEVEL.base.id !== 'lab' ? artBase(LEVEL.base.id, COL.floor) : COL.outside);
  // MENU THUMBNAIL of the CURRENT level (Test Mode track select): the same flat painter as the fly-in, small.
  function thumbnail(size = 320) { const [x0, y0, x1, y1] = levelBounds(); return paintOverview(x0, y0, x1, y1, size).c; }
  function flyIn() {
    const [x0, y0, x1, y1] = levelBounds();
    const zFit = Math.min(view.W / (view.PPM * (x1 - x0)), view.H / (view.PPM * (y1 - y0)));
    // MEASURED BUG, 2026-10-03: on a ?level= link the level loads BEFORE the canvas is measured (W = 0), so zFit
    // was 0, log(0) = -Infinity, and the zoom went NaN — "createRadialGradient: non-finite" from every prop.
    // Not measured yet = no fly-in; the tap-to-start restart runs it again with a real screen.
    if (!(zFit > 0 && Number.isFinite(zFit))) { camState.fly = null; return; }
    camState.fly = { t: 0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z0: Math.min(1, zFit), ov: paintOverview(x0, y0, x1, y1) };
    cam.x = camState.fly.cx; cam.y = camState.fly.cy; cam.initialised = true; view.zoom = camState.fly.z0;
  }
  // THE FLY-IN DOES NOT USE THE TILES WHILE ZOOMED OUT. MEASURED (user: "zoom in at the start seems to struggle
  // and be glitchy"; photographed mid-flight as a blurred smear): the fly sweeps ~11 tile zoom steps in 1.5 s,
  // each needing a fresh screenful of tiles, so the screen showed over-stretched stand-ins or stalled painting.
  // Instead the whole level is painted ONCE into an overview image (in the hold, when nothing moves), drawn
  // scaled while zoom < FLY_HANDOVER, while the close-up tiles round the car are pre-painted FLY_PREFETCH per
  // frame — so by the hand-over they are already there.
  const FLY_HANDOVER = 0.28, FLY_PREFETCH = 2, OVERVIEW_PX = 2048;
  function paintOverview(x0, y0, x1, y1, size = OVERVIEW_PX) {
    const ow = size, oh = Math.max(1, Math.round(size * (y1 - y0) / (x1 - x0)));
    const c = document.createElement('canvas'); c.width = ow; c.height = oh;
    const g = c.getContext('2d');
    const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
    view.ctx = g; view.W = ow; view.H = oh; view.zoom = ow / (view.PPM * (x1 - x0)); cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2;
    view.noPatterns = true;
    try { drawFloor(); drawZones(); drawLanes(); drawTrackRibbon(); drawPatches(); drawCovers(); drawCurvedKerbs(); }
    finally { view.ctx = keep.ctx; view.W = keep.W; view.H = keep.H; view.zoom = keep.zoom; cam.x = keep.cx; cam.y = keep.cy; view.noPatterns = false; }
    paletteSnap(c);
    return { c, x0, y0, x1, y1 };
  }
  // paint (without drawing) the tiles of step k covering a view centred on (cx, cy) at zoom z
  function prefetch(k, cx, cy, z, budget) {
    const tw = TILE_PX / (view.PPM * zOfStep(k)), p = view.PPM * z;
    const vx0 = cx - view.W / 2 / p, vx1 = cx + view.W / 2 / p, vy0 = cy - view.H / 2 / p, vy1 = cy + view.H / 2 / p;
    for (let i = Math.floor(vx0 / tw); i * tw < vx1 && budget.n > 0; i++)
      for (let j = Math.floor(vy0 / tw); j * tw < vy1 && budget.n > 0; j++) {
        const key = k + '|' + i + '|' + j;
        if (!tiles.has(key)) { budget.n--; tiles.set(key, { c: paintTile(k, i, j), used: tileState.tileFrame }); }
      }
  }
  function updateFly(car, wallDt) {
    if (!camState.fly) return false;
    camState.fly.t += wallDt;
    const k = Math.min(1, Math.max(0, camState.fly.t - FLY_HOLD) / FLY_TIME);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;          // ease-in-out cubic
    const lead = 0.35, tx = car.x + car.vx * lead, ty = car.y + car.vy * lead;
    // the PAN leads the zoom (ease-out), so by the tile hand-over the view is already round the car,
    // where its tiles were pre-painted
    const ep = 1 - Math.pow(1 - k, 3);
    cam.x = camState.fly.cx + (tx - camState.fly.cx) * ep; cam.y = camState.fly.cy + (ty - camState.fly.cy) * ep;
    view.zoom = Math.exp(Math.log(camState.fly.z0) + (Math.log(1) - Math.log(camState.fly.z0)) * e);   // ease in log space: even feel
    if (k >= 1) camState.fly = null;
    cam.lx = undefined;
    return true;
  }
  function updateZoom(car, wallDt) {
    if (camState.pinZoom) { view.zoom = camState.pinZoom; return; }
    // PROPORTIONAL TO SPEED, properly: hold the TIME-to-horizon constant rather than easing along an
    // arbitrary curve. You always see LOOKAHEAD seconds of road, so the distance visible scales
    // directly with how fast you are covering it — which is what "zoom out proportional to speed"
    // actually means for a driver. visible = W / (PPM * zoom) = v * LOOKAHEAD  =>  zoom = W / (PPM*v*T).
    // from a SLOW-AVERAGED speed (time constant ~1.5 s): braking into a corner and powering out no longer breathes the view
    const vNow = Math.hypot(car.vx, car.vy);
    camState.vZoom = camState.vZoom === null ? vNow : camState.vZoom + (vNow - camState.vZoom) * (1 - Math.exp(-0.65 * wallDt));
    const v = camState.vZoom;
    const want = v > 1 ? view.W / (view.PPM * v * LOOKAHEAD) : 1;
    const target = Math.max(ZOOM_MIN, Math.min(1, want));
    // CALMER (2026-10-04, tools/wobblecheck: the zoom moved the screen edge ~1.1 px EVERY frame at speed — the view breathed with every
    // lift and squeeze): 2.5/s -> 0.9/s, and changes under 4 % of the target are ignored (dead band).
    if (Math.abs(target - view.zoom) > 0.04 * target) view.zoom += (target - view.zoom) * (1 - Math.exp(-0.9 * wallDt));
  }

  const sx = (wx) => (wx - cam.x) * PPMz() + view.W / 2;
  const sy = (wy) => (wy - cam.y) * PPMz() + view.H / 2;

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }

  // createGround and createRoad need each other (forSide / paintLayers, artBase): the wrapper below is
  // only called at draw time, after createRoad has returned forSide
  const {
    drawFloor, SURFACE_ART, paintLayers, artBase, drawZones, PUDDLE_TINT, drawPatches,
    drawCovers, drawWear, drawBumps, drawRunoff,
  } = createGround(view, cam, { PPMz, sx, sy, roundRect, forSide: (...a) => forSide(...a) });
  const {
    drawLanes, drawTrackRibbon, drawLaneDashes, drawCurvedKerbs, drawPaint, forSide,
    drawKerb, drawSlip, drawMarks, drawArrows,
  } = createRoad(view, cam, { PPMz, sx, sy, paintLayers, artBase });
  const {
    chips, MAX_CHIPS, addPuffs, addSpray, addSmoke, addDamageSmoke,
    addChips, addSparks, drawChips, drawPuffs,
  } = createParticles(view, cam, { PPMz, sx, sy });
  const { pixelCar } = createCarSprite();
  const { damagedSprite, silhouette, faceCache, rolledFaces, drawFaces } = createCarDamage(view);
  const { drawPixelCar, pixelCarWithWheels } = createCars(view, cam, {
    PPMz, sx, sy, pixelCar, damagedSprite, silhouette, rolledFaces, drawFaces, faceCache,
  });
  const { drawFence, drawBarriers, drawProps } = createProps(view, cam, {
    PPMz, sx, sy, roundRect, forSide, drawSlip,
  });
  const { drawCones, drawTape } = createObjects(view, cam, {
    PPMz, sx, sy, roundRect, chips, MAX_CHIPS,
  });

  const {
    tileState, tiles, TILE_PX, ZSTEP, zStepOf, zOfStep, paletteSnap, paintTile, drawGround,
  } = createTiles(view, cam, {
    PPMz, sx, sy, drawFloor, drawZones, drawLanes, drawTrackRibbon, drawLaneDashes, drawPatches,
    drawCovers, drawWear, drawCurvedKerbs, SURFACE_ART, PUDDLE_TINT,
    getFly: () => camState.fly, FLY_HANDOVER, FLY_PREFETCH, prefetch, standInFill,
    levelOverview,
  });


  // ---------------------------------------------------------------- frame
  function frame(game, wallDt, wallT) {
    if (!updateFly(game.car, wallDt)) {
      follow(game.car, wallDt);
      updateZoom(game.car, wallDt);
    }
    // PIXEL-LOCKED VIEW (user, 2026-10-04: "tracks seem to quiver and shake at speed"). MEASURED (tools/shimmercheck, Brands GP at speed):
    // every ground tile was blitted at a FRACTIONAL art-pixel position (500/500 frames) and tiles of one frame at MIXED widths (317/500) —
    // each edge was rounded separately, in CSS px not art px — so the pixel-art ground was resampled differently every frame: a shimmer.
    // For drawing only: the zoom is quantised so a tile of the current step is a WHOLE number of art pixels wide (steps of ~0.5 %,
    // invisible), and the camera snapped to a whole art pixel. The smoothed zoom is restored at the end of the frame.
    const keepZoom = view.zoom;
    let subX = 0, subY = 0, camTrue = null;
    if (!NO_LOCK && (!camState.fly || view.zoom >= FLY_HANDOVER)) {
      const k = (tileState.lastStep !== null && Math.abs(ZSTEP * Math.log2(view.zoom) - tileState.lastStep) < 0.75) ? tileState.lastStep : zStepOf(view.zoom);
      const zq = zOfStep(k), N = Math.max(1, Math.round(TILE_PX * view.dpr * view.zoom / zq));
      view.zoom = N * zq / (TILE_PX * view.dpr); tileState.drawnN = N;
      const pd = view.PPM * view.zoom * view.dpr, hx = (view.W * view.dpr) / 2, hy = (view.H * view.dpr) / 2;
      // SUB-PIXEL BLIT (user, 2026-10-04, after the lock: "it is still shaking or wiggling as I drive"). MEASURED (tools/wobblecheck):
      // snapping the camera to whole art pixels made the world move in uneven 1-or-2-art-pixel steps — camera jerk median 1.46 px per
      // frame, max 8.8 (unlocked: 0.03). Now the world is DRAWN at the snapped camera (crisp, no shimmer) and the finished art-pixel image
      // is shifted on screen by the leftover fraction, in device pixels — so motion is as smooth as before the lock.
      const tx = cam.x, ty = cam.y;
      cam.x = (Math.round(cam.x * pd - hx) + hx) / pd; cam.y = (Math.round(cam.y * pd - hy) + hy) / pd;
      subX = -(tx - cam.x) * pd * pk; subY = -(ty - cam.y) * pd * pk; camTrue = { x: tx, y: ty };
    } else { subX = 0; subY = 0; camTrue = null; }
    // ORDER MATTERS. Everything that IS the ground goes down first, then the marks layer over all of
    // it, then the fence — which is a vertical object and belongs on top of everything on the deck.
    // MEASURED BUG, 2026-09-28: the run-off was filled AFTER the marks blit, so gravel tracks were
    // painted and then immediately buried under the gravel (user: "we should leave little tracks in the
    // gravel trap"). Check what a thing is drawn OVER — CLAUDE.md §4.
    drawGround(wallDt, game.car);   // floor + zones + ribbon + covers + WEAR, from the tile cache above
    drawRunoff();
    drawKerb();
    drawBumps();
    drawPaint();
    drawArrows(game, wallT);
    drawMarks(game.marks);
    drawFence();
    drawBarriers();
    drawProps();
    drawCones(game.cones.list);
    drawTape(game);
    addPuffs(game.cones.drainHits());
    addSpray(game.car, game.marks, wallDt);
    addSmoke(game.car, game.marks, wallDt);
    for (const c of [game.car, ...(game.ai || []).map((a) => a.car), ...(game.traffic ? game.traffic.cars.filter((t) => t.dmg && Math.abs(t.x - game.car.x) < 90 && Math.abs(t.y - game.car.y) < 90) : [])]) { addDamageSmoke(c, wallDt); addChips(c); addSparks(c, wallDt); }
    drawPuffs(wallDt);
    drawChips(wallDt);          // paint chips on the ground, under the cars          // under the car: dust over the bonnet reads as a rendering fault
    // HIGHWAY TRAFFIC (traffic.js), only the ones near the view (they are spread over ~800 m), under the AI and the player
    if (game.traffic) { const m = 12 * PPMz(); for (const c of game.traffic.cars) { const X = sx(c.x), Y = sy(c.y); if (X < -m || X > view.W + m || Y < -m || Y > view.H + m) continue;
      drawPixelCar(c); } }
    for (const a of game.ai || []) { drawPixelCar(a.car); }   // AI cars under the player's
    drawPixelCar(game.car);
    drawProps(true);            // overhead structures (gantry) pass OVER the cars
    mainCtx.save();
    mainCtx.setTransform(1, 0, 0, 1, 0, 0);
    mainCtx.imageSmoothingEnabled = false;
    mainCtx.drawImage(pcanvas, subX, subY, pcanvas.width * pk, pcanvas.height * pk);
    mainCtx.restore();
    view.zoom = keepZoom;
    if (camTrue) { cam.x = camTrue.x; cam.y = camTrue.y; }   // the true camera for the next frame / tools
  }

  function snap(car) {
    cam.x = car.x;
    cam.y = car.y;
    cam.lx = 0; cam.ly = 0;          // the look-ahead restarts from the car (follow() eases it back in)
    cam.initialised = true;
  }

  return {
    get ctx() { return mainCtx; },      // the HUD draws on the full-resolution screen, even in pixel mode
    get W() { return view.W; },
    get H() { return view.H; },
    get dpr() { return view.dpr; },
    cam, resize, frame, snap, sx, sy, roundRect, flyIn, thumbnail,
    get flying() { return !!camState.fly; },
    get PPM() { return view.PPM * view.zoom; },
    get groundRenders() { return tileState.tilesPainted; },
    get tileMs() { return tileState.tileMs; },
    get staleRepaints() { return tileState.staleRepaints; },
    get drawnN() { return tileState.drawnN; },
    get overviewBounds() { const o = camState.ovCache && camState.ovCache.ov; return o ? [o.x0, o.y0, o.x1, o.y1] : null; },
    get viewBounds() { const p = PPMz(); return [cam.x - view.W / 2 / p, cam.y - view.H / 2 / p, cam.x + view.W / 2 / p, cam.y + view.H / 2 / p]; },
    get standInFrame() { return tileState.standIn; },
    pixelCar,                           // for tools/spritesheet.mjs
    pixelCarWithWheels,                 // for the garage
    // for tools/visualcheck.mjs (user rule, 2026-10-03: "surface visuals should be accurate to their effects"):
    // the level painted FLAT (each surface its base colour, no patterns, no palette snap) at ppm px per metre, plus
    // the colour each surface id is painted in, so the tool can compare every drawn pixel with groundAt().
    // for the photo tools (tools/_sceneryshots.mjs): pin the camera zoom (null = back to speed-driven)
    debugZoom(z) { camState.pinZoom = z; if (z) view.zoom = z; },
    debugFlat(x0, y0, x1, y1, ppm) {
      const ow = Math.round((x1 - x0) * ppm), oh = Math.round((y1 - y0) * ppm);
      const c = document.createElement('canvas'); c.width = ow; c.height = oh;
      const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
      view.ctx = c.getContext('2d'); view.W = ow; view.H = oh; view.zoom = ppm / view.PPM; cam.x = (x0 + x1) / 2; cam.y = (y0 + y1) / 2;
      view.noPatterns = true;
      // the same ground layers frame() draws: the cached tiles' contents, then the live edge (run-off + edge kerb)
      try { drawFloor(); drawZones(); drawLanes(); drawTrackRibbon(); drawPatches(); drawCovers(); drawCurvedKerbs(); drawRunoff(); drawKerb(); }
      finally { view.ctx = keep.ctx; view.W = keep.W; view.H = keep.H; view.zoom = keep.zoom; cam.x = keep.cx; cam.y = keep.cy; view.noPatterns = false; }
      return { w: ow, h: oh, data: Array.from(c.getContext('2d').getImageData(0, 0, ow, oh).data) };
    },
    debugColours() {
      const base = {}; for (const [id, a] of Object.entries(SURFACE_ART)) if (a) base[id] = a.base;
      return { base, puddle: { ...PUDDLE_TINT }, col: { ...COL } };
    },
    get tileCount() { return tiles.size; },
    // for tools/tilediff.mjs: ground tile (zoom step k, column i, row j) painted fresh -> its pixels (not cached)
    debugTile(k, i, j) { const c = paintTile(k, i, j); return { w: c.width, h: c.height, data: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }; },
  };
}

// multiply a hex colour's lightness; used for every shade of a car's paint so one `paint` value in
// cars.js produces a whole consistent palette
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return `rgb(${r},${g},${b})`;
}

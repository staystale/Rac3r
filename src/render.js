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
import { CONES, BUMPS, LEVEL } from "./world/state.ts";
import { COL } from "./world/colours.ts";
import { WEAR_CELL, wearDirty, wearEpoch, groundAt } from "./world/wear.ts";
import { visualSlopeAt, visualHeightAt } from "./world/terrain.ts";
import { MARK_PPM } from './marks.js';
import { SPRITE_PPM } from "./render/shared.js";
import { createCars } from "./render/cars.js";
import { createParticles } from "./render/particles.js";
import { createRoad } from "./render/road.js";
import { createGround } from "./render/ground.js";
import { createProps } from "./render/props.js";
import { createObjects } from "./render/objects.js";

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
// PIXEL-ART MODE — the default (approved 2026-10-03; ?smooth=1 for the old renderer). Began as a ?pixel=1 mock-up (user, 2026-10-03: "everything pixel art, realistic-ish but in
// a pixel style", car ~70 px long like the reference sprites in art/reference/).
// The WORLD is drawn into a low-resolution buffer — one art pixel = PIXEL_CSS css px (an integer number of device
// pixels) — and blitted to the screen with smoothing OFF, so every edge is a hard pixel step. The HUD is drawn
// afterwards at full resolution so buttons and numbers stay crisp. Cars are generated PIXEL SPRITES (pixelCar).
// Everything else is the existing renderer, drawn small — the mock-up shows how far that alone gets.
// DEFAULT since the user approved the mock-up (2026-10-03). ?smooth=1 brings back the old smooth renderer.
// ?nolock=1 turns the pixel-locked view off (A/B for tools/wobblecheck)
const NO_LOCK = typeof location !== "undefined" && new URLSearchParams(location.search).has("nolock");
export const PIXEL = !(typeof location !== 'undefined' && new URLSearchParams(location.search).has('smooth'));
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
  const pcanvas = PIXEL ? document.createElement('canvas') : null;
  const pctx = PIXEL ? pcanvas.getContext('2d') : null;
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
    if (PIXEL) {
      // an art pixel is a whole number of device pixels, so the upscale never smears
      pk = Math.max(2, Math.round(PIXEL_CSS * realDpr));
      pcanvas.width = Math.ceil(canvas.width / pk); pcanvas.height = Math.ceil(canvas.height / pk);
      view.dpr = pcanvas.width / view.W;                       // the EFFECTIVE dpr every world draw (and every tile) uses
      pctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      pctx.imageSmoothingEnabled = false;
      view.ctx = pctx;
    }
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
  let fly = null;
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
  let ovCache = null;
  const roadS0 = () => (LEVEL.endless && LEVEL._hw && LEVEL._hw.pts.length ? LEVEL._hw.pts[0].s : 0);
  function levelOverview() {
    const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;
    if (ovCache && ovCache.level === LEVEL && ovCache.layout === layout && (!LEVEL.endless || Math.abs(roadS0() - ovCache.s0) < OV_REPAINT)) return ovCache.ov;
    if (!(view.W > 0)) return null;
    const [x0, y0, x1, y1] = levelBounds();
    ovCache = { level: LEVEL, layout, s0: roadS0(), ov: paintOverview(x0, y0, x1, y1, LEVEL.endless ? 512 : 1024) };
    return ovCache.ov;
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
    if (!(zFit > 0 && Number.isFinite(zFit))) { fly = null; return; }
    fly = { t: 0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z0: Math.min(1, zFit), ov: paintOverview(x0, y0, x1, y1) };
    cam.x = fly.cx; cam.y = fly.cy; cam.initialised = true; view.zoom = fly.z0;
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
    if (PIXEL) paletteSnap(c);
    return { c, x0, y0, x1, y1 };
  }
  // paint (without drawing) the tiles of step k covering a view centred on (cx, cy) at zoom z
  function prefetch(k, cx, cy, z, budget) {
    const tw = TILE_PX / (view.PPM * zOfStep(k)), p = view.PPM * z;
    const vx0 = cx - view.W / 2 / p, vx1 = cx + view.W / 2 / p, vy0 = cy - view.H / 2 / p, vy1 = cy + view.H / 2 / p;
    for (let i = Math.floor(vx0 / tw); i * tw < vx1 && budget.n > 0; i++)
      for (let j = Math.floor(vy0 / tw); j * tw < vy1 && budget.n > 0; j++) {
        const key = k + '|' + i + '|' + j;
        if (!tiles.has(key)) { budget.n--; tiles.set(key, { c: paintTile(k, i, j), used: tileFrame }); }
      }
  }
  function updateFly(car, wallDt) {
    if (!fly) return false;
    fly.t += wallDt;
    const k = Math.min(1, Math.max(0, fly.t - FLY_HOLD) / FLY_TIME);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;          // ease-in-out cubic
    const lead = 0.35, tx = car.x + car.vx * lead, ty = car.y + car.vy * lead;
    // the PAN leads the zoom (ease-out), so by the tile hand-over the view is already round the car,
    // where its tiles were pre-painted
    const ep = 1 - Math.pow(1 - k, 3);
    cam.x = fly.cx + (tx - fly.cx) * ep; cam.y = fly.cy + (ty - fly.cy) * ep;
    view.zoom = Math.exp(Math.log(fly.z0) + (Math.log(1) - Math.log(fly.z0)) * e);   // ease in log space: even feel
    if (k >= 1) fly = null;
    cam.lx = undefined;
    return true;
  }
  let vZoom = null, pinZoom = null;   // pinZoom: tools only (debugZoom) - the photo tools pin the wide view
  function updateZoom(car, wallDt) {
    if (pinZoom) { view.zoom = pinZoom; return; }
    // PROPORTIONAL TO SPEED, properly: hold the TIME-to-horizon constant rather than easing along an
    // arbitrary curve. You always see LOOKAHEAD seconds of road, so the distance visible scales
    // directly with how fast you are covering it — which is what "zoom out proportional to speed"
    // actually means for a driver. visible = W / (PPM * zoom) = v * LOOKAHEAD  =>  zoom = W / (PPM*v*T).
    // from a SLOW-AVERAGED speed (time constant ~1.5 s): braking into a corner and powering out no longer breathes the view
    const vNow = Math.hypot(car.vx, car.vy);
    vZoom = vZoom === null ? vNow : vZoom + (vNow - vZoom) * (1 - Math.exp(-0.65 * wallDt));
    const v = vZoom;
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
    drawCovers, drawWear, drawBumps, drawRunoff, drawArrows,
  } = createGround(view, cam, { PPMz, sx, sy, roundRect, forSide: (...a) => forSide(...a) });
  const {
    drawLanes, drawTrackRibbon, drawLaneDashes, drawCurvedKerbs, drawPaint, forSide,
    drawKerb, drawSlip, drawMarks,
  } = createRoad(view, cam, { PPMz, sx, sy, paintLayers, artBase });
  const {
    chips, MAX_CHIPS, addPuffs, addSpray, addSmoke, addDamageSmoke,
    addChips, addSparks, drawChips, drawPuffs,
  } = createParticles(view, cam, { PPMz, sx, sy });
  const { pixelCar, faceCache, drawPixelCar, drawCar } = createCars(view, cam, { PPMz, sx, sy, roundRect });
  const { drawFence, drawBarriers, drawProps } = createProps(view, cam, {
    PPMz, sx, sy, roundRect, forSide, drawSlip,
  });
  const { drawCones, drawTape } = createObjects(view, cam, {
    PPMz, sx, sy, roundRect, chips, MAX_CHIPS,
  });


  // ---------------------------------------------------------------- GROUND TILES (2026-10-03)
  // The floor, the surface zones and the track ribbon never change while you drive (wear and marks are
  // drawn separately, on top), so they are painted into cached TILES and each frame just blits tiles.
  //
  // MEASURED, in order (Stock Car, 4x CPU throttle, 4 s full-throttle run; 240 frames = a clean 60 fps):
  //   no patterns, painted live ............ 229 frames
  //   new patterns, painted live ........... 130 frames (draw 20.6 ms/frame)
  //   one big cache, repainted when stale .. 193 frames — every repaint was a 100-200 ms hitch, because
  //                                          the browser RASTERISES thousands of pattern shapes in one go
  //   tiles, <= TILE_BUDGET painted/frame .. see ENGINE.md for the figure after this change
  // Tiles are world-aligned squares at a few fixed ZOOM STEPS. A zoom between steps draws the nearest
  // step's tiles scaled (<= 13% — invisible on ground texture). A tile not ready yet is painted in at
  // most TILE_BUDGET per frame; until then the previous zoom step's tiles stand in (scaled), so a zoom
  // change never shows a hole and never repaints the whole screen in one frame.
  // css px per tile side (?tilepx= for A/B, tools/hwjudder.mjs)
  const TILE_PX = (typeof location !== 'undefined' && +new URLSearchParams(location.search).get('tilepx')) || 256;
  // 2 -> 1 (perf, 2026-10-03): at phone-ish CPU a tile is ~22 ms, so two in one frame was ~44 ms — a slow frame every time.
  // tiles painted per frame: ONE always, then more while the frame has spent < TILE_MS painting, up to TILE_BUDGET (a fast phone fills a
  // gap in a frame or two, a slow one never stalls); the level overview stands in for the rest. (tileBudget() / takeTile() below)
  const TILE_BUDGET = 4, TILE_MS = 6;
  const tileBudget = (n = TILE_BUDGET) => ({ n, first: true, until: performance.now() + TILE_MS });
  // may this frame paint one more tile? (the first always; then only inside the time budget)
  function takeTile(b) { if (b.n <= 0 || (!b.first && b.until != null && performance.now() > b.until)) return false; b.n--; b.first = false; return true; }
  // cached tiles kept; oldest dropped first (~1 MB each at dpr 2). 48 -> 72 so the fly-in's pre-painted close-up steps (~60 tiles)
  // survive to be used. Scaled with the tile AREA, so smaller tiles keep the same ground in memory.
  const TILE_MAX = Math.round(72 * (256 / TILE_PX) ** 2);
  // 3 -> 2 steps per doubling (perf, 2026-10-03): the speed zoom crosses steps all lap and every step is a fresh set of tiles.
  // MEASURED at CPU x4, Test Track lap: 3 steps 51 slow frames / 187 tiles; 2 steps 37 / 170. Tiles stretch up to 1.41x.
  const ZSTEP = 2;                // zoom steps per doubling: 1, 0.71, 0.5, 0.35
  const tiles = new Map();        // key "level|k|i|j" -> { c: canvas, used: frame number }
  let tileFrame = 0, tilesPainted = 0, tileLevel = null, tileDpr = 0, tilePPM = 0, tileLayout = 0;
  const zStepOf = (z) => Math.round(ZSTEP * Math.log2(z));
  const zOfStep = (k) => Math.pow(2, k / ZSTEP);
  // PIXEL MODE: snap every pixel of a freshly painted ground tile to a LIMITED PALETTE — the surfaces' own colours
  // (SURFACE_ART + COL), plus every translucent layer already blended over every base. Removes the anti-aliased
  // in-between shades that made stones and blob edges soft and blurry in pass 1. Done ONCE per tile (cached), via a
  // 32768-entry lookup (5 bits a channel), so it costs nothing per frame.
  let paletteLUT = null;
  function parseCol(sv) {
    if (typeof sv !== 'string') return null;
    let m = sv.match(/^#([0-9a-f]{6})$/i);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]; }
    m = sv.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    return null;
  }
  function buildPalette() {
    const pal = [];
    const over = (b, s) => [0, 1, 2].map((i) => Math.round(b[i] * (1 - s[3]) + s[i] * s[3]));
    // MEASURED (pass 2): blending every translucent layer over every base gave ~1,500 shades on screen and the
    // blur survived. Now each layer is blended only over ITS OWN surface's base.
    for (const [id, a] of Object.entries(SURFACE_ART)) {
      if (!a) continue;
      const base = parseCol(a.base); pal.push(base.slice(0, 3));
      for (const L of a.layers) { const c = parseCol(L[1]); if (c) pal.push(c[3] >= 0.999 ? c.slice(0, 3) : over(base, c)); }
      const tint = parseCol(PUDDLE_TINT[id]); if (tint) pal.push(over(base, tint));
    }
    for (const v of Object.values(COL)) { const c = parseCol(v); if (c && c[3] >= 0.999) pal.push(c.slice(0, 3)); }
    ['#f2f2f4', '#d9d9e2', '#ffffff', '#14161c', '#c9c4bc', '#fff6e6'].forEach((v) => pal.push(parseCol(v).slice(0, 3)));
    const lut = new Uint32Array(32768);
    for (let q = 0; q < 32768; q++) {
      const r0 = ((q >> 10) & 31) * 8 + 4, g0 = ((q >> 5) & 31) * 8 + 4, b0 = (q & 31) * 8 + 4;
      let best = 0, bd = 1e9;
      for (let i = 0; i < pal.length; i++) { const p = pal[i], d = (p[0] - r0) ** 2 * 3 + (p[1] - g0) ** 2 * 4 + (p[2] - b0) ** 2 * 2; if (d < bd) { bd = d; best = i; } }
      const p = pal[best]; lut[q] = (255 << 24) | (p[2] << 16) | (p[1] << 8) | p[0];
    }
    return lut;
  }
  // snaps cv; with `to`, reads cv and writes the snapped pixels into `to` instead (the tile scratch -> the tile, paintTileInner)
  function paletteSnap(cv, to = cv) {
    if (!paletteLUT) paletteLUT = buildPalette();
    const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height), d32 = new Uint32Array(img.data.buffer);
    for (let i = 0; i < d32.length; i++) {
      const v = d32[i]; if ((v >>> 24) < 8) continue;
      d32[i] = paletteLUT[(((v & 255) >> 3) << 10) | ((((v >> 8) & 255) >> 3) << 5) | (((v >> 16) & 255) >> 3)];
    }
    to.getContext('2d').putImageData(img, 0, 0);
  }
  // ?tilegpu=1: the old path (tiles painted + read back on their own GPU canvas) — perf A/B for tools/hwjudder.mjs
  const TILE_GPU = typeof location !== 'undefined' && new URLSearchParams(location.search).has('tilegpu');
  let tileMs = 0;                                   // total ms spent painting tiles (tools: perf)
  let staleRepaints = 0;                            // of those, repaints of a tile wear made stale (tools: hwjudder)
  let tileAvg = 20;                                 // running average ms per tile (starts pessimistic = phone)
  function paintTile(k, i, j) {
    const tp0 = performance.now();
    try { return paintTileInner(k, i, j); } finally { const dt = performance.now() - tp0; tileMs += dt; tileAvg += (dt - tileAvg) * 0.2; }
  }
  // TILES ARE PAINTED ON A CPU SCRATCH, KEPT ON THE GPU (perf, 2026-10-06; user: "judder on mobile on infinite levels - guess thats
  // as chunks load"). MEASURED (tools/hwjudder.mjs + hwprofile.mjs, highway at 130-240 km/h, CPU x4, phone landscape): the road
  // window moving (stepHighway, ~2 ms) is NOT it; ground tiles are - ~10 a second scroll in at speed and each cost 45 ms, of which
  // paletteSnap's getImageData was ~half: reading back a GPU canvas stalls the GPU pipeline. A tile canvas with willReadFrequently
  // halved the tile (23.6 ms) but then every frame re-uploaded every CPU tile it drew (drawImage 4.8 -> 11.4 % of the run). So:
  // draw + snap on ONE reusable CPU scratch (no readback stall), putImageData once into the tile's own GPU canvas (one upload).
  // a FRESH scratch per tile: a reused one would carry drawing state (line dash, font, smoothing ...) from the last tile
  function tileScratch(px) {
    const c = document.createElement('canvas'); c.width = c.height = px;
    return { c, g: c.getContext('2d', { willReadFrequently: true }) };
  }
  function paintTileInner(k, i, j) {
    const zq = zOfStep(k), pq = view.PPM * zq, tw = TILE_PX / pq;     // world metres per tile
    const px = Math.round(TILE_PX * view.dpr), c = document.createElement('canvas');
    c.width = c.height = px;
    const viaScratch = PIXEL && !TILE_GPU, sc = viaScratch ? tileScratch(px) : null;
    const g = viaScratch ? sc.g : c.getContext('2d');
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
    view.ctx = g; view.W = view.H = TILE_PX; view.zoom = zq; cam.x = (i + 0.5) * tw; cam.y = (j + 0.5) * tw;
    try {
      drawFloor();
      drawZones();
      drawLanes();          // UNDER the ribbon: where a lane meets the track, the track wins (lab.js zoneAt does the same)
      // ENDLESS: wear UNDER the ribbon (2026-10-06, "dirt in the road"; tools/_dirtroad.mjs): the motorway is all tarmac (it never wears),
      // but a worn verge cell's disc (0.72 x 1.5 m radius) reached ~1 m over the carriageway edge and read as dirt ON the road
      const endless = !!LEVEL.endless;
      if (endless) drawWear('base');
      drawTrackRibbon();
      drawLaneDashes();
      drawPatches();
      if (!endless) drawWear('base');     // baked in (2026-10-03): see wearDirty below. Under the covers ...
      drawCovers();
      drawWear('cover');    // ... except where the cover itself has changed
      drawCurvedKerbs();    // kerbs last: no surface ever paints over a kerb
    } finally {
      view.ctx = keep.ctx; view.W = keep.W; view.H = keep.H; view.zoom = keep.zoom; cam.x = keep.cx; cam.y = keep.cy;
    }
    tilesPainted++;
    if (viaScratch) paletteSnap(sc.c, c);
    else if (PIXEL) paletteSnap(c);
    hillShade(c, tw, (i + 0.5) * tw, (j + 0.5) * tw);
    return c;
  }
  // HILL-SHADING (step 3, 2026-10-03; user: "make sure banked surfaces are clearly shown with brighter spots and shadowing,
  // same with bumps and dips"; chose PIXEL HILL-SHADING). Light from the TOP-LEFT: ground sloping toward it is brighter,
  // away from it darker, in STEPPED bands on square cells (pixel art: squares, no smooth gradients). It reads the SAME
  // height the physics drives on (lab.js bumpAt), so what you see is what you drive. Applied AFTER the palette snap so a
  // shaded patch of grass can never snap to another surface's colour. Baked once per tile: costs nothing per frame.
  // depth: how far a full band moves a colour toward white (lit) or black (shadow). MEASURED (photographed): a plain
  // brightness MULTIPLY of 1.2 was invisible on dark race tarmac (#2d303a), so light is ADDED toward white instead.
  const SHADE = { cellM: 0.5, maxCells: 64, gain: 3.0, bands: 4, depth: 0.36, hRef: 0.25, hGain: 0.9, slopeK: 0.55 };   // height outweighs slope so a bump reads LIGHTER overall and a dip DARKER (user)   // 4 bands: at 3 the Naffcar bank flipped a whole band at the turn apex and read as a seam
  const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2];
  const LIT = [255, 226, 150], LIT_N = [255, 255, 255], SHD = [26, 34, 58];   // warm (bright ground only), neutral, cool shadow          // toward the light, world frame (screen up-left)
  const NO_SHADE = typeof location !== 'undefined' && new URLSearchParams(location.search).has('noshade');   // perf A/B
  function hillShade(cv, tw, cx, cy) {
    if (NO_SHADE) return;
    const n = Math.max(1, Math.min(SHADE.maxCells, Math.ceil(tw / SHADE.cellM)));
    const cell = tw / n, x0 = cx - tw / 2, y0 = cy - tw / 2;
    // HEIGHTS ONCE on a grid of cell centres with a one-cell border; slopes from the neighbours. MEASURED: 5 lookups per cell
    // (4 for the slope, 1 for the tint) made a Test Track tile ~12 ms on a PC; now (n+2)^2 lookups in all.
    // SAMPLED ON A 2x COARSER GRID and interpolated (perf, 2026-10-03): terrain changes over metres, so heights every 1 m are
    // enough — 4x fewer lookups. MEASURED at CPU x4: ~12 ms of a 26 ms tile was this. Tiles that contain WASHBOARD (0.9 m
    // ripples) keep the full grid so the ripples still show.
    const m = n + 2, hg = new Float32Array(m * m);
    const fine = BUMPS.some((bp) => bp.kind === 'washboard' && Math.abs(bp.x - cx) < tw / 2 + bp.len / 2 && Math.abs(bp.y - cy) < tw / 2 + bp.len / 2);
    if (fine || n < 8) {
      for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) hg[b * m + a] = visualHeightAt(x0 + (a - 0.5) * cell, y0 + (b - 0.5) * cell);
    } else {
      const mc = Math.ceil(m / 2) + 1, hc = new Float32Array(mc * mc);
      for (let b = 0; b < mc; b++) for (let a = 0; a < mc; a++) hc[b * mc + a] = visualHeightAt(x0 + (2 * a - 0.5) * cell, y0 + (2 * b - 0.5) * cell);
      for (let b = 0; b < m; b++) for (let a = 0; a < m; a++) {
        const ca = a >> 1, cb = b >> 1, fa = (a & 1) * 0.5, fb = (b & 1) * 0.5;
        const h00 = hc[cb * mc + ca], h10 = hc[cb * mc + ca + 1], h01 = hc[(cb + 1) * mc + ca], h11 = hc[(cb + 1) * mc + ca + 1];
        hg[b * m + a] = (h00 * (1 - fa) + h10 * fa) * (1 - fb) + (h01 * (1 - fa) + h11 * fa) * fb;
      }
    }
    const f = new Float32Array(n * n);
    let any = false;
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const k0 = (b + 1) * m + (a + 1);
      const sl = { gx: (hg[k0 + 1] - hg[k0 - 1]) / (2 * cell), gy: (hg[k0 + m] - hg[k0 - m]) / (2 * cell) };
      const raw = (-sl.gx * LIGHT[0] - sl.gy * LIGHT[1]) * SHADE.gain;
      const hh = hg[k0];
      const s = Math.max(-1, Math.min(1, Math.sign(raw) * Math.sqrt(Math.abs(raw)) * SHADE.slopeK + Math.tanh(hh / SHADE.hRef) * SHADE.hGain));
      const q = Math.round(s * SHADE.bands) / SHADE.bands;
      if (q !== 0) any = true;
      f[b * n + a] = SHADE.depth * q;            // + toward white, - toward black
    }
    if (!any) return;                                   // flat tile: nothing to do
    // DRAWN AS TRANSLUCENT SQUARES, not per-pixel (perf, 2026-10-03). "Move toward white by k" IS "draw white at opacity k", so
    // the colours are identical — but there is no getImageData / putImageData readback. MEASURED at CPU x4: once the natural
    // ground put gentle hills on every grass tile, that readback ran on EVERY tile and shading cost ~15 ms of a 29 ms tile.
    // The warm light (for near-white ground, where white cannot show) is chosen per cell from the surface underneath.
    // ONE PATH PER SHADE, not one fillRect per cell (perf, 2026-10-06, the highway judder). MEASURED (tools/hwprofile.mjs, highway,
    // CPU x4): up to 4096 fillRects a tile, each with a fresh rgba() string, were ~half of every ground tile. A cell's style is one
    // of ~9 (2 x SHADE.bands levels x lit / lit-lab / shadow): the same integer-edged rects are gathered per style and filled once.
    // Same pixels (tools/tilediff.mjs): the rects abut, never overlap, so one fill blends each pixel exactly once, as before.
    const g = cv.getContext('2d');
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    const pxPerCell = cv.width / n, groups = new Map();
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const k = f[b * n + a];
      if (k === 0) continue;
      let col;
      if (k > 0) {
        // only the lab level has the near-white floor; a full ground lookup per cell cost more than the shading itself
        col = LEVEL.id === 'lab' && groundAt(x0 + (a + 0.5) * cell, y0 + (b + 0.5) * cell).surface.id === 'lab' ? LIT : LIT_N;
      } else col = SHD;
      const key = (col === SHD ? 0 : col === LIT ? 1 : 2) * 1000 + Math.round(Math.abs(k) * 1000);
      let gr = groups.get(key); if (!gr) { gr = { col, k: Math.abs(k), r: [] }; groups.set(key, gr); }
      const px0 = Math.round(a * pxPerCell), py0 = Math.round(b * pxPerCell);
      gr.r.push(px0, py0, Math.round((a + 1) * pxPerCell) - px0, Math.round((b + 1) * pxPerCell) - py0);
    }
    for (const gr of groups.values()) {
      g.fillStyle = `rgba(${gr.col[0]},${gr.col[1]},${gr.col[2]},${gr.k.toFixed(3)})`;
      g.beginPath(); const r = gr.r; for (let q = 0; q < r.length; q += 4) g.rect(r[q], r[q + 1], r[q + 2], r[q + 3]);
      g.fill();
    }
    g.restore();
  }
  // How many tiles of zoom step k that cover the view are not painted yet. Draws nothing.
  function countMissing(k) {
    const tw = TILE_PX / (view.PPM * zOfStep(k)), p = PPMz();
    const vx0 = cam.x - view.W / 2 / p, vx1 = cam.x + view.W / 2 / p, vy0 = cam.y - view.H / 2 / p, vy1 = cam.y + view.H / 2 / p;
    let missing = 0;
    for (let i = Math.floor(vx0 / tw); i * tw < vx1; i++)
      for (let j = Math.floor(vy0 / tw); j * tw < vy1; j++) if (!tiles.has(k + '|' + i + '|' + j)) missing++;
    return missing;
  }
  // Blit every tile of zoom step k that covers the view. Returns how many were missing. With
  // `paint` it paints missing tiles (budget permitting); without, it only draws what exists.
  function blitStep(k, paint, budget) {
    const zq = zOfStep(k), tw = TILE_PX / (view.PPM * zq), p = PPMz();
    const vx0 = cam.x - view.W / 2 / p, vx1 = cam.x + view.W / 2 / p, vy0 = cam.y - view.H / 2 / p, vy1 = cam.y + view.H / 2 / p;
    let missing = 0;
    for (let i = Math.floor(vx0 / tw); i * tw < vx1; i++) {
      for (let j = Math.floor(vy0 / tw); j * tw < vy1; j++) {
        const key = k + '|' + i + '|' + j;
        let t = tiles.get(key);
        if (!t && paint && takeTile(budget)) { t = { c: paintTile(k, i, j), used: 0 }; tiles.set(key, t); }
        // a STALE tile (wear changed under it) keeps showing until the budget lets it be repainted
        else if (t && t.stale && paint && takeTile(budget)) { t.c = paintTile(k, i, j); t.stale = false; staleRepaints++; }
        if (!t) { missing++; continue; }
        t.used = tileFrame;
        // integer edges, so neighbouring tiles meet with no hairline seam
        // edges on whole ART pixels (dpr = art px per css px); with the pixel-locked view every tile is the same width
        const x0 = Math.round(sx(i * tw) * view.dpr) / view.dpr, x1 = Math.round(sx((i + 1) * tw) * view.dpr) / view.dpr;
        const y0 = Math.round(sy(j * tw) * view.dpr) / view.dpr, y1 = Math.round(sy((j + 1) * tw) * view.dpr) / view.dpr;
        view.ctx.drawImage(t.c, x0, y0, x1 - x0, y1 - y0);
      }
    }
    return missing;
  }
  // WEAR IS BAKED INTO THE TILES (2026-10-03). MEASURED: drawing worn cells live every frame cost the lab
  // panels run 238 -> 197 frames (4x throttle). Now a changed cell only marks the tiles over it STALE; they
  // keep showing until repainted within TILE_BUDGET, so wear appears within a frame or two and costs
  // nothing while it is not changing. Dirty cells are drained at most every WEAR_DRAIN s, which batches a
  // drift that changes many cells into one repaint of the tiles involved.
  const WEAR_DRAIN = 0.15;
  let wearDrainT = 0, seenEpoch = -1;
  function drainWear(wallDt) {
    if (seenEpoch !== wearEpoch) { seenEpoch = wearEpoch; for (const t of tiles.values()) t.stale = true; wearDirty.length = 0; return; }
    wearDrainT += wallDt;
    if (wearDrainT < WEAR_DRAIN || wearDirty.length === 0) return;
    wearDrainT = 0;
    for (const [key, t] of tiles) {
      if (t.stale) continue;
      const [k, i, j] = key.split('|').map(Number);
      const tw = TILE_PX / (view.PPM * zOfStep(k)), x0 = i * tw, y0 = j * tw;
      for (const c of wearDirty) {
        const cx = c.cx * WEAR_CELL, cy = c.cy * WEAR_CELL;
        if (cx + WEAR_CELL >= x0 && cx <= x0 + tw && cy + WEAR_CELL >= y0 && cy <= y0 + tw) { t.stale = true; break; }
      }
    }
    wearDirty.length = 0;
  }
  function drawGround(wallDt = 0, car = null) {
    drainWear(wallDt);
    tileFrame++;
    const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;   // a re-randomised track (Grass Track)
    if (tileLevel !== LEVEL || tileDpr !== view.dpr || tilePPM !== view.PPM || tileLayout !== layout) {
      tiles.clear(); tileLevel = LEVEL; tileDpr = view.dpr; tilePPM = view.PPM; tileLayout = layout; lastStep = null;
    }
    if (fly && fly.ov && view.zoom < FLY_HANDOVER) {
      const o = fly.ov;
      view.ctx.fillStyle = COL.outside; view.ctx.fillRect(0, 0, view.W, view.H);
      view.ctx.drawImage(o.c, sx(o.x0), sy(o.y0), (o.x1 - o.x0) * PPMz(), (o.y1 - o.y0) * PPMz());
      if (car) {
        const budget = { n: FLY_PREFETCH };
        // the steps the camera will pass through after the hand-over, nearest-to-final first
        // only the EVEN steps are used during the flight (see below) — three steps, ~60 tiles, not ~90
        for (let k = 0; k >= zStepOf(FLY_HANDOVER) - 1 && budget.n > 0; k -= 2) prefetch(k, car.x, car.y, zOfStep(k) / 1.6, budget);
      }
      lastStep = null;
      return;
    }
    // HYSTERESIS on the zoom step (perf, 2026-10-03): the speed zoom wanders across step boundaries all the time and every
    // switch repaints the whole view. Stay on the current step until the zoom is 0.75 of a step away from it.
    let k = fly ? 2 * Math.ceil(zStepOf(view.zoom) / 2) : zStepOf(view.zoom);   // flight: even steps only, finer side
    if (!fly && lastStep !== null && Math.abs(ZSTEP * Math.log2(view.zoom) - lastStep) < 0.75) k = lastStep;
    const budget = tileBudget();
    // count what the wanted step is missing BEFORE painting, to decide whether a stand-in is needed
    if (lastStep !== null && lastStep !== k && countMissing(k) > 0) {
      // the stand-in: the step we were on, scaled. Drawn first, then whatever of k exists goes over it.
      view.ctx.fillStyle = standInFill(); view.ctx.fillRect(0, 0, view.W, view.H);
      blitStep(lastStep, false, budget);
      const left = blitStep(k, true, budget);
      standIn = left > 0;
      if (left === 0) lastStep = k;
    } else {
      // STAND-IN FOR NEW GROUND (perf, 2026-10-03; user: "still seeing lag at high speeds"). This used to paint EVERY missing tile
      // in the frame it appeared — MEASURED at CPU x4: frames up to ~150 ms when ground scrolled in at speed. Now: the whole-
      // level overview (the fly-in's flat painting, kept per level) goes down first, then at most TILE_BUDGET real tiles; the
      // rest arrive over the next frames, so a frame or two shows a softer patch at the edge instead of a stall.
      if (countMissing(k) > 1) {
        const ov = levelOverview();
        if (ov) { view.ctx.fillStyle = standInFill(); view.ctx.fillRect(0, 0, view.W, view.H); view.ctx.drawImage(ov.c, sx(ov.x0), sy(ov.y0), (ov.x1 - ov.x0) * PPMz(), (ov.y1 - ov.y0) * PPMz()); }
        standIn = blitStep(k, true, budget) > 0;
      } else { blitStep(k, true, { n: Infinity }); standIn = false; }
      lastStep = k;
    }
    // (A LOOK-AHEAD painter was tried here, 2026-10-03: one tile per spare frame from where the car is heading. MEASURED at
    // CPU x4 it made things WORSE — 97 slow frames per lap vs 51 without, and more tiles in total. Removed.)
    // BACK, GATED ON TILE COST (user, 2026-10-04: "block loading is chunky / visible on PC"). A big PC screen needs ~3x the
    // tiles of a phone, so at 1 tile a frame 27% of frames showed the flat stand-in (1600x900, 159 of 600). On a device that
    // paints a tile in < AHEAD_MAX_MS, a frame with NOTHING missing paints one tile from the view AHEAD of the car. Phones
    // (12-20 ms a tile at CPU x4) never qualify, so they keep the measured-better behaviour above.
    if (!standIn && !fly && car && tileAvg < AHEAD_MAX_MS && Math.hypot(car.vx, car.vy) > 3) {
      prefetch(k, cam.x + car.vx * AHEAD_S, cam.y + car.vy * AHEAD_S, view.zoom, { n: 1 });
    }
    if (tiles.size > TILE_MAX) {
      const old = [...tiles.entries()].sort((a, b) => a[1].used - b[1].used);
      for (let n = 0; n < tiles.size - TILE_MAX; n++) tiles.delete(old[n][0]);
    }
  }
  let lastStep = null, drawnN = 0;   // drawnN: art px per tile the last frame was DRAWN at (tools/hwwobble.mjs)
  const AHEAD_MAX_MS = 9, AHEAD_S = 0.6;   // look-ahead painting: only below this tile cost; view shifted this many s of travel
  let standIn = false;            // this frame showed a stand-in somewhere (tools: tile pop-in)

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
    if (!NO_LOCK && (!fly || view.zoom >= FLY_HANDOVER)) {
      const k = (lastStep !== null && Math.abs(ZSTEP * Math.log2(view.zoom) - lastStep) < 0.75) ? lastStep : zStepOf(view.zoom);
      const zq = zOfStep(k), N = Math.max(1, Math.round(TILE_PX * view.dpr * view.zoom / zq));
      view.zoom = N * zq / (TILE_PX * view.dpr); drawnN = N;
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
      if (PIXEL) drawPixelCar(c); else drawCar(c, wallT); } }
    for (const a of game.ai || []) { if (PIXEL) drawPixelCar(a.car); else drawCar(a.car, wallT); }   // AI cars under the player's
    if (PIXEL) drawPixelCar(game.car); else drawCar(game.car, wallT);
    drawProps(true);            // overhead structures (gantry) pass OVER the cars
    if (PIXEL) {
      mainCtx.save();
      mainCtx.setTransform(1, 0, 0, 1, 0, 0);
      mainCtx.imageSmoothingEnabled = false;
      mainCtx.drawImage(pcanvas, subX, subY, pcanvas.width * pk, pcanvas.height * pk);
      mainCtx.restore();
    }
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
    get flying() { return !!fly; },
    get PPM() { return view.PPM * view.zoom; },
    get groundRenders() { return tilesPainted; },
    get tileMs() { return tileMs; },
    get staleRepaints() { return staleRepaints; },
    get drawnN() { return drawnN; },
    get overviewBounds() { const o = ovCache && ovCache.ov; return o ? [o.x0, o.y0, o.x1, o.y1] : null; },
    get viewBounds() { const p = PPMz(); return [cam.x - view.W / 2 / p, cam.y - view.H / 2 / p, cam.x + view.W / 2 / p, cam.y + view.H / 2 / p]; },
    get standInFrame() { return standIn; },
    pixelCar,                           // for tools/spritesheet.mjs
    // the GARAGE lift (user, 2026-10-04: "some vehicles aren't showing their wheels in garage mode"): the body sprite only carries the
    // body — the game draws the wheels separately (they steer) — so the lift gets a composite: wheels as drawPixelCar draws them, then
    // the body. Same { c, Lp, Wp } shape; cached per car.
    pixelCarWithWheels(spec) {
      const k = 'wheels:' + spec.id + spec.paint + spec.trim + (spec.num || 0); if (faceCache.has(k)) return faceCache.get(k);
      const sp = pixelCar(spec), s = spec;
      const tyreL = s.kind === 'track' ? 14 : s.kind === 'tractor' ? 15 : 11, tyreW = s.kind === 'track' ? 6 : 4;
      const hw = Math.max((s.trackWidth || 1.5) / 2 * SPRITE_PPM, sp.Wp / 2) + (s.kind === 'track' ? 1 : 0);
      const padY = Math.max(0, Math.ceil(hw + 4 - sp.Wp / 2)), c = document.createElement('canvas'); c.width = sp.c.width + 4; c.height = sp.c.height + padY * 2;
      const gx = c.getContext('2d'), cx = c.width / 2, cy = c.height / 2;
      for (const [ax, side] of [[s.lf, -1], [s.lf, 1], [-s.lr, -1], [-s.lr, 1]]) {
        const big = s.kind === 'tractor' && ax < 0, tl = big ? 20 : tyreL, tw = big ? 7 : tyreW, x = Math.round(cx + ax * SPRITE_PPM), y = Math.round(cy + side * hw);
        gx.fillStyle = '#16171c'; gx.fillRect(x - tl / 2, y - tw / 2, tl, tw);
        gx.fillStyle = '#3a3d47'; gx.fillRect(x - tl / 2 + 2, y - tw / 2, tl - 4, 1);
        if (s.kind === 'tractor') { gx.fillStyle = '#fbc02d'; gx.fillRect(x - 2, y - 1, 4, 2); } else if (s.rim) { gx.fillStyle = s.rim; gx.fillRect(x - 2, y - 1, 4, 2); }
      }
      gx.drawImage(sp.c, Math.round(cx - sp.c.width / 2), Math.round(cy - sp.c.height / 2));
      const out = { c, Lp: sp.Lp, Wp: sp.Wp + padY * 2 }; faceCache.set(k, out); return out;
    },
    // for tools/visualcheck.mjs (user rule, 2026-10-03: "surface visuals should be accurate to their effects"):
    // the level painted FLAT (each surface its base colour, no patterns, no palette snap) at ppm px per metre, plus
    // the colour each surface id is painted in, so the tool can compare every drawn pixel with groundAt().
    // for the photo tools (tools/_sceneryshots.mjs): pin the camera zoom (null = back to speed-driven)
    debugZoom(z) { pinZoom = z; if (z) view.zoom = z; },
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

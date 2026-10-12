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
import { parkMiller, hash2d } from "./core/random.ts";

import "./world/load.ts";   // the world is set up before this file runs (as importing lab.js did)
import { FLOOR, FX0, FX1, FY0, FY1, GRID, KERB_W, RUNOFF_W, FENCE } from "./world/bounds.ts";
import { PAINT, BOARDS, CONES, ZONES, BUMPS, LEVEL, PROPS } from "./world/state.ts";
import { CONE_R } from "./world/tyrewall.ts";
import { COL } from "./world/colours.ts";
import { VERGE_W } from "./world/surfaces.ts";
import { BARRIER_HALF } from "./world/barriers.ts";
import { wearMap, WEAR_CELL, wearDirty, wearEpoch, groundAt, coverCut } from "./world/wear.ts";
import { visualSlopeAt, visualHeightAt } from "./world/terrain.ts";
import { MARK_PPM, MARK_EXTENT } from './marks.js';
import { SPRITE_PPM } from "./render/shared.js";
import { createCars } from "./render/cars.js";

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

  // ---------------------------------------------------------------- floor
  function drawFloor() {
    view.ctx.fillStyle = COL.outside;
    view.ctx.fillRect(0, 0, view.W, view.H);
    const p = PPMz();

    // the floor RECTANGLE (S-B): FX0..FX1 x FY0..FY1, the square +-FLOOR on every level without bounds
    const fw = (FX1 - FX0) * p, fh = (FY1 - FY0) * p;
    if (LEVEL.base && LEVEL.base.id !== 'lab') {
      view.ctx.fillStyle = artBase(LEVEL.base.id, COL.floor);
      view.ctx.fillRect(sx(FX0), sy(FY0), fw, fh);
      view.ctx.save();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(LEVEL.base.id, FX0, FY0, FX1, FY1);
      view.ctx.restore();
    } else {
      view.ctx.fillStyle = COL.floor;
      view.ctx.fillRect(sx(FX0), sy(FY0), fw, fh);

      // a soft warm pool so a big pale floor is not dead flat. Since the ground TILES (2026-10-03) it is
      // centred on the WORLD ORIGIN (the skidpad), not on the car: tiles are painted separately, so a
      // screen-centred gradient would come out as one blotch per tile. It stays UNDER the zones.
      const gr = view.ctx.createRadialGradient(sx(0), sy(0), 0, sx(0), sy(0), FLOOR * 0.9 * p);
      gr.addColorStop(0, 'rgba(255,252,246,0.55)');
      gr.addColorStop(1, 'rgba(226,226,234,0)');
      view.ctx.fillStyle = gr;
      view.ctx.fillRect(sx(FX0), sy(FY0), fw, fh);

      // grid — only the lines actually on screen
      const x0 = Math.floor((cam.x - view.W / 2 / PPMz()) / GRID) * GRID;
      const x1 = cam.x + view.W / 2 / PPMz();
      const y0 = Math.floor((cam.y - view.H / 2 / PPMz()) / GRID) * GRID;
      const y1 = cam.y + view.H / 2 / PPMz();
      view.ctx.strokeStyle = COL.grid;
      view.ctx.lineWidth = 1;
      view.ctx.beginPath();
      for (let x = x0; x <= x1; x += GRID) {
        if (x < FX0 || x > FX1) continue;
        const px = Math.round(sx(x)) + 0.5;
        view.ctx.moveTo(px, sy(Math.max(FY0, y0 - GRID)));
        view.ctx.lineTo(px, sy(Math.min(FY1, y1 + GRID)));
      }
      for (let y = y0; y <= y1; y += GRID) {
        if (y < FY0 || y > FY1) continue;
        const py = Math.round(sy(y)) + 0.5;
        view.ctx.moveTo(sx(Math.max(FX0, x0 - GRID)), py);
        view.ctx.lineTo(sx(Math.min(FX1, x1 + GRID)), py);
      }
      view.ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- lanes (pit lanes, access roads) — lab.js laneAt
  // Drawn PIECE BY PIECE — each segment's rectangle plus a disc at every point — which is exactly the set lab.js laneAt calls
  // lane (distance to the polyline <= half width). The first cut (one polygon, averaged normals) pinched at taxiway corners and
  // so disagreed with the physics there. The pattern is world-anchored, so pieces join without a seam.
  function drawLanes() {
    if (!LEVEL.lanes) return;
    const P = PPMz(), vx0 = cam.x - view.W / 2 / P, vx1 = cam.x + view.W / 2 / P, vy0 = cam.y - view.H / 2 / P, vy1 = cam.y + view.H / 2 / P;
    for (const ln of LEVEL.lanes) {
      const pts = ln.pts, n = pts.length, hw = ln.width / 2, id = ln.surface.id;
      if (n < 2) continue;
      // SEGMENT CULL (2026-10-04, Castle Cum): the ring road's box is the whole map, so EVERY tile built all 48 pieces and painted a
      // tile of pattern only to clip it away — MEASURED ground tile 45.7 ms (Thruston 26). Now only the pieces touching the view,
      // and the pattern only over their box.
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity, any = false;
      view.ctx.beginPath();
      for (let i = 0; i < n - 1; i++) {
        const [ax, ay] = pts[i], [qx, qy] = pts[i + 1];
        const sx0 = Math.min(ax, qx) - hw, sx1 = Math.max(ax, qx) + hw, sy0 = Math.min(ay, qy) - hw, sy1 = Math.max(ay, qy) + hw;
        if (sx1 < vx0 || sx0 > vx1 || sy1 < vy0 || sy0 > vy1) continue;
        any = true; bx0 = Math.min(bx0, sx0); bx1 = Math.max(bx1, sx1); by0 = Math.min(by0, sy0); by1 = Math.max(by1, sy1);
        const L = Math.hypot(qx - ax, qy - ay) || 1, nx = -(qy - ay) / L * hw, ny = (qx - ax) / L * hw;
        // every piece wound the same way (nonzero fill = their union, no holes where they overlap)
        view.ctx.moveTo(sx(ax + nx), sy(ay + ny)); view.ctx.lineTo(sx(qx + nx), sy(qy + ny)); view.ctx.lineTo(sx(qx - nx), sy(qy - ny)); view.ctx.lineTo(sx(ax - nx), sy(ay - ny)); view.ctx.closePath();
        // a disc at each end of a visible piece (anticlockwise = the quads' winding, else holes)
        view.ctx.moveTo(sx(ax + hw), sy(ay)); view.ctx.arc(sx(ax), sy(ay), hw * P, 0, Math.PI * 2, true);
        view.ctx.moveTo(sx(qx + hw), sy(qy)); view.ctx.arc(sx(qx), sy(qy), hw * P, 0, Math.PI * 2, true);
      }
      if (!any) continue;
      view.ctx.fillStyle = artBase(id, COL.tarmac); view.ctx.fill('nonzero');
      view.ctx.save(); view.ctx.clip('nonzero'); view.ctx.translate(sx(0), sy(0)); paintLayers(id, Math.max(bx0, vx0), Math.max(by0, vy0), Math.min(bx1, vx1), Math.min(by1, vy1)); view.ctx.restore();
    }
  }


  // ---------------------------------------------------------------- circuit ribbon & curved corner kerbs
  function drawTrackRibbon() {
    if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
    const sub = LEVEL.subtrack;
    const pts = sub.pts;
    const n = pts.length;
    if (n < 3) return;
    const p = PPMz();
    const halfW = sub.width / 2;

    // 1. Continuous road ribbon with per-sector surface styling
    // Group contiguous segments into sector spans to fill as ONE solid polygon per sector,
    // which completely eliminates the transverse anti-aliasing seam lines across the road.
    // the surface id at a distance; 'ghost' on a point-to-point stage's invisible return segment (lab.js ghostSegment): never drawn
    const sidAt = (d) => { if (sub.ghost && d >= sub.ghost.d0 && d < sub.ghost.d1) return 'ghost'; const s = sub.sectorAt ? sub.sectorAt(d) : null; return (s && s.surface) ? s.surface.id : 'tarmac'; };
    const spans = [];
    let curSurface = null;
    let curStart = 0;
    for (let i = 0; i < n; i++) {
      const sId = sidAt(pts[i].dist);
      if (sId !== curSurface) {
        if (curSurface !== null) spans.push({ surface: curSurface, start: curStart, end: i });
        curSurface = sId;
        curStart = i;
      }
    }
    spans.push({ surface: curSurface, start: curStart, end: n });

    // Merge wrap-around span across start/finish line so there is no seam at index 0
    if (spans.length > 1 && spans[0].surface === spans[spans.length - 1].surface) {
      const last = spans.pop();
      spans[0].start = last.start - n;
    }

    // the exact point where the sector changes between samples i-1 and i (bisected on sectorAt, the physics' own rule)
    function sectorCut(i) {
      const a = pts[(((i - 1) % n) + n) % n], b = pts[((i % n) + n) % n];
      let d0 = a.dist, d1 = b.dist; if (d1 < d0) d1 += sub.totalDist;
      const idOf = (d) => sidAt(d % sub.totalDist);
      const ida = idOf(d0);
      let lo = 0, hi = 1;
      for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (idOf(d0 + (d1 - d0) * m) === ida) lo = m; else hi = m; }
      const t = (lo + hi) / 2;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx: a.nx, ny: a.ny };
    }
    for (const span of spans) {
      if (span.surface === 'ghost') continue;
      view.ctx.fillStyle = artBase(span.surface, COL.tarmac);
      // world bbox of this span, so its pattern is painted over THIS span only. MEASURED 2026-10-03: painting
      // each span across the whole view (relying on the clip) drew the screen once per span — Stock Car
      // fell to 10 fps at 4x CPU throttle.
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      for (let i = span.start; i <= span.end; i++) {
        const pt = pts[((i % n) + n) % n];
        bx0 = Math.min(bx0, pt.x - halfW); bx1 = Math.max(bx1, pt.x + halfW);
        by0 = Math.min(by0, pt.y - halfW); by1 = Math.max(by1, pt.y + halfW);
      }
      // the span's centreline: cut at the EXACT sector boundaries. MEASURED BUG, 2026-10-03 (tools/visualcheck.mjs):
      // spans ran to the first SAMPLE past the boundary, so every sector change was drawn up to ~3 m after the point
      // where the grip actually changes (the physics cuts at the exact track distance).
      const line = spans.length > 1 ? [sectorCut(span.start)] : [];
      for (let i = span.start; i < span.end; i++) line.push(pts[((i % n) + n) % n]);
      line.push(spans.length > 1 ? sectorCut(span.end) : pts[((span.end % n) + n) % n]);
      view.ctx.beginPath();
      // Outer left edge along the span
      for (let i = 0; i < line.length; i++) {
        const pt = line[i], lx = sx(pt.x + pt.nx * halfW), ly = sy(pt.y + pt.ny * halfW);
        if (i === 0) view.ctx.moveTo(lx, ly); else view.ctx.lineTo(lx, ly);
      }
      // Inner right edge along the span in reverse
      for (let i = line.length - 1; i >= 0; i--) {
        const pt = line[i];
        view.ctx.lineTo(sx(pt.x - pt.nx * halfW), sy(pt.y - pt.ny * halfW));
      }
      view.ctx.closePath();
      view.ctx.fill();
      // the surface's pattern, clipped to this span (2026-10-03 — the ribbon used to be flat colour)
      view.ctx.save();
      view.ctx.clip();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(span.surface, bx0, by0, bx1, by1);
      view.ctx.restore();
    }

    // 2. White outer boundary lines (continuous along tarmac/broken/racetarmac, omitted on dirt/mud/grass)
    view.ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    view.ctx.lineWidth = Math.max(1, 0.22 * p);
    view.ctx.beginPath();
    let leftDrawing = false;
    for (let i = 0; i <= n; i++) {
      const a = pts[i % n];
      const sec = sub.sectorAt ? sub.sectorAt(a.dist) : null;
      const sId = sec && sec.surface ? sec.surface.id : '';
      if (sId === 'dirt' || sId === 'mud' || sId === 'grass' || sId === 'grassShort' || sidAt(a.dist) === 'ghost' || sub.noLines) {
        leftDrawing = false;
        continue;
      }
      const lx = sx(a.x + a.nx * (halfW - 0.2)), ly = sy(a.y + a.ny * (halfW - 0.2));
      if (!leftDrawing) {
        view.ctx.moveTo(lx, ly);
        leftDrawing = true;
      } else {
        view.ctx.lineTo(lx, ly);
      }
    }
    view.ctx.stroke();

    view.ctx.beginPath();
    let rightDrawing = false;
    for (let i = 0; i <= n; i++) {
      const a = pts[i % n];
      const sec = sub.sectorAt ? sub.sectorAt(a.dist) : null;
      const sId = sec && sec.surface ? sec.surface.id : '';
      if (sId === 'dirt' || sId === 'mud' || sId === 'grass' || sId === 'grassShort' || sidAt(a.dist) === 'ghost' || sub.noLines) {
        rightDrawing = false;
        continue;
      }
      const rx = sx(a.x - a.nx * (halfW - 0.2)), ry = sy(a.y - a.ny * (halfW - 0.2));
      if (!rightDrawing) {
        view.ctx.moveTo(rx, ry);
        rightDrawing = true;
      } else {
        view.ctx.lineTo(rx, ry);
      }
    }
    view.ctx.stroke();

  }

  // LANE DASHES (the highway, sub.laneDash = lateral offsets): white dashes 3 m on / 6 m off, phased by the road's ABSOLUTE distance
  // (sub.sBase) so they line up across ground tiles painted before and after the road window moved
  function drawLaneDashes() {
    const sub = LEVEL.subtrack; if (!sub || !sub.laneDash) return;
    const pts = sub.pts, n = pts.length, p = PPMz(), gh = sub.ghost;
    view.ctx.save(); view.ctx.strokeStyle = 'rgba(245,245,240,0.8)'; view.ctx.lineWidth = Math.max(1, 0.15 * p); view.ctx.setLineDash([3 * p, 6 * p]); view.ctx.lineDashOffset = ((sub.sBase || 0) * p) % (9 * p);
    for (const off of sub.laneDash) { view.ctx.beginPath(); let on = false;
      for (let i = 0; i < n; i++) { const a = pts[i]; if (gh && a.dist >= gh.d0) break; const x = sx(a.x + a.nx * off), y = sy(a.y + a.ny * off); if (!on) { view.ctx.moveTo(x, y); on = true; } else view.ctx.lineTo(x, y); }
      view.ctx.stroke(); }
    view.ctx.setLineDash([]);
    // SOLID lines (sub.laneSolid, the highway's hard-shoulder line)
    for (const off of sub.laneSolid || []) { view.ctx.beginPath(); let on = false;
      for (let i = 0; i < n; i++) { const a = pts[i]; if (gh && a.dist >= gh.d0) break; const x = sx(a.x + a.nx * off), y = sy(a.y + a.ny * off); if (!on) { view.ctx.moveTo(x, y); on = true; } else view.ctx.lineTo(x, y); }
      view.ctx.stroke(); }
    view.ctx.restore();
  }
  // CURVED CORNER KERBS — split out of drawTrackRibbon 2026-10-03 and drawn AFTER patches, wear and covers
  // (user, with a screenshot of churned dirt and a grass patch painted over a kerb: "surfaces shouldn't cover
  // kerbs — kerbs should be their own surface, bumpy and slightly slippy like real race kerbs"). The physics
  // already treats them that way (SURFACES.kerb, mu 0.70, ridges in bumpAt); now nothing can paint over them.
  function drawCurvedKerbs() {
    if (!LEVEL.subtrack || !LEVEL.subtrack.pts) return;
    const sub = LEVEL.subtrack, pts = sub.pts, n = pts.length, p = PPMz(), halfW = sub.width / 2;
    if (sub.curvedKerbs) {
      for (const k of sub.curvedKerbs) {
        const sgn = k.side === 'left' ? 1 : -1;
        const kw = k.width || 2.4;
        const start = k.startDist, end = k.endDist;

        for (let i = 0; i < n; i++) {
          const a = pts[i];
          const b = pts[(i + 1) % n];
          if (a.dist < start || a.dist > end) continue;

          // Red and white kerb teeth alternating every 2.0 m along the corner
          const tooth = Math.floor(a.dist / 2.0) % 2;
          view.ctx.fillStyle = tooth ? COL.kerbB : COL.kerbA;

          const iaX = sx(a.x + sgn * a.nx * halfW), iaY = sy(a.y + sgn * a.ny * halfW);
          const ibX = sx(b.x + sgn * b.nx * halfW), ibY = sy(b.y + sgn * b.ny * halfW);
          const oaX = sx(a.x + sgn * a.nx * (halfW + kw)), oaY = sy(a.y + sgn * a.ny * (halfW + kw));
          const obX = sx(b.x + sgn * b.nx * (halfW + kw)), obY = sy(b.y + sgn * b.ny * (halfW + kw));

          view.ctx.beginPath();
          view.ctx.moveTo(iaX, iaY);
          view.ctx.lineTo(ibX, ibY);
          view.ctx.lineTo(obX, obY);
          view.ctx.lineTo(oaX, oaY);
          view.ctx.closePath();
          view.ctx.fill();

          // Outer highlight bevel along crest
          view.ctx.strokeStyle = 'rgba(255,255,255,0.40)';
          view.ctx.lineWidth = Math.max(1, 0.08 * p);
          view.ctx.beginPath();
          view.ctx.moveTo(oaX, oaY); view.ctx.lineTo(obX, obY);
          view.ctx.stroke();

          // Inner shadow joint along asphalt edge
          view.ctx.strokeStyle = 'rgba(0,0,0,0.22)';
          view.ctx.lineWidth = Math.max(1, 0.08 * p);
          view.ctx.beginPath();
          view.ctx.moveTo(iaX, iaY); view.ctx.lineTo(ibX, ibY);
          view.ctx.stroke();
        }
      }
    }
  }

  function drawPaint() {
    for (const p of PAINT) {
      view.ctx.strokeStyle = COL.paint;
      view.ctx.globalAlpha = p.tone;
      // MEASURED BUG, 2026-09-27 (photographed): this read p.w, which is the BOX WIDTH for a box —
      // so the 6 m start box stroked at 96 px thick and rendered as a pale slab the size of a building.
      // Ring stroke width is now "lw" and nothing else is overloaded.
      view.ctx.lineWidth = Math.max(1, (p.lw || 0.12) * PPMz());
      if (p.kind === 'ring') {
        view.ctx.beginPath();
        view.ctx.arc(sx(p.x), sy(p.y), p.r * PPMz(), 0, Math.PI * 2);
        view.ctx.stroke();
      } else if (p.kind === 'box' || p.kind === 'lane') {
        view.ctx.strokeRect(sx(p.x - p.w / 2), sy(p.y - p.h / 2), p.w * PPMz(), p.h * PPMz());
      } else if (p.kind === 'chequered') {
        const halfW = (p.wid || 13) / 2;
        const halfL = (p.len || 1.6) / 2;
        const cols = 2;
        const rows = 16;
        const rowH = (halfW * 2) / rows;

        view.ctx.save();
        view.ctx.translate(sx(p.x), sy(p.y));
        view.ctx.rotate(p.rot || 0);

        // Leading and trailing boundary lines
        view.ctx.fillStyle = '#ffffff';
        view.ctx.fillRect(-halfL * PPMz(), -halfW * PPMz(), halfL * 2 * PPMz(), Math.max(1, 0.12 * PPMz()));
        view.ctx.fillRect(-halfL * PPMz(), (halfW - 0.12) * PPMz(), halfL * 2 * PPMz(), Math.max(1, 0.12 * PPMz()));

        // Alternating black and white finish line squares
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const isWhite = (r + c) % 2 === 0;
            view.ctx.fillStyle = isWhite ? '#ffffff' : '#14161c';
            const sqX = (-halfL + c * (halfL * 2 / cols)) * PPMz();
            const sqY = (-halfW + r * rowH) * PPMz();
            const sqW = (halfL * 2 / cols) * PPMz();
            const sqH = rowH * PPMz();
            view.ctx.fillRect(sqX, sqY, sqW + 0.4, sqH + 0.4);
          }
        }
        view.ctx.restore();
      }
      view.ctx.globalAlpha = 1;
    }
    // distance boards down the braking straight
    view.ctx.fillStyle = COL.inkSoft;
    view.ctx.font = `600 ${Math.round(0.9 * PPMz())}px ui-sans-serif, system-ui, sans-serif`;
    view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
    for (const b of BOARDS) view.ctx.fillText(b.label, sx(b.x), sy(b.y));
  }

  // A4: the boundary is VISIBLE — and now it is three different things, so it has to READ as three
  // (CLAUDE.md §4: if the player cannot find it, it does not exist). From the inside out:
  //   the KERB, a raised rumble strip you ride over and can jump off,
  //   the RUN-OFF, gravel you can drive on badly,
  //   the FENCE, the only thing that actually stops you.
  // Each side is the same drawing rotated, so the whole edge is one function of a side index.
  //
  // `forSide(i, fn)` hands fn a frame where +v points OUTWARD from the floor and u runs along the edge,
  // which is what removes the four near-identical copies the old version had.
  // S-B (2026-10-06): the floor is a RECTANGLE (lab.js FX0..FX1 x FY0..FY1). The frame is centred on it, and fn gets (p, D, Lh): D = the
  // floor edge's distance from the centre on this side, Lh = half the edge's length (both FLOOR on a square: drawn exactly as before).
  // Inside fn the CAMERA is moved into the side's frame (and the view made square), so speckle's view culling - which compares with
  // cam - culls in the frame it draws in. (Before, the three rotated sides culled against the unrotated view: their grass / gravel grain
  // only drew when the camera was somewhere else.)
  function forSide(i, fn) {
    const cx = (FX0 + FX1) / 2, cy = (FY0 + FY1) / 2, D = i % 2 ? (FX1 - FX0) / 2 : (FY1 - FY0) / 2, Lh = i % 2 ? (FY1 - FY0) / 2 : (FX1 - FX0) / 2;
    const a = (i * Math.PI) / 2, co = Math.round(Math.cos(a)), si = Math.round(Math.sin(a));
    const keep = { x: cam.x, y: cam.y, W: view.W, H: view.H }, dx = cam.x - cx, dy = cam.y - cy;
    view.ctx.save();
    view.ctx.translate(sx(cx), sy(cy));
    view.ctx.rotate(a);
    cam.x = dx * co + dy * si; cam.y = -dx * si + dy * co; view.W = view.H = Math.max(view.W, view.H);
    try { fn(PPMz(), D, Lh); }
    finally { cam.x = keep.x; cam.y = keep.y; view.W = keep.W; view.H = keep.H; view.ctx.restore(); }
  }

  // GROUND TEXTURE. A fixed lattice (never an RNG — that crawls between frames), CULLED TO THE VIEW.
  //
  // MEASURED BUG, 2026-09-28 (photographed): this looped the whole 260 m quadrant, so it could only
  // afford ~3 m spacing and the result was a field of 1 m polka dots rather than ground. Culling to the
  // visible rectangle first makes the count depend on the SCREEN, not the world, so the grain can be as
  // fine as it needs to be and costs the same at any zoom. Squares, not arcs: at grain size they read
  // identically and they are far cheaper.
  const MARKS_MAX = 30000;      // most marks one pattern layer may place in one call (see speckle)
  function speckle(x0, y0, x1, y1, colour, spacing, size) {
    const p = PPMz();
    const px = Math.max(1, size * p);
    if (px < 1.1 && spacing * p < 3) return;      // too far out to resolve: skip it entirely
    // intersect the region with what is actually on screen, snapped to the lattice so the pattern is
    // world-locked and does not swim as the camera moves
    const vx0 = Math.max(x0, cam.x - view.W / 2 / p), vx1 = Math.min(x1, cam.x + view.W / 2 / p);
    const vy0 = Math.max(y0, cam.y - view.H / 2 / p), vy1 = Math.min(y1, cam.y + view.H / 2 / p);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    // MARK CAP (2026-10-03): the fly-in's whole-level overview asked one call for ~188,000 squares of grass grain
    // (1.1 s to record, 4.9 s to rasterise at 4x throttle). Any call that would place more than MARKS_MAX marks
    // thins its lattice to fit — invisible at the zoom where it happens, since that much grain is sub-pixel noise.
    const n0 = ((vx1 - vx0) / spacing) * ((vy1 - vy0) / spacing);
    if (n0 > MARKS_MAX) spacing *= Math.sqrt(n0 / MARKS_MAX);
    const ax = Math.floor(vx0 / spacing) * spacing, ay = Math.floor(vy0 / spacing) * spacing;
    view.ctx.fillStyle = colour;
    for (let u = ax; u < vx1; u += spacing) {
      for (let v = ay; v < vy1; v += spacing) {
        // deterministic scatter from the world position, so a speck belongs to the GROUND
        const h = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453;
        const jx = (h - Math.floor(h)) - 0.5;
        const h2 = Math.sin(u * 39.3468 + v * 11.135) * 24634.6345;
        const jy = (h2 - Math.floor(h2)) - 0.5;
        view.ctx.fillRect((u + jx * spacing) * p, (v + jy * spacing) * p, px, px);
      }
    }
  }

  // ---------------------------------------------------------------- SURFACE PAINTER (2026-10-03)
  // User: "All surfaces should have unique and noticeable graphics so we can easily and instantly tell
  // them apart." PHOTOGRAPHED BEFORE: every surface was a base colour plus the same square speckle, so
  // grass/short grass, tarmac/race tarmac, wet/broken, sand/gravel and mud/dirt read as pairs. Colour
  // alone does not survive a glance at speed; SHAPE does. So each surface now gets its own pattern
  // vocabulary — stripes, blades, stones, ripples, glossy blobs, cracks, sheen — on top of its colour.
  //
  // Every primitive below shares the speckle rules: a FIXED world lattice (never an RNG, or it crawls),
  // CULLED to the view so cost depends on the screen not the world, skipped entirely when the feature
  // would be under ~1 px, and BATCHED into one path per layer (one fill/stroke call, not one per mark).
  // Callers have translated the context to the world origin, so coordinates are world metres * p.
  function lattice(x0, y0, x1, y1, spacing, prob, fn) {
    const p = PPMz();
    const vx0 = Math.max(x0, cam.x - view.W / 2 / p - spacing), vx1 = Math.min(x1, cam.x + view.W / 2 / p + spacing);
    const vy0 = Math.max(y0, cam.y - view.H / 2 / p - spacing), vy1 = Math.min(y1, cam.y + view.H / 2 / p + spacing);
    if (vx1 <= vx0 || vy1 <= vy0) return;
    const n0 = ((vx1 - vx0) / spacing) * ((vy1 - vy0) / spacing) * prob;
    if (n0 > MARKS_MAX) spacing *= Math.sqrt(n0 / MARKS_MAX);      // the same MARK CAP as speckle
    const ax = Math.floor(vx0 / spacing) * spacing, ay = Math.floor(vy0 / spacing) * spacing;
    for (let u = ax; u < vx1; u += spacing) {
      for (let v = ay; v < vy1; v += spacing) {
        const h1 = Math.sin(u * 12.9898 + v * 78.233) * 43758.5453, a = h1 - Math.floor(h1);
        const h2 = Math.sin(u * 39.3468 + v * 11.135) * 24634.6345, b = h2 - Math.floor(h2);
        const h3 = Math.sin(u * 7.1231 + v * 51.719) * 15731.743, c = h3 - Math.floor(h3);
        if (c > prob) continue;
        fn((u + (a - 0.5) * spacing) * p, (v + (b - 0.5) * spacing) * p, a, b, c, p);
      }
    }
  }
  // the layer kinds. [kind, colour, ...numbers in metres]
  const PRIM = {
    // fine square grain — aggregate, grit, sparkle
    grain(L, x0, y0, x1, y1) { speckle(x0, y0, x1, y1, L[1], L[2], L[3]); },
    // round stones, radius rMin..rMax — gravel, dirt pebbles
    stones(L, x0, y0, x1, y1) {
      const [, col, sp, rMin, rMax, prob = 1] = L, p = PPMz();
      if (rMax * p < 0.8 || sp * p < 2.5) return;
      view.ctx.fillStyle = col; view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a) => {
        const r = (rMin + (rMax - rMin) * a) * p;
        if (PIXEL) { view.ctx.rect(x - r, y - r, r * 2, r * 2); return; }      // square stones in pixel art
        view.ctx.moveTo(x + r, y); view.ctx.arc(x, y, r, 0, Math.PI * 2);
      });
      view.ctx.fill();
    },
    // grass blades — a little V tuft per lattice point
    blades(L, x0, y0, x1, y1) {
      const [, col, sp, len, wid, prob = 1] = L, p = PPMz();
      if (len * p < 2 || sp * p < 2.5) return;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.lineCap = 'round'; view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a, b) => {
        const l = len * p * (0.7 + 0.6 * b), t = (a - 0.5) * 0.9;
        view.ctx.moveTo(x, y); view.ctx.lineTo(x + Math.sin(t - 0.35) * l, y - Math.cos(t - 0.35) * l);
        view.ctx.moveTo(x, y); view.ctx.lineTo(x + Math.sin(t + 0.35) * l, y - Math.cos(t + 0.35) * l);
      });
      view.ctx.stroke(); view.ctx.lineCap = 'butt';
    },
    // mown stripes: alternate bands along world y, `band` metres wide
    stripes(L, x0, y0, x1, y1) {
      const [, col, band] = L, p = PPMz();
      const vx0 = Math.max(x0, cam.x - view.W / 2 / p), vx1 = Math.min(x1, cam.x + view.W / 2 / p);
      const vy0 = Math.max(y0, cam.y - view.H / 2 / p), vy1 = Math.min(y1, cam.y + view.H / 2 / p);
      if (vx1 <= vx0 || vy1 <= vy0) return;
      view.ctx.fillStyle = col;
      for (let k = Math.floor(vy0 / band); k * band < vy1; k++) {
        if (k & 1) continue;
        view.ctx.fillRect(vx0 * p, k * band * p, (vx1 - vx0) * p, band * p);
      }
    },
    // wavy lines — wind ripples in sand, ridges in thick mud
    ripples(L, x0, y0, x1, y1) {
      const [, col, sp, amp, wave, wid] = L, p = PPMz();
      if (sp * p < 4) return;
      const vx0 = Math.max(x0, cam.x - view.W / 2 / p), vx1 = Math.min(x1, cam.x + view.W / 2 / p);
      const vy0 = Math.max(y0, cam.y - view.H / 2 / p - amp), vy1 = Math.min(y1, cam.y + view.H / 2 / p + amp);
      if (vx1 <= vx0 || vy1 <= vy0) return;
      const step = wave / 6;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      for (let k = Math.floor(vy0 / sp); k * sp < vy1; k++) {
        const ph = Math.sin(k * 12.9898) * 437.5;
        for (let x = Math.floor(vx0 / step) * step, first = true; x <= vx1 + step; x += step, first = false) {
          const y = k * sp + amp * Math.sin((x / wave) * Math.PI * 2 + ph);
          if (first) view.ctx.moveTo(x * p, y * p); else view.ctx.lineTo(x * p, y * p);
        }
      }
      view.ctx.stroke();
    },
    // soft ellipses — puddles, mud pools, glossy highlights, drift shadows, repair patches
    blobs(L, x0, y0, x1, y1) {
      const [, col, sp, rx, ry, prob = 1, spin = 1] = L, p = PPMz();
      if (ry * p < 0.8 || sp * p < 3) return;
      view.ctx.fillStyle = col; view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a, b) => {
        const s = 0.7 + 0.6 * b, rot = (a - 0.5) * Math.PI * spin;
        if (PIXEL) { const ww = rx * s * p, hh = ry * s * p; view.ctx.rect(x - ww, y - hh, ww * 2, hh * 2); return; }   // square blobs in pixel art
        view.ctx.moveTo(x + Math.cos(rot) * rx * s * p, y + Math.sin(rot) * rx * s * p);
        view.ctx.ellipse(x, y, rx * s * p, ry * s * p, rot, 0, Math.PI * 2);
      });
      view.ctx.fill();
    },
    // thin rings — rain ripples on standing water
    rings(L, x0, y0, x1, y1) {
      const [, col, sp, r, wid, prob = 1] = L, p = PPMz();
      if (r * p < 2 || sp * p < 4) return;
      if (PIXEL) return;     // as hollow squares they read as UI glitches (photographed on the wet pad) — sheen + puddles carry it
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a) => {
        const rr = r * (0.6 + 0.8 * a) * p;
        if (PIXEL) { view.ctx.rect(x - rr, y - rr, rr * 2, rr * 2); return; }   // square ripples in pixel art
        view.ctx.moveTo(x + rr, y); view.ctx.arc(x, y, rr, 0, Math.PI * 2);
      });
      view.ctx.stroke();
    },
    // jagged cracks with a side branch — ice, broken tarmac
    cracks(L, x0, y0, x1, y1) {
      const [, col, sp, len, wid, prob = 1] = L, p = PPMz();
      if (len * p < 4 || sp * p < 4) return;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      lattice(x0, y0, x1, y1, sp, prob, (x, y, a, b, c) => {
        let ang = a * Math.PI * 2, px = x, py = y;
        view.ctx.moveTo(px, py);
        for (let s = 0; s < 4; s++) {
          ang += ((s % 2 ? b : c) - 0.5) * 1.4;
          px += Math.cos(ang) * len * 0.3 * p; py += Math.sin(ang) * len * 0.3 * p;
          view.ctx.lineTo(px, py);
          if (s === 1) { view.ctx.lineTo(px + Math.cos(ang + 1.1) * len * 0.25 * p, py + Math.sin(ang + 1.1) * len * 0.25 * p); view.ctx.moveTo(px, py); }
        }
      });
      view.ctx.stroke();
    },
    // long diagonal sheen bands — polish on ice, reflection on standing water
    sheen(L, x0, y0, x1, y1) {
      const [, col, sp, wid, slope] = L, p = PPMz();
      // extended past the view by a band's width: a square-cut diagonal band ending exactly at a TILE edge
      // left a visible notch at every tile seam (photographed 2026-10-03 on the lab ice sheet)
      const vx0 = Math.max(x0, cam.x - view.W / 2 / p - wid * 2), vx1 = Math.min(x1, cam.x + view.W / 2 / p + wid * 2);
      const vy0 = Math.max(y0, cam.y - view.H / 2 / p), vy1 = Math.min(y1, cam.y + view.H / 2 / p);
      if (vx1 <= vx0 || vy1 <= vy0) return;
      view.ctx.strokeStyle = col; view.ctx.lineWidth = Math.max(1, wid * p); view.ctx.beginPath();
      const kA = (vy0 - slope * Math.max(vx0, vx1)) / sp, kB = (vy1 - slope * Math.min(vx0, vx1)) / sp;
      for (let k = Math.floor(Math.min(kA, kB)); k <= Math.ceil(Math.max(kA, kB)); k++) {
        view.ctx.moveTo(vx0 * p, (k * sp + slope * vx0) * p); view.ctx.lineTo(vx1 * p, (k * sp + slope * vx1) * p);
      }
      view.ctx.stroke();
    },
  };

  // HOW EACH SURFACE IS PAINTED: a base colour, then layers drawn in order. One table — a new surface is a
  // row here and a row in lab.js (SURFACES) and nothing else. Read by drawFloor, drawZones,
  // drawTrackRibbon and drawWear, so a surface looks the same wherever it appears. Each surface has a
  // SIGNATURE SHAPE so no two are told apart by colour alone:
  //   tarmac — fine light aggregate        race tarmac — smooth, dark, long rubber streaks
  //   broken — pale, cracked, dark patches dirt — warm brown, pale pebbles
  //   mud — dark wet pools + gloss         thick mud — near-black, ridged ruts + gloss
  //   gravel — dense round stones          sand — pale yellow, wind ripples
  //   grass / short grass — mown stripes   long grass — dark, blade tufts
  //   snow — white, blue drift shadows     ice — blue, polish sheen + white cracks
  //   wet — dark, puddles, reflections, rain rings
  const SURFACE_ART = {
    lab: null,                                   // the lab surface IS the floor colour already
    tarmac: { base: '#3a3c46', layers: [['grain', '#5a5d6a', 0.9, 0.09], ['grain', '#2b2d35', 1.7, 0.12]] },
    racetarmac: { base: '#2a2d36', layers: [['blobs', 'rgba(16,17,22,0.55)', 3.2, 1.6, 0.10, 0.6, 0.08]] },
    // circles (repair patches) removed 2026-10-03 — user: "the circles on broken concrete look weird, just keep the cracks"
    broken: { base: '#8e9099', layers: [['cracks', '#4a4b54', 2.2, 1.7, 0.07], ['grain', '#a3a5ad', 1.0, 0.10]] },
    concrete: { base: '#a9a7a0', layers: [['grain', '#bdbbb4', 0.8, 0.10], ['cracks', '#8c8a83', 6.0, 3.0, 0.05]] },   // pale slabs, faint joints
    dirt: { base: '#8a6e50', layers: [['grain', '#74593d', 0.7, 0.12], ['stones', '#b59672', 1.5, 0.06, 0.13], ['grain', '#5d4329', 2.2, 0.22]] },
    mud: { base: '#5a4231', layers: [['blobs', '#3f2d20', 2.2, 0.95, 0.70, 0.6, 0.25], ['blobs', 'rgba(255,238,215,0.20)', 1.9, 0.30, 0.08, 0.45, 0.25], ['grain', '#4a3626', 0.9, 0.12]] },
    thickMud: { base: '#3a291d', layers: [['ripples', '#24180f', 0.9, 0.16, 3.0, 0.20], ['blobs', 'rgba(255,238,215,0.30)', 1.3, 0.30, 0.08, 0.6]] },
    gravel: { base: '#a99c84', layers: [['stones', '#d4cab5', 0.75, 0.05, 0.11], ['stones', '#7d725d', 0.85, 0.05, 0.10]] },
    // sand REDONE 2026-10-03 (user: "I don't love how sand looks") — the bold squiggles read as cartoon.
    // Now fine two-tone grains with faint, long, soft wind ripples.
    sand: { base: '#e0c994', layers: [['ripples', 'rgba(176,146,92,0.30)', 0.85, 0.10, 3.6, 0.07], ['grain', '#c9ad74', 0.5, 0.06], ['grain', '#f3e5bf', 0.62, 0.06]] },
    grass: { base: '#7e9c5e', layers: [['stripes', '#89a868', 4], ['grain', '#6a8850', 1.2, 0.18]] },
    grassShort: { base: '#7e9c5e', layers: [['stripes', '#89a868', 4], ['grain', '#6a8850', 1.2, 0.18]] },
    grassLong: { base: '#4d6b33', layers: [['blades', '#6f904a', 0.5, 0.42, 0.07], ['blades', '#3a5226', 0.62, 0.48, 0.07]] },
    // (field looks: added below SURFACE_ART - the grass / long grass / mud textures recoloured, highway.js FIELD_SURF)
    snow: { base: '#f3f7fb', layers: [['blobs', 'rgba(140,170,210,0.20)', 3.0, 1.9, 0.5, 0.6, 0.15], ['grain', '#ffffff', 0.9, 0.12]] },
    packedSnow: { base: '#c4cfda', layers: [['blobs', 'rgba(96,118,150,0.22)', 2.6, 1.3, 0.4, 0.6, 0.15], ['grain', '#e9eff5', 0.8, 0.14], ['grain', '#9fb0c2', 1.6, 0.10]] },
    ice: { base: '#b9daee', layers: [['sheen', 'rgba(255,255,255,0.32)', 4.5, 0.55, 0.5], ['cracks', 'rgba(255,255,255,0.80)', 3.6, 1.7, 0.05]] },
    // wet tarmac REDONE 2026-10-03 (user: "I don't love how wet tarmac looks") — the blue blobs read as
    // paint. Real wet asphalt is DARKER tarmac with its aggregate still showing, broad soft reflections and
    // dark glossy standing water in the low spots.
    // + BLUE-ISH PUDDLES (user, 2026-10-03: "wet tarmac isn't clear enough, maybe needs blue-ish puddles")
    wet: { base: '#2c3039', layers: [['grain', '#454a57', 0.9, 0.08], ['blobs', 'rgba(86,120,176,0.55)', 4.2, 1.6, 0.8, 0.55, 0.2], ['sheen', 'rgba(205,218,238,0.10)', 6.0, 1.6, -0.35], ['sheen', 'rgba(230,238,250,0.16)', 6.0, 0.18, -0.35], ['rings', 'rgba(200,220,250,0.35)', 4.6, 0.35, 0.03, 0.4]] },
  };
  // FIELD LOOKS (highway.js fields, zone.art; the zone DRIVES as its own surface). User, 2026-10-06: "jsut reuse mud and grass or long
  // grass textures for field, and maybe colour them" - so each is an existing texture with only its COLOURS swapped (same layers).
  const recolour = (id, base, cols) => ({ base, layers: SURFACE_ART[id].layers.map((L, k) => [L[0], cols[k] || L[1], ...L.slice(2)]) });
  SURFACE_ART.wheat = recolour('grassLong', '#bf9f4e', ['#dcc074', '#9c7f38']);      // long grass, ripe gold
  SURFACE_ART.rapeseed = recolour('grassLong', '#c9b02a', ['#ecd84a', '#8f9a2e']);   // long grass, yellow flower over green
  SURFACE_ART.pastureG = recolour('grass', '#86a35c', ['#92b068', '#6f8c4c']);       // grass, a fresher green than the verge
  SURFACE_ART.plough = recolour('mud', '#6a4c34', ['#4e3624', 'rgba(255,238,215,0.14)', '#5a412c']);   // mud, a lighter turned-earth brown
  SURFACE_ART.hedgerow = recolour('grassLong', '#3c5a28', ['#5a7c3a', '#2c4220']);   // the long-grass BORDER round each field, darker
  // Paint one surface's layers over a region. The caller has set any clip and translated to the world
  // origin; this only adds the pattern (the caller fills the base colour, since it knows the shape).
  function paintLayers(id, x0, y0, x1, y1) {
    if (view.noPatterns) return;
    const art = SURFACE_ART[id];
    if (!art) return;
    for (const L of art.layers) PRIM[L[0]](L, x0, y0, x1, y1);
  }
  const artBase = (id, fallback) => (SURFACE_ART[id] ? SURFACE_ART[id].base : fallback);

  // EVERY PATCH OF SURFACE, from the same ZONES list the physics reads — so what you see is by
  // construction what you drive on, with no second copy of the layout to drift out of step. (That drift
  // is exactly the bug that cost me an afternoon in the ground sampling earlier today.)
  //
  // Drawn back to front, so the first-hit-wins order in lab.js is honoured visually too: a panel laid
  // ON a quadrant is listed first and must therefore be painted LAST.
  function drawZones() {
    const p = PPMz();
    for (let i = ZONES.length - 1; i >= 0; i--) {
      const q = ZONES[i];
      const aid = q.art || q.surface.id, art = SURFACE_ART[aid];   // q.art: drawn as another look (a wheat field drives as long grass)
      if (!art) continue;
      const x0 = q.x - q.w / 2, y0 = q.y - q.h / 2;
      // off screen? On the ROTATED footprint. MEASURED BUG (user, 2026-10-04: "the old runway bugs in and out of existence"): this
      // tested the unrotated w x h box, so a long thin rotated runway (432 x 22 m at -22 deg) was skipped by every ground tile more
      // than 11 m from its centre line — painted in some tiles, missing in others, changing as tiles reloaded.
      const ca = Math.abs(Math.cos(q.rot || 0)), sa = Math.abs(Math.sin(q.rot || 0));
      const ex = (q.w / 2) * ca + (q.h / 2) * sa, ey = (q.w / 2) * sa + (q.h / 2) * ca;
      if (sx(q.x - ex) > view.W || sx(q.x + ex) < 0 || sy(q.y - ey) > view.H || sy(q.y + ey) < 0) continue;

      if (q.rounded) {
        const rad = Math.min(5 * p, q.w * p * 0.15);
        // Outer asphalt perimeter apron
        view.ctx.fillStyle = COL.tarmac;
        view.ctx.beginPath();
        // the apron is PHYSICAL tarmac (lab.js PAD_APRON, zoneAt) — change the two together
        roundRect(view.ctx, sx(x0 - 1.2), sy(y0 - 1.2), (q.w + 2.4) * p, (q.h + 2.4) * p, rad + 1.2 * p);
        view.ctx.fill();

        view.ctx.save();
        view.ctx.beginPath();
        roundRect(view.ctx, sx(x0), sy(y0), q.w * p, q.h * p, rad);
        view.ctx.fillStyle = art.base;
        view.ctx.fill();
        view.ctx.clip();
        view.ctx.translate(sx(0), sy(0));
        paintLayers(q.surface.id, x0, y0, x0 + q.w, y0 + q.h);
        view.ctx.restore();

        view.ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        view.ctx.lineWidth = Math.max(1, 0.20 * p);
        view.ctx.beginPath();
        roundRect(view.ctx, sx(x0), sy(y0), q.w * p, q.h * p, rad);
        view.ctx.stroke();

        const fs = 3.2 * p;
        if (fs > 7) {
          view.ctx.font = `700 ${Math.round(fs)}px ui-sans-serif, system-ui, sans-serif`;
          view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
          view.ctx.fillStyle = 'rgba(255,255,255,0.75)';
          view.ctx.fillText(q.surface.label, sx(q.x), sy(y0 + 4.5));
        }
        continue;
      }

      if (q.rot) {
        // ROTATED zone: clip in the zone's frame, then step back to the world frame (the clip stays) and paint the texture
        // over the zone's bounding box, so it lines up with the ground exactly where zoneAt says the surface is.
        const r = Math.hypot(q.w, q.h) / 2;
        if (sx(q.x + r) < 0 || sx(q.x - r) > view.W || sy(q.y + r) < 0 || sy(q.y - r) > view.H) continue;
        view.ctx.save();
        view.ctx.translate(sx(q.x), sy(q.y)); view.ctx.rotate(q.rot);
        view.ctx.beginPath(); view.ctx.rect((-q.w / 2) * p, (-q.h / 2) * p, q.w * p, q.h * p);
        view.ctx.fillStyle = art.base; view.ctx.fill(); view.ctx.clip();
        view.ctx.rotate(-q.rot); view.ctx.translate(-sx(q.x), -sy(q.y));
        view.ctx.translate(sx(0), sy(0));
        // only the part IN VIEW (in a tile: the tile). MEASURED 2026-10-04: once the culling fix let the 432 m runway into every tile
        // it crosses, each tile repainted its whole 430 m square of texture — ground tile 22 -> 26 ms, slow frames 71 -> ~90.
        const vx0 = cam.x - view.W / 2 / p, vy0 = cam.y - view.H / 2 / p;
        paintLayers(aid, Math.max(q.x - r, vx0), Math.max(q.y - r, vy0), Math.min(q.x + r, vx0 + view.W / p), Math.min(q.y + r, vy0 + view.H / p));
        view.ctx.restore();
        continue;
      }
      view.ctx.save();
      view.ctx.beginPath();
      view.ctx.rect(sx(x0), sy(y0), q.w * p, q.h * p);
      view.ctx.fillStyle = art.base;
      view.ctx.fill();
      view.ctx.clip();       // so the texture cannot spill outside the region the physics uses
      view.ctx.translate(sx(0), sy(0));
      paintLayers(q.surface.id, x0, y0, x0 + q.w, y0 + q.h);
      view.ctx.restore();
      // `boxed` marks a deliberate TEST PANEL: give it a rim and paint its FULL NAME on.
      if (q.boxed) {
        view.ctx.strokeStyle = 'rgba(40,42,50,0.35)';
        view.ctx.lineWidth = Math.max(1, 0.25 * p);
        view.ctx.strokeRect(sx(x0), sy(y0), q.w * p, q.h * p);
        const fs = 3.4 * p;
        if (fs > 7) {
          view.ctx.font = `700 ${Math.round(fs)}px ui-sans-serif, system-ui, sans-serif`;
          view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
          view.ctx.fillStyle = 'rgba(30,32,40,0.32)';
          view.ctx.fillText(q.surface.label, sx(q.x), sy(y0 + 5.5));
        }
      }
    }
    // A soft seam where the quarters meet, so the join reads as a real transition and not a UI edge.
    if (LEVEL.seams) {
      view.ctx.strokeStyle = 'rgba(80,80,92,0.20)';
      view.ctx.lineWidth = Math.max(1, 0.3 * p);
      view.ctx.beginPath();
      // the old square's quarters only (S-B: the lab's extension south of FLOOR is one floor, no quarter seam)
      view.ctx.moveTo(sx(-FLOOR), sy(0)); view.ctx.lineTo(sx(FLOOR), sy(0));
      view.ctx.moveTo(sx(0), sy(-FLOOR)); view.ctx.lineTo(sx(0), sy(FLOOR));
      view.ctx.stroke();
    }
  }

  // COVERS (2026-10-03) — snow, ice and puddles lying ON any surface (LEVEL.covers, lab.js). Static, so
  // they are painted into the ground tiles. Snow and ice are opaque and use their own SURFACE_ART; a puddle
  // is TRANSLUCENT water over whatever is under it, so you can see it is a puddle on grass, on dirt or on
  // tarmac. When wear changes a cell under a cover (snow packed to ice, ice scrubbed through), drawWear
  // paints that cell's new state over this.
  // PIXEL mode: a cover is drawn as the 0.5 m world-grid squares whose centre is inside it (the same inside test as
  // lab.js coverAt), cached per cover — squares, not ovals (user, pixel pass: "no circles"). Physics keeps the exact
  // shape; the drawn edge is within ~0.35 m of it, the same as the square blend patches. `rim` = squares with an
  // outside neighbour, filled as the edge line (stroking the squares would outline every one of them).
  function coverCells(c) {
    if (c._cells) return c._cells;
    const G = 0.5, co = Math.cos(c.rot || 0), si = Math.sin(c.rot || 0), hx = c.w / 2, hy = c.h / 2;
    // scan the ROTATED box's extents, not a square of the long side (a 160 x 14 m river was a 160 m square: 100k tests -> ~10k)
    const RX = hx * Math.abs(co) + hy * Math.abs(si) + G, RY = hx * Math.abs(si) + hy * Math.abs(co) + G;
    const inside = (x, y) => {
      if (c.cut && coverCut(c, x, y)) return false;   // the river's dry band under the motorway (lab.js coverAt)
      const ex = x - c.x, ey = y - c.y, dx = ex * co + ey * si, dy = -ex * si + ey * co;
      return c.shape === 'ellipse' ? (dx * dx) / (hx * hx) + (dy * dy) / (hy * hy) <= 1 : Math.abs(dx) <= hx && Math.abs(dy) <= hy;
    };
    const all = [], rim = [];
    for (let x = Math.floor((c.x - RX) / G) * G; x < c.x + RX; x += G) for (let y = Math.floor((c.y - RY) / G) * G; y < c.y + RY; y += G) {
      const mx = x + G / 2, my = y + G / 2;
      if (!inside(mx, my)) continue;
      all.push(x, y);
      if (!inside(mx + G, my) || !inside(mx - G, my) || !inside(mx, my + G) || !inside(mx, my - G)) rim.push(x, y);
    }
    return (c._cells = { all, rim, G });
  }
  function cellsPath(list, G) {
    const p = PPMz(); view.ctx.beginPath();
    for (let i = 0; i < list.length; i += 2) view.ctx.rect(sx(list[i]), sy(list[i + 1]), G * p, G * p);
  }
  function coverPath(c) {
    if (PIXEL) { const k = coverCells(c); cellsPath(k.all, k.G); return; }
    const p = PPMz();
    view.ctx.beginPath();
    if (c.shape === 'ellipse') view.ctx.ellipse(sx(c.x), sy(c.y), (c.w / 2) * p, (c.h / 2) * p, c.rot || 0, 0, Math.PI * 2);
    else { view.ctx.save(); view.ctx.translate(sx(c.x), sy(c.y)); view.ctx.rotate(c.rot || 0); view.ctx.rect((-c.w / 2) * p, (-c.h / 2) * p, c.w * p, c.h * p); view.ctx.restore(); }
  }
  const PUDDLE_TINT = {
    dirt: 'rgba(86,64,42,0.62)', mud: 'rgba(62,46,32,0.66)', thickMud: 'rgba(46,34,24,0.70)',
    sand: 'rgba(150,128,90,0.55)', gravel: 'rgba(96,90,78,0.58)',
    // on hard ground, water is a dark mirror, not blue (user, 2026-10-03: puddles on tarmac looked wrong)
    tarmac: 'rgba(16,19,26,0.62)', racetarmac: 'rgba(12,14,20,0.62)', broken: 'rgba(30,33,42,0.60)', lab: 'rgba(120,128,142,0.45)',
    // water on grass reads BLUE (it vanished into the grass as dark green — photographed 2026-10-03)
    grass: 'rgba(74,104,150,0.62)', grassShort: 'rgba(74,104,150,0.62)', grassLong: 'rgba(66,96,140,0.64)',
  };
  // RANDOM PATCHES (Grass Track, re-rolled every load — lab.js randomiseGrassTrack): small ellipses of another
  // base surface, drawn with that surface's own SURFACE_ART so a mud spot looks like mud.
  function drawPatches() {
    const list = LEVEL.allPatches || LEVEL.patches;     // random spots + blend patches (lab.js prepareLevel)
    if (!list || !list.length) return;
    const p = PPMz();
    for (const c of list) {
      const r = Math.max(c.w, c.h) / 2;
      if (sx(c.x + r) < 0 || sx(c.x - r) > view.W || sy(c.y + r) < 0 || sy(c.y - r) > view.H) continue;
      view.ctx.save();
      view.ctx.beginPath();
      if (c.sq) view.ctx.rect(sx(c.x - c.w / 2), sy(c.y - c.h / 2), c.w * p, c.h * p);
      else view.ctx.ellipse(sx(c.x), sy(c.y), (c.w / 2) * p, (c.h / 2) * p, c.rot || 0, 0, Math.PI * 2);
      view.ctx.fillStyle = artBase(c.surface.id, '#6b5644');
      view.ctx.fill();
      view.ctx.clip();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(c.surface.id, c.x - r, c.y - r, c.x + r, c.y + r);
      view.ctx.restore();
    }
  }
  // MERGED COVERS (user, 2026-10-04: "puddles, streams or bodies of water should CONNECT together if touching"). Each cover used to be
  // drawn on its own — its own translucent fill and dark rim — so overlapping puddles darkened twice and showed rims inside each other:
  // a stream read as a string of beads. Now, per cover KIND, the union of every cover's 0.5 m cells (the same cells coverAt answers
  // for, so it still matches the physics); each tint fills once, the pattern is clipped to the union, one rim round the outside.
  function mergedCovers(list) {
    if (LEVEL._mergedOf === list) return LEVEL._merged;
    const G = 0.5, kinds = new Map();
    for (const c of list) {
      let m = kinds.get(c.cover); if (!m) kinds.set(c.cover, (m = new Map()));
      const k = coverCells(c);
      const tint = c.cover === 'wet' ? (PUDDLE_TINT[(groundAt(c.x, c.y).surface.under) || 'tarmac'] || 'rgba(52,66,92,0.58)') : null;
      for (let i = 0; i < k.all.length; i += 2) { const gx = Math.round(k.all[i] / G), gy = Math.round(k.all[i + 1] / G), key = gx * 131071 + gy; if (!m.has(key)) m.set(key, { x: k.all[i], y: k.all[i + 1], gx, gy, tint }); }
    }
    const out = [];
    for (const [kind, m] of kinds) {
      const cells = [...m.values()], rim = [];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const c of cells) {
        if (!m.has((c.gx + 1) * 131071 + c.gy) || !m.has((c.gx - 1) * 131071 + c.gy) || !m.has(c.gx * 131071 + c.gy + 1) || !m.has(c.gx * 131071 + c.gy - 1)) rim.push(c);
        x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + G); y1 = Math.max(y1, c.y + G);
      }
      out.push({ kind, cells, rim, bb: [x0, y0, x1, y1], G });
    }
    LEVEL._mergedOf = list; LEVEL._merged = out;
    return out;
  }
  function drawCoversMerged(list) {
    const p = PPMz(), vx0 = cam.x - view.W / 2 / p, vx1 = cam.x + view.W / 2 / p, vy0 = cam.y - view.H / 2 / p, vy1 = cam.y + view.H / 2 / p;
    for (const grp of mergedCovers(list)) {
      const [x0, y0, x1, y1] = grp.bb, G = grp.G;
      if (x1 < vx0 || x0 > vx1 || y1 < vy0 || y0 > vy1) continue;
      const vis = grp.cells.filter((c) => c.x + G >= vx0 && c.x <= vx1 && c.y + G >= vy0 && c.y <= vy1);
      if (!vis.length) continue;
      const path = (cells) => { view.ctx.beginPath(); for (const c of cells) view.ctx.rect(sx(c.x), sy(c.y), G * p, G * p); };
      const bx0 = Math.max(x0, vx0), by0 = Math.max(y0, vy0), bx1 = Math.min(x1, vx1), by1 = Math.min(y1, vy1);
      if (grp.kind === 'wet') {
        const byTint = new Map(); for (const c of vis) { let a = byTint.get(c.tint); if (!a) byTint.set(c.tint, (a = [])); a.push(c); }
        for (const [tint, cells] of byTint) { path(cells); view.ctx.fillStyle = tint; view.ctx.fill(); }
        view.ctx.save(); path(vis); view.ctx.clip(); view.ctx.translate(sx(0), sy(0));
        PRIM.sheen(['sheen', 'rgba(215,228,248,0.09)', 4.0, 0.9, -0.45], bx0, by0, bx1, by1);
        PRIM.sheen(['sheen', 'rgba(235,242,252,0.18)', 4.0, 0.10, -0.45], bx0, by0, bx1, by1);
        PRIM.rings(['rings', 'rgba(220,232,250,0.30)', 2.8, 0.30, 0.03, 0.45], bx0, by0, bx1, by1);
        view.ctx.restore();
        path(grp.rim.filter((c) => c.x + G >= vx0 && c.x <= vx1 && c.y + G >= vy0 && c.y <= vy1)); view.ctx.fillStyle = 'rgba(30,40,58,0.30)'; view.ctx.fill();
      } else {
        path(vis); view.ctx.fillStyle = artBase(grp.kind, '#ffffff'); view.ctx.fill();
        view.ctx.save(); view.ctx.clip(); view.ctx.translate(sx(0), sy(0)); paintLayers(grp.kind, bx0, by0, bx1, by1); view.ctx.restore();
        path(grp.rim.filter((c) => c.x + G >= vx0 && c.x <= vx1 && c.y + G >= vy0 && c.y <= vy1));
        view.ctx.fillStyle = grp.kind === 'snow' ? 'rgba(160,180,205,0.55)' : 'rgba(255,255,255,0.55)'; view.ctx.fill();
      }
    }
  }
  function drawCovers() {
    const list = LEVEL.covers;
    if (!list) return;
    if (PIXEL) { drawCoversMerged(list); return; }
    const p = PPMz();
    for (const c of list) {
      const r = Math.max(c.w, c.h) / 2;
      if (sx(c.x + r) < 0 || sx(c.x - r) > view.W || sy(c.y + r) < 0 || sy(c.y - r) > view.H) continue;
      coverPath(c);
      view.ctx.save();
      if (c.cover === 'wet') {
        // water takes the colour of what it lies in: brown in dirt and mud, so it reads as part of them
        const under = (groundAt(c.x, c.y).surface.under) || 'tarmac';
        view.ctx.fillStyle = PUDDLE_TINT[under] || 'rgba(52,66,92,0.58)';
        view.ctx.fill();
        view.ctx.clip();
        view.ctx.translate(sx(0), sy(0));
        // reflections: broad and faint with one thin bright edge, sparse rain rings — the first cut (tight
        // regular bands) read as hatching on the dark tarmac puddles (photographed 2026-10-03)
        PRIM.sheen(['sheen', 'rgba(215,228,248,0.09)', 4.0, 0.9, -0.45], c.x - r, c.y - r, c.x + r, c.y + r);
        PRIM.sheen(['sheen', 'rgba(235,242,252,0.18)', 4.0, 0.10, -0.45], c.x - r, c.y - r, c.x + r, c.y + r);
        PRIM.rings(['rings', 'rgba(220,232,250,0.30)', 2.8, 0.30, 0.03, 0.45], c.x - r, c.y - r, c.x + r, c.y + r);
        view.ctx.restore();
        if (PIXEL) { const k = coverCells(c); cellsPath(k.rim, k.G); view.ctx.fillStyle = 'rgba(30,40,58,0.30)'; view.ctx.fill(); continue; }
        coverPath(c);
        view.ctx.strokeStyle = 'rgba(30,40,58,0.35)'; view.ctx.lineWidth = Math.max(1, 0.12 * p); view.ctx.stroke();
      } else {
        view.ctx.fillStyle = artBase(c.cover, '#ffffff');
        view.ctx.fill();
        view.ctx.clip();
        view.ctx.translate(sx(0), sy(0));
        paintLayers(c.cover, c.x - r, c.y - r, c.x + r, c.y + r);
        view.ctx.restore();
        if (PIXEL) { const k = coverCells(c); cellsPath(k.rim, k.G); view.ctx.fillStyle = c.cover === 'snow' ? 'rgba(160,180,205,0.55)' : 'rgba(255,255,255,0.55)'; view.ctx.fill(); continue; }
        coverPath(c);
        view.ctx.strokeStyle = c.cover === 'snow' ? 'rgba(160,180,205,0.55)' : 'rgba(255,255,255,0.7)';
        view.ctx.lineWidth = Math.max(1, 0.16 * p); view.ctx.stroke();
      }
    }
  }

  // Dynamic surface wear patches: grass worn to short grass, dirt, and mud
  // Drawn ON TOP OF the track ribbon and ground, but UNDER the kerbs and marks!
  // TWO PASSES around the covers. MEASURED BUG, 2026-10-03 (user: "puddles on the grass track ... vanish
  // when driven over and turned dirt into mud"): wear was drawn AFTER the covers, so every 1.5 m dirt cell
  // turning to mud beside a puddle painted its square over the puddle's edge until the puddle was gone.
  //   'base'  — cells that started with no cover (dirt -> mud ...): drawn UNDER the covers
  //   'cover' — cells whose cover itself changed (snow packed to ice, ice scrubbed through): drawn OVER
  function drawWear(pass = 'base') {
    if (!wearMap || wearMap.size === 0) return;
    // 2026-10-03: a worn cell now LOOKS like what it has become (the same SURFACE_ART as everywhere else)
    // instead of a flat tinted square. Visible cells are grouped by surface, and each group is one path:
    // fill its base, clip to it, paint its layers once — so 1000 worn cells cost a handful of draw calls.
    const groups = new Map();
    for (const cell of wearMap.values()) {
      if (cell.current === cell.orig) continue;
      const startedCovered = cell.orig === 'snow' || cell.orig === 'ice' || cell.orig === 'wet';
      if ((pass === 'cover') !== startedCovered) continue;
      const x0 = Math.round(sx(cell.cx * WEAR_CELL)), y0 = Math.round(sy(cell.cy * WEAR_CELL));
      const x1 = Math.round(sx((cell.cx + 1) * WEAR_CELL)), y1 = Math.round(sy((cell.cy + 1) * WEAR_CELL));
      if (x1 < 0 || x0 > view.W || y1 < 0 || y0 > view.H) continue;
      // water on a cell is drawn as its BASE with a puddle over it, so meltwater on grass looks like water on grass
      const gkey = cell.current === 'wet' ? 'wet|' + cell.base : cell.current;
      let g = groups.get(gkey);
      if (!g) groups.set(gkey, (g = { r: [], bx0: Infinity, by0: Infinity, bx1: -Infinity, by1: -Infinity }));
      g.r.push(x0, y0, x1 - x0, y1 - y0);
      // world bbox of the group, so its pattern is painted over these cells only. MEASURED 2026-10-03:
      // painting each group across the whole view (clip-only) cost the lab panels run 236 -> 192 frames.
      g.bx0 = Math.min(g.bx0, cell.cx * WEAR_CELL); g.bx1 = Math.max(g.bx1, (cell.cx + 1) * WEAR_CELL);
      g.by0 = Math.min(g.by0, cell.cy * WEAR_CELL); g.by1 = Math.max(g.by1, (cell.cy + 1) * WEAR_CELL);
    }
    for (const [gk, g] of groups) {
      const r = g.r;
      const wetOn = gk.startsWith('wet|') ? gk.slice(4) : null, id = wetOn || gk;
      view.ctx.save();
      view.ctx.beginPath();
      // a soft DISC per cell (radius 0.72 of the cell, so neighbours overlap) rather than a hard square:
      // worn ground then spreads as organic ruts instead of a blocky staircase (photographed 2026-10-03)
      for (let i = 0; i < r.length; i += 4) {
        if (PIXEL) { view.ctx.rect(r[i], r[i + 1], r[i + 2], r[i + 3]); continue; }     // squares in pixel art
        const rr = r[i + 2] * 0.72, cx = r[i] + r[i + 2] / 2, cy = r[i + 1] + r[i + 3] / 2;
        view.ctx.moveTo(cx + rr, cy); view.ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      }
      view.ctx.fillStyle = artBase(id, '#6b5644');
      view.ctx.fill();
      view.ctx.clip();
      view.ctx.translate(sx(0), sy(0));
      paintLayers(id, g.bx0, g.by0, g.bx1, g.by1);
      if (wetOn) {
        view.ctx.fillStyle = PUDDLE_TINT[wetOn] || 'rgba(52,66,92,0.58)';
        // grown by a cell: the discs reach past the cells' squares, and the clip keeps it inside them
        const m = WEAR_CELL;
        view.ctx.fillRect((g.bx0 - m) * PPMz(), (g.by0 - m) * PPMz(), (g.bx1 - g.bx0 + 2 * m) * PPMz(), (g.by1 - g.by0 + 2 * m) * PPMz());
        PRIM.sheen(['sheen', 'rgba(220,232,250,0.12)', 3.0, 0.5, -0.45], g.bx0, g.by0, g.bx1, g.by1);
      }
      view.ctx.restore();
    }
  }


  // BUMPS, JUMPS AND KERBS. A top-down view has no height, so a jump you cannot SEE coming is an unfair
  // one — and unavoidable is a bug, not difficulty (CLAUDE.md §1). Each kind gets a shape that tells you
  // what it will do: a ramp is a wedge that brightens toward a RED LIP where the ground stops, a table
  // has a flat bright top and two edges, a hump is a lit dome, a kerb is the familiar red and white.
  function drawBumps() {
    const p = PPMz();
    for (const b of BUMPS) {
      if (Math.abs(b.x - cam.x) * p > view.W / 2 + 200 || Math.abs(b.y - cam.y) * p > view.H / 2 + 200) continue;
      view.ctx.save();
      view.ctx.translate(sx(b.x), sy(b.y));
      view.ctx.rotate(b.rot || 0);
      // TERRAIN SHAPES ARE SHOWN BY HILL-SHADING NOW (step 3, 2026-10-03; user chose "rebuild the old jumps as terrain" and
      // "pixel hill-shading"). The hand-drawn dome / wedge / table art went: photographed together with the shading it
      // read as two layers of mud. Kept: the KERB (it is paint, not height) and the ramp's RED LIP — the ground really does
      // fall away there, which no shading can show, and a jump you cannot see coming is unfair (CLAUDE.md §1).
      if (b.kind === 'kerb') {
        const n = Math.max(2, Math.round(b.len / 2.4));
        for (let i = 0; i < n; i++) {
          view.ctx.fillStyle = i % 2 ? COL.kerbB : COL.kerbA;
          view.ctx.fillRect((-b.len / 2 + (i * b.len) / n) * p, (-b.wid / 2) * p, (b.len / n) * p + 1, b.wid * p);
        }
        view.ctx.fillStyle = 'rgba(255,255,255,0.35)';
        view.ctx.fillRect((-b.len / 2) * p, -0.3 * p, b.len * p, 0.6 * p);
      } else if (b.kind === 'ramp') {
        view.ctx.fillStyle = 'rgba(214,69,60,0.85)';
        view.ctx.fillRect((b.len / 2 - 0.6) * p, (-b.wid / 2) * p, 0.6 * p, b.wid * p);
      }
      view.ctx.restore();
    }
  }

  function drawRunoff() {
    if (LEVEL.endless) return;   // the lab's border ring is drawn along the WHOLE world edge: 100 km a side on the highway
    for (let i = 0; i < 4; i++) forSide(i, (p, D, Lh) => {
      const E = Lh + RUNOFF_W, F = D + RUNOFF_W;   // along: the side plus both corners; out: the fence
      // GRASS VERGE first — the strip between the kerb and the gravel where you can still save it.
      view.ctx.fillStyle = COL.grass;
      view.ctx.fillRect(-E * p, D * p, E * 2 * p, VERGE_W * p);
      speckle(-E, D, E, D + VERGE_W, COL.grassDark, 0.8, 0.16);
      // then the TRAP: the full width of the side, plus the corner so the ring closes with no seam.
      view.ctx.fillStyle = COL.gravel;
      view.ctx.fillRect(-E * p, (D + VERGE_W) * p, E * 2 * p, (RUNOFF_W - VERGE_W) * p);
      speckle(-E, D + VERGE_W, E, F, COL.gravelGrit, 0.85, 0.15);
      speckle(-E, D + VERGE_W, E, F, COL.gravelDark, 2.4, 0.24);
    });
  }

  function drawKerb() {
    if (LEVEL.endless) return;
    for (let i = 0; i < 4; i++) forSide(i, (p, D, Lh) => {
      const inner = D - KERB_W;
      // hazard blocks across the FULL width of the strip, so the thing you drive over is what you see
      const blk = 2.6;                             // m per block
      for (let u = -Lh; u < Lh; u += blk) {
        const w = Math.min(blk, Lh - u);
        view.ctx.fillStyle = (Math.round((u + Lh) / blk) % 2) ? COL.kerbB : COL.kerbA;
        view.ctx.fillRect(u * p, inner * p, w * p + 1, KERB_W * p);
      }
      // it is RAISED: bright along the crest, shadow at the inner lip where the car climbs on
      view.ctx.fillStyle = 'rgba(255,255,255,0.45)';
      view.ctx.fillRect(-Lh * p, (D - 0.5) * p, Lh * 2 * p, 0.5 * p);
      view.ctx.fillStyle = 'rgba(0,0,0,0.16)';
      view.ctx.fillRect(-Lh * p, inner * p, Lh * 2 * p, 0.35 * p);
    });
  }

  function drawFence() {
    if (LEVEL.endless) return;   // MEASURED 2026-10-05: ~133k mesh segments + posts per frame along a 100 km edge (55-105 ms frames)
    for (let i = 0; i < 4; i++) forSide(i, (p, D, Lh) => {
      const y = (D + RUNOFF_W) * p, E = Lh + RUNOFF_W;   // E: the half-length of this side's fence, corners included
      // only the stretch in view (the frame's cam / W from forSide): the long sides are ~1 km of mesh
      const u0 = Math.max(-E, Math.floor((cam.x - view.W / 2 / p) / 4) * 4 - 4), u1 = Math.min(E, cam.x + view.W / 2 / p + 4);
      // High-performance Armco crash barrier:
      // 1. Backing catch-fence wire mesh
      view.ctx.strokeStyle = 'rgba(145,148,160,0.32)';
      view.ctx.lineWidth = Math.max(1, 0.08 * p);
      view.ctx.beginPath();
      for (let u = Math.max(-E, Math.floor((u0 + E) / 2.4) * 2.4 - E); u < u1; u += 2.4) {
        view.ctx.moveTo(u * p, y - 1.2 * p);
        view.ctx.lineTo((u + 2.4) * p, y + 0.4 * p);
        view.ctx.moveTo((u + 2.4) * p, y - 1.2 * p);
        view.ctx.lineTo(u * p, y + 0.4 * p);
      }
      view.ctx.stroke();

      // 2. Steel I-beam stanchions every 4 m
      const postW = Math.max(2, 0.28 * p);
      const postH = Math.max(3, 0.55 * p);
      view.ctx.fillStyle = '#42454e';
      for (let u = Math.max(-E, Math.floor((u0 + E) / 4) * 4 - E); u <= u1; u += 4) {
        view.ctx.fillRect(u * p - postW / 2, y - postH * 0.4, postW, postH);
      }

      // 3. Double-corrugated Armco rail: deep shadow underneath, steel beam, specular upper highlight
      view.ctx.fillStyle = 'rgba(25,27,32,0.6)';
      view.ctx.fillRect(-E * p, y + 0.15 * p, E * 2 * p, Math.max(1, 0.15 * p));

      view.ctx.fillStyle = '#9296a2';  // galvanized beam
      view.ctx.fillRect(-E * p, y - 0.25 * p, E * 2 * p, Math.max(2, 0.45 * p));

      view.ctx.fillStyle = '#d2d6e2';  // top reflective bevel
      view.ctx.fillRect(-E * p, y - 0.25 * p, E * 2 * p, Math.max(1, 0.12 * p));
    });
  }

  // ---------------------------------------------------------------- trackside scenery & props
  // BARRIERS (lab.js LEVEL.barriers): drawn at exactly the width the physics collides with (BARRIER_HALF)
  function drawBarriers() {
    const list = LEVEL.barriers;
    if (!list || !list.length) return;
    const p = PPMz();
    const path = (pts) => { view.ctx.beginPath(); pts.forEach(([x, y], i) => (i ? view.ctx.lineTo(sx(x), sy(y)) : view.ctx.moveTo(sx(x), sy(y)))); };
    const posts = (pts, every, size, col) => {
      view.ctx.fillStyle = col;
      let acc = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[i + 1], L = Math.hypot(bx - ax, by - ay);
        for (; acc <= L; acc += every) { const t = acc / L, x = ax + (bx - ax) * t, y = ay + (by - ay) * t; view.ctx.fillRect(sx(x) - (size * p) / 2, sy(y) - (size * p) / 2, size * p, size * p); }
        acc -= L;
      }
    };
    view.ctx.save(); view.ctx.lineJoin = 'round'; view.ctx.lineCap = 'butt';
    for (const b of list) {
      const half = BARRIER_HALF[b.kind] ?? 0.2;
      if (b.kind === 'building') continue;
      // OFF-SCREEN CULL (2026-10-04): Thruston's ~500 m of Armco was stroked + posted every frame for the whole lap
      if (!b._rbb) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of b.pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } b._rbb = [x0 - 1, y0 - 1, x1 + 1, y1 + 1]; }
      if (sx(b._rbb[0]) > view.W || sx(b._rbb[2]) < 0 || sy(b._rbb[1]) > view.H || sy(b._rbb[3]) < 0) continue;
      if (b.kind === 'line') { path(b.pts); view.ctx.strokeStyle = b.col || '#e2c13a'; view.ctx.lineWidth = Math.max(1, 0.25 * p); view.ctx.stroke(); continue; }
      if (b.kind === 'fence') {
        path(b.pts); view.ctx.strokeStyle = 'rgba(40,44,52,0.55)'; view.ctx.lineWidth = Math.max(1, 2 * half * p); view.ctx.stroke();
        posts(b.pts, 3, 0.35, '#2b2f38'); continue;
      }
      if (b.kind === 'armco') {
        path(b.pts); view.ctx.strokeStyle = '#5d626d'; view.ctx.lineWidth = Math.max(2, 2 * half * p); view.ctx.stroke();      // shadowed rail
        path(b.pts); view.ctx.strokeStyle = '#c9ccd3'; view.ctx.lineWidth = Math.max(1, half * p); view.ctx.stroke();          // bright face
        posts(b.pts, 2, 0.32, '#3d4049'); continue;
      }
      // wall / pitwall
      path(b.pts); view.ctx.strokeStyle = '#a9a7a0'; view.ctx.lineWidth = Math.max(2, 2 * half * p); view.ctx.stroke();
      if (b.kind === 'pitwall') {
        // painted red / white / blue blocks along the base (photographed at Thruxton)
        view.ctx.lineWidth = Math.max(1, half * 0.9 * p);
        const cols = ['#c8302c', '#f2f2f2', '#2b56b5'];
        view.ctx.setLineDash([2 * p, 4 * p]);
        cols.forEach((col, k) => { view.ctx.lineDashOffset = -k * 2 * p; path(b.pts); view.ctx.strokeStyle = col; view.ctx.stroke(); });
        view.ctx.setLineDash([]);
      }
    }
    view.ctx.restore();
  }
  // JOKER ARROWS (user spec 2026-10-03: "a TRANSLUCENT WHITE ARROW, gently pulsing" at joker / pit entries). Hidden once the joker
  // is done in an RX race. Wall clock: the pulse is something the player watches.
  function drawArrows(game, wallT) {
    const J = LEVEL.joker; if (!J || !J.arrows) return;
    if (game.jokerTaken) return;
    // stronger + OUTLINED (user: "needs to be closed and more clearly pointing") — at 0.28-0.5 alpha it faded into the grey tarmac
    const p = PPMz(), a = 0.45 + 0.35 * (0.5 + 0.5 * Math.sin((wallT || 0) * 3.2));
    for (const ar of J.arrows) {
      if (sx(ar.x) < -200 || sx(ar.x) > view.W + 200 || sy(ar.y) < -200 || sy(ar.y) > view.H + 200) continue;
      const L = ar.len || 7;
      view.ctx.save(); view.ctx.translate(sx(ar.x), sy(ar.y)); view.ctx.rotate(ar.rot);
      view.ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
      view.ctx.beginPath();
      view.ctx.moveTo(L * 0.5 * p, 0); view.ctx.lineTo(0, -L * 0.42 * p); view.ctx.lineTo(0, -L * 0.16 * p); view.ctx.lineTo(-L * 0.5 * p, -L * 0.16 * p);
      view.ctx.lineTo(-L * 0.5 * p, L * 0.16 * p); view.ctx.lineTo(0, L * 0.16 * p); view.ctx.lineTo(0, L * 0.42 * p); view.ctx.closePath(); view.ctx.fill();
      view.ctx.strokeStyle = `rgba(20,22,28,${(a * 0.8).toFixed(3)})`; view.ctx.lineWidth = Math.max(1.5, 0.25 * p); view.ctx.lineJoin = "miter"; view.ctx.stroke();
      view.ctx.restore();
    }
  }
  // SLIP ROAD (highway.js extras): the tarmac itself is a lane ribbon (drawLanes, ground tiles); this draws its MARKINGS - the edge
  // lines and a row of white squares along the nose where it leaves the hard shoulder - on top, so they are never stale in a tile
  function drawSlip(pr, p) {
    const L = pr.line; if (!L || L.length < 2) return;
    if (!pr._bb) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of L) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } pr._bb = [x0 - 6, y0 - 6, x1 + 6, y1 + 6]; }
    if (sx(pr._bb[0]) > view.W || sx(pr._bb[2]) < 0 || sy(pr._bb[1]) > view.H || sy(pr._bb[3]) < 0) return;
    const hw = (pr.w || 5) / 2 - 0.3, nrm = (k) => { const a = L[Math.max(0, k - 1)], b = L[Math.min(L.length - 1, k + 1)], h = Math.atan2(b[1] - a[1], b[0] - a[0]); return [-Math.sin(h), Math.cos(h)]; };
    view.ctx.save(); view.ctx.strokeStyle = 'rgba(245,245,240,0.85)'; view.ctx.lineWidth = Math.max(1, 0.15 * p);
    for (const sg of [-1, 1]) { view.ctx.beginPath(); for (let k = sg > 0 ? 1 : 0; k < L.length; k++) { const [x, y] = L[k], [nx, ny] = nrm(k), X = sx(x + nx * hw * sg), Y = sy(y + ny * hw * sg); if (k === (sg > 0 ? 1 : 0)) view.ctx.moveTo(X, Y); else view.ctx.lineTo(X, Y); } view.ctx.stroke(); }
    view.ctx.fillStyle = 'rgba(245,245,240,0.7)';
    if (pr.nose !== false) for (let k = 1; k < Math.min(5, L.length); k++) { const [x, y] = L[k], [nx, ny] = nrm(k); view.ctx.fillRect(sx(x + nx * hw) - 0.3 * p, sy(y + ny * hw) - 0.3 * p, 0.6 * p, 0.6 * p); }
    view.ctx.restore();
  }
  // BRIDGES (highway.js extras): carries 'road' / 'rail' / 'foot' = a deck OVER the motorway (kind 'bridge', drawn after the cars);
  // kind 'river' = the motorway over water. Local frame: +x along the deck (across the motorway). Squares only.
  // v2 (2026-10-06, user: "bridges have no connecting roads so it looks silly"; "make the cars n stuff move across if you can ... only if
  // cheap enough"): the APPROACHES (highway.js approaches(): lane ribbons in the ground tiles) run pr.appL[0 | 1] m out from each end;
  // their markings / rails are drawn here, and so is what MOVES across: cars both ways, walkers, a train every pr.trainEvery s. Pure
  // drawing on the wall clock (no physics, no state): a few dozen squares per bridge on screen.
  // The RIVER's water is now a real 'wet' cover (lab.js covers: the puddle water, grip and spray, painted into the ground tiles; user:
  // "water seemed to be painted and not our water texture"), so only the boat is drawn here.
  function drawBridge(pr, p) {
    const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
    const half = (pr.wid || 30) / 2, c = pr.carries, sd = pr.seed || 0;
    if (pr.kind === 'river') {
      if (pr.boat) { const e = (pr.roadHw || half - 9) / Math.cos(pr.skew || 0) + 4; P(e, -1.2, 5, 2.4, '#e9e4d8'); P(e + 1, -0.8, 2, 1.6, '#c8302c'); P(e + 0.2, -1.25, 4.6, 0.2, '#6a7077'); }
      return;
    }
    const a0 = half + 3 + ((pr.appL && pr.appL[0]) ?? 0), a1 = half + 3 + ((pr.appL && pr.appL[1]) ?? 0), Lt = a0 + a1, t = performance.now() / 1000 + (pr.phase || 0);
    // a mover at distance d along [-a0, a1] (wrapping), drawn by f(x)
    const along = (v, k, gap, f) => f((((t * v + k * gap) % Lt) + Lt) % Lt - a0);   // v < 0 runs -x by itself
    const dw = c === 'foot' ? 2.6 : c === 'rail' ? 7 : 9;
    view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect((-half + 1.5) * p, (-dw / 2 + 2.6) * p, 2 * half * p, dw * p);   // shadow
    P(-half - 4, -dw / 2 - 0.6, 4, dw + 1.2, '#7c7f86'); P(half, -dw / 2 - 0.6, 4, dw + 1.2, '#7c7f86');                 // abutments
    P(-half, -dw / 2, 2 * half, dw, c === 'rail' ? '#5a5048' : '#8f949c');
    P(-half, -dw / 2, 2 * half, 0.4, '#c9ccd3'); P(-half, dw / 2 - 0.4, 2 * half, 0.4, '#5d626d');                       // parapets
    if (c === 'road') {
      P(-half, -dw / 2 + 0.6, 2 * half, dw - 1.2, '#3b3e44');
      // centre dashes over the deck AND the approaches, edge lines on the approaches (the ribbon is 7 m: edges at +-3.2)
      for (let k = -a0 + 1; k < a1 - 2; k += 4) P(k, -0.08, 2, 0.16, 'rgba(245,245,240,0.8)');
      for (const y of [-3.2, 3.05]) { P(-a0, y, a0 - half - 4, 0.15, 'rgba(245,245,240,0.6)'); P(half + 4, y, a1 - half - 4, 0.15, 'rgba(245,245,240,0.6)'); }
      if (pr.cow) { const x = half * 0.35; P(x - 1.1, -0.6, 2.2, 1.2, '#f2f2f2'); P(x - 0.6, -0.6, 0.7, 0.6, '#1c1d20'); P(x + 0.3, 0, 0.6, 0.6, '#1c1d20'); P(x + 1.1, -0.35, 0.5, 0.7, '#f2f2f2'); }
      // TRAFFIC both ways (left-hand: +x in the lane at y +1.6): 1-2 cars per direction, 13-17 m/s, spaced along the whole road
      const cols = ['#c8302c', '#2b56b5', '#e9e4d8', '#3f5a3a', '#d6a21e'], n = 1 + (pr.cars || 1);
      for (let k = 0; k < n; k++) { const dir = k % 2 ? -1 : 1, y = dir > 0 ? 1.6 : -1.6, v = dir * (13 + ((sd + k * 7) % 5));
        along(v, k, Lt / n * 1.7, (x) => { P(x - 2, y - 0.85, 4, 1.7, cols[(k + sd) % 5]); P(x + (dir > 0 ? -0.2 : -1.2), y - 0.7, 1.4, 1.4, 'rgba(20,22,28,0.6)'); P(x + (dir > 0 ? 1.7 : -2), y - 0.7, 0.3, 0.4, '#fff6e6'); P(x + (dir > 0 ? 1.7 : -2), y + 0.3, 0.3, 0.4, '#fff6e6'); }); }
    } else if (c === 'rail') {
      // sleepers + rails over the deck and along the ballast approaches (the gravel ribbon in the tiles)
      for (let k = -a0; k < a1; k += 0.9) if (k < -half - 4 || k > half) P(k, -2.4, 0.35, 4.8, '#6e5a44'); else P(k, -dw / 2 + 0.8, 0.35, dw - 1.6, '#6e5a44');
      for (const y of [-1.9, -0.6, 0.6, 1.9]) P(-a0, y - 0.08, Lt, 0.16, '#b9bcc3');
      for (let k = -half + 3; k < half; k += 12) P(k, -dw / 2 - 0.3, 0.3, dw + 0.6, '#3d4049');
      // A TRAIN every trainEvery s: 3-5 coaches of 18 m at 32 m/s, one way or the other, crossing the whole length then gone
      const every = pr.trainEvery || 20, cyc = Math.floor(t / every), tt = t - cyc * every, dir = (cyc + sd) % 2 ? 1 : -1, nc = 3 + ((cyc + sd) % 3), len = nc * 19;
      const head = -a0 - 10 + tt * 32;
      if (head - len < a1 + 10) {
        const y = dir > 0 ? 1.25 : -1.25, col = ['#c8302c', '#2b56b5', '#d6a21e'][(cyc + sd) % 3];
        // mirrored about the middle of [-a0, a1] for the other way; a coach past either end of the track (a cut-short bed) is not drawn
        for (let k = 0; k < nc; k++) { const x0 = head - (k + 1) * 19, x = dir > 0 ? x0 : a1 - a0 - x0 - 18; if (x < -a0 - 18 || x > a1) continue; P(x, y - 1.4, 18, 2.8, '#2a2c33'); P(x + 0.3, y - 1.25, 17.4, 2.5, k === 0 ? col : '#d7d9de'); for (let w = 1.5; w < 17; w += 3) P(x + w, y - 0.5, 1.6, 1, 'rgba(30,40,58,0.55)'); }
      }
    } else {
      P(-half, -dw / 2 + 0.4, 2 * half, dw - 0.8, '#a29a8c');
      if (pr.cone) { P(half * 0.2 - 0.35, -0.35, 0.7, 0.7, '#f97316'); P(half * 0.2 - 0.15, -0.15, 0.3, 0.3, '#f2f2f2'); }
      // WALKERS along the deck and the footpath (1.1-1.6 m/s), one now and then with a dog
      for (let k = 0; k < (pr.people || 1) + 1; k++) { const dir = (k + sd) % 2 ? 1 : -1, y = dir > 0 ? 0.35 : -0.35;
        along(dir * (1.1 + ((sd + k * 3) % 5) * 0.12), k, Lt / ((pr.people || 1) + 1) * 1.3, (x) => { P(x - 0.3, y - 0.3, 0.6, 0.6, ['#c8302c', '#eab308', '#2b56b5', '#3f5a3a'][(k + sd) % 4]); P(x - 0.15, y - 0.15, 0.3, 0.3, '#e8c39e'); if ((k + sd) % 3 === 0) P(x + dir * 0.9 - 0.2, y - 0.15, 0.45, 0.3, '#5a4231'); }); }
    }
  }
  // GARAGE ROW (2026-10-04): one strip along the lane from front / back / banner polylines, so it bends with the track
  function drawGarageRow(pr, p) {
    if (!pr._bb) { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const [x, y] of [...pr.front, ...pr.back]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } pr._bb = [x0, y0, x1, y1]; }
    if (sx(pr._bb[0]) > view.W || sx(pr._bb[2]) < 0 || sy(pr._bb[1]) > view.H || sy(pr._bb[3]) < 0) return;
    const F = pr.front, B = pr.back, N = pr.banner, n = F.length;
    const poly = (a, b, col) => { view.ctx.beginPath(); a.forEach(([x, y], i) => (i ? view.ctx.lineTo(sx(x), sy(y)) : view.ctx.moveTo(sx(x), sy(y)))); for (let i = b.length - 1; i >= 0; i--) view.ctx.lineTo(sx(b[i][0]), sy(b[i][1])); view.ctx.closePath(); view.ctx.fillStyle = col; view.ctx.fill(); };
    view.ctx.save();
    view.ctx.translate(0.6 * p, 0.8 * p); poly(F, B, 'rgba(10,12,16,0.40)'); view.ctx.translate(-0.6 * p, -0.8 * p);   // shadow
    poly(F, B, '#5b626b');
    view.ctx.strokeStyle = '#3b4047'; view.ctx.lineWidth = Math.max(1, 0.25 * p);
    for (let i = 0; i < n; i += 2) { view.ctx.beginPath(); view.ctx.moveTo(sx(F[i][0]), sy(F[i][1])); view.ctx.lineTo(sx(B[i][0]), sy(B[i][1])); view.ctx.stroke(); }   // a unit every 5 m
    view.ctx.beginPath(); F.forEach(([x, y], i) => (i ? view.ctx.lineTo(sx(x), sy(y)) : view.ctx.moveTo(sx(x), sy(y)))); for (let i = n - 1; i >= 0; i--) view.ctx.lineTo(sx(B[i][0]), sy(B[i][1])); view.ctx.closePath(); view.ctx.stroke();
    poly(F, N, '#c8302c');                                                                                      // the banner
    const bh = 0.9 * p;
    if (bh >= 8) {
      view.ctx.fillStyle = '#ffffff'; view.ctx.font = `900 ${Math.round(bh * 0.8)}px Impact, ui-sans-serif, sans-serif`; view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
      for (let i = 3; i < n - 3; i += 6) {
        const a = N[i - 1], b = N[i + 1], m = F[i], q = N[i], ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
        view.ctx.save(); view.ctx.translate(sx((m[0] + q[0]) / 2), sy((m[1] + q[1]) / 2)); view.ctx.rotate(ang); view.ctx.fillText(pr.brand || 'KUM TYRES', 0, 1, 6 * 2.5 * p * 0.85); view.ctx.restore();
      }
    }
    view.ctx.restore();
  }
  // OVERHEAD props span the track ABOVE the cars and are drawn AFTER them. MEASURED BUG (user, 2026-10-03: "the gantry
  // being below cars on the naffcar track"): every prop was drawn before the car, so cars drove OVER the start gantry.
  const OVERHEAD = new Set(['gantry', 'footbridge', 'bridge']);
  function drawProps(overhead = false) {
    if (!PROPS || !PROPS.length) return;
    const p = PPMz();
    for (const pr of PROPS) {
      if (OVERHEAD.has(pr.kind) !== overhead) continue;
      if (pr.kind === 'garagerow') { drawGarageRow(pr, p); continue; }
      if (pr.kind === 'slip') { drawSlip(pr, p); continue; }
      const px = sx(pr.x), py = sy(pr.y);
      // margin by the prop's own size (a fixed 150 px let a 20 m hangar pop in at the screen edge)
      const m = Math.max(150, Math.max(pr.w || 0, pr.h || 0, pr.size || 0, pr.wid || 0, 18) * p * 0.75, (pr.reach || 0) * p);
      if (px < -m || px > view.W + m || py < -m || py > view.H + m) continue;
      view.ctx.save();
      view.ctx.translate(px, py);
      if (pr.rot) view.ctx.rotate(pr.rot);

      if (pr.kind === 'grandstand' || pr.kind === 'stadium_grandstand') {
        const gw = (pr.w || 36) * p, gh = (pr.h || 7.5) * p;
        // Heavy ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.42)';
        view.ctx.fillRect(-gw / 2 + 4, -gh / 2 + 5, gw, gh);
        // Base structural frame
        view.ctx.fillStyle = '#2e2c28';
        view.ctx.fillRect(-gw / 2, -gh / 2, gw, gh);
        // Stepped seating tiers
        const rows = pr.kind === 'stadium_grandstand' ? 6 : 4;
        const rowH = gh / rows;
        for (let r = 0; r < rows; r++) {
          view.ctx.fillStyle = r % 2 === 0 ? '#423d35' : '#585246';
          view.ctx.fillRect(-gw / 2, -gh / 2 + r * rowH, gw, rowH);
          // Planks and footwells
          view.ctx.fillStyle = 'rgba(20,18,16,0.45)';
          view.ctx.fillRect(-gw / 2, -gh / 2 + r * rowH + rowH - 1.5, gw, 1.5);
          // Colorful spectator crowd heads & caps
          const crowdColors = ['#e63946', '#3a86ff', '#2a9d8f', '#ffb703', '#fb8500', '#f1faee', '#8338ec'];
          const numDots = Math.floor(gw / (0.80 * p));
          for (let d = 0; d < numDots; d++) {
            const seed = (d * 19 + r * 37) % crowdColors.length;
            view.ctx.fillStyle = crowdColors[seed];
            view.ctx.fillRect(-gw / 2 + d * (0.80 * p) + 2, -gh / 2 + r * rowH + rowH * 0.28, 3.5, 3.5);
          }
        }
        // Corrugated canopy roof over the rear half
        view.ctx.fillStyle = 'rgba(12,14,18,0.30)';
        view.ctx.fillRect(-gw / 2, -gh / 2 + gh * 0.45, gw, 4); // shadow under roof edge
        view.ctx.fillStyle = '#656b78'; // galvanized zinc roof
        view.ctx.fillRect(-gw / 2 - 2, -gh / 2 - 2, gw + 4, gh * 0.50);
        // Roof corrugation ribs
        view.ctx.strokeStyle = '#858c9b'; view.ctx.lineWidth = 1;
        view.ctx.beginPath();
        for (let rx = -gw / 2; rx <= gw / 2; rx += 4 * p) {
          view.ctx.moveTo(rx, -gh / 2 - 2); view.ctx.lineTo(rx, -gh / 2 + gh * 0.50);
        }
        view.ctx.stroke();
        // Fluttering pennant flags along the roof ridge
        const flagColors = ['#ef4444', '#3b82f6', '#eab308', '#22c55e'];
        for (let fi = -gw / 2 + 6 * p; fi <= gw / 2 - 6 * p; fi += 10 * p) {
          view.ctx.fillStyle = '#222';
          view.ctx.fillRect(fi - 1, -gh / 2 - 8, 2, 7);
          view.ctx.fillStyle = flagColors[Math.abs(Math.floor(fi)) % flagColors.length];
          view.ctx.beginPath();
          view.ctx.moveTo(fi + 1, -gh / 2 - 8); view.ctx.lineTo(fi + 7, -gh / 2 - 5); view.ctx.lineTo(fi + 1, -gh / 2 - 2);
          view.ctx.fill();
        }
        // Front safety barrier rail
        view.ctx.strokeStyle = '#8e95a5'; view.ctx.lineWidth = Math.max(1.2, 0.12 * p);
        view.ctx.strokeRect(-gw / 2, -gh / 2, gw, gh);
      } else if (pr.kind === 'official_box') {
        // Wooden cabin on stilts
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.fillRect(-2.2 * p + 3, -1.8 * p + 4, 4.4 * p, 3.6 * p);
        // 4 heavy timber stilt posts
        view.ctx.fillStyle = '#3a2e22';
        view.ctx.fillRect(-2.0 * p, -1.6 * p, 0.4 * p, 3.2 * p);
        view.ctx.fillRect(1.6 * p, -1.6 * p, 0.4 * p, 3.2 * p);
        // Ladder rungs on the side
        view.ctx.fillStyle = '#65523f';
        for (let ly = -1.2 * p; ly <= 1.2 * p; ly += 0.5 * p) {
          view.ctx.fillRect(1.6 * p, ly, 0.4 * p, 2);
        }
        // Cabin body
        view.ctx.fillStyle = '#6b5847';
        view.ctx.fillRect(-1.8 * p, -1.4 * p, 3.6 * p, 2.8 * p);
        // Green timber window frame & observation window
        view.ctx.fillStyle = '#2b4436';
        view.ctx.fillRect(-1.5 * p, -1.1 * p, 3.0 * p, 1.2 * p);
        view.ctx.fillStyle = '#3b4856';
        view.ctx.fillRect(-1.3 * p, -1.0 * p, 2.6 * p, 1.0 * p);
        // Slanted corrugated tin roof
        view.ctx.fillStyle = '#555e6c';
        view.ctx.fillRect(-2.1 * p, -1.7 * p, 4.2 * p, 1.4 * p);
        // Wrap-around balcony rail
        view.ctx.strokeStyle = '#c4b5a0'; view.ctx.lineWidth = 1.5;
        view.ctx.strokeRect(-1.9 * p, -0.2 * p, 3.8 * p, 1.7 * p);
        // Marshal figure with yellow caution flag & chequered flag
        view.ctx.fillStyle = '#ffcc00'; // Yellow flag
        view.ctx.beginPath(); view.ctx.moveTo(1.7 * p, -1.7 * p); view.ctx.lineTo(2.6 * p, -1.3 * p); view.ctx.lineTo(1.7 * p, -0.9 * p); view.ctx.fill();
        view.ctx.fillStyle = '#fff'; // Chequered flag on opposite pole
        view.ctx.fillRect(-2.4 * p, -1.6 * p, 0.7 * p, 0.5 * p);
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(-2.4 * p, -1.6 * p, 0.35 * p, 0.25 * p);
        view.ctx.fillRect(-2.05 * p, -1.35 * p, 0.35 * p, 0.25 * p);
      } else if (pr.kind === 'gantry') {
        const gw = (pr.wid || 26) * p;
        // Heavy 3D steel truss frame spanning across track
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)';
        view.ctx.fillRect(-gw / 2 + 2, -0.6 * p + 3, gw, 1.2 * p);
        // Concrete crash protection pillars on both sides
        view.ctx.fillStyle = '#9aa0ae';
        view.ctx.fillRect(-gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 1.8 * p);
        view.ctx.fillRect(gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 1.8 * p);
        // Yellow/black hazard chevrons on pillars
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 0.4 * p);
        view.ctx.fillRect(gw / 2 - 0.6 * p, -0.9 * p, 1.2 * p, 0.4 * p);
        // SPEED CAMERA (highway gantries, highway.js speedCamera): a yellow box on the beam over the left lanes; flashes white when it
        // catches you (pr._flash, wall clock)
        if (LEVEL.endless) { const fl = pr._flash && performance.now() - pr._flash < 250; view.ctx.fillStyle = fl ? '#ffffff' : '#eab308'; view.ctx.fillRect(-gw * 0.3 - 0.7 * p, 0.6 * p, 1.4 * p, 1.0 * p); view.ctx.fillStyle = '#1c1d20'; view.ctx.fillRect(-gw * 0.3 - 0.35 * p, 1.2 * p, 0.7 * p, 0.3 * p); }
        // Main steel truss beam
        view.ctx.strokeStyle = '#3e4450'; view.ctx.lineWidth = Math.max(2.5, 0.35 * p);
        view.ctx.strokeRect(-gw / 2, -0.6 * p, gw, 1.2 * p);
        // Steel cross-bracing lattice
        view.ctx.strokeStyle = '#2b303c'; view.ctx.lineWidth = 1.2;
        view.ctx.beginPath();
        for (let bx = -gw / 2; bx < gw / 2; bx += 3.5 * p) {
          view.ctx.moveTo(bx, -0.6 * p); view.ctx.lineTo(bx + 3.5 * p, 0.6 * p);
          view.ctx.moveTo(bx + 3.5 * p, -0.6 * p); view.ctx.lineTo(bx, 0.6 * p);
        }
        view.ctx.stroke();
        // 5 circular start light pods with bright red glowing LED cores
        const lightSpacing = gw / 8;
        for (let l = -2; l <= 2; l++) {
          const lx = l * lightSpacing;
          view.ctx.fillStyle = '#111317';
          roundRect(view.ctx, lx - 0.35 * p, -0.45 * p, 0.7 * p, 0.9 * p, 3); view.ctx.fill();
          view.ctx.strokeStyle = '#4a5160'; view.ctx.lineWidth = 1; view.ctx.stroke();
          // Outer red glow
          view.ctx.fillStyle = 'rgba(239, 68, 68, 0.35)';
          view.ctx.beginPath(); view.ctx.arc(lx, 0, 0.35 * p, 0, Math.PI * 2); view.ctx.fill();
          // Solid red core
          view.ctx.fillStyle = '#ef4444';
          view.ctx.beginPath(); view.ctx.arc(lx, 0, 0.20 * p, 0, Math.PI * 2); view.ctx.fill();
          // White specular highlight
          view.ctx.fillStyle = '#fff';
          view.ctx.beginPath(); view.ctx.arc(lx - 0.05 * p, -0.05 * p, 0.06 * p, 0, Math.PI * 2); view.ctx.fill();
        }
        // Center digital lap / position board with green LEDs
        view.ctx.fillStyle = '#0a0d0a';
        roundRect(view.ctx, -1.4 * p, -0.55 * p, 2.8 * p, 0.45 * p, 2); view.ctx.fill();
        view.ctx.fillStyle = '#22c55e';
        view.ctx.font = `700 ${Math.round(0.32 * p)}px ui-monospace, monospace`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText('LAP 1', 0, -0.32 * p);
      } else if (pr.kind === 'pit_wall') {
        const pw = (pr.len || 220) * p, ph = (pr.h || 1.2) * p;
        // Ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)';
        view.ctx.fillRect(-pw / 2 + 2, -ph / 2 + 3, pw, ph);
        // Concrete wall body
        view.ctx.fillStyle = '#8a909d';
        view.ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
        // Top steel capping plate with bevel highlight
        view.ctx.fillStyle = '#b8becb';
        view.ctx.fillRect(-pw / 2, -ph / 2, pw, ph * 0.35);
        // Yellow/black diagonal hazard stripes at the wall ends
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-pw / 2, -ph / 2, 4 * p, ph);
        view.ctx.fillRect(pw / 2 - 4 * p, -ph / 2, 4 * p, ph);
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(-pw / 2 + 1.2 * p, -ph / 2, 1.4 * p, ph);
        view.ctx.fillRect(pw / 2 - 2.6 * p, -ph / 2, 1.4 * p, ph);
        // Pit stall accessories along the inside of the wall (toolboxes & air booms)
        for (let bx = -pw / 2 + 25 * p; bx <= pw / 2 - 25 * p; bx += 40 * p) {
          // Red tool cabinet
          view.ctx.fillStyle = '#b91c1c';
          roundRect(view.ctx, bx - 1.2 * p, -ph / 2 - 1.0 * p, 2.4 * p, 0.8 * p, 2); view.ctx.fill();
          view.ctx.fillStyle = '#d1d5db';
          view.ctx.fillRect(bx - 1.0 * p, -ph / 2 - 0.7 * p, 2.0 * p, 1.5);
          // Overhead air hose boom
          view.ctx.strokeStyle = '#222'; view.ctx.lineWidth = 1.2;
          view.ctx.beginPath(); view.ctx.moveTo(bx, -ph / 2); view.ctx.lineTo(bx + 1.5 * p, -ph / 2 - 2.0 * p); view.ctx.stroke();
        }
      } else if (pr.kind === 'pylon') {
        // High-output halogen floodlight pylon
        // Warm circular ground illumination pool on the deck
        const grad = view.ctx.createRadialGradient(0, 0, 1 * p, 0, 0, 18 * p);
        grad.addColorStop(0, 'rgba(255, 248, 220, 0.16)');
        grad.addColorStop(0.5, 'rgba(255, 244, 200, 0.08)');
        grad.addColorStop(1, 'rgba(255, 240, 180, 0)');
        view.ctx.fillStyle = grad;
        view.ctx.beginPath(); view.ctx.arc(0, 0, 18 * p, 0, Math.PI * 2); view.ctx.fill();

        // Tower shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.beginPath(); view.ctx.arc(3, 3, 1.1 * p, 0, Math.PI * 2); view.ctx.fill();
        // Steel base
        view.ctx.fillStyle = '#2f343e';
        view.ctx.beginPath(); view.ctx.arc(0, 0, 0.9 * p, 0, Math.PI * 2); view.ctx.fill();
        // Quad floodlamp heads with silver dishes & warm centers
        const heads = [[-0.6, -0.6], [0.2, -0.6], [-0.6, 0.2], [0.2, 0.2]];
        for (const [hx, hy] of heads) {
          view.ctx.fillStyle = '#e2e8f0';
          roundRect(view.ctx, hx * p, hy * p, 0.55 * p, 0.45 * p, 1.5); view.ctx.fill();
          view.ctx.fillStyle = '#fffbeb';
          view.ctx.beginPath(); view.ctx.arc((hx + 0.27) * p, (hy + 0.22) * p, 0.14 * p, 0, Math.PI * 2); view.ctx.fill();
        }
      } else if (pr.kind === 'garages') {
        // PIT GARAGES (Thruxton photo): concrete-block units under a red tyre-brand banner. Local +x = along the lane, -y = the
        // lane side. Top-down: the flat roof with a divider per unit, the banner along the front edge. Squares only (pixel rule).
        // First cut (photographed): a light grey roof vanished into the concrete apron and a 1.3 m banner read as a red wall.
        // Now a dark slate roof with an outline, ribbed per unit, and a 0.9 m banner with the brand once, centred.
        const gw = pr.w * p, gh = pr.h * p, unit = 5, o = Math.max(1, 0.25 * p);
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-gw / 2 + 0.6 * p, -gh / 2 + 0.8 * p, gw, gh);
        view.ctx.fillStyle = '#3b4047'; view.ctx.fillRect(-gw / 2, -gh / 2, gw, gh);                       // outline
        view.ctx.fillStyle = '#5b626b'; view.ctx.fillRect(-gw / 2 + o, -gh / 2 + o, gw - 2 * o, gh - 2 * o); // roof
        view.ctx.fillStyle = '#666d77';
        for (let y = 1; y < 10; y += 2) view.ctx.fillRect(-gw / 2 + o, -gh / 2 + (gh * y) / 10, gw - 2 * o, Math.max(1, 0.2 * p));   // roof ribs
        view.ctx.fillStyle = '#3b4047';
        const units = Math.max(1, Math.round(pr.w / unit));
        for (let k = 1; k < units; k++) view.ctx.fillRect(-gw / 2 + (gw * k) / units - o / 2, -gh / 2, o, gh);
        const bh = 0.9 * p;                                                                          // the banner, lane side
        view.ctx.fillStyle = '#c8302c'; view.ctx.fillRect(-gw / 2, -gh / 2, gw, bh);
        if (bh >= 8) {
          view.ctx.fillStyle = '#ffffff'; view.ctx.font = `900 ${Math.round(bh * 0.8)}px Impact, ui-sans-serif, sans-serif`;
          view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
          view.ctx.fillText(pr.brand || 'KUM TYRES', 0, -gh / 2 + bh / 2 + 1, gw * 0.9);
        } else {
          view.ctx.fillStyle = '#ffffff'; view.ctx.fillRect(-gw * 0.25, -gh / 2 + bh * 0.3, gw * 0.5, Math.max(1, bh * 0.4));
        }
      } else if (pr.kind === 'tower') {
        // CONTROL TOWER: a two-storey block (long shadow = tall) with a small glazed cab on the roof. The first cut — a square with
        // a thick dark band — photographed as a swimming pool.
        const g = (pr.size || 9) * p, c = g * 0.45;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-g / 2 + 1.6 * p, -g / 2 + 2.2 * p, g, g);
        view.ctx.fillStyle = '#d9d5cc'; view.ctx.fillRect(-g / 2, -g / 2, g, g);                                  // flat roof
        view.ctx.fillStyle = '#bdb8ad'; view.ctx.fillRect(-g / 2, g / 2 - 0.5 * p, g, 0.5 * p); view.ctx.fillRect(g / 2 - 0.5 * p, -g / 2, 0.5 * p, g);   // parapet shade
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)'; view.ctx.fillRect(-c / 2 + 0.6 * p, -c / 2 + 0.8 * p, c, c);  // the cab's shadow
        view.ctx.fillStyle = '#2f4656'; view.ctx.fillRect(-c / 2, -c / 2, c, c);                                   // glazed cab
        view.ctx.fillStyle = '#e9e6df'; view.ctx.fillRect(-c / 2 + 0.35 * p, -c / 2 + 0.35 * p, c - 0.7 * p, c - 0.7 * p);   // its roof
        view.ctx.fillStyle = '#5a5e66'; view.ctx.fillRect(-0.25 * p, -0.25 * p, 0.5 * p, 0.5 * p);                 // mast
      } else if (pr.kind === 'hangar') {
        // T2-style hangar: corrugated roof (ribs across), a lighter ridge, dark door end. Squares only.
        const hw = pr.w * p, hh = pr.h * p;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-hw / 2 + 1.2 * p, -hh / 2 + 1.6 * p, hw, hh);
        view.ctx.fillStyle = '#7b8188'; view.ctx.fillRect(-hw / 2, -hh / 2, hw, hh);
        view.ctx.fillStyle = '#8c929a'; view.ctx.fillRect(-hw / 2, -hh / 2, hw, hh * 0.5);
        view.ctx.fillStyle = '#6a7077'; for (let x = -pr.w / 2 + 1; x < pr.w / 2; x += 1.6) view.ctx.fillRect(x * p, -hh / 2, Math.max(1, 0.18 * p), hh);
        view.ctx.fillStyle = '#a7adb4'; view.ctx.fillRect(-hw / 2, -Math.max(1, 0.2 * p), hw, Math.max(2, 0.4 * p));
        view.ctx.fillStyle = '#3d4249'; view.ctx.fillRect(hw / 2 - 0.8 * p, -hh / 2, 0.8 * p, hh);
      } else if (pr.kind === 'plane') {
        // LIGHT AIRCRAFT, nose along +x: fuselage, wing, tailplane, a coloured stripe
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-3.2 * p + 0.8 * p, -0.5 * p + 1.2 * p, 7 * p, 1 * p); view.ctx.fillRect(0.3 * p, -4.5 * p + 1.2 * p, 1.4 * p, 9 * p);
        P(-3.2, -0.5, 7, 1, '#eef0f2'); P(0.3, -4.5, 1.4, 9, '#e3e6ea'); P(-3.2, -1.6, 0.8, 3.2, '#e3e6ea');
        P(-2.6, -0.15, 5.6, 0.3, pr.col || '#c8302c'); P(3.4, -0.3, 0.4, 0.6, '#3a3f47');
      } else if (pr.kind === 'windsock') {
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        P(-0.25, -0.25, 0.5, 0.5, '#5a5e66');
        for (let k = 0; k < 4; k++) P(0.25 + k * 0.6, -0.35 + k * 0.04, 0.6, 0.7 - k * 0.08, k % 2 ? '#f2f2f2' : '#f07a1a');
      } else if (pr.kind === 'truck') {
        // RACE TRANSPORTER (paddock): cab + long trailer with a team stripe, nose along +x
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)'; view.ctx.fillRect(-7 * p + 0.6 * p, -1.25 * p + 0.9 * p, 14 * p, 2.5 * p);
        P(-7, -1.25, 11.2, 2.5, '#e6e8eb'); P(-7, -0.35, 11.2, 0.7, pr.col || '#c8302c'); P(4.6, -1.2, 2.4, 2.4, pr.col || '#c8302c'); P(6.2, -1.0, 0.6, 2.0, '#2a3038');
      } else if (pr.kind === 'tree') {
        // a tree from overlapping SQUARES (pixel rule), shade per seed; long shadow first
        const sz = (pr.s || 4) * p, h = (pr.seed * 9301 + 49297) % 233280 / 233280;
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(-sz / 2 + 0.25 * sz, -sz / 2 + 0.35 * sz, sz, sz);
        // pal: 'dry' = desert scrub (olive / dust), else conifer greens; snow: white caps on the upper squares (generated stages)
        const cols = pr.pal === 'dry' ? (h < 0.5 ? ['#5b5a2e', '#6f6d38', '#8a8646'] : ['#64552c', '#786a36', '#948548']) : h < 0.5 ? ['#2f5a2a', '#3d6e33', '#4f8240'] : ['#355f2c', '#456f36', '#5a8a45'];
        view.ctx.fillStyle = cols[0]; view.ctx.fillRect(-sz / 2, -sz / 2, sz, sz);
        view.ctx.fillStyle = pr.snow ? '#dfe7ee' : cols[1]; view.ctx.fillRect(-sz / 2 + sz * 0.12, -sz / 2 + sz * 0.1, sz * 0.62, sz * 0.62);
        if (pr.snow) { view.ctx.fillStyle = cols[1]; view.ctx.fillRect(-sz / 2 + sz * 0.42, -sz / 2 + sz * 0.42, sz * 0.32, sz * 0.32); }
        view.ctx.fillStyle = pr.snow ? '#ffffff' : cols[2]; view.ctx.fillRect(-sz / 2 + sz * 0.2, -sz / 2 + sz * 0.18, sz * 0.3, sz * 0.3);
      } else if (pr.kind === 'rock') {
        // ROCK / BOULDER: overlapping grey squares, light top-left, dark bottom-right, a long shadow (pixel rule); pal 'red' = desert stone
        const sz = (pr.s || 3) * p, h = ((pr.seed || 1) * 9301 + 49297) % 233280 / 233280;
        const cols = pr.pal === 'red' ? ['#6e4a32', '#8c5f40', '#a87652', '#c39270'] : ['#4d5157', '#62676e', '#7b8088', '#989da4'];
        view.ctx.fillStyle = 'rgba(10,12,16,0.34)'; view.ctx.fillRect(-sz / 2 + 0.3 * sz, -sz / 2 + 0.4 * sz, sz, sz * 0.9);
        view.ctx.fillStyle = cols[0]; view.ctx.fillRect(-sz / 2, -sz / 2 + sz * 0.1, sz, sz * 0.8); view.ctx.fillRect(-sz / 2 + sz * 0.15, -sz / 2, sz * 0.7, sz);
        view.ctx.fillStyle = cols[1]; view.ctx.fillRect(-sz / 2 + sz * 0.1, -sz / 2 + sz * 0.08, sz * 0.72, sz * 0.7);
        view.ctx.fillStyle = cols[2]; view.ctx.fillRect(-sz / 2 + sz * 0.16, -sz / 2 + sz * 0.12, sz * (0.38 + 0.15 * h), sz * 0.36);
        view.ctx.fillStyle = cols[3]; view.ctx.fillRect(-sz / 2 + sz * 0.22, -sz / 2 + sz * 0.16, sz * 0.16, sz * 0.14);
        if (pr.snow) { view.ctx.fillStyle = '#eef3f7'; view.ctx.fillRect(-sz / 2 + sz * 0.12, -sz / 2 + sz * 0.06, sz * 0.5, sz * 0.22); }
      } else if (pr.kind === 'crowd') {
        // SPECTATORS: a cluster of people (a 2x2 px head-and-shoulders each, jackets in random colours, a shadow) over w x h m
        const n = pr.n || 14, w = pr.w || 8, hh = pr.h || 3; const rr = parkMiller((pr.seed || 7) * 7919);
        const JK = ['#c8302c', '#2b56b5', '#e2c13a', '#2f7d4f', '#f2f2f2', '#e07a1f', '#7a3fa0', '#16181d', '#3fb6c9'];
        for (let k = 0; k < n; k++) { const x = (rr() - 0.5) * w * p, y = (rr() - 0.5) * hh * p, z = Math.max(2, 0.55 * p);
          view.ctx.fillStyle = 'rgba(10,12,16,0.3)'; view.ctx.fillRect(x + z * 0.3, y + z * 0.4, z, z);
          view.ctx.fillStyle = JK[(rr() * JK.length) | 0]; view.ctx.fillRect(x - z / 2, y - z / 2, z, z);
          view.ctx.fillStyle = rr() < 0.5 ? '#e6c3a0' : '#8a5a3c'; view.ctx.fillRect(x - z * 0.22, y - z * 0.22, z * 0.44, z * 0.44); }
      } else if (pr.kind === 'marshal') {
        // MARSHAL POST: small hut, white roof, orange edge
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.35)'; view.ctx.fillRect(-1.2 * p + 0.4 * p, -1 * p + 0.6 * p, 2.4 * p, 2 * p);
        P(-1.2, -1, 2.4, 2, '#f07a1a'); P(-0.95, -0.75, 1.9, 1.5, '#f2f2f2');
      } else if (pr.kind === 'footbridge') {
        // FOOTBRIDGE over the track (Castle Combe's Avon + Dunlop bridges): deck across (+x), stair towers at the ends, a sponsor band
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        const half = (pr.wid || 27) / 2;
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-half * p + 1.5 * p, -1.2 * p + 2.4 * p, 2 * half * p, 2.4 * p);   // shadow on the road
        P(-half, -1.2, 2 * half, 2.4, '#8f949c'); P(-half, -1.2, 2 * half, 0.3, '#c9ccd3'); P(-half, 0.9, 2 * half, 0.3, '#5d626d');
        P(-half * 0.55, -0.75, half * 1.1, 1.5, '#1c4fa0');
        P(-half - 1.6, -1.5, 3.2, 3.0, '#6a7077'); P(half - 1.6, -1.5, 3.2, 3.0, '#6a7077');                                       // stair towers
        for (let k = 0; k < 4; k++) { P(-half - 1.4, -1.3 + k * 0.7, 2.8, 0.25, '#565b63'); P(half - 1.4, -1.3 + k * 0.7, 2.8, 0.25, '#565b63'); }
        if (p * 1.0 >= 8) { view.ctx.fillStyle = '#ffffff'; view.ctx.font = `900 ${Math.round(p * 1.0)}px Impact, ui-sans-serif, sans-serif`; view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle'; if (Math.cos(pr.rot || 0) < 0) view.ctx.rotate(Math.PI); /* never upside down (photographed) */ view.ctx.fillText(pr.label || '', 0, 0.05 * p, half * 1.05 * p); }
      } else if (pr.kind === 'sculpture') {
        // the red steel SCULPTURE by the start line (photo): a crown of red squares, orange core, long shadow (it is tall)
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(0.2 * p, 0.2 * p, 3.2 * p, 1.6 * p);
        for (const [x, y] of [[-1.1, -1.1], [0.3, -1.3], [0.7, -0.2], [-0.1, 0.6], [-1.2, 0.1]]) P(x, y, 0.8, 0.8, '#d6331f');
        P(-0.4, -0.4, 0.8, 0.8, '#f07a1a');
      } else if (pr.kind === 'block') {
        // a flat-roofed BUILDING (clubhouse, offices): roof colour, parapet, rooftop plant, optional name on the roof
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        const w2 = pr.w / 2, h2 = pr.h / 2;
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)'; view.ctx.fillRect(-w2 * p + 1.2 * p, -h2 * p + 1.6 * p, pr.w * p, pr.h * p);
        P(-w2, -h2, pr.w, pr.h, '#3b4047'); P(-w2 + 0.4, -h2 + 0.4, pr.w - 0.8, pr.h - 0.8, pr.roof || '#5b626b');
        P(w2 - 4, -h2 + 1.2, 2.4, 1.8, '#9aa0a8'); P(w2 - 3.6, -h2 + 1.5, 1.6, 1.2, '#7c828a');
        // a CHURCH (highway.js village): a square tower at the west end of the nave, with a little cross; a HOUSE: a ridge line, no rooftop plant
        if (pr.church) { P(-w2 - 2.6, -2, 4, 4, '#3b4047'); P(-w2 - 2.3, -1.7, 3.4, 3.4, '#8f8a80'); P(-w2 - 0.8, -0.8, 0.4, 1.6, '#3b4047'); P(-w2 - 1.2, -0.2, 1.2, 0.4, '#3b4047'); }
        if (pr.house || pr.church) P(-w2 + 0.4, -0.08, pr.w - 0.8, 0.16, 'rgba(20,22,28,0.35)');
        if (pr.label && p * 1.4 >= 9) { view.ctx.fillStyle = 'rgba(255,255,255,0.85)'; view.ctx.font = `900 ${Math.round(p * 1.4)}px Impact, ui-sans-serif, sans-serif`; view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle'; if (Math.cos(pr.rot || 0) < 0) view.ctx.rotate(Math.PI); view.ctx.fillText(pr.label, 0, 0.6 * p, pr.w * 0.8 * p); }
      } else if (pr.kind === 'chevron') {
        // RALLY CHEVRON BOARD (black + yellow arrows), placed on the outside of a corner, arrows pointing the way it turns (+x).
        // Drawn at 1.6x (photographed: at 3.2 m it was a smudge beside the bales)
        view.ctx.scale(1.6, 1.6);
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(-1.6 * p + 0.3 * p, -0.25 * p + 0.5 * p, 3.2 * p, 0.5 * p);
        P(-1.6, -0.25, 3.2, 0.5, '#15171c');
        for (let k = 0; k < 3; k++) { P(-1.25 + k * 1.0, -0.2, 0.25, 0.15, '#f2c21b'); P(-1.0 + k * 1.0, -0.075, 0.25, 0.15, '#f2c21b'); P(-1.25 + k * 1.0, 0.05, 0.25, 0.15, '#f2c21b'); }
      } else if (pr.kind === 'bale') {
        // ROUND HAY BALE from the top: a straw square with a darker spiral ring (squares — the pixel rule)
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-0.8 * p + 0.3 * p, -0.8 * p + 0.45 * p, 1.6 * p, 1.6 * p);
        P(-0.8, -0.8, 1.6, 1.6, '#c9a85a'); P(-0.55, -0.55, 1.1, 1.1, '#b48f45'); P(-0.3, -0.3, 0.6, 0.6, '#d8bb6e'); P(-0.08, -0.08, 0.16, 0.16, '#9a7836');
      } else if (pr.kind === 'flag') {
        // a FLAG on a pole: pole square + a pennant blowing in +x, with a long shadow
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.fillStyle = 'rgba(10,12,16,0.28)'; view.ctx.fillRect(0.2 * p, 0.1 * p, 1.8 * p, 0.6 * p);
        P(-0.15, -0.15, 0.3, 0.3, '#3a3f47'); P(0.15, -0.55, 1.3, 0.75, pr.col || '#c8302c'); P(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)');
      } else if (pr.kind === 'bridge' || pr.kind === 'river') { drawBridge(pr, p);
      } else if (pr.kind === 'slipcount') {
        // the 300 / 200 / 100 yd COUNTDOWN posts before an exit: white with red diagonal bars (squares, not circles)
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        P(-0.5, -1.0, 1.2, 2.2, 'rgba(10,12,16,0.35)'); P(-0.6, -1.1, 1.2, 2.2, '#f2f2f2');
        for (let k = 0; k < (pr.bars || 1); k++) P(-0.6, -0.95 + k * 0.7, 1.2, 0.35, '#c8302c');
      } else if (pr.kind === 'gate') {
        // a FIELD GATE where the slip road ends (wooden 5-bar, posts either side)
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        P(-3.4, -0.2, 6.8, 0.6, 'rgba(10,12,16,0.35)'); P(-3.2, -0.35, 0.5, 0.7, '#3a2d21'); P(2.7, -0.35, 0.5, 0.7, '#3a2d21');
        for (let k = 0; k < 3; k++) P(-2.7, -0.25 + k * 0.22, 5.4, 0.1, '#b48a5a');
      } else if (pr.kind === 'solarfarm') {
        // the SMILEY SOLAR FARM (a cheeky extra): rows of dark blue panels laid out as a smiling face, seen from above
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        const cell = (cx, cy) => { P(cx * 2.4 - 1.1, cy * 2.4 - 0.9, 2.2, 1.8, '#1b2b55'); P(cx * 2.4 - 1.1, cy * 2.4 - 0.9, 2.2, 0.35, '#5f7fc4'); };
        for (const [cx, cy] of [[-3, -3], [-2, -3], [2, -3], [3, -3], [-3, -2], [-2, -2], [2, -2], [3, -2]]) cell(cx, cy);   // eyes
        for (const [cx, cy] of [[-5, 1], [-4, 2], [-3, 3], [-2, 3], [-1, 4], [0, 4], [1, 4], [2, 3], [3, 3], [4, 2], [5, 1]]) cell(cx, cy);   // grin
      } else if (pr.kind === 'board') {
        // Heavy timber support posts
        const bw = 18 * p, bh = 2.4 * p;
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        view.ctx.fillRect(-bw / 2 + 2, -bh / 2 + 3, bw, bh);
        // Wooden support posts
        view.ctx.fillStyle = '#3a2d21';
        view.ctx.fillRect(-bw / 2 + 1 * p, -bh / 2, 0.4 * p, bh + 2);
        view.ctx.fillRect(bw / 2 - 1.4 * p, -bh / 2, 0.4 * p, bh + 2);
        // Signboard body with colored accent border
        view.ctx.fillStyle = pr.blue ? '#1f4fa8' : '#14161c';   // blue = a motorway EXIT sign (highway.js slip roads)
        view.ctx.fillRect(-bw / 2, -bh / 2, bw, bh);
        view.ctx.strokeStyle = pr.blue ? '#ffffff' : pr.label.includes('SPUM') ? '#eab308' : pr.label.includes('CREEM') ? '#38bdf8' : '#f97316';
        view.ctx.lineWidth = 1.8; view.ctx.strokeRect(-bw / 2, -bh / 2, bw, bh);
        // Sponsor typography with punchy contrast
        view.ctx.fillStyle = '#ffffff';
        view.ctx.font = `900 ${Math.round(1.15 * p)}px Impact, ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText(pr.label || 'SPONSOR', 0, 0);
      }
      view.ctx.restore();
    }
  }

  function drawMarks(marks) {
    // one blit of the whole world layer. imageSmoothingEnabled stays on here: the layer is 9 px/m and
    // the screen is 16 px/m, so smoothing is what stops the marks looking like stair-stepped bitmaps.
    const [mox, moy] = marks.origin || [0, 0], px = sx(mox - MARK_EXTENT), py = sy(moy - MARK_EXTENT);
    const size = MARK_EXTENT * 2 * PPMz();
    // PIXEL mode: smoothing OFF, so marks land on the art grid as hard blocks (photographed soft and blurry with
    // it on, 2026-10-03 — the only smeared thing left in the world layer)
    if (PIXEL) view.ctx.imageSmoothingEnabled = false;
    view.ctx.drawImage(marks.canvas, px, py, size, size);
    if (PIXEL) view.ctx.imageSmoothingEnabled = true;
  }

  // ---------------------------------------------------------------- cones
  //
  // STANDING and TOPPLED must be unmistakable at a glance and at phone size (§4: if the player cannot
  // read it, it did not happen). Standing reads as concentric rings — the cone seen from directly
  // above. Toppled reads as a LONG shape lying in the direction it was hit, which is a completely
  // different silhouette rather than the same blob in a different colour.
  // ---------------------------------------------------------------- PIXEL OBJECTS (cones, tyres)
  // Generated pixel sprites, cached, drawn at the car's art scale (SPRITE_PPM) with smoothing off. Round things are
  // PIXEL-round — rasterised square by square (pdisc), never an anti-aliased arc.
  const objCache = new Map();
  function objSprite(key, size, paint) {
    let s = objCache.get(key);
    if (!s) {
      const c = document.createElement('canvas'); c.width = c.height = size;
      paint(c.getContext('2d'), size); s = { c, size }; objCache.set(key, s);
    }
    return s;
  }
  // a pixel disc of radius rr centred in a size x size sprite (pixel centres inside the circle)
  function pdisc(g, size, rr, col) {
    g.fillStyle = col; const m = (size - 1) / 2;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x - m) ** 2 + (y - m) ** 2 <= rr * rr) g.fillRect(x, y, 1, 1);
  }
  function pixelObjectSprite(c) {
    const mode = c.mode || (c.kind === 'tyrestack' ? 'stack' : c.kind === 'tyre' ? 'flat' : 'cone');
    if (c.kind === 'cone') {
      if (c.down > 0.5) return objSprite('cone-down', 11, (g) => {          // lying on its side, tip to +x
        g.fillStyle = '#b8410c'; g.fillRect(0, 2, 2, 7);                      // base
        for (let x = 2; x < 11; x++) { const h = Math.max(1, Math.round(3.4 - (x - 2) * 0.36)); g.fillStyle = '#f26a1b'; g.fillRect(x, 5 - h, 1, h * 2 + 1); }
        g.fillStyle = '#f4f4f6'; g.fillRect(5, 3, 2, 5);                       // reflective band
        g.fillStyle = '#ff9a55'; g.fillRect(2, 4, 7, 1);                       // highlight
      });
      return objSprite('cone-up', 9, (g, n) => {                               // top-down: base, band, tip
        pdisc(g, n, 4.4, '#b8410c'); pdisc(g, n, 3.6, '#f26a1b'); pdisc(g, n, 2.4, '#f4f4f6'); pdisc(g, n, 1.4, '#f26a1b');
        g.fillStyle = '#ffb27a'; g.fillRect(4, 4, 1, 1);
      });
    }
    if (c.kind === 'tyre' || c.kind === 'tyrestack') {
      if (mode === 'roll' || mode === 'flip' || mode === 'wobble') return objSprite('tyre-side', 15, (g) => {   // on its tread
        g.fillStyle = '#16171c'; g.fillRect(0, 5, 15, 5);
        g.fillStyle = '#3a3d47'; for (let x = 1; x < 15; x += 3) g.fillRect(x, 5, 1, 5);
        g.fillStyle = '#6b6f7a'; g.fillRect(4, 6, 7, 1);
      });
      const stack = mode === 'stack';
      return objSprite(stack ? 'tyre-stack' : 'tyre-flat', 17, (g, n) => {
        pdisc(g, n, stack ? 8.2 : 7.2, '#0f1014'); pdisc(g, n, stack ? 7.2 : 6.3, '#2a2c33');
        pdisc(g, n, stack ? 5.0 : 4.2, '#6b6f7a'); pdisc(g, n, stack ? 3.6 : 3.0, '#1d1f25');
        if (stack) { g.fillStyle = '#4a4e58'; for (let x = 4; x < 13; x++) g.fillRect(x, 2, 1, 1); g.fillStyle = '#f2c94c'; g.fillRect(12, 6, 1, 2); }   // top ring glint, sponsor fleck
        g.clearRect(7, 7, 3, 3);                                                // the hole: ground shows through
      });
    }
    return null;
  }
  function drawPixelObject(c) {
    const sp = pixelObjectSprite(c);
    if (!sp) return false;
    const u = PPMz() / SPRITE_PPM;
    view.ctx.rotate(c.ang || 0);
    view.ctx.scale(u, u);
    view.ctx.drawImage(sp.c, -sp.size / 2, -sp.size / 2);
    return true;
  }

  // RALLY TAPE (cones.js sections): red / white between its posts; a SNAPPED section hangs as two short loose ends; tape STUCK to a car
  // trails behind it as a fluttering streamer (wall-clock flutter, fades after ~14 s)
  function drawTape(game) {
    const S = game.cones.tapes; if (!S || !S.length) return;
    const p = PPMz(), lw = Math.max(1.5, 0.12 * p);
    view.ctx.save(); view.ctx.lineWidth = lw; view.ctx.lineCap = 'butt';
    // TAPE PUFFS (cones.js: a section gone after its second hit; and a streamer coming off a car): a burst of red / white flecks
    const puff = (x, y, vx, vy, n) => {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832, v = 0.8 + Math.random() * 3.2;
        if (chips.length >= MAX_CHIPS) chips.shift();
        chips.push({ x: x + (Math.random() - 0.5) * 0.6, y: y + (Math.random() - 0.5) * 0.6, vx: vx + Math.cos(a) * v, vy: vy + Math.sin(a) * v, age: 0, life: 0.5 + Math.random() * 1.1, col: Math.random() < 0.5 ? '#e23b2e' : '#f2f2f2', sz: 2 });
      }
    };
    const PQ = game.cones.tapePuffs;
    if (PQ && PQ.length) { for (const q of PQ) puff(q.x, q.y, q.vx, q.vy, 22); PQ.length = 0; }
    for (const sct of S) {
      if (sct.gone) continue;
      const ax = sx(sct.a.x), ay = sy(sct.a.y), bx = sx(sct.b.x), by = sy(sct.b.y);
      if ((ax < -40 && bx < -40) || (ax > view.W + 40 && bx > view.W + 40) || (ay < -40 && by < -40) || (ay > view.H + 40 && by > view.H + 40)) continue;
      const seg = (x0, y0, x1, y1) => { view.ctx.setLineDash([0.5 * p, 0.5 * p]); view.ctx.strokeStyle = '#e23b2e'; view.ctx.beginPath(); view.ctx.moveTo(x0, y0); view.ctx.lineTo(x1, y1); view.ctx.stroke();
        view.ctx.lineDashOffset = 0.5 * p; view.ctx.strokeStyle = '#f2f2f2'; view.ctx.beginPath(); view.ctx.moveTo(x0, y0); view.ctx.lineTo(x1, y1); view.ctx.stroke(); view.ctx.lineDashOffset = 0; };
      if (!sct.broken) seg(ax, ay, bx, by);
      else { const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, e = Math.min(L * 0.35, 1.3 * p);
        seg(ax, ay, ax + dx / L * e + dy / L * e * 0.3, ay + dy / L * e - dx / L * e * 0.3); seg(bx, by, bx - dx / L * e + dy / L * e * 0.3, by - dy / L * e - dx / L * e * 0.3); }
    }
    view.ctx.setLineDash([]);
    const now = performance.now() / 1000, clock = game.cones.clock || 0;
    for (const car of [game.car, ...(game.ai || []).map((a) => a.car)]) {
      // null = reset (the car was teleported): no puff, just forget the count
      if (!car.streamers) { car._stN = 0; continue; }
      car.streamers = car.streamers.filter((st) => clock - st.born < 14);
      // a streamer lost since last frame (timed out, or knocked off by an impact in damage.js) goes up in a puff behind the car
      if (car._stN != null && car.streamers.length < car._stN) { const ch0 = Math.cos(car.heading), sh0 = Math.sin(car.heading);
        for (let n = car.streamers.length; n < car._stN; n++) puff(car.x - ch0 * car.spec.len * 0.5, car.y - sh0 * car.spec.len * 0.5, car.vx * 0.5, car.vy * 0.5, 12); }
      car._stN = car.streamers.length;
      const ch = Math.cos(car.heading), sh = Math.sin(car.heading), v = Math.hypot(car.vx, car.vy);
      const bxW = car.x - ch * car.spec.len * 0.45, byW = car.y - sh * car.spec.len * 0.45;
      car.streamers.forEach((st, k) => {
        // trails BEHIND the direction of travel (or the car's back when slow), fluttering
        const dirx = v > 1 ? -car.vx / v : -ch, diry = v > 1 ? -car.vy / v : -sh, side = (k - 1) * 0.35;
        view.ctx.beginPath(); view.ctx.moveTo(sx(bxW - sh * side), sy(byW + ch * side));
        for (let q = 1; q <= 6; q++) { const u = q / 6, w = Math.sin(now * 14 + st.phase + u * 5) * 0.35 * u;
          view.ctx.lineTo(sx(bxW - sh * side + dirx * st.len * u - diry * w), sy(byW + ch * side + diry * st.len * u + dirx * w)); }
        view.ctx.lineWidth = lw * 1.8; view.ctx.setLineDash([0.5 * p, 0.5 * p]); view.ctx.strokeStyle = '#e23b2e'; view.ctx.stroke(); view.ctx.lineDashOffset = 0.5 * p; view.ctx.strokeStyle = '#f2f2f2'; view.ctx.stroke(); view.ctx.lineDashOffset = 0; view.ctx.setLineDash([]); view.ctx.lineWidth = lw;   // streamers drawn thicker (photographed thin)
      });
    }
    view.ctx.restore();
  }
  // ROADSIDE DEBRIS (cones.js DEBRIS): top-down squares, rotated with the object; broken ones are a scatter of bits (seeded by home)
  const DEBRIS_KINDS = new Set(['pallet', 'box', 'crate', 'bin', 'sandbag', 'barrel', 'exhaust', 'bumper', 'tarp', 'splinters', 'cardboard', 'sand', 'fluff']);
  function drawDebris(c) {
    const p = PPMz(), P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
    const sh = (w, h) => { view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect((-w / 2 + 0.15) * p, (-h / 2 + 0.25) * p, w * p, h * p); };
    view.ctx.rotate(c.ang || 0);
    switch (c.kind) {
      case 'pallet': sh(1.2, 1.0); P(-0.6, -0.5, 1.2, 1.0, '#8a6a43'); for (let k = 0; k < 4; k++) P(-0.6, -0.42 + k * 0.26, 1.2, 0.08, '#5e4529'); break;
      case 'box': sh(0.8, 0.6); P(-0.4, -0.3, 0.8, 0.6, '#b8925e'); P(-0.4, -0.04, 0.8, 0.08, '#d9c08a'); break;
      case 'crate': sh(1.0, 1.0); P(-0.5, -0.5, 1.0, 1.0, '#7d5a32'); P(-0.42, -0.42, 0.84, 0.84, '#9b7444'); P(-0.5, -0.05, 1.0, 0.1, '#5e4529'); P(-0.05, -0.5, 0.1, 1.0, '#5e4529'); break;
      case 'bin': sh(0.7, 0.8); P(-0.35, -0.4, 0.7, 0.8, c.col || '#2f5d3a'); P(-0.35, -0.4, 0.7, 0.14, '#1f3d27'); break;
      case 'sandbag': sh(0.9, 0.5); P(-0.45, -0.25, 0.9, 0.5, '#a89470'); P(-0.45, -0.25, 0.9, 0.08, '#c4b28c'); break;
      case 'barrel': sh(0.8, 0.8); P(-0.4, -0.4, 0.8, 0.8, c.col || '#2b56b5'); P(-0.25, -0.25, 0.5, 0.5, shade(c.col || '#2b56b5', 0.8)); P(-0.07, -0.07, 0.14, 0.14, '#1c1d20'); break;
      case 'exhaust': sh(1.0, 0.25); P(-0.5, -0.07, 0.8, 0.14, '#6a7077'); P(0.3, -0.13, 0.25, 0.26, '#4a4f57'); break;
      case 'bumper': sh(1.6, 0.3); P(-0.8, -0.15, 1.6, 0.3, c.col || '#c8302c'); P(-0.8, -0.15, 1.6, 0.07, 'rgba(255,255,255,0.3)'); break;
      case 'tarp': P(-0.9, -0.7, 1.8, 1.4, c.col || '#2f6fb0'); P(-0.9, -0.2, 1.8, 0.12, 'rgba(255,255,255,0.18)'); P(0.2, -0.7, 0.12, 1.4, 'rgba(0,0,0,0.15)'); break;
      default: {   // broken: a scatter of bits in its colour
        const rn = parkMiller(Math.floor(Math.abs((c.hx || 0) * 73.1 + (c.hy || 0) * 19.7)) % 9973 + 1);
        const cols = c.kind === 'fluff' ? ['#f6f5ef', '#dcdbd2'] : c.kind === 'sand' ? ['#c4b28c', '#a89470'] : c.kind === 'cardboard' ? ['#b8925e', '#d9c08a'] : ['#8a6a43', '#5e4529'];
        for (let q = 0; q < 14; q++) { const a = rn() * 6.283, rr = Math.sqrt(rn()) * 1.2, w = 0.12 + rn() * 0.3, h = c.kind === 'splinters' ? 0.08 : w; P(Math.cos(a) * rr - w / 2, Math.sin(a) * rr - h / 2, w, h, cols[q % 2]); }
      }
    }
  }
  function drawCones(cones) {
    const r = CONE_R * PPMz() * 1.35;   // drawn a touch over scale: a cone the player cannot see is not a cone
    for (const c of cones) {
      const px = sx(c.x), py = sy(c.y);
      if (px < -60 || px > view.W + 60 || py < -60 || py > view.H + 60) continue;
      const d = c.down;                       // 0 = upright, 1 = flat

      view.ctx.save();
      view.ctx.translate(px, py);
      if (c.kind === 'bale' || c.kind === 'straw') {
        const P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * PPMz(), y * PPMz(), w * PPMz(), h * PPMz()); };
        view.ctx.rotate(c.ang || 0);
        if (c.kind === 'bale') {
          // ROUND HAY BALE from the top: straw square, darker spiral ring (squares — the pixel rule)
          view.ctx.fillStyle = 'rgba(10,12,16,0.30)'; view.ctx.fillRect(-0.8 * PPMz() + 0.3 * PPMz(), -0.8 * PPMz() + 0.45 * PPMz(), 1.6 * PPMz(), 1.6 * PPMz());
          P(-0.8, -0.8, 1.6, 1.6, '#c9a85a'); P(-0.55, -0.55, 1.1, 1.1, '#b48f45'); P(-0.3, -0.3, 0.6, 0.6, '#d8bb6e'); P(-0.08, -0.08, 0.16, 0.16, '#9a7836');
        } else {
          // BURST STRAW: a spread of loose straw squares, the same every frame (seeded by its home position)
          const rn = parkMiller(Math.floor(Math.abs(c.hx * 73.1 + c.hy * 19.7)) % 9973 + 1);
          for (let q = 0; q < 26; q++) { const a = rn() * 6.283, rr = Math.sqrt(rn()) * 1.8, w = 0.2 + rn() * 0.35; P(Math.cos(a) * rr - w / 2, Math.sin(a) * rr - w / 2, w, w, q % 3 ? '#cfae62' : '#a8873f'); }
        }
        view.ctx.restore(); continue;
      }
      if (c.kind === 'sheep' || c.kind === 'cow') {
        // SHEEP / COW (S-C: loose objects, cones.js; the old field look): a body square, a head square at +x, a shadow. A TIPPED cow lies
        // on its side: four dark leg squares out, the head flat
        const p = PPMz(), P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.rotate(c.ang || 0);
        if (c.kind === 'cow' && c.tipped) { P(-0.9, -0.2, 2, 0.9, 'rgba(10,12,16,0.3)'); P(-1.1, -0.45, 2, 0.85, '#f0eee8'); P(-0.6, -0.45, 0.7, 0.4, '#1c1d20');
          for (const lx of [-0.9, -0.5, 0.15, 0.55]) P(lx, 0.4, 0.2, 0.55, '#1c1d20'); P(0.9, -0.3, 0.55, 0.55, '#1c1d20'); }
        else if (c.kind === 'cow') { P(-0.9, -0.35, 2, 1, 'rgba(10,12,16,0.3)'); P(-1.1, -0.5, 2, 1, '#f0eee8'); P(-0.7, -0.5, 0.6, 0.5, '#1c1d20'); P(0.2, 0, 0.5, 0.5, '#1c1d20'); P(0.9, -0.3, 0.55, 0.6, '#1c1d20'); }
        else { P(-0.45, -0.2, 1, 0.7, 'rgba(10,12,16,0.3)'); P(-0.55, -0.35, 1, 0.7, '#ecebe4'); P(-0.45, -0.25, 0.8, 0.5, '#f7f6f0'); P(0.42, -0.2, 0.32, 0.4, '#2a2a2c'); }
        view.ctx.restore(); continue;
      }
      if (DEBRIS_KINDS.has(c.kind)) { drawDebris(c); view.ctx.restore(); continue; }
      if (c.kind === 'tapepost') {
        // a tape POST: a dark stake (upright) or lying (knocked)
        const p = PPMz(); view.ctx.rotate(c.ang || 0); view.ctx.fillStyle = '#3a2d21';
        if (d < 0.5) view.ctx.fillRect(-0.12 * p, -0.12 * p, 0.24 * p, 0.24 * p); else view.ctx.fillRect(-0.6 * p, -0.06 * p, 1.2 * p, 0.12 * p);
        view.ctx.restore(); continue;
      }
      if (c.kind === 'chevron' || c.kind === 'flag') {
        // a knockable CHEVRON board / FLAG (cones.js): upright as the old prop; once knocked (down > 0.5) lying flat — the chevron face up
        // and darker, the flag pole down with its cloth crumpled beside it
        const p = PPMz(), P = (x, y, w, h, col) => { view.ctx.fillStyle = col; view.ctx.fillRect(x * p, y * p, w * p, h * p); };
        view.ctx.rotate(c.ang || 0);
        if (c.kind === 'chevron') {
          view.ctx.scale(1.6, 1.6);
          if (d < 0.5) { view.ctx.fillStyle = 'rgba(10,12,16,0.32)'; view.ctx.fillRect(-1.6 * p + 0.3 * p, -0.25 * p + 0.5 * p, 3.2 * p, 0.5 * p); P(-1.6, -0.25, 3.2, 0.5, '#15171c');
            for (let k = 0; k < 3; k++) { P(-1.25 + k * 1.0, -0.2, 0.25, 0.15, '#f2c21b'); P(-1.0 + k * 1.0, -0.075, 0.25, 0.15, '#f2c21b'); P(-1.25 + k * 1.0, 0.05, 0.25, 0.15, '#f2c21b'); } }
          else { P(-1.6, -0.5, 3.2, 1.0, '#15171c'); for (let k = 0; k < 3; k++) { P(-1.25 + k * 1.0, -0.4, 0.3, 0.3, '#b08c14'); P(-0.95 + k * 1.0, -0.15, 0.3, 0.3, '#b08c14'); P(-1.25 + k * 1.0, 0.1, 0.3, 0.3, '#b08c14'); }
            P(-1.5, 0.5, 0.15, 0.6, '#5a4632'); P(1.35, 0.5, 0.15, 0.6, '#5a4632'); }   // face up, its two posts
        } else {
          if (d < 0.5) { view.ctx.fillStyle = 'rgba(10,12,16,0.28)'; view.ctx.fillRect(0.2 * p, 0.1 * p, 1.8 * p, 0.6 * p);
            P(-0.15, -0.15, 0.3, 0.3, '#3a3f47'); P(0.15, -0.55, 1.3, 0.75, c.col || '#c8302c'); P(0.15, -0.55, 1.3, 0.12, 'rgba(255,255,255,0.35)'); }
          else { P(-1.1, -0.06, 2.2, 0.12, '#5a5f68'); P(0.6, 0.06, 0.8, 0.5, c.col || '#c8302c'); P(0.9, 0.2, 0.5, 0.3, shade(c.col || '#c8302c', 0.7)); }   // pole down, cloth crumpled
        }
        view.ctx.restore(); continue;
      }
      if (PIXEL && drawPixelObject(c)) { view.ctx.restore(); continue; }

      if (c.kind === 'banger') {
        const p = PPMz();
        view.ctx.rotate(c.ang);
        // Cast shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.44)';
        roundRect(view.ctx, -2.1 * p + 3, -1.0 * p + 4, 4.2 * p, 2.0 * p, 5); view.ctx.fill();
        // Dented banger body with primer & rust patches
        view.ctx.fillStyle = c.paint || '#7c342a';
        roundRect(view.ctx, -2.1 * p, -1.0 * p, 4.2 * p, 2.0 * p, 4); view.ctx.fill();
        view.ctx.strokeStyle = '#181a1f'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Heavy triangular welded iron roof fin with driver number
        view.ctx.fillStyle = '#1e2129';
        view.ctx.fillRect(-0.4 * p, -0.15 * p, 1.4 * p, 0.3 * p);
        view.ctx.fillStyle = '#f8fafc';
        view.ctx.font = `900 ${Math.round(1.05 * p)}px Impact, ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText(c.num || '42', 0.3 * p, 0);
        // Smashed windscreen & open cabin showing welded H-frame roll-bar
        view.ctx.fillStyle = '#14161c';
        roundRect(view.ctx, -0.8 * p, -0.75 * p, 1.9 * p, 1.5 * p, 2); view.ctx.fill();
        // Steel roll-cage crossbars
        view.ctx.strokeStyle = '#e2e8f0'; view.ctx.lineWidth = 1.5;
        view.ctx.beginPath();
        view.ctx.moveTo(-0.5 * p, -0.6 * p); view.ctx.lineTo(0.7 * p, 0.6 * p);
        view.ctx.moveTo(-0.5 * p, 0.6 * p); view.ctx.lineTo(0.7 * p, -0.6 * p);
        view.ctx.stroke();
        // Crumpled front wing & exposed radiator
        view.ctx.fillStyle = '#3a3e48';
        view.ctx.fillRect(1.8 * p, -0.6 * p, 0.3 * p, 1.2 * p);
        // Smashed headlight
        view.ctx.fillStyle = '#fff6dc';
        view.ctx.beginPath(); view.ctx.arc(1.9 * p, -0.6 * p, 0.15 * p, 0, Math.PI * 2); view.ctx.fill();
        // Sponsor stencil on boot
        view.ctx.fillStyle = 'rgba(255,255,255,0.7)';
        view.ctx.font = `700 ${Math.round(0.35 * p)}px ui-monospace, monospace`;
        view.ctx.fillText("BILL'S SCRAP", -1.3 * p, 0);
        view.ctx.restore();
        continue;
      }

      if (c.kind === 'caravan') {
        const p = PPMz();
        view.ctx.rotate(c.ang);
        // Cast shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.40)';
        roundRect(view.ctx, -2.4 * p + 4, -1.1 * p + 5, 4.8 * p, 2.2 * p, 7); view.ctx.fill();
        // Steel A-frame tow hitch with black jockey wheel
        view.ctx.strokeStyle = '#5a6270'; view.ctx.lineWidth = Math.max(2, 0.14 * p);
        view.ctx.beginPath(); view.ctx.moveTo(2.4 * p, -0.35 * p); view.ctx.lineTo(3.3 * p, 0); view.ctx.lineTo(2.4 * p, 0.35 * p); view.ctx.stroke();
        // Jockey wheel
        view.ctx.fillStyle = '#111';
        view.ctx.fillRect(3.1 * p, -0.15 * p, 0.3 * p, 0.3 * p);
        // Green gas bottle mounted on A-frame
        view.ctx.fillStyle = '#2d6a4f';
        roundRect(view.ctx, 2.5 * p, -0.2 * p, 0.4 * p, 0.4 * p, 2); view.ctx.fill();
        // Rounded retro tourer body in classic warm cream
        view.ctx.fillStyle = '#f4f0e6';
        roundRect(view.ctx, -2.4 * p, -1.1 * p, 4.8 * p, 2.2 * p, 6); view.ctx.fill();
        view.ctx.strokeStyle = '#9ca3af'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Burnt-orange & chocolate dual vintage beltline stripes
        view.ctx.fillStyle = '#c0561a';
        view.ctx.fillRect(-2.3 * p, -0.22 * p, 4.6 * p, 0.28 * p);
        view.ctx.fillStyle = '#5a280d';
        view.ctx.fillRect(-2.3 * p, 0.08 * p, 4.6 * p, 0.12 * p);
        // Pop-up roof vent hatch
        view.ctx.fillStyle = '#d8d4c8';
        roundRect(view.ctx, -0.4 * p, -0.4 * p, 0.8 * p, 0.8 * p, 2); view.ctx.fill();
        view.ctx.fillStyle = 'rgba(0,0,0,0.18)';
        view.ctx.fillRect(-0.4 * p, 0.3 * p, 0.8 * p, 0.1 * p); // vent shadow
        // Tinted panoramic front & rear windows with curtain borders
        view.ctx.fillStyle = '#1e293b';
        roundRect(view.ctx, 1.7 * p, -0.85 * p, 0.5 * p, 1.7 * p, 1.5); view.ctx.fill();
        roundRect(view.ctx, -2.2 * p, -0.85 * p, 0.5 * p, 1.7 * p, 1.5); view.ctx.fill();
        view.ctx.fillStyle = '#ffffff'; // White curtain trim
        view.ctx.fillRect(1.7 * p, -0.85 * p, 0.1 * p, 1.7 * p);
        view.ctx.fillRect(-1.8 * p, -0.85 * p, 0.1 * p, 1.7 * p);
        // Side door with handle
        view.ctx.strokeStyle = '#94a3b8'; view.ctx.lineWidth = 1;
        view.ctx.strokeRect(-0.8 * p, 0.4 * p, 1.0 * p, 0.7 * p);
        view.ctx.fillStyle = '#cbd5e1';
        view.ctx.fillRect(-0.7 * p, 0.65 * p, 0.15 * p, 0.15 * p); // handle
        // Amber side marker lights and red circular taillights
        view.ctx.fillStyle = '#f59e0b';
        view.ctx.fillRect(-1.0 * p, -1.15 * p, 0.2 * p, 0.1 * p);
        view.ctx.fillRect(1.0 * p, -1.15 * p, 0.2 * p, 0.1 * p);
        view.ctx.fillStyle = '#ef4444';
        view.ctx.beginPath(); view.ctx.arc(-2.4 * p, -0.7 * p, 0.12 * p, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.beginPath(); view.ctx.arc(-2.4 * p, 0.7 * p, 0.12 * p, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.restore();
        continue;
      }

      if (c.kind === 'podium') {
        const p = PPMz();
        view.ctx.rotate(c.ang);
        // Ground shadow
        view.ctx.fillStyle = 'rgba(10,12,16,0.38)';
        roundRect(view.ctx, -1.8 * p + 3, -1.0 * p + 4, 3.6 * p, 2.0 * p, 3); view.ctx.fill();
        // 3 stepped blocks: 2nd (left), 1st (center), 3rd (right)
        // Center 1st place tier
        view.ctx.fillStyle = '#b4783e';
        roundRect(view.ctx, -0.6 * p, -1.0 * p, 1.2 * p, 2.0 * p, 2); view.ctx.fill();
        view.ctx.strokeStyle = '#5a3512'; view.ctx.lineWidth = 1.2; view.ctx.stroke();
        // Left 2nd place tier
        view.ctx.fillStyle = '#9b622e';
        roundRect(view.ctx, -1.7 * p, -0.85 * p, 1.1 * p, 1.7 * p, 2); view.ctx.fill();
        view.ctx.stroke();
        // Right 3rd place tier
        view.ctx.fillStyle = '#874f20';
        roundRect(view.ctx, 0.6 * p, -0.75 * p, 1.1 * p, 1.5 * p, 2); view.ctx.fill();
        view.ctx.stroke();
        // Chequered bunting skirt along the front bottom
        const checkW = 0.3 * p;
        for (let cx = -1.7 * p; cx < 1.7 * p; cx += checkW) {
          view.ctx.fillStyle = Math.floor(cx / checkW) % 2 === 0 ? '#111' : '#fff';
          view.ctx.fillRect(cx, 0.85 * p, checkW, 0.15 * p);
        }
        // Numerals 1, 2, 3
        view.ctx.fillStyle = '#ffffff';
        view.ctx.font = `900 ${Math.round(0.75 * p)}px ui-sans-serif, sans-serif`;
        view.ctx.textAlign = 'center'; view.ctx.textBaseline = 'middle';
        view.ctx.fillText('1', 0, 0.3 * p);
        view.ctx.fillText('2', -1.15 * p, 0.3 * p);
        view.ctx.fillText('3', 1.15 * p, 0.3 * p);
        // Gold / Silver / Bronze trophy cups on the top steps!
        // 1st place Gold cup
        view.ctx.fillStyle = '#eab308';
        view.ctx.fillRect(-0.25 * p, -0.75 * p, 0.5 * p, 0.45 * p);
        view.ctx.fillRect(-0.15 * p, -0.3 * p, 0.3 * p, 0.15 * p);
        view.ctx.strokeStyle = '#ca8a04'; view.ctx.lineWidth = 1.2;
        view.ctx.beginPath(); view.ctx.arc(0, -0.52 * p, 0.35 * p, -0.6, 0.6); view.ctx.stroke(); // cup handles
        // 2nd place Silver cup
        view.ctx.fillStyle = '#cbd5e1';
        view.ctx.fillRect(-1.35 * p, -0.65 * p, 0.4 * p, 0.35 * p);
        view.ctx.fillRect(-1.25 * p, -0.3 * p, 0.2 * p, 0.12 * p);
        // 3rd place Bronze cup
        view.ctx.fillStyle = '#b45309';
        view.ctx.fillRect(0.95 * p, -0.55 * p, 0.4 * p, 0.35 * p);
        view.ctx.fillRect(1.05 * p, -0.2 * p, 0.2 * p, 0.12 * p);
        view.ctx.restore();
        continue;
      }

      if (c.kind === 'tyrestack' || c.kind === 'tyre') {
        const tr = (c.r || 0.42) * PPMz();
        const mode = c.mode || (c.kind === 'tyrestack' ? 'stack' : 'flat');

        if (mode === 'roll') {
          // Upright rolling tyre seen from above: rounded tread capsule rolling along c.ang
          view.ctx.rotate(c.ang);
          const tw = tr * 0.24;
          // Rolling shadow
          view.ctx.fillStyle = 'rgba(12,14,18,0.40)';
          roundRect(view.ctx, -tr * 0.95 + 2, -tw + 2, tr * 1.9, tw * 2, tw);
          view.ctx.fill();

          // Outer rubber tread body with fully rounded semicircle caps (radius = tw)
          view.ctx.fillStyle = '#202228';
          roundRect(view.ctx, -tr * 0.95, -tw, tr * 1.9, tw * 2, tw);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.2;
          view.ctx.stroke();

          // Scrolling tread grooves / sipes
          view.ctx.fillStyle = '#101114';
          const rollOff = ((c.rollDist || 0) * PPMz()) % (tr * 0.35);
          for (let gx = -tr * 0.70 + rollOff; gx < tr * 0.70; gx += tr * 0.35) {
            view.ctx.fillRect(gx, -tw * 0.85, 2, tw * 1.7);
          }
        } else if (mode === 'flip') {
          // Tumbling end-over-end — always completely rounded, circular/elliptical perspective
          view.ctx.rotate(c.ang);
          const flipScale = Math.abs(Math.cos(c.flipPhase || 0));
          const faceH = tr * Math.max(0.18, flipScale);

          // Contact / tumbling ground shadow
          view.ctx.fillStyle = 'rgba(12,14,18,0.36)';
          view.ctx.beginPath();
          view.ctx.ellipse(2, 3, tr * 1.05, faceH * 1.05, 0, 0, Math.PI * 2);
          view.ctx.fill();

          // If tilted edge-on, show the cylindrical curved tread thickness behind the face
          if (flipScale < 0.45) {
            view.ctx.fillStyle = '#14151a';
            view.ctx.beginPath();
            view.ctx.ellipse(0, tr * 0.16 * (1 - flipScale), tr * 0.98, faceH * 0.95, 0, 0, Math.PI * 2);
            view.ctx.fill();
          }

          // Main circular/elliptical tyre face (zero square corners)
          view.ctx.fillStyle = '#24262e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr, faceH, 0, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.4;
          view.ctx.stroke();

          // Sidewall sponsor stencils (compressed with faceH)
          if (faceH > tr * 0.35) {
            view.ctx.strokeStyle = '#ffffff';
            view.ctx.lineWidth = Math.max(1, tr * 0.08);
            view.ctx.beginPath();
            view.ctx.ellipse(0, 0, tr * 0.65, faceH * 0.65, 0, 0.3, 1.9);
            view.ctx.stroke();
            view.ctx.beginPath();
            view.ctx.ellipse(0, 0, tr * 0.65, faceH * 0.65, 0, 3.4, 5.0);
            view.ctx.stroke();
          }

          // Inner hollow hub hole
          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr * 0.44, faceH * 0.44, 0, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#1e2026';
          view.ctx.lineWidth = 1.1;
          view.ctx.stroke();
        } else if (mode === 'wobble') {
          // Precessing Euler wobble before slapping flat
          view.ctx.rotate(c.ang + Math.sin(c.wobblePhase || 0) * 0.4);
          const tiltScale = 0.65 + 0.35 * Math.abs(Math.sin(c.wobblePhase || 0));

          view.ctx.fillStyle = 'rgba(12,14,18,0.35)';
          view.ctx.beginPath();
          view.ctx.arc(2, 2.5, tr * 1.04, 0, Math.PI * 2);
          view.ctx.fill();

          view.ctx.fillStyle = '#24262e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr, tr * tiltScale, 0, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.3;
          view.ctx.stroke();

          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.ellipse(0, 0, tr * 0.44, tr * 0.44 * tiltScale, 0, 0, Math.PI * 2);
          view.ctx.fill();
        } else if (mode === 'stack') {
          // Standing 3-tier tyre stack seen from above
          view.ctx.fillStyle = 'rgba(14,16,20,0.38)';
          view.ctx.beginPath();
          view.ctx.arc(2.5, 3.5, tr * 1.08, 0, Math.PI * 2);
          view.ctx.fill();

          // Tier 1 (bottom tyre offset ring)
          view.ctx.fillStyle = '#181920';
          view.ctx.beginPath();
          view.ctx.arc(-1.5, -1.5, tr * 1.06, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#484c58';
          view.ctx.lineWidth = 1.1;
          view.ctx.stroke();

          // Tier 2 (middle tyre offset ring)
          view.ctx.fillStyle = '#1f2128';
          view.ctx.beginPath();
          view.ctx.arc(1.2, 1.2, tr * 1.02, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#555a68';
          view.ctx.lineWidth = 1.1;
          view.ctx.stroke();

          // Top Tyre (pure circle)
          view.ctx.fillStyle = '#262830';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.4;
          view.ctx.stroke();

          view.ctx.strokeStyle = '#14151a';
          view.ctx.lineWidth = Math.max(1, tr * 0.16);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.84, 0, Math.PI * 2);
          view.ctx.stroke();

          // Sidewall sponsor stencils
          view.ctx.strokeStyle = '#ffffff';
          view.ctx.lineWidth = Math.max(1, tr * 0.09);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 0.3, 1.9);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 3.4, 5.0);
          view.ctx.stroke();

          view.ctx.strokeStyle = '#f5c518';
          view.ctx.lineWidth = Math.max(1, tr * 0.05);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 2.1, 2.7);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 5.2, 5.8);
          view.ctx.stroke();

          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.44, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#1e2026';
          view.ctx.lineWidth = 1.2;
          view.ctx.stroke();
        } else {
          // Single flat tyre lying on ground — 100% PURE CIRCLE (zero oval)
          view.ctx.rotate(c.ang);

          // Circular contact shadow
          view.ctx.fillStyle = 'rgba(12,14,18,0.36)';
          view.ctx.beginPath();
          view.ctx.arc(2.0, 2.5, tr * 1.05, 0, Math.PI * 2);
          view.ctx.fill();

          // Main tyre rubber body (pure circle)
          view.ctx.fillStyle = '#24262e';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr, 0, Math.PI * 2);
          view.ctx.fill();

          // High-contrast outer silhouette ring
          view.ctx.strokeStyle = '#686f82';
          view.ctx.lineWidth = 1.4;
          view.ctx.stroke();

          // Tread groove ring
          view.ctx.strokeStyle = '#14151a';
          view.ctx.lineWidth = Math.max(1, tr * 0.16);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.84, 0, Math.PI * 2);
          view.ctx.stroke();

          // Sidewall sponsor stencils (rotates with c.ang)
          view.ctx.strokeStyle = '#ffffff';
          view.ctx.lineWidth = Math.max(1, tr * 0.09);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 0.3, 1.9);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 3.4, 5.0);
          view.ctx.stroke();

          view.ctx.strokeStyle = '#f5c518';
          view.ctx.lineWidth = Math.max(1, tr * 0.05);
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 2.1, 2.7);
          view.ctx.stroke();
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.65, 5.2, 5.8);
          view.ctx.stroke();

          // Inner hollow hole
          view.ctx.fillStyle = '#0a0b0e';
          view.ctx.beginPath();
          view.ctx.arc(0, 0, tr * 0.44, 0, Math.PI * 2);
          view.ctx.fill();
          view.ctx.strokeStyle = '#1e2026';
          view.ctx.lineWidth = 1.2;
          view.ctx.stroke();
        }
        view.ctx.restore();
        continue;
      }

      if (d > 0.02) {
        // ---- lying down: the cone's body stretches out along `ang`, the base stays put
        view.ctx.rotate(c.ang);
        const len = r * (1.0 + 2.6 * d);
        view.ctx.fillStyle = 'rgba(40,38,46,0.18)';
        view.ctx.beginPath();
        view.ctx.ellipse(len * 0.3 + 2, 2.5, len * 0.78, r * 1.1, 0, 0, Math.PI * 2);
        view.ctx.fill();
        // body, tapering to the tip
        view.ctx.fillStyle = COL.cone;
        view.ctx.beginPath();
        view.ctx.moveTo(0, -r * 1.25);
        view.ctx.lineTo(len, -r * 0.34);
        view.ctx.lineTo(len, r * 0.34);
        view.ctx.lineTo(0, r * 1.25);
        view.ctx.closePath();
        view.ctx.fill();
        // the reflective band, now a stripe across the lying body
        view.ctx.fillStyle = COL.coneBand;
        view.ctx.beginPath();
        view.ctx.moveTo(len * 0.52, -r * 0.72);
        view.ctx.lineTo(len * 0.74, -r * 0.48);
        view.ctx.lineTo(len * 0.74, r * 0.48);
        view.ctx.lineTo(len * 0.52, r * 0.72);
        view.ctx.closePath();
        view.ctx.fill();
        // square base plate
        view.ctx.fillStyle = COL.coneDark;
        roundRect(view.ctx, -r * 0.5, -r * 1.45, r * 1.0, r * 2.9, 2);
        view.ctx.fill();
      } else {
        // ---- upright: concentric rings, seen from above
        view.ctx.fillStyle = 'rgba(40,38,46,0.20)';
        view.ctx.beginPath(); view.ctx.ellipse(r * 0.5, r * 0.7, r * 1.35, r * 1.0, 0, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.coneDark;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.cone;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.coneBand;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2); view.ctx.fill();
        view.ctx.fillStyle = COL.cone;
        view.ctx.beginPath(); view.ctx.arc(0, 0, r * 0.46, 0, Math.PI * 2); view.ctx.fill();
      }
      view.ctx.restore();
    }
  }

  // ---------------------------------------------------------------- thrown material
  // Wall clock (rule 5): something the player WATCHES must not complete inside one frame.
  //
  // One pool serves both the cone puffs and the wheel spray (user, 2026-09-28: "floor with a loose
  // surface like snow mud sand or grass should particle emit and small and kick up dust / dirt / grass
  // / snow"). WHAT gets thrown is entirely the SURFACE's business — colour, size, rate, how far it is
  // flung, how long it hangs and how much it blooms all come off `surface.spray` in lab.js. This file
  // never learns what snow is, which is the same seam the marks layer uses.
  const puffs = [];
  const MAX_PUFFS = 220;      // raised from 40: four wheels throwing continuously needs the headroom
  function emit(x, y, vx, vy, sp, scale) {
    if (puffs.length >= MAX_PUFFS) puffs.shift();          // cap; drop the oldest (§4)
    const a = Math.random() * 6.2832;
    const f = sp.lift * scale * (0.35 + Math.random() * 0.65);
    puffs.push({
      x, y, age: 0,
      life: sp.life * (0.7 + Math.random() * 0.6),
      r0: sp.size * (0.7 + Math.random() * 0.7),
      grow: sp.grow, rgb: sp.rgb,
      // thrown BACKWARDS off the contact patch plus a scatter, so it trails the car instead of sitting
      // under it — material is flung opposite to the way the wheel is travelling
      vx: -vx * 0.28 + Math.cos(a) * f,
      vy: -vy * 0.28 + Math.sin(a) * f,
    });
  }

  // Cone hits: the same pool, with a fixed pale dust.
  const CONE_DUST = { rgb: '185,178,164', size: 0.18, lift: 2.2, life: 0.45, grow: 0.55 };
  // a burst BALE throws a big slow straw-coloured cloud (user: "they explode with dust")
  const BALE_DUST = { rgb: '214,190,128', size: 0.55, lift: 1.6, life: 1.4, grow: 1.1 };
  // a popped SHEEP (S-C): a white FLUFF cloud, no gore
  const FLUFF_PUFF = { rgb: '248,247,240', size: 0.5, lift: 3.2, life: 1.5, grow: 1.0 };
  function addPuffs(hits) {
    for (const h of hits) {
      if (h.kind === 'fluff') { for (let i = 0; i < 5; i++) emit(h.x, h.y, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 4, FLUFF_PUFF, 1); continue; }
      if (h.kind === 'bale') { for (let i = 0; i < 4; i++) emit(h.x, h.y, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, BALE_DUST, 1); continue; }
      const n = Math.min(3, 1 + Math.floor(h.speed / 6));
      for (let i = 0; i < n; i++) emit(h.x, h.y, 0, 0, CONE_DUST, 1);
    }
  }

  // WHEEL SPRAY. The rate rises with how hard the wheels are actually WORKING — rolling speed plus any
  // slipping — so cruising over gravel ticks along quietly and a slide throws a rooster tail. It keeps
  // a fractional remainder, because a rate below one particle per frame must still emit at the right
  // average rather than rounding to nothing.
  let sprayDebt = 0;
  function addSpray(car, marks, wallDt) {
    const sp = car.surface.spray;
    if (!sp) { sprayDebt = 0; return; }
    const v = Math.hypot(car.vx, car.vy);
    if (v < 1.5) { sprayDebt = 0; return; }
    const slip = Math.max(car.t.slipSpeedF, car.t.slipSpeedR);
    const work = Math.min(1, v / 26) * 0.55 + Math.min(1, slip / 9) * 0.75;
    // airborne wheels throw nothing — there is nothing under them to throw
    const grounded = Math.max(0, Math.min(1, (car.t.loadKF + car.t.loadKR) / 2));
    sprayDebt += sp.rate * work * grounded * wallDt;
    let n = Math.floor(sprayDebt);
    sprayDebt -= n;
    if (n > 12) n = 12;                                    // never let a frame spike flood the pool
    const wheels = marks.wheelsOf(car);
    for (let i = 0; i < n; i++) {
      const w = wheels[(Math.random() * 4) | 0];
      emit(w.x, w.y, car.vx, car.vy, sp, 0.4 + work);
    }
  }

  // TYRE SMOKE (user, 2026-10-03: "smoke when too hot"). Each tyre over SMOKE_T that is also slipping puffs
  // white-grey smoke at a rate set by how hot and how hard — the silent twin of a squeal (CLAUDE.md §4).
  const SMOKE_T = 115;
  const SMOKE = { rgb: '225,225,230', size: 0.45, lift: 0.9, life: 1.3, grow: 1.9 };
  let smokeDebt = 0;
  function addSmoke(car, marks, wallDt) {
    if (!car.tyreT) return;
    const wheels = marks.wheelsOf(car);
    for (const w of wheels) {
      if (w.heat < SMOKE_T || w.slip < 1.5) continue;
      smokeDebt += Math.min(1, (w.heat - SMOKE_T) / 40 + 0.3) * Math.min(1, w.slip / 6) * 40 * wallDt;
      while (smokeDebt >= 1) { smokeDebt--; emit(w.x, w.y, car.vx * 0.6, car.vy * 0.6, SMOKE, 0.5); }
    }
    if (smokeDebt > 4) smokeDebt = 4;
  }
  // a badly hit front (damage.js wreck.smoke) trails grey smoke from the nose — the silent twin of a damaged engine
  const DSMOKE = { rgb: '120,120,128', size: 0.5, lift: 0.7, life: 1.1, grow: 1.6 };
  function addDamageSmoke(car, wallDt) {
    if (!car.wreck || !car.wreck.smoke) return;
    car._dsDebt = (car._dsDebt || 0) + (Math.hypot(car.vx, car.vy) > 2 ? 10 : 2.5) * wallDt;   // a stopped wreck: a thin wisp (10/s piled into a square haze)
    const ch = Math.cos(car.heading), sh = Math.sin(car.heading), f = car.spec.len * 0.45;
    while (car._dsDebt >= 1) { car._dsDebt--; emit(car.x + ch * f, car.y + sh * f, car.vx * 0.4, car.vy * 0.4, DSMOKE, 0.6); }
  }
  // PAINT CHIPS: every hit (damage.js dmgEvents) flings square pixels of the car's paint (and some primer / black trim) from the hurt corner;
  // they skid to a stop and lie on the ground a few seconds. Wall clock (rule 5: watched). Capped, oldest dropped (§4).
  const chips = [], MAX_CHIPS = 400;
  function addChips(car) {
    const ev = car.dmgEvents; if (!ev || !ev.length) return;
    const s = car.spec, ch = Math.cos(car.heading), sh = Math.sin(car.heading);
    for (const e of ev) {
      const n = e.scrape ? 3 : Math.min(60, Math.round(8 + 90 * e.amt)), fx = (e.c < 2 ? 1 : -1) * s.len * 0.48, fy = (e.c % 2 ? 1 : -1) * s.wid * 0.45;
      const wx = car.x + ch * fx - sh * fy, wy = car.y + sh * fx + ch * fy;
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.2832, v = 1.5 + Math.random() * (e.scrape ? 3 : 4 + 14 * e.amt), r = Math.random();
        if (chips.length >= MAX_CHIPS) chips.shift();
        chips.push({ x: wx, y: wy, vx: car.vx * 0.5 + Math.cos(a) * v, vy: car.vy * 0.5 + Math.sin(a) * v, age: 0, life: 6 + Math.random() * 6,
          col: r < 0.75 ? (s.paint || '#d0552f') : r < 0.88 ? '#9a9aa2' : '#22242a', sz: 2 + (Math.random() < 0.35 ? 1 : 0) });   // art px: visible at phone zoom
      }
    }
    ev.length = 0;
  }
  // SPARKS (roll.js car.sparks: on its side / roof on hard ground): short bright pixels thrown back from the body, wall clock
  function addSparks(car, wallDt) {
    if (!car.sparks) return;
    car._spDebt = (car._spDebt || 0) + 60 * wallDt;
    while (car._spDebt >= 1) { car._spDebt--;
      const a = Math.random() * 6.2832, v = 2 + Math.random() * 6, ox = (Math.random() - 0.5) * car.spec.len, oy = (Math.random() - 0.5) * car.spec.wid, ch = Math.cos(car.heading), sh = Math.sin(car.heading);
      if (chips.length >= MAX_CHIPS) chips.shift();
      chips.push({ x: car.x + ch * ox - sh * oy, y: car.y + sh * ox + ch * oy, vx: -car.vx * 0.3 + Math.cos(a) * v, vy: -car.vy * 0.3 + Math.sin(a) * v, age: 0, life: 0.25 + Math.random() * 0.3, col: Math.random() < 0.6 ? '#ffd85a' : '#ffffff', sz: 2 });
    }
  }
  function drawChips(wallDt) {
    const u = PPMz() / SPRITE_PPM;
    for (let i = chips.length - 1; i >= 0; i--) {
      const q = chips[i]; q.age += wallDt; if (q.age > q.life) { chips.splice(i, 1); continue; }
      q.x += q.vx * wallDt; q.y += q.vy * wallDt; const k = Math.max(0, 1 - 4 * wallDt); q.vx *= k; q.vy *= k;   // skid to a stop
      view.ctx.globalAlpha = Math.min(1, q.life - q.age); view.ctx.fillStyle = q.col;
      const z = Math.max(1, Math.round(q.sz * u)); view.ctx.fillRect(Math.round(sx(q.x) - z / 2), Math.round(sy(q.y) - z / 2), z, z);
    }
    view.ctx.globalAlpha = 1;
  }
  function drawPuffs(wallDt) {
    const p = PPMz();
    for (let i = puffs.length - 1; i >= 0; i--) {
      const q = puffs[i];
      q.age += wallDt;
      if (q.age >= q.life) { puffs.splice(i, 1); continue; }
      const t = q.age / q.life;
      q.x += q.vx * wallDt; q.y += q.vy * wallDt;
      q.vx *= 1 - 2.6 * wallDt; q.vy *= 1 - 2.6 * wallDt;   // air drag: clods slow and settle
      view.ctx.fillStyle = `rgb(${q.rgb})`;
      if (PIXEL) {
        // PIXEL PUFFS: a square snapped to the art-pixel grid, fading in STEPS (pixel-art smoke), not a smooth disc
        view.ctx.globalAlpha = Math.ceil((1 - t) * 4) / 4 * 0.5;
        const rr = Math.max(1, Math.round((q.r0 + t * q.grow) * p * view.dpr));
        const bx = Math.round(sx(q.x) * view.dpr), by = Math.round(sy(q.y) * view.dpr);
        view.ctx.save(); view.ctx.setTransform(1, 0, 0, 1, 0, 0); view.ctx.fillRect(bx - rr, by - rr, rr * 2, rr * 2); view.ctx.restore();
        continue;
      }
      view.ctx.globalAlpha = (1 - t) * 0.55;
      view.ctx.beginPath();
      view.ctx.arc(sx(q.x), sy(q.y), (q.r0 + t * q.grow) * p, 0, Math.PI * 2);
      view.ctx.fill();
    }
    view.ctx.globalAlpha = 1;
  }
  const { pixelCar, faceCache, drawPixelCar, drawCar } = createCars(view, cam, { PPMz, sx, sy, roundRect });


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

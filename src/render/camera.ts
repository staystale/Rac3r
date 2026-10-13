// the CAMERA of render.ts (phase 4 of the render.js split): follow, speed zoom, the level
// fly-in and the overview picture. Moved verbatim.
import { FX0, FX1, FY0, FY1 } from "../world/bounds.ts";
import { LEVEL } from "../world/state.ts";
import { meterEvent } from "../ui/meter.ts";
// LOOKAHEAD, ZOOM_MIN: read only inside functions (draw time), so the import cycle is harmless
import { LOOKAHEAD, ZOOM_MIN } from "../render.ts";
import type { Cam, CamCar, CamState, TileBudget, View } from "./types.ts";

// what createCamera destructures from the renderer
interface CameraHelpers {
  PPMz: () => number;
  drawFloor: () => void;
  drawZones: () => void;
  drawLanes: () => void;
  drawTrackRibbon: () => void;
  drawPatches: () => void;
  drawCovers: () => void;
  drawCurvedKerbs: () => void;
  paletteSnap: (c: HTMLCanvasElement) => void;
  prefetch: (k: number, cx: number, cy: number, z: number, budget: TileBudget) => void;
}

export function createCamera(view: View, cam: Cam, helpers: CameraHelpers) {
  const {
    PPMz, drawFloor, drawZones, drawLanes, drawTrackRibbon, drawPatches, drawCovers,
    drawCurvedKerbs, paletteSnap,
  } = helpers;

  // camera follows with a lead in the direction of travel, smoothed on the WALL CLOCK (rule 5 —
  // this is something the player watches, so it must not run on sim time)
  function follow(car: CamCar, wallDt: number) {
    // Lead scaled by the zoom: at 50 m/s a flat 0.35 s lead is 18 m, which on a zoomed-in view
    // shoves the car to the edge of the screen. Zoomed out there is room for it, zoomed in there
    // is not.
    const lead = 0.35 * view.zoom;
    // LOCKED TO THE CAR, ONLY THE LEAD IS SMOOTHED (user, 2026-10-03: "camera / car tracking still
    // seems jittery"). The camera used to chase car + lead with an exponential lerp. MEASURED:
    // with uneven frame times the lerp's lag changes by ~v*dt/2 — half a metre at 200 km/h — so
    // the car twitched against the camera even after the render interpolation made the car itself
    // smooth. Now the camera sits RIGIDLY on the (interpolated) car and only the look-ahead offset
    // eases, so the car holds still on screen and the view only drifts as speed / direction
    // change.
    let leadX = car.vx * lead, leadY = car.vy * lead;
    // THE TREADMILL (endless highway, user 2026-10-05: "it can never drive off the screen"): the
    // camera stays rigid on the car (as everywhere) but the lead points UP THE ROAD (highway.js
    // camDir, the next ~60 m), not along the velocity, and is a share of the view: the car sits
    // ~3/4 down the screen with the road ahead above it. Capped sideways so a 60 deg bend cannot
    // push the car off the side of a narrow portrait screen.
    const hwy = LEVEL.endless && LEVEL._hw;
    if (hwy && hwy.camDir) { const ppm = PPMz(), ahead = 0.26 * view.H / ppm,
      sideLimit = 0.2 * view.W / ppm;
      leadX = Math.max(-sideLimit, Math.min(sideLimit, hwy.camDir.x * ahead));
      leadY = hwy.camDir.y * ahead; }
    if (!cam.initialised) { cam.lx = leadX; cam.ly = leadY; cam.initialised = true; }
    // hand-over from the fly-in
    if (cam.lx === undefined) { cam.lx = cam.x - car.x; cam.ly = cam.y - car.y; }
    const blend = 1 - Math.exp(-4 * wallDt);
    // cam.ly! throughout: set together with lx just above
    cam.lx += (leadX - cam.lx) * blend; cam.ly! += (leadY - cam.ly!) * blend;
    cam.x = car.x + cam.lx; cam.y = car.y + cam.ly!;
  }

  // SPEED ZOOM. Asked for by the user and by the playtesters: above ~120 km/h the car was running
  // off the screen because the view showed a fixed number of metres however fast you were going.
  // Zoom out with speed so the distance you can SEE scales with the distance you cover. Smoothed
  // on the WALL CLOCK (rule 5) — a zoom is something the player watches, and an unsmoothed one
  // pumps on every gearchange.
  // LEVEL FLY-IN (playtesters, re-asked by the user 2026-10-03 after DeepSeek's version was
  // reverted): every level start opens on the WHOLE level, then eases in to the car over FLY_TIME,
  // so you see what is around before you drive. Wall clock (rule 5: the player watches it). The
  // player can drive during it.
  const FLY_HOLD = 0.45;          // s held on the whole-level view before moving
  const FLY_TIME = 1.5;           // s of the move itself (ease-in-out, in log zoom)
  // the camera state other layers read: fly (the fly-in, or null), ovCache (the overview picture),
  // vZoom (the slow-averaged speed), pinZoom (tools only: debugZoom - the photo tools pin the wide
  // view)
  const camState: CamState = { fly: null, ovCache: null, vZoom: null, pinZoom: null };
  // the level's extent: the circuit plus a margin, or the whole floor (shared by the fly-in and
  // the menu thumbnails)
  function levelBounds() {
    // the floor rectangle (S-B: the lab is 520 x 1000)
    let left = FX0, right = FX1, top = FY0, bottom = FY1;
    if (LEVEL.subtrack) {
      left = top = Infinity; right = bottom = -Infinity;
      for (const point of LEVEL.subtrack.pts) { left = Math.min(left, point.x);
        right = Math.max(right, point.x); top = Math.min(top, point.y);
        bottom = Math.max(bottom, point.y);
        }
      const margin = LEVEL.subtrack.width + 12; left -= margin; right += margin; top -= margin;
      bottom += margin;
    }
    return [left, top, right, bottom];
  }
  // the whole level painted flat once (the fly-in's picture), kept per level: the stand-in while
  // new ground tiles are painted THE ENDLESS ROAD MOVES ON (2026-10-06, highway judder;
  // tools/hwjudder.mjs "bare ground"): the overview was painted once over the FIRST road window,
  // so after ~1 km every stand-in frame showed dark "nothing" squares where the new ground was
  // still to come (71 of 997 frames at CPU x4). On an endless level it is repainted over the
  // CURRENT window once the road has moved on OV_REPAINT m since (the window reaches 1100 m ahead,
  // so the view never outruns it; 512 px — it only stands in for a frame or two). Off the road the
  // stand-in is the base colour (standInFill), so a view wider than the overview shows grass, not
  // a hole.
  const OV_REPAINT = 500;
  const roadS0 = () => (LEVEL.endless && LEVEL._hw && LEVEL._hw.pts.length ? LEVEL._hw.pts[0].s
    : 0);
  function levelOverview() {
    const layout = LEVEL.subtrack ? LEVEL.subtrack.layoutId || 0 : 0;
    if (camState.ovCache && camState.ovCache.level === LEVEL && camState.ovCache.layout === layout
      && (!LEVEL.endless
        || Math.abs(roadS0() - camState.ovCache.s0) < OV_REPAINT)) return camState.ovCache.ov;
    if (!(view.W > 0)) return null;
    const [left, top, right, bottom] = levelBounds();
    meterEvent('overview');
    camState.ovCache = { level: LEVEL, layout, s0: roadS0(),
      ov: paintOverview(left, top, right, bottom, LEVEL.endless ? 512 : 1024) };
    return camState.ovCache.ov;
  }
  // MENU THUMBNAIL of the CURRENT level (Test Mode track select): the same flat painter as the
  // fly-in, small.
  function thumbnail(size = 320) { const [left, top, right, bottom] = levelBounds();
    return paintOverview(left, top, right, bottom, size).c; }
  function flyIn() {
    const [left, top, right, bottom] = levelBounds();
    const zFit = Math.min(view.W / (view.PPM * (right - left)),
      view.H / (view.PPM * (bottom - top)));
    // MEASURED BUG, 2026-10-03: on a ?level= link the level loads BEFORE the canvas is measured (W
    // = 0), so zFit was 0, log(0) = -Infinity, and the zoom went NaN — "createRadialGradient:
    // non-finite" from every prop. Not measured yet = no fly-in; the tap-to-start restart runs it
    // again with a real screen.
    if (!(zFit > 0 && Number.isFinite(zFit))) { camState.fly = null; return; }
    camState.fly = { t: 0, cx: (left + right) / 2, cy: (top + bottom) / 2, z0: Math.min(1, zFit),
      ov: paintOverview(left, top, right, bottom) };
    cam.x = camState.fly.cx; cam.y = camState.fly.cy; cam.initialised = true;
    view.zoom = camState.fly.z0;
  }
  // THE FLY-IN DOES NOT USE THE TILES WHILE ZOOMED OUT. MEASURED (user: "zoom in at the start
  // seems to struggle and be glitchy"; photographed mid-flight as a blurred smear): the fly sweeps
  // ~11 tile zoom steps in 1.5 s, each needing a fresh screenful of tiles, so the screen showed
  // over-stretched stand-ins or stalled painting. Instead the whole level is painted ONCE into an
  // overview image (in the hold, when nothing moves), drawn scaled while zoom < FLY_HANDOVER,
  // while the close-up tiles round the car are pre-painted FLY_PREFETCH per frame — so by the
  // hand-over they are already there.
  const FLY_HANDOVER = 0.28, FLY_PREFETCH = 2, OVERVIEW_PX = 2048;
  function paintOverview(
    left: number, top: number, right: number, bottom: number, size = OVERVIEW_PX,
  ) {
    const width = size, height = Math.max(1, Math.round(size * (bottom - top) / (right - left)));
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d')!;   // a fresh canvas always gives a 2d context
    const keep = { ctx: view.ctx, W: view.W, H: view.H, zoom: view.zoom, cx: cam.x, cy: cam.y };
    view.ctx = ctx; view.W = width; view.H = height;
    view.zoom = width / (view.PPM * (right - left)); cam.x = (left + right) / 2;
    cam.y = (top + bottom) / 2;
    view.noPatterns = true;
    try { drawFloor(); drawZones(); drawLanes(); drawTrackRibbon(); drawPatches(); drawCovers();
      drawCurvedKerbs(); }
    finally { view.ctx = keep.ctx; view.W = keep.W; view.H = keep.H; view.zoom = keep.zoom;
      cam.x = keep.cx; cam.y = keep.cy; view.noPatterns = false; }
    paletteSnap(canvas);
    return { c: canvas, x0: left, y0: top, x1: right, y1: bottom };
  }
  function updateFly(car: CamCar, wallDt: number) {
    if (!camState.fly) return false;
    camState.fly.t += wallDt;
    const progress = Math.min(1, Math.max(0, camState.fly.t - FLY_HOLD) / FLY_TIME);
    // ease-in-out cubic
    const eased = progress < 0.5 ? 4 * progress * progress * progress
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    const lead = 0.35, targetX = car.x + car.vx * lead, targetY = car.y + car.vy * lead;
    // the PAN leads the zoom (ease-out), so by the tile hand-over the view is already round the
    // car, where its tiles were pre-painted
    const pan = 1 - Math.pow(1 - progress, 3);
    cam.x = camState.fly.cx + (targetX - camState.fly.cx) * pan;
    cam.y = camState.fly.cy + (targetY - camState.fly.cy) * pan;
    // ease in log space: even feel
    view.zoom = Math.exp(Math.log(camState.fly.z0)
      + (Math.log(1) - Math.log(camState.fly.z0)) * eased);
    if (progress >= 1) camState.fly = null;
    cam.lx = undefined;
    return true;
  }
  function updateZoom(car: CamCar, wallDt: number) {
    if (camState.pinZoom) { view.zoom = camState.pinZoom; return; }
    // PROPORTIONAL TO SPEED, properly: hold the TIME-to-horizon constant rather than easing along
    // an arbitrary curve. You always see LOOKAHEAD seconds of road, so the distance visible scales
    // directly with how fast you are covering it — which is what "zoom out proportional to speed"
    // actually means for a driver. visible = W / (PPM * zoom) = v * LOOKAHEAD  =>  zoom = W /
    // (PPM*v*T). from a SLOW-AVERAGED speed (time constant ~1.5 s): braking into a corner and
    // powering out no longer breathes the view
    const vNow = Math.hypot(car.vx, car.vy);
    camState.vZoom = camState.vZoom === null ? vNow
      : camState.vZoom + (vNow - camState.vZoom) * (1 - Math.exp(-0.65 * wallDt));
    const speed = camState.vZoom;
    const want = speed > 1 ? view.W / (view.PPM * speed * LOOKAHEAD) : 1;
    const target = Math.max(ZOOM_MIN, Math.min(1, want));
    // CALMER (2026-10-04, tools/wobblecheck: the zoom moved the screen edge ~1.1 px EVERY frame at
    // speed — the view breathed with every lift and squeeze): 2.5/s -> 0.9/s, and changes under 4
    // % of the target are ignored (dead band).
    if (Math.abs(target - view.zoom) > 0.04 * target)
      view.zoom += (target - view.zoom) * (1 - Math.exp(-0.9 * wallDt));
  }

  return {
    camState, follow, updateFly, updateZoom, flyIn, thumbnail, levelOverview, FLY_HANDOVER,
    FLY_PREFETCH,
  };
}

// hud/minimap.js — THE MINIMAP (owner, 2026-10-16, mockup B of three): a small round window under
// the top-left buttons showing the road AHEAD of the car ("so it's always clear which corner etc is
// next"). It faces the SAME WAY AS THE MAIN VIEW (owner: "the car on the mini map should face the
// same direction as the actual car, the road matching too"; it was turned heading-up at first): the
// window follows the car, pushed ahead of it in the direction of travel like the camera's lead. The
// road ahead (the level's centreline) fades out at its far end; your car is the chevron, pointing
// where the car points, rivals in the window are dots, and a thin bar under it is the stage / lap
// progress. No box, see-through,
// never touchable. Levels without a road (the lab floors) get none; the endless highway shows the
// road ahead without a progress bar (owner: "highway levels should have a minimap too"; approved;
// ?hwmap=0 = not there).
// ON / OFF lives in the pause menu, remembered per difficulty mode: on in MOBILE, GAME and REALISH,
// off in RICH, and locked off in REAL (owner).
// THE PROGRESS BAR: with the pause menu's HUD list (the default) it is a choice of its own,
// remembered per difficulty mode with the minimap's defaults (never locked); with the minimap
// off it shows alone at the top of the window's place. Without the list it comes and goes with
// the window.

import { LEVEL } from '../world/state.ts';
import { jokerLane } from '../world/joker.ts';

const SIZE = 120;            // css px, the window's diameter
const GAP = 10;              // css px under the buttons above it
const LEAD_SHARE = 0.45;     // of the window's radius: how far ahead of the car its centre sits
// ZOOMS WITH THE CAMERA (owner: "the mini map should zoom in n out with the camera / car speed"):
// its scale is the main view's divided by MAP_SHRINK, so it shows ~140 m ahead fully zoomed in and
// ~450 m fully out, and follows the camera's own smooth zoom
const MAP_SHRINK = 30;
const FADE_SHARE = 0.35;     // of the road ahead: the far end that fades out
// 1/s: the lead turns after the direction of travel (a slide does not swing it)
const LEAD_EASE = 4;
const ROAD_WIND = 1.4;       // x the straight-line reach: road shown ahead, as it winds
const NEAR_POINTS = 40;      // centreline points searched round the last match each frame
const LOST_M = 40;           // m off the matched point: search the whole centreline again
const OPACITY = 0.85;

// DIFFICULTY MODES (menu/setup.js DIFF: MOBILE, GAME, REALISH, RICH, REAL): the default per mode,
// and the one mode where it is locked off. REALISH counts as easy (owner, 2026-10-16: it is the
// default difficulty)
const DEFAULT_ON = [true, true, true, false, false];
const LOCKED_MODE = 4;
const storeKey = (mode) => 'rac3r.minimap.' + mode;
const progressKey = (mode) => 'rac3r.progress.' + mode;

// the road's two strokes, css px wide: a dark rim, then the pale road (the lap and the joker lane)
const ROAD_STROKES = [[7, 'rgba(20,20,22,0.55)'], [3.5, 'rgba(236,231,220,0.95)']];
// the joker lane is drawn too (?jokerfix=1, setMinimapJoker)
let jokerShown = false;

/**
 * The minimap setting of a difficulty mode: the device's choice, else the mode's default.
 * @param {number} mode difficulty 0 (MOBILE) .. 4 (REAL)
 * @returns {{on: boolean, locked: boolean}} on, and whether the mode allows a change
 */
export function minimapSetting(mode) {
  if (mode >= LOCKED_MODE) return { on: false, locked: true };
  let shown = DEFAULT_ON[mode] ?? false;
  try {
    const stored = localStorage.getItem(storeKey(mode));
    if (stored !== null) shown = stored === '1';
  } catch { /* no storage: the default */ }
  return { on: shown, locked: false };
}

/**
 * Remembers the minimap choice for a difficulty mode (not in the locked mode).
 * @param {number} mode difficulty 0..4
 * @param {boolean} shown shown or not
 */
export function setMinimapSetting(mode, shown) {
  if (mode >= LOCKED_MODE) return;
  try {
    localStorage.setItem(storeKey(mode), shown ? '1' : '0');
  } catch { /* no storage: this session only */ }
}

/**
 * The progress bar setting of a difficulty mode (the HUD list): the device's choice, else the
 * minimap's default for the mode.
 * @param {number} mode difficulty 0 (MOBILE) .. 4 (REAL)
 * @returns {boolean} shown
 */
export function progressSetting(mode) {
  let shown = DEFAULT_ON[mode] ?? false;
  try {
    const stored = localStorage.getItem(progressKey(mode));
    if (stored !== null) shown = stored === '1';
  } catch { /* no storage: the default */ }
  return shown;
}

/**
 * Remembers the progress bar choice for a difficulty mode.
 * @param {number} mode difficulty 0..4
 * @param {boolean} shown shown or not
 */
export function setProgressSetting(mode, shown) {
  try {
    localStorage.setItem(progressKey(mode), shown ? '1' : '0');
  } catch { /* no storage: this session only */ }
}

// across frames: the matched centreline point and the eased heading (one HUD, one minimap)
const mapState = { idx: 0, heading: null, level: null };
// is it shown: main.js hands in the source (?minimap=0, the mode, the pause setting)
let shownNow = () => false;
// is the progress bar shown: null = with the window (no HUD list); main.js hands in the source
let progressNow = null;
// the endless highway too (?hwmap=0: not there)
let onHighway = true;
// the main view's css px per m (the camera zoom included)
let viewScale = () => 20;

/**
 * Sets what decides, every frame, whether the minimap shows.
 * @param {() => boolean} source true when shown
 */
export function setMinimapSource(source) {
  shownNow = source;
}

/**
 * Sets what decides, every frame, whether the progress bar shows (the HUD list); null = with the
 * window.
 * @param {(() => boolean) | null} source true when shown
 */
export function setProgressSource(source) {
  progressNow = source;
}

/**
 * Lets the minimap show on the endless highway (the default; ?hwmap=0 = not there).
 * @param {boolean} allowed shown there too
 */
export function setMinimapHighway(allowed) {
  onHighway = allowed;
}

/**
 * Shows the joker lane on the minimap (?jokerfix=1).
 * @param {boolean} shown drawn as road beside the lap
 */
export function setMinimapJoker(shown) {
  jokerShown = shown;
}

/**
 * Draws the level's joker lane as road (the same two strokes as the lap), under the lap so the
 * junctions read as one road.
 * @param {CanvasRenderingContext2D} ctx the HUD context, in world units
 * @param {number} scale css px per m
 */
function drawJokerLane(ctx, scale) {
  const lane = jokerShown && LEVEL.joker ? jokerLane(LEVEL) : null;
  if (!lane) return;
  for (const [width, colour] of ROAD_STROKES) {
    ctx.lineWidth = width / scale;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    lane.pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
  }
}

/**
 * Sets where the minimap reads the main view's scale, so it zooms with the camera.
 * @param {() => number} source the main view's css px per m
 */
export function setMinimapView(source) {
  viewScale = source;
}

/**
 * The centreline point nearest the car: round the last match, or everywhere when lost.
 * @param {object[]} pts the centreline points
 * @param {number} x car x, m
 * @param {number} y car y, m
 * @returns {number} the point's index
 */
function nearestPoint(pts, x, y) {
  let best = mapState.idx, bestD = Infinity;
  const look = (i) => {
    const index = (i + pts.length) % pts.length, point = pts[index];
    const distSq = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (distSq < bestD) { bestD = distSq; best = index; }
  };
  for (let i = mapState.idx - NEAR_POINTS; i <= mapState.idx + NEAR_POINTS; i++) look(i);
  if (bestD > LOST_M * LOST_M) for (let i = 0; i < pts.length; i++) look(i);
  mapState.idx = best;
  return best;
}

/**
 * The window's place: under the lowest button of the top-left column.
 * @param {object} rects the HUD layout
 * @returns {{x: number, y: number}} the window's top-left corner, css px
 */
function minimapAt(rects) {
  let bottom = rects.chip.y + rects.chip.h;
  // a narrow screen puts RESTART / RESET / CLEAR on a second row on the left
  for (const rect of [rects.restart, rects.reset, rects.clear])
    if (rect.x < rects.chip.x + SIZE) bottom = Math.max(bottom, rect.y + rect.h);
  return { x: rects.chip.x, y: bottom + GAP };
}

/**
 * Draws the road ahead (the fading centreline), turned so the car's heading is up.
 * @param {CanvasRenderingContext2D} ctx the HUD context, centred on the car, scaled to m
 * @param {object[]} pts the centreline points
 * @param {number} from index of the car's point
 * @param {number|null} lap a lap circuit's length (it wraps), or null on a stage
 * @param {number} scale css px per m
 * @param {{ahead: number, behind: number}} span m of road drawn ahead of the car and behind it
 */
function drawRoad(ctx, pts, from, lap, scale, span) {
  const fade = span.ahead * FADE_SHARE;
  const startDist = pts[from].dist;
  // m from the car's point along the road, forward (> 0) or back; a lap wraps at the line
  const ahead = (point) => (lap ? (point.dist - startDist + lap) % lap : point.dist - startDist);
  const behind = (point) => (lap ? (startDist - point.dist + lap) % lap : startDist - point.dist);
  const pointAt = (i) => (lap ? pts[(i + pts.length) % pts.length] : pts[i]);
  let first = from, last = from;
  const half = pts.length / 2;
  while (first > from - half && pointAt(first - 1) && behind(pointAt(first - 1)) <= span.behind)
    first--;
  while (last < from + half && pointAt(last + 1) && ahead(pointAt(last + 1)) <= span.ahead)
    last++;
  // the solid stretch is one path; only the fading far end is stroked a segment at a time
  const solidTo = span.ahead - fade, base = ctx.globalAlpha;   // base: the window's opacity
  let solidEnd = first;
  while (solidEnd < last && (solidEnd + 1 <= from || ahead(pointAt(solidEnd + 1)) <= solidTo))
    solidEnd++;
  for (const [width, colour] of ROAD_STROKES) {
    ctx.lineWidth = width / scale;
    ctx.strokeStyle = colour;
    ctx.beginPath();
    ctx.moveTo(pointAt(first).x, pointAt(first).y);
    for (let i = first + 1; i <= solidEnd; i++) ctx.lineTo(pointAt(i).x, pointAt(i).y);
    ctx.stroke();
    for (let i = solidEnd + 1; i <= last; i++) {
      const point = pointAt(i), prev = pointAt(i - 1);
      ctx.globalAlpha = base * Math.max(0, Math.min(1, (span.ahead - ahead(point)) / fade));
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
    }
    ctx.globalAlpha = base;
  }
}

/**
 * Draws the rivals within reach of your car as dots (world units: the window's transform is set).
 * @param {CanvasRenderingContext2D} ctx the HUD context
 * @param {object} game the game (car, ai)
 * @param {number} reach m from your car
 * @param {number} scale css px per m
 */
function drawRivals(ctx, game, reach, scale) {
  const car = game.car;
  for (const entry of game.ai || []) {
    const rival = entry.car;
    if (Math.hypot(rival.x - car.x, rival.y - car.y) > reach) continue;
    ctx.beginPath();
    ctx.arc(rival.x, rival.y, 3 / scale, 0, Math.PI * 2);
    ctx.fillStyle = '#e9e9ec';
    ctx.fill();
    ctx.lineWidth = 1.2 / scale;
    ctx.strokeStyle = '#141416';
    ctx.stroke();
  }
}

/**
 * Draws your car: the chevron, pointing where the car points.
 * @param {CanvasRenderingContext2D} ctx the HUD context (css px)
 * @param {number} carX the car's place in the window, css px
 * @param {number} carY the car's place in the window, css px
 * @param {number} heading the car's heading, rad
 */
function drawCarMark(ctx, carX, carY, heading) {
  ctx.save();
  ctx.translate(carX, carY);
  ctx.rotate(heading + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -6.5);
  ctx.lineTo(5, 4);
  ctx.lineTo(0, 1.2);
  ctx.lineTo(-5, 4);
  ctx.closePath();
  ctx.fillStyle = '#f26b3a';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws the progress bar under the window: along the stage to the finish, or round the lap. The
 * endless road has no finish, so none there.
 * @param {CanvasRenderingContext2D} ctx the HUD context (css px)
 * @param {number} x the bar's left edge, css px
 * @param {number} y the bar's top edge, css px
 * @param {number} dist m along the road of the car's point
 * @param {number} lap m in a lap of the road
 */
function drawProgress(ctx, x, y, dist, lap) {
  if (LEVEL.endless) return;
  const total = LEVEL.stage ? LEVEL.stage.finish : lap;
  const share = Math.max(0, Math.min(1, dist / total));
  ctx.save();
  ctx.globalAlpha = OPACITY;
  ctx.fillStyle = 'rgba(20,20,22,0.55)';
  ctx.fillRect(x, y, SIZE, 4);
  ctx.fillStyle = '#f26b3a';
  ctx.fillRect(x, y, Math.max(2, SIZE * share), 4);
  ctx.restore();
}

/**
 * Draws the minimap and the progress bar, each when shown: road ahead, rivals, your car, progress.
 * They give way to the car list and the tune panel, which open over the same place.
 * @param {CanvasRenderingContext2D} ctx the HUD context (css px)
 * @param {object} hud the HUD state (expanded, tuneOpen)
 * @param {object} rects the HUD layout
 * @param {object} game the game (car, ai)
 * @param {number} wallDt frame time, s
 */
export function drawHudMinimap(ctx, hud, rects, game, wallDt) {
  const sub = LEVEL.subtrack;
  const mapShown = shownNow(), barShown = progressNow ? progressNow() : mapShown;
  if ((!mapShown && !barShown) || hud.expanded || hud.tuneOpen) return;
  if (!sub || (LEVEL.endless && !onHighway) || !sub.pts || sub.pts.length < 2) return;
  if (mapState.level !== LEVEL) Object.assign(mapState, { level: LEVEL, idx: 0, heading: null });
  const idx = nearestPoint(sub.pts, game.car.x, game.car.y);
  const { x, y } = minimapAt(rects);
  if (mapShown) drawWindow(ctx, game, x, y, idx, wallDt);
  if (barShown) drawProgress(ctx, x, mapShown ? y + SIZE + 5 : y, sub.pts[idx].dist, sub.totalDist);
}

/**
 * Draws the minimap's window: the road ahead, rivals and your car.
 * @param {CanvasRenderingContext2D} ctx the HUD context (css px)
 * @param {object} game the game (car, ai)
 * @param {number} x the window's left edge, css px
 * @param {number} y the window's top edge, css px
 * @param {number} idx the centreline point nearest the car
 * @param {number} wallDt frame time, s
 */
function drawWindow(ctx, game, x, y, idx, wallDt) {
  const sub = LEVEL.subtrack, car = game.car, pts = sub.pts;
  const closed = !LEVEL.stage && !LEVEL.endless;
  // the lead follows the direction of travel (the heading when nearly still), eased the short way
  const moving = Math.hypot(car.vx, car.vy) > 2;
  const dir = moving ? Math.atan2(car.vy, car.vx) : car.heading;
  if (mapState.heading === null) mapState.heading = dir;
  const off = dir - mapState.heading, turn = Math.atan2(Math.sin(off), Math.cos(off));
  mapState.heading += turn * (1 - Math.exp(-LEAD_EASE * wallDt));
  const radius = SIZE / 2, centreX = x + radius, centreY = y + radius;
  const lead = radius * LEAD_SHARE, scale = viewScale() / MAP_SHRINK;
  const carX = centreX - lead * Math.cos(mapState.heading);
  const carY = centreY - lead * Math.sin(mapState.heading);
  const span = { ahead: ROAD_WIND * (radius + lead) / scale, behind: (radius - lead) / scale };
  ctx.save();
  ctx.globalAlpha = OPACITY;
  ctx.beginPath();
  ctx.arc(centreX, centreY, radius - 1, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(20,20,22,0.32)';
  ctx.fill();
  ctx.clip();
  // world -> window: the main view's way up, the car at (carX, carY)
  ctx.save();
  ctx.translate(carX, carY);
  ctx.scale(scale, scale);
  ctx.translate(-car.x, -car.y);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawJokerLane(ctx, scale);
  drawRoad(ctx, pts, idx, closed ? sub.totalDist : null, scale, span);
  ctx.globalAlpha = OPACITY;
  drawRivals(ctx, game, (radius + lead) / scale, scale);
  ctx.restore();
  drawCarMark(ctx, carX, carY, car.heading);
  ctx.restore();
}

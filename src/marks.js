// marks.js — the world-space skid-mark layer. THE SHOWCASE.
//
// ONE offscreen canvas in world space, stamped into once per physics step and blitted whole. Never
// re-stroke old marks per frame (CLAUDE.md §8: this is the one unbounded array in the design, and
// the frame cost must not climb as the floor fills).
//
// 604 m at 4.2 px/m is 2537 x 2537 (~26 MB). Stamps outside the bounds are CLAMPED OUT
// explicitly, not silently dropped off the edge of an array. createMarks keeps the buffer state
// (the previous wheel positions, the stamp count and the layer origin) in ONE state object and
// returns the public layer; every step is a module-level function that takes that context.

import { FENCE, FX0, FX1, FY0, FY1, RUNOFF_W } from "./world/bounds.ts";
import { COL } from "./world/colours.ts";
import { LEVEL } from "./world/state.ts";
import { MARK_WET } from "./world/surfaces.ts";
import { MARK_GOUGE } from "./world/metalscrape.ts";
import { addTrailPoint, clearWetTrails } from "./wettrail.ts";

// EXTENT is the FENCE, not the floor, so what happens in the run-off (gravel tracks) is
// recorded too. The resolution is kept at 4.2 px/m so memory stays flat: a finer layer over this
// extent is more than a phone should be handed.
let nextMarkId = 0;
export const MARK_PPM = 4.2;                     // px per metre in the marks layer
export const MARK_EXTENT = FENCE;                // m half-extent the layer covers
const SIZE = Math.ceil(MARK_EXTENT * 2 * MARK_PPM);

// Tolerance floor (CLAUDE.md rule 8 applied to feedback): below this much slip, stamp NOTHING.
// Without it every gentle corner smears the floor and the marks stop meaning anything.
export const SLIP_FLOOR = 2.2;                   // m/s. MEASURED against the real game:
// at 1.5, ordinary cornering smeared the floor (18 stamps in a pulsed-lock corner at 25 km/h that
// should have left nothing); at 2.2, gentle cornering leaves 0 while a handbrake turn still lays
// 163, a full-pedal stop 390 and a muscle power-on 280. Below this, marks stop meaning anything.

// Minimum distance a wheel must travel before it stamps again. Decouples mark density from speed
// and from the physics rate, so darkness means SLIP and nothing else.
const STAMP_STEP = 0.10;                         // m

/**
 * The buffer state of one marks layer.
 * @typedef {object} MarkState
 * @property {Map<string, {x: number, y: number}>} prev wheel key -> world position last step
 * @property {number} stamps how many stamps were laid since the last clear
 * @property {number} shiftX layer px the window has moved along x (0 on a level that fits)
 * @property {number} shiftY layer px the window has moved along y
 * @property {boolean} wraps true once the window follows the car (a wrap-around buffer)
 * @property {number} [fadeT] s since the last block faded
 * @property {number} [fadeN] blocks faded so far (the block hash)
 */

/**
 * What every marks function takes.
 * @typedef {object} MarkCtx
 * @property {HTMLCanvasElement} layer the offscreen canvas
 * @property {CanvasRenderingContext2D} ctx its 2d context
 * @property {MarkState} state the buffer state
 */

// WRAP-AROUND LAYER. A world point is at layer px u = (x + MARK_EXTENT) * MARK_PPM (v for y),
// stored at u mod SIZE; the layer holds the window u in [shiftX, shiftX + SIZE). On a level that
// fits, the shift stays 0 and this is the plain mapping. On the endless road and the lab
// rectangle the window follows the car a whole px at a time, and only the strip of new ground
// entering it is cleared: nothing is ever copied or allocated. MEASURED (the owner's phone,
// ?report=1): re-centring by copying the whole 26 MB layer into a new canvas each time the car
// was 136 m (0.45 x MARK_EXTENT) from its centre stalled one frame ~12 ms, outside our JS, every
// 136 m - the highway and lab judder.

/**
 * The remainder of value / period, from 0 up to period (also for negative values).
 * @param {number} value the value
 * @param {number} period the period
 * @returns {number} the remainder
 */
const wrapPx = (value, period) => ((value % period) + period) % period;

/**
 * Converts a world position to an (unwrapped) pixel position in the layer.
 *
 * @param {number} worldX world x in metres
 * @param {number} worldY world y in metres
 * @returns {number[]} the [u, v] pixel position
 */
function toPx(worldX, worldY) {
  return [(worldX + MARK_EXTENT) * MARK_PPM, (worldY + MARK_EXTENT) * MARK_PPM];
}

/**
 * Does the whole level, fence included, fit the layer around the world origin? (Then the layer
 * never moves.)
 * @returns {boolean} true when it fits
 */
function levelFitsLayer() {
  return -FX0 + RUNOFF_W <= MARK_EXTENT && FX1 + RUNOFF_W <= MARK_EXTENT
    && -FY0 + RUNOFF_W <= MARK_EXTENT && FY1 + RUNOFF_W <= MARK_EXTENT;
}

/**
 * Clears a band of whole columns or rows of the layer.
 * @param {CanvasRenderingContext2D} ctx the layer's context
 * @param {number} start the first column / row
 * @param {number} count how many
 * @param {boolean} isColumns true for columns (an x move), false for rows
 */
function clearBand(ctx, start, count, isColumns) {
  if (isColumns) ctx.clearRect(start, 0, count, SIZE);
  else ctx.clearRect(0, start, SIZE, count);
}

/**
 * Clears what a window move from one shift to another hands over to new ground: the columns
 * (or rows) between the two shifts, wrapped into the layer.
 * @param {CanvasRenderingContext2D} ctx the layer's context
 * @param {number} fromShift the old shift, layer px
 * @param {number} toShift the new shift, layer px
 * @param {boolean} isColumns true for an x move, false for a y move
 */
function clearEnteringStrip(ctx, fromShift, toShift, isColumns) {
  const count = Math.abs(toShift - fromShift);
  if (count === 0) return;
  if (count >= SIZE) {
    ctx.clearRect(0, 0, SIZE, SIZE);
    return;
  }
  const start = wrapPx(Math.min(fromShift, toShift), SIZE);
  const first = Math.min(count, SIZE - start);
  clearBand(ctx, start, first, isColumns);
  if (first < count) clearBand(ctx, 0, count - first, isColumns);
}

/**
 * Moves the layer's window to stay centred on a position (the player car), clearing only the
 * ground that enters it.
 *
 * ONLY WHEN THE LEVEL DOES NOT FIT (requirement: top left corner of knob hill... it seems to forget
 * / cut of tyre marks in a clean line, some stay but most go; tools/_markedge.mjs). A square
 * level's whole fence (+-FLOOR + RUNOFF_W) IS the layer, so it never needs to move; only the
 * endless road and levels outside the square (the lab rectangle, a long straight) follow.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {number} x world x to follow
 * @param {number} y world y to follow
 */
function followMarks(markCtx, x, y) {
  const { ctx, state } = markCtx;
  if (!LEVEL.endless && !state.wraps && levelFitsLayer()) return;
  state.wraps = true;
  const shiftX = Math.round(x * MARK_PPM), shiftY = Math.round(y * MARK_PPM);
  clearEnteringStrip(ctx, state.shiftX, shiftX, true);
  clearEnteringStrip(ctx, state.shiftY, shiftY, false);
  state.shiftX = shiftX;
  state.shiftY = shiftY;
}

/**
 * Wipes the layer and resets its state.
 *
 * @param {MarkCtx} markCtx the marks context
 */
function clearMarks(markCtx) {
  const { ctx, state } = markCtx;
  ctx.clearRect(0, 0, SIZE, SIZE);
  state.shiftX = 0;
  state.shiftY = 0;
  state.wraps = false;
  state.prev.clear();
  state.stamps = 0;
  clearWetTrails();
}

// MARKS FADE (owner: tyre marks fade after a while, a bit randomly, and are gone from
// memory too). The old fade below took alpha 0.000125 a physics step off the whole 26 MB layer:
// below the canvas's 1/255 step, so nothing ever faded, at 120 full-layer fills a second. Here
// every FADE_EVERY_S one block of the layer (FADE_BLOCKS x FADE_BLOCKS, picked by a hash so the
// game's random stream is untouched) loses FADE_STEP of its marks: blocks fade at different times,
// a mark is gone in ~2-3 min. The marks are pixels of a fixed layer: faded pixels are empty again.
const FADE_EVERY_S = 0.5, FADE_BLOCKS = 8, FADE_STEP = 0.5;

/**
 * Every FADE_EVERY_S one block of the layer loses FADE_STEP of its marks.
 * @param {MarkCtx} markCtx the marks context
 * @param {number} dt the step in seconds
 */
function fadeBlocks(markCtx, dt) {
  const { ctx, state } = markCtx;
  state.fadeT = (state.fadeT || 0) + dt;
  if (state.fadeT < FADE_EVERY_S) return;
  state.fadeT -= FADE_EVERY_S;
  state.fadeN = (state.fadeN || 0) + 1;
  // a hash of the count, not Math.random: the tools replay the game's random stream exactly
  let hash = Math.imul(state.fadeN, 0x9e3779b1);
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b);
  const block = ((hash ^ (hash >>> 13)) >>> 0) % (FADE_BLOCKS * FADE_BLOCKS);
  const side = Math.ceil(SIZE / FADE_BLOCKS);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${FADE_STEP})`;
  ctx.fillRect((block % FADE_BLOCKS) * side, Math.floor(block / FADE_BLOCKS) * side, side, side);
  ctx.restore();
}

/**
 * Fades the marks, block by block.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {number} dt the step in seconds
 */
function fadeMarks(markCtx, dt) {
  if (markCtx.state.stamps === 0) return;
  fadeBlocks(markCtx, dt);
}

/**
 * Strokes one mark segment from a wheel's previous position to its current one.
 *
 * alpha ramps from the tolerance floor up over ~6 m/s of slip, per PLAN.md
 * alpha is per-stamp and marks still overlap somewhat, so this is deliberately low; a hard
 * slide lays many stamps and DEEPENS, which is what makes a heavy mark read as heavy.
 * TYRE TEMPERATURE you can SEE: a cold tyre lays a FAINT rubber mark —
 * it is not soft enough to leave much of itself behind — and reaches full strength in its
 * working window (~65 C). Ruts in loose ground do not care about tyre temperature.
 * REVISED (requirement: maybe cold tyres don't really leave skid marks): nothing below 35 C, full
 * from ~90 C. MEASURED: a locked stop from 86 km/h heats cold fronts 18 -> 59 C within
 * the stop (a skidding tyre gets hot fast, as in life), so 25..70 still drew 2/3 of a warm
 * tyre's marks; 35..90 leaves only a faint tail.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {object} wheel the wheel { x, y, slip, width, heat }
 * @param {object | undefined} loose the loose-surface mark of the wheel, if any
 * @param {number[]} from the [x, y] layer pixel of the previous position
 * @param {number[]} dest the [x, y] layer pixel of the current position
 */
function strokeMark(markCtx, wheel, loose, from, dest) {
  const { ctx, state } = markCtx;
  const warm = loose ? 1 : Math.pow(Math.max(0, Math.min(1, (wheel.heat - 35) / 55)), 1.5);
  const alpha = loose
    // a rut, deepened by scrabbling
    ? loose.alpha * (0.6 + 0.4 * Math.min(1, wheel.slip / 6))
    : (0.05 + 0.30 * Math.min(1, (wheel.slip - SLIP_FLOOR) / 6)) * warm;
  ctx.strokeStyle = `rgba(${loose ? loose.rgb : COL.mark},${alpha.toFixed(3)})`;
  // a rut is WIDER than the tyre: the wheel displaces gravel to either side of itself
  ctx.lineWidth = Math.max(2, wheel.width * (loose ? loose.widen : 1) * MARK_PPM);
  strokeSegment(markCtx, from, dest);
  state.stamps++;
}

// a wrap-around layer draws a stroke again one whole layer over where it crosses an edge, so a
// seam never cuts a mark in half
const WRAP_OFFSETS = [0, -SIZE, SIZE];

/**
 * Does a span of layer px, widened by `reach`, touch the layer once moved by `offset`?
 * @param {number} low the span's low end
 * @param {number} high the span's high end
 * @param {number} offset the move, layer px
 * @param {number} reach the half width to add, layer px
 * @returns {boolean} true when it touches
 */
function touchesLayer(low, high, offset, reach) {
  return high + offset + reach >= 0 && low + offset - reach <= SIZE;
}

/**
 * Strokes the segment with the context's current style, plus its wrapped copies on a
 * wrap-around layer.
 * @param {MarkCtx} markCtx the marks context
 * @param {number[]} from the [x, y] layer pixel of the start, inside the layer
 * @param {number[]} dest the [x, y] layer pixel of the end
 */
function strokeSegment(markCtx, from, dest) {
  const { ctx, state } = markCtx;
  if (!state.wraps) {
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(dest[0], dest[1]);
    ctx.stroke();
    return;
  }
  const reach = ctx.lineWidth;
  const lowX = Math.min(from[0], dest[0]), highX = Math.max(from[0], dest[0]);
  const lowY = Math.min(from[1], dest[1]), highY = Math.max(from[1], dest[1]);
  for (const offX of WRAP_OFFSETS) {
    if (!touchesLayer(lowX, highX, offX, reach)) continue;
    for (const offY of WRAP_OFFSETS) {
      if (!touchesLayer(lowY, highY, offY, reach)) continue;
      ctx.beginPath();
      ctx.moveTo(from[0] + offX, from[1] + offY);
      ctx.lineTo(dest[0] + offX, dest[1] + offY);
      ctx.stroke();
    }
  }
}

/**
 * Sometimes drops a ball of rubber just off the line of a hard-worked warm tyre.
 *
 * RUBBER BALLING ("marbles") in the working window: a hard-worked warm tyre sheds little
 * balls of rubber that collect just off the line. Drawn into this same layer, so they fade
 * with the marks. REVISED (requirement: rubber balling is a bit obvious): 0.35 -> 0.08 chance,
 * smaller and fainter.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {object} wheel the wheel { slip, width, heat, mark }
 * @param {number[]} from the [x, y] layer pixel of the previous position
 * @param {number[]} dest the [x, y] layer pixel of the current position
 */
function dropRubberBall(markCtx, wheel, from, dest) {
  const { ctx } = markCtx;
  const [fromX, fromY] = from, [toX, toY] = dest;
  if (!wheel.mark && wheel.heat > 65 && wheel.heat < 120 && wheel.slip > 1.2
    && Math.random() < 0.08) {
    const side = (Math.random() < 0.5 ? -1 : 1)
      * (wheel.width * 1.2 + Math.random() * 0.6) * MARK_PPM;
    const dx = toY - fromY, dy = fromX - toX, len = Math.hypot(dx, dy) || 1;
    ctx.fillStyle = 'rgba(28,26,30,0.30)';
    ctx.beginPath();
    ctx.arc(toX + (dx / len) * side, toY + (dy / len) * side, Math.max(0.8, 0.04 * MARK_PPM),
      0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Stamps one wheel's mark for this step, if it slipped and moved far enough.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {object} wheel the wheel { key, x, y, slip, width, mark, heat }
 */
function stampWheel(markCtx, wheel) {
  const { prev } = markCtx.state;
  const last = prev.get(wheel.key);
  if (!last) {
    prev.set(wheel.key, { x: wheel.x, y: wheel.y });
    return;
  }
  // A LOOSE SURFACE MARKS WHETHER YOU SLIP OR NOT — a rolling wheel still cuts a rut through
  // gravel. `w.mark` comes off the surface itself (lab.js), so this file has no idea what
  // gravel is; a surface without one behaves exactly as before, which is the rule-6 no-op
  // default.
  const loose = wheel.mark;
  // WET TRAIL: a wheel on a wet road lays a short fading trail (wettrail.ts), not a mark in this
  // layer
  if (loose === MARK_WET) {
    prev.set(wheel.key, { x: wheel.x, y: wheel.y });
    addTrailPoint(wheel.key, wheel.x, wheel.y, wheel.width * MARK_WET.widen);
    return;
  }
  if (!loose && !(wheel.slip > SLIP_FLOOR)) {
    prev.set(wheel.key, { x: wheel.x, y: wheel.y });
    return;
  }
  // not far enough yet: keep prev
  if (Math.hypot(wheel.x - last.x, wheel.y - last.y) < STAMP_STEP) return;
  prev.set(wheel.key, { x: wheel.x, y: wheel.y });
  // guard: a NaN here paints nothing but throws in some engines (rule 20)
  if (!Number.isFinite(wheel.x) || !Number.isFinite(wheel.y)
    || !Number.isFinite(last.x)) return;
  // A3: clamp to the layer. Past the fence the mark simply is not recorded — an explicit
  // decision at a known boundary rather than a silent no-op.
  const { state } = markCtx;
  if (Math.abs(wheel.x - state.shiftX / MARK_PPM) > MARK_EXTENT
    || Math.abs(wheel.y - state.shiftY / MARK_PPM) > MARK_EXTENT) return;

  const from = toPx(last.x, last.y);
  const dest = toPx(wheel.x, wheel.y);
  if (state.wraps) {
    // into the layer: the end inside it, the start moved by the same whole layers
    const baseX = Math.floor(dest[0] / SIZE) * SIZE, baseY = Math.floor(dest[1] / SIZE) * SIZE;
    from[0] -= baseX; dest[0] -= baseX;
    from[1] -= baseY; dest[1] -= baseY;
  }
  strokeMark(markCtx, wheel, loose, from, dest);
  dropRubberBall(markCtx, wheel, from, dest);
}

/**
 * Stamps the marks of every wheel for one fixed physics step.
 *
 * Called once per FIXED PHYSICS STEP (sim time — a mark is world bookkeeping, not an
 * animation).
 *
 * MEASURED BUG, (photographed): stamping EVERY step painted marks that looked like
 * thick black ink scribbles. At 120 Hz a wheel moves ~6 cm per step, so consecutive segments
 * overlapped by ~97% and the alpha compounded to solid black within a few frames — and worse,
 * the darkness then depended on SPEED and STEP RATE rather than on how hard the tyre was
 * actually slipping, which is the one thing a mark is supposed to communicate. Marks are now
 * gated on DISTANCE TRAVELLED, so a given metre of floor receives the same number of stamps
 * however fast it was crossed.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {object[]} wheels the wheels [{ key, x, y, slip, width }]
 */
function stampMarks(markCtx, wheels) {
  for (const wheel of wheels) stampWheel(markCtx, wheel);
}

/**
 * Where a wheel is in world space, and how hard it is slipping.
 *
 * Four contact points from the axle positions and the track width. The slip figure comes
 * straight out of the vehicle telemetry — vehicle.js computes it from the contact patch, so
 * there is exactly one derivation of it. EACH CAR'S OWN WHEEL KEYS (requirement: AI share tyre
 * tracks? it gets messy quick): the keys were just fl/fr/rl/rr, so with AI cars the stamp joined
 * one car's wheel to ANOTHER car's same wheel — long lines criss-crossing
 * the track. Now prefixed by a per-car id.
 *
 * @param {object} car the car
 * @returns {object[]} the four wheels { key, x, y, slip, width, mark, heat }
 */
function listWheels(car) {
  if (car._markId === undefined) car._markId = nextMarkId++;
  const spec = car.spec, telem = car.t;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const halfTrack = spec.trackWidth / 2;
  const out = [];
  // a wheel on its rim over hard ground scores a pale line (world/metalscrape.ts, ?flats=1)
  const rims = car.rimSparks;
  for (const [key, along, side, slip, corner] of [
    ['fl', spec.lf, -halfTrack, telem.slipSpeedF, 0],
    ['fr', spec.lf, halfTrack, telem.slipSpeedF, 1],
    ['rl', -spec.lr, -halfTrack, telem.slipSpeedR, 2],
    ['rr', -spec.lr, halfTrack, telem.slipSpeedR, 3],
  ]) {
    out.push({
      key: car._markId + key,
      x: car.x + along * cosH - side * sinH,
      y: car.y + along * sinH + side * cosH,
      slip,
      width: spec.tyreWidth,
      // set only by loose surfaces (undefined = ordinary skid marks), or a rim's score
      mark: rims && rims[corner] ? MARK_GOUGE : car.surface.mark,
      heat: car.tyreT ? car.tyreT[(along > 0 ? 0 : 2) + (side > 0 ? 0 : 1)] : 60,
    });
  }
  return out;
}

/**
 * Builds the skid-mark layer.
 *
 * @returns the layer: its canvas, size, window shift (layer px), stamps and the follow / clear /
 *   fade / stamp / wheelsOf methods
 */
export function createMarks() {
  const layer = document.createElement('canvas');
  layer.width = SIZE;
  layer.height = SIZE;
  const ctx = layer.getContext('2d');
  ctx.lineCap = 'round';
  // start transparent; the floor shows through
  /** @type {MarkState} */
  const state = {
    prev: new Map(),   // wheel key -> {x, y} world position last step
    stamps: 0,
    // the WINDOW (see "WRAP-AROUND LAYER"): 0 on a level that fits the layer
    shiftX: 0,
    shiftY: 0,
    wraps: false,
  };
  const markCtx = { layer, ctx, state };

  return {
    canvas: layer, size: SIZE,
    get shiftX() { return state.shiftX; },
    get shiftY() { return state.shiftY; },
    follow: (x, y) => followMarks(markCtx, x, y),
    get stamps() { return state.stamps; },
    clear: () => clearMarks(markCtx),
    fade: (dt) => fadeMarks(markCtx, dt),
    stamp: (wheels) => stampMarks(markCtx, wheels),
    wheelsOf: (car) => listWheels(car),
  };
}

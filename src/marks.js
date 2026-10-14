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

// EXTENT is the FENCE, not the floor, so what happens in the run-off (gravel tracks) is
// recorded too. The resolution is kept at 4.2 px/m so memory stays flat: a finer layer over this
// extent is more than a phone should be handed.
let nextMarkId = 0;
export const MARK_PPM = 4.2;                     // px per metre in the marks layer
export const MARK_EXTENT = FENCE;                // m half-extent the layer covers
const SIZE = Math.ceil(MARK_EXTENT * 2 * MARK_PPM);

// Tolerance floor (CLAUDE.md rule 8 applied to feedback): below this much slip, stamp NOTHING.
// Without it every gentle corner smears the floor and the marks stop meaning anything.
export const SLIP_FLOOR = 2.2;                   // m/s. MEASURED 2026-09-27 against the real game:
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
 * @property {number} originX world x the layer is centred on; follow() moves it (shifting what
 *   is drawn) once the car is past half the extent — on an ordinary level it never moves
 * @property {number} originY world y the layer is centred on
 */

/**
 * What every marks function takes.
 * @typedef {object} MarkCtx
 * @property {HTMLCanvasElement} layer the offscreen canvas
 * @property {CanvasRenderingContext2D} ctx its 2d context
 * @property {MarkState} state the buffer state
 */

/**
 * Converts a world position to a pixel position in the layer.
 *
 * @param {MarkState} state the buffer state
 * @param {number} worldX world x in metres
 * @param {number} worldY world y in metres
 * @returns {number[]} the [x, y] pixel position
 */
function toPx(state, worldX, worldY) {
  return [(worldX - state.originX + MARK_EXTENT) * MARK_PPM,
    (worldY - state.originY + MARK_EXTENT) * MARK_PPM];
}

/**
 * Slides the layer's origin to follow a position, shifting the drawn marks.
 *
 * ONLY WHEN THE LEVEL DOES NOT FIT (2026-10-07; user: "top left corner of knob hill ... it
 * seems to forget / cut of tyre marks in a clean line, some stay but most go";
 * tools/_markedge.mjs). MEASURED BUG: follow ran on EVERY level, so past 136 m from the
 * middle (Knobhill reaches ~242 m) the layer slid over and everything beyond a straight line
 * on the far side was cut away. A square level's whole fence (+-FLOOR + RUNOFF_W) IS the
 * layer, so it never needs to move; only the endless road and the tall lab rectangle still
 * follow.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {number} x world x to follow
 * @param {number} y world y to follow
 */
function followMarks(markCtx, x, y) {
  const { layer, ctx, state } = markCtx;
  if (!LEVEL.endless && state.originX === 0 && state.originY === 0
    && -FX0 + RUNOFF_W <= MARK_EXTENT && FX1 + RUNOFF_W <= MARK_EXTENT
    && -FY0 + RUNOFF_W <= MARK_EXTENT
    && FY1 + RUNOFF_W <= MARK_EXTENT) return;
  if (Math.abs(x - state.originX) < MARK_EXTENT * 0.45
    && Math.abs(y - state.originY) < MARK_EXTENT * 0.45) return;
  const nx = Math.round(x), ny = Math.round(y), dx = (nx - state.originX) * MARK_PPM,
    dy = (ny - state.originY) * MARK_PPM;
  const tmp = document.createElement('canvas');
  tmp.width = SIZE;
  tmp.height = SIZE;
  tmp.getContext('2d').drawImage(layer, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.drawImage(tmp, -dx, -dy);
  state.originX = nx;
  state.originY = ny;
}

/**
 * Wipes the layer and resets its state.
 *
 * @param {MarkCtx} markCtx the marks context
 */
function clearMarks(markCtx) {
  const { ctx, state } = markCtx;
  ctx.clearRect(0, 0, SIZE, SIZE);
  state.originX = 0;
  state.originY = 0;
  state.prev.clear();
  state.stamps = 0;
}

/**
 * Fades every mark a little.
 *
 * @param {MarkCtx} markCtx the marks context
 * @param {number} dt the step in seconds
 */
function fadeMarks(markCtx, dt) {
  const { ctx, state } = markCtx;
  if (state.stamps === 0) return;
  const fadeAlpha = Math.min(0.06, dt * 0.015);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0,0,0,${fadeAlpha.toFixed(4)})`;
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.restore();
}

/**
 * Strokes one mark segment from a wheel's previous position to its current one.
 *
 * alpha ramps from the tolerance floor up over ~6 m/s of slip, per PLAN.md
 * alpha is per-stamp and marks still overlap somewhat, so this is deliberately low; a hard
 * slide lays many stamps and DEEPENS, which is what makes a heavy mark read as heavy.
 * TYRE TEMPERATURE you can SEE (user, 2026-10-03): a cold tyre lays a FAINT rubber mark —
 * it is not soft enough to leave much of itself behind — and reaches full strength in its
 * working window (~65 C). Ruts in loose ground do not care about tyre temperature.
 * REVISED (user: "maybe cold tyres don't really leave skid marks"): nothing below 35 C,
 * full from ~90 C. MEASURED: a locked stop from 86 km/h heats cold fronts 18 -> 59 C within
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
  ctx.beginPath();
  ctx.moveTo(from[0], from[1]);
  ctx.lineTo(dest[0], dest[1]);
  ctx.stroke();
  state.stamps++;
}

/**
 * Sometimes drops a ball of rubber just off the line of a hard-worked warm tyre.
 *
 * RUBBER BALLING ("marbles") in the working window: a hard-worked warm tyre sheds little
 * balls of rubber that collect just off the line. Drawn into this same layer, so they fade
 * with the marks. REVISED (user: "rubber balling is a bit obvious"): 0.35 -> 0.08 chance,
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
  if (Math.abs(wheel.x - markCtx.state.originX) > MARK_EXTENT
    || Math.abs(wheel.y - markCtx.state.originY) > MARK_EXTENT) return;

  const from = toPx(markCtx.state, last.x, last.y);
  const dest = toPx(markCtx.state, wheel.x, wheel.y);
  strokeMark(markCtx, wheel, loose, from, dest);
  dropRubberBall(markCtx, wheel, from, dest);
}

/**
 * Stamps the marks of every wheel for one fixed physics step.
 *
 * Called once per FIXED PHYSICS STEP (sim time — a mark is world bookkeeping, not an
 * animation).
 *
 * MEASURED BUG, 2026-09-27 (photographed): stamping EVERY step painted marks that looked like
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
 * there is exactly one derivation of it. EACH CAR'S OWN WHEEL KEYS (2026-10-04, user: "AI
 * share tyre tracks? it gets messy quick"): the keys were just fl/fr/rl/rr, so with AI cars
 * the stamp joined one car's wheel to ANOTHER car's same wheel — long lines criss-crossing
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
  for (const [key, along, side, slip] of [
    ['fl', spec.lf, -halfTrack, telem.slipSpeedF], ['fr', spec.lf, halfTrack, telem.slipSpeedF],
    ['rl', -spec.lr, -halfTrack, telem.slipSpeedR], ['rr', -spec.lr, halfTrack,
      telem.slipSpeedR],
  ]) {
    out.push({
      key: car._markId + key,
      x: car.x + along * cosH - side * sinH,
      y: car.y + along * sinH + side * cosH,
      slip,
      width: spec.tyreWidth,
      mark: car.surface.mark,     // set only by loose surfaces; undefined = ordinary skid marks
      heat: car.tyreT ? car.tyreT[(along > 0 ? 0 : 2) + (side > 0 ? 0 : 1)] : 60,
    });
  }
  return out;
}

/**
 * Builds the skid-mark layer.
 *
 * @returns the layer: its canvas, size, origin, stamps and the follow / clear / fade / stamp /
 *   wheelsOf methods
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
    // ORIGIN (the endless highway): the layer covers MARK_EXTENT around (originX, originY), not
    // around the world origin. follow() moves it (shifting what is drawn) once the car is past
    // half the extent — on an ordinary level the car never gets there, so nothing changes.
    originX: 0,
    originY: 0,
  };
  const markCtx = { layer, ctx, state };

  return {
    canvas: layer, size: SIZE,
    get origin() { return [state.originX, state.originY]; },
    follow: (x, y) => followMarks(markCtx, x, y),
    get stamps() { return state.stamps; },
    clear: () => clearMarks(markCtx),
    fade: (dt) => fadeMarks(markCtx, dt),
    stamp: (wheels) => stampMarks(markCtx, wheels),
    wheelsOf: (car) => listWheels(car),
  };
}

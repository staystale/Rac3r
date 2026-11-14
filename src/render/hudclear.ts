// render/hudclear.ts - THE CAR NEVER UNDER THE HUD (?hudclear=1). MEASURED before
// (tools/scratch/_hudcover.mjs, the game's autopilot, 2 min a run): on a 390x844 phone the
// endless highway put the car 3/4 down the screen and a bend slid it right, under the ABS / TCS
// chips and the pedals, in 15 % of the samples (worst 85 % of the car hidden). The camera keeps
// its framing (the lead, the zoom) and moves the car on screen only as far as it must: away from
// each HUD piece it comes near, toward the screen's middle.

// css px kept between the car and a HUD piece
const CLEAR_MARGIN = 6;
// passes: a push can move the car alongside another piece (MEASURED, 360x740: the R pedal's push
// up took the car beside the ABS chip, whose push left had been worked out for where it was)
const CLEAR_PASSES = 4;
// reused each frame: the pushes of a pass, and the move so far
const PUSH = { up: 0, down: 0, left: 0, right: 0 }, MOVED = [0, 0];
// css px: as the car comes this near to passing under a piece from the side, its push builds from
// nothing to the whole clearance, so the camera never jumps
const CLEAR_RAMP = 32;

// css px / s / s: the most the push's speed changes in a second - 3 px / frame / frame at 60 fps,
// the size of the view's own steadiest wobble (MEASURED off, _hudcover: 0.1-3.4 px), so the push
// never jerks the view, and a piece that appears is cleared in ~0.1-0.2 s
const CLEAR_ACCEL = 10800;
// 1/s: near its goal the push closes in proportion (no chatter round the goal)
const CLEAR_SETTLE = 20;

/** One axis of the push the camera applies, css px: where it is, its speed, its last goal. */
export interface PushAxis { pos: number; vel: number; goal: number }

/**
 * Move one axis of the push toward its goal with its speed changing by at most CLEAR_ACCEL: it
 * keeps pace with a goal that slides (the goal's own speed is fed forward) and brakes in time for
 * one that jumps (a piece that appears or goes), so the view moves smoothly either way.
 * @param axis the axis (moved in place)
 * @param goal the push the pieces ask for now, css px
 * @param dt the wall-clock frame time, s
 * @param whole take the goal at once (after a teleport)
 * @returns the push now, css px
 */
export function followPush(axis: PushAxis, goal: number, dt: number, whole: boolean): number {
  if (whole) {
    axis.pos = goal;
    axis.vel = 0;
  } else if (dt > 0) {
    const goalSpeed = (goal - axis.goal) / dt, gap = goal - axis.pos,
      close = Math.min(Math.sqrt(2 * CLEAR_ACCEL * Math.abs(gap)), Math.abs(gap) * CLEAR_SETTLE),
      change = CLEAR_ACCEL * dt;
    axis.vel += Math.max(-change, Math.min(change, goalSpeed + Math.sign(gap) * close
      - axis.vel));
    axis.pos += axis.vel * dt;
  }
  axis.goal = goal;
  return axis.pos;
}

/** A screen rectangle, css px. */
export interface ClearRect { x: number; y: number; w: number; h: number }

/** The car on screen: its centre and its half extents along x and y, css px. */
export interface ClearBox { centreX: number; centreY: number; halfX: number; halfY: number }

/**
 * How much of a push one piece asks for: its overlap with the car along the other axis, ramped.
 * @param carLow the car's low edge on the across axis, px
 * @param carHigh its high edge
 * @param low the piece's low edge (with the margin)
 * @param high its high edge
 * @returns 0 (well clear) .. 1 (the car passes under it)
 */
function rampAcross(carLow: number, carHigh: number, low: number, high: number): number {
  const overlap = Math.min(carHigh, high) - Math.max(carLow, low);
  return Math.max(0, Math.min(1, (overlap + CLEAR_RAMP) / CLEAR_RAMP));
}

/**
 * One pass: the pushes the pieces ask for with the car moved by the passes before.
 * @param box the car on screen
 * @param moved [right, down] the passes before moved it, css px
 * @param rects the HUD pieces
 * @param width the screen's width, css px
 * @param height the screen's height, css px
 * @returns [right, down]: the move, css px
 */
function clearPass(box: ClearBox, moved: number[], rects: ClearRect[], width: number,
  height: number): [number, number] {
  const centreX = box.centreX + moved[0], centreY = box.centreY + moved[1],
    { halfX, halfY } = box;
  const push = PUSH;
  push.up = push.down = push.left = push.right = 0;
  for (const rect of rects) {
    const low = rect.x - CLEAR_MARGIN, high = rect.x + rect.w + CLEAR_MARGIN,
      top = rect.y - CLEAR_MARGIN, bottom = rect.y + rect.h + CLEAR_MARGIN;
    const midX = (low + high) / 2 / width - 0.5, midY = (top + bottom) / 2 / height - 0.5;
    if (Math.abs(midY) >= Math.abs(midX)) {
      const weight = rampAcross(centreX - halfX, centreX + halfX, low, high);
      if (midY > 0) push.up = Math.max(push.up, weight * (centreY + halfY - top));
      else push.down = Math.max(push.down, weight * (bottom - (centreY - halfY)));
    } else {
      const weight = rampAcross(centreY - halfY, centreY + halfY, top, bottom);
      if (midX > 0) push.left = Math.max(push.left, weight * (centreX + halfX - low));
      else push.right = Math.max(push.right, weight * (high - (centreX - halfX)));
    }
  }
  return [push.right - push.left, push.down - push.up];
}

/**
 * How far the car must move on screen to be clear of every HUD piece. Each piece pushes along one
 * axis, toward the screen's middle: up / down for a piece nearer the top or bottom edge than the
 * sides (by share of the screen), else left / right; a piece's push is the depth the car reaches
 * into it, scaled as the car comes alongside (rampAcross). The pushes each way are the largest
 * asked; opposite pushes cancel (a screen too small for the car). Worked out again where the car
 * was moved to, up to CLEAR_PASSES times, as a push can bring it alongside another piece.
 * @param box the car on screen
 * @param rects the HUD pieces
 * @param width the screen's width, css px
 * @param height the screen's height, css px
 * @returns [right, down]: the move, css px
 */
export function hudClearPush(box: ClearBox, rects: ClearRect[], width: number,
  height: number): [number, number] {
  const moved = MOVED;
  moved[0] = moved[1] = 0;
  for (let pass = 0; pass < CLEAR_PASSES; pass++) {
    const [moveX, moveY] = clearPass(box, moved, rects, width, height);
    moved[0] += moveX;
    moved[1] += moveY;
    if (Math.abs(moveX) + Math.abs(moveY) < 0.5) break;
  }
  return [moved[0], moved[1]];
}

// render/hudclear.ts - THE CAR NEVER UNDER THE HUD (?hudclear=1). MEASURED before
// (tools/scratch/_hudcover.mjs, the game's autopilot, 2 min a run): on a 390x844 phone the
// endless highway put the car 3/4 down the screen and a bend slid it right, under the ABS / TCS
// chips and the pedals, in 15 % of the samples (worst 85 % of the car hidden). The camera keeps
// its framing (the lead, the zoom) and moves the car on screen only as far as it must: away from
// each HUD piece it comes near, toward the screen's middle.

// css px kept between the car and a HUD piece
const CLEAR_MARGIN = 6;
// css px: as the car comes this near to passing under a piece from the side, its push builds from
// nothing to the whole clearance, so the camera never jumps
const CLEAR_RAMP = 32;

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
 * How far the car must move on screen to be clear of every HUD piece. Each piece pushes along one
 * axis, toward the screen's middle: up / down for a piece nearer the top or bottom edge than the
 * sides (by share of the screen), else left / right; a piece's push is the depth the car reaches
 * into it, scaled as the car comes alongside (rampAcross). The pushes each way are the largest
 * asked; opposite pushes cancel (a screen too small for the car).
 * @param box the car on screen
 * @param rects the HUD pieces
 * @param width the screen's width, css px
 * @param height the screen's height, css px
 * @returns [right, down]: the move, css px
 */
export function hudClearPush(box: ClearBox, rects: ClearRect[], width: number,
  height: number): [number, number] {
  const { centreX, centreY, halfX, halfY } = box;
  const push = { up: 0, down: 0, left: 0, right: 0 };
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

// tyrelook.ts - how a tyre LOOKS by its air (car systems C2; owner: "make them
// progressive so tyre pressure is basically visible"; a flat "squishes in all directions",
// "wobbles even" - mockup approved). In the car's sprite pixels, centred on the wheel. From full
// (pressure 1) to flat (0), each step adds to the last:
//   below 90 %  the sides round out a pixel (wider, rounded ends)
//   below 65 %  longer: the contact patch spreads a pixel front and back
//   below 40 %  the sidewalls bulge a further pixel, a lump rolling along each side; darker
//   below 20 %  longer again, darkest, and it flops a pixel side to side as it turns
// On the rim: a thin silver rim with rubber shreds. physics/tyrepressure.ts holds the numbers.

const TYRE = '#16171c', TYRE_SOFT = '#121317', TYRE_FLAT = '#0d0e11';
const TREAD = '#26282f', TREAD_FLAT = '#1b1c22', RIM_DARK = '#7d7f88', RIM_LIT = '#c9c9d2';
// pressure from which a tyre looks soft (above it the ordinary wheel is drawn)
const SOFT_FROM = 0.9;
// wheel radius for the roll of the lumps, m (a ~16-17 inch wheel); the lump moves a pixel a
// sixth of a turn
const WHEEL_RADIUS_M = 0.31, LUMP_STEPS_PER_TURN = 6;

/** A car as the tyre look reads it. */
interface TurningCar { vx: number; vy: number; _wheelTurn?: number; _wheelAt?: number }

/**
 * The wheels' turn for the lumps and the flop, from the car's speed on the wall clock
 * (rule 5: something watched).
 * @param car the car (keeps its turn between frames)
 * @param nowMs the frame's time, ms
 * @returns the turn, in lump steps
 */
export function wheelTurn(car: TurningCar, nowMs: number): number {
  const lastMs = car._wheelAt ?? nowMs;
  const dt = Math.min(0.1, Math.max(0, (nowMs - lastMs) / 1000));
  const speed = Math.hypot(car.vx, car.vy);
  car._wheelAt = nowMs;
  car._wheelTurn = (car._wheelTurn || 0)
    + speed * dt / (2 * Math.PI * WHEEL_RADIUS_M) * LUMP_STEPS_PER_TURN;
  return car._wheelTurn;
}

/**
 * Draws a soft tyre or a rim, centred on the origin (the caller has moved and turned there).
 * @param ctx the canvas, in sprite pixels
 * @param tyreLen the full tyre's length, px
 * @param tyreWid the full tyre's width, px
 * @param pressure the tyre's air, 0..1
 * @param isOnRim the rubber is off
 * @param turn the wheels' turn (wheelTurn)
 * @returns false for a full tyre (the caller draws the ordinary wheel)
 */
export function drawTyreByPressure(
  ctx: CanvasRenderingContext2D, tyreLen: number, tyreWid: number, pressure: number,
  isOnRim: boolean, turn: number,
): boolean {
  if (isOnRim) {
    drawRim(ctx, tyreLen, tyreWid);
    return true;
  }
  if (pressure >= SOFT_FROM) return false;
  const soft = 1 - pressure, step = Math.floor(turn);
  const lumps = soft > 0.6, flop = soft > 0.8;
  const grow = (soft > 0.35 ? 1 : 0) + (flop ? 1 : 0);
  const wobble = flop ? [0, 1, 0, -1][Math.floor(turn / 2) % 4] : 0;
  const len = tyreLen + grow * 2, left = -Math.round(len / 2), top = -Math.round(tyreWid / 2)
    + wobble;
  ctx.fillStyle = flop ? TYRE_FLAT : lumps ? TYRE_SOFT : TYRE;
  ctx.fillRect(left, top, len, tyreWid);
  // rounded out a pixel on both sides
  ctx.fillRect(left + 1, top - 1, len - 2, 1);
  ctx.fillRect(left + 1, top + tyreWid, len - 2, 1);
  if (lumps) {
    // the sidewalls bulging at the ground, a lump rolling along each side
    const bulge = Math.max(1, len - 8);
    ctx.fillRect(left + 2 + (step % 5), top - 2, bulge, 1);
    ctx.fillRect(left + 2 + ((step + 2) % 5), top + tyreWid + 1, bulge, 1);
  }
  // tread blocks moving with the roll
  ctx.fillStyle = flop ? TREAD_FLAT : TREAD;
  for (let along = step % 3; along < len - 2; along += 3) {
    ctx.fillRect(left + 1 + along, top + 1, 1, Math.max(1, tyreWid - 2));
  }
  return true;
}

/**
 * The wheel on its rim: a thin silver rim, rubber shreds at its ends.
 * @param ctx the canvas, in sprite pixels
 * @param tyreLen the full tyre's length, px
 * @param tyreWid the full tyre's width, px
 */
function drawRim(ctx: CanvasRenderingContext2D, tyreLen: number, tyreWid: number) {
  const len = tyreLen - 2, wid = Math.max(2, tyreWid - 2);
  const left = -Math.round(len / 2), top = -Math.round(wid / 2);
  ctx.fillStyle = RIM_DARK;
  ctx.fillRect(left, top, len, wid);
  ctx.fillStyle = RIM_LIT;
  ctx.fillRect(left, top, len, 1);
  ctx.fillStyle = TYRE_FLAT;
  ctx.fillRect(left - 2, top, 2, 1);
  ctx.fillRect(left + len, top + wid - 1, 3, 1);
}

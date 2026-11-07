// render/wheelface.ts - ?carpaint (owner 11-07: "the thing that should be coloured by rim colour is
// when your wheel comes off ... laying flat"; "can we also maybe have different rims? spoke
// patterns"): the face of a wheel lying flat - the tyre, the rim in its colour, the SPOKE pattern.
// From above a mounted wheel shows only its tread, so this is where rims are seen: a loose wheel
// (render/objects.ts) and the garage's RIMS screen (menu/garage.ts).

// the patterns beside STEEL ('' - the loose tyre's look as it always was; owner: "I'm ok with our
// current steel look but just some others is good too")
export const SPOKES = ['five', 'mesh', 'split', 'dish'];
// the rim a car without its own colour has (the old loose tyre's grey)
export const STOCK_RIM = '#6b6f7a';
// the loose tyre's own colours (render/objects.ts tyreSprite)
const TYRE = '#0f1014', WALL = '#2a2c33', HUB = '#1d1f25';

/** A wheel's face, px from its centre: the tyre's outside and the rim's. */
export interface WheelGeo { outer: number; rimR: number }
// the loose tyre as it always was (a 17 px sprite)
export const OLD_WHEEL: WheelGeo = { outer: 7.2, rimR: 4.2 };

/**
 * ?carlooks: a wheel's face at the world's scale from its real size ("realistic along with tyre
 * profile": the sidewall is the tyre's own - a 10-inch Mini's tall, a 20-inch Lambo's thin).
 * @param dia the tyre's diameter, m
 * @param rim the rim's diameter, m
 * @param ppm px a metre
 * @returns the face
 */
export const realWheel = (dia: number, rim: number, ppm: number): WheelGeo =>
  ({ outer: dia / 2 * ppm, rimR: rim / 2 * ppm });

/**
 * The sprite side a face needs, px (odd, so there is a centre pixel).
 * @param geo the face
 * @returns px
 */
export const faceSize = (geo: WheelGeo) => (Math.ceil(geo.outer * 2) + 2) | 1;

/**
 * Fills (or with col null, clears) a disc on the pixel grid - a little fuller than the plain
 * radius, so a small disc reads round, not square (owner: "should the gold be rounder too").
 * @param ctx the canvas
 * @param size the grid's side, px
 * @param radius px
 * @param col the colour, or null to clear
 */
function disc(ctx: CanvasRenderingContext2D, size: number, radius: number, col: string | null) {
  if (col) ctx.fillStyle = col;
  const mid = (size - 1) / 2, reach = radius * radius + radius * 0.6;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if ((x - mid) ** 2 + (y - mid) ** 2 > reach) continue;
    if (col) ctx.fillRect(x, y, 1, 1);
    else ctx.clearRect(x, y, 1, 1);
  }
}

/**
 * Draws spokes from the hub out to the barrel's edge.
 * @param ctx the canvas
 * @param size the grid's side, px
 * @param angles the spokes' angles, rad
 * @param span [from, to] radius, px
 * @param col the colour
 */
function spokes(ctx: CanvasRenderingContext2D, size: number, angles: number[],
  span: [number, number], col: string): void {
  ctx.fillStyle = col;
  const mid = (size - 1) / 2;
  for (const angle of angles) for (let rad = span[0]; rad <= span[1]; rad += 0.5)
    ctx.fillRect(Math.round(mid + Math.cos(angle) * rad), Math.round(mid + Math.sin(angle) * rad),
      1, 1);
}

/**
 * Draws a wheel lying flat: the round tyre, its sidewall, the rim in its colour, a spoke pattern
 * inside it (or STEEL: the dark hub), the round hole the ground shows through.
 * @param ctx the canvas
 * @param size the grid's side, px
 * @param rim the rim colour
 * @param pattern a SPOKES name ('' = steel)
 * @param geo the face (OLD_WHEEL, or realWheel)
 */
export function drawWheelFace(ctx: CanvasRenderingContext2D, size: number, rim = STOCK_RIM,
  pattern = '', geo: WheelGeo = OLD_WHEEL): void {
  const around = (count: number, turn = 0) =>
    Array.from({ length: count }, (_unused, i) => turn + i * 2 * Math.PI / count - Math.PI / 2);
  const { outer, rimR } = geo, inner = rimR * 0.8, hole = Math.max(0.8, rimR * 0.32);
  disc(ctx, size, outer, TYRE);
  disc(ctx, size, outer - Math.max(0.9, outer * 0.12), WALL);
  disc(ctx, size, rimR, rim);
  if (pattern === 'mesh') {
    // a mesh wheel (cross-spoke): a checker of holes inside the rim
    const mid = (size - 1) / 2;
    ctx.fillStyle = HUB;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const rad = Math.hypot(x - mid, y - mid);
      if (rad > hole + 1 && rad < inner && (x + y) % 2 === 0) ctx.fillRect(x, y, 1, 1);
    }
  } else if (SPOKES.includes(pattern)) {
    // spokes over the dark barrel inside the rim ring (a deep dish: a wide lip, short spokes)
    const reach = pattern === 'dish' ? rimR * 0.62 : inner;
    disc(ctx, size, reach, HUB);
    const arms = pattern === 'split' ? [...around(5, -0.2), ...around(5, 0.2)] : around(5);
    spokes(ctx, size, arms, [hole, reach], rim);
  } else disc(ctx, size, rimR * 0.71, HUB);
  disc(ctx, size, hole, null);
}

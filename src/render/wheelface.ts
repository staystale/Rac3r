// render/wheelface.ts - ?carpaint (owner 11-07: "the thing that should be coloured by rim colour is
// when your wheel comes off ... laying flat"; "can we also maybe have different rims? spoke
// patterns"): the face of a wheel lying flat - the tyre, the rim in its colour, the SPOKE pattern.
// From above a mounted wheel shows only its tread, so this is where rims are seen: a loose wheel
// (render/objects.ts) and the paint shop's preview (menu/garage.ts).

// the patterns the paint shop offers ('' = the car's stock: five spokes)
export const SPOKES = ['five', 'mesh', 'split', 'dish', 'steel'];
// the rim a car without its own colour has (the old loose tyre's grey)
export const STOCK_RIM = '#6b6f7a';
const TYRE = '#0f1014', WALL = '#2a2c33', BARREL = '#15171c';

/**
 * Fills a disc on the pixel grid.
 * @param ctx the canvas
 * @param size the grid's side, px
 * @param radius px
 * @param col the colour
 */
function disc(ctx: CanvasRenderingContext2D, size: number, radius: number, col: string): void {
  ctx.fillStyle = col;
  const mid = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++)
    if ((x - mid) ** 2 + (y - mid) ** 2 <= radius * radius) ctx.fillRect(x, y, 1, 1);
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
  const mid = (size - 1) / 2, thick = Math.max(1, Math.round(size / 17));
  for (const angle of angles) for (let rad = span[0]; rad <= span[1]; rad += 0.5) {
    const x = Math.round(mid + Math.cos(angle) * rad - (thick - 1) / 2);
    const y = Math.round(mid + Math.sin(angle) * rad - (thick - 1) / 2);
    ctx.fillRect(x, y, thick, thick);
  }
}

/**
 * Draws a wheel lying flat: tyre, sidewall, the rim in its colour, the spoke pattern, the hub.
 * @param ctx the canvas
 * @param size the grid's side, px (17 in the world; bigger for the paint shop)
 * @param rim the rim colour
 * @param pattern a SPOKES name ('' = five)
 */
export function drawWheelFace(ctx: CanvasRenderingContext2D, size: number, rim = STOCK_RIM,
  pattern = ''): void {
  const unit = size / 17, around = (count: number, turn = 0) =>
    Array.from({ length: count }, (_unused, i) => turn + i * 2 * Math.PI / count - Math.PI / 2);
  disc(ctx, size, 7.2 * unit, TYRE);
  disc(ctx, size, 6.3 * unit, WALL);
  disc(ctx, size, 4.6 * unit, rim);
  const inner: [number, number] = [1.2 * unit, 4.0 * unit];
  if (pattern === 'mesh') {
    // a mesh wheel (cross-spoke): a checker of holes over the face
    const mid = (size - 1) / 2, cell = Math.max(1, Math.round(unit));
    ctx.fillStyle = BARREL;
    for (let y = 0; y < size; y += cell) for (let x = 0; x < size; x += cell) {
      const rad = Math.hypot(x - mid, y - mid);
      if (rad > 1.8 * unit && rad < 4.0 * unit && (x / cell + y / cell) % 2 === 0)
        ctx.fillRect(x, y, cell, cell);
    }
  } else if (pattern === 'steel') {
    // a steel wheel: a solid face with a ring of holes
    for (const angle of around(6)) {
      const mid = (size - 1) / 2, x = Math.round(mid + Math.cos(angle) * 2.8 * unit),
        y = Math.round(mid + Math.sin(angle) * 2.8 * unit), hole = Math.max(1, Math.round(unit));
      ctx.fillStyle = BARREL;
      ctx.fillRect(x, y, hole, hole);
    }
  } else {
    // a deep dish: a wide lip, short spokes; the rest: spokes over the dark barrel
    disc(ctx, size, (pattern === 'dish' ? 2.9 : 4.0) * unit, BARREL);
    const arms = pattern === 'split' ? [...around(5, -0.2), ...around(5, 0.2)] : around(5);
    spokes(ctx, size, arms, pattern === 'dish' ? [1.2 * unit, 2.9 * unit] : inner, rim);
  }
  disc(ctx, size, 1.4 * unit, rim);
  disc(ctx, size, 0.6 * unit, BARREL);
}

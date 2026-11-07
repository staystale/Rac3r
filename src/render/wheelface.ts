// render/wheelface.ts - ?carpaint (owner 11-07: "the thing that should be coloured by rim colour is
// when your wheel comes off ... laying flat"; "can we also maybe have different rims? spoke
// patterns"): the face of a wheel lying flat - the tyre, the rim in its colour, the SPOKE pattern.
// From above a mounted wheel shows only its tread, so this is where rims are seen: a loose wheel
// (render/objects.ts) and the paint shop's preview (menu/garage.ts).

// the patterns the paint shop offers beside STEEL ('' - the loose tyre's look as it always was)
export const SPOKES = ['five', 'mesh', 'split', 'dish'];
// the rim a car without its own colour has (the old loose tyre's grey)
export const STOCK_RIM = '#6b6f7a';
// the loose tyre's own colours (render/objects.ts tyreSprite)
const TYRE = '#0f1014', WALL = '#2a2c33', HUB = '#1d1f25';

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
 * Draws a wheel lying flat, the same size and look as the loose tyre always was (render/objects.ts
 * tyreSprite: the round tyre, its sidewall, the rim ring, the dark hub, the hole the ground shows
 * through) - the rim ring in the rim colour, and a spoke pattern inside it (owner 11-07: "I'm ok
 * with our current steel look but just some others is good too; tyres should be round like they
 * are now").
 * @param ctx the canvas
 * @param size the grid's side, px (17 in the world; a multiple of it for the paint shop)
 * @param rim the rim colour
 * @param pattern a SPOKES name ('' = steel: the look as it was)
 */
export function drawWheelFace(ctx: CanvasRenderingContext2D, size: number, rim = STOCK_RIM,
  pattern = ''): void {
  const unit = size / 17, around = (count: number, turn = 0) =>
    Array.from({ length: count }, (_unused, i) => turn + i * 2 * Math.PI / count - Math.PI / 2);
  disc(ctx, size, 7.2 * unit, TYRE);
  disc(ctx, size, 6.3 * unit, WALL);
  disc(ctx, size, 4.2 * unit, rim);
  if (pattern === 'mesh') {
    // a mesh wheel (cross-spoke): a checker of holes inside the rim
    const mid = (size - 1) / 2, cell = Math.max(1, Math.round(unit));
    ctx.fillStyle = HUB;
    for (let y = 0; y < size; y += cell) for (let x = 0; x < size; x += cell) {
      const rad = Math.hypot(x - mid, y - mid);
      if (rad > 1.6 * unit && rad < 3.6 * unit && (x / cell + y / cell) % 2 === 0)
        ctx.fillRect(x, y, cell, cell);
    }
  } else if (SPOKES.includes(pattern)) {
    // spokes over the dark barrel inside the rim ring (a deep dish: a wide lip, short spokes)
    const reach = (pattern === 'dish' ? 2.6 : 3.4) * unit;
    disc(ctx, size, reach, HUB);
    const arms = pattern === 'split' ? [...around(5, -0.2), ...around(5, 0.2)] : around(5);
    spokes(ctx, size, arms, [1.6 * unit, reach], rim);
  } else disc(ctx, size, 3.0 * unit, HUB);
  // the hole: the ground shows through
  const hole = Math.round(3 * unit), corner = Math.round((size - hole) / 2);
  ctx.clearRect(corner, corner, hole, hole);
}

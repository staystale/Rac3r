// render/props/woodfence.ts - A TORN WOODEN FENCE's pieces (world/armcodent.ts; a central
// reservation's fence, highway/medians.ts): a broken rail - a brown plank snapped at one end - and
// a post, each its own length by where it was thrown from (the splinters a second hit leaves are
// the loose objects' debris scatter, render/objects.ts).

const RAIL = '#7a5a36', RAIL_EDGE = '#5a4026', POST = '#5a4026', SHADOW = 'rgba(30,20,10,0.35)';

/**
 * Draws a torn wooden fence's piece (centred, already turned with it).
 * @param ctx the canvas
 * @param cone the piece
 * @param cone.kind woodrail or woodpost
 * @param cone.hx where it was thrown from, x (its look)
 * @param cone.hy y
 * @param ppm pixels per metre
 * @returns whether the kind was one of these
 */
export function drawWoodPiece(ctx: CanvasRenderingContext2D,
    cone: { kind: string; hx?: number; hy?: number }, ppm: number): boolean {
  if (cone.kind !== 'woodrail' && cone.kind !== 'woodpost') return false;
  const seed = Math.abs(Math.round((cone.hx || 0) * 11 + (cone.hy || 0) * 17)) % 97;
  if (cone.kind === 'woodpost') {
    const len = (0.7 + (seed % 5) * 0.08) * ppm, wide = 0.14 * ppm;
    ctx.fillStyle = SHADOW;
    ctx.fillRect(-len / 2 + wide * 0.4, -wide / 2 + wide * 0.4, len, wide);
    ctx.fillStyle = POST;
    ctx.fillRect(-len / 2, -wide / 2, len, wide);
    return true;
  }
  const len = (1.3 + (seed % 7) * 0.1) * ppm, wide = Math.max(2, 0.12 * ppm);
  ctx.fillStyle = SHADOW;
  ctx.fillRect(-len / 2 + wide * 0.5, -wide / 2 + wide * 0.5, len, wide);
  ctx.fillStyle = RAIL;
  ctx.fillRect(-len / 2, -wide / 2, len, wide);
  ctx.fillStyle = RAIL_EDGE;
  ctx.fillRect(-len / 2, wide / 4, len, wide / 4);
  // the snapped end: a jagged tip
  ctx.fillRect(len / 2 - wide, -wide / 2, wide, wide / 2);
  return true;
}

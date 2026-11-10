// render/props/tumbleweed.ts - a TUMBLEWEED seen from above (?desertjunk=1; cones/coneStep.ts
// blowTumbleweed blows it): a loose ball of dry brush, tan with darker stems through it, turning
// as it rolls and hopping - its shadow left behind on the ground, down-right as every other
// prop's, further the higher the hop.
// (greyer and darker than the sand it rolls over: tan on tan did not read)
const STEM = '#3f2c1a', BRUSH = ['#8e7350', '#6f5638', '#a88f68'];
const SHADOW = 'rgba(40,24,14,0.34)';
// m: the ball's radius (a big one: smaller would not read at play zoom), its highest hop, and the
// metres of roll a hop takes
const BALL_M = 0.7, HOP_M = 0.45, HOP_EVERY_M = 3.2;

/**
 * Draws a tumbleweed with the canvas already translated to it.
 * @param ctx the canvas
 * @param cone the object (kind, its roll so far, its home spot for its look)
 * @param cone.kind its kind (only a tumbleweed is drawn here)
 * @param cone.rollDist m it has rolled
 * @param cone.hx its home x
 * @param cone.hy its home y
 * @param ppm pixels per metre
 * @returns true for a tumbleweed
 */
export function drawTumbleweed(ctx: CanvasRenderingContext2D,
    cone: { kind: string; rollDist?: number; hx?: number; hy?: number }, ppm: number): boolean {
  if (cone.kind !== 'tumbleweed') return false;
  const roll = cone.rollDist || 0, hop = Math.abs(Math.sin(roll / HOP_EVERY_M * Math.PI)) * HOP_M;
  const seed = Math.abs(Math.round((cone.hx || 0) * 7 + (cone.hy || 0) * 13)) % 997 + 1;
  const size = BALL_M * ppm, dot = Math.max(1, ppm * 0.09);
  // the shadow on the ground, the ball up off it
  ctx.fillStyle = SHADOW;
  ctx.fillRect(-size + (0.2 + hop) * ppm, -size * 0.8 + (0.25 + hop) * ppm, size * 2, size * 1.6);
  ctx.save();
  ctx.translate(-hop * ppm * 0.4, -hop * ppm * 0.6);
  ctx.rotate(roll / BALL_M);
  // the dark stems through it first (its outline reads against the sand), the brush over them
  ctx.fillStyle = STEM;
  for (let stem = 0; stem < 5; stem++) {
    ctx.rotate(0.63 + (seed % 3) * 0.1);
    ctx.fillRect(-size * 0.95, -dot / 2, size * 1.9, dot);
  }
  for (let bit = 0; bit < 34; bit++) {
    // a tangle: bits round the ball, more toward its edge (a hollow ball of twigs)
    const angle = (bit * 2.4 + seed) % 6.283, reach = Math.sqrt((bit * 0.37 + seed * 0.013) % 1)
      * size;
    ctx.fillStyle = BRUSH[(bit + seed) % 3];
    ctx.fillRect(Math.cos(angle) * reach - dot, Math.sin(angle) * reach - dot, dot * 2, dot * 2);
  }
  ctx.restore();
  return true;
}

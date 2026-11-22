// render/props/stones.ts - a MOVABLE STONE seen from above (cones/stones.ts; ?spikerocks): an
// uneven lump of grey mountain rock, lit top-left and dark bottom-right as every rock prop
// (render/props/scenery.ts drawRock), its shadow down-right - each stone's own shape from its
// home spot, turned as it is pushed.
import { STONE_KINDS } from '../../cones/stones.ts';

// the rock's face, its lit top, its dark underside, its outline, its shadow
const FACE = '#8a8780', LIT = '#a9a69e', DARK = '#5d5a54', EDGE = '#3a3834';
const SHADOW = 'rgba(20,18,14,0.35)';
// corners of the lump, and how much each one's distance from the centre varies
const STONE_CORNERS = 7, STONE_LUMP = 0.35;

/**
 * Draws a stone with the canvas already translated to it and turned.
 * @param ctx the canvas
 * @param cone the object (its kind, its home spot for its shape)
 * @param cone.kind its kind (only a stone is drawn here)
 * @param cone.hx its home x
 * @param cone.hy its home y
 * @param ppm pixels per metre
 * @returns true for a stone
 */
export function drawLooseStone(ctx: CanvasRenderingContext2D,
    cone: { kind: string; hx?: number; hy?: number }, ppm: number): boolean {
  const kind = STONE_KINDS[cone.kind];
  if (!kind) return false;
  let seed = Math.abs(Math.round((cone.hx || 0) * 17 + (cone.hy || 0) * 31)) % 9973 + 1;
  const next = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const size = kind.r * ppm, corners: [number, number][] = [];
  for (let i = 0; i < STONE_CORNERS; i++) {
    const ang = (i / STONE_CORNERS) * Math.PI * 2, far = size * (1 - STONE_LUMP * next());
    corners.push([Math.cos(ang) * far, Math.sin(ang) * far * 0.8]);
  }
  const lump = (shiftX: number, shiftY: number, scale: number) => {
    ctx.beginPath();
    corners.forEach(([cornerX, cornerY], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx,
      cornerX * scale + shiftX, cornerY * scale + shiftY));
    ctx.closePath();
  };
  ctx.fillStyle = SHADOW;
  lump(size * 0.25, size * 0.3, 1);
  ctx.fill();
  ctx.fillStyle = DARK;
  lump(0, 0, 1);
  ctx.fill();
  ctx.fillStyle = FACE;
  lump(-size * 0.08, -size * 0.08, 0.85);
  ctx.fill();
  ctx.fillStyle = LIT;
  lump(-size * 0.22, -size * 0.22, 0.45);
  ctx.fill();
  ctx.strokeStyle = EDGE;
  ctx.lineWidth = Math.max(1, ppm * 0.03);
  lump(0, 0, 1);
  ctx.stroke();
  return true;
}

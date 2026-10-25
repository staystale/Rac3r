// The VOLUME of a bush on the ground tiles (world/bushplan.ts places them; the 'bush' art is its
// leaves), in the trees' pixel style (render/trees.ts): squares only - a shadow square down-right
// on the ground beside it, then over the bush's own square a mid square and a small lit square
// toward the upper left, and a dark band on its lower-right side. All but the shadow lie inside
// the bush's own square, so a cell flattened to long grass (render/ground/wear.ts) takes its
// share with it.
import type { Patch } from '../../world/types.ts';

// the shadow on the ground beside it (the trees' shadow colour and offset, a share of its side)
const SHADOW = 'rgba(10,12,16,0.32)', SHADOW_X = 0.25, SHADOW_Y = 0.35;
// the mid square and the lit square: [left, top, side] as shares of the bush's side, as the
// trees' canopy squares
const MID_SQUARE = [0.12, 0.1, 0.62], LIT_SQUARE = [0.2, 0.18, 0.3];
/** One kind of bush's greens: its ground art (base, leaf clumps, lit leaves, flecks), its volume's
 * mid and lit squares, and its tufts over the cars (render/bushtufts.ts). */
export interface BushLook {
  base: string; clumps: string; lit: string; fleck: string; mid: string; top: string;
}
// THE KINDS (world/bushplan.ts picks one per clump): deep holly, olive gorse with yellow
// flowers, blue-green box - greens of their own, apart from the grass
export const BUSH_LOOKS: Record<string, BushLook> = {
  bush: { base: '#1f3d24', clumps: '#2f5a34', lit: '#4f8a4a', fleck: '#78b060',
    mid: 'rgba(47,90,52,0.9)', top: 'rgba(120,176,96,0.6)' },
  bushOlive: { base: '#46521c', clumps: '#5f6e24', lit: '#8a9a34', fleck: '#e0c840',
    mid: 'rgba(95,110,36,0.9)', top: 'rgba(176,186,72,0.6)' },
  bushTeal: { base: '#1e4040', clumps: '#2d5e58', lit: '#4f8a7c', fleck: '#86b8a4',
    mid: 'rgba(45,94,88,0.9)', top: 'rgba(134,184,164,0.55)' },
};
// the dark band on the lower-right side, a share of the side wide
const SHADE = 'rgba(8,12,6,0.45)', SHADE_BAND = 0.16;

/**
 * Fills a square part of a bush, placed by shares of its side from its top-left corner.
 * @param ctx the tile context (origin at the world origin)
 * @param patch the bush (a square patch)
 * @param ppm px a metre
 * @param part [left, top, side] as shares of the bush's side
 */
function fillPart(ctx: CanvasRenderingContext2D, patch: Patch, ppm: number,
  part: number[]): void {
  const side = patch.w, left = patch.x - side / 2, top = patch.y - side / 2;
  ctx.fillRect((left + side * part[0]) * ppm, (top + side * part[1]) * ppm,
    side * part[2] * ppm, side * part[2] * ppm);
}

/**
 * Paints the shadow a bush casts beside it, before the bush (screen coordinates, no clip).
 * @param ctx the tile context
 * @param patch the bush
 * @param corner the bush's top-left corner on screen, px
 * @param corner.x screen x
 * @param corner.y screen y
 * @param ppm px a metre
 */
export function castBushShadow(ctx: CanvasRenderingContext2D, patch: Patch,
  corner: { x: number; y: number }, ppm: number): void {
  const side = patch.w * ppm;
  ctx.fillStyle = SHADOW;
  ctx.fillRect(corner.x + SHADOW_X * side, corner.y + SHADOW_Y * side, side, side);
}

/**
 * Paints a bush's mid and lit squares, before its leaf layers (the caller has clipped to the
 * bush and moved the origin to the world's).
 * @param ctx the tile context
 * @param patch the bush
 * @param ppm px a metre
 */
export function lightBushTop(ctx: CanvasRenderingContext2D, patch: Patch, ppm: number): void {
  const look = BUSH_LOOKS[patch.art || 'bush'] || BUSH_LOOKS.bush;
  ctx.fillStyle = look.mid;
  fillPart(ctx, patch, ppm, MID_SQUARE);
  ctx.fillStyle = look.top;
  fillPart(ctx, patch, ppm, LIT_SQUARE);
}

/**
 * Paints the dark band down a bush's right side and along its bottom, after its leaf layers
 * (same clip and origin).
 * @param ctx the tile context
 * @param patch the bush
 * @param ppm px a metre
 */
export function shadeBushSide(ctx: CanvasRenderingContext2D, patch: Patch, ppm: number): void {
  const side = patch.w, band = side * SHADE_BAND;
  const left = patch.x - side / 2, top = patch.y - side / 2;
  ctx.fillStyle = SHADE;
  ctx.fillRect((left + side - band) * ppm, top * ppm, band * ppm, side * ppm);
  ctx.fillRect(left * ppm, (top + side - band) * ppm, (side - band) * ppm, band * ppm);
}

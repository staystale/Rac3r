// render/tyresprite.ts - the pixel sprites of a loose TYRE: on its tread, lying flat, a stack, and
// a bare one with no wheel in it. Split out of render/objects.ts.
import { SPRITE_PPM } from "./shared.ts";
import type { RenderCone } from "./types.ts";

/** A painted sprite: its canvas and size, px. */
export interface ObjSprite { c: HTMLCanvasElement; size: number }
/** The objects layer's sprite cache: the sprite for a key, painted on first use. */
export type MakeSprite = (key: string, size: number,
  paint: (g: CanvasRenderingContext2D, n: number) => void) => ObjSprite;

/**
 * Paints a pixel disc of radius rr centred in a size x size sprite (pixel centres inside the
 * circle).
 * @param ctx the sprite's 2d context
 * @param size the sprite size in px
 * @param radius the disc radius in px
 * @param col the fill colour
 */
export function pdisc(ctx: CanvasRenderingContext2D, size: number, radius: number, col: string) {
  ctx.fillStyle = col; const mid = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if ((x - mid) ** 2 + (y
    - mid) ** 2 <= radius * radius) ctx.fillRect(x, y, 1, 1);
}

/**
 * A BARE TYRE lying flat or a stack of them (Deaf Valley's; owner 11-10: "tyres no
 * wheel inside"): the rubber ring, its tread edge darker, the ground through the middle - no rim.
 * @param make the sprite cache
 * @param stack a stack of them
 * @returns the sprite
 */
function bareTyreSprite(make: MakeSprite, stack: boolean): ObjSprite {
  return make(stack ? 'tyre-stack-bare' : 'tyre-flat-bare', 17, (ctx, size) => {
    pdisc(ctx, size, stack ? 8.2 : 7.2, '#0f1014');
    pdisc(ctx, size, stack ? 7.2 : 6.3, '#2a2c33');
    pdisc(ctx, size, stack ? 5.6 : 4.8, '#1d1f25');
    ctx.globalCompositeOperation = 'destination-out';
    pdisc(ctx, size, stack ? 4.6 : 3.9, '#000');
    ctx.globalCompositeOperation = 'source-over';
    if (stack) {
      ctx.fillStyle = '#4a4e58';
      for (let x = 4; x < 13; x++) ctx.fillRect(x, 2, 1, 1);
    }
  });
}

/**
 * Returns the sprite of a tyre or a tyre stack.
 * @param make the sprite cache
 * @param mode the tyre mode (stack / flat / roll / flip / wobble)
 * @returns the sprite
 */
export function tyreSprite(make: MakeSprite, mode: string, cone?: RenderCone): ObjSprite {
  // on its tread (a car's wheel at its real diameter and width)
  if ((mode === 'roll' || mode === 'flip' || mode === 'wobble') && cone?.wheelD && cone.tyreW) {
    const long = Math.round(cone.wheelD * SPRITE_PPM), wide = Math.max(2, Math.round(cone.tyreW
      * SPRITE_PPM)), side = long + 2;
    return make('tyre-side|' + long + '|' + wide, side, (ctx) => {
      const top = Math.round((side - wide) / 2);
      ctx.fillStyle = '#16171c'; ctx.fillRect(1, top, long, wide);
      ctx.fillStyle = '#3a3d47'; for (let x = 2; x < long; x += 3) ctx.fillRect(x, top, 1, wide);
    });
  }
  if (mode === 'roll' || mode === 'flip' || mode === 'wobble') return make('tyre-side',
    15, (ctx) => {
    ctx.fillStyle = '#16171c'; ctx.fillRect(0, 5, 15, 5);
    ctx.fillStyle = '#3a3d47'; for (let x = 1; x < 15; x += 3) ctx.fillRect(x, 5, 1, 5);
    ctx.fillStyle = '#6b6f7a'; ctx.fillRect(4, 6, 7, 1);
  });
  const stack = mode === 'stack';
  if (cone?.bare) return bareTyreSprite(make, stack);
  return make(stack ? 'tyre-stack' : 'tyre-flat', 17, (ctx, size) => {
    pdisc(ctx, size, stack ? 8.2 : 7.2, '#0f1014');
    pdisc(ctx, size, stack ? 7.2 : 6.3, '#2a2c33');
    pdisc(ctx, size, stack ? 5.0 : 4.2, '#6b6f7a');
    pdisc(ctx, size, stack ? 3.6 : 3.0, '#1d1f25');
    // top ring glint, sponsor fleck
    if (stack) {
      ctx.fillStyle = '#4a4e58';
      for (let x = 4; x < 13; x++) ctx.fillRect(x, 2, 1, 1);
      ctx.fillStyle = '#f2c94c';
      ctx.fillRect(12, 6, 1, 2);
    }
    // the hole: ground shows through
    ctx.clearRect(7, 7, 3, 3);
  });
}


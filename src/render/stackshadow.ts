// render/stackshadow.ts: a tyre stack's height, seen from above (?stackvary: stacks 1-4 tyres
// high, cones/coneConsts.ts heightenStack). From above a stack shows only its top tyre, so its
// height is in its shadow: the taller, the further the shadow falls down-right, as a car's ride
// height moves its shadow (render/cars.ts).

// sprite px: the stack sprite's size and its outer disc (render/objects.ts tyreSprite)
const STACK_SIZE = 17, STACK_RADIUS = 8.2;
// sprite px the shadow falls per tyre of height (a tyre ~0.2 m: ~3.5 px a metre up)
const SHADOW_PX_PER_TYRE = 1.5;
// how dark the shadow is
const SHADOW_ALPHA = 0.35;

let shadowSprite: HTMLCanvasElement | null = null;

/**
 * The shadow's pixel disc, made once.
 * @returns the sprite
 */
function shadowDisc(): HTMLCanvasElement {
  if (shadowSprite) return shadowSprite;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = STACK_SIZE;
  const ctx = canvas.getContext('2d')!, mid = (STACK_SIZE - 1) / 2;
  ctx.fillStyle = '#000';
  for (let y = 0; y < STACK_SIZE; y++) for (let x = 0; x < STACK_SIZE; x++) {
    if ((x - mid) ** 2 + (y - mid) ** 2 <= STACK_RADIUS ** 2) ctx.fillRect(x, y, 1, 1);
  }
  shadowSprite = canvas;
  return canvas;
}

/**
 * Draws a tyre stack's shadow under it, before the stack (the context at the stack's middle, not
 * yet turned: the shadow falls the same way however the stack lies).
 * @param ctx the screen context
 * @param unit screen px per sprite px
 * @param tyres the stack's height in tyres
 */
export function drawStackShadow(ctx: CanvasRenderingContext2D, unit: number, tyres: number) {
  const offset = tyres * SHADOW_PX_PER_TYRE, size = STACK_SIZE * unit;
  ctx.globalAlpha = SHADOW_ALPHA;
  ctx.drawImage(shadowDisc(), (offset - STACK_SIZE / 2) * unit, (offset - STACK_SIZE / 2) * unit,
    size, size);
  ctx.globalAlpha = 1;
}

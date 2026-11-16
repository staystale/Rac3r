// render/hanging.ts - ?dmgmore2: an EXHAUST LEFT HANGING (world/hanging.ts), drawn under the body
// each frame: the car's own exhaust (render/carparts.ts bitDrawing - its silencer, pipe and
// tailpipes) from its mount under the tail, swung down and back so its end trails past the
// bumper on the road (where its sparks fly from, render/particles.ts). Its picture is made once
// per car kind; nothing is allocated per frame.
import { bitDrawing } from './carparts.ts';
import { SPRITE_PPM } from './shared.ts';
import type { CarSprite, RenderCarSpec } from './types.ts';
import { EXHAUST_TRAIL_M } from '../world/hanging.ts';

// rad it hangs off the car's line (swung to one side as it drags)
const SWING_RAD = 0.25;
// the exhaust's picture per car kind (its pipes)
const PICTURES = new Map<string, HTMLCanvasElement | null>();

/**
 * The car's exhaust picture (its own: carparts.ts bitDrawing), kept per car.
 * @param spec the car as drawn
 * @returns the canvas, or null (a car with none)
 */
function exhaustPicture(spec: RenderCarSpec): HTMLCanvasElement | null {
  const key = String(spec.id);
  if (!PICTURES.has(key)) PICTURES.set(key, bitDrawing(spec, 'exhaust')?.canvas ?? null);
  return PICTURES.get(key) ?? null;
}

/**
 * Draws a hanging exhaust under the body (the car's frame, sprite px, nose +x).
 * @param ctx the canvas
 * @param spec the car as drawn
 * @param sprite its sprite (its length)
 */
export function drawHangingExhaust(ctx: CanvasRenderingContext2D, spec: RenderCarSpec,
  sprite: CarSprite): void {
  const picture = exhaustPicture(spec);
  if (!picture) return;
  const length = picture.width, tail = -sprite.Lp / 2;
  // (its tailpipes' end EXHAUST_TRAIL_M behind the tail, the rest of it back under the body to
  // its mount)
  const mount = tail - EXHAUST_TRAIL_M * SPRITE_PPM + length * Math.cos(SWING_RAD);
  ctx.save();
  ctx.translate(mount, 0);
  ctx.rotate(Math.PI - SWING_RAD);
  ctx.drawImage(picture, 0, -picture.height / 2);
  ctx.restore();
}

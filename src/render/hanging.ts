// render/hanging.ts - ?dmgmore2: an EXHAUST LEFT HANGING (world/hanging.ts), drawn under the body
// each frame: the car's exhaust at its own length (render/carparts.ts bitDrawing), DARK and THICK
// (owner: "darker, thicker" - a grey pipe was lost on grey tarmac) - near the tyres' black, ~2 px
// at game zoom - from its mount under the tail, swung down and back so its end trails past the
// bumper on the road (where its sparks fly from, render/particles.ts). Its picture is made once
// per car kind; nothing is allocated per frame.
import { bitDrawing } from './carparts.ts';
import { trackCanvas } from '../core/memorybudget.ts';
import { SPRITE_PPM } from './shared.ts';
import type { CarSprite, RenderCarSpec } from './types.ts';
import { EXHAUST_TRAIL_M } from '../world/hanging.ts';

// rad it hangs off the car's line (swung to one side as it drags)
const SWING_RAD = 0.25;
// the exhaust's picture per car kind (its pipes)
const PICTURES = new Map<string, HTMLCanvasElement | null>();
// px (sprite) of the silencer's and the pipe's thickness; the silencer's share of the length
const SILENCER_PX = 6, PIPE_PX = 4, SILENCER_SHARE = 0.35;
// the pipe near the tyres' black, its top edge, the silencer, the tailpipe's end
const PIPE = '#16171c', PIPE_EDGE = '#34363d', SILENCER = '#202227', TIP = '#6d707a';

/**
 * The car's exhaust picture (its own: carparts.ts bitDrawing), kept per car.
 * @param spec the car as drawn
 * @returns the canvas, or null (a car with none)
 */
function exhaustPicture(spec: RenderCarSpec): HTMLCanvasElement | null {
  const key = String(spec.id);
  if (!PICTURES.has(key)) {
    const own = bitDrawing(spec, 'exhaust')?.canvas;
    PICTURES.set(key, own ? paintExhaust(own.width) : null);
  }
  return PICTURES.get(key) ?? null;
}

/**
 * The hanging exhaust's picture: a dark silencer, a thick dark pipe with a lighter top edge, the
 * tailpipe's end.
 * @param length px (sprite), the car's own exhaust's
 * @returns the canvas
 */
function paintExhaust(length: number): HTMLCanvasElement {
  const canvas = trackCanvas(document.createElement('canvas'));
  canvas.width = length;
  canvas.height = SILENCER_PX;
  const ctx = canvas.getContext('2d')!, box = Math.round(length * SILENCER_SHARE);
  const pipeTop = (SILENCER_PX - PIPE_PX) / 2;
  ctx.fillStyle = SILENCER;
  ctx.fillRect(0, 0, box, SILENCER_PX);
  ctx.fillStyle = PIPE;
  ctx.fillRect(box, pipeTop, length - box, PIPE_PX);
  ctx.fillStyle = PIPE_EDGE;
  ctx.fillRect(box, pipeTop, length - box, 1);
  ctx.fillStyle = TIP;
  ctx.fillRect(length - 2, pipeTop, 2, PIPE_PX);
  return canvas;
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

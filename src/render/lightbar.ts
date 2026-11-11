// render/lightbar.ts - A POLICE CAR'S BLUES (?police=1; ai/trafficPolice.ts): no livery, a roof
// light bar - two blue halves across the roof, dark while it cruises or waits (you can still tell
// what it is), flashing left and right in turn while it chases you, the siren's twin (the siren's
// sound waits for the owner); at night each lit half glows blue (render/light.ts).
import { COL } from '../world/colours.ts';
import { SPRITE_PPM } from './shared.ts';
import type { CarSprite, RenderCar } from './types.ts';

// ms each half of the bar is lit in turn (~3 flashes a second each side)
const FLASH_MS = 160;
// the bar's middle, m ahead of the car's centre (the roof's front), its length along the car and
// its span across, m
export const BAR_ALONG_M = 0.1, BAR_LONG_M = 0.28, BAR_SPAN_M = 1.2;

/**
 * The side of the bar lit now (wall clock: a look): -1 the car's -y half, 1 its +y half.
 * @returns -1 / 1
 */
export function bluesSide(): number {
  return Math.floor(performance.now() / FLASH_MS) % 2 ? 1 : -1;
}

/**
 * The light bar on a police car's roof, in the sprite's frame (px, the nose toward +x): a dark
 * base, two halves - the lit one blue while it chases.
 * @param ctx the context, in the car's frame at sprite scale
 * @param car the car
 * @param sprite the body sprite (its size)
 */
export function drawLightBar(ctx: CanvasRenderingContext2D, car: RenderCar, sprite: CarSprite) {
  if (!car.police) return;
  const long = Math.max(2, Math.round(BAR_LONG_M * SPRITE_PPM));
  const span = Math.min(sprite.Wp - 6, Math.round(BAR_SPAN_M * SPRITE_PPM));
  const x = Math.round(BAR_ALONG_M * SPRITE_PPM - long / 2), half = Math.floor(span / 2);
  ctx.fillStyle = COL.hud;
  ctx.fillRect(x - 1, -half - 1, long + 2, span + 2);
  const lit = car.blues ? bluesSide() : 0;
  ctx.fillStyle = lit < 0 ? COL.blues : COL.bluesOff;
  ctx.fillRect(x, -half, long, half - 1);
  ctx.fillStyle = lit > 0 ? COL.blues : COL.bluesOff;
  ctx.fillRect(x, 1, long, half - 1);
}

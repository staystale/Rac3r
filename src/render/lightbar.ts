// render/lightbar.ts - A POLICE CAR'S BLUES (ai/trafficPolice.ts): a roof light bar -
// two blue halves across the roof, dark while it cruises or waits (you can still tell what it is),
// flashing left and right in turn while it chases, the siren's twin (the siren's sound waits for
// the owner) - and, while it chases, two blue flashers in the front grille and two in the back
// window, each pair flashing against the bar's half on its side (owner 11-11: "more lights - some
// on the front grille / back window like real life"). By day a small blue halo round each lit
// lamp; at night each throws its blue glow (render/light.ts, litPoliceLamps), the bar's furthest.
import { COL } from '../world/colours.ts';
import { SPRITE_PPM } from './shared.ts';
import type { CarSprite, RenderCar } from './types.ts';

// ms each half of the bar is lit in turn (~3 flashes a second each side)
const FLASH_MS = 160;
// the bar's middle, m ahead of the car's centre (the roof's front, ahead of the roof number:
// render/carsprite.ts paintPolice), its length along the car and its span across, m
export const BAR_ALONG_M = 0.25, BAR_LONG_M = 0.28, BAR_SPAN_M = 1.2;
// m in from the nose the grille's flashers sit, and in from each side (inside the headlights)
const GRILLE_IN_M = 0.15, GRILLE_SIDE_M = 0.45;
// the share of the length from the tail the back window's middle is, by body (render/carsprite.ts
// cabin: the saloon's rear glass from 0.20 to 0.29, the estate's from 0.03 to 0.10)
const BACK_WINDOW_SHARE: Record<string, number> = { saloon: 0.245, estate: 0.065 };
// m in from each side the back window's flashers sit; a flasher's size, sprite px
const BACK_SIDE_M = 0.4, FLASHER_PX = 2;
// sprite px a lit lamp's day halo reaches past it, and its strength (a small blue flash by day)
const HALO_PX = 3, HALO_ALPHA = 0.35;

/** A police lamp: its place on the car (m ahead of its centre, m across), its size, its glow. */
export interface PoliceLamp { along: number; across: number; side: number; glowM: number;
  isBar: boolean }

/**
 * The lit lamps of a chasing police car now, by the flash's side (reused: read it at once): the
 * bar's half on that side; the grille's and the back window's flashers on the other side.
 * @param car the car (its length, width and body)
 * @returns the lamps (none when it is not chasing)
 */
export function litPoliceLamps(car: RenderCar): PoliceLamp[] {
  LIT.length = 0;
  if (!car.police || !car.blues) return LIT;
  const side = bluesSide(), half = car.spec.len / 2, wid = car.spec.wid / 2;
  const backShare = BACK_WINDOW_SHARE[car.spec.kind] ?? 0.2;
  LIT.push({ along: BAR_ALONG_M, across: side * BAR_SPAN_M / 4, side, glowM: BAR_GLOW_M,
    isBar: true });
  LIT.push({ along: half - GRILLE_IN_M, across: -side * (wid - GRILLE_SIDE_M), side: -side,
    glowM: FLASHER_GLOW_M, isBar: false });
  LIT.push({ along: -half + backShare * car.spec.len, across: -side * (wid - BACK_SIDE_M),
    side: -side, glowM: FLASHER_GLOW_M, isBar: false });
  return LIT;
}
const LIT: PoliceLamp[] = [];
// m: the night glow's radius round the bar's lit half (it lights the road round the car) and
// round a grille or back-window flasher
export const BAR_GLOW_M = 7, FLASHER_GLOW_M = 2.6;

/**
 * The side of the bar lit now (wall clock: a look): -1 the car's -y half, 1 its +y half.
 * @returns -1 / 1
 */
export function bluesSide(): number {
  return Math.floor(performance.now() / FLASH_MS) % 2 ? 1 : -1;
}

/**
 * A small blue halo round a lit lamp (sprite px, the car's frame): the flash seen by day too.
 * @param ctx the context, in the car's frame at sprite scale
 * @param x the lamp's left, px
 * @param y its top, px
 * @param width px
 * @param height px
 */
function halo(ctx: CanvasRenderingContext2D, x: number, y: number, width: number,
  height: number) {
  ctx.globalAlpha = HALO_ALPHA;
  ctx.fillStyle = COL.blues;
  ctx.fillRect(x - HALO_PX, y - HALO_PX, width + 2 * HALO_PX, height + 2 * HALO_PX);
  ctx.globalAlpha = 1;
}

/**
 * The light bar on a police car's roof, in the sprite's frame (px, the nose toward +x): a dark
 * base, two halves - the lit one bright blue with a white core and a halo while it chases - and
 * the grille's and the back window's flashers lit against it.
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
  const lamps = litPoliceLamps(car), lit = lamps.length ? lamps[0].side : 0;
  for (const side of [-1, 1]) {
    const top = side < 0 ? -half : 1;
    if (side === lit) halo(ctx, x, top, long, half - 1);
    ctx.fillStyle = side === lit ? COL.blues : COL.bluesOff;
    ctx.fillRect(x, top, long, half - 1);
    if (side === lit) {
      ctx.fillStyle = COL.bluesCore;
      ctx.fillRect(x + 1, top + Math.floor((half - 1) / 2), Math.max(1, long - 2), 1);
    }
  }
  // the flashers (the lamps after the bar's)
  for (let i = 1; i < lamps.length; i++) {
    const lamp = lamps[i];
    const lampX = Math.round(lamp.along * SPRITE_PPM - FLASHER_PX / 2);
    const lampY = Math.round(lamp.across * SPRITE_PPM - FLASHER_PX / 2);
    halo(ctx, lampX, lampY, FLASHER_PX, FLASHER_PX);
    ctx.fillStyle = COL.blues;
    ctx.fillRect(lampX, lampY, FLASHER_PX, FLASHER_PX);
  }
}

// ms an angry driver's lamps are on, then off: a quick, cross flashing
const ANGRY_FLASH_MS = 220;

/**
 * Whether an angry driver's lamps are in the lit half of their flash (ai/
 * trafficPolice.ts makeAngry): its headlights (and their beams) and its brake lights flash
 * together - flashing back at you, brake-testing you; wall clock: a look.
 * @param car the car
 * @returns lit now
 */
export const isAngryFlashOn = (car: RenderCar): boolean => !!car.angry
  && Math.floor(performance.now() / ANGRY_FLASH_MS) % 2 === 0;

// sprite px: an angry driver's flashed headlights' halo past each lamp (read by day: the lamps
// alone are 3 px)
const ANGRY_HALO_PX = 4;

/**
 * An angry driver's headlights flashed by day too: a white halo round each, in the
 * lit half of the flash (the headlights themselves: render/cars.ts).
 * @param ctx the context, in the car's frame at sprite scale
 * @param car the car
 * @param sprite the body sprite (its size)
 */
export function drawAngryFlash(ctx: CanvasRenderingContext2D, car: RenderCar, sprite: CarSprite) {
  if (!isAngryFlashOn(car)) return;
  ctx.globalAlpha = HALO_ALPHA * 1.6;
  ctx.fillStyle = COL.bluesCore;
  for (const y of [-sprite.Wp / 2 + 4, sprite.Wp / 2 - 4])
    ctx.fillRect(sprite.Lp / 2 - 3 - ANGRY_HALO_PX, y - 2 - ANGRY_HALO_PX, 3 + 2 * ANGRY_HALO_PX,
      4 + 2 * ANGRY_HALO_PX);
  ctx.globalAlpha = 1;
}

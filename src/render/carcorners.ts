// render/carcorners.ts - ?underskin: A WHEEL CORNER THE DAMAGE EXPOSES, drawn each frame under
// the body (render/cars.ts drawCarWheels), so it shows only through what the body really lacks -
// a lost wing's hole (render/carparts.ts withoutParts) or the crushed edge cut back past the wheel
// (render/cardamage.ts) - and so its arms, track rod and drive shaft STEER with the front wheel.
// A corner is EXPOSED when its wing is lost, or when the crush reaches its wheel - its end's
// crush past the wheel's arch, or its side crushed in CRUSH_EXPOSE_PX or more where the wheel is:
// that wing is TORN (render/cars.ts takes it off the sprite as a lost wing's, no part thrown). A
// crushed corner also pushes its WHEEL in with the crumpled metal - back by the end crush past
// the arch, inboard by the side crush there - and the arms run from the chassis to the wheel
// where it now is (drawn only: the physics' wheel is where it was). The well a dark cavity; the
// arms, shaft and track rod as the open cars draw theirs (render/cars.ts drawFixedArms), dark and
// UNDER the tyre - seen inboard of it where the body is gone; the strut's spring and top mount
// OVER the wheel, at the top of its arch (drawExposedStrut, after the tyre) - seen where the wing
// over the wheel is gone. Nothing is allocated per frame.
import { END_CRUSH_SHARE, REAR_CRUSH_SHARE, SIDE_CRUSH_SHARE } from "./cardamage.ts";
import { SPRITE_PPM } from "./shared.ts";
import type { CarSprite, RenderCar } from "./types.ts";

// the strut's spring, its top mount, its nut
const SPRING = '#d0d4da', MOUNT = '#5a5f69', NUT = '#16181d';
// px a side's crush must reach to open its wheel's well (the arch's inner skin pushed in)
const CRUSH_EXPOSE_PX = 3;
// m of the steering arm from the hub (render/cars.ts drawWishbones)
const STEER_ARM_M = 0.14;
// a corner SEVERELY crushed shows all its strut (else only its inner half, the arch's inner lip):
// its damage to this (physics/cornerbreak.ts BREAK_AT, a broken corner), or its wheel pushed in or
// back by this share of the tyre
const STRUT_ALL_DAMAGE = 0.65, STRUT_ALL_PUSH = 0.5;
// px either side of the strut's centre (strutTop draws 5 x 5)
const STRUT_HALF_PX = 2;

/** Where a corner's wheel is drawn off its place (px, car frame) and whether it is exposed. */
export interface CornerShift { x: number; y: number; exposed: boolean }
// the one shift handed out (read at once by the caller; nothing allocated per frame)
const SHIFT: CornerShift = { x: 0, y: 0, exposed: false };

/** Where a wheel sits: its axle (m), half the track (px), its tyre (px). */
export interface WheelPlace { axleX: number; halfWidth: number; tyreLen: number; tyreWid: number }

/**
 * A corner's exposure and its wheel's push-in by the crush, read where the wheel is (the crush's
 * own depths, render/cardamage.ts crushPixel: an end's by its corner, a side's sloped along it).
 * @param car the car (its crush)
 * @param sprite its sprite (its length and width, px)
 * @param corner the damage corner (0, 1 front; odd = +y)
 * @param wheel where the wheel sits
 * @param lost the parts gone, the torn wings with them ("kind:corner", joined by ",")
 * @returns the shift (the same object every call)
 */
export function cornerShift(car: RenderCar, sprite: CarSprite, corner: number,
  wheel: WheelPlace, lost: string): CornerShift {
  const { back, inward, sideDepth } = crushAtWheel(car, sprite, corner, wheel);
  const front = corner < 2, side = corner % 2 ? 1 : -1;
  SHIFT.x = Math.round(front ? -back : back);
  SHIFT.y = Math.round(-side * inward);
  SHIFT.exposed = back > 0 || sideDepth >= CRUSH_EXPOSE_PX || lost.includes('wing:' + corner);
  return SHIFT;
}

/**
 * Whether the crush has reached a corner's wheel: its wing is torn.
 * @param car the car (its crush)
 * @param sprite its sprite
 * @param corner the damage corner
 * @param wheel where the wheel sits
 * @returns torn
 */
export function isWingTorn(car: RenderCar, sprite: CarSprite, corner: number,
  wheel: WheelPlace): boolean {
  const { back, sideDepth } = crushAtWheel(car, sprite, corner, wheel);
  return back > 0 || sideDepth >= CRUSH_EXPOSE_PX;
}

// the crush read at a wheel, px (reused: read at once)
const AT_WHEEL = { back: 0, inward: 0, sideDepth: 0 };

/**
 * The crush at a wheel: px its end's crush has gone past the wheel's arch (the wheel pushed back
 * by that), the side's crush depth where the wheel is and the px it pushes the wheel in.
 * @param car the car
 * @param sprite its sprite
 * @param corner the damage corner
 * @param wheel where the wheel sits
 * @returns the depths (the same object every call)
 */
function crushAtWheel(car: RenderCar, sprite: CarSprite, corner: number, wheel: WheelPlace) {
  const front = corner < 2, ends = car.crushL, sides = car.crushS;
  const endDepth = ends ? sprite.Lp * END_CRUSH_SHARE * (front ? 1 : REAR_CRUSH_SHARE)
    * ends[corner] : 0;
  // (the side's crush slopes from its rear corner to its front one: crushPixel's depthNeg / Pos)
  const along = Math.min(1, Math.max(0, 0.5 + wheel.axleX * SPRITE_PPM / sprite.Lp));
  const frontCorner = corner % 2, rearCorner = frontCorner + 2;
  const sideDepth = sides ? sprite.Wp * SIDE_CRUSH_SHARE * (sides[rearCorner] * (1 - along)
    + sides[frontCorner] * along) : 0;
  // (px from the car's end to the tyre's end; from the car's side to the tyre's outer edge)
  const overhang = sprite.Lp / 2 - Math.abs(wheel.axleX) * SPRITE_PPM - wheel.tyreLen / 2;
  const beyond = sprite.Wp / 2 - (wheel.halfWidth + wheel.tyreWid / 2);
  AT_WHEEL.back = Math.min(wheel.tyreLen, Math.max(0, endDepth - overhang));
  AT_WHEEL.inward = Math.min(wheel.tyreWid, Math.max(0, sideDepth - Math.max(0, beyond)));
  AT_WHEEL.sideDepth = sideDepth;
  return AT_WHEEL;
}

/**
 * An exposed corner, under the body and before its tyre - nothing under the arch but the road:
 * the arms and a driven wheel's drive shaft from the chassis to the hub where it now is, and a
 * front's track rod to its steering arm at the wheel's steer (render/cars.ts drawWishbones' own).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param wheel the corner: its axle (m), side (-1 / 1), steer (rad), half the track (px)
 * @param shift the wheel's push-in (px)
 * @param arms paints the fixed arms and shaft to the hub (render/cars.ts drawFixedArms)
 * @param rodColour the track rod's colour (the arms')
 */
export function drawExposedCorner(ctx: CanvasRenderingContext2D,
  wheel: { axleX: number; side: number; steer: number; halfWidth: number },
  shift: CornerShift, arms: () => void, rodColour: string): void {
  const { axleX, side, steer, halfWidth } = wheel;
  const hubX = axleX * SPRITE_PPM + shift.x, hubY = side * halfWidth + shift.y;
  arms();
  if (axleX <= 0) return;
  // the track rod from the rack to the steering arm, turned with the wheel (drawWishbones' own)
  const arm = STEER_ARM_M * SPRITE_PPM;
  ctx.fillStyle = rodColour;
  steerRod(ctx, [hubX - arm, side * 2], [hubX - Math.cos(steer) * arm,
    hubY - Math.sin(steer) * arm]);
}

/**
 * An exposed corner's STRUT, over its tyre: the coil spring and top mount at the top of the arch,
 * over the tyre's inner edge (seen where the wing over the wheel is gone). Only its INNER half -
 * the half toward the car's middle, under the arch's inner lip - unless the corner is severely
 * crushed (its damage to STRUT_ALL_DAMAGE, or its wheel pushed STRUT_ALL_PUSH of a tyre).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param wheel the corner: its axle (m), side (-1 / 1), half the track, the tyre's length and width
 *   (px), the corner's damage (0..1)
 * @param shift the wheel's push-in (px)
 */
export function drawExposedStrut(ctx: CanvasRenderingContext2D,
  wheel: { axleX: number; side: number; halfWidth: number; tyreLen: number; tyreWid: number;
    damage: number },
  shift: CornerShift): void {
  const { axleX, side, halfWidth, tyreLen, tyreWid, damage } = wheel;
  const centreX = axleX * SPRITE_PPM + shift.x;
  const centreY = side * (halfWidth - tyreWid / 2) + shift.y;
  const severe = damage >= STRUT_ALL_DAMAGE || Math.abs(shift.x) >= tyreLen * STRUT_ALL_PUSH
    || Math.abs(shift.y) >= tyreWid * STRUT_ALL_PUSH;
  if (severe) {
    strutTop(ctx, centreX, centreY);
    return;
  }
  // (the inner half: its centre row and the rows toward the car's middle)
  const x = Math.round(centreX) - STRUT_HALF_PX, y = Math.round(centreY);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, side > 0 ? y - STRUT_HALF_PX : y, STRUT_HALF_PX * 2 + 1, STRUT_HALF_PX + 1);
  ctx.clip();
  strutTop(ctx, centreX, centreY);
  ctx.restore();
}

/**
 * A 1 px line on the car's pixel grid.
 * @param ctx the canvas
 * @param from [x, y]
 * @param dest [x, y]
 */
function steerRod(ctx: CanvasRenderingContext2D, from: number[], dest: number[]): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dest[0] - from[0]),
    Math.abs(dest[1] - from[1]))));
  for (let step = 0; step <= steps; step++) {
    const share = step / steps;
    ctx.fillRect(Math.round(from[0] + (dest[0] - from[0]) * share),
      Math.round(from[1] + (dest[1] - from[1]) * share), 1, 1);
  }
}

/**
 * A STRUT seen from above, centred at (centreX, centreY) px: the coil spring's ring, the top
 * mount, its nut.
 * @param ctx the canvas
 * @param centreX px
 * @param centreY px
 */
function strutTop(ctx: CanvasRenderingContext2D, centreX: number, centreY: number): void {
  const x = Math.round(centreX) - 2, y = Math.round(centreY) - 2;
  ctx.fillStyle = SPRING;
  ctx.fillRect(x + 1, y, 3, 5);
  ctx.fillRect(x, y + 1, 5, 3);
  ctx.fillStyle = MOUNT;
  ctx.fillRect(x + 1, y + 1, 3, 3);
  ctx.fillStyle = NUT;
  ctx.fillRect(x + 2, y + 2, 1, 1);
}

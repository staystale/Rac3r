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
import { SUSP_ROD, SUSP_STRUT, SUSP_WISHBONE } from "../world/debris.ts";

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
// m a wing's opening reaches in from the car's side (render/carparts.ts WELL_DEPTH_M): a strut
// not severely crushed stands at its inner lip
const OPENING_DEPTH_M = 0.68;

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
 * @param rod the track rod's colour, and its lighter edge if it has one (the arms')
 * @param rackY px across where the track rod leaves the rack (a closed car: its subframe)
 */
export function drawExposedCorner(ctx: CanvasRenderingContext2D,
  wheel: { axleX: number; side: number; steer: number; halfWidth: number },
  shift: CornerShift, arms: () => void, rod: { colour: string; edge?: string },
  rackY = wheel.side * 2): void {
  const { axleX, side, steer, halfWidth } = wheel;
  const hubX = axleX * SPRITE_PPM + shift.x, hubY = side * halfWidth + shift.y;
  arms();
  if (axleX <= 0) return;
  // the track rod from the rack to the steering arm, turned with the wheel (drawWishbones' own)
  const arm = STEER_ARM_M * SPRITE_PPM;
  const from = [hubX - arm, rackY], dest = [hubX - Math.cos(steer) * arm,
    hubY - Math.sin(steer) * arm];
  if (rod.edge) {
    ctx.fillStyle = rod.edge;
    steerRod(ctx, from, dest, 3);
  }
  ctx.fillStyle = rod.colour;
  steerRod(ctx, from, dest, 1);
}

/**
 * An exposed corner's STRUT, never under its tyre: severely crushed (its damage to
 * STRUT_ALL_DAMAGE, or its wheel pushed STRUT_ALL_PUSH of a tyre) it stands over the tyre's inner
 * edge, all of it seen; else at the opening's inner lip, its inner half under the body still there
 * (drawn before the body), so only part of it shows - never cut along the tyre.
 * @param ctx the canvas (the car's frame, sprite px)
 * @param wheel the corner: its axle (m), side (-1 / 1), half the track, the tyre's length and
 *   width, half the body's width (px), the corner's damage (0..1)
 * @param shift the wheel's push-in (px)
 */
export function drawExposedStrut(ctx: CanvasRenderingContext2D,
  wheel: { axleX: number; side: number; halfWidth: number; tyreLen: number; tyreWid: number;
    bodyHalf: number; damage: number },
  shift: CornerShift): void {
  const { axleX, side, halfWidth, tyreLen, tyreWid, bodyHalf, damage } = wheel;
  const centreX = axleX * SPRITE_PPM + shift.x;
  const severe = damage >= STRUT_ALL_DAMAGE || Math.abs(shift.x) >= tyreLen * STRUT_ALL_PUSH
    || Math.abs(shift.y) >= tyreWid * STRUT_ALL_PUSH;
  const centreY = severe ? side * (halfWidth - tyreWid / 2) + shift.y
    : side * (bodyHalf - OPENING_DEPTH_M * SPRITE_PPM);
  strutTop(ctx, centreX, centreY);
}

/**
 * A line on the car's pixel grid, a square sizePx wide at each step.
 * @param ctx the canvas
 * @param from [x, y]
 * @param dest [x, y]
 * @param sizePx px (1: the line itself)
 */
function steerRod(ctx: CanvasRenderingContext2D, from: number[], dest: number[],
  sizePx: number): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dest[0] - from[0]),
    Math.abs(dest[1] - from[1]))));
  const back = Math.floor(sizePx / 2);
  for (let step = 0; step <= steps; step++) {
    const share = step / steps;
    ctx.fillRect(Math.round(from[0] + (dest[0] - from[0]) * share) - back,
      Math.round(from[1] + (dest[1] - from[1]) * share) - back, sizePx, sizePx);
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

// ?underskin: m in from the car's side where a closed car's exposed arms meet the chassis (its
// SUBFRAME; from the car's middle they ran under the body and only the strut showed). Owner 11-16:
// "cars should have a sub frame too like real life or the wishbones attach to nothing" - a dark
// rail along the car there, m either side of the axle, px thick
export const SUBFRAME_M = 0.6;
export const SUBFRAME = '#202227', SUBFRAME_HALF_M = 0.32, SUBFRAME_PX = 2;
// a wheel torn off (owner 11-16: "the hub is still attached"): its hub went with it; what stayed is
// SNAPPED - the arms (and a driven wheel's inner shaft) end this share of the way out from the
// subframe to where the hub was, shorter when the wishbone went too
export const SNAP_SHARE = 0.6, SNAP_SHARE_NO_WISHBONE = 0.3;
// a front's track rod torn away with its wheel (SUSP_ROD): its stub at the rack, this share of the
// way out to where the steering arm was
export const ROD_STUB_SHARE = 0.3;
// the snapped ends' hub and the strut's place, reused (nothing allocated per frame)
const SNAP_HUB = { x: 0, y: 0 };
const SNAP_SHIFT: CornerShift = { x: 0, y: 0, exposed: true };

/**
 * ?underskin: a closed car's SUBFRAME rail at one corner, where its arms bolt on (drawn before the
 * arms and the body: it shows only through the corner's opening).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param axleX the axle, m
 * @param innerY px across, the arms' inner ends
 * @param side -1 / 1
 */
export function drawSubframe(ctx: CanvasRenderingContext2D, axleX: number, innerY: number,
  side: number): void {
  const half = SUBFRAME_HALF_M * SPRITE_PPM;
  ctx.fillStyle = SUBFRAME;
  ctx.fillRect(Math.round(axleX * SPRITE_PPM - half), Math.round(innerY - (side > 0 ? 1 : 0)),
    Math.round(half * 2), SUBFRAME_PX);
}

/**
 * ?underskin: a closed car's corner whose wheel was torn off - no hub, the road through the torn
 * wing, the subframe, the arms and shaft that stayed snapped short, the strut if it stayed
 * (world/debris.ts wheelBits: what was thrown is gone from the car, car.suspOff).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param car the car
 * @param sprite its sprite
 * @param wheel the corner: its axle (m), side, half the track and the tyre (px), damage corner
 * @param arms paints the fixed arms to a hub (offset px) from innerY (render/cars.ts)
 * @param rodColour the track rod's colour (a front's stub, SUSP_ROD)
 */
export function drawSnappedCorner(ctx: CanvasRenderingContext2D, car: RenderCar,
  sprite: CarSprite, wheel: { axleX: number; side: number; halfWidth: number; corner: number;
    tyreLen: number; tyreWid: number },
  arms: (hub: { x: number; y: number }, innerY: number) => void, rodColour = SUBFRAME): void {
  const { axleX, side, halfWidth, corner } = wheel, off = car.suspOff?.[corner] ?? 0;
  const innerY = side * (sprite.Wp / 2 - SUBFRAME_M * SPRITE_PPM), hubY = side * halfWidth;
  const share = off & SUSP_WISHBONE ? SNAP_SHARE_NO_WISHBONE : SNAP_SHARE;
  SNAP_HUB.y = innerY + (hubY - innerY) * share - hubY;
  drawSubframe(ctx, axleX, innerY, side);
  arms(SNAP_HUB, innerY);
  if (off & SUSP_ROD) {
    // (the track rod's stub at the rack, in line with where the steering arm was, behind the hub)
    const rodX = (axleX - STEER_ARM_M) * SPRITE_PPM;
    ctx.fillStyle = rodColour;
    steerRod(ctx, [rodX, innerY], [rodX, innerY + (hubY - innerY) * ROD_STUB_SHARE], 1);
  }
  if (off & SUSP_STRUT) return;
  drawExposedStrut(ctx, { axleX, side, halfWidth, tyreLen: wheel.tyreLen, tyreWid: wheel.tyreWid,
    bodyHalf: sprite.Wp / 2, damage: car.dmg ? car.dmg[corner] : 0 }, SNAP_SHIFT);
}

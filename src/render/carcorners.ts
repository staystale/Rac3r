// render/carcorners.ts - ?underskin: A WHEEL CORNER THE DAMAGE EXPOSES, drawn each frame under
// the body (render/cars.ts drawCarWheels), so it shows only through what the body really lacks -
// a lost wing's hole (render/carparts.ts withoutParts) or the crushed edge cut back past the wheel
// (render/cardamage.ts) - and so its arms, track rod and drive shaft STEER with the front wheel.
// A corner is EXPOSED when its wing is lost, or when the crush reaches its wheel - its end's
// crush past the wheel's arch, or its side crushed in CRUSH_EXPOSE_PX or more where the wheel is:
// that wing is TORN (render/cars.ts takes it off the sprite as a lost wing's, no part thrown). A
// crushed corner also pushes its WHEEL in with the crumpled metal - back by the end crush past
// the arch, inboard by the side crush there - and the arms run from the chassis to the wheel
// where it now is (drawn only: the physics' wheel is where it was). The well a dark cavity, the
// arms, shaft and spring bright steel two px wide, to read at a phone's size. Nothing is
// allocated per frame.
import { END_CRUSH_SHARE, REAR_CRUSH_SHARE, SIDE_CRUSH_SHARE } from "./cardamage.ts";
import { SPRITE_PPM } from "./shared.ts";
import type { CarSprite, RenderCar, RenderCarSpec } from "./types.ts";

// the inside of a wheel's well in shadow; the strut's spring, its top mount, its nut
const WELL = '#2a2d33', SPRING = '#d0d4da', MOUNT = '#5a5f69', NUT = '#16181d';
// the steering's track rod, bright steel (the arms' colour in a well)
const TRACK_ROD = '#9aa0aa';
// px a side's crush must reach to open its wheel's well (the arch's inner skin pushed in)
const CRUSH_EXPOSE_PX = 3;
// px the well reaches either side of the axle (as a wing's hole, render/carparts.ts partRegion)
const WELL_HALF_PX = 7;
// m the well reaches in from the car's side (render/carparts.ts WELL_DEPTH_M)
const WELL_DEPTH_M = 0.45;
// px a strut's top sits off the axle line toward the car's middle; px it sits inboard of the tyre
const STRUT_OFFSET_PX = 3, STRUT_IN_PX = 3;
// m of the steering arm from the hub (render/cars.ts drawWishbones)
const STEER_ARM_M = 0.14;

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
 * An exposed corner, under the body: the dark well inboard of the tyre, the arms and a driven
 * wheel's drive shaft from the chassis to the hub where it now is, a front's track rod at the
 * wheel's steer, and the strut's top.
 * @param ctx the canvas (the car's frame, sprite px)
 * @param spec the car as drawn
 * @param wheel the corner: its axle (m), side (-1 / 1), steer (rad), half the track and the tyre's
 *   width (px)
 * @param sprite the car's sprite (its width)
 * @param shift the wheel's push-in (px)
 * @param arms paints the fixed arms and shaft to the hub (render/cars.ts drawFixedArms, bright)
 */
export function drawExposedCorner(ctx: CanvasRenderingContext2D, spec: RenderCarSpec,
  wheel: { axleX: number; side: number; steer: number; halfWidth: number; tyreWid: number },
  sprite: CarSprite, shift: CornerShift, arms: () => void): void {
  const { axleX, side, steer, halfWidth, tyreWid } = wheel;
  const hubX = axleX * SPRITE_PPM + shift.x, hubY = side * halfWidth + shift.y;
  const tyreIn = side * (halfWidth - tyreWid / 2) + shift.y;
  // (the well from WELL_DEPTH_M in to the car's side: the tyre is drawn over it)
  const deepIn = side * (sprite.Wp / 2 - WELL_DEPTH_M * SPRITE_PPM), outer = side * sprite.Wp / 2;
  ctx.fillStyle = WELL;
  ctx.fillRect(Math.round(hubX - WELL_HALF_PX), Math.round(Math.min(outer, deepIn)),
    WELL_HALF_PX * 2, Math.round(Math.abs(outer - deepIn)));
  arms();
  const front = axleX > 0;
  if (front) {
    // the track rod, turned with the wheel (render/cars.ts drawWishbones' steering arm)
    const arm = STEER_ARM_M * SPRITE_PPM;
    ctx.fillStyle = TRACK_ROD;
    for (let line = 0; line < 2; line++)
      steerRod(ctx, [hubX - arm, side * 2 + line], [hubX - Math.cos(steer) * arm,
        hubY - Math.sin(steer) * arm + line]);
  }
  strutTop(ctx, hubX + (front ? -STRUT_OFFSET_PX : STRUT_OFFSET_PX),
    tyreIn - side * STRUT_IN_PX);
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

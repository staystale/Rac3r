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
import type { CarSprite, RenderCar } from "./types.ts";

// the inside of a wheel's well in shadow; the strut's spring, its top mount, its nut
const WELL = '#2a2d33', SPRING = '#d0d4da', MOUNT = '#5a5f69', NUT = '#16181d';
// the steering - the hub carrier, its steering arm and the track rod - bright steel, each line in
// a dark rim (the well's arms' look, render/cars.ts WELL_ARMS), to read on the tyre and the body
const STEER_STEEL = '#e2e5ea', STEER_RIM = '#0b0c0f';
// px a side's crush must reach to open its wheel's well (the arch's inner skin pushed in)
const CRUSH_EXPOSE_PX = 3;
// px the well reaches either side of the axle (as a wing's hole, render/carparts.ts partRegion)
const WELL_HALF_PX = 7;
// m the well reaches in from the car's side (render/carparts.ts WELL_DEPTH_M)
const WELL_DEPTH_M = 0.45;
// px a strut's top sits ahead of the axle line; px it sits inboard of the tyre
const STRUT_OFFSET_PX = 3, STRUT_IN_PX = 4;
// m of the steering arm behind the hub (render/cars.ts drawWishbones), and px it reaches inboard
// of the tyre's inner face - out from under the tyre, where the track rod meets it
const STEER_ARM_M = 0.2, STEER_ARM_IN_PX = 3;
// m of the hub carrier along the wheel either side of the axle; px of steel each line is
const CARRIER_HALF_M = 0.12, STEEL_PX = 2;

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
 * px the crush pushed a corner's wheel in and back (its well's hole reaches as far:
 * render/carparts.ts wellRegion).
 * @param car the car (its crush)
 * @param sprite its sprite
 * @param corner the damage corner
 * @param wheel where the wheel sits
 * @returns "inward:back", whole px ("0:0" not pushed)
 */
export function wellReach(car: RenderCar, sprite: CarSprite, corner: number,
  wheel: WheelPlace): string {
  const { back, inward } = crushAtWheel(car, sprite, corner, wheel);
  return Math.ceil(inward) + ':' + Math.ceil(back);
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
 * An exposed corner, under the body and before its tyre: the dark well inboard of the tyre, the
 * arms and a driven wheel's drive shaft from the chassis to the hub where it now is.
 * @param ctx the canvas (the car's frame, sprite px)
 * @param wheel the corner: its axle (m), side (-1 / 1), half the track (px)
 * @param sprite the car's sprite (its width)
 * @param shift the wheel's push-in (px)
 * @param arms paints the fixed arms and shaft to the hub (render/cars.ts drawFixedArms, bright)
 */
export function drawExposedCorner(ctx: CanvasRenderingContext2D,
  wheel: { axleX: number; side: number },
  sprite: CarSprite, shift: CornerShift, arms: () => void): void {
  const { axleX, side } = wheel;
  const axlePx = axleX * SPRITE_PPM, hubX = axlePx + shift.x;
  // (the well from WELL_DEPTH_M in to the car's side and as far in as the wheel was pushed, from
  // the axle's place to the wheel's - the hole's own reach, carparts.ts wellRegion: the tyre is
  // drawn over it)
  const deepIn = side * (sprite.Wp / 2 - WELL_DEPTH_M * SPRITE_PPM - Math.abs(shift.y));
  const outer = side * sprite.Wp / 2;
  const fromX = Math.min(axlePx, hubX) - WELL_HALF_PX, toX = Math.max(axlePx, hubX) + WELL_HALF_PX;
  ctx.fillStyle = WELL;
  ctx.fillRect(Math.round(fromX), Math.round(Math.min(outer, deepIn)), Math.round(toX - fromX),
    Math.round(Math.abs(outer - deepIn)));
  arms();
}

/** An exposed wheel as drawn: its axle (m), side, steer (rad), half the track and tyre (px). */
export interface ExposedWheel {
  axleX: number; side: number; steer: number; halfWidth: number; tyreWid: number
}

/**
 * An exposed corner's STEERING, over its tyre (the arms run in under it): the hub carrier at the
 * tyre's inner face, turned with the wheel; on a front its steering arm reaching back and inboard
 * out from under the tyre, and the track rod from the rack to it. Each line bright steel in a dark
 * rim, every rim drawn first, over the strut's top (inboard of the carrier; on a front ahead of the
 * axle, clear of the steering arm behind it).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param wheel the corner as drawn
 * @param shift the wheel's push-in (px)
 */
export function drawExposedSteering(ctx: CanvasRenderingContext2D, wheel: ExposedWheel,
  shift: CornerShift): void {
  const hubX = wheel.axleX * SPRITE_PPM + shift.x;
  const tyreIn = wheel.side * (wheel.halfWidth - wheel.tyreWid / 2) + shift.y;
  strutTop(ctx, hubX + STRUT_OFFSET_PX, tyreIn - wheel.side * STRUT_IN_PX);
  for (const sizePx of [STEEL_PX + 2, STEEL_PX]) {
    ctx.fillStyle = sizePx > STEEL_PX ? STEER_RIM : STEER_STEEL;
    steeringLines(ctx, wheel, shift, sizePx);
  }
}

// a point on a wheel turned by its steer (reused: read at once)
const TURNED = [0, 0];

/**
 * A point in the wheel's own frame (along it from the hub, px; inboard of the tyre's inner face,
 * px) on the car's frame, turned with the wheel's steer.
 * @param wheel the corner as drawn
 * @param shift the wheel's push-in
 * @param along px along the wheel (forward +)
 * @param inboard px in from the tyre's inner face
 * @returns [x, y] car px (the same array every call)
 */
function turnedPoint(wheel: ExposedWheel, shift: CornerShift, along: number,
  inboard: number): number[] {
  const across = -wheel.side * (wheel.tyreWid / 2 + inboard);
  const cos = Math.cos(wheel.steer), sin = Math.sin(wheel.steer);
  TURNED[0] = wheel.axleX * SPRITE_PPM + shift.x + along * cos - across * sin;
  TURNED[1] = wheel.side * wheel.halfWidth + shift.y + along * sin + across * cos;
  return TURNED;
}

/**
 * The steering's lines at one size (the rim pass, then the steel's): the carrier along the
 * tyre's inner face; on a front, the steering arm from its rear end back and inboard, and the
 * track rod from the rack (by the car's middle, behind the axle) to the arm's end.
 * @param ctx the canvas
 * @param wheel the corner as drawn
 * @param shift the wheel's push-in
 * @param sizePx px of each step's square
 */
function steeringLines(ctx: CanvasRenderingContext2D, wheel: ExposedWheel, shift: CornerShift,
  sizePx: number): void {
  const carrier = CARRIER_HALF_M * SPRITE_PPM, inner = STEEL_PX / 2;
  const [backX, backY] = turnedPoint(wheel, shift, -carrier, inner);
  const [frontX, frontY] = turnedPoint(wheel, shift, carrier, inner);
  squareLine(ctx, backX, backY, frontX, frontY, sizePx);
  if (wheel.axleX <= 0) return;
  const arm = STEER_ARM_M * SPRITE_PPM;
  const [armX, armY] = turnedPoint(wheel, shift, -arm, inner + STEER_ARM_IN_PX);
  squareLine(ctx, backX, backY, armX, armY, sizePx);
  // (the rack's end: where the rod meets it at no steer, by the car's middle - its far end is
  // under the body)
  const rackX = wheel.axleX * SPRITE_PPM - arm, rackY = wheel.side * 2;
  squareLine(ctx, rackX, rackY, armX, armY, sizePx);
}

/**
 * A line on the car's pixel grid, a square sizePx wide at each step.
 * @param ctx the canvas
 * @param fromX px
 * @param fromY px
 * @param toX px
 * @param toY px
 * @param sizePx px
 */
function squareLine(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number,
  toY: number, sizePx: number): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY))));
  const back = Math.floor(sizePx / 2);
  for (let step = 0; step <= steps; step++) {
    const share = step / steps;
    ctx.fillRect(Math.round(fromX + (toX - fromX) * share) - back,
      Math.round(fromY + (toY - fromY) * share) - back, sizePx, sizePx);
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

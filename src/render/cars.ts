// The CARS layer of the renderer: drawPixelCar and the garage lift sprite.
import { TYRE_LOOK } from "../carpaint.ts";
import { realScale, realShape } from "../carreal.ts";
import {
  partRegion, cutPart, flatPart, withoutParts, isBare, drawnBit,
} from "./carparts.ts";
import { SPRITE_PPM } from "./shared.ts";
import { DAYLIGHT } from "../world/daylight.ts";
import { REVERSE_LAMP, isReversing } from "./reverselights.ts";
import { settledLampLevel } from "./carlamps.ts";
import { drawAngryFlash, drawLightBar, isAngryFlashOn } from "./lightbar.ts";
import { drawTyreByPressure, wheelTurn } from "./tyrelook.ts";
import { drawRolledBody, prepareBody } from "./rollbody.ts";
import { drawUnderSkin } from "./underskin.ts";
import { cornerShift, drawExposedCorner, drawExposedStrut, isWingTorn, drawSubframe,
  drawSnappedCorner } from "./carcorners.ts";
import { SUBFRAME_M } from "../world/debris.ts";
import { drawHangingExhaust } from "./hanging.ts";
import type { CornerShift } from "./carcorners.ts";
import { bitsOf } from '../carbits.ts';
import { halfTrackAt } from '../world/wheels.ts';
import { wheelRows } from './axlerows.ts';
import type {
  Cam, CarSprite, RenderCar, RenderCarSpec, RenderCone, SilCanvas, View,
} from "./types.ts";
import { trackCanvas } from '../core/memorybudget.ts';

// an open-wheeler's suspension arms
const WISHBONE = '#2a2d34', DRIVE_SHAFT = '#4a4f57', CV_JOINT = '#16181d';
/**
 * How a wheel's fixed arms are drawn: their colours, how many px wide each line is, and a lighter
 * edge round each line (none on an open car).
 */
interface ArmsLook { wishbone: string; shaft: string; joint: string; widePx: number;
  edge?: string }
// an open car's arms, in the air (dark against the ground)
const OPEN_ARMS: ArmsLook = { wishbone: WISHBONE, shaft: DRIVE_SHAFT, joint: CV_JOINT, widePx: 1 };
// a closed car's arms seen through a lost wing's opening or past its crushed end -
// the open cars' own look, dark and under the tyre (owner 11-16: "they should keep their old look
// still just be drawn correctly" - the lighter edge is gone), bolted to its SUBFRAME
// - THICKER on a road car than a single-seater's (owner: "maybe thicker wishbones on cars / vans
// etc like real life"): lines side by side per arm; a heavier vehicle's (a van, a 4x4, the bus,
// the trophy truck: from HEAVY_KG) thicker again
const WELL_ARMS: ArmsLook = { ...OPEN_ARMS, widePx: 2 };
const HEAVY_ARMS: ArmsLook = { ...OPEN_ARMS, widePx: 3 };
const HEAVY_KG = 2000;

/**
 * A closed car's exposed arms' look: thicker on a heavier vehicle.
 * @param spec the car as drawn
 * @returns the look
 */
const wellArms = (spec: RenderCarSpec): ArmsLook => ((spec.mass ?? 0) >= HEAVY_KG ? HEAVY_ARMS
  : WELL_ARMS);


// what createCars destructures from the renderer and the sprite layers
interface CarsHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  pixelCar: (spec: RenderCarSpec) => CarSprite;
  damagedSprite: (car: RenderCar, sp: CarSprite) => CarSprite;
  silhouette: (cv: SilCanvas) => HTMLCanvasElement;
  faceCache: Map<string, CarSprite>;
}

/** What the moved functions share: the view and the renderer helpers. */
interface CarsContext extends CarsHelpers {
  view: View;
}

/**
 * The half track an axle's wheels sit at, px: at the body's EDGE so they poke out at the sides
 * like the reference sprites; a car with a rear track of its own (trackR: the bus) at its REAL
 * tracks, under its body as in life.
 * @param spec the car spec
 * @param sprite the body sprite
 * @param rear the rear axle
 * @returns the half width (the tyre sizes: tyreBox)
 */
function wheelMetrics(spec: RenderCarSpec, sprite: CarSprite, rear = false) {
  if (spec.trackR) return { halfWidth: halfTrackAt(spec, rear) * SPRITE_PPM };
  const halfWidth = Math.max((spec.trackWidth || 1.5) / 2 * SPRITE_PPM, sprite.Wp / 2)
    + (spec.kind === 'track' ? 1 : 0);
  return { halfWidth };
}

/**
 * the car as it is DRAWN - its real car's proportions at its own length (width,
 * wheelbase, track: carreal.ts realShape); the physics keeps the roster's (owner 11-07: "match the
 * sizes they were ish but in proportional shape" - the real shape in the physics crashed AI fields
 * more: F1 56 -> 90 incidents, Chevelle 30 -> 46).
 * @param spec the car spec
 * @returns the spec to draw
 */
export function drawnSpec<T extends RenderCarSpec>(spec: T): T {
  return { ...spec, ...realShape(String(spec.id).split('#')[0], spec.len) };
}

/**
 * A tyre's size from above, px: its length (diameter) and width - the REAL tyre (carpaint.ts
 * TYRE_LOOK: front and rear widths apart, the tractor's four the same; owner 11-07 "vehicles tyres
 * / rims should be realistic"), to the car's own scale.
 * @param spec the car spec
 * @param rear the rear axle
 * @returns the length and width
 */
export function tyreBox(spec: RenderCarSpec, rear: boolean) {
  const base = String(spec.id).split('#')[0], real = TYRE_LOOK[base];
  // (to the car's own scale: its length against the real car's - carreal.ts realScale)
  const ppm = SPRITE_PPM * realScale(base, spec.len);
  const tyre = real || TYRE_LOOK['hatch-fwd'];
  return { len: Math.round(tyre.dia * ppm),
    wid: Math.max(2, Math.round((rear ? tyre.wR : tyre.wF) * ppm)) };
}

// (a mounted wheel shows only its tread from above - its rim is seen on a wheel lying loose:
// render/wheelface.ts; owner 11-07: "the top of the tyre shouldn't be coloured")

// the sprite without its lost parts, per car: the sprite it was made from and the parts
const LOST = new WeakMap<RenderCar, { base: CarSprite; lost: string; sprite: CarSprite }>();

/**
 * a car's sprite without the parts it has lost (render/carparts.ts), kept per car.
 * @param car the car
 * @param spec the car as drawn
 * @param base its sprite (damaged or not)
 * @param lost the parts gone (and the wings the crush tore with them)
 * @returns the sprite
 */
function lostSprite(car: RenderCar, spec: RenderCarSpec, base: CarSprite,
  lost: string): CarSprite {
  const kept = LOST.get(car);
  if (kept && kept.base === base && kept.lost === lost) return kept.sprite;
  const sprite = withoutParts(spec, base, lost);
  // UNDER THE SKIN: what each hole shows, painted once with the sprite
  drawUnderSkin(sprite, spec, lost, base.c, car.crushL && { ends: car.crushL, sides: car.crushS });
  LOST.set(car, { base, lost, sprite });
  return sprite;
}

// a thrown part's own picture, per part
const CUTS = new WeakMap<RenderCone, HTMLCanvasElement>();

/**
 * a thrown part's picture - cut from its car's sprite (render/carparts.ts).
 * @param carsCtx the shared view and helpers
 * @param cone the part
 * @returns the canvas, or null
 */
function carPart(carsCtx: CarsContext, cone: RenderCone): HTMLCanvasElement | null {
  if (!cone.carSpec || !cone.cutKind) return null;
  let canvas = CUTS.get(cone);
  if (!canvas) {
    // (an open car's part is cut from its sprite; a closed car's drawn lying flat)
    const spec = drawnSpec(cone.carSpec), sprite = carsCtx.pixelCar(spec);
    // (the exhaust, a mirror, a wishbone, a strut, the engine drawn; the bonnet, boot
    // and spoiler - horizontal panels - cut from the sprite, as seen from above they lie flat)
    const kind = cone.cutKind, corner = cone.cutCorner || 0, seed = cone._n || 1;
    const cut = isBare(spec) || ['bonnet', 'boot', 'spoiler'].includes(kind);
    canvas = drawnBit(spec, kind, seed) ?? (cut
      ? cutPart(sprite, partRegion(spec, sprite, kind, corner), seed)
      : flatPart(spec, kind, corner, seed));
    CUTS.set(cone, canvas);
  }
  return canvas;
}

/**
 * Draw one wheel of a car in the car's frame: the tyre, its tread line and the rim.
 * @param carsCtx the shared view and helpers
 * @param spec the car spec
 * @param axleX the axle's x in metres
 * @param side -1 or 1
 * @param steer the wheel's steering angle
 * @param metrics the tyre size and half width
 * @param air the tyre's air, or null: pressure, on its rim, the wheels' turn
 * @param hub px the wheel is drawn off its place (pushed in by the crush)
 */
function drawCarWheel(
  carsCtx: CarsContext, spec: RenderCarSpec, axleX: number, side: number, steer: number,
  metrics: { halfWidth: number },
  air: { pressure: number; isOnRim: boolean; turn: number } | null = null,
  hub: { x: number; y: number } = NO_PUSH,
) {
  const { view } = carsCtx;
  const { halfWidth } = metrics;
  view.ctx.save();
  view.ctx.translate(Math.round(axleX * SPRITE_PPM + hub.x), Math.round(side * halfWidth + hub.y));
  view.ctx.rotate(steer);
  const { len: tyreLen, wid: tyreWid } = tyreBox(spec, axleX < 0);
  // a soft tyre squashes by its air, a rim shows bare (render/tyrelook.ts)
  if (air && drawTyreByPressure(view.ctx, tyreLen, tyreWid, air.pressure, air.isOnRim, air.turn)) {
    view.ctx.restore();
    return;
  }
  view.ctx.fillStyle = '#16171c';
  view.ctx.fillRect(-tyreLen / 2, -tyreWid / 2, tyreLen, tyreWid);
  view.ctx.fillStyle = '#3a3d47';
  view.ctx.fillRect(-tyreLen / 2 + 2, -tyreWid / 2, tyreLen - 4, 1);
  view.ctx.restore();
}

/**
 * Draws a 1 px line on the car's pixel grid.
 * @param ctx the canvas (the car's frame, sprite px)
 * @param from [x, y]
 * @param dest [x, y]
 */
function pixelLine(ctx: CanvasRenderingContext2D, from: number[], dest: number[],
  sizePx = 1): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dest[0] - from[0]),
    Math.abs(dest[1] - from[1]))));
  // (a square sizePx wide at each step, centred on the line: 1 px is the line itself)
  const back = Math.floor(sizePx / 2);
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(Math.round(from[0] + (dest[0] - from[0]) * i / steps) - back,
      Math.round(from[1] + (dest[1] - from[1]) * i / steps) - back, sizePx, sizePx);
  }
}

/**
 * An open-wheeler's WISHBONES, drawn with its wheels (owner 11-07: "steering wishbones don't line
 * up or move with steering on f1 / f2"): each wheel's upper and lower arm from the chassis to its
 * hub, and on the fronts the TRACK ROD to the steering arm, which turns with the wheel.
 * @param ctx the canvas (the car's frame, sprite px)
 * @param spec the car as drawn
 * @param axleX the axle, m
 * @param side -1 or 1
 * @param steer the wheel's steering angle
 * @param halfWidth px from the middle to the wheel
 */
function drawWishbones(ctx: CanvasRenderingContext2D, spec: RenderCarSpec, axleX: number,
  side: number, steer: number, halfWidth: number, hub: { x: number; y: number } = NO_PUSH): void {
  // (the arms that never move stamped from their own picture - stampFixedArms; drawn to a hub the
  // crush pushed in)
  if (hub.x || hub.y) drawFixedArms(ctx, spec, axleX, side, halfWidth, OPEN_ARMS, hub);
  else stampFixedArms(ctx, spec, axleX, side, halfWidth);
  if (axleX <= 0) return;
  const hubX = axleX * SPRITE_PPM + hub.x, hubY = side * halfWidth + hub.y, body = side * 2;
  ctx.fillStyle = WISHBONE;
  const arm = 0.14 * SPRITE_PPM, endX = hubX - Math.cos(steer) * arm,
    endY = hubY - Math.sin(steer) * arm;
  pixelLine(ctx, [hubX - arm, body], [endX, endY]);
}

/**
 * A wheel's suspension that does not move: its upper and lower arms, and a driven wheel's drive
 * shaft and joints (not the front's track rod, which turns with the steering).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param spec the car as drawn (its drive)
 * @param axleX the axle, m
 * @param side -1 or 1
 * @param halfWidth px from the middle to the wheel
 * @param look the colours and line width (an open car's by default)
 * @param hub px the hub is drawn off its place (pushed in by the crush; the inner ends
 *   stay at the chassis)
 */
function drawFixedArms(ctx: CanvasRenderingContext2D, spec: RenderCarSpec, axleX: number,
  side: number, halfWidth: number, look: ArmsLook = OPEN_ARMS,
  hub: { x: number; y: number } = NO_PUSH, innerY?: number): void {
  // (the lighter edge first, every line's: the dark lines go over it)
  if (look.edge) armLines(ctx, spec, { axleX, side, halfWidth, hub, innerY }, look, 3);
  armLines(ctx, spec, { axleX, side, halfWidth, hub, innerY }, look, 1);
}

/**
 * A wheel's fixed arms' lines, each a square sizePx wide at each step: the drive shaft (and its
 * joints) to a driven wheel, the two arms of its wishbone. sizePx 1 the lines in their colours;
 * more, the lighter edge round them (look.edge).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param spec the car as drawn (its drive)
 * @param wheel its axle (m), side (-1 / 1), half the track (px) and the hub's push-in (px)
 * @param look the colours and line width
 * @param sizePx px of each step's square
 */
function armLines(ctx: CanvasRenderingContext2D, spec: RenderCarSpec,
  wheel: { axleX: number; side: number; halfWidth: number; hub: { x: number; y: number };
    innerY?: number },
  look: ArmsLook, sizePx: number): void {
  const { axleX, side, halfWidth, hub } = wheel, edge = sizePx > 1;
  const innerX = axleX * SPRITE_PPM, hubX = innerX + hub.x, hubY = side * halfWidth + hub.y;
  const front = axleX > 0;
  // the chassis where the arms meet it: the NOSE at the front axle, the GEARBOX at the rear (owner
  // 11-07: "front wishbones etc don't link up to the body on f1 car" - they started at the
  // sidepods' width, in mid-air at the nose)
  const body = wheel.innerY ?? side * (front ? 2 : 3);
  // a DRIVE SHAFT to a driven wheel ("no drive shafts either"): straight across, its two joints
  const drive = spec.drive ?? 0;
  if (front ? drive > 0 : drive < 1) {
    ctx.fillStyle = edge ? look.edge! : look.shaft;
    // (as thick as the arms, two lines at the least)
    for (let line = 0; line < Math.max(2, look.widePx); line++)
      pixelLine(ctx, [innerX + line, body], [hubX + line, hubY], sizePx);
    if (!edge) {
      ctx.fillStyle = look.joint;
      ctx.fillRect(Math.round(innerX) - 1, Math.round(body + side * 2) - 1, 3, 2);
      ctx.fillRect(Math.round(hubX) - 1, Math.round(hubY - side * 3) - 1, 3, 2);
    }
  }
  ctx.fillStyle = edge ? look.edge! : look.wishbone;
  for (const spread of [-0.2, 0.2]) for (let line = 0; line < look.widePx; line++) {
    const shift = line * Math.sign(spread);
    pixelLine(ctx, [innerX + spread * SPRITE_PPM + shift, body], [hubX + shift, hubY], sizePx);
  }

}

// no push: a wheel drawn at its place
const NO_PUSH: CornerShift = { x: 0, y: 0, exposed: false };

/**
 * a corner's exposure and its wheel's push-in by the crush (render/carcorners.ts).
 * @param car the car
 * @param spec the car as drawn
 * @param sprite its sprite
 * @param corner the damage corner
 * @param axleX the axle, m
 * @param halfWidth px from the middle to the wheel
 * @returns the shift (reused: read at once)
 */
function exposedShift(car: RenderCar, spec: RenderCarSpec, sprite: CarSprite, corner: number,
  axleX: number, halfWidth: number, lost: string): CornerShift {
  const tyre = tyreBox(spec, axleX < 0);
  return cornerShift(car, sprite, corner, { axleX, halfWidth, tyreLen: tyre.len,
    tyreWid: tyre.wid }, lost);
}

// the parts gone with the torn wings, per car: by its damaged sprite and its lost parts
const TORN = new WeakMap<RenderCar, { base: CarSprite; partLost: string; lost: string }>();

/**
 * the car's lost parts and the wings its crush has torn (the crush reached that
 * corner's wheel: render/carcorners.ts isWingTorn); an open car has none to tear. Kept per car.
 * @param car the car
 * @param spec the car as drawn
 * @param base its damaged sprite
 * @returns "kind:corner" each, joined by ","
 */
function lostWithTorn(car: RenderCar, spec: RenderCarSpec, base: CarSprite): string {
  const partLost = car.partLost || '', kept = TORN.get(car);
  if (kept && kept.base === base && kept.partLost === partLost) return kept.lost;
  let lost = partLost;
  if (car.dmg && !isBare(spec)) {
    for (let corner = 0; corner < 4; corner++) {
      const axleX = corner < 2 ? spec.lf : -spec.lr, tyre = tyreBox(spec, axleX < 0);
      const { halfWidth } = wheelMetrics(spec, base, axleX < 0);
      // (a wheel torn off tears its wing: the corner is open to the road)
      if (lost.includes('wing:' + corner) || (!car.wheelOff?.[corner] && !isWingTorn(car, base,
        corner, { axleX, halfWidth, tyreLen: tyre.len, tyreWid: tyre.wid }))) continue;
      lost = (lost ? lost + ',' : '') + 'wing:' + corner;
    }
  }
  TORN.set(car, { base, partLost, lost });
  return lost;
}

/**
 * an exposed corner under the body - its well, the arms and shaft (bright, to the hub
 * where it now is), the track rod at the steer, the strut (render/carcorners.ts).
 * @param ctx the canvas (the car's frame, sprite px)
 * @param spec the car as drawn
 * @param sprite its sprite
 * @param wheel the corner's axle (m), side, steer (rad) and half the track (px)
 * @param shift the wheel's push-in
 */
function drawExposed(ctx: CanvasRenderingContext2D, spec: RenderCarSpec, sprite: CarSprite,
  wheel: { axleX: number; side: number; steer: number; halfWidth: number },
  shift: CornerShift): void {
  const { axleX, side, halfWidth } = wheel;
  const innerY = side * (sprite.Wp / 2 - SUBFRAME_M * SPRITE_PPM);
  drawExposedCorner(ctx, wheel, shift,
    () => {
      drawSubframe(ctx, axleX, innerY, side);
      drawFixedArms(ctx, spec, axleX, side, halfWidth, wellArms(spec), shift, innerY);
    }, { colour: WELL_ARMS.wishbone }, innerY);
}

/** A wheel torn off: on a closed car its snapped remains, on an open car a hub stub. */
function drawLostWheel(ctx: CanvasRenderingContext2D, car: RenderCar, spec: RenderCarSpec,
  sprite: CarSprite, wheel: { axleX: number; side: number; halfWidth: number; corner: number }) {
  if (!isBare(spec)) {
    const tyre = tyreBox(spec, wheel.axleX < 0);
    drawSnappedCorner(ctx, car, sprite, { ...wheel, tyreLen: tyre.len, tyreWid: tyre.wid },
      (hub, innerY) => drawFixedArms(ctx, spec, wheel.axleX, wheel.side, wheel.halfWidth,
        wellArms(spec), hub, innerY), WELL_ARMS.wishbone);
    return;
  }
  // DAMAGE: wheel gone, a hub stub
  ctx.fillStyle = '#2b2d33';
  const { axleX, side, halfWidth } = wheel;
  ctx.fillRect(Math.round(axleX * SPRITE_PPM) - 2, Math.round(side * halfWidth) - 1, 4, 2);
}

/** A wheel's fixed arms painted once: the picture and where its corner sits, sprite px. */
interface ArmsPicture { canvas: HTMLCanvasElement; cornerX: number; cornerY: number }
// by everything drawFixedArms reads (its drive, axle, side, track): one per wheel of a car type
const FIXED_ARMS = new Map<string, ArmsPicture>();
// sprite px kept round the arms' box (the joints, the rounding)
const ARMS_PAD_PX = 4;

/**
 * Stamps a wheel's fixed arms from their own picture, painted the first time (MEASURED: the arms,
 * a pixel at a time, were half the cars' painting with a grid of open-wheelers). The car's picture
 * lands on whole pixel blocks and does not smooth: the stamp's pixels are the arms' own.
 * @param ctx the canvas (the car's frame, sprite px)
 * @param spec the car as drawn (its drive)
 * @param axleX the axle, m
 * @param side -1 or 1
 * @param halfWidth px from the middle to the wheel
 */
function stampFixedArms(ctx: CanvasRenderingContext2D, spec: RenderCarSpec, axleX: number,
  side: number, halfWidth: number): void {
  const key = `${spec.drive ?? 0}|${axleX}|${side}|${halfWidth}`;
  let arms = FIXED_ARMS.get(key);
  if (!arms) {
    const hubX = axleX * SPRITE_PPM, hubY = side * halfWidth, body = side * (axleX > 0 ? 2 : 3);
    const spread = 0.2 * SPRITE_PPM;
    const cornerX = Math.floor(hubX - spread) - ARMS_PAD_PX;
    const cornerY = Math.floor(Math.min(body, hubY))
      - ARMS_PAD_PX;
    const canvas = trackCanvas(document.createElement('canvas'));
    canvas.width = Math.ceil(hubX + spread) + ARMS_PAD_PX - cornerX;
    canvas.height = Math.ceil(Math.max(body, hubY)) + ARMS_PAD_PX - cornerY;
    const paint = canvas.getContext('2d')!;
    paint.translate(-cornerX, -cornerY);
    drawFixedArms(paint, spec, axleX, side, halfWidth);
    arms = { canvas, cornerX, cornerY };
    FIXED_ARMS.set(key, arms);
  }
  ctx.drawImage(arms.canvas, arms.cornerX, arms.cornerY);
}

/**
 * Draw the wheels: pixel blocks, the fronts turned by the steering angle; a lost wheel leaves a
 * hub stub.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param sprite the body sprite
 * @param lost the parts gone (with the torn wings) - an exposed corner's well
 */
function drawCarWheels(carsCtx: CarsContext, car: RenderCar, sprite: CarSprite, lost = '') {
  const { view } = carsCtx;
  const spec = drawnSpec(car.spec);
  const turn = car.tyreP ? wheelTurn(car, performance.now()) : 0;
  // (a trailer: its axle group only - render/axlerows.ts)
  for (const [axleX, side, steer, corner] of wheelRows(spec, car.delta)) {
    const metrics = wheelMetrics(spec, sprite, axleX < 0), { halfWidth } = metrics;
    if (car.wheelOff && car.wheelOff[corner]) {
      drawLostWheel(view.ctx, car, spec, sprite, { axleX, side, halfWidth, corner });
      continue;
    }
    // (a corner the damage exposes, its wheel pushed in by the crush - carcorners.ts)
    const shift = exposedShift(car, spec, sprite, corner, axleX, halfWidth, lost);
    if (isBare(spec)) drawWishbones(view.ctx, spec, axleX, side, steer, halfWidth, shift);
    else if (shift.exposed) drawExposed(view.ctx, spec, sprite, { axleX, side, steer, halfWidth },
      shift);
    drawCarWheel(carsCtx, spec, axleX, side, steer, metrics, car.tyreP ? {
      pressure: car.tyreP[corner], isOnRim: !!car.onRim?.[corner], turn,
    } : null, shift);
    // (the strut over the tyre, at the top of the arch: the arms are under it)
    if (shift.exposed && !isBare(spec)) {
      const tyre = tyreBox(spec, axleX < 0);
      drawExposedStrut(view.ctx, { axleX, side, halfWidth, tyreLen: tyre.len, tyreWid: tyre.wid,
        bodyHalf: sprite.Wp / 2, damage: car.dmg ? car.dmg[corner] : 0 }, shift);
    }
  }
}

/**
 * LAMPS BREAK WITH DAMAGE: every lamp lives on its corner (damage.ts: 0 front -y, 1 front +y,
 * 2 rear -y, 3 rear +y). Full up to LAMP_OK, then it flickers and dims, out from LAMP_GONE
 * (~a 25-30 km/h head-on on that corner). Headlight beam + lamp, brake light and indicator
 * alike.
 * @param car the car
 * @param corner the corner index
 * @returns the lamp's level 0..1
 */
export function lampLevel(car: RenderCar, corner: number) {
  const damage = car.dmg ? car.dmg[corner] : 0;
  // a hit's flicker settles - working again, or dead (render/carlamps.ts)
  return settledLampLevel(car, corner, damage);
}

/**
 * Whether the indicators are in the lit half of their blink (~1.5 Hz, wall clock).
 * @returns true while lit
 */
/**
 * Whether a car's hazard lights are on: a crashed traffic car's (car.hazard), a car just reset's
 * (game/resethazard.ts: car.hazardUntil, wall-clock ms).
 * @param car the car
 * @param car.hazard a wreck's
 * @param car.hazardUntil a reset's, until then
 * @returns on
 */
export const hazardsOn = (car: { hazard?: boolean; hazardUntil?: number }): boolean =>
  !!car.hazard || (car.hazardUntil ?? 0) > performance.now();

export function indicatorBlinkOn(): boolean {
  return Math.floor(performance.now() / 333) % 2 === 0;
}

/**
 * HEADLIGHTS: the two lit lamps at the front. The light they throw is the night layer's
 * (render/light.ts), at every hour: the picture paints no beam.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param sprite the body sprite
 */
function drawHeadlights(carsCtx: CarsContext, car: RenderCar, sprite: CarSprite) {
  const { view } = carsCtx;
  view.ctx.fillStyle = '#fffbe6';
  for (const [y, corner] of [[-sprite.Wp / 2 + 4, 0], [sprite.Wp / 2 - 4, 1]]) {
    if (lampLevel(car, corner)) view.ctx.fillRect(sprite.Lp / 2 - 3, y - 2, 3, 4);
  }
}

/**
 * INDICATORS: amber at the front + rear corners of that side, blinking ~1.5 Hz (wall clock);
 * HAZARDS (hazardsOn: a crashed traffic car, a car just reset): both sides at once.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param sprite the body sprite
 */
function drawIndicators(carsCtx: CarsContext, car: RenderCar, sprite: CarSprite) {
  const { view } = carsCtx;
  // (the ! below: indicator or hazard was truthy above)
  const hazard = hazardsOn(car);
  if ((car.indicator || hazard) && indicatorBlinkOn())
  for (const ind of hazard ? [-1, 1] : [car.indicator!]) {
    const y = ind < 0 ? -sprite.Wp / 2 : sprite.Wp / 2 - 3;
    view.ctx.fillStyle = '#ffa630';
    const sideIdx = ind < 0 ? 0 : 1;
    if (lampLevel(car, sideIdx)) view.ctx.fillRect(sprite.Lp / 2 - 4, y, 3, 3);
    if (lampLevel(car, sideIdx + 2)) view.ctx.fillRect(-sprite.Lp / 2 + 1, y, 3, 3);
  }
}

/**
 * Draw the live lamp overlay on the sprite: headlights, indicators and brake lights.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param sprite the body sprite
 */
function drawCarLamps(carsCtx: CarsContext, car: RenderCar, sprite: CarSprite) {
  const { view } = carsCtx;
  // brake lights glow when braking (a live overlay on the sprite)
  // (an angry driver's headlights and brake lights flash - render/lightbar.ts)
  const angryOn = isAngryFlashOn(car);
  if (car.lightsOn || angryOn) drawHeadlights(carsCtx, car, sprite);
  drawIndicators(carsCtx, car, sprite);
  // tail lights: dim red with the headlights in the dark (by day they do not show)
  const isTail = !!car.lightsOn && DAYLIGHT.darkness > 0;
  if (car.brakeLight! > 0.05 || isTail || angryOn) {   // undefined > 0.05 is false
    view.ctx.fillStyle = car.brakeLight! > 0.05 || angryOn ? '#ff4a3a' : '#a8291f';
    if (lampLevel(car, 2)) view.ctx.fillRect(-sprite.Lp / 2, -sprite.Wp / 2 + 2, 2, 3);
    if (lampLevel(car, 3)) view.ctx.fillRect(-sprite.Lp / 2, sprite.Wp / 2 - 5, 2, 3);
  }
  // the rain light: one red lamp in the middle of the tail
  if (car.rainLight) {
    view.ctx.fillStyle = '#ff3a2a';
    view.ctx.fillRect(-sprite.Lp / 2, -1, 2, 2);
  }
  // the reversing lights: two white lamps inside the tail lights (render/reverselights.ts)
  if (isReversing(car)) {
    view.ctx.fillStyle = REVERSE_LAMP;
    if (lampLevel(car, 2)) view.ctx.fillRect(-sprite.Lp / 2, -sprite.Wp / 2 + 5, 2, 2);
    if (lampLevel(car, 3)) view.ctx.fillRect(-sprite.Lp / 2, sprite.Wp / 2 - 7, 2, 2);
  }
  // a police car's roof light bar (render/lightbar.ts); an angry driver's flashed
  // headlights' halo
  drawLightBar(view.ctx, car, sprite);
  drawAngryFlash(view.ctx, car, sprite);
}

/**
 * A stock car's ROOF FLAPS standing (physics/roofflaps.ts): two bare-metal plates at the back edge
 * of the roof, as the real ones (owner 11-08: the flaps must not hide the roof number) - hinged
 * at their front edge (a dark line) where the Naffcar's roof meets its rear window (carlooks.ts
 * paintNextGen: roof from 0.30 of its length, the number from 0.31), rising back over the glass,
 * longer and with more shadow as they rise; the rear one shorter across.
 * @param ctx the canvas (at the car, sprite px)
 * @param raised how far up, 0..1
 * @param sprite the body sprite
 */
function drawRoofFlaps(ctx: CanvasRenderingContext2D, raised: number, sprite: CarSprite) {
  const tall = Math.max(1, Math.round(1 + 3 * raised));
  for (const [along, inset] of [[-0.19, 0], [-0.235, 2]]) {
    const hinge = Math.round(sprite.Lp * along), half = Math.round(sprite.Wp * 0.26) - inset;
    // (owner 11-08 "not seeing ... flaps": dark plates were lost on the rear glass - their bare
    // metal undersides show now, a dark shadow behind)
    ctx.fillStyle = 'rgba(10,10,14,0.45)';
    ctx.fillRect(hinge - tall - 1, -half + 1, tall + 1, half * 2);
    ctx.fillStyle = '#c9ccd3';
    ctx.fillRect(hinge - tall, -half, tall, half * 2);
    ctx.fillStyle = '#f2f3f5';
    ctx.fillRect(hinge - tall, -half, 1, half * 2);
    ctx.fillStyle = '#5d626d';
    ctx.fillRect(hinge, -half, 1, half * 2);
  }
}

/**
 * Draw one car: shadow, wheels (by their air), body and lamps (or the rolled faces).
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param heading the heading to draw it at, radians (0 for its own GPU picture)
 */
function drawPixelCar(carsCtx: CarsContext, car: RenderCar, heading = car.heading) {
  const { view, PPMz, toScreenX, toScreenY, pixelCar, damagedSprite, silhouette } = carsCtx;
  // (a car whose wing / spoiler is off is painted without it - with its boot lid, where the
  // wing stands on the lid: carbits.ts wingOnLid)
  const partLost = car.partLost || '', wingGone = partLost.includes('spoiler')
    || (partLost.includes('boot') && bitsOf(String(car.spec.id)).wingOnLid === true);
  const shown = drawnSpec(car.spec), spec = wingGone ? { ...shown, noWing: true } : shown,
    sp0 = pixelCar(spec),
    hurt = car.dmg ? damagedSprite(car, sp0) : sp0, scale = PPMz() / SPRITE_PPM;
  // (without the parts it has lost - render/carparts.ts)
  // (a wing the crush reached is torn off with the lost parts - carcorners.ts)
  const lost = lostWithTorn(car, spec, hurt);
  const sprite = lost ? lostSprite(car, spec, hurt, lost) : hurt;
  // its clean sprite read on a quiet frame: a roll paints its sides from it (render/rollbody.ts)
  if (!car._bodyMade) {
    car._bodyMade = true;
    prepareBody(sp0);
  }
  view.ctx.save();
  view.ctx.translate(toScreenX(car.x), toScreenY(car.y));
  view.ctx.rotate(heading);
  view.ctx.scale(scale, scale);
  // shadow: a darker copy of the sprite, offset down-right by the car's ride height
  // (cars.js rideH)
  const shOff = 2 + Math.round((spec.rideH || 0.13) * 10);
  if (car.roll && car.roll.phi) {
    // rolled: as a body in its real shape (render/rollbody.ts)
    drawRolledBody(view.ctx, car, spec, [sprite, sp0], shOff);
    view.ctx.restore();
    return;
  }
  view.ctx.globalAlpha = 0.3;
  view.ctx.drawImage(
    silhouette(sprite.c), -sprite.Lp / 2 - 2 + shOff, -sprite.Wp / 2 - 2 + shOff,
  );
  view.ctx.globalAlpha = 1;
  // the wheels show their own air (render/tyrelook.ts: squashed, flat, on the rim)
  drawCarWheels(carsCtx, car, sprite, lost);
  // (a hanging exhaust under the body, its end on the road - render/hanging.ts)
  if (car.exhaustHang) drawHangingExhaust(view.ctx, spec, sprite);
  view.ctx.drawImage(sprite.c, -sprite.Lp / 2 - 2, -sprite.Wp / 2 - 2);
  if (car.flaps) drawRoofFlaps(view.ctx, car.flaps, sprite);
  drawCarLamps(carsCtx, car, sprite);
  view.ctx.restore();
}

/**
 * The GARAGE lift: the body sprite only carries the body — the game draws the wheels separately
 * (they steer) — so the lift gets a composite: wheels as drawPixelCar draws them, then the body.
 * Same { c, Lp, Wp } shape; cached per car.
 * @param carsCtx the shared view and helpers
 * @param spec the car spec
 * @returns the composite sprite
 */
function pixelCarWithWheels(carsCtx: CarsContext, spec: RenderCarSpec) {
  const { pixelCar, faceCache } = carsCtx;
  const key = 'wheels:' + spec.id + spec.paint + spec.trim + (spec.third || '') + (spec.rim || '')
    + (spec.num || 0);
  if (faceCache.has(key)) return faceCache.get(key);
  const carSpec = drawnSpec(spec), sprite = pixelCar(carSpec);
  const halfWidth = wheelMetrics(carSpec, sprite).halfWidth;
  const padY = Math.max(0, Math.ceil(halfWidth + 4 - sprite.Wp / 2)),
    canvas = trackCanvas(document.createElement('canvas'));
  canvas.width = sprite.c.width + 4;
  canvas.height = sprite.c.height + padY * 2;
  const gctx = canvas.getContext('2d')!, midX = canvas.width / 2, midY = canvas.height / 2;
  for (const [axleX, side] of [
    [carSpec.lf, -1], [carSpec.lf, 1], [-carSpec.lr, -1], [-carSpec.lr, 1],
  ]) {
    const axleHalf = wheelMetrics(carSpec, sprite, axleX < 0).halfWidth;
    const { len: tyreLen, wid: tyreWid } = tyreBox(carSpec, axleX < 0),
      x = Math.round(midX + axleX * SPRITE_PPM), y = Math.round(midY + side * axleHalf);
    if (isBare(carSpec)) {
      gctx.save();
      gctx.translate(midX, midY);
      drawWishbones(gctx, carSpec, axleX, side, 0, axleHalf);
      gctx.restore();
    }
    gctx.fillStyle = '#16171c';
    gctx.fillRect(x - tyreLen / 2, y - tyreWid / 2, tyreLen, tyreWid);
    gctx.fillStyle = '#3a3d47';
    gctx.fillRect(x - tyreLen / 2 + 2, y - tyreWid / 2, tyreLen - 4, 1);
  }
  gctx.drawImage(
    sprite.c, Math.round(midX - sprite.c.width / 2), Math.round(midY - sprite.c.height / 2),
  );
  const out = { c: canvas, Lp: sprite.Lp, Wp: sprite.Wp + padY * 2 };
  faceCache.set(key, out);
  return out;
}

/** A car's own picture: the canvas and the car's centre in it, px. */
export interface CarPicture {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  originX: number;
  originY: number;
}

// room round the body for the wheels, the shadow and the lamps, sprite px
const PICTURE_PAD = 14;

/**
 * Paints one car facing along +x into its own picture, each sprite pixel a block of enlarge x
 * enlarge, with drawPixelCar itself (shadow, wheels, body, damage, lamps, a roll), for the screen
 * canvas to turn and scale (render.ts drawSharpCarLayers). The origin sits so the sprite's
 * pixels land on whole blocks.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param picture the car's picture, resized when needed
 * @param enlarge picture px per sprite px (a whole number)
 */
function paintCarPicture(carsCtx: CarsContext, car: RenderCar, picture: CarPicture,
    enlarge: number) {
  const { view, pixelCar } = carsCtx;
  const sprite = pixelCar(drawnSpec(car.spec));
  const pad = PICTURE_PAD + (car.roll && car.roll.phi ? sprite.Wp : 0);
  const back = Math.ceil(sprite.Lp / 2 + pad);
  const ahead = Math.ceil(sprite.Lp / 2 + pad);
  const side = Math.ceil(sprite.Wp / 2 + pad);
  const width = (back + ahead) * enlarge, height = side * 2 * enlarge;
  if (picture.canvas.width !== width || picture.canvas.height !== height) {
    picture.canvas.width = width;
    picture.canvas.height = height;
    picture.ctx.imageSmoothingEnabled = false;
  } else {
    picture.ctx.clearRect(0, 0, width, height);
  }
  picture.originX = (back + (sprite.Lp % 2) / 2) * enlarge;
  picture.originY = (side + (sprite.Wp % 2) / 2) * enlarge;
  const local: CarsContext = {
    ...carsCtx, PPMz: () => SPRITE_PPM * enlarge, toScreenX: () => picture.originX,
    toScreenY: () => picture.originY,
  };
  const keep = view.ctx;
  view.ctx = picture.ctx;
  try { drawPixelCar(local, car, 0); } finally { view.ctx = keep; }
}

/**
 * Create the cars layer.
 * @param view the view holding the canvas context
 * @param cam the camera (unused by the layer itself)
 * @param helpers the renderer and sprite-layer helpers
 * @returns drawPixelCar, paintCarPicture and pixelCarWithWheels
 */
export function createCars(view: View, cam: Cam, helpers: CarsHelpers) {
  const carsCtx: CarsContext = { view, ...helpers };
  // each car's own picture, kept while the car lives
  const pictures = new WeakMap<RenderCar, CarPicture>();
  return {
    drawPixelCar: (car: RenderCar) => drawPixelCar(carsCtx, car),
    /**
     * Paints a car's own picture.
     * @param car the car
     * @param enlarge picture px per sprite px (a whole number)
     * @returns the picture
     */
    paintCarPicture(car: RenderCar, enlarge: number): CarPicture {
      let picture = pictures.get(car);
      if (!picture) {
        const canvas = trackCanvas(document.createElement('canvas'));
        const ctx = canvas.getContext('2d')!;
        picture = { canvas, ctx, originX: 0, originY: 0 };
        pictures.set(car, picture);
      }
      paintCarPicture(carsCtx, car, picture, enlarge);
      return picture;
    },
    pixelCarWithWheels: (spec: RenderCarSpec) => pixelCarWithWheels(carsCtx, spec),
    carPart: (cone: RenderCone) => carPart(carsCtx, cone),
  };
}

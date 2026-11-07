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
import { drawTyreByPressure, wheelTurn } from "./tyrelook.ts";
import type {
  Cam, CarSprite, RenderCar, RenderCarSpec, RenderCone, RollFace, SideSprite, SilCanvas, View,
} from "./types.ts";

// an open-wheeler's suspension arms
const WISHBONE = '#2a2d34', DRIVE_SHAFT = '#4a4f57', CV_JOINT = '#16181d';

// what createCars destructures from the renderer and the sprite layers
interface CarsHelpers {
  PPMz: () => number;
  toScreenX: (wx: number) => number;
  toScreenY: (wy: number) => number;
  pixelCar: (spec: RenderCarSpec) => CarSprite;
  damagedSprite: (car: RenderCar, sp: CarSprite) => CarSprite;
  silhouette: (cv: SilCanvas) => HTMLCanvasElement;
  rolledFaces: (car: RenderCar, sp: CarSprite, phi: number) => RollFace[];
  drawFaces: (faces: RollFace[], Lp: number, sil: boolean, off: number) => void;
  faceCache: Map<string, CarSprite | SideSprite>;
}

/** What the moved functions share: the view and the renderer helpers. */
interface CarsContext extends CarsHelpers {
  view: View;
}

/**
 * The half track a car's wheels sit at (at the body's EDGE so they poke out at
 * the sides like the reference sprites).
 * @param spec the car spec
 * @param sprite the body sprite
 * @returns the half width (the tyre sizes: tyreBox)
 */
function wheelMetrics(spec: RenderCarSpec, sprite: CarSprite) {
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
 * @returns the sprite
 */
function lostSprite(car: RenderCar, spec: RenderCarSpec, base: CarSprite): CarSprite {
  const kept = LOST.get(car);
  if (kept && kept.base === base && kept.lost === car.partLost) return kept.sprite;
  const sprite = withoutParts(spec, base, car.partLost || '');
  LOST.set(car, { base, lost: car.partLost || '', sprite });
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
 */
function drawCarWheel(
  carsCtx: CarsContext, spec: RenderCarSpec, axleX: number, side: number, steer: number,
  metrics: { halfWidth: number },
  air: { pressure: number; isOnRim: boolean; turn: number } | null = null,
) {
  const { view } = carsCtx;
  const { halfWidth } = metrics;
  view.ctx.save();
  view.ctx.translate(Math.round(axleX * SPRITE_PPM), Math.round(side * halfWidth));
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
function pixelLine(ctx: CanvasRenderingContext2D, from: number[], dest: number[]): void {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(dest[0] - from[0]),
    Math.abs(dest[1] - from[1]))));
  for (let i = 0; i <= steps; i++) {
    ctx.fillRect(Math.round(from[0] + (dest[0] - from[0]) * i / steps),
      Math.round(from[1] + (dest[1] - from[1]) * i / steps), 1, 1);
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
  side: number, steer: number, halfWidth: number): void {
  const hubX = axleX * SPRITE_PPM, hubY = side * halfWidth, front = axleX > 0;
  // the chassis where the arms meet it: the NOSE at the front axle, the GEARBOX at the rear (owner
  // 11-07: "front wishbones etc don't link up to the body on f1 car" - they started at the
  // sidepods' width, in mid-air at the nose)
  const body = side * (front ? 2 : 3);
  // a DRIVE SHAFT to a driven wheel ("no drive shafts either"): straight across, its two joints
  const drive = spec.drive ?? 0;
  if (front ? drive > 0 : drive < 1) {
    ctx.fillStyle = DRIVE_SHAFT;
    pixelLine(ctx, [hubX, body], [hubX, hubY]);
    pixelLine(ctx, [hubX + 1, body], [hubX + 1, hubY]);
    ctx.fillStyle = CV_JOINT;
    ctx.fillRect(Math.round(hubX) - 1, Math.round(body + side * 2) - 1, 3, 2);
    ctx.fillRect(Math.round(hubX) - 1, Math.round(hubY - side * 3) - 1, 3, 2);
  }
  ctx.fillStyle = WISHBONE;
  for (const spread of [-0.2, 0.2])
    pixelLine(ctx, [hubX + spread * SPRITE_PPM, body], [hubX, hubY]);
  if (!front) return;
  const arm = 0.14 * SPRITE_PPM, endX = hubX - Math.cos(steer) * arm,
    endY = hubY - Math.sin(steer) * arm;
  pixelLine(ctx, [hubX - arm, body], [endX, endY]);
}

/**
 * Draw the wheels: pixel blocks, the fronts turned by the steering angle; a lost wheel leaves a
 * hub stub.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param sprite the body sprite
 * @returns the half width the wheels sit at
 */
function drawCarWheels(carsCtx: CarsContext, car: RenderCar, sprite: CarSprite) {
  const { view } = carsCtx;
  const spec = drawnSpec(car.spec);
  const metrics = wheelMetrics(spec, sprite);
  const { halfWidth } = metrics;
  const turn = car.tyreP ? wheelTurn(car, performance.now()) : 0;
  for (const [axleX, side, steer, corner] of [
    [spec.lf, -1, car.delta, 0], [spec.lf, 1, car.delta, 1],
    [-spec.lr, -1, 0, 2], [-spec.lr, 1, 0, 3],
  ]) {
    if (car.wheelOff && car.wheelOff[corner]) {
      // DAMAGE: wheel gone, a hub stub
      view.ctx.fillStyle = '#2b2d33';
      view.ctx.fillRect(
        Math.round(axleX * SPRITE_PPM) - 2, Math.round(side * halfWidth) - 1, 4, 2,
      );
      continue;
    }
    if (isBare(spec)) drawWishbones(view.ctx, spec, axleX, side, steer, halfWidth);
    drawCarWheel(carsCtx, spec, axleX, side, steer, metrics, car.tyreP ? {
      pressure: car.tyreP[corner], isOnRim: !!car.onRim?.[corner], turn,
    } : null);
  }
  return halfWidth;
}

/**
 * Draw the car sprite's rolled faces and their shadows, then restore the context.
 * @param carsCtx the shared view and helpers
 * @param car the rolling car
 * @param sprite the body sprite
 * @param shOff the shadow offset
 */
function drawRolledCar(
  carsCtx: CarsContext, car: RenderCar, sprite: CarSprite, shOff: number,
) {
  const { view, rolledFaces, drawFaces } = carsCtx;
  const faces = rolledFaces(car, sprite, car.roll!.phi);
  view.ctx.globalAlpha = 0.3;
  drawFaces(faces, sprite.Lp, true, shOff + 2);
  view.ctx.globalAlpha = 1;
  drawFaces(faces, sprite.Lp, false, 0);
  view.ctx.restore();
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
 * HAZARDS (car.hazard, a crashed traffic car): both sides at once.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param sprite the body sprite
 */
function drawIndicators(carsCtx: CarsContext, car: RenderCar, sprite: CarSprite) {
  const { view } = carsCtx;
  // (the ! below: indicator or hazard was truthy above)
  if ((car.indicator || car.hazard) && indicatorBlinkOn())
  for (const ind of car.hazard ? [-1, 1] : [car.indicator!]) {
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
  if (car.lightsOn) drawHeadlights(carsCtx, car, sprite);
  drawIndicators(carsCtx, car, sprite);
  // tail lights: dim red with the headlights in the dark (by day they do not show)
  const isTail = !!car.lightsOn && DAYLIGHT.darkness > 0;
  if (car.brakeLight! > 0.05 || isTail) {   // undefined > 0.05 is false
    view.ctx.fillStyle = car.brakeLight! > 0.05 ? '#ff4a3a' : '#a8291f';
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
}

/**
 * Draw one car: shadow, wheels (by their air), body and lamps (or the rolled faces).
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param heading the heading to draw it at, radians (0 for its own GPU picture)
 */
function drawPixelCar(carsCtx: CarsContext, car: RenderCar, heading = car.heading) {
  const { view, PPMz, toScreenX, toScreenY, pixelCar, damagedSprite, silhouette } = carsCtx;
  // (a car whose wing / spoiler is off is painted without it)
  const shown = drawnSpec(car.spec), spec = car.partLost?.includes('spoiler')
    ? { ...shown, noWing: true } : shown, sp0 = pixelCar(spec),
    hurt = car.dmg ? damagedSprite(car, sp0) : sp0, scale = PPMz() / SPRITE_PPM;
  // (without the parts it has lost - render/carparts.ts)
  const sprite = car.partLost ? lostSprite(car, spec, hurt) : hurt;
  view.ctx.save();
  view.ctx.translate(toScreenX(car.x), toScreenY(car.y));
  view.ctx.rotate(heading);
  view.ctx.scale(scale, scale);
  // shadow: a darker copy of the sprite, offset down-right by the car's ride height
  // (cars.js rideH)
  const shOff = 2 + Math.round((spec.rideH || 0.13) * 10);
  if (car.roll && car.roll.phi) {
    drawRolledCar(carsCtx, car, sprite, shOff);
    return;
  }
  view.ctx.globalAlpha = 0.3;
  view.ctx.drawImage(
    silhouette(sprite.c), -sprite.Lp / 2 - 2 + shOff, -sprite.Wp / 2 - 2 + shOff,
  );
  view.ctx.globalAlpha = 1;
  // the wheels show their own air (render/tyrelook.ts: squashed, flat, on the rim)
  drawCarWheels(carsCtx, car, sprite);
  view.ctx.drawImage(sprite.c, -sprite.Lp / 2 - 2, -sprite.Wp / 2 - 2);
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
  const halfWidth = Math.max((carSpec.trackWidth || 1.5) / 2 * SPRITE_PPM, sprite.Wp / 2)
    + (carSpec.kind === 'track' ? 1 : 0);
  const padY = Math.max(0, Math.ceil(halfWidth + 4 - sprite.Wp / 2)),
    canvas = document.createElement('canvas');
  canvas.width = sprite.c.width + 4;
  canvas.height = sprite.c.height + padY * 2;
  const gctx = canvas.getContext('2d')!, midX = canvas.width / 2, midY = canvas.height / 2;
  for (const [axleX, side] of [
    [carSpec.lf, -1], [carSpec.lf, 1], [-carSpec.lr, -1], [-carSpec.lr, 1],
  ]) {
    const { len: tyreLen, wid: tyreWid } = tyreBox(carSpec, axleX < 0),
      x = Math.round(midX + axleX * SPRITE_PPM), y = Math.round(midY + side * halfWidth);
    if (isBare(carSpec)) {
      gctx.save();
      gctx.translate(midX, midY);
      drawWishbones(gctx, carSpec, axleX, side, 0, halfWidth);
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
        const canvas = document.createElement('canvas');
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

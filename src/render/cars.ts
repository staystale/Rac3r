// The CARS layer of the renderer: drawPixelCar and the garage lift sprite.
import { SPRITE_PPM } from "./shared.ts";
import { DAYLIGHT } from "../world/daylight.ts";
import type {
  Cam, CarSprite, RenderCar, RenderCarSpec, RollFace, SideSprite, SilCanvas, View,
} from "./types.ts";

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
 * The tyre size and the half track a car's wheels sit at (at the body's EDGE so they poke out at
 * the sides like the reference sprites).
 * @param spec the car spec
 * @param sprite the body sprite
 * @returns tyre length, tyre width and the half width
 */
function wheelMetrics(spec: RenderCarSpec, sprite: CarSprite) {
  const tyreL = spec.kind === 'track' ? 14 : spec.kind === 'tractor' ? 15 : 11,
    tyreW = spec.kind === 'track' ? 6 : 4;
  const halfWidth = Math.max((spec.trackWidth || 1.5) / 2 * SPRITE_PPM, sprite.Wp / 2)
    + (spec.kind === 'track' ? 1 : 0);
  return { tyreL, tyreW, halfWidth };
}

/**
 * Draw one wheel of a car in the car's frame: the tyre, its tread line and the rim.
 * @param carsCtx the shared view and helpers
 * @param spec the car spec
 * @param axleX the axle's x in metres
 * @param side -1 or 1
 * @param steer the wheel's steering angle
 * @param metrics the tyre size and half width
 */
function drawCarWheel(
  carsCtx: CarsContext, spec: RenderCarSpec, axleX: number, side: number, steer: number,
  metrics: { tyreL: number; tyreW: number; halfWidth: number },
) {
  const { view } = carsCtx;
  const { tyreL, tyreW, halfWidth } = metrics;
  view.ctx.save();
  view.ctx.translate(Math.round(axleX * SPRITE_PPM), Math.round(side * halfWidth));
  view.ctx.rotate(steer);
  // tractor: huge rear wheels, yellow rims
  const big = spec.kind === 'tractor' && axleX < 0;
  const tyreLen = big ? 20 : tyreL, tyreWid = big ? 7 : tyreW;
  view.ctx.fillStyle = '#16171c';
  view.ctx.fillRect(-tyreLen / 2, -tyreWid / 2, tyreLen, tyreWid);
  view.ctx.fillStyle = '#3a3d47';
  view.ctx.fillRect(-tyreLen / 2 + 2, -tyreWid / 2, tyreLen - 4, 1);
  if (spec.kind === 'tractor') {
    view.ctx.fillStyle = '#fbc02d';
    view.ctx.fillRect(-2, -1, 4, 2);
  } else if (spec.rim) {
    // coloured wheels (the Subaroo's gold)
    view.ctx.fillStyle = spec.rim;
    view.ctx.fillRect(-2, -1, 4, 2);
  }
  view.ctx.restore();
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
  const spec = car.spec;
  const metrics = wheelMetrics(spec, sprite);
  const { halfWidth } = metrics;
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
    drawCarWheel(carsCtx, spec, axleX, side, steer, metrics);
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
 * LAMPS BREAK WITH DAMAGE: every lamp lives on its corner (damage.js: 0 front -y, 1 front +y,
 * 2 rear -y, 3 rear +y). Full up to LAMP_OK, then it flickers and dims, out from LAMP_GONE
 * (~a 25-30 km/h head-on on that corner). Headlight beam + lamp, brake light and indicator
 * alike.
 * @param car the car
 * @param corner the corner index
 * @returns the lamp's level 0..1
 */
export function lampLevel(car: RenderCar, corner: number) {
  const LAMP_OK = 0.15, LAMP_GONE = 0.35;
  const damage = car.dmg ? car.dmg[corner] : 0;
  if (damage <= LAMP_OK) return 1;
  if (damage >= LAMP_GONE) return 0;
  const intact = 1 - (damage - LAMP_OK) / (LAMP_GONE - LAMP_OK);
  return Math.random() < 0.1 + 0.5 * (1 - intact) ? 0 : intact;
}

/**
 * Whether the indicators are in the lit half of their blink (~1.5 Hz, wall clock).
 * @returns true while lit
 */
export function indicatorBlinkOn(): boolean {
  return Math.floor(performance.now() / 333) % 2 === 0;
}

/**
 * HEADLIGHTS: two soft beams ahead (drawn in the car's frame, art px), brighter lamps. In the dark
 * (?night=) only the lamps: the night layer (render/light.ts) draws the light they throw.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param sprite the body sprite
 */
function drawHeadlights(carsCtx: CarsContext, car: RenderCar, sprite: CarSprite) {
  const { view } = carsCtx;
  for (const [y, corner] of [[-sprite.Wp / 2 + 4, 0], [sprite.Wp / 2 - 4, 1]]) {
    const level = lampLevel(car, corner);
    if (!level) continue;
    if (DAYLIGHT.darkness > 0) {
      view.ctx.fillStyle = '#fffbe6';
      view.ctx.fillRect(sprite.Lp / 2 - 3, y - 2, 3, 4);
      continue;
    }
    const beam = view.ctx.createLinearGradient(sprite.Lp / 2, 0, sprite.Lp / 2 + 190, 0);
    beam.addColorStop(0, 'rgba(255,244,200,' + (0.34 * level).toFixed(3) + ')');
    beam.addColorStop(1, 'rgba(255,244,200,0)');
    view.ctx.fillStyle = beam;
    view.ctx.beginPath();
    view.ctx.moveTo(sprite.Lp / 2 - 1, y - 2);
    view.ctx.lineTo(sprite.Lp / 2 + 190, y - 34 + (y > 0 ? 30 : 0));
    view.ctx.lineTo(sprite.Lp / 2 + 190, y + 34 - (y < 0 ? 30 : 0));
    view.ctx.lineTo(sprite.Lp / 2 - 1, y + 2);
    view.ctx.closePath();
    view.ctx.fill();
    view.ctx.fillStyle = '#fffbe6';
    view.ctx.fillRect(sprite.Lp / 2 - 3, y - 2, 3, 4);
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
}

/**
 * Draw one car: shadow, wheels, body, punctured-wheel rims and lamps (or the rolled faces).
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param heading the heading to draw it at, radians (0 for its own GPU picture)
 */
function drawPixelCar(carsCtx: CarsContext, car: RenderCar, heading = car.heading) {
  const { view, PPMz, toScreenX, toScreenY, pixelCar, damagedSprite, silhouette } = carsCtx;
  const spec = car.spec, sp0 = pixelCar(spec),
    sprite = car.dmg ? damagedSprite(car, sp0) : sp0, scale = PPMz() / SPRITE_PPM;
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
  const halfWidth = drawCarWheels(carsCtx, car, sprite);
  view.ctx.drawImage(sprite.c, -sprite.Lp / 2 - 2, -sprite.Wp / 2 - 2);
  // DAMAGE (damage.js): a dark crushed block on each hurt corner, growing with the damage,
  // a pale crease along its edge; a punctured wheel shows a bright rim. Squares, not curves
  // (pixel rule).
  if (car.punct) for (let corner = 0; corner < 4; corner++) {
    if (car.punct[corner]) {
      view.ctx.fillStyle = '#c9c9d2';
      view.ctx.fillRect(
        Math.round((corner < 2 ? spec.lf : -spec.lr) * SPRITE_PPM) - 2,
        Math.round((corner % 2 ? 1 : -1) * halfWidth) - 1, 4, 2,
      );
    }
  }
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
  const key = 'wheels:' + spec.id + spec.paint + spec.trim + (spec.num || 0);
  if (faceCache.has(key)) return faceCache.get(key);
  const sprite = pixelCar(spec), carSpec = spec;
  const tyreL = carSpec.kind === 'track' ? 14 : carSpec.kind === 'tractor' ? 15 : 11,
    tyreW = carSpec.kind === 'track' ? 6 : 4;
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
    const big = carSpec.kind === 'tractor' && axleX < 0,
      tyreLen = big ? 20 : tyreL, tyreWid = big ? 7 : tyreW,
      x = Math.round(midX + axleX * SPRITE_PPM), y = Math.round(midY + side * halfWidth);
    gctx.fillStyle = '#16171c';
    gctx.fillRect(x - tyreLen / 2, y - tyreWid / 2, tyreLen, tyreWid);
    gctx.fillStyle = '#3a3d47';
    gctx.fillRect(x - tyreLen / 2 + 2, y - tyreWid / 2, tyreLen - 4, 1);
    if (carSpec.kind === 'tractor') {
      gctx.fillStyle = '#fbc02d';
      gctx.fillRect(x - 2, y - 1, 4, 2);
    } else if (carSpec.rim) {
      gctx.fillStyle = carSpec.rim;
      gctx.fillRect(x - 2, y - 1, 4, 2);
    }
  }
  gctx.drawImage(
    sprite.c, Math.round(midX - sprite.c.width / 2), Math.round(midY - sprite.c.height / 2),
  );
  const out = { c: canvas, Lp: sprite.Lp, Wp: sprite.Wp + padY * 2 };
  faceCache.set(key, out);
  return out;
}

/** A car's own picture (?sharpcars=1): the canvas and the car's centre in it, px. */
export interface CarPicture {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  originX: number;
  originY: number;
}

// how far the headlight beams reach ahead of the body and to each side, sprite px (drawHeadlights)
const BEAM_AHEAD = 192, BEAM_SIDE = 38;
// NIGHT PICTURES (?nightpics=0 off): in the dark the picture paints no beam (the night layer
// lights the road), so it leaves out the beam's room - with every car's lights on at night the
// room made each picture ~3x the area, painted and turned onto the screen every frame
let nightPics = true;

/**
 * Turns the night pictures on or off (main.js, at start-up).
 * @param isOn true: no beam room in the dark
 */
export function setNightPics(isOn: boolean): void { nightPics = isOn; }
// room round the body for the wheels, the shadow and the lamps, sprite px
const PICTURE_PAD = 14;

/**
 * Paints one car facing along +x into its own picture, each sprite pixel a block of enlarge x
 * enlarge, with drawPixelCar itself (shadow, wheels, body, damage, lamps, a roll), for the screen
 * canvas to turn and scale (render.ts drawSharpCarLayers). The picture reaches the headlight
 * beams when the lights are on. The origin sits so the sprite's pixels land on whole blocks.
 * @param carsCtx the shared view and helpers
 * @param car the car
 * @param picture the car's picture, resized when needed
 * @param enlarge picture px per sprite px (a whole number)
 */
function paintCarPicture(carsCtx: CarsContext, car: RenderCar, picture: CarPicture,
    enlarge: number) {
  const { view, pixelCar } = carsCtx;
  const sprite = pixelCar(car.spec);
  const pad = PICTURE_PAD + (car.roll && car.roll.phi ? sprite.Wp : 0);
  const back = Math.ceil(sprite.Lp / 2 + pad);
  const hasBeam = !!car.lightsOn && !(nightPics && DAYLIGHT.darkness > 0);
  const ahead = Math.ceil(sprite.Lp / 2 + pad + (hasBeam ? BEAM_AHEAD : 0));
  const side = Math.ceil(Math.max(sprite.Wp / 2 + pad, hasBeam ? BEAM_SIDE : 0));
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
  // each car's own picture (?sharpcars=1), kept while the car lives
  const pictures = new WeakMap<RenderCar, CarPicture>();
  return {
    drawPixelCar: (car: RenderCar) => drawPixelCar(carsCtx, car),
    /**
     * Paints a car's own picture (?sharpcars=1).
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
  };
}

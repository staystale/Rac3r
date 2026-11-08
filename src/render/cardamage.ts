// Car DAMAGE: dented sprites, the shadow silhouette, the crush and the side carve the rolled body
// takes too (render/rollbody.ts).
import { hash2d } from "../core/random.ts";
import { SPRITE_PPM } from "./shared.ts";
import { notePutPixels, spriteToWork } from "./spritepixels.ts";
import type {
  CarSprite, RenderCar, RenderCarSpec, SilCanvas,
} from "./types.ts";

/** Geometry of the top-view crush pass. */
interface CrushGeo {
  width: number;
  height: number;
  lengthPx: number;
  widthPx: number;
  crushEnds: number[];
  crushSides: number[];
  endMax: number;
  sideMax: number;
}

/** Geometry and damage of one side face carve. */
interface SideGeo {
  car: RenderCar;
  spec: RenderCarSpec;
  width: number;
  lengthPx: number;
  heightPx: number;
  frontCorner: number;
  rearCorner: number;
  depthFront: number;
  depthRear: number;
  roofDamage: number;
  wheelRadius: number;
  sill: number;
}

type HashFn = (x: number, y: number) => number;

/**
 * Pick the most-crushed edge near a pixel; a crush under ~0.6 art px is not drawn.
 * @param edges pairs of [distance in from the edge, crush depth of that edge]
 * @returns the smallest margin (Infinity when no edge counts) and the depth of that edge
 */
function nearestCrushEdge(edges: number[][]) {
  let best = Infinity, depth = 0;
  for (const [edgeDist, edgeDepth] of edges) {
    if (edgeDepth < 0.6) continue;
    const margin = edgeDist - edgeDepth;
    if (margin < best) {
      best = margin;
      depth = edgeDepth;
    }
  }
  return { best, depth };
}

/**
 * Shade one pixel in the DENT band behind a fold: dark fold, pale crease, primer chips, shade.
 * @param pixels the image data
 * @param i the pixel's index into the data
 * @param pos the pixel's [x, y]
 * @param best distance past the fold
 * @param depth crush depth of the edge
 * @param hsh seeded hash
 */
function dentPixel(
  pixels: Uint8ClampedArray, i: number, pos: number[], best: number, depth: number,
  hsh: HashFn,
) {
  const [x, y] = pos;
  // DENT band behind the fold: clearly dark at the fold, fading over 2 + 1.5 x depth px; a
  // pale crease line at the fold itself
  const band = 2 + 1.5 * depth, fade = 1 - best / band;
  if (fade > 0) {
    const rnd = hsh(y, x);
    if (best < 1) {
      const darken = 0.45 + 0.2 * rnd;
      pixels[i] *= darken;
      pixels[i + 1] *= darken;
      pixels[i + 2] *= darken;
      return;
    }   // the FOLD: a dark crumpled edge
    if (best < 2 && rnd < 0.35 * Math.min(1, depth / 3)) {
      pixels[i] = Math.min(255, pixels[i] * 0.6 + 110);
      pixels[i + 1] = Math.min(255, pixels[i + 1] * 0.6 + 110);
      pixels[i + 2] = Math.min(255, pixels[i + 2] * 0.6 + 118);
      return;
    }   // a pale crease just inside
    if (rnd < 0.18 * fade + 0.08 * Math.min(1, depth / 3)) {
      pixels[i] = 150;
      pixels[i + 1] = 150;
      pixels[i + 2] = 158;
      return;
    }   // CHIP: primer
    const shadeMul = 1 - (0.25 + 0.4 * Math.min(1, depth / 4)) * fade * (0.8 + 0.4 * rnd);
    pixels[i] *= shadeMul;
    pixels[i + 1] *= shadeMul;
    pixels[i + 2] *= shadeMul;   // DENT shade
  }
}

/**
 * Crumple and dent one pixel of the top view.
 * @param pixels the image data
 * @param x pixel column
 * @param y pixel row
 * @param geo sprite size and crush amounts
 * @param hsh seeded hash
 */
function crushPixel(
  pixels: Uint8ClampedArray, x: number, y: number, geo: CrushGeo, hsh: HashFn,
) {
  const { width, height, lengthPx, widthPx, crushEnds, crushSides, endMax, sideMax } = geo;
  const i = (y * width + x) * 4;
  if (pixels[i + 3] === 0) return;
  const along = Math.min(1, Math.max(0, (x - 2) / lengthPx)), across = Math.min(1,
      Math.max(0, (y - 2) / widthPx));
  // crush depth of each edge HERE, sloped between its two corners (the hit side deepest)
  const depthFront = endMax * (crushEnds[0] * (1 - across) + crushEnds[1] * across),
      depthRear = endMax * 0.85 * (crushEnds[2] * (1 - across) + crushEnds[3] * across);
  const depthNeg = sideMax * (crushSides[2] * (1 - along) + crushSides[0] * along),
      depthPos = sideMax * (crushSides[3] * (1 - along) + crushSides[1] * along);
  // how far this pixel is in from each edge
  const edgeFront = width - 3 - x, edgeRear = x - 2, edgeNeg = y - 2,
      edgePos = height - 3 - y;
  const jag = (hsh(x, y >> 1) - 0.5) * 2.2;
  // the most-crushed edge near this pixel decides; a pixel inside its crush is gone
  // (crumpled)
  // (a crush under ~0.6 art px is not drawn: v2a drew a pale crease round the whole outline
  // from scrapes)
  const { best, depth } = nearestCrushEdge([[edgeFront, depthFront], [edgeRear, depthRear],
      [edgeNeg, depthNeg], [edgePos, depthPos]]);
  if (best === Infinity) return;
  if (best < jag * Math.min(1, depth / 2)) {
    pixels[i + 3] = 0;
    return;
  }
  dentPixel(pixels, i, [x, y], best, depth, hsh);
}

/**
 * ROOF (a rollover, roll.ts -> damage.ts roofDmg): the cabin pressed dark, the glass cracked
 * white.
 * @param pixels the image data
 * @param geo sprite size and crush amounts
 * @param roofDamage roof damage 0..1
 * @param hsh seeded hash
 */
function crushRoof(
  pixels: Uint8ClampedArray, geo: CrushGeo, roofDamage: number, hsh: HashFn,
) {
  const { width, height, lengthPx, widthPx } = geo;
  for (let y = 2; y < height - 2; y++) for (let x = 2; x < width - 2; x++) {
    const i = (y * width + x) * 4;
    if (pixels[i + 3] === 0) continue;
    const along = (x - 2) / lengthPx, across = (y - 2) / widthPx;
    if (along < 0.22 || along > 0.78 || across < 0.15 || across > 0.85) continue;
    const dark = pixels[i] + pixels[i + 1] + pixels[i + 2] < 200, rnd = hsh(x * 3, y * 5);
    if (dark && rnd < 0.12 + 0.3 * roofDamage) {
      pixels[i] = 225;
      pixels[i + 1] = 228;
      pixels[i + 2] = 235;
      continue;
    }   // cracked glass
    const shadeMul = 1 - 0.35 * roofDamage * (0.7 + 0.3 * rnd);
    pixels[i] *= shadeMul;
    pixels[i + 1] *= shadeMul;
    pixels[i + 2] *= shadeMul;          // crushed roof
  }
}

/**
 * DAMAGED SPRITES: a per-car copy of the sprite, rebuilt only when its damage changes by 0.1 on
 * a corner. Each hurt corner is CRUMPLED (cut back along a jagged diagonal, deeper with
 * damage), DENTED (a darkened band behind the crush) and CHIPPED (paint pixels knocked to grey
 * primer). Seeded per car, so the same car always breaks the same way. Canvas: +x = forward
 * (front at the right), +y = the car's +y (damage.ts corners). The TOP-VIEW crush pass
 * (damagedSprite uses it; the rolled body's UNDERSIDE too, without the roof - render/rollbody.ts).
 * @param car the car
 * @param img the picture's pixels (its 2 px margin), changed in place
 * @param lengthPx the car's length, px
 * @param widthPx its width, px
 * @param withRoof whether the roof damage is drawn
 */
export function crushPixels(car: RenderCar, img: ImageData, lengthPx: number, widthPx: number,
    withRoof: boolean) {
  const rdKeep = car.roofDmg;
  if (!withRoof) car.roofDmg = 0;
  const pixels = img.data, width = img.width, height = img.height;
  const seed = (car.num || 1) * 2654435761;
  const hsh = hash2d(seed);
  const crushEnds = car.crushL, crushSides = car.crushS, endMax = lengthPx * 0.26,
      sideMax = widthPx * 0.34;
  const geo: CrushGeo = {
    width, height, lengthPx, widthPx, crushEnds, crushSides, endMax, sideMax,
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    crushPixel(pixels, x, y, geo, hsh);
  }
  const roofDamage = car.roofDmg || 0;
  if (roofDamage > 0.05) crushRoof(pixels, geo, roofDamage, hsh);
  car.roofDmg = rdKeep;
}

/**
 * The top sprite crushed (crushPixels) on a fresh canvas.
 * @param car the car
 * @param sprite the undamaged top sprite
 * @returns a new canvas and the pixels put on it
 */
function crushTop(car: RenderCar, sprite: CarSprite) {
  const { canvas, ctx: canvasCtx, img } = spriteToWork(sprite.c);
  crushPixels(car, img, sprite.Lp, sprite.Wp, true);
  canvasCtx.putImageData(img, 0, 0);
  return { canvas, img };
}

/**
 * Every EDGE is pushed in by the crush of its two corners, sloped between them — the front /
 * rear by the END-ON crush (crushL), the sides by the SIDE-ON crush (crushS) — so a hit on the
 * front-left shortens the front on the left and caves the left flank there. Behind the new edge
 * a DENT band (dark, graded, with a pale crease at the fold) that is visible from a light knock
 * up, and chipped paint (primer). Seeded. Cached on the car.
 * @param car the car
 * @param sprite its undamaged top sprite
 * @returns the damaged sprite (the same sprite when nothing is hurt)
 */
function damagedSprite(car: RenderCar, sprite: CarSprite) {
  const quantise = (values: number[]) => values.map((x) => Math.round(x * 12)).join(',');
  const key = quantise(car.crushL) + '|' + quantise(car.crushS) + '|'
      + car.wheelOff.map(Number).join('') + '|' + Math.round((car.roofDmg || 0) * 8);
  if (car._dsp && car._dsp.key === key && car._dsp.base === sprite) return car._dsp.sp;
  let out = sprite;
  if (car.dmg!.some((x) => x >= 0.02) || car.roofDmg > 0.05) {   // ! : only called
    // when car.dmg is set
    const crushed = crushTop(car, sprite);
    // nothing is drawn on it after: the parts it loses are taken off these pixels unread
    notePutPixels(crushed.canvas, crushed.img);
    out = { ...sprite, c: crushed.canvas };
  }
  car._dsp = { key, base: sprite, sp: out };
  return out;
}

/**
 * SHADOW = a darker copy of the sprite, so a crumpled corner, a missing wheel or a car on its
 * side casts its own shape. Cached on the canvas it copies.
 * @param source the sprite canvas
 * @returns the dark copy
 */
function silhouette(source: SilCanvas) {
  if (source._sil) return source._sil;
  const copy = document.createElement('canvas');
  copy.width = source.width;
  copy.height = source.height;
  const copyCtx = copy.getContext('2d')!;
  copyCtx.drawImage(source, 0, 0);
  copyCtx.globalCompositeOperation = 'source-in';
  copyCtx.fillStyle = '#14121c';
  copyCtx.fillRect(0, 0, copy.width, copy.height);
  source._sil = copy;
  return copy;
}

/**
 * Carve one pixel of a damaged side face: a lost wheel, the cut ends and roof, the fold, chips
 * and the side-crush shade.
 * @param pixels the image data
 * @param x pixel column
 * @param y pixel row
 * @param sideGeo the face geometry and damage
 * @param hsh seeded hash
 */
function carveSidePixel(
  pixels: Uint8ClampedArray, x: number, y: number, sideGeo: SideGeo, hsh: HashFn,
) {
  const { car, spec, width, lengthPx, heightPx, frontCorner, rearCorner } = sideGeo;
  const { depthFront, depthRear, roofDamage, wheelRadius, sill } = sideGeo;
  const i = (y * width + x) * 4;
  if (pixels[i + 3] === 0) return;
  const along = Math.min(1, Math.max(0, (x - 2) / lengthPx)), edgeFront = width - 3 - x,
      edgeRear = x - 2, edgeTop = y - 2, jag = (hsh(x, y >> 1) - 0.5) * 2;
  // a lost wheel: below the sill at that axle
  const axF = lengthPx / 2 + spec.lf * SPRITE_PPM, axR = lengthPx / 2 - spec.lr * SPRITE_PPM;
  if (y - 2 > sill && ((car.wheelOff[frontCorner] && Math.abs(x - 2 - axF) <= wheelRadius)
      || (car.wheelOff[rearCorner] && Math.abs(x - 2 - axR) <= wheelRadius))) {
    pixels[i + 3] = 0;
    return;
  }
  const cut = Math.min(edgeFront - depthFront, edgeRear - depthRear,
      roofDamage > 0.05 && along > 0.2 && along < 0.85 ? edgeTop
      - heightPx * 0.3 * roofDamage : Infinity);
  if (cut < jag) {
    pixels[i + 3] = 0;
    return;
  }
  if (cut < 1) {
    const darken = 0.45 + 0.2 * hsh(y, x);
    pixels[i] *= darken;
    pixels[i + 1] *= darken;
    pixels[i + 2] *= darken;
    return;
  }   // the fold
  const sideCrush = car.crushS[frontCorner] * along + car.crushS[rearCorner] * (1 - along),
      rnd = hsh(y, x);
  if (rnd < 0.28 * sideCrush) {
    pixels[i] = 150;
    pixels[i + 1] = 150;
    pixels[i + 2] = 158;
    return;
  }                        // chips
  const shadeMul = 1 - Math.min(0.5, 0.55 * sideCrush + (cut < 4 ? 0.2 * (1 - cut / 4) : 0))
      * (0.7 + 0.3 * rnd);
  pixels[i] *= shadeMul;
  pixels[i + 1] *= shadeMul;
  pixels[i + 2] *= shadeMul;
}

/**
 * Carve a side picture's pixels with the car's damage (the side face's carve; the rolled body's
 * real side profile too - render/rollbody.ts).
 * @param car the car
 * @param img the side picture's pixels (its 2 px margin), changed in place
 * @param lengthPx the car's length, px
 * @param heightPx the picture's height, px
 * @param plus the +y side (else the -y)
 */
export function carveSide(car: RenderCar, img: ImageData, lengthPx: number, heightPx: number,
    plus: boolean) {
  const spec = car.spec, frontCorner = plus ? 1 : 0, rearCorner = plus ? 3 : 2;
  const pixels = img.data, width = img.width, height = img.height;
  const seed = (car.num || 1) * 40503 + (plus ? 7 : 3);
  const hsh = hash2d(seed);
  const depthFront = lengthPx * 0.26 * car.crushL[frontCorner], depthRear = lengthPx * 0.22
      * car.crushL[rearCorner], roofDamage = car.roofDmg || 0, wheelRadius = (spec.wheelR
      || 0.3) * SPRITE_PPM, sill = heightPx - wheelRadius * 1.15;
  const sideGeo: SideGeo = {
    car, spec, width, lengthPx, heightPx, frontCorner, rearCorner, depthFront,
    depthRear, roofDamage, wheelRadius, sill,
  };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    carveSidePixel(pixels, x, y, sideGeo, hsh);
  }
}

/**
 * Create the car damage helpers.
 * @returns damagedSprite, silhouette and faceCache
 */
export function createCarDamage() {
  // composites made once per look (render/cars.ts pixelCarWithWheels)
  const faceCache = new Map<string, CarSprite>();
  return { damagedSprite, silhouette, faceCache };
}

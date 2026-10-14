// Car DAMAGE: dented sprites, shadow silhouette, rolled-car faces.
import { hash2d } from "../core/random.ts";
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { SPRITE_PPM } from "./shared.ts";
import type {
  CarSprite, RenderCar, RenderCarSpec, RollFace, SideSprite, SilCanvas, View,
} from "./types.ts";

/** What the moved functions share: the view and the cache of generated rolled-car faces. */
interface DamageContext {
  view: View;
  faceCache: Map<string, CarSprite | SideSprite>;
}

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

const ROLL_HP = () => Math.round(1.4 * SPRITE_PPM);

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
 * ROOF (a rollover, roll.js -> damage.js roofDmg): the cabin pressed dark, the glass cracked
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
 * (front at the right), +y = the car's +y (damage.js corners). The TOP-VIEW crush pass
 * (damagedSprite uses it; the UNDERSIDE when rolled uses it too, without the roof).
 * @param car the car
 * @param sprite the undamaged top sprite
 * @param withRoof whether the roof damage is drawn
 * @returns a new canvas
 */
function crushTop(car: RenderCar, sprite: CarSprite, withRoof: boolean) {
  const rdKeep = car.roofDmg;
  if (!withRoof) car.roofDmg = 0;
  const canvas = document.createElement('canvas');
  canvas.width = sprite.c.width;
  canvas.height = sprite.c.height;
  const canvasCtx = canvas.getContext('2d')!;
  canvasCtx.drawImage(sprite.c, 0, 0);
  const img = canvasCtx.getImageData(0, 0, canvas.width, canvas.height), pixels = img.data,
      width = canvas.width, height = canvas.height, lengthPx = sprite.Lp, widthPx = sprite.Wp;
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
  canvasCtx.putImageData(img, 0, 0);
  car.roofDmg = rdKeep;
  return canvas;
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
    out = { ...sprite, c: crushTop(car, sprite, true) };
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
 * Make a painter of rectangles (art px, offset by the 2 px margin) on a canvas context.
 * @param ctx the canvas context
 * @returns the paint function (x, y, width, height, colour)
 */
function makePaintRect(ctx: CanvasRenderingContext2D) {
  return (x: number, y: number, width: number, height: number, col: string) => {
    if (width <= 0 || height <= 0) return;
    ctx.fillStyle = col;
    ctx.fillRect(2 + Math.round(x), 2 + Math.round(y), Math.round(width), Math.round(height));
  };
}

/**
 * ROLLED CARS (roll.js): the side face of the box, generated like the top sprite (art px; x
 * rear -> front as pixelCar). Cached in the face cache.
 * @param dmgCtx the shared view and face cache
 * @param spec the car spec
 * @returns the side sprite
 */
function sideSprite(dmgCtx: DamageContext, spec: RenderCarSpec): SideSprite {
  const { faceCache } = dmgCtx;
  const cacheKey = 'side:' + spec.id + spec.paint + spec.trim;
  if (faceCache.has(cacheKey)) {
    return faceCache.get(cacheKey) as SideSprite;
  }
  const lengthPx = Math.round(spec.len * SPRITE_PPM), heightPx = ROLL_HP(),
      canvas = document.createElement('canvas');
  canvas.width = lengthPx + 4;
  canvas.height = heightPx + 4;
  const ctx = canvas.getContext('2d')!, paintRect = makePaintRect(ctx);
  const paint = spec.paint || '#d0552f', outline = shade(paint, 0.4), dark = shade(paint, 0.7),
      light = shade(paint, 1.25), glass = '#15171d', glassHi = '#3d4658';
  const wheelRadius = (spec.wheelR || 0.3) * SPRITE_PPM, roofY = heightPx * 0.08,
      beltY = heightPx * 0.42, sillY = heightPx - wheelRadius * 1.15;
  const cabA = lengthPx * (spec.kind === 'track' ? 0.3 : 0.25), cabB = lengthPx
      * (spec.kind === 'estate' ? 0.86 : 0.7);
  paintRect(0, beltY - 1, lengthPx, sillY - beltY + 2, outline);
  paintRect(1, beltY, lengthPx - 2, sillY - beltY, paint);                  // lower body
  paintRect(cabA - 1, roofY - 1, cabB - cabA + 2, beltY - roofY + 1, outline);
  paintRect(cabA, roofY, cabB - cabA, beltY - roofY, paint);   // cabin
  paintRect(cabA + 2, roofY + 2, (cabB - cabA) / 2 - 3, beltY - roofY - 3, glass);
  // windows
  paintRect(cabA + (cabB - cabA) / 2 + 1, roofY + 2, (cabB - cabA) / 2 - 3, beltY - roofY - 3,
      glass);
  paintRect(cabA + 3, roofY + 3, (cabB - cabA) / 2 - 6, 1, glassHi);
  paintRect(1, beltY, lengthPx - 2, 1, light);
  // waist highlight, sill shade
  paintRect(1, sillY - 2, lengthPx - 2, 2, dark);
  paintRect(lengthPx - 3, beltY + 2, 2, 3, '#fff3c4');
  paintRect(1, beltY + 2, 2, 3, '#c8342a');                             // head / tail lights
  for (const axle of [lengthPx / 2 + spec.lf * SPRITE_PPM, lengthPx / 2
      - spec.lr * SPRITE_PPM]) {
    paintRect(axle - wheelRadius, heightPx - 2 * wheelRadius, 2 * wheelRadius, 2 * wheelRadius,
        '#16171c');
    paintRect(axle - wheelRadius / 2, heightPx - 1.5 * wheelRadius, wheelRadius, wheelRadius,
        '#6d707a');
  }
  const out = { c: canvas, Lp: lengthPx, Hp: heightPx };
  faceCache.set(cacheKey, out);
  return out;
}

/**
 * ROLLED CARS (roll.js): the underside of the box, generated like the top sprite. Cached in the
 * face cache.
 * @param dmgCtx the shared view and face cache
 * @param spec the car spec
 * @returns the underside sprite
 */
function underSprite(dmgCtx: DamageContext, spec: RenderCarSpec): CarSprite {
  const { faceCache } = dmgCtx;
  const cacheKey = 'under:' + spec.id + spec.paint + spec.trim;
  if (faceCache.has(cacheKey)) {
    return faceCache.get(cacheKey) as CarSprite;
  }
  const lengthPx = Math.round(spec.len * SPRITE_PPM), widthPx = Math.round(spec.wid
      * SPRITE_PPM) | 1, canvas = document.createElement('canvas');
  canvas.width = lengthPx + 4;
  canvas.height = widthPx + 4;
  const ctx = canvas.getContext('2d')!, paintRect = makePaintRect(ctx);
  const paint = spec.paint || '#d0552f';
  paintRect(0, 1, lengthPx, widthPx - 2, shade(paint, 0.35));
  paintRect(1, 0, lengthPx - 2, widthPx, shade(paint, 0.35));
  paintRect(2, 2, lengthPx - 4, widthPx - 4, '#34353b');   // floor pan in a lip of paint
  paintRect(3, widthPx * 0.28, lengthPx - 6, 2, '#4a4c55');
  // chassis rails
  paintRect(3, widthPx * 0.72 - 2, lengthPx - 6, 2, '#4a4c55');
  const halfTrack = (spec.trackWidth || 1.5) / 2 * SPRITE_PPM, mid = widthPx / 2,
      wheelRadius = (spec.wheelR || 0.3) * SPRITE_PPM;
  for (const axle of [lengthPx / 2 + spec.lf * SPRITE_PPM, lengthPx / 2
      - spec.lr * SPRITE_PPM]) {
    // axle
    paintRect(axle - 1, mid - halfTrack + 2, 2, 2 * halfTrack - 4, '#5a5d66');
    // tyres, edge on
    for (const sign of [-1, 1]) paintRect(axle - wheelRadius, mid + sign * halfTrack - 2, 2
        * wheelRadius, 4, '#16171c');
  }
  paintRect(2, mid + 2, lengthPx * 0.45, 1, '#b9bcc4');
  // exhaust to the rear
  paintRect(1, mid + 1, 3, 3, '#8a8d96');
  // fuel tank
  paintRect(lengthPx * 0.3, mid - 4, lengthPx * 0.18, 8, '#2a2b30');
  const out = { c: canvas, Lp: lengthPx, Wp: widthPx };
  faceCache.set(cacheKey, out);
  return out;
}

/**
 * The damaged UNDERSIDE: the top-view crush without the roof, a lost wheel's tyre block cleared.
 * @param dmgCtx the shared view and face cache
 * @param car the car
 * @returns the damaged underside sprite
 */
function damageUnderFace(dmgCtx: DamageContext, car: RenderCar): CarSprite {
  const spec = car.spec;
  const under = underSprite(dmgCtx, spec);
  const out = { ...under, c: crushTop(car, under, false) };
  // a lost wheel: its tyre block gone from the underside
  const ctx = out.c.getContext('2d')!, halfTrack = (spec.trackWidth || 1.5) / 2 * SPRITE_PPM,
      mid = under.Wp / 2, wheelRadius = (spec.wheelR || 0.3) * SPRITE_PPM;
  for (let wheel = 0; wheel < 4; wheel++) if (car.wheelOff[wheel]) {
    const axle = under.Lp / 2 + (wheel < 2 ? spec.lf : -spec.lr) * SPRITE_PPM;
    ctx.clearRect(2 + axle - wheelRadius, 2 + mid + (wheel % 2 ? 1 : -1) * halfTrack - 2, 2
        * wheelRadius, 4);
  }
  return out;
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
 * The damaged SIDE face (x rear -> front, y roof -> wheels): its two END corners cut the ends
 * back (crushL), its two SIDE corners dent the panel along the length (crushS), a crushed roof
 * pushes the cabin down, a lost wheel is gone.
 * @param dmgCtx the shared view and face cache
 * @param car the car
 * @param kind 'sideN' or 'sideP'
 * @returns the damaged side sprite
 */
function damageSideFace(dmgCtx: DamageContext, car: RenderCar, kind: string): SideSprite {
  const spec = car.spec;
  const sp0 = sideSprite(dmgCtx, spec), plus = kind === 'sideP', frontCorner = plus ? 1 : 0,
      rearCorner = plus ? 3 : 2;
  const canvas = document.createElement('canvas');
  canvas.width = sp0.c.width;
  canvas.height = sp0.c.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(sp0.c, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height), pixels = img.data,
      width = canvas.width, height = canvas.height, lengthPx = sp0.Lp, heightPx = sp0.Hp;
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
  ctx.putImageData(img, 0, 0);
  return { ...sp0, c: canvas };
}

/**
 * DAMAGED ROLL FACES: the underside and the two side faces get the car's damage too, built
 * lazily (only once the car rolls) and cached per car and per damage step — nothing per frame.
 * @param dmgCtx the shared view and face cache
 * @param car the car
 * @param kind 'under', 'sideN' or 'sideP'
 * @returns the damaged face, or null when the car has no damage
 */
function dmgFace(
  dmgCtx: DamageContext, car: RenderCar, kind: string,
): CarSprite | SideSprite | null {
  if (!car.dmg) return null;
  const quantise = (values: number[]) => values.map((x) => Math.round(x * 12)).join(','),
      key = kind + quantise(car.crushL) + quantise(car.crushS) + car.wheelOff.map(Number).join(
      '') + Math.round((car.roofDmg || 0) * 8);
  const cache = car._dface || (car._dface = {});
  if (cache[kind] && cache[kind].key === key) return cache[kind].out;
  const out: CarSprite | SideSprite = kind === 'under' ? damageUnderFace(dmgCtx, car)
      : damageSideFace(dmgCtx, car, kind);
  cache[kind] = { key, out };
  return out;
}

/**
 * A box rolled phi about its long axis, seen from above: each face whose outward normal points
 * up, at its projected place and width (top: centre (H/2) sin, width W cos; underside: -(H/2)
 * sin, W cos; -y side: -(W/2) cos, H sin; +y side: (W/2) cos, -H sin).
 * @param dmgCtx the shared view and face cache
 * @param car the car
 * @param topSprite its top sprite
 * @param phi the roll angle
 * @returns the visible faces
 */
function rolledFaces(
  dmgCtx: DamageContext, car: RenderCar, topSprite: CarSprite, phi: number,
) {
  const spec = car.spec, side = sideSprite(dmgCtx, spec), under = underSprite(dmgCtx, spec),
      width = topSprite.Wp, height = side.Hp, cosPhi = Math.cos(phi), sinPhi = Math.sin(phi),
      out: RollFace[] = [];
  const face = (kind: string, plain: CarSprite | SideSprite) =>
    (car.dmg ? dmgFace(dmgCtx, car, kind) || plain : plain);
  if (cosPhi > 0.02) out.push({ cv: topSprite.c, cy: (height / 2) * sinPhi, ky: cosPhi,
      hh: topSprite.Wp });
  if (cosPhi < -0.02) out.push({ cv: face('under', under).c, cy: -(height / 2) * sinPhi,
      ky: cosPhi, hh: under.Wp });
  if (sinPhi > 0.02) out.push({ cv: face('sideN', side).c, cy: -(width / 2) * cosPhi,
      ky: -sinPhi, hh: side.Hp });
  if (sinPhi < -0.02) out.push({ cv: face('sideP', side).c, cy: (width / 2) * cosPhi,
      ky: -sinPhi, hh: side.Hp });
  return out;
}

/**
 * Draw the rolled faces (or their shadows).
 * @param dmgCtx the shared view and face cache
 * @param faces the faces from rolledFaces
 * @param lengthPx the sprite length in art px
 * @param sil whether to draw the silhouettes
 * @param off the offset applied to every face
 */
function drawFaces(
  dmgCtx: DamageContext, faces: RollFace[], lengthPx: number, sil: boolean, off: number,
) {
  const { view } = dmgCtx;
  for (const face of faces) {
    view.ctx.save();
    view.ctx.translate(off, face.cy + off);
    view.ctx.scale(1, face.ky);
    view.ctx.drawImage(sil ? silhouette(face.cv) : face.cv, -lengthPx / 2 - 2, -face.hh / 2 - 2);
    view.ctx.restore();
  }
}

/**
 * Create the car damage helpers.
 * @param view the view holding the canvas context
 * @returns damagedSprite, silhouette, faceCache, rolledFaces and drawFaces
 */
export function createCarDamage(view: View) {
  // ROLLED CARS (roll.js): the other faces of the box, generated like the top sprite
  const faceCache = new Map<string, CarSprite | SideSprite>();
  const dmgCtx: DamageContext = { view, faceCache };
  return {
    damagedSprite,
    silhouette,
    faceCache,
    rolledFaces: (car: RenderCar, topSprite: CarSprite, phi: number) =>
      rolledFaces(dmgCtx, car, topSprite, phi),
    drawFaces: (faces: RollFace[], lengthPx: number, sil: boolean, off: number) =>
      drawFaces(dmgCtx, faces, lengthPx, sil, off),
  };
}

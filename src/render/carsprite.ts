// The clean PIXEL CAR sprite: one cached sprite per livery, generated on an integer grid.
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { SPRITE_PPM } from "./shared.ts";
import { LOOKS } from "./carlooks.ts";
import type { CarSprite, RenderCarSpec } from "./types.ts";

// A sprite per car, GENERATED on an integer grid in the reference style
// (art/reference/car-ref-*.jpg):
// a 1 px dark outline, flat body colour with one highlight band, black glass, shut lines, mirrors,
// lights. Drawn once, cached, then rotated as a whole with smoothing off (the classic top-down
// pixel look). Wheels are separate pixel blocks UNDER the body so the fronts still visibly steer.
// Front = +x. 3x5 pixel digits for roof numbers (rows top to bottom, 3 bits each). The first
// Naffcar "18", drawn freehand, read as "IJ" on the review sheet.
const DIGITS: Record<number, number[]> = {
  0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [7, 1, 7, 4, 7], 3: [7, 1, 7, 1, 7],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 7, 1, 7], 6: [7, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2],
  8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 7],
};
const glass = '#15171d', glassHi = '#3d4658', HEAD = '#fff3c4', TAIL = '#c8342a',
  CHR = '#c9ccd4', WHITE = '#f2f2ee';
// (the redrawn bodies paint with the same: render/carlooks.ts)
export { glass as GLASS, HEAD, TAIL, CHR, WHITE };

/** The painting context of one sprite: the canvas, its measurements, the palette and helpers. */
export interface SpriteCtx {
  spec: RenderCarSpec;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  lengthPx: number;
  widthPx: number;
  mid: number;
  paint: string;
  outline: string;
  dark: string;
  light: string;
  roofShade: string;
  trim: string;
  // the THIRD part, and the roof in the SECOND colour (cars.ts PAINT_STOCK)
  third: string;
  roof2: string;
  kind: string;
  NUM: number;
  block: (x: number, y: number, width: number, height: number, col: string) => void;
  along: (x: number) => number;
}

/**
 * Makes the canvas and the painting context for one car spec.
 * @param spec the car's render spec
 * @returns the context shared by the painting steps
 */
function makeSpriteCtx(spec: RenderCarSpec): SpriteCtx {
  // odd width: a centre row
  const lengthPx = Math.round(spec.len * SPRITE_PPM),
    widthPx = Math.round(spec.wid * SPRITE_PPM) | 1;
  const canvas = document.createElement('canvas');
  canvas.width = lengthPx + 4;
  canvas.height = widthPx + 4;
  const ctx = canvas.getContext('2d')!;   // a new canvas always gives a 2d context
  // block(x, y, width, height, col): one solid block on the art grid. x runs rear (0) -> front
  // (lengthPx); y is the car's side.
  const block = (x: number, y: number, width: number, height: number, col: string) => {
    if (width <= 0 || height <= 0) return;
    ctx.fillStyle = col;
    ctx.fillRect(2 + Math.round(x), 2 + Math.round(y), Math.round(width), Math.round(height));
  };
  const paint = spec.paint, outline = shade(paint, 0.40), dark = shade(paint, 0.70),
    light = shade(paint, 1.30), roofShade = shade(paint, 1.10), trim = spec.trim || dark,
    third = spec.third || paint, roof2 = shade(trim, 1.10);
  // base id: the AI's 'naffcar#3' too (it was drawn as a plain muscle car)
  const kind = String(spec.id).split('#')[0] === 'naffcar' ? 'stock' : spec.kind,
    mid = (widthPx - 1) / 2, along = (x: number) => x * lengthPx;
  const NUM = spec.num! | 0;   // undefined | 0 is 0: unset on the base specs
  return { spec, canvas, ctx, lengthPx, widthPx, mid, paint, outline, dark, light, roofShade,
    trim, third, roof2, kind, NUM, block, along };
}

/**
 * Paints the classic body block: outline, fill, cut corners, top light, bottom shade.
 * @param spr the painting context
 * @param inset how far the body is inset from each side
 */
function shell(spr: SpriteCtx, inset = 0): void {
  const { ctx, lengthPx, widthPx, paint, outline, dark, light, block } = spr;
  block(0, inset, lengthPx, widthPx - inset * 2, outline);
  block(1, inset + 1, lengthPx - 2, widthPx - inset * 2 - 2, paint);
  for (const [x, y] of [[0, inset], [lengthPx - 1, inset], [0, widthPx - 1 - inset],
    [lengthPx - 1, widthPx - 1 - inset]]) ctx.clearRect(2 + x, 2 + y, 1, 1);
  block(2, inset + 1, lengthPx - 4, 2, light);
  block(2, widthPx - inset - 3, lengthPx - 4, 2, dark);
}

/**
 * Paints a glass cabin: rear glass, roof, side glass, raked windscreen, mirrors, door shuts.
 * @param spr the painting context
 * @param rearStart where the rear glass starts
 * @param roofStart where the roof starts
 * @param roofEnd where the roof ends
 * @param screenEnd where the windscreen ends
 * @param roofCol the roof colour
 */
export function cabin(spr: SpriteCtx, rearStart: number, roofStart: number, roofEnd: number,
  screenEnd: number, roofCol = spr.roofShade): void {
  const { widthPx, paint, outline, block } = spr;
  // rear glass
  block(rearStart, 3, roofStart - rearStart, widthPx - 6, glass);
  block(rearStart + 1, 4, 1, widthPx - 8, glassHi);
  // roof
  block(roofStart, 2, roofEnd - roofStart, widthPx - 4, roofCol);
  // side glass
  block(roofStart + 1, 2, roofEnd - roofStart - 2, 1, glass);
  block(roofStart + 1, widthPx - 3, roofEnd - roofStart - 2, 1, glass);
  // raked windscreen
  for (let i = 0; i < screenEnd - roofEnd; i++) {
    const rake = 3 + Math.round(i * 0.25);
    block(roofEnd + i, rake, 1, widthPx - rake * 2, glass);
  }
  block(roofEnd + 1, 4, 1, widthPx - 8, glassHi);
  // mirrors
  block(roofEnd + 1, -1, 2, 1, paint);
  block(roofEnd + 1, widthPx, 2, 1, paint);
  // door shuts
  block(roofStart + (roofEnd - roofStart) * 0.5, 1, 1, 2, outline);
  block(roofStart + (roofEnd - roofStart) * 0.5, widthPx - 3, 1, 2, outline);
}

/**
 * a PINSTRIPE in the third colour down both flanks.
 * @param spr the painting context
 * @param from where it starts along the car (share of the length)
 * @param until where it ends
 */
function pinstripe(spr: SpriteCtx, from: number, until: number): void {
  const { widthPx, third, block, along } = spr;
  block(along(from), 1, along(until - from), 1, third);
  block(along(from), widthPx - 2, along(until - from), 1, third);
}

/**
 * Louvre lines on a painted panel: darker on a light colour, lighter on a near-black one.
 * @param col the panel colour
 * @returns the line colour
 */
function panelLine(col: string): string {
  const rgb = [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16));
  return rgb[0] + rgb[1] + rgb[2] < 150 ? shade(col, 2.0) : shade(col, 0.65);
}

/**
 * Paints digits in the 3x5 font, 1 px a dot, upright when the car points right (a roof number).
 * @param spr the painting context
 * @param digits the digits
 * @param left the first digit's left edge
 * @param top the digits' top
 */
export function numDigits(spr: SpriteCtx, digits: number[], left: number, top: number): void {
  digits.forEach((digit, col) => DIGITS[digit].forEach((row, rowIdx) => {
    for (let bit = 0; bit < 3; bit++)
      if (row & (4 >> bit)) spr.block(left + col * 5 + bit, top + rowIdx, 1, 1, '#111');
  }));
}

/**
 * Paints the RACE NUMBER (garage livery): a white panel with a dark outline and the digits at
 * scale (3x5 font), upright when the car points right.
 * @param spr the painting context
 * @param centre the panel centre along the car
 * @param scale the pixel size of one digit pixel
 */
function numPanel(spr: SpriteCtx, centre: number, scale: number): void {
  const { NUM, mid, block } = spr;
  const digits = String(NUM).split('').map(Number),
    numWidth = digits.length * 3 * scale + (digits.length - 1) * scale, numHeight = 5 * scale,
    panelWidth = numWidth + 2 * scale, panelHeight = numHeight + 2 * scale;
  const left = Math.round(centre - panelWidth / 2),
    top = Math.round(mid + 0.5 - panelHeight / 2);
  block(left - 1, top - 1, panelWidth + 2, panelHeight + 2, '#14161b');
  block(left, top, panelWidth, panelHeight, WHITE);
  digits.forEach((digit, col) => DIGITS[digit].forEach((row, rowIdx) => {
    for (let bit = 0; bit < 3; bit++)
      if (row & (4 >> bit))
        block(left + scale + col * 4 * scale + bit * scale, top + scale + rowIdx * scale,
          scale, scale, '#14161b');
  }));
}

/**
 * Paints the head and tail lamps.
 * @param spr the painting context
 */
function drawLights(spr: SpriteCtx): void {
  const { lengthPx, widthPx, block } = spr;
  block(lengthPx - 2, 2, 1, 3, HEAD);
  block(lengthPx - 2, widthPx - 5, 1, 3, HEAD);
  block(0, 2, 1, 3, TAIL);
  block(0, widthPx - 5, 1, 3, TAIL);
}



/** Paints the tractor: cab, louvred bonnet, exhaust stack and lamps. */
function paintTractor(spr: SpriteCtx): void {
  const { lengthPx, widthPx, mid, dark, block, along } = spr;
  // TRACTOR: cab at the rear half, long louvred bonnet, exhaust stack, mudguards
  shell(spr, 2);
  // cab roof over glass
  block(along(0.10), 3, along(0.38), widthPx - 6, glass);
  block(along(0.12), 5, along(0.34), widthPx - 10, shade(spr.third, 1.15));
  // bonnet
  block(along(0.52), 4, along(0.44), widthPx - 8, shade(spr.trim, 0.92));
  // louvres
  for (let x = along(0.56); x < along(0.94); x += 3) block(x, 5, 1, widthPx - 10, dark);
  // exhaust stack
  block(along(0.60), mid - 1, 3, 3, '#2b2b2b');
  block(along(0.61), mid, 1, 1, '#777');
  block(lengthPx - 2, 3, 1, 3, HEAD); block(lengthPx - 2, widthPx - 6, 1, 3, HEAD);
}

/** Paints the estate: roof rails, bonnet shut and tow bar. */
function paintEstate(spr: SpriteCtx): void {
  const { widthPx, mid, dark, block, along } = spr;
  cabin(spr, along(0.03), along(0.10), along(0.58), along(0.70), spr.roof2);
  pinstripe(spr, 0.06, 0.94);
  // roof rails
  block(along(0.12), 3, along(0.44), 1, CHR);
  block(along(0.12), widthPx - 4, along(0.44), 1, CHR);
  // bonnet shut, tow bar
  block(along(0.74), 3, 1, widthPx - 6, dark);
  block(1, mid - 3, 3, 7, '#22252c');
}

/** Paints the muscle car: stripes, bonnet scoop and chrome bumpers. */
function paintMuscle(spr: SpriteCtx): void {
  const { lengthPx, widthPx, mid, outline, trim, block, along } = spr;
  cabin(spr, along(0.16), along(0.26), along(0.48), along(0.60),
    shade(spr.third, 1.10));
  // twin stripes
  block(along(0.62), mid - 4, lengthPx - along(0.62) - 2, 2, trim);
  block(along(0.62), mid + 3, lengthPx - along(0.62) - 2, 2, trim);
  block(along(0.26), mid - 4, along(0.22), 2, trim);
  block(along(0.26), mid + 3, along(0.22), 2, trim);
  block(2, mid - 4, along(0.12), 2, trim); block(2, mid + 3, along(0.12), 2, trim);
  // bonnet scoop
  block(along(0.70), mid - 2, along(0.12), 5, outline);
  block(along(0.71), mid - 1, along(0.10), 3, glass);
  // chrome bumpers
  block(lengthPx - 1, 4, 1, widthPx - 8, CHR);
  block(0, 4, 1, widthPx - 8, CHR);
}


/** Paints the saloon: tapered nose, power domes, kidney grille and lamps. */
function paintSaloon(spr: SpriteCtx): void {
  const { ctx, lengthPx, widthPx, mid, dark, light, NUM, block, along } = spr;
  // BMV 3 SERIOUS — the E46's signatures from above (requirement: less standard, more like the real
  // counterpart): a TAPERED nose, two POWER-DOME creases converging on a chrome KIDNEY grille, twin
  // round ANGEL-EYE lamps each side, the bonnet ROUNDEL, a SUNROOF, a short boot
  // deck with its lip, L-shaped TAIL LIGHTS wrapping onto the flanks, silver multi-spoke
  // wheels (spec.rim) nose taper
  for (const [x, y] of [[lengthPx - 1, 0], [lengthPx - 1, 1], [lengthPx - 2, 0],
    [lengthPx - 1, widthPx - 1], [lengthPx - 1, widthPx - 2], [lengthPx - 2, widthPx - 1],
    [0, 1], [0, widthPx - 2]]) ctx.clearRect(2 + x, 2 + y, 1, 1);
  cabin(spr, along(0.20), along(0.29), along(0.57), along(0.67), spr.roof2);
  pinstripe(spr, 0.08, 0.92);
  // SUNROOF + glint (the number takes the roof)
  if (!NUM) {
    block(along(0.33), 4, along(0.12), widthPx - 8, '#1d2128');
    block(along(0.34), 5, along(0.10), 1, '#56606e');
  }
  // boot shut, boot lip highlight
  block(along(0.18), 3, 1, widthPx - 6, dark);
  block(along(0.03), 3, along(0.12), 1, light);
  // POWER DOME creases: two clean lines (the old stepped pair read as noise)
  block(along(0.70), mid - 6, along(0.24), 1, light);
  block(along(0.70), mid + 6, along(0.24), 1, dark);
  // KIDNEYS
  block(lengthPx - 2, mid - 4, 2, 3, CHR);
  block(lengthPx - 2, mid + 2, 2, 3, CHR);
  block(lengthPx - 1, mid - 3, 1, 1, '#14161b');
  block(lengthPx - 1, mid + 3, 1, 1, '#14161b');
  // ROUNDEL
  block(along(0.88), mid - 1, 3, 3, '#14161b');
  block(along(0.88) + 1, mid - 1, 1, 1, '#2b6fd6');
  block(along(0.88), mid, 1, 1, '#2b6fd6');
  block(along(0.88) + 1, mid, 1, 1, WHITE);
  block(along(0.88), mid - 1, 1, 1, WHITE);
  // twin ANGEL EYES each side
  for (const y of [2, widthPx - 4]) {
    block(lengthPx - 3, y, 2, 2, HEAD);
    block(lengthPx - 6, y + (y < mid ? 1 : 0), 2, 2, HEAD);
    block(lengthPx - 4, y, 1, 2, '#2a2d34');
  }
  // L-shaped TAILS
  for (const y of [0, widthPx - 1]) {
    block(0, y < mid ? 1 : widthPx - 6, 1, 5, TAIL);
    block(1, y, 4, 1, TAIL);
  }
  // window trim
  block(along(0.29), 0, along(0.28), 1, '#2a2d34');
  block(along(0.29), widthPx - 1, along(0.28), 1, '#2a2d34');
}

/** Paints the WRZ: bonnet scoop, blob-eye lamps, flared arches and boot wing. */
function paintWrz(spr: SpriteCtx): void {
  const { spec, lengthPx, widthPx, mid, outline, dark, light, trim, block, along } = spr;
  // SUBAROO WRZ — the 2005 "blob-eye" WRX's signatures from above: the big raised BONNET
  // SCOOP with its dark mesh, big oval
  // BLOB-EYE lamps, a hexagonal GRILLE with the blue STAR badge, fog-lamp pods, FLARED arches
  // at both axles, the tall full-width
  // STI-style BOOT WING on uprights (and its shadow), one fat exhaust, gold wheels (spec.rim)
  const axF = lengthPx / 2 + spec.lf * SPRITE_PPM, axR = lengthPx / 2 - spec.lr * SPRITE_PPM;
  // ARCH FLARES
  for (const axle of [axF, axR]) {
    block(axle - 6, -1, 12, 1, outline);
    block(axle - 5, -1, 10, 1, dark);
    block(axle - 6, widthPx, 12, 1, outline);
    block(axle - 5, widthPx, 10, 1, dark);
  }
  cabin(spr, along(0.21), along(0.30), along(0.57), along(0.67), spr.roof2);
  pinstripe(spr, 0.10, 0.90);
  block(along(0.18), 3, 1, widthPx - 6, dark);
  // the SCOOP
  block(along(0.75), mid - 5, along(0.13), 11, outline);
  block(along(0.76), mid - 4, along(0.11), 9, light);
  block(along(0.77), mid - 3, along(0.08), 7, '#15171d');
  // scoop mesh
  for (let x = along(0.77); x < along(0.85); x += 2) block(x, mid - 3, 1, 7, '#2c3038');
  // BLOB-EYES
  for (const y of [1, widthPx - 6]) {
    block(lengthPx - 5, y, 4, 5, outline);
    block(lengthPx - 4, y + 1, 3, 3, HEAD);
    block(lengthPx - 4, y + 2, 1, 1, '#9aa3b0');
  }
  // GRILLE + STAR
  block(lengthPx - 1, mid - 4, 1, 9, '#15171d');
  block(lengthPx - 2, mid - 3, 1, 7, '#22252c');
  block(lengthPx - 2, mid - 1, 1, 3, '#2b6fd6');
  block(lengthPx - 2, mid, 1, 1, WHITE);
  // fog pods
  block(lengthPx - 1, 2, 1, 2, '#22252c');
  block(lengthPx - 1, widthPx - 4, 1, 2, '#22252c');
  // the BOOT WING (wider than the car), its shadow and uprights (?bigparts: not once knocked off)
  if (!spec.noWing) {
    block(2, 0, 3, widthPx, 'rgba(0,0,0,0.25)');
    block(4, -2, 3, widthPx + 4, outline);
    block(5, -1, 1, widthPx + 2, trim);
    block(4, -2, 3, 1, light);
    block(3, 4, 1, 2, '#2a2d34');
    block(3, widthPx - 6, 1, 2, '#2a2d34');
  }
  // tails
  for (const y of [1, widthPx - 4]) block(0, y, 1, 3, TAIL);
  // the fat exhaust
  block(-1, widthPx - 7, 1, 3, CHR);
  block(-1, widthPx - 6, 1, 1, '#1b1d22');
}

/** Paints the mini: trim roof, bonnet stripes, grille and round lamps. */
function paintMini(spr: SpriteCtx): void {
  const { lengthPx, widthPx, mid, trim, block, along } = spr;
  // MINNIE COOPED S — the 60s Mini from above: a tiny box with the wheels at the corners, a
  // long glasshouse under a contrasting
  // (trim) ROOF, a short bonnet with twin white STRIPES, a chrome moustache GRILLE, round
  // lamps, the external door + boot hinges
  cabin(spr, along(0.10), along(0.22), along(0.64), along(0.75), trim);
  const stripe = spr.third;
  block(along(0.79), mid - 4, lengthPx - along(0.79) - 2, 2, stripe);
  block(along(0.79), mid + 3, lengthPx - along(0.79) - 2, 2, stripe);
  block(lengthPx - 1, mid - 4, 1, 9, CHR); block(lengthPx - 2, mid - 2, 1, 5, '#2a2c33');
  block(along(0.43), 0, 1, 1, CHR);
  block(along(0.43), widthPx - 1, 1, 1, CHR);
  block(1, mid - 3, 1, 1, CHR);
  block(1, mid + 3, 1, 1, CHR);
  block(lengthPx - 3, 2, 2, 3, HEAD);
  block(lengthPx - 3, widthPx - 5, 2, 3, HEAD);
  block(0, 2, 1, 2, TAIL);
  block(0, widthPx - 4, 1, 2, TAIL);
}

/** Paints the lambo: wedge body, Y lamps, engine cover and wing. */
function paintLambo(spr: SpriteCtx): void {
  const { ctx, lengthPx, widthPx, mid, paint, outline, dark, light, block, along } = spr;
  // LAMBURGHINI HURRIKAN v2 (photographed v1: "a pickup truck" — a blunt nose, a green
  // louvred bed). The WEDGE: the body TAPERS over
  // the front 30 % to a pointed nose (re-outlined), a dark RAKED CANOPY well forward, a BLACK
  // louvred engine cover behind it, side
  // INTAKES in the flanks, Y-lamps on the tapered nose, a full-width tail bar and a diffuser
  const taperLen = along(0.30);
  for (let i = 0; i < taperLen; i++) {
    const x = lengthPx - 1 - i, cut = Math.round((taperLen - i) * 0.24);
    if (cut > 0) {
      ctx.clearRect(2 + x, 2, 1, cut);
      ctx.clearRect(2 + x, 2 + widthPx - cut, 1, cut);
    }
    block(x, cut, 1, 1, outline);
    block(x, widthPx - 1 - cut, 1, 1, outline);
    if (cut > 0) { block(x, cut + 1, 1, 1, light); }
  }
  block(along(0.80), mid, along(0.16), 1, dark); block(along(0.74), 4, 1, widthPx - 8, dark);
  block(along(0.44), 3, along(0.20), widthPx - 6, '#15171d');
  block(along(0.46), 4, 1, widthPx - 8, glassHi);
  block(along(0.62), 4, 1, widthPx - 8, glassHi);
  for (let i = 0; i < along(0.08); i++) {
    const rake = 3 + Math.round(i * 0.45);
    block(along(0.64) + i, rake, 1, widthPx - rake * 2, '#15171d');
  }
  block(along(0.48), 2, along(0.12), 1, paint);
  block(along(0.48), widthPx - 3, along(0.12), 1, paint);
  const cover = spr.trim, intake = spr.third;
  block(along(0.08), 4, along(0.34), widthPx - 8, cover);
  for (let x = along(0.10); x < along(0.40); x += 2) block(x, 5, 1, widthPx - 10,
    panelLine(cover));
  block(along(0.36), 0, along(0.08), 2, intake);
  block(along(0.36), widthPx - 2, along(0.08), 2, intake);
  block(along(0.48), -1, 2, 1, paint); block(along(0.48), widthPx, 2, 1, paint);
  const noseCut = Math.round(along(0.04) * 0.24) + 1;
  block(lengthPx - along(0.10), noseCut + 1, 4, 1, HEAD);
  block(lengthPx - along(0.10) + 1, noseCut + 2, 2, 1, HEAD);
  block(lengthPx - along(0.10), widthPx - noseCut - 2, 4, 1, HEAD);
  block(lengthPx - along(0.10) + 1, widthPx - noseCut - 3, 2, 1, HEAD);
  block(0, 3, 1, widthPx - 6, TAIL);
  block(-1, mid - 4, 1, 9, '#16181d');
  block(-1, mid - 1, 1, 3, '#55585f');
}


/** Paints the kit car. */
function paintKit(spr: SpriteCtx): void {
  const { spec, lengthPx, widthPx, mid, outline, dark, trim, block, along } = spr;
  // PUGEOT 306 MAXXI — the kit car: huge ARCH FLARES both axles, bonnet VENTS, a four-lamp
  // POD on the nose, a diagonal livery band,
  // a small boot spoiler
  const axF = lengthPx / 2 + spec.lf * SPRITE_PPM, axR = lengthPx / 2 - spec.lr * SPRITE_PPM;
  for (const axle of [axF, axR]) {
    block(axle - 7, -2, 14, 2, outline);
    block(axle - 6, -1, 12, 1, dark);
    block(axle - 7, widthPx, 14, 2, outline);
    block(axle - 6, widthPx, 12, 1, dark);
  }
  cabin(spr, along(0.12), along(0.22), along(0.55), along(0.68));
  pinstripe(spr, 0.06, 0.76);
  block(along(0.74), mid - 5, along(0.08), 2, glass);
  block(along(0.74), mid + 4, along(0.08), 2, glass);
  for (let i = 0; i < 4; i++) {
    block(lengthPx - 3, mid - 7 + i * 4, 2, 3, HEAD);
    block(lengthPx - 3, mid - 6 + i * 4, 1, 1, '#9aa3b0');
  }
  block(along(0.80), 2, 3, widthPx - 4, trim);
  block(along(0.84), 2, 1, widthPx - 4, '#f0f0ea');
  block(along(0.86), 2, 2, widthPx - 4, trim);
  block(0, 1, 2, widthPx - 2, outline); block(0, 2, 1, widthPx - 4, trim);
}

/** Paints the rx car. */
function paintRxcar(spr: SpriteCtx): void {
  const { spec, lengthPx, widthPx, mid, paint, outline, light, block, along } = spr;
  // FJORD FIESTER RX — a supermini on steroids: flares, a big ROOF SCOOP, a front SPLITTER, a
  // twin-plane WING wider than the body
  const axF = lengthPx / 2 + spec.lf * SPRITE_PPM, axR = lengthPx / 2 - spec.lr * SPRITE_PPM;
  for (const axle of [axF, axR]) {
    block(axle - 7, -2, 14, 2, outline);
    block(axle - 6, -1, 12, 1, paint);
    block(axle - 7, widthPx, 14, 2, outline);
    block(axle - 6, widthPx, 12, 1, paint);
  }
  cabin(spr, along(0.10), along(0.20), along(0.52), along(0.64), spr.roof2);
  block(along(0.25), mid - 2, along(0.10), 5, outline);
  block(along(0.26), mid - 1, along(0.08), 3, glass);
  const stripe = spr.third;
  block(along(0.66), 2, along(0.30), 2, stripe);
  block(along(0.66), widthPx - 4, along(0.30), 2, stripe);
  block(lengthPx, -1, 2, widthPx + 2, '#16181d');
  // the wing, deep, with endplates (?bigparts: not once knocked off)
  if (spec.noWing) return;
  block(1, 0, 3, widthPx, 'rgba(0,0,0,0.25)');
  block(-3, -4, 6, widthPx + 8, outline); block(-3, -4, 6, 1, '#16181d');
  block(-3, widthPx + 3, 6, 1, '#16181d');
  block(-2, -3, 4, widthPx + 6, outline);
  block(-1, -2, 2, widthPx + 4, spr.third);
  block(-2, -3, 4, 1, light);
}

/** Paints the banger. */
function paintBanger(spr: SpriteCtx): void {
  const { lengthPx, widthPx, trim, block, along } = spr;
  // BRISKA F2 STOCKER — a saloon shell in a steel cage: massive front + rear BUMPERS (wider
  // than the car), NERF RAILS down both sides,
  // the ROOF in the grade colour (trim), a wire mesh where the windscreen was
  cabin(spr, along(0.18), along(0.28), along(0.60), along(0.70), trim);
  for (let x = along(0.61); x < along(0.70); x += 2) block(x, 3, 1, widthPx - 6, '#55585f');
  const steel = spr.third, edge = shade(steel, 1.45);
  block(lengthPx, -2, 2, widthPx + 4, steel);
  block(lengthPx + 1, -2, 1, widthPx + 4, edge);
  block(-2, -2, 2, widthPx + 4, steel); block(-2, -2, 1, widthPx + 4, edge);
  block(along(0.22), -1, along(0.56), 1, steel);
  block(along(0.22), widthPx, along(0.56), 1, steel);
}


/** Paints the drift coupe: pop-up lamps, vents, ducktail spoiler, tow strap. */
function paintDrift(spr: SpriteCtx): void {
  const { lengthPx, widthPx, mid, outline, trim, block, along } = spr;
  // NISSUN SYLVYA S13 D — the 90s coupe: closed POP-UP lamps (dark lids), bonnet VENTS, a big
  // ducktail SPOILER, side stickers in trim,
  // a red TOW STRAP on the nose
  cabin(spr, along(0.14), along(0.26), along(0.55), along(0.66), spr.roof2);
  block(lengthPx - 5, 2, 3, 3, outline); block(lengthPx - 5, widthPx - 5, 3, 3, outline);
  block(along(0.76), mid - 4, along(0.08), 1, glass);
  block(along(0.76), mid + 3, along(0.08), 1, glass);
  const sticker = spr.third;
  block(along(0.30), 0, along(0.2), 1, sticker);
  block(along(0.30), widthPx - 1, along(0.2), 1, sticker);
  block(along(0.72), 1, along(0.06), 1, sticker);
  block(along(0.72), widthPx - 2, along(0.06), 1, sticker);
  // the ducktail (?bigparts: not once knocked off)
  if (!spr.spec.noWing) { block(0, 1, 3, widthPx - 2, outline); block(1, 2, 1, widthPx - 4, trim); }
  block(lengthPx - 1, mid + 4, 1, 3, '#d23b2a');
  for (const y of [1, widthPx - 4]) block(0, y, 1, 3, TAIL);
}


/** Paints the hatchback (FWD and RWD share it): shuts and grille. */
function paintHatch(spr: SpriteCtx): void {
  const { lengthPx, widthPx, dark, block, along } = spr;
  // HATCH (both the FWD and the RWD — the paint is the difference, as in the game)
  cabin(spr, along(0.08), along(0.20), along(0.53), along(0.66), spr.roof2);
  block(along(0.53) + 1, -1, 2, 1, spr.third);
  block(along(0.53) + 1, widthPx, 2, 1, spr.third);
  block(lengthPx - 2, 4, 1, widthPx - 8, spr.third);
  // bonnet + hatch shuts
  block(along(0.70), 3, 1, widthPx - 6, dark);
  block(along(0.05), 3, 1, widthPx - 6, dark);
  // grille
  block(lengthPx - 1, 5, 1, widthPx - 10, '#2a2c33');
}

/** The body painters by kind; any other kind is the hatchback. */
const CAR_BODIES = new Map<string, (spr: SpriteCtx) => void>([
  ['estate', paintEstate], ['muscle', paintMuscle], ['saloon', paintSaloon], ['wrz', paintWrz],
  ['mini', paintMini], ['lambo', paintLambo], ['kit', paintKit], ['rxcar', paintRxcar],
  ['banger', paintBanger], ['drift', paintDrift],
]);

/** The kinds whose body painter draws its own lamps. */
const OWN_LAMPS = ['saloon', 'wrz', 'mini', 'lambo', 'drift', 'grass'];

/**
 * Paints the shell, the kind's body and the lamps of an ordinary car.
 * @param spr the painting context
 */
function paintCarBody(spr: SpriteCtx): void {
  shell(spr);
  (CAR_BODIES.get(spr.kind) || paintHatch)(spr);
  // the saloons + the new bodies with their own lamps draw them (angel eyes, blob-eyes, the
  // Mini's rounds, the Lambo's Ys, pop-ups)
  if (!OWN_LAMPS.includes(spr.kind)) drawLights(spr);
}

/**
 * Paints the race number panel where each body has room, when the livery has a number.
 * @param spr the painting context
 */
function paintRaceNumber(spr: SpriteCtx): void {
  const { NUM, kind, along } = spr;
  if (!NUM) return;
  const numSpot = {
    mini: [0.43, 2], lambo: [0.84, 1], mikra: [0.37, 2], kit: [0.385, 2], rxcar: [0.36, 2],
    banger: [0.44, 2], grass: [0.84, 1], drift: [0.405, 2], track: [0.76, 1],
    tractor: [0.78, 2], estate: [0.34, 2], muscle: [0.37, 2], stock: [0.41, 2],
    saloon: [0.43, 2], wrz: [0.435, 2],
  }[kind] || [0.365, 2];
  numPanel(spr, along(numSpot[0]), numSpot[1]);
}

/**
 * Paints one car sprite on a fresh canvas.
 * @param spec the car's render spec
 * @returns the sprite: canvas and its pixel length and width
 */
function paintCarSprite(spec: RenderCarSpec): CarSprite {
  // (the redrawn bodies paint their own lamps; a bare one has no closed shell; a wide
  // one is drawn on a sprite as wide as its wheel track - the F1 car's front wing)
  const look = LOOKS.get(String(spec.id).split('#')[0]);
  const spr = makeSpriteCtx(look?.wide && spec.trackWidth
    ? { ...spec, wid: spec.trackWidth + 0.34, bodyWid: spec.wid } as RenderCarSpec : spec);
  if (look) {
    if (!look.bare) shell(spr);
    look.paint(spr);
  } else if (spr.kind === 'tractor') paintTractor(spr);
  else paintCarBody(spr);
  paintRaceNumber(spr);
  return { c: spr.canvas, Lp: spr.lengthPx, Wp: spr.widthPx };
}

/**
 * Creates the car sprite painter with its per-livery cache.
 * @returns the painter: pixelCar(spec) gives the cached sprite of a livery
 */
export function createCarSprite() {
  const spriteCache = new Map<string, CarSprite>();
  function pixelCar(spec: RenderCarSpec): CarSprite {
    // one sprite per LIVERY (paint, trim, number)
    const key = spec.id + '|' + spec.paint + '|' + spec.trim + '|' + (spec.third || '') + '|'
      + (spec.num || 0) + (spec.noWing ? '|nowing' : '');
    if (spriteCache.has(key)) return spriteCache.get(key)!;   // has(key) was just true
    const out = paintCarSprite(spec);
    spriteCache.set(key, out);
    return out;
  }

  return { pixelCar };
}

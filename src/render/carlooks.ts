// render/carlooks.ts - ?carlooks (owner 11-07, item 4 stage 2: "reworking any cars that don't look
// like their real counter part"; the audit "seems accurate"): the redrawn bodies, from above, nose
// +x. Each keeps the car's size (its physics box) and paints its SECOND part (trim) big and its
// THIRD (spr.third) as a detail, as ?carpaint asks of every car. The cars: the Golf and the M135i
// (they shared one body), the quattro S1 E2, the 2022 F1 car (the F2 too), the Next Gen Cup car,
// the Micra R1 and the Class 8 autograss buggy.
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { SPRITE_PPM } from "./shared.ts";
import {
  cabin, numDigits, CHR, GLASS, HEAD, TAIL, WHITE, type SpriteCtx,
} from "./carsprite.ts";

const INK = '#16181d', STEEL = '#2a2d34', MESH = '#3a3d45';

/**
 * Clears single pixels off the sprite (rounded or cut corners).
 * @param spr the painting context
 * @param pixels the [x, y] to clear
 */
function clearPixels(spr: SpriteCtx, pixels: number[][]): void {
  for (const [x, y] of pixels) spr.ctx.clearRect(2 + x, 2 + y, 1, 1);
}

/**
 * Mirror caps in the third colour, either side just ahead of the roof.
 * @param spr the painting context
 * @param roofEnd where the roof ends, px
 */
function mirrorCaps(spr: SpriteCtx, roofEnd: number): void {
  spr.block(roofEnd + 1, -1, 2, 1, spr.third);
  spr.block(roofEnd + 1, spr.widthPx, 2, 1, spr.third);
}

/**
 * VW GOLF GTI Mk7: the short bonnet, wide C-pillars, roof spoiler, honeycomb grille, the red line.
 */
function paintGolf(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, paint, dark, outline, third, roof2, block, along } = spr;
  clearPixels(spr, [[len - 1, 0], [len - 1, wid - 1]]);
  cabin(spr, along(0.05), along(0.14), along(0.58), along(0.70), roof2);
  // wide C-pillars over the edges of the near-upright hatch glass, the roof spoiler on its lip
  block(along(0.05), 3, along(0.09), 2, paint);
  block(along(0.05), wid - 5, along(0.09), 2, paint);
  block(along(0.03), 3, 2, wid - 6, outline);
  block(along(0.03) + 1, 4, 1, wid - 8, roof2);
  mirrorCaps(spr, along(0.58));
  // clamshell shut lines
  block(along(0.73), 3, 1, wid - 6, dark);
  // honeycomb grille, the GTI line across it into the lamps, slim swept lamps
  block(len - 2, 5, 2, wid - 10, INK);
  for (let y = 6; y < wid - 6; y += 2) block(len - 1, y, 1, 1, MESH);
  block(len - 3, 3, 1, wid - 6, third);
  for (const y of [1, wid - 5]) {
    block(len - 3, y, 2, 4, HEAD);
    block(len - 4, y + 1, 1, 2, HEAD);
  }
  // wide tails, twin exhausts (one each side)
  for (const y of [1, wid - 6]) block(0, y, 1, 5, TAIL);
  block(-1, 4, 1, 2, CHR); block(-1, wid - 6, 1, 2, CHR);
}

/**
 * BMW M135i (F20): the long bonnet (engine lengthways), cabin set back, twin kidneys, angel eyes.
 */
function paintM135(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, dark, light, third, roof2, block, along } = spr;
  clearPixels(spr, [[len - 1, 0], [len - 1, 1], [len - 2, 0], [len - 1, wid - 1],
    [len - 1, wid - 2], [len - 2, wid - 1]]);
  cabin(spr, along(0.06), along(0.16), along(0.52), along(0.63), roof2);
  mirrorCaps(spr, along(0.52));
  block(along(0.05), 3, 1, wid - 6, dark);
  // the bonnet's two creases running to the kidneys, the roundel
  block(along(0.68), mid - 6, along(0.26), 1, light);
  block(along(0.68), mid + 6, along(0.26), 1, dark);
  block(along(0.90), mid - 1, 3, 3, '#14161b');
  block(along(0.90) + 1, mid - 1, 1, 1, '#2b6fd6'); block(along(0.90), mid, 1, 1, '#2b6fd6');
  block(along(0.90), mid - 1, 1, 1, WHITE); block(along(0.90) + 1, mid, 1, 1, WHITE);
  // the twin KIDNEYS (their surround the third colour), the low intakes either side
  for (const y of [mid - 4, mid + 2]) {
    block(len - 2, y, 2, 3, third);
    block(len - 1, y + 1, 1, 1, '#14161b');
  }
  block(len - 1, 2, 1, 3, INK); block(len - 1, wid - 5, 1, 3, INK);
  // swept angular lamps with their angel eyes, L-shaped tails, twin pipes on one side
  for (const y of [1, wid - 4]) {
    block(len - 4, y, 3, 3, HEAD);
    block(len - 6, y + (y < mid ? 1 : 0), 2, 2, HEAD);
  }
  for (const y of [1, wid - 5]) block(0, y, 1, 4, TAIL);
  block(1, 1, 3, 1, TAIL); block(1, wid - 2, 3, 1, TAIL);
  block(-1, wid - 8, 1, 2, CHR); block(-1, wid - 5, 1, 2, CHR);
}

/**
 * AUDI SPORT QUATTRO S1 E2: the short box, blister arches, the huge splitter, bonnet vents, the
 * wing.
 */
function paintQuattro(spr: SpriteCtx): void {
  const { spec, lengthPx: len, widthPx: wid, mid, paint, outline, light, trim, third, roof2,
    NUM, block, along } = spr;
  const axF = len / 2 + spec.lf * SPRITE_PPM, axR = len / 2 - spec.lr * SPRITE_PPM;
  for (const axle of [axF, axR]) {
    block(axle - 7, -2, 14, 2, outline); block(axle - 6, -1, 12, 1, paint);
    block(axle - 7, wid, 14, 2, outline); block(axle - 6, wid, 12, 1, paint);
  }
  cabin(spr, along(0.14), along(0.25), along(0.55), along(0.66), roof2);
  if (!NUM) block(along(0.40), mid - 1, 3, 3, '#30343c');
  // the bonnet VENTS, the big front SPLITTER, quad lamps
  for (const y of [3, wid - 8]) {
    block(along(0.72), y, along(0.15), 5, GLASS);
    for (let x = along(0.73); x < along(0.86); x += 2) block(x, y + 1, 1, 3, MESH);
  }
  block(len, -1, 2, wid + 2, INK); block(len + 1, 0, 1, wid, STEEL);
  for (const y of [2, 6, wid - 4, wid - 8]) block(len - 2, y, 2, 2, HEAD);
  // side livery in the second colour
  block(along(0.66), 1, along(0.32), 1, trim); block(along(0.66), wid - 2, along(0.32), 1, trim);
  // the REAR WING on the hatch (the third colour), wider than the car, on its uprights
  block(1, 0, 3, wid, 'rgba(0,0,0,0.25)');
  block(-2, -3, 5, wid + 6, outline); block(-1, -2, 3, wid + 4, third); block(-2, -3, 5, 1, light);
  for (const y of [4, wid - 5]) block(3, y, 1, 1, STEEL);
  for (const y of [1, wid - 4]) block(0, y, 1, 3, TAIL);
  block(along(0.20), -1, 3, 1, '#222'); block(along(0.20), wid, 3, 1, '#222');
}

/** THE 2022 F1 CAR (and the F2): full-width wings, a thin nose, wide sidepods, the halo. */
function paintModernOpenWheel(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, paint, outline, light, dark, trim, third, block,
    along } = spr;
  // SIDEPODS, wide at their mouths and tapering to the back (the coke bottle)
  const podFront = along(0.54), podBack = along(0.20);
  for (let x = podBack; x < podFront; x++) {
    const half = Math.round(4 + (mid - 5) * (x - podBack) / (podFront - podBack));
    block(x, mid - half, 1, half * 2 + 1, outline);
    block(x, mid - half + 1, 1, half * 2 - 1, paint);
    block(x, mid - half + 1, 1, 1, light);
  }
  for (const y of [1, wid - 3]) block(podFront - 2, y + (y < mid ? 1 : -1), 2, 2, GLASS);
  // the ENGINE COVER down to the gearbox, its fin
  block(along(0.06), mid - 3, along(0.20), 7, outline);
  block(along(0.07), mid - 2, along(0.20), 5, paint);
  block(along(0.06), mid, along(0.40), 1, dark);
  // the NOSE, thin, with its stripe (the third colour)
  block(along(0.60), mid - 2, len - 4 - along(0.60), 5, outline);
  block(along(0.60), mid - 1, len - 4 - along(0.60), 3, paint);
  block(along(0.62), mid, len - 6 - along(0.62), 1, third);
  // the cockpit, the helmet, the HALO (chrome ring and front strut)
  block(along(0.46), mid - 3, along(0.14), 7, outline);
  block(along(0.47), mid - 2, along(0.12), 5, GLASS);
  block(along(0.50), mid - 1, 3, 3, '#e4c23a');
  block(along(0.46), mid - 3, along(0.14), 1, CHR);
  block(along(0.46), mid + 3, along(0.14), 1, CHR);
  block(along(0.60) - 1, mid, 3, 1, CHR);
  // the FRONT WING full width with endplates, the REAR WING (both the second colour)
  block(len - 4, 0, 4, wid, outline); block(len - 3, 1, 2, wid - 2, trim);
  block(len - 3, 1, 1, wid - 2, shade(trim, 1.3));
  block(-1, 0, 5, wid, outline); block(0, 1, 3, wid - 2, trim); block(0, mid - 3, 1, 7, third);
  block(4, mid - 1, 2, 3, STEEL);
}

/**
 * NEXT GEN CUP CAR: the wide smooth slab, sticker lamps, the big roof number, bonnet panel,
 * spoiler.
 */
function paintNextGen(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, outline, trim, third, NUM, block, along } = spr;
  clearPixels(spr, [[len - 1, 0], [len - 1, 1], [len - 2, 0], [len - 1, wid - 1],
    [len - 1, wid - 2], [len - 2, wid - 1]]);
  cabin(spr, along(0.20), along(0.30), along(0.56), along(0.66));
  if (!NUM) {
    block(along(0.31), mid - 5, 13, 11, WHITE);
    numDigits(spr, [4, 2], along(0.31) + 2, mid - 2);
  }
  // the windscreen tear-off strip, the window net (driver's side)
  block(along(0.58), mid, along(0.07), 1, '#56606e');
  for (let x = along(0.32); x < along(0.54); x += 2) block(x, 1, 1, 1, '#111');
  // the BONNET panel (the second colour) with its outline, hood pins
  block(along(0.69), 4, along(0.25), wid - 8, outline);
  block(along(0.70), 5, along(0.23), wid - 10, trim);
  block(along(0.96), 6, 1, 1, CHR); block(along(0.96), wid - 7, 1, 1, CHR);
  // STICKER lamps (no glass lamps on a stock car), the splitter
  for (const y of [2, wid - 7]) {
    block(len - 4, y, 3, 5, '#cfd3da');
    block(len - 3, y + 1, 1, 3, '#eef0f4');
  }
  block(len, 2, 1, wid - 4, INK);
  // the REAR SPOILER and quarter panels (the third colour), sticker tails
  block(-1, 1, 3, wid - 2, outline); block(0, 2, 1, wid - 4, third);
  block(along(0.04), 2, along(0.13), 2, third); block(along(0.04), wid - 4, along(0.13), 2, third);
  for (const y of [3, wid - 6]) block(2, y, 1, 3, '#d8585a');
}

/** NISSAN MICRA R1 (K12): the round bubble, the big oval lamps, rally stripes and flaps. */
function paintMicra(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, outline, third, roof2, NUM, block, along } = spr;
  clearPixels(spr, [[len - 1, 0], [len - 1, 1], [len - 1, 2], [len - 2, 0], [len - 3, 0],
    [len - 1, wid - 1], [len - 1, wid - 2], [len - 1, wid - 3], [len - 2, wid - 1],
    [len - 3, wid - 1], [0, 0], [0, 1], [1, 0], [0, wid - 1], [0, wid - 2], [1, wid - 1]]);
  cabin(spr, along(0.06), along(0.14), along(0.60), along(0.73), roof2);
  // the bubble roof's rounded corners
  for (const y of [2, wid - 3]) {
    block(along(0.14), y, 1, 1, GLASS);
    block(along(0.60) - 1, y, 1, 1, GLASS);
  }
  if (!NUM) block(along(0.40), mid - 1, 3, 3, '#30343c');
  // the big OVAL lamps bulging up onto the bonnet, the little grille
  for (const y of [1, wid - 6]) {
    block(len - 7, y, 5, 5, outline); block(len - 6, y + 1, 3, 3, HEAD);
    block(len - 6, y + 1, 1, 1, '#ffffff');
  }
  block(len - 1, mid - 3, 1, 7, '#2a2c33');
  // rally stripes (the third colour), mud flaps, round tails
  block(along(0.08), 1, along(0.62), 1, third); block(along(0.08), wid - 2, along(0.62), 1, third);
  block(along(0.75), mid, along(0.16), 1, third);
  block(along(0.20), -1, 2, 1, '#222'); block(along(0.20), wid, 2, 1, '#222');
  for (const y of [2, wid - 4]) block(0, y, 1, 2, TAIL);
}

/**
 * AUTOGRASS CLASS 8 SPECIAL: an open space-frame buggy - pods, nose, the cage, the engine out back.
 */
function paintBuggy(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, paint, outline, light, trim, third, block,
    along } = spr;
  // the floor pan between the wheels
  block(along(0.05), 4, along(0.88), wid - 8, STEEL);
  // SIDE PODS and the NOSE in the body colour
  for (const y of [3, wid - 8]) {
    block(along(0.28), y, along(0.42), 5, outline);
    block(along(0.29), y + 1, along(0.40), 3, paint);
    block(along(0.29), y + 1, along(0.40), 1, light);
  }
  for (let x = along(0.70); x < len; x++) {
    const half = Math.round(7 - 3 * (x - along(0.70)) / (len - along(0.70)));
    block(x, mid - half, 1, half * 2 + 1, outline);
    block(x, mid - half + 1, 1, half * 2 - 1, paint);
  }
  // the ENGINE behind the driver under its cover (the third colour), the filter, the exhaust
  block(along(0.06), mid - 6, along(0.28), 13, outline);
  block(along(0.07), mid - 5, along(0.26), 11, third);
  block(along(0.10), mid - 3, along(0.10), 7, shade(third, 1.45));
  block(along(0.24), mid - 2, 3, 5, '#d23b2a');
  block(-1, mid + 4, 3, 2, CHR);
  // the seat and the helmet
  block(along(0.40), mid - 5, along(0.24), 11, GLASS); block(along(0.48), mid - 1, 3, 3, '#e4c23a');
  // the ROLL CAGE (the second colour): two hoops, the side rails, the diagonal
  block(along(0.38), mid - 7, 2, 15, trim); block(along(0.64), mid - 7, 2, 15, trim);
  block(along(0.38), mid - 7, along(0.28), 2, trim);
  block(along(0.38), mid + 6, along(0.28), 2, trim);
  for (let i = 0; i < along(0.26); i++)
    block(along(0.39) + i, Math.round(mid - 6 + i * 12 / along(0.26)), 1, 1, trim);
}

/** The redrawn bodies by car id: the painter, and bare = no closed shell under it. */
export const LOOKS = new Map<string, { paint: (spr: SpriteCtx) => void; bare?: boolean }>([
  ['hatch-fwd', { paint: paintGolf }], ['hatch-rwd', { paint: paintM135 }],
  ['rally-4x4', { paint: paintQuattro }],
  ['track-rwd', { paint: paintModernOpenWheel, bare: true }],
  ['f2-rwd', { paint: paintModernOpenWheel, bare: true }], ['naffcar', { paint: paintNextGen }],
  ['mikra-r1', { paint: paintMicra }], ['grass-special', { paint: paintBuggy, bare: true }],
]);

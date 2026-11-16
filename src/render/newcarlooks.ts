// render/newcarlooks.ts - the NEW CARS' bodies from above (src/newcars.ts, each behind its own
// switch), nose +x, in the house style of render/carlooks.ts (which lists them in LOOKS): a 1 px
// dark outline, flat paint with a light band on the top flank and a dark one on the bottom, black
// glass, the SECOND colour (trim) big and the THIRD as a detail.
import { SPRITE_PPM } from "./shared.ts";
import { CHR, GLASS, HEAD, TAIL, type SpriteCtx } from "./carsprite.ts";

const INK = '#16181d', STEEL = '#2a2d34', MESH = '#3a3d45', GLASS_HI = '#3d4658';

/**
 * Paints a body from its PLAN: each column's half width, px, from the tail (x 0) to the nose -
 * the outline round it, the paint inside, a light band along the top flank and a dark one along
 * the bottom (as render/carsprite.ts shell paints a box).
 * @param spr the painting context
 * @param halfAt the half width at a column, px (up to the sprite's mid)
 */
function planBody(spr: SpriteCtx, halfAt: (x: number) => number): void {
  const { lengthPx: len, mid, paint, outline, dark, light, block } = spr;
  for (let x = 0; x < len; x++) {
    const half = Math.min(mid, Math.max(1, Math.round(halfAt(x))));
    const top = Math.round(mid - half), across = half * 2 + 1;
    block(x, top, 1, across, outline);
    if (x === 0 || x === len - 1 || across < 5) continue;
    block(x, top + 1, 1, across - 2, paint);
    block(x, top + 1, 1, 2, light);
    block(x, top + across - 3, 1, 2, dark);
  }
}

/**
 * The 911 GT3 R's plan, a half width at a share of its length (0 tail, 1 nose), as a share of
 * the widest: the rounded tail, the wide rear hips, the waist at the doors, the front wings over
 * the front wheels and the rounded nose between the lamps (from photographs, top view).
 * @param share along the car, 0..1
 * @returns the half width, 0..1 of the widest
 */
function porchPlan(share: number): number {
  if (share < 0.04) return 0.82 + 0.18 * Math.sqrt(share / 0.04);
  if (share < 0.40) return 1;
  if (share < 0.47) return 1 - 0.07 * (share - 0.40) / 0.07;
  if (share < 0.60) return 0.93;
  if (share < 0.68) return 0.93 + 0.06 * (share - 0.60) / 0.08;
  if (share < 0.90) return 0.99;
  const round = (share - 0.90) / 0.10;
  return 0.99 * Math.sqrt(1 - 0.55 * round * round);
}

/**
 * The 911 GT3 R's glasshouse: the long rear screen tapering to the engine lid, the roof (the
 * second colour), the side glass and the raked windscreen, narrower than the hips.
 * @param spr the painting context
 */
function porchCabin(spr: SpriteCtx): void {
  const { mid, roof2, block, along } = spr;
  const rearFrom = along(0.22), roofFrom = along(0.36), roofTo = along(0.56),
    screenTo = along(0.66), cabinHalf = Math.round(spr.mid * 0.66);
  // the rear screen, narrowing toward the tail (the fastback)
  for (let x = rearFrom; x < roofFrom; x++) {
    const half = Math.round(cabinHalf - 4 * (roofFrom - x) / (roofFrom - rearFrom));
    block(x, mid - half, 1, half * 2 + 1, GLASS);
  }
  block(rearFrom + 2, mid - cabinHalf + 4, 1, cabinHalf * 2 - 7, GLASS_HI);
  // the roof, its side glass
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, cabinHalf * 2 + 1, roof2);
  block(roofFrom + 1, mid - cabinHalf, roofTo - roofFrom - 2, 1, GLASS);
  block(roofFrom + 1, mid + cabinHalf, roofTo - roofFrom - 2, 1, GLASS);
  // the raked windscreen, widening toward the front lid
  for (let x = roofTo; x < screenTo; x++) {
    const half = Math.round(cabinHalf + 2 * (x - roofTo) / (screenTo - roofTo));
    const rake = Math.round((x - roofTo) * 0.3);
    block(x, mid - half + rake, 1, (half - rake) * 2 + 1, GLASS);
  }
  block(roofTo + 1, mid - cabinHalf + 2, 1, cabinHalf * 2 - 3, GLASS_HI);
}

/**
 * The 911 GT3 R's nose: the oval lamps on the front wings, the lid's vent over the central
 * radiator, the louvres over the front wheels, the intakes and the splitter.
 * @param spr the painting context
 * @param axleX the front axle, px from the tail
 */
function porchNose(spr: SpriteCtx, axleX: number): void {
  const { lengthPx: len, widthPx: wid, mid, outline, dark, light, third, block, along } = spr;
  // the front wings' crests either side of the lower lid
  block(along(0.67), mid - 10, along(0.24), 1, light);
  block(along(0.67), mid + 10, along(0.24), 1, dark);
  // the radiator's vent in the lid, ahead of the windscreen, louvred
  block(along(0.70), mid - 6, along(0.09), 13, outline);
  block(along(0.71), mid - 5, along(0.07), 11, INK);
  for (let x = along(0.71) + 1; x < along(0.78); x += 2) block(x, mid - 5, 1, 11, MESH);
  // the louvres on top of the front wings, over the wheels
  for (const y of [3, wid - 6]) {
    block(axleX - 4, y, 9, 3, INK);
    for (let x = axleX - 3; x < axleX + 5; x += 2) block(x, y, 1, 3, MESH);
  }
  // the OVAL LAMPS on the wings' front, ringed in the third colour
  for (const y of [3, wid - 9]) {
    block(len - 7, y, 5, 6, third);
    block(len - 6, y + 1, 3, 4, HEAD);
    block(len - 6, y + 1, 1, 1, '#ffffff');
  }
  // the three intakes and the splitter's edge under the nose
  block(len - 2, mid - 4, 2, 9, INK);
  block(len - 3, mid - 3, 1, 7, STEEL);
  block(len, mid - 11, 1, 23, INK);
}

/**
 * The 911 GT3 R's tail: the louvred engine lid, the full-width lamp bar, the diffuser and twin
 * pipes, and the swan-neck wing (the second colour, its edge the third) unless knocked off.
 * @param spr the painting context
 */
function porchTail(spr: SpriteCtx): void {
  const { spec, widthPx: wid, mid, outline, light, trim, third, block, along } = spr;
  // the engine lid's louvres, the lid's shut line
  for (let x = along(0.08); x < along(0.20); x += 2) block(x, mid - 7, 1, 15, '#c9ccd4');
  block(along(0.21), mid - 9, 1, 19, outline);
  // the lamp bar across the tail, the diffuser and twin pipes below it
  block(0, 4, 1, wid - 8, TAIL);
  block(-1, mid - 8, 1, 17, INK);
  block(-1, mid - 3, 1, 2, CHR);
  block(-1, mid + 2, 1, 2, CHR);
  if (spec.noWing) return;
  // the WING: its shadow, the plane (as wide as the body, inside it), endplates, swan necks
  block(2, 2, 6, wid - 4, 'rgba(0,0,0,0.25)');
  block(1, 1, 5, wid - 2, outline);
  block(2, 2, 3, wid - 4, trim);
  block(1, 2, 1, wid - 4, third);
  block(5, 2, 1, wid - 4, light);
  block(1, 0, 5, 2, INK);
  block(1, wid - 2, 5, 2, INK);
  for (const y of [mid - 6, mid + 5]) block(3, y, 6, 2, STEEL);
}

/**
 * PORCH 911 GT3 ARR (Porsche 911 GT3 R, 992): the 911's plan - the rounded nose between the
 * lamps on the front wings, the waist at the doors, the wide rear hips - the narrow glasshouse
 * with its fastback, the radiator vent in the front lid, louvres over the front wheels, the
 * engine lid behind and the swan-neck wing over the tail.
 * @param spr the painting context
 */
function paintPorch(spr: SpriteCtx): void {
  const { spec, lengthPx: len, widthPx: wid, mid, third, block, along } = spr;
  planBody(spr, (x) => mid * porchPlan(x / (len - 1)));
  const axleX = Math.round(len / 2 + spec.lf * SPRITE_PPM);
  porchCabin(spr);
  porchNose(spr, axleX);
  // a side stripe in the third colour along each flank, the mirror caps
  block(along(0.24), 2, along(0.40), 1, third);
  block(along(0.24), wid - 3, along(0.40), 1, third);
  block(along(0.57), mid - Math.round(mid * 0.93) - 1, 2, 2, third);
  block(along(0.57), mid + Math.round(mid * 0.93), 2, 2, third);
  porchTail(spr);
}

/** The new cars' bodies by id (render/carlooks.ts LOOKS takes them). */
export const NEW_LOOKS: [string, { paint: (spr: SpriteCtx) => void; bare?: boolean }][] = [
  ['porch-gt3r', { paint: paintPorch, bare: true }],
];

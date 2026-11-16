// render/newcarlooks.ts - the NEW CARS' bodies from above (src/newcars.ts), nose +x, in the house
// style of render/carlooks.ts (which lists them in LOOKS): a 1 px dark outline, flat paint with a
// light band on the top flank and a dark one on the bottom, black glass, the SECOND colour (trim)
// big and the THIRD as a detail.
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { SPRITE_PPM } from "./shared.ts";
import { CHR, GLASS, HEAD, TAIL, type SpriteCtx } from "./carsprite.ts";

export const INK = '#16181d', STEEL = '#2a2d34', MESH = '#3a3d45', GLASS_HI = '#3d4658';

/**
 * Paints a body from its PLAN: each column's half width, px, from the tail (x 0) to the nose -
 * the outline round it, the paint inside, a light band along the top flank and a dark one along
 * the bottom (as render/carsprite.ts shell paints a box).
 * @param spr the painting context
 * @param halfAt the half width at a column, px (up to the sprite's mid)
 */
export function planBody(spr: SpriteCtx, halfAt: (x: number) => number): void {
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

// the Seven's tub half width, px of its sprite's half: the narrow body between wheels out wide
const SEVEN_TUB = 0.69;

/**
 * The Seven's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the narrow tub (its rear corners rounded), the bonnet narrowing to the nose
 * cone, the cone rounding to its grille.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function sevenPlan(share: number): number {
  if (share < 0.03) return SEVEN_TUB * (0.8 + 0.2 * share / 0.03);
  if (share < 0.52) return SEVEN_TUB;
  if (share < 0.86) return SEVEN_TUB - 0.15 * (share - 0.52) / 0.34;
  const round = (share - 0.86) / 0.14;
  return (SEVEN_TUB - 0.15) * Math.sqrt(1 - 0.6 * round * round);
}

/**
 * A Seven's wing over one wheel: a cycle wing at the front, a clamshell at the back that meets
 * the tub - the second colour, outlined, its top edge lit.
 * @param spr the painting context
 * @param fromX its back edge, px from the tail
 * @param untilX its front edge
 * @param side -1 the top side, 1 the bottom
 * @param toTub whether it reaches in to the tub (the rear clamshells)
 */
function sevenWing(spr: SpriteCtx, fromX: number, untilX: number, side: number,
  toTub: boolean): void {
  const { widthPx: wid, mid, outline, light, roof2, block } = spr;
  const tub = Math.round(mid * SEVEN_TUB), outer = side < 0 ? -2 : wid + 1;
  const inner = toTub ? (side < 0 ? mid - tub : mid + tub) : (side < 0 ? 3 : wid - 4);
  const top = Math.min(outer, inner), across = Math.abs(outer - inner) + 1;
  block(fromX, top, untilX - fromX, across, outline);
  block(fromX + 1, top + 1, untilX - fromX - 2, across - 2, roof2);
  block(fromX + 1, top + 1, untilX - fromX - 2, 1, light);
}

/**
 * The Seven's open cockpit: the dark well, two seats either side of the tunnel, the driver's
 * helmet on the right, the roll bar behind, the little windscreen and its mirrors ahead.
 * @param spr the painting context
 */
function sevenCockpit(spr: SpriteCtx): void {
  const { mid, paint, block, along } = spr;
  const tub = Math.round(mid * SEVEN_TUB) - 2, from = along(0.27), until = along(0.50);
  block(from, mid - tub, until - from, tub * 2 + 1, '#1c1e24');
  block(from + 1, mid - tub + 1, along(0.12), tub - 2, STEEL);
  block(from + 1, mid + 2, along(0.12), tub - 2, STEEL);
  block(from, mid, until - from, 1, paint);
  block(from + 3, mid + 3, 3, 3, '#e4c23a');
  // the roll bar across the tub behind the seats
  block(along(0.24), mid - tub - 1, 2, tub * 2 + 3, STEEL);
  block(along(0.24), mid - tub - 1, 1, tub * 2 + 3, '#6a6f78');
  // the windscreen in its frame, a mirror on each end
  block(until, mid - tub - 1, 2, tub * 2 + 3, INK);
  block(until, mid - tub, 1, tub * 2 + 1, GLASS_HI);
  block(until, mid - tub - 3, 2, 2, CHR);
  block(until, mid + tub + 2, 2, 2, CHR);
}

/**
 * CATERPILLAR SEVEN (Caterham Seven 420R): the narrow aluminium tub, the long louvred bonnet
 * to the nose cone (the second colour) and its grille, round lamps on stalks beside it, cycle
 * wings over the front wheels and clamshells over the rear ones, the open cockpit with its roll
 * bar and little screen, the side exhaust down the right, a stripe (the third colour).
 * @param spr the painting context
 */
function paintSeven(spr: SpriteCtx): void {
  const { spec, lengthPx: len, widthPx: wid, mid, outline, third, roof2, block, along } = spr;
  planBody(spr, (x) => mid * sevenPlan(x / (len - 1)));
  const axF = Math.round(len / 2 + spec.lf * SPRITE_PPM),
    axR = Math.round(len / 2 - spec.lr * SPRITE_PPM);
  // the nose cone, its grille; the stripe down the bonnet and cone
  const cone = along(0.86);
  for (let x = cone; x < len - 1; x++) {
    const half = Math.round(mid * sevenPlan(x / (len - 1))) - 1;
    block(x, mid - half, 1, half * 2 + 1, roof2);
  }
  block(cone, mid - 6, 1, 13, outline);
  block(len - 2, mid - 3, 2, 7, INK);
  block(len - 2, mid - 2, 1, 5, MESH);
  block(along(0.52), mid - 1, cone - along(0.52), 2, third);
  // the bonnet's louvres, its shut line at the scuttle
  for (let x = along(0.60); x < along(0.82); x += 2) {
    block(x, mid - 6, 1, 2, INK);
    block(x, mid + 5, 1, 2, INK);
  }
  sevenCockpit(spr);
  // the rear clamshells and the front cycle wings (the wheel turns under its wing)
  for (const side of [-1, 1]) {
    sevenWing(spr, axR - 6, axR + 6, side, true);
    sevenWing(spr, axF - 4, axF + 3, side, false);
  }
  // round lamps on their stalks beside the nose cone
  for (const y of [3, wid - 6]) {
    block(axF + 1, y, 3, 3, outline);
    block(axF + 2, y + 1, 1, 1, HEAD);
  }
  // the side exhaust down the right flank, its end ahead of the rear wing
  block(axR + 7, wid - 4, along(0.62) - axR - 7, 2, CHR);
  block(axR + 6, wid - 4, 1, 2, INK);
  // the tail lamps on the clamshells' backs, the filler cap
  block(axR - 6, 0, 1, 2, TAIL);
  block(axR - 6, wid - 2, 1, 2, TAIL);
  block(along(0.10), mid - 5, 2, 2, CHR);
}

/**
 * The Transit's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the boxy load area to the cab, the short bonnet rounding at its corners.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function transfitPlan(share: number): number {
  if (share < 0.01) return 0.95;
  if (share < 0.80) return 1;
  if (share < 0.95) return 1 - 0.05 * (share - 0.80) / 0.15;
  const round = (share - 0.95) / 0.05;
  return 0.95 * Math.sqrt(1 - 0.35 * round * round);
}

// m: the L2 Transit's length, the cab's shares below are of it; a longer or shorter Transit keeps
// the same cab (measured from the nose) and its box changes (transfitCabShare)
const TRANSFIT_LEN_M = 5.531;

/**
 * A share of the L2 Transit's length counted from its nose, on this Transit's length: the cab and
 * bonnet are the same on every wheelbase.
 * @param spr the painting context
 * @param share the share on the L2 (0 tail, 1 nose)
 * @returns the share on this one
 */
function transfitCabShare(spr: SpriteCtx, share: number): number {
  return 1 - (1 - share) * TRANSFIT_LEN_M / spr.spec.len;
}

/**
 * The Transit's cab from above: the raked windscreen, the side glass, the van mirrors on their
 * arms (the second colour), the short bonnet's creases.
 * @param spr the painting context
 */
function transfitCab(spr: SpriteCtx): void {
  const { widthPx: wid, mid, light, dark, trim, block, along } = spr;
  const cab = (share: number) => along(transfitCabShare(spr, share));
  const screenFrom = cab(0.735), screenTo = cab(0.80);
  for (let x = screenFrom; x < screenTo; x++) {
    const inset = 3 + Math.round((screenTo - x) * 0.25);
    block(x, inset, 1, wid - inset * 2, GLASS);
  }
  block(screenFrom + 1, 5, 1, wid - 10, GLASS_HI);
  block(cab(0.64), 1, screenFrom - cab(0.64), 1, GLASS);
  block(cab(0.64), wid - 2, screenFrom - cab(0.64), 1, GLASS);
  for (const y of [-3, wid]) block(screenFrom + 1, y, 3, 3, trim);
  block(cab(0.82), mid - 9, along(0.13 * TRANSFIT_LEN_M / spr.spec.len), 1, light);
  block(cab(0.82), mid + 9, along(0.13 * TRANSFIT_LEN_M / spr.spec.len), 1, dark);
}

/**
 * FJORD TRANSFIT (Ford Transit Mk8, L2 H2): the long box - the roof with its cross ribs, a sliding
 * door's rail on the left - the cab's raked screen and van mirrors, the short bonnet, the grille
 * with its blue badge (the third colour), swept lamps, black bumpers (the second colour), the
 * tall rear lamps and the high brake light.
 * @param spr the painting context
 */
function paintTransfit(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, paint, trim, third, block, along } = spr;
  planBody(spr, (x) => mid * transfitPlan(x / (len - 1)));
  // the roof over the load area and cab, its cross ribs, the rear header
  const roofTo = along(transfitCabShare(spr, 0.735)), rib = shade(paint, 0.86);
  block(2, 3, roofTo - 2, wid - 6, paint);
  for (let x = along(0.05); x < along(transfitCabShare(spr, 0.70)); x += 6) {
    block(x, 4, 1, wid - 8, rib);
  }
  block(2, 3, 1, wid - 6, rib);
  // the sliding door's rail on the left flank
  block(along(0.40), 1, along(0.22), 1, INK);
  transfitCab(spr);
  // the grille, its badge, the swept lamps, the bumpers
  block(len - 2, mid - 7, 2, 15, INK);
  for (let y = mid - 6; y <= mid + 6; y += 3) block(len - 2, y, 1, 1, CHR);
  block(len - 3, mid - 1, 2, 3, third);
  for (const y of [2, wid - 6]) {
    block(len - 5, y, 3, 4, HEAD);
    block(len - 7, y + (y < mid ? 1 : 0), 2, 3, HEAD);
  }
  block(len, 3, 1, wid - 6, trim);
  block(-1, 2, 1, wid - 4, trim);
  // the tall rear lamps on the back pillars, the high brake light
  block(0, 1, 1, 4, TAIL);
  block(0, wid - 5, 1, 4, TAIL);
  block(1, mid - 2, 1, 5, TAIL);
  block(-1, 4, 1, 2, CHR);
}

/**
 * How far inside a span a share is, ramping over its edges: 0 outside, 1 well inside.
 * @param share along the car, 0..1
 * @param from the span's start
 * @param until its end
 * @param ramp the share over which it ramps in and out
 * @returns 0..1
 */
export function inside(share: number, from: number, until: number, ramp: number): number {
  return Math.max(0, Math.min(1, (share - from) / ramp, (until - share) / ramp));
}

/**
 * The trophy truck's plan, a half width at a share of its length (0 tail, 1 nose), as a share of
 * the sprite's half: the body, the big fenders over the wheels, the rounded nose.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function trophyPlan(share: number): number {
  const fender = Math.max(inside(share, 0.06, 0.38, 0.04), inside(share, 0.62, 0.94, 0.04));
  const nose = share > 0.95 ? Math.sqrt(1 - 0.5 * ((share - 0.95) / 0.05) ** 2) : 1;
  return (0.8 + 0.2 * fender) * nose;
}

/**
 * The trophy truck's bed: the dark floor, the two spare tyres behind the cab, the radiators' two
 * fans at the back, the cage's tubes down both sides.
 * @param spr the painting context
 */
function trophyBed(spr: SpriteCtx): void {
  const { mid, block, along } = spr;
  const half = Math.round(mid * 0.7), from = along(0.03), until = along(0.36);
  block(from, mid - half, until - from, half * 2 + 1, '#1c1e24');
  // the spares, lying flat side by side
  const tyre = Math.round(half * 0.9);
  for (const centre of [mid - Math.round(half / 2), mid + Math.round(half / 2)]) {
    block(along(0.26) - tyre / 2, centre - tyre / 2 + 1, tyre, tyre - 2, INK);
    block(along(0.26) - tyre / 2 + 1, centre - tyre / 2, tyre - 2, tyre, INK);
    block(along(0.26) - 2, centre - 2, 4, 4, STEEL);
  }
  // the radiators across the back with their two fans
  block(from + 1, mid - half + 1, along(0.12), half * 2 - 1, MESH);
  for (const centre of [mid - Math.round(half / 2), mid + Math.round(half / 2)]) {
    block(from + 2, centre - 3, along(0.10) - 1, 7, '#6a6f78');
    block(from + 4, centre - 1, along(0.06) - 2, 3, INK);
  }
  // the cage's tubes along the bed's sides and across its back
  block(from, mid - half, until - from, 1, CHR);
  block(from, mid + half, until - from, 1, CHR);
  block(from, mid - half, 1, half * 2 + 1, CHR);
}

/**
 * FJORD EFFING-150 TROPHY TRUCK (a Ford F-150 trophy truck): big fenders over the long-travel
 * wheels, the long bonnet with its vents and scoop, the cab with its roof scoop (the second
 * colour), the open bed with two spares, the radiators' fans and the cage, the tube bumper with
 * its light bar, an orange line (the third colour).
 * @param spr the painting context
 */
function paintTrophy(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, outline, light, trim, third, roof2, block,
    along } = spr;
  planBody(spr, (x) => mid * trophyPlan(x / (len - 1)));
  trophyBed(spr);
  // the cab: rear glass, the roof (the second colour) with its scoop, the raked windscreen
  const cabHalf = Math.round(mid * 0.68);
  block(along(0.37), mid - cabHalf, along(0.02), cabHalf * 2 + 1, GLASS);
  block(along(0.39), mid - cabHalf, along(0.17), cabHalf * 2 + 1, roof2);
  block(along(0.39), mid - cabHalf, along(0.17), 1, light);
  block(along(0.52), mid - 3, along(0.04), 7, INK);
  block(along(0.53), mid - 2, along(0.02), 5, MESH);
  for (let x = along(0.56); x < along(0.61); x++) {
    const rake = Math.round((x - along(0.56)) * 0.3);
    block(x, mid - cabHalf - 1 + rake, 1, (cabHalf + 1 - rake) * 2 + 1, GLASS);
  }
  block(along(0.57), mid - cabHalf + 1, 1, cabHalf * 2 - 1, GLASS_HI);
  // the bonnet: its band (the second colour), vents, the line along the body (the third)
  block(along(0.62), mid - 4, along(0.32), 9, trim);
  block(along(0.80), mid - 2, along(0.08), 5, INK);
  for (const y of [mid - 11, mid + 9]) block(along(0.66), y, along(0.10), 3, INK);
  block(along(0.04), mid - Math.round(mid * 0.8) + 2, along(0.88), 1, third);
  block(along(0.04), mid + Math.round(mid * 0.8) - 2, along(0.88), 1, third);
  // the tube bumper and its light bar, the lamps; the tail lamps
  block(len - 1, 4, 2, wid - 8, outline);
  for (let y = 6; y < wid - 6; y += 4) block(len - 3, y, 2, 2, HEAD);
  block(1, mid - 8, 1, 4, TAIL);
  block(1, mid + 5, 1, 4, TAIL);
}

/**
 * The Civic BTCC's plan, a half width at a share of its length (0 tail, 1 nose), as a share of
 * the sprite's half: the squared tail, the wide arches over both axles (NGTC's 1,875 mm) with the
 * narrower doors between, the nose tapering to its corners.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function civvicPlan(share: number): number {
  const arch = Math.max(inside(share, 0.04, 0.28, 0.04), inside(share, 0.63, 0.87, 0.04));
  const tail = share < 0.03 ? 0.85 + 0.15 * Math.sqrt(share / 0.03) : 1;
  const nose = share > 0.9 ? Math.sqrt(1 - 0.55 * ((share - 0.9) / 0.1) ** 2) : 1;
  return (0.92 + 0.08 * arch) * tail * nose;
}

/**
 * The Civic BTCC's glasshouse: the long sloping hatch glass narrowing to the tail, the roof (the
 * second colour), the side glass, the raked windscreen, the mirrors (the third colour).
 * @param spr the painting context
 */
function civvicCabin(spr: SpriteCtx): void {
  const { mid, roof2, light, third, block, along } = spr;
  const rearFrom = along(0.16), roofFrom = along(0.29), roofTo = along(0.55),
    screenTo = along(0.65), cabinHalf = Math.round(mid * 0.72);
  for (let x = rearFrom; x < roofFrom; x++) {
    const half = Math.round(cabinHalf - 3 * (roofFrom - x) / (roofFrom - rearFrom));
    block(x, mid - half, 1, half * 2 + 1, GLASS);
  }
  block(rearFrom + 3, mid - cabinHalf + 4, 1, cabinHalf * 2 - 7, GLASS_HI);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, cabinHalf * 2 + 1, roof2);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, 1, light);
  block(roofFrom + 1, mid - cabinHalf - 1, roofTo - roofFrom - 2, 1, GLASS);
  block(roofFrom + 1, mid + cabinHalf + 1, roofTo - roofFrom - 2, 1, GLASS);
  for (let x = roofTo; x < screenTo; x++) {
    const half = Math.round(cabinHalf + 1 + 2 * (x - roofTo) / (screenTo - roofTo));
    const rake = Math.round((x - roofTo) * 0.3);
    block(x, mid - half + rake, 1, (half - rake) * 2 + 1, GLASS);
  }
  block(roofTo + 1, mid - cabinHalf + 1, 1, cabinHalf * 2 - 1, GLASS_HI);
  // the mirrors on their stalks at the screen's base
  block(screenTo - 2, mid - cabinHalf - 4, 2, 2, third);
  block(screenTo - 2, mid + cabinHalf + 3, 2, 2, third);
}

/**
 * The Civic BTCC's nose: the bonnet's centre scoop, the vents over the front wheels, the swept
 * lamps at the corners, the grille and intakes, the splitter (the third colour) ahead.
 * @param spr the painting context
 * @param axleX the front axle, px from the tail
 */
function civvicNose(spr: SpriteCtx, axleX: number): void {
  const { lengthPx: len, widthPx: wid, mid, light, dark, third, block, along } = spr;
  // the bonnet's creases and the scoop on its centre line
  block(along(0.67), mid - 8, along(0.24), 1, light);
  block(along(0.67), mid + 8, along(0.24), 1, dark);
  block(along(0.74), mid - 3, along(0.07), 7, INK);
  block(along(0.75), mid - 2, along(0.05), 5, MESH);
  // the extraction vents on top of the front wings, behind the wheels' centres
  for (const y of [3, wid - 6]) {
    block(axleX - 6, y, 7, 3, INK);
    for (let x = axleX - 5; x < axleX + 1; x += 2) block(x, y, 1, 3, MESH);
  }
  // the swept lamps on the nose's corners
  for (const y of [3, wid - 6]) {
    block(len - 6, y, 4, 3, HEAD);
    block(len - 5, y + (y < mid ? 1 : 0), 1, 2, '#ffffff');
  }
  // the grille, the corner intakes and the splitter's lip under the nose
  block(len - 2, mid - 6, 2, 13, INK);
  block(len - 2, mid - 5, 1, 11, MESH);
  block(len - 2, 5, 1, 3, INK);
  block(len - 2, wid - 8, 1, 3, INK);
  block(len, 2, 1, wid - 4, third);
}

/**
 * The Civic BTCC's tail: the corner lamps, the side exit ahead of the left rear wheel, and the
 * wing across the tailgate (the third colour) unless knocked off.
 * @param spr the painting context
 */
function civvicTail(spr: SpriteCtx): void {
  const { spec, widthPx: wid, mid, outline, light, third, block, along } = spr;
  for (const y of [1, wid - 5]) block(0, y, 2, 4, TAIL);
  block(-1, mid - 6, 1, 13, INK);
  block(along(0.27), 0, 3, 2, CHR);
  block(along(0.27) + 1, 0, 1, 1, INK);
  if (spec.noWing) return;
  // the WING: its shadow, the plane across the tail, the endplates, the two stands
  block(3, 2, 5, wid - 4, 'rgba(0,0,0,0.25)');
  block(1, 1, 5, wid - 2, outline);
  block(2, 2, 3, wid - 4, third);
  block(4, 2, 1, wid - 4, light);
  block(1, 0, 5, 2, INK);
  block(1, wid - 2, 5, 2, INK);
  for (const y of [mid - 7, mid + 6]) block(5, y, 4, 2, STEEL);
}

/**
 * HONDER CIVVIC TYPE ARR BTCC (Honda Civic Type R FK8, an NGTC touring car): the five-door
 * hatch's plan on wide arches, the long sloping hatch glass, the roof (the second colour), the
 * raked screen, the bonnet's scoop and wing vents, swept lamps, the splitter, the wing across the
 * tailgate and the side exit (the third colour the details).
 * @param spr the painting context
 */
function paintCivvic(spr: SpriteCtx): void {
  const { spec, lengthPx: len, mid, block, along } = spr;
  planBody(spr, (x) => mid * civvicPlan(x / (len - 1)));
  const axleX = Math.round(len / 2 + spec.lf * SPRITE_PPM);
  civvicCabin(spr);
  civvicNose(spr, axleX);
  // the doors' shut lines along both flanks
  for (const share of [0.43, 0.58]) block(along(share), 2, 1, 2, INK);
  for (const share of [0.43, 0.58]) block(along(share), spr.widthPx - 4, 1, 2, INK);
  civvicTail(spr);
}

/** The new cars' bodies by id (render/carlooks.ts LOOKS takes them). */
export const NEW_LOOKS: [string, { paint: (spr: SpriteCtx) => void; bare?: boolean }][] = [
  ['porch-gt3r', { paint: paintPorch, bare: true }],
  ['seven-420r', { paint: paintSeven, bare: true }],
  ['transfit-van', { paint: paintTransfit, bare: true }],
  ['transfit-lwb', { paint: paintTransfit, bare: true }],
  ['effing-tt', { paint: paintTrophy, bare: true }],
  ['civvic-btcc', { paint: paintCivvic, bare: true }],
];

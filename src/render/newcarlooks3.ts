// render/newcarlooks3.ts - the NEW CARS' bodies from above, from the Corolla on (src/newcars.ts;
// render/newcarlooks.ts holds the house style's helpers): nose +x, a 1 px dark outline, flat
// paint with a light band on the top flank and a dark one on the bottom, black glass, the SECOND
// colour (trim) big, the THIRD a detail - and shaded the TS010's way (render/newcarlooks2.ts
// SHINE / SHADE / SHADE_SOFT: a light line along each crest, a soft one down its slope).
import { CHR, GLASS, HEAD, TAIL, type SpriteCtx } from "./carsprite.ts";
import { GLASS_HI, INK, MESH, STEEL, inside, planBody } from "./newcarlooks.ts";
import { SHADE, SHADE_SOFT, SHINE } from "./newcarlooks2.ts";

/**
 * The Corolla BTCC's plan, a half width at a share of its length (0 tail, 1 nose), as a share of
 * the sprite's half: the rounded tail, NGTC's wide arches over both axles with the narrower doors
 * between, the nose tapering to its sharp corners.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function corollaPlan(share: number): number {
  const arch = Math.max(inside(share, 0.05, 0.29, 0.04), inside(share, 0.64, 0.88, 0.04));
  const tail = share < 0.04 ? 0.8 + 0.2 * Math.sqrt(share / 0.04) : 1;
  const nose = share > 0.9 ? Math.sqrt(1 - 0.6 * ((share - 0.9) / 0.1) ** 2) : 1;
  return (0.91 + 0.09 * arch) * tail * nose;
}

/**
 * The Corolla BTCC's glasshouse: the short steep hatch glass, the low roof (the second colour,
 * Gazoo red) lit along its edge, the side glass, the raked windscreen, the mirrors (the third
 * colour).
 * @param spr the painting context
 */
function corollaCabin(spr: SpriteCtx): void {
  const { mid, roof2, third, block, along } = spr;
  const rearFrom = along(0.12), roofFrom = along(0.22), roofTo = along(0.55),
    screenTo = along(0.65), cabinHalf = Math.round(mid * 0.72);
  for (let x = rearFrom; x < roofFrom; x++) {
    const half = Math.round(cabinHalf - 3 * (roofFrom - x) / (roofFrom - rearFrom));
    block(x, mid - half, 1, half * 2 + 1, GLASS);
  }
  block(rearFrom + 2, mid - cabinHalf + 4, 1, cabinHalf * 2 - 7, GLASS_HI);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, cabinHalf * 2 + 1, roof2);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, 1, SHINE);
  block(roofFrom, mid + cabinHalf, roofTo - roofFrom, 1, SHADE_SOFT);
  block(roofFrom + 1, mid - cabinHalf - 1, roofTo - roofFrom - 2, 1, GLASS);
  block(roofFrom + 1, mid + cabinHalf + 1, roofTo - roofFrom - 2, 1, GLASS);
  for (let x = roofTo; x < screenTo; x++) {
    const half = Math.round(cabinHalf + 1 + 2 * (x - roofTo) / (screenTo - roofTo));
    const rake = Math.round((x - roofTo) * 0.3);
    block(x, mid - half + rake, 1, (half - rake) * 2 + 1, GLASS);
  }
  block(roofTo + 1, mid - cabinHalf + 1, 1, cabinHalf * 2 - 1, GLASS_HI);
  block(screenTo - 2, mid - cabinHalf - 4, 2, 2, third);
  block(screenTo - 2, mid + cabinHalf + 3, 2, 2, third);
}

/**
 * The Corolla BTCC's shape in shading and its Gazoo stripes: each arch's crest lit and its inner
 * slope soft, the bonnet's two creases, the red and black Gazoo bands slanting across the bonnet
 * and the flanks.
 * @param spr the painting context
 */
function corollaBody(spr: SpriteCtx): void {
  const { widthPx: wid, mid, trim, block, along } = spr;
  for (const [from, until] of [[0.05, 0.29], [0.64, 0.88]]) {
    block(along(from) + 1, 2, along(until - from) - 2, 1, SHINE);
    block(along(from) + 1, wid - 3, along(until - from) - 2, 1, SHADE);
    block(along(from) + 2, 4, along(until - from) - 4, 1, SHADE_SOFT);
    block(along(from) + 2, wid - 5, along(until - from) - 4, 1, SHADE_SOFT);
  }
  block(along(0.29), 2, along(0.35), 1, SHADE_SOFT);
  for (const y of [mid - 7, mid + 6]) {
    block(along(0.68), y, along(0.22), 1, SHINE);
    block(along(0.68), y + 1, along(0.22), 1, SHADE_SOFT);
  }
  // (the Gazoo bands: a red one and a black one slanting back over the bonnet's shoulders)
  for (let i = 0; i < 6; i++) {
    block(along(0.7) + i * 2, 2 + i, 2, 1, trim);
    block(along(0.7) + i * 2, wid - 3 - i, 2, 1, trim);
    block(along(0.66) + i * 2, 2 + i, 2, 1, INK);
    block(along(0.66) + i * 2, wid - 3 - i, 2, 1, INK);
  }
}

/**
 * The Corolla BTCC's nose: the sharp swept lamps, the big trapezoid lower grille, the corner
 * intakes, the splitter (the third colour); the vents over the front wheels.
 * @param spr the painting context
 */
function corollaNose(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, third, block, along } = spr;
  for (const y of [3, wid - 5]) {
    block(len - 8, y, 6, 2, HEAD);
    block(len - 3, y + (y < mid ? 1 : -1), 2, 2, HEAD);
  }
  block(len - 3, mid - 7, 3, 15, INK);
  block(len - 2, mid - 6, 1, 13, MESH);
  block(len - 2, 4, 1, 3, INK);
  block(len - 2, wid - 7, 1, 3, INK);
  block(len, 2, 1, wid - 4, third);
  for (const y of [3, wid - 6]) {
    block(along(0.6), y, along(0.05), 3, INK);
    for (let x = along(0.6) + 1; x < along(0.65); x += 2) block(x, y, 1, 3, MESH);
  }
}

/**
 * The Corolla BTCC's tail: the slim lamps across its corners, the side exit ahead of the left rear
 * wheel, the wing on the hatch (the third colour) with its shadow unless knocked off.
 * @param spr the painting context
 */
function corollaTail(spr: SpriteCtx): void {
  const { spec, widthPx: wid, mid, outline, light, third, block, along } = spr;
  for (const y of [1, wid - 6]) block(0, y, 2, 5, TAIL);
  block(-1, mid - 6, 1, 13, INK);
  block(along(0.27), 0, 3, 2, CHR);
  if (spec.noWing) return;
  block(3, 2, 5, wid - 4, SHADE);
  block(1, 1, 5, wid - 2, outline);
  block(2, 2, 3, wid - 4, third);
  block(4, 2, 1, wid - 4, light);
  block(1, 0, 5, 2, INK);
  block(1, wid - 2, 5, 2, INK);
  for (const y of [mid - 7, mid + 6]) block(5, y, 4, 2, STEEL);
}

/**
 * TOYOTER COROLLA BTCC (Toyota Corolla GR Sport, E210 hatch, an NGTC touring car): the hatch on
 * NGTC's wide arches, the low red roof, the short steep hatch glass, the Gazoo bands, the sharp
 * lamps and big lower grille, the splitter, the wing on the hatch; shaded the TS010's way.
 * @param spr the painting context
 */
function paintCorolla(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, block, along } = spr;
  planBody(spr, (x) => mid * corollaPlan(x / (len - 1)));
  corollaBody(spr);
  corollaCabin(spr);
  corollaNose(spr);
  for (const share of [0.44, 0.6]) {
    block(along(share), 2, 1, 2, INK);
    block(along(share), wid - 4, 1, 2, INK);
  }
  corollaTail(spr);
}


/**
 * The R13's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the four fender pods over the wheels (the front pair to the nose's corners), the
 * waist between them at the sidepods' inlets, the long tail narrowing under the wing.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function r13Plan(share: number): number {
  const pods = Math.max(inside(share, 0.08, 0.34, 0.06), inside(share, 0.68, 0.97, 0.05));
  const tail = share < 0.06 ? 0.72 + 0.28 * Math.sqrt(share / 0.06) : 1;
  const nose = share > 0.95 ? Math.sqrt(1 - 0.5 * ((share - 0.95) / 0.05) ** 2) : 1;
  return (0.84 + 0.16 * pods) * tail * nose;
}

/**
 * The R13's body in shading: each fender pod lit along its crest and soft down its slope, the
 * valleys between the pods and the tub in shadow with the sidepods' inlets in them, the raised
 * nose between the front pods lit along its spine, the splitter's lip and the slim lamps.
 * @param spr the painting context
 */
function r13Body(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, third, block, along } = spr;
  const pod = Math.round(mid * 0.4);
  for (const [from, until] of [[0.07, 0.35], [0.67, 0.99]]) {
    const startX = along(from), wide = along(until - from);
    block(startX + 2, 2, wide - 4, 1, SHINE);
    block(startX + 1, pod - 1, wide - 2, 1, SHADE_SOFT);
    block(startX + 2, wid - 3, wide - 4, 1, SHADE);
    block(startX + 1, wid - pod, wide - 2, 1, SHADE_SOFT);
  }
  for (const y of [pod, wid - pod - 2]) {
    block(along(0.36), y, along(0.3), 2, SHADE);
    block(along(0.46), y, along(0.1), 2, INK);
  }
  // the raised nose between the front pods: its spine lit, its sides soft
  block(along(0.7), mid - 1, along(0.27), 1, SHINE);
  for (const y of [mid - 4, mid + 4]) block(along(0.7), y, along(0.27), 1, SHADE_SOFT);
  block(len, pod - 1, 1, wid - pod * 2 + 2, third);
  for (const y of [2, wid - 5]) block(len - 6, y, 5, 2, HEAD);
}

/**
 * The R13's cockpit and fin: the closed canopy (its roof the second colour) with the screen
 * ahead, the shark fin (the second colour) from the roof along the engine cover to the wing, the
 * engine cover's louvres either side of it.
 * @param spr the painting context
 */
function r13Cockpit(spr: SpriteCtx): void {
  const { mid, roof2, block, along } = spr;
  const half = Math.round(mid * 0.32), canopyFrom = along(0.46), canopyTo = along(0.68);
  for (let x = canopyFrom; x < canopyTo; x++) {
    const share = (x - canopyFrom) / (canopyTo - canopyFrom);
    const across = Math.max(1, Math.round(half * Math.sin(Math.PI * Math.min(1, 0.15 + share))));
    block(x, mid - across, 1, across * 2 + 1, share > 0.6 ? GLASS : roof2);
  }
  block(along(0.48), mid - half + 2, along(0.1), 1, SHINE);
  block(along(0.63), mid - 2, 1, 4, GLASS_HI);
  block(canopyFrom, mid + half - 1, along(0.12), 1, SHADE);
  // the shark fin, a 2 px blade down the middle with its shadow to one side
  block(along(0.06), mid - 1, canopyFrom - along(0.06), 2, roof2);
  block(along(0.06), mid + 1, canopyFrom - along(0.06), 1, SHADE);
  for (let x = along(0.18); x < along(0.34); x += 2) {
    block(x, mid - 5, 1, 3, INK);
    block(x, mid + 3, 1, 3, INK);
  }
}

/**
 * REBELION R13 (Rebellion R13, the 2018-20 non-hybrid LMP1): the closed prototype's four fender
 * pods, the narrow canopy and the shark fin to the wing, the raised nose, the long tail, the wing
 * on its pylon overhanging it with its shadow; shaded the TS010's way.
 * @param spr the painting context
 */
function paintR13(spr: SpriteCtx): void {
  const { spec, lengthPx: len, widthPx: wid, mid, outline, light, third, block } = spr;
  planBody(spr, (x) => mid * r13Plan(x / (len - 1)));
  r13Body(spr);
  r13Cockpit(spr);
  for (const y of [3, wid - 5]) block(0, y, 1, 2, TAIL);
  block(-1, mid - 2, 1, 4, CHR);
  if (spec.noWing) return;
  block(1, 1, 5, wid - 2, SHADE);
  block(-2, 1, 4, wid - 2, outline);
  block(-1, 2, 2, wid - 4, third);
  block(1, 2, 1, wid - 4, light);
  block(-2, 1, 5, 1, INK);
  block(-2, wid - 2, 5, 1, INK);
  block(2, mid - 1, 4, 2, STEEL);
}


/**
 * The Ibiza's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the rounded tail, the hips over the rear wheels and the wings over the front,
 * the waist at the doors, the nose tapering to its corners.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function ibizaPlan(share: number): number {
  const arch = Math.max(inside(share, 0.05, 0.28, 0.06), inside(share, 0.64, 0.86, 0.06));
  const tail = share < 0.04 ? 0.8 + 0.2 * Math.sqrt(share / 0.04) : 1;
  const nose = share > 0.88 ? Math.sqrt(1 - 0.62 * ((share - 0.88) / 0.12) ** 2) : 1;
  return (0.94 + 0.06 * arch) * tail * nose;
}

/**
 * The Ibiza's glasshouse: the short tailgate glass under its little spoiler, the roof (the second
 * colour) lit along its edge, the side glass, the raked windscreen, the mirrors (the third
 * colour).
 * @param spr the painting context
 */
function ibizaCabin(spr: SpriteCtx): void {
  const { mid, roof2, third, block, along } = spr;
  const rearFrom = along(0.05), roofFrom = along(0.12), roofTo = along(0.56),
    screenTo = along(0.67), cabinHalf = Math.round(mid * 0.73);
  for (let x = rearFrom; x < roofFrom; x++) {
    const half = Math.round(cabinHalf - 3 * (roofFrom - x) / (roofFrom - rearFrom));
    block(x, mid - half, 1, half * 2 + 1, GLASS);
  }
  block(rearFrom - 1, mid - cabinHalf, 1, cabinHalf * 2 + 1, roof2);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, cabinHalf * 2 + 1, roof2);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, 1, SHINE);
  block(roofFrom, mid + cabinHalf, roofTo - roofFrom, 1, SHADE_SOFT);
  block(roofFrom + 1, mid - cabinHalf - 1, roofTo - roofFrom - 2, 1, GLASS);
  block(roofFrom + 1, mid + cabinHalf + 1, roofTo - roofFrom - 2, 1, GLASS);
  for (let x = roofTo; x < screenTo; x++) {
    const half = Math.round(cabinHalf + 1 + 2 * (x - roofTo) / (screenTo - roofTo));
    const rake = Math.round((x - roofTo) * 0.3);
    block(x, mid - half + rake, 1, (half - rake) * 2 + 1, GLASS);
  }
  block(roofTo + 1, mid - cabinHalf + 1, 1, cabinHalf * 2 - 1, GLASS_HI);
  block(screenTo - 2, mid - cabinHalf - 4, 2, 2, third);
  block(screenTo - 2, mid + cabinHalf + 3, 2, 2, third);
}

/**
 * SEAT IBEEFA (Seat Ibiza Mk4, 6J, 2008-17, the 1.4 five-door): the hatch's plan, its sharp
 * shoulder line lit along the flanks, the short tailgate glass, the roof, the raked screen, the
 * bonnet's two creases running to the narrow grille with its badge, the swept lamps, the doors'
 * shut lines, the tail lamps at the corners; shaded the TS010's way.
 * @param spr the painting context
 */
function paintIbiza(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, third, block, along } = spr;
  planBody(spr, (x) => mid * ibizaPlan(x / (len - 1)));
  // the shoulder line and the slope under it, the arches' crests
  block(along(0.04), 3, along(0.9), 1, SHINE);
  block(along(0.04), wid - 4, along(0.9), 1, SHADE);
  for (const [from, until] of [[0.05, 0.28], [0.64, 0.86]])
    block(along(from) + 1, wid - 3, along(until - from) - 2, 1, SHADE_SOFT);
  ibizaCabin(spr);
  for (const y of [mid - 6, mid + 5]) {
    block(along(0.7), y, along(0.22), 1, SHINE);
    block(along(0.7), y + 1, along(0.22), 1, SHADE_SOFT);
  }
  for (const y of [3, wid - 5]) {
    block(len - 7, y, 5, 2, HEAD);
    block(len - 4, y + (y < mid ? 1 : -1), 2, 2, HEAD);
  }
  block(len - 2, mid - 4, 2, 9, INK);
  block(len - 2, mid - 1, 1, 3, third);
  block(len - 1, 4, 1, wid - 8, INK);
  for (const share of [0.42, 0.58]) {
    block(along(share), 2, 1, 2, INK);
    block(along(share), wid - 4, 1, 2, INK);
  }
  for (const y of [2, wid - 6]) block(0, y, 2, 4, TAIL);
  block(-1, 5, 1, 2, CHR);
}


/**
 * The A4 Avant's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the square estate tail, the gentle hips and front wings, the long nose's
 * rounded corners.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function a4Plan(share: number): number {
  const arch = Math.max(inside(share, 0.06, 0.28, 0.06), inside(share, 0.66, 0.88, 0.06));
  const tail = share < 0.025 ? 0.86 + 0.14 * Math.sqrt(share / 0.025) : 1;
  const nose = share > 0.9 ? Math.sqrt(1 - 0.55 * ((share - 0.9) / 0.1) ** 2) : 1;
  return (0.95 + 0.05 * arch) * tail * nose;
}

/**
 * The A4 Avant's glasshouse: the near upright tailgate glass, the long roof (the second colour)
 * to the back with its rails (the third colour) lit along its edge, the side glass, the raked
 * windscreen, the mirrors.
 * @param spr the painting context
 */
function a4Cabin(spr: SpriteCtx): void {
  const { mid, roof2, third, block, along } = spr;
  const rearFrom = along(0.03), roofFrom = along(0.08), roofTo = along(0.58),
    screenTo = along(0.69), cabinHalf = Math.round(mid * 0.76);
  block(rearFrom, mid - cabinHalf + 1, roofFrom - rearFrom, cabinHalf * 2 - 1, GLASS);
  block(rearFrom + 1, mid - cabinHalf + 3, 1, cabinHalf * 2 - 5, GLASS_HI);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, cabinHalf * 2 + 1, roof2);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, 1, SHINE);
  block(roofFrom, mid + cabinHalf, roofTo - roofFrom, 1, SHADE_SOFT);
  for (const y of [mid - cabinHalf + 2, mid + cabinHalf - 2])
    block(roofFrom + 1, y, roofTo - roofFrom - 2, 1, third);
  block(roofFrom + 1, mid - cabinHalf - 1, roofTo - roofFrom - 2, 1, GLASS);
  block(roofFrom + 1, mid + cabinHalf + 1, roofTo - roofFrom - 2, 1, GLASS);
  for (let x = roofTo; x < screenTo; x++) {
    const half = Math.round(cabinHalf + 1 + 2 * (x - roofTo) / (screenTo - roofTo));
    const rake = Math.round((x - roofTo) * 0.3);
    block(x, mid - half + rake, 1, (half - rake) * 2 + 1, GLASS);
  }
  block(roofTo + 1, mid - cabinHalf + 1, 1, cabinHalf * 2 - 1, GLASS_HI);
  block(screenTo - 2, mid - cabinHalf - 4, 2, 2, INK);
  block(screenTo - 2, mid + cabinHalf + 3, 2, 2, INK);
}

/**
 * ORDI A4 AVANT (Audi A4 Avant B8, 2008-15, the 2.0 TDI): the estate's square tail and long roof
 * with its rails, the clamshell bonnet's two creases running to the big single-frame grille with
 * its four rings, the swept lamps with their LED strips, the shoulder line lit along the flanks,
 * the doors' shut lines, the wide tail lamps; shaded the TS010's way.
 * @param spr the painting context
 */
function paintA4(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, block, along } = spr;
  planBody(spr, (x) => mid * a4Plan(x / (len - 1)));
  block(along(0.03), 3, along(0.92), 1, SHINE);
  block(along(0.03), wid - 4, along(0.92), 1, SHADE);
  a4Cabin(spr);
  for (const y of [mid - 7, mid + 6]) {
    block(along(0.71), y, along(0.22), 1, SHINE);
    block(along(0.71), y + 1, along(0.22), 1, SHADE_SOFT);
  }
  for (const y of [3, wid - 5]) {
    block(len - 7, y, 5, 2, HEAD);
    block(len - 6, y + (y < mid ? 2 : -1), 4, 1, '#ffffff');
  }
  block(len - 2, mid - 6, 2, 13, INK);
  block(len - 2, mid - 5, 1, 11, MESH);
  for (let y = mid - 4; y <= mid + 3; y += 2) block(len - 1, y, 1, 2, CHR);
  for (const share of [0.44, 0.6]) {
    block(along(share), 2, 1, 2, INK);
    block(along(share), wid - 4, 1, 2, INK);
  }
  for (const y of [1, wid - 6]) block(0, y, 2, 5, TAIL);
  block(-1, 5, 1, 2, CHR);
}


/**
 * The Transit Custom's plan, a half width at a share of its length (0 tail, 1 nose), as a share
 * of the sprite's half: the square box, its tail's corners just rounded, the short nose tapering
 * to its corners.
 * @param share along the van, 0..1
 * @returns the half width, 0..1
 */
function customPlan(share: number): number {
  if (share < 0.02) return 0.9 + 0.1 * Math.sqrt(share / 0.02);
  if (share > 0.9) return Math.sqrt(1 - 0.5 * ((share - 0.9) / 0.1) ** 2);
  return 1;
}

/**
 * The Transit Custom's roof and cab: the long smooth roof (lit along its top edge, soft along the
 * lower) with its two low ribs, the steep raked windscreen, the side glass of the cab, the big
 * black mirrors at the screen's foot.
 * @param spr the painting context
 */
function customCab(spr: SpriteCtx): void {
  const { widthPx: wid, mid, light, block, along } = spr;
  const roofTo = along(0.7), screenTo = along(0.78), half = mid - 2;
  block(along(0.02), 2, roofTo - along(0.02), 1, SHINE);
  block(along(0.02), wid - 3, roofTo - along(0.02), 1, SHADE_SOFT);
  for (const share of [0.24, 0.46]) {
    block(along(share), 3, 1, wid - 6, light);
    block(along(share) + 1, 3, 1, wid - 6, SHADE_SOFT);
  }
  for (let x = roofTo; x < screenTo; x++) {
    const rake = Math.round((x - roofTo) * 0.25);
    block(x, mid - half + rake, 1, (half - rake) * 2 + 1, GLASS);
  }
  block(roofTo + 1, mid - half + 2, 1, half * 2 - 3, GLASS_HI);
  block(along(0.6), 1, roofTo - along(0.6), 1, GLASS);
  block(along(0.6), wid - 2, roofTo - along(0.6), 1, GLASS);
  for (const y of [-2, wid]) block(roofTo - 1, y, 3, 2, INK);
}

/**
 * FJORD TRANSFIT CUSTOM (Ford Transit Custom, 2012-23, L1 H1): the square box and its long
 * smooth roof, the steep screen, the short sloping bonnet with its creases, the wide three-bar
 * grille (the third colour the blue badge) and the swept lamps, the black bumpers' corners, the
 * twin rear doors' split down the tail, the tail lamps up the corners; shaded the TS010's way.
 * @param spr the painting context
 */
function paintCustom(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, third, block, along } = spr;
  planBody(spr, (x) => mid * customPlan(x / (len - 1)));
  customCab(spr);
  for (const y of [mid - 6, mid + 5]) {
    block(along(0.8), y, along(0.15), 1, SHINE);
    block(along(0.8), y + 1, along(0.15), 1, SHADE_SOFT);
  }
  for (const y of [2, wid - 5]) {
    block(len - 6, y, 4, 3, HEAD);
    block(len - 3, y + (y < mid ? 1 : 0), 2, 2, HEAD);
  }
  block(len - 2, mid - 7, 2, 15, INK);
  for (const y of [mid - 5, mid, mid + 5]) block(len - 2, y - 1, 1, 2, CHR);
  block(len - 2, mid - 1, 1, 3, third);
  for (const y of [0, wid - 2]) block(len - 3, y, 3, 2, INK);
  block(0, mid, along(0.02) + 1, 1, INK);
  for (const y of [1, wid - 5]) block(0, y, 1, 4, TAIL);
  block(-1, 5, 1, 2, CHR);
}

/** The newest cars' bodies by id (render/carlooks.ts LOOKS takes them). */
export const NEW_LOOKS_3: [string, { paint: (spr: SpriteCtx) => void; bare?: boolean }][] = [
  ['toyoter-corolla', { paint: paintCorolla, bare: true }],
  ['rebelion-r13', { paint: paintR13, bare: true }],
  ['seat-ibiza', { paint: paintIbiza, bare: true }],
  ['ordi-a4', { paint: paintA4, bare: true }],
  ['transfit-custom', { paint: paintCustom, bare: true }],
];

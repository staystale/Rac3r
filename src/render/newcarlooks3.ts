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

/** The newest cars' bodies by id (render/carlooks.ts LOOKS takes them). */
export const NEW_LOOKS_3: [string, { paint: (spr: SpriteCtx) => void; bare?: boolean }][] = [
  ['toyoter-corolla', { paint: paintCorolla, bare: true }],
];

// render/newcarlooks2.ts - the NEW CARS' bodies from above, cars 6 on (src/newcars.ts;
// render/newcarlooks.ts holds the first five, its house style and the
// helpers shared here): nose +x, a 1 px dark outline, flat paint with a light band on the top
// flank and a dark one on the bottom, black glass, the SECOND colour (trim) big, the THIRD a
// detail.
import { SPRITE_PPM } from "./shared.ts";
import { CHR, GLASS, HEAD, TAIL, type SpriteCtx } from "./carsprite.ts";
import { GLASS_HI, INK, MESH, STEEL, inside, planBody } from "./newcarlooks.ts";
import { FIX } from "../core/fixes.ts";

// the Defender's spare wheel on the rear door, a share of its length (0.17 m of the tyre's depth
// past the body: 4,785 mm with it, 4,639 without)
const DEFUNDER_SPARE = 0.035;

/**
 * The Defender's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the spare wheel standing on the rear door, the square body, the arch flares
 * over both axles, the square nose.
 * @param share along the car, 0..1
 * @param rearAxle the rear axle's share of the length
 * @param frontAxle the front axle's
 * @returns the half width, 0..1
 */
function defunderPlan(share: number, rearAxle: number, frontAxle: number): number {
  if (share < DEFUNDER_SPARE) return 0.42;
  const arch = Math.max(inside(share, rearAxle - 0.1, rearAxle + 0.1, 0.02),
    inside(share, frontAxle - 0.1, frontAxle + 0.1, 0.02));
  return 0.94 + 0.06 * arch;
}

/**
 * The Defender's roof and screen: the roof (the second colour) from the rear door to the near
 * upright windscreen, its alpine lights along both edges, the screen in its frame, the mirrors
 * (the third colour) on the doors.
 * @param spr the painting context
 */
function defunderRoof(spr: SpriteCtx): void {
  const { widthPx: wid, mid, light, dark, third, roof2, block, along } = spr;
  const from = along(DEFUNDER_SPARE) + 1, until = along(0.66), half = Math.round(mid * 0.94) - 1;
  block(from, mid - half, until - from, half * 2 + 1, roof2);
  block(from, mid - half, until - from, 1, light);
  block(from, mid + half, until - from, 1, dark);
  // the alpine lights: the little roof-edge windows over the second row
  block(along(0.36), mid - half + 1, along(0.16), 1, GLASS);
  block(along(0.36), mid + half - 1, along(0.16), 1, GLASS);
  // the screen, near upright: a thin strip from above, its frame, the mirrors
  block(until, mid - half, along(0.035), half * 2 + 1, INK);
  block(until, mid - half + 1, along(0.035) - 1, half * 2 - 1, GLASS);
  block(until, mid - half + 2, 1, half * 2 - 3, GLASS_HI);
  for (const y of [-2, wid]) block(until - 1, y, 2, 2, third);
}

/**
 * The Defender's front: the flat wing tops either side of the bonnet, the grille, the round lamps
 * in the wings' fronts, the bumper (the third colour) across the nose.
 * @param spr the painting context
 */
function defunderFront(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, outline, light, third, block, along } = spr;
  const bonnet = Math.round(mid * 0.6), from = along(0.7);
  // the bonnet's edges against the wing tops, its front lip
  block(from, mid - bonnet, len - 3 - from, 1, outline);
  block(from, mid + bonnet, len - 3 - from, 1, outline);
  block(from + 1, mid - bonnet + 1, len - 5 - from, 1, light);
  // the grille between the wings, its bars
  block(len - 3, mid - bonnet, 2, bonnet * 2 + 1, INK);
  for (let y = mid - bonnet + 1; y < mid + bonnet; y += 2) block(len - 3, y, 1, 1, STEEL);
  // the round lamps in the wings' fronts
  for (const y of [3, wid - 6]) {
    block(len - 3, y, 2, 3, HEAD);
    block(len - 3, y + 1, 1, 1, '#ffffff');
  }
  // the bumper across the nose
  block(len - 1, 1, 2, wid - 2, third);
}

/**
 * LEND ROVER DEFUNDER 110 (Land Rover Defender 110 Station Wagon): the square body on its arch
 * flares (the third colour), the roof (the second colour) with its alpine lights, the near
 * upright screen and door mirrors, the flat wing tops either side of the bonnet, the grille and
 * round lamps, the bumper, the spare wheel on the rear door, the corner lamps.
 * @param spr the painting context
 */
function paintDefunder(spr: SpriteCtx): void {
  const { spec, lengthPx: len, widthPx: wid, mid, third, block, along } = spr;
  const rearAxle = (len / 2 - spec.lr * SPRITE_PPM) / len,
    frontAxle = (len / 2 + spec.lf * SPRITE_PPM) / len;
  planBody(spr, (x) => mid * defunderPlan(x / (len - 1), rearAxle, frontAxle));
  // the arch flares over the wheels, both sides
  for (const axle of [rearAxle, frontAxle]) {
    block(along(axle - 0.09), 0, along(0.18), 2, third);
    block(along(axle - 0.09), wid - 2, along(0.18), 2, third);
  }
  defunderRoof(spr);
  defunderFront(spr);
  // the spare wheel on the rear door, the tail lamps at the corners, the tailpipe on the left
  const spare = Math.round(mid * 0.42), door = along(DEFUNDER_SPARE);
  block(0, mid - spare, door, spare * 2 + 1, INK);
  block(0, mid - 2, door, 5, STEEL);
  block(door, 1, 1, 2, TAIL);
  block(door, wid - 3, 1, 2, TAIL);
  block(along(0.09), 0, 2, 1, CHR);
}

/**
 * The Focus's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the rounded tail, the hips over the rear wheels, a slight waist at the doors, the
 * front wings, the nose tapering to its corners.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function focustPlan(share: number): number {
  const arch = Math.max(inside(share, 0.06, 0.3, 0.06), inside(share, 0.62, 0.86, 0.06));
  const tail = share < 0.04 ? 0.82 + 0.18 * Math.sqrt(share / 0.04) : 1;
  const nose = share > 0.88 ? Math.sqrt(1 - 0.6 * ((share - 0.88) / 0.12) ** 2) : 1;
  return (0.95 + 0.05 * arch) * tail * nose;
}

// the Focus's glasshouse along it, shares of its length (0 tail): where the rear screen and the
// roof begin. FIX.focustlook: a hatch's - the tailgate's near upright screen, seen from above as a
// short strip (0.04-0.10, ~5 px: the Mk4's roof runs to ~0.1 m of its spoiler), the roof almost
// to the back; else the long sloping screen from 0.10 (it read as a boot deck)
const FOCUST_CABIN = FIX.focustlook ? { rear: 0.04, roof: 0.1 } : { rear: 0.1, roof: 0.26 };

/**
 * The Focus's glasshouse: the roof spoiler (the third colour) over the sloping tailgate glass,
 * the roof (the second colour), the side glass, the raked windscreen, the mirrors (the third).
 * @param spr the painting context
 */
function focustCabin(spr: SpriteCtx): void {
  const { mid, roof2, light, third, block, along } = spr;
  const rearFrom = along(FOCUST_CABIN.rear), roofFrom = along(FOCUST_CABIN.roof),
    roofTo = along(0.55), screenTo = along(0.66), cabinHalf = Math.round(mid * 0.74);
  for (let x = rearFrom; x < roofFrom; x++) {
    const half = Math.round(cabinHalf - 3 * (roofFrom - x) / (roofFrom - rearFrom));
    block(x, mid - half, 1, half * 2 + 1, GLASS);
  }
  block(rearFrom + 3, mid - cabinHalf + 4, 1, cabinHalf * 2 - 7, GLASS_HI);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, cabinHalf * 2 + 1, roof2);
  block(roofFrom, mid - cabinHalf, roofTo - roofFrom, 1, light);
  block(roofFrom - 2, mid - cabinHalf, 2, cabinHalf * 2 + 1, third);
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
 * FJORD FOCUST ST (Ford Focus ST, Mk4): the five-door hatch's plan, the roof spoiler over the
 * hatch glass, the roof (the second colour), the raked screen and mirrors, the bonnet's two
 * creases, the swept lamps back along the wings, the wide black grille (the third colour), the
 * corner lamps and the twin tailpipes, one each side.
 * @param spr the painting context
 */
function paintFocust(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, light, dark, third, block, along } = spr;
  planBody(spr, (x) => mid * focustPlan(x / (len - 1)));
  focustCabin(spr);
  // the bonnet's creases
  block(along(0.67), mid - 7, along(0.24), 1, light);
  block(along(0.67), mid + 7, along(0.24), 1, dark);
  // the swept lamps back along the wings, the grille and its lower intake
  for (const y of [3, wid - 5]) {
    block(len - 7, y, 5, 2, HEAD);
    block(len - 4, y + (y < mid ? 1 : -1), 2, 2, HEAD);
  }
  block(len - 2, mid - 7, 2, 15, third);
  block(len - 2, mid - 6, 1, 13, MESH);
  // the doors' shut lines, the tail lamps on the corners, the twin tailpipes
  for (const share of [0.42, 0.58]) {
    block(along(share), 2, 1, 2, INK);
    block(along(share), wid - 4, 1, 2, INK);
  }
  for (const y of [2, wid - 6]) block(0, y, 2, 4, TAIL);
  block(-1, 6, 1, 3, CHR);
  block(-1, wid - 9, 1, 3, CHR);
}

/**
 * The Clio's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the rounded tail, the full hips over the rear wheels, the waist at the doors, the
 * front wings, the round nose.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function cleoPlan(share: number): number {
  const arch = Math.max(inside(share, 0.05, 0.3, 0.06), inside(share, 0.62, 0.86, 0.06));
  const tail = share < 0.05 ? 0.8 + 0.2 * Math.sqrt(share / 0.05) : 1;
  const nose = share > 0.86 ? Math.sqrt(1 - 0.65 * ((share - 0.86) / 0.14) ** 2) : 1;
  return (0.93 + 0.07 * arch) * tail * nose;
}

/**
 * The Clio's glasshouse: a hatch's short rear screen, the roof (the second colour) almost to the
 * back, the side glass, the raked windscreen, the mirrors (the third colour).
 * @param spr the painting context
 */
function cleoCabin(spr: SpriteCtx): void {
  const { mid, roof2, light, third, block, along } = spr;
  const rearFrom = along(0.05), roofFrom = along(0.12), roofTo = along(0.55),
    screenTo = along(0.66), cabinHalf = Math.round(mid * 0.72);
  for (let x = rearFrom; x < roofFrom; x++) {
    const half = Math.round(cabinHalf - 3 * (roofFrom - x) / (roofFrom - rearFrom));
    block(x, mid - half, 1, half * 2 + 1, GLASS);
  }
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
  block(screenTo - 2, mid - cabinHalf - 4, 2, 2, third);
  block(screenTo - 2, mid + cabinHalf + 3, 2, 2, third);
}

/**
 * RENOLT CLEO RS 200 and RENOLT CLEO CUP (the Clio III: the Renaultsport Clio 200 Cup, 2009-12,
 * and the Clio III Cup racer): the three-door hatch's round plan on its wide hips (the Clio's),
 * the short rear screen and the roof (the second colour) almost to the back, the raked screen and
 * mirrors, the swept lamps, the F1-style blade under the nose (the third colour), the small roof
 * spoiler, the diffuser with its twin pipes in the middle.
 * @param spr the painting context
 */
function paintCleoRs(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, outline, light, dark, third, block, along } = spr;
  planBody(spr, (x) => mid * cleoPlan(x / (len - 1)));
  cleoCabin(spr);
  block(along(0.68), mid - 6, along(0.2), 1, light);
  block(along(0.68), mid + 6, along(0.2), 1, dark);
  // the swept lamps back along the wings, the grille, the blade across the nose
  for (const y of [3, wid - 5]) {
    block(len - 7, y, 5, 2, HEAD);
    block(len - 4, y + (y < mid ? 1 : -1), 2, 2, HEAD);
  }
  block(len - 2, mid - 5, 2, 11, INK);
  block(len - 2, mid - 4, 1, 9, MESH);
  block(len, mid - 6, 1, 13, third);
  // the roof spoiler over the rear screen, the tail lamps, the diffuser and twin pipes
  block(along(0.1), mid - Math.round(mid * 0.72), 1, Math.round(mid * 0.72) * 2 + 1, outline);
  for (const y of [2, wid - 6]) block(0, y, 2, 4, TAIL);
  block(-1, mid - 4, 1, 9, third);
  block(-1, mid - 2, 1, 2, CHR);
  block(-1, mid + 1, 1, 2, CHR);
}

/**
 * The TS010's plan, a half width at a share of its length (0 tail, 1 nose), as a share of the
 * sprite's half: the full-width body over its covered wheels, the rear deck squared off under the
 * wing, the low nose rounding to its corners.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function ts010Plan(share: number): number {
  const tail = share < 0.02 ? 0.9 + 0.1 * share / 0.02 : 1;
  const nose = share > 0.86 ? Math.sqrt(1 - 0.7 * ((share - 0.86) / 0.14) ** 2) : 1;
  return tail * nose;
}

/**
 * The TS010's cockpit bubble: the small canopy forward of the middle, its wrap-round screen, the
 * roof (the second colour) and the intake behind it.
 * @param spr the painting context
 */
function ts010Cockpit(spr: SpriteCtx): void {
  const { mid, roof2, light, block, along } = spr;
  const half = Math.round(mid * 0.36), roofFrom = along(0.46), roofTo = along(0.56);
  block(along(0.42), mid - half + 1, roofFrom - along(0.42), half * 2 - 1, GLASS);
  block(roofFrom, mid - half, roofTo - roofFrom, half * 2 + 1, roof2);
  block(roofFrom, mid - half, roofTo - roofFrom, 1, light);
  for (let x = roofTo; x < along(0.64); x++) {
    const rake = Math.round((x - roofTo) * 0.4);
    block(x, mid - half + rake, 1, Math.max(1, (half - rake) * 2 + 1), GLASS);
  }
  block(roofTo + 1, mid - half + 2, 1, half * 2 - 3, GLASS_HI);
  // the roof's intake for the engine, behind the canopy
  block(along(0.36), mid - 2, along(0.06), 5, INK);
  block(along(0.37), mid - 1, along(0.04), 3, MESH);
}

/**
 * TOYOTER TS010 (Toyota TS010, the 1992 Group C car): the low full-width body over covered
 * wheels, the fenders' crests, the small canopy forward of the middle, the engine cover's louvres
 * and the sidepods' radiator inlets, the headlamps in the nose, the splitter, the full-width
 * wing on its endplates (the third colour) at the tail.
 * @param spr the painting context
 */
function paintTs010(spr: SpriteCtx): void {
  const { spec, lengthPx: len, widthPx: wid, mid, outline, light, dark, third, block,
    along } = spr;
  planBody(spr, (x) => mid * ts010Plan(x / (len - 1)));
  // the fenders' crests over the four wheels, front and rear
  for (const [from, until] of [[0.08, 0.34], [0.66, 0.92]]) {
    block(along(from), 3, along(until - from), 1, light);
    block(along(from), wid - 4, along(until - from), 1, dark);
  }
  ts010Cockpit(spr);
  // the engine cover's louvres, the sidepods' radiator inlets beside the cockpit
  for (let x = along(0.14); x < along(0.32); x += 2) block(x, mid - 5, 1, 11, INK);
  for (const y of [4, wid - 7]) block(along(0.44), y, along(0.1), 3, INK);
  // the headlamps in the nose's corners, the splitter's lip
  for (const y of [4, wid - 7]) block(len - 7, y, 4, 3, HEAD);
  block(len, 3, 1, wid - 6, third);
  // the tail: lamps, the diffuser and pipes
  for (const y of [2, wid - 4]) block(0, y, 1, 2, TAIL);
  block(-1, mid - 3, 1, 2, CHR);
  block(-1, mid + 2, 1, 2, CHR);
  if (spec.noWing) return;
  // the WING across the full width on its endplates
  block(2, 1, 6, wid - 2, 'rgba(0,0,0,0.25)');
  block(0, 0, 6, wid, outline);
  block(1, 1, 4, wid - 2, third);
  block(4, 1, 1, wid - 2, light);
  for (const y of [mid - 6, mid + 5]) block(5, y, 4, 2, STEEL);
}

/**
 * The Routemaster's plan, a half width at a share of its length (0 tail, 1 nose), as a share of
 * the sprite's half: the box of a double-decker, its domed roof rounding at both ends.
 * @param share along the bus, 0..1
 * @returns the half width, 0..1
 */
function routemonsterPlan(share: number): number {
  if (share < 0.03) return 0.88 + 0.12 * Math.sqrt(share / 0.03);
  if (share > 0.97) return 0.88 + 0.12 * Math.sqrt((1 - share) / 0.03);
  return 1;
}

/**
 * AEC ROUTEMONSTER (AEC Routemaster, RM): the upper deck's roof from above - the London red
 * body, the roof panel (the second colour) domed at both ends with its seams, the two roof
 * vents, the cream relief band (the third colour) along both sides, the lamps at the front
 * corners, the rear platform's corner and its lamps.
 * @param spr the painting context
 */
function paintRoutemonster(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, outline, light, dark, third, roof2, block,
    along } = spr;
  planBody(spr, (x) => mid * routemonsterPlan(x / (len - 1)));
  // the cream band along both flanks, between the decks
  block(along(0.03), 1, along(0.94), 1, third);
  block(along(0.03), wid - 2, along(0.94), 1, third);
  // the roof panel, its domes, the seams across it
  const half = mid - 3;
  block(along(0.04), mid - half, along(0.92), half * 2 + 1, roof2);
  block(along(0.04), mid - half, along(0.92), 1, light);
  block(along(0.04), mid + half, along(0.92), 1, dark);
  for (let x = along(0.12); x < along(0.92); x += Math.max(4, along(0.1))) {
    block(x, mid - half + 1, 1, half * 2 - 1, outline);
  }
  // the two vents on the roof, front and back
  for (const share of [0.2, 0.8]) block(along(share), mid - 2, 3, 5, STEEL);
  // the lamps at the front corners, the tail lamps by the platform
  for (const y of [1, wid - 3]) block(len - 2, y, 2, 2, HEAD);
  for (const y of [1, wid - 3]) block(0, y, 1, 2, TAIL);
  block(-1, wid - 6, 1, 3, CHR);
}

/**
 * CITRONE SAXO MAX (Citroen Saxo Kit Car, the 1997-99 F2 "maxi" kit car): the little three-door
 * hatch's round plan on its wide arches (the Clio's plan and glasshouse), the roof (the second
 * colour) with its rally air scoop, the oval lamps, the grille's chevrons (the third colour), the
 * mud flaps and the side pipe.
 * @param spr the painting context
 */
function paintSaxo(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, light, dark, third, block, along } = spr;
  planBody(spr, (x) => mid * cleoPlan(x / (len - 1)));
  cleoCabin(spr);
  block(along(0.68), mid - 5, along(0.2), 1, light);
  block(along(0.68), mid + 5, along(0.2), 1, dark);
  // the roof's air scoop, the oval lamps, the grille with its chevrons, the spoiler's lip
  block(along(0.48), mid - 2, 3, 5, INK);
  for (const y of [3, wid - 6]) block(len - 5, y, 3, 3, HEAD);
  block(len - 2, mid - 5, 2, 11, INK);
  block(len - 2, mid - 2, 1, 5, third);
  block(len, 3, 1, wid - 6, INK);
  // the mud flaps behind each wheel, the tail lamps, the side pipe on the right
  const rearX = Math.round(len / 2 - spr.spec.lr * SPRITE_PPM) - 4;
  const frontX = Math.round(len / 2 + spr.spec.lf * SPRITE_PPM) - 4;
  for (const x of [rearX, frontX]) {
    block(x, 0, 1, 2, INK);
    block(x, wid - 2, 1, 2, INK);
  }
  for (const y of [2, wid - 6]) block(0, y, 2, 4, TAIL);
  block(along(0.3), wid - 1, 3, 1, CHR);
}

/**
 * The Range Rover's plan, a half width at a share of its length (0 tail, 1 nose), as a share of
 * the sprite's half: the long square body, its corners only a little rounded.
 * @param share along the car, 0..1
 * @returns the half width, 0..1
 */
function strangePlan(share: number): number {
  if (share < 0.02) return 0.9 + 0.1 * Math.sqrt(share / 0.02);
  if (share > 0.97) return 0.9 + 0.1 * Math.sqrt((1 - share) / 0.03);
  return 1;
}

/**
 * STRANGE ROVER (Range Rover L322, 2002-05): the long square body, the short tailgate glass, the
 * floating black roof (the second colour) with its sunroof, the near upright screen, the
 * clamshell bonnet's raised edges, the gills behind the front wheels, the wide grille's bars (the
 * third colour), the square lamps at the corners, the mirrors.
 * @param spr the painting context
 */
function paintStrangeRover(spr: SpriteCtx): void {
  const { lengthPx: len, widthPx: wid, mid, light, dark, third, roof2, block, along } = spr;
  planBody(spr, (x) => mid * strangePlan(x / (len - 1)));
  const half = Math.round(mid * 0.8);
  // the tailgate's glass, the roof and its sunroof, the windscreen, the mirrors
  block(along(0.04), mid - half + 1, along(0.05), half * 2 - 1, GLASS);
  block(along(0.09), mid - half, along(0.52), half * 2 + 1, roof2);
  block(along(0.09), mid - half - 1, along(0.52), 1, GLASS);
  block(along(0.09), mid + half + 1, along(0.52), 1, GLASS);
  // the roof rails (the third colour) and the sunroof in its frame
  block(along(0.12), mid - half + 1, along(0.46), 1, third);
  block(along(0.12), mid + half - 1, along(0.46), 1, third);
  block(along(0.41), mid - 5, along(0.14), 11, GLASS_HI);
  block(along(0.41) + 1, mid - 4, along(0.14) - 2, 9, GLASS);
  // the screen behind the body-coloured edge of the roof
  block(along(0.62), mid - half, along(0.045), half * 2 + 1, GLASS);
  block(along(0.63), mid - half + 1, 1, half * 2 - 1, GLASS_HI);
  for (const y of [-2, wid]) block(along(0.62), y, 2, 2, third);
  // the clamshell bonnet's raised edges, the gills behind the front wheels
  block(along(0.68), 3, along(0.28), 1, light);
  block(along(0.68), wid - 4, along(0.28), 1, dark);
  for (const y of [1, wid - 2]) block(along(0.66), y, along(0.04), 1, INK);
  // the square lamps on the corners, the wide grille and its bars
  for (const y of [2, wid - 6]) block(len - 4, y, 3, 4, HEAD);
  block(len - 2, mid - 7, 2, 15, INK);
  for (let y = mid - 6; y <= mid + 6; y += 3) block(len - 2, y, 1, 2, third);
  // the tail lamps, the twin pipes
  for (const y of [1, wid - 5]) block(0, y, 2, 4, TAIL);
  block(-1, 5, 1, 2, CHR);
  block(-1, wid - 7, 1, 2, CHR);
}

/** Cars 6 on: their bodies by id (render/carlooks.ts LOOKS takes them). */
export const NEW_LOOKS_2: [string, { paint: (spr: SpriteCtx) => void; bare?: boolean }][] = [
  ['defunder-110', { paint: paintDefunder, bare: true }],
  ['focust-st', { paint: paintFocust, bare: true }],
  ['cleo-cup', { paint: paintCleoRs, bare: true }],
  ['cleo-rs200', { paint: paintCleoRs, bare: true }],
  ['routemonster', { paint: paintRoutemonster, bare: true }],
  ['saxo-kit', { paint: paintSaxo, bare: true }],
  ['strange-l322', { paint: paintStrangeRover, bare: true }],
  ['ts010', { paint: paintTs010, bare: true }],
];

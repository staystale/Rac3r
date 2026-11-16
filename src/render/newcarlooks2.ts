// render/newcarlooks2.ts - the NEW CARS' bodies from above, cars 6 on (src/newcars.ts, each
// behind its own switch; render/newcarlooks.ts holds the first five, its house style and the
// helpers shared here): nose +x, a 1 px dark outline, flat paint with a light band on the top
// flank and a dark one on the bottom, black glass, the SECOND colour (trim) big, the THIRD a
// detail.
import { SPRITE_PPM } from "./shared.ts";
import { CHR, GLASS, HEAD, TAIL, type SpriteCtx } from "./carsprite.ts";
import { GLASS_HI, INK, STEEL, inside, planBody } from "./newcarlooks.ts";

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

/** Cars 6 on: their bodies by id (render/carlooks.ts LOOKS takes them). */
export const NEW_LOOKS_2: [string, { paint: (spr: SpriteCtx) => void; bare?: boolean }][] = [
  ['defunder-110', { paint: paintDefunder, bare: true }],
];

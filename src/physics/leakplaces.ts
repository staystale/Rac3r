// physics/leakplaces.ts - ?dmgmore2: WHERE A CAR'S RADIATOR AND ENGINE ARE, for what leaks and
// steams from them (the owner's damage item 3): the radiator by its layout (carbits.ts radiator:
// in the nose, in the tail - the Sport quattro S1, the RX supercars - or in the sides ahead of the
// rear wheels - the mid-engined cars), the sump under the engine (carbits.ts engine: front, mid,
// rear). Shares of the car's length from its middle (+ ahead) and of its width (+ right); the
// water and oil it loses land there (physics/engineheat.ts), its steam and smoke rise there
// (render/enginesmoke.ts). Shares by eye from the cars' drawings (render/underskin.ts places).
import { bitsOf } from '../carbits.ts';

// share of the length ahead of the middle: a nose radiator, a tail one, the side ones
const RADIATOR_ALONG: Record<string, number> = { front: 0.38, rear: -0.38, sides: -0.15 };
// share of the width out from the middle line of the side radiators (one each side)
const SIDE_RADIATOR_ACROSS = 0.4;
// share of the length ahead of the middle of the sump: under a front, mid or rear engine
const SUMP_ALONG: Record<string, number> = { front: 0.25, mid: -0.15, rear: -0.3 };

/**
 * The radiator's place, shares of the car (side radiators: the side by `side`).
 * @param carId the car's id
 * @param side +1 or -1: which side radiator (the others ignore it)
 * @returns [along, across] shares of the length and width
 */
export function radiatorAt(carId: string, side: number): [number, number] {
  const where = bitsOf(String(carId).split('#')[0]).radiator;
  return [RADIATOR_ALONG[where] ?? RADIATOR_ALONG.front,
    where === 'sides' ? side * SIDE_RADIATOR_ACROSS : 0];
}

/**
 * The sump's place along the car (under its engine), a share of the length.
 * @param carId the car's id
 * @returns the share ahead of the middle
 */
export function sumpAt(carId: string): number {
  return SUMP_ALONG[bitsOf(String(carId).split('#')[0]).engine] ?? SUMP_ALONG.front;
}

/**
 * Whether the radiator is out in the open: the panel over it lost (a nose radiator's bonnet or a
 * front bumper, a tail one's boot lid or a rear bumper, a side one's rear wing).
 * @param carId the car's id
 * @param partLost the parts gone (world/debris.ts)
 * @returns it is exposed
 */
export function isRadiatorExposed(carId: string, partLost: string | undefined): boolean {
  if (!partLost) return false;
  const where = bitsOf(String(carId).split('#')[0]).radiator;
  const lost = (kind: string, corners: number[]) =>
    corners.some((corner) => partLost.includes(kind + ':' + corner));
  if (where === 'rear') return lost('boot', [2, 3]) || lost('bumper', [2, 3]);
  if (where === 'sides') return lost('wing', [2, 3]);
  return lost('bonnet', [0, 1]) || lost('bumper', [0, 1]);
}

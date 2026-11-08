// physics/rollshape.ts - HOW A CAR ROLLS BY ITS SHAPE (owner 11-08: "roll and catch / degrade
// chances based on how the car is shaped based on your opinion if the real version of the car is
// smooth or sharp"; "F1 like cars and wide cars should have super low chance to land on the
// side"). round: 0 sharp or boxy, 1 round (render/rollbody.ts draws the body's cross-section by
// it too) - a round body keeps more of its spin at each hit and rolls on; a sharp one keeps less,
// and an edge, a wheel or a wing may DIG IN (the spin all but stops). side: the chance it may
// come to rest on a side - an open car's wheels and wings stand off its tub, a wide low car is a
// tall thin thing on its side: they fall on to their wheels or roof. Every car (highway traffic
// is the roster's cars too).

/** A car's shape as it rolls. */
export interface RollShape { round: number; side: number }

const SHAPES: Record<string, RollShape> = {
  'hatch-fwd': { round: 0.55, side: 0.8 },   // Golf: a hatch with soft edges
  'hatch-rwd': { round: 0.6, side: 0.8 },   // M135i: a rounded hatch
  'saloon-rwd': { round: 0.5, side: 0.6 },   // 3 Series: a saloon, clear edges
  'wrz-awd': { round: 0.45, side: 0.6 },   // WRX: a saloon, its big wing digs in
  'estate-4x4': { round: 0.25, side: 0.85 },   // V70: a boxy estate, its edges dig in
  'muscle-rwd': { round: 0.3, side: 0.35 },   // Chevelle: long, wide and flat
  'rally-4x4': { round: 0.3, side: 0.5 },   // quattro S1: boxy, wide arches, big wings
  'track-rwd': { round: 0.1, side: 0.03 },   // F1: open wheels and wings catch
  naffcar: { round: 0.35, side: 0.35 },   // Naffcar: slab sides, wide and low
  tractor: { round: 0.1, side: 0.95 },   // Fastrac: a tall box on big wheels, tips and stops
  'mini-fwd': { round: 0.75, side: 0.85 },   // Mini: small and round, keeps rolling
  'lambo-awd': { round: 0.65, side: 0.1 },   // Huracan: a wide low wedge, slides on its roof
  'mikra-r1': { round: 0.85, side: 0.9 },   // Micra: a bubble, rolls like a ball
  'kit-2l': { round: 0.6, side: 0.6 },   // 306 Maxi: a rounded hatch on wide arches
  'rx-super': { round: 0.45, side: 0.4 },   // Fiesta RX: wide arches and a wing
  'banger-f2': { round: 0.15, side: 0.25 },   // BriSCA F2: an open cage, bars catch
  'grass-special': { round: 0.15, side: 0.1 },   // autograss buggy: an open frame catches
  'drift-s13': { round: 0.5, side: 0.5 },   // S13: a low wedge coupe
  'f2-rwd': { round: 0.1, side: 0.03 },   // F2: open wheels and wings catch
};

// the dig: its chance at round 0, and the share of the spin it leaves
const DIG_P = 0.35, DIG_KEEP = 0.3;

/**
 * A car's rolling shape (the Golf's for a car not listed).
 * @param carId the car's id
 * @returns its shape
 */
export const rollShapeOf = (carId: string | undefined): RollShape =>
  SHAPES[String(carId || '').split('#')[0]] ?? SHAPES['hatch-fwd'];

/**
 * A quarter-turn hit by the car's shape: the spin it keeps (a dig leaves little) and the share of
 * its speed.
 * @param shape the car's shape
 * @param rnd the random source
 * @returns the spin share and the speed share
 */
export function shapedHit(shape: RollShape, rnd: () => number): { spin: number; speed: number } {
  let spin = 0.45 + 0.4 * shape.round + (rnd() - 0.5) * 0.16;
  if (rnd() < DIG_P * (1 - shape.round)) spin *= DIG_KEEP;
  return { spin, speed: 0.86 - 0.08 * (1 - shape.round) };
}

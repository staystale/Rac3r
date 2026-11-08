// physics/rollshape.ts - HOW A CAR ROLLS BY ITS SHAPE (owner 11-08: "roll and catch / degrade
// chances based on how the car is shaped based on your opinion if the real version of the car is
// smooth or sharp"; "f1 cars should like never end on their sides"). round: 0 sharp or boxy, 1
// round (render/rollbody.ts draws the body's cross-section by it too); side: whether it can come
// to rest on a side (an open car's wheels and wings stand off its tub - it falls on to its wheels
// or its roof). A round body keeps more of its spin at each hit and rolls on; a sharp one keeps
// less, and an edge, a wheel or a wing may DIG IN (the spin all but stops). Behind ?rollbody=1,
// the F1 and the Micra first (the owner tries them before the rest; the mockup's table for all
// is in tools/scratch/rollmock.html).

/** A car's shape as it rolls. */
export interface RollShape { round: number; side: boolean }

const SHAPES: Record<string, RollShape> = {
  // F1: open wheels and wings catch, never rests on a side
  'track-rwd': { round: 0.1, side: false },
  // Micra: a bubble - rolls like a ball
  'mikra-r1': { round: 0.85, side: true },
};

// the dig: its chance at round 0, and the share of the spin it leaves
const DIG_P = 0.35, DIG_KEEP = 0.3;

/**
 * A car's rolling shape, or null for a car still rolling the old way.
 * @param carId the car's id
 * @returns its shape
 */
export const rollShapeOf = (carId: string | undefined): RollShape | null =>
  SHAPES[String(carId || '').split('#')[0]] ?? null;

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

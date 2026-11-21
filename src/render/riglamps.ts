// render/riglamps.ts - ?trailer: A RIG'S LAMPS AT NIGHT. A trailer on its pin carries the rig's
// rear lamps - tail, brake, indicators, reversing - lit as its tractor's are (physics/trailer.ts
// mirrorLamps); the tractor's own rear lamps are under the trailer's nose and show nothing; the
// trailer has no lamps at its nose (no headlights, no front indicators). A trailer off its pin
// (the pin broken) is dark: its cable went with the pin. The night layer (render/light.ts) lights
// the rig's cars through rigOf, each lamp by lampLevel (render/cars.ts) asking hidesLamp.

/** A car as the rig's lamps read it: its kind, the trailer it tows. */
interface RigCar {
  spec: { kind?: string };
  trailer?: { pinFree?: boolean } | null;
}

/**
 * Whether a lamp of a rig's car shows nothing: a trailer's at its nose, a towing tractor's at
 * its tail (under the trailer).
 * @param car the car
 * @param corner the lamp's damage corner (0, 1 front; 2, 3 rear)
 * @returns hidden
 */
export function hidesLamp(car: RigCar, corner: number): boolean {
  if (car.spec.kind === 'trailer') return corner < 2;
  return corner >= 2 && !!car.trailer && !car.trailer.pinFree;
}

/**
 * The cars a car's lamps are drawn on: the car, and the trailer it tows.
 * @param car the player's car
 * @returns the car, and its trailer if it has one
 */
export function rigOf<T>(car: T): T[] {
  const trailer = (car as { trailer?: T | null }).trailer;
  return trailer ? [car, trailer] : [car];
}

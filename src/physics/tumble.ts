// physics/tumble.ts: a car TUMBLING fast enough to go over low things (owner 11-08, to
// "a fast-tumbling car could go over low things (Armco, tyre stacks, a lying tyre) but never a
// catch fence or wall": "sounds good"). On its wheels, or rolling slowly, a car is stopped by
// them as before (world/barriers.ts, cones/coneCar.ts).

// rad/s of roll above which the body clears low things (a roll starts at up to 14, and every
// quarter turn on the ground takes 20-40 % off it)
export const TUMBLE_OVER_W = 5;
// the barriers low enough to tumble over (a catch fence, a wall, a pit wall, a building are not)
const LOW_BARRIERS = new Set(['armco', 'fence']);
// kg: the loose objects light and low enough to tumble over (cones, tyres, stacks, parts)
const LOW_OBJECT_KG = 60;

/** What tumbling reads off a car: its roll (vehicle.ts CarRoll). */
interface Tumbler { roll?: { phase: string; w: number } | null }

/**
 * Whether a car is tumbling fast enough to go over low things.
 * @param car the car
 * @returns true when it is
 */
export function isTumbling(car: object): boolean {
  const roll = (car as Tumbler).roll;
  return !!roll && roll.phase === 'rolling' && Math.abs(roll.w) > TUMBLE_OVER_W;
}

/**
 * Whether a car goes over a barrier of this kind now.
 * @param car the car
 * @param kind the barrier's kind
 * @returns true when it tumbles over it
 */
export const tumblesOverBarrier = (car: object, kind: string) => LOW_BARRIERS.has(kind)
  && isTumbling(car);

/**
 * Whether a car goes over a loose object this heavy now.
 * @param car the car
 * @param massKg the object's mass
 * @returns true when it tumbles over it
 */
export const tumblesOverObject = (car: object, massKg: number) => massKg <= LOW_OBJECT_KG
  && isTumbling(car);

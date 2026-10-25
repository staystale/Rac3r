// WOODEN MARSHAL BOXES (owner: marshal boxes made of wood and destructible). A
// marshal post is a wooden hut: a knock bounces off it as before, a hit closing at BREAK_V or
// more SMASHES it - the car loses BREAK_LOSS of its closing speed and goes on through (no wall
// to bounce off), the hut is drawn wrecked, its beacon goes out (render/eventglows.ts) and its
// planks are thrown out as loose wooden pallets (cones.js: knockable, nails and all). RESTART
// stands every hut up again (world/lamps.ts resetLamps).
import type { CarBody, Prop, Solid } from './types.ts';

// closing speed that smashes a hut, m/s (~29 km/h), and the share of it the car loses
const BREAK_V = 8, BREAK_LOSS = 0.45;
// the planks a smashed hut throws out (pallets), and how far they scatter, m
const PLANKS = 3, PLANK_SCATTER_M = 2.2;

let wrecked = new WeakSet<Prop>();
const propOfSolid = new WeakMap<Solid, Prop>();
const thrown: Prop[] = [];

/**
 * Remembers which marshal post a solid box belongs to (world/barriers.ts solidsFromProps).
 * @param solid the box
 * @param prop the marshal post
 */
export function noteMarshalSolid(solid: Solid, prop: Prop): void {
  propOfSolid.set(solid, prop);
}

/**
 * Whether a marshal post has been smashed.
 * @param prop the marshal post
 * @returns true when wrecked
 */
export function isHutWrecked(prop: Prop): boolean {
  return wrecked.has(prop);
}

/**
 * Whether a solid is a smashed hut's (no longer solid).
 * @param solid the box
 * @returns true when its hut is wrecked
 */
export function isSolidWrecked(solid: Solid): boolean {
  const prop = propOfSolid.get(solid);
  return !!prop && isHutWrecked(prop);
}

/**
 * A car hits a marshal hut: hard enough, it smashes and the car goes on through, slowed.
 * @param solid the hut's box
 * @param car the car
 * @param into the car's closing speed into it, m/s
 * @param pushX the contact normal toward the car, unit x
 * @param pushY unit y
 * @returns true when it smashed (no bounce)
 */
export function smashHut(solid: Solid, car: CarBody, into: number, pushX: number,
    pushY: number): boolean {
  const prop = propOfSolid.get(solid);
  if (!prop || into < BREAK_V) return false;
  wrecked.add(prop);
  car.vx += pushX * into * BREAK_LOSS;
  car.vy += pushY * into * BREAK_LOSS;
  car.shake = Math.min(1, (car.shake || 0) + 0.7);
  for (let i = 0; i < PLANKS; i++) {
    const angle = Math.random() * Math.PI * 2, reach = Math.random() * PLANK_SCATTER_M;
    thrown.push({ kind: 'pallet', x: prop.x + Math.cos(angle) * reach,
      y: prop.y + Math.sin(angle) * reach, rot: Math.random() * Math.PI });
  }
  return true;
}

/**
 * The planks smashed huts have thrown out since the last call (the game adds them to its loose
 * objects).
 * @returns the pallets to add
 */
export function takeThrownPlanks(): Prop[] {
  return thrown.splice(0, thrown.length);
}

/** Stands every hut up again (RESTART). */
export function resetMarshalHuts(): void {
  wrecked = new WeakSet();
  thrown.length = 0;
}

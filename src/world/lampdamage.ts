// LAMP DAMAGE (owner): what a car does to a lamp it hits. A NUDGE wonks the post (it
// leans away from the car) and sets its light flickering but it stays lit; a HARD hit dims it by
// degrees until it goes out (as a car's headlights fail); a street light hit hard enough, or
// leaning too far, SNAPS and falls the way the car was going - the car loses part of its speed
// instead of bouncing off a wall (a break-away post). A fallen post lies there as debris: each
// pass over it jolts the car and slows it a little, mangles it and leaves it flatter, until it is
// flat and nothing. Floodlight pylons lean a little, flicker and lose a lamp head per hard hit,
// and never fall. Speeds are the car's closing speed into the post (barriers.ts clampToSolid).
import { placeHead, type Lamp } from './lamps.ts';
import type { CarBody } from './types.ts';

// closing speed of a nudge, a hard hit and a snapping street light, m/s (~5 / 25 / 47 km/h)
const NUDGE_V = 1.5, HARD_V = 7, SNAP_V = 13;
// radians of lean a m/s of closing speed adds; a street light falls past LEAN_FALLS; a pylon's
// lean stops at FLOOD_LEAN_MAX
const STREET_LEAN_PER_V = 0.035, FLOOD_LEAN_PER_V = 0.006, LEAN_FALLS = 0.55;
const FLOOD_LEAN_MAX = 0.1;
// a street light's light lost between HARD_V and SNAP_V (all of it at SNAP_V); a pylon loses one
// of its four heads per hard hit
const STREET_DIM = 1, FLOOD_HEAD = 0.25;
// the share of its closing speed a car loses snapping a post
const SNAP_LOSS = 0.35;
// a fallen post: its length (the pole), the share of speed it takes at full solidity, what each
// pass leaves of its solidity, below which it is flat, and how far a pass shoves it, m
export const POST_LONG_M = 8;
const POST_LOSS = 0.12, POST_LEFT = 0.55, POST_FLAT = 0.15, POST_SHOVE_M = 0.5;

/**
 * Leans a lamp away from the car (pylons only so far), moving its head.
 * @param lamp the lamp
 * @param dirX the direction it is pushed, unit x
 * @param dirY unit y
 * @param amount radians
 */
function addLean(lamp: Lamp, dirX: number, dirY: number, amount: number): void {
  lamp.leanX += dirX * amount;
  lamp.leanY += dirY * amount;
  const lean = Math.hypot(lamp.leanX, lamp.leanY);
  if (lamp.kind === 'flood' && lean > FLOOD_LEAN_MAX) {
    lamp.leanX *= FLOOD_LEAN_MAX / lean;
    lamp.leanY *= FLOOD_LEAN_MAX / lean;
  }
  placeHead(lamp);
}

/**
 * Snaps a street light: it falls the way the car was going; the car loses part of its speed.
 * @param lamp the lamp
 * @param car the car
 * @param into its closing speed, m/s
 * @param pushX the contact normal toward the car, unit x
 * @param pushY unit y
 */
function snapPost(lamp: Lamp, car: CarBody, into: number, pushX: number, pushY: number): void {
  lamp.down = true;
  lamp.level = 0;
  lamp.fallX = -pushX;
  lamp.fallY = -pushY;
  car.vx += pushX * into * SNAP_LOSS;
  car.vy += pushY * into * SNAP_LOSS;
  car.shake = Math.min(1, (car.shake || 0) + 0.6);
}

/**
 * A car hits a standing lamp's post. Returns true when the post snapped (the car goes on through
 * it: no wall to bounce off).
 * @param lamp the lamp
 * @param car the car
 * @param into the car's closing speed into the post, m/s
 * @param pushX the contact normal toward the car, unit x
 * @param pushY unit y
 * @returns true when it snapped
 */
export function hitLamp(lamp: Lamp, car: CarBody, into: number, pushX: number,
    pushY: number): boolean {
  if (into < NUDGE_V) return false;
  const isStreet = lamp.kind === 'street';
  if (isStreet && into >= SNAP_V) {
    snapPost(lamp, car, into, pushX, pushY);
    return true;
  }
  addLean(lamp, -pushX, -pushY, into * (isStreet ? STREET_LEAN_PER_V : FLOOD_LEAN_PER_V));
  lamp.flicker = Math.max(lamp.flicker, 0.4);
  if (into >= HARD_V) {
    lamp.level = Math.max(0, lamp.level - (isStreet
      ? STREET_DIM * (into - HARD_V) / (SNAP_V - HARD_V) : FLOOD_HEAD));
    lamp.flicker = 1;
  }
  // leaning too far, it goes over slowly (the car has already bounced off it)
  if (isStreet && Math.hypot(lamp.leanX, lamp.leanY) >= LEAN_FALLS) {
    lamp.down = true;
    lamp.level = 0;
    lamp.fallX = -pushX;
    lamp.fallY = -pushY;
  }
  return false;
}

/**
 * The distance from a point to a fallen post's pole, m.
 * @param lamp the fallen lamp
 * @param x the point, m
 * @param y the point, m
 * @returns the distance
 */
function poleGap(lamp: Lamp, x: number, y: number): number {
  const along = Math.max(0, Math.min(POST_LONG_M,
    (x - lamp.x) * lamp.fallX + (y - lamp.y) * lamp.fallY));
  return Math.hypot(x - lamp.x - lamp.fallX * along, y - lamp.y - lamp.fallY * along);
}

/**
 * A car over a fallen post: one pass jolts and slows it by the post's solidity, mangles the post,
 * leaves it flatter and shoves it a little the way the car goes.
 * @param car the car
 * @param lamp the fallen lamp
 */
export function driveOverPost(car: CarBody, lamp: Lamp): void {
  if (lamp.solidity < POST_FLAT) return;
  const gap = poleGap(lamp, car.x, car.y), reach = car.spec.wid / 2 + 0.2;
  if (gap > reach + 1) {
    if (lamp.touching === car) lamp.touching = null;
    return;
  }
  if (gap > reach || lamp.touching === car) return;
  lamp.touching = car;
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < 1) return;
  const loss = POST_LOSS * lamp.solidity;
  car.vx *= 1 - loss;
  car.vy *= 1 - loss;
  car.shake = Math.min(1, (car.shake || 0) + 0.5 * lamp.solidity);
  lamp.x += (car.vx / speed) * POST_SHOVE_M * lamp.solidity;
  lamp.y += (car.vy / speed) * POST_SHOVE_M * lamp.solidity;
  lamp.solidity *= POST_LEFT;
  lamp.mangle++;
}


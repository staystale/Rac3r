// game/gridlen.ts - GRID SLOTS BY LENGTH (owner: "the GRID gives each vehicle a slot as
// long as it is (a rig ~20 m, at the back of a mixed grid), a solo start slides back to a spot with
// the rig's length clear"). A grid's slots alternate columns, GRID_STEP m apart (game/grid.ts);
// here each slot also keeps GRID_CLEAR_M behind the tail of the car two slots ahead (its column):
// for two 5 m cars that is today's 14 m nose to nose, so a grid of cars is unchanged, while a bus,
// a van or a towing rig (tractor and trailer, ~17 m) gets its own length. A towing rig takes the
// last slot of a grid. A solo start with a rig whose trailer would stand on a barrier or a solid
// (the Lab's start posts) slides back along the road, a metre at a time, to a clear spot.
import { makeCar, type Car } from '../vehicle.ts';
import { ROSTER } from '../cars.ts';
import { TRACTOR_ID, trailerBehind, type Tractor } from '../physics/trailer.ts';
import { barrierClamp, solidClamp } from '../world/barriers.ts';
import { LEVEL } from '../world/state.ts';
import { onTrack, querySubtrack } from '../world/tyrewall.ts';

// m clear between a car's tail and the nose of the car behind it in its column (two 5 m cars:
// the grid's 14 m nose to nose, as before)
const GRID_CLEAR_M = 9;
// m a solo start slides back at most, and its step
const SLIDE_MAX_M = 80, SLIDE_STEP_M = 1;
// m a probe body moved by the clamps that counts as touching
const TOUCH_M = 0.01;

/** How far a car reaches ahead of and behind its middle, m. */
export interface Extent { front: number; rear: number }

// each slot's distance back from the pole, m (null: slot x GRID_STEP)
let slotBacks: number[] | null = null;

/**
 * Whether the player's car will tow a trailer (the tractor, its trailer not dropped).
 * @param car the player's car
 * @returns towing
 */
export function isTowing(car: Car): boolean {
  return String(car.spec.id).split('#')[0] === TRACTOR_ID
    && (car as Tractor).trailer !== null;
}

/**
 * A grid slot's distance back from the pole, m: laid by length, else slot x step.
 * @param slot the slot, 0 = pole
 * @param step the grid's step, m (game/grid.ts GRID_STEP)
 * @returns m back
 */
export function slotBackM(slot: number, step: number): number {
  return slotBacks && slotBacks[slot] !== undefined ? slotBacks[slot] : slot * step;
}

/**
 * The player's slot: a towing rig at the back of a grid, else the one drawn.
 * @param count the AI
 * @param drawn the slot drawn (game/grid.ts drawGridSlot)
 * @param towing the player tows
 * @returns the slot
 */
export function playerSlot(count: number, drawn: number, towing: boolean): number {
  return towing && count ? count : drawn;
}

/**
 * Each slot's distance back, by the lengths of the cars in it (none laid with no field).
 * @param player the player's extent
 * @param aiIds the AI's car ids, in order
 * @param mySlot the player's slot
 * @param step the grid's step, m
 */
export function layGridByLength(player: Extent, aiIds: string[], mySlot: number,
  step: number): void {
  slotBacks = null;
  if (!aiIds.length) return;
  const extents: Extent[] = [];
  for (let slot = 0; slot <= aiIds.length; slot++) {
    if (slot === mySlot) extents.push(player);
    else {
      const carId = aiIds[slot < mySlot ? slot : slot - 1].split('#')[0];
      const half = (ROSTER.find((row) => row.id === carId)?.len ?? 4.5) / 2;
      extents.push({ front: half, rear: half });
    }
  }
  const backs = [0];
  for (let slot = 1; slot < extents.length; slot++) {
    const behindLast = backs[slot - 1] + step;
    const behindColumn = slot >= 2 ? backs[slot - 2] + extents[slot - 2].rear
      + extents[slot].front + GRID_CLEAR_M : 0;
    backs.push(Math.max(behindLast, behindColumn));
  }
  slotBacks = backs;
}

/**
 * Whether a box of a car's size at a pose touches a barrier or a solid: a still probe body the
 * world's clamps would move.
 * @param pose its middle and heading
 * @param size its length and width, m
 * @returns touching
 */
function boxTouches(pose: { x: number; y: number; h: number }, size: { len: number; wid: number }) {
  const probe = makeCar(TRACTOR_ID);
  probe.spec = { ...probe.spec, len: size.len, wid: size.wid };
  Object.assign(probe, { x: pose.x, y: pose.y, heading: pose.h, vx: 0, vy: 0, yawRate: 0 });
  solidClamp(probe);
  barrierClamp(probe);
  return Math.hypot(probe.x - pose.x, probe.y - pose.y) > TOUCH_M;
}

/**
 * The spot a metre-stepped slide back from the spawn reaches: along the lap where the spawn is on
 * it, else straight back along its heading.
 * @param back m back
 * @returns its middle and heading
 */
function slideSpot(back: number): { x: number; y: number; h: number } {
  const spawn = LEVEL.spawn, sub = LEVEL.subtrack;
  const near = sub ? querySubtrack(sub, spawn.x, spawn.y) : null;
  if (sub && near && near.dist <= sub.width / 2) {
    const total = sub.totalDist, dist = ((near.trackDist - back) % total + total) % total;
    const point = onTrack(sub, dist, 0, {});
    return { x: point.x, y: point.y, h: point.rot };
  }
  return { x: spawn.x - Math.cos(spawn.heading) * back, y: spawn.y - Math.sin(spawn.heading) * back,
    h: spawn.heading };
}

/**
 * A solo start with a towing rig: the first spot back from the spawn where neither the
 * tractor nor its trailer touches a barrier or a solid (null: the spawn is clear, or none is
 * within SLIDE_MAX_M).
 * @param car the player's tractor
 * @returns the spot, or null
 */
export function clearRigSpot(car: Car): { x: number; y: number; h: number } | null {
  if (!isTowing(car)) return null;
  const behind = trailerBehind(car);
  for (let back = 0; back <= SLIDE_MAX_M; back += SLIDE_STEP_M) {
    const spot = slideSpot(back);
    const trailerAt = { x: spot.x - Math.cos(spot.h) * behind.back,
      y: spot.y - Math.sin(spot.h) * behind.back, h: spot.h };
    if (boxTouches(spot, car.spec) || boxTouches(trailerAt, behind)) continue;
    return back ? spot : null;
  }
  return null;
}

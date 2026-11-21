// ai/startFan.ts - ?hwfan: THE HIGHWAY START, FANNED (owner 11-21: "on highway starts they all seem
// to drift to one side and then kinda all weave back over together"). MEASURED
// (tools/scratch/_hwside.mjs, the motorway, every switch off): through the rolling formation the
// race driver under the formation kept planning - every car behind another racer in its column
// "boxed" - and its gap picker chose the one free lane and built a dodge to it; at the green the
// whole field slid into that lane as a block (its mean across -6.3 -> -7.8 m, spread 3.7 -> 8.2
// m), then weaved back as the traffic filled it. Now (the owner's choice, b + the clearing): while
// the start holds a car its planned dodge and picked line are cleared; in its start phase (ai/
// driverLane.ts startK) it holds its formation lane, going round only a car TRULY SLOWER than it,
// and then only to its own column's side - the left column fans out left, the right column right.
// The endless road only (state.roadRead): a circuit's rolling start is as before.
import { FIX } from '../core/fixes.ts';
import { blockOn } from './gapPick.ts';
import type { SeenCar } from './gapPick.ts';
import type { Drv } from './driverCtx.ts';

// the share of my speed under which a car ahead is truly slower (worth going round at the start)
export const FAN_SLOW = 0.8;

/**
 * ?hwfan, while the start holds the car on the endless road: no dodge plan or picked line kept.
 * @param state the driver's state
 * @param held the start holds it this think
 */
export function clearHeldPlan(state: Drv['state'], held: boolean): void {
  if (!FIX.hwfan || !held || !state.roadRead) return;
  state.dodge = 0;
  state.gapBase = null;
}

/**
 * My column's side: the side of the middle of the lanes my lane is on (-1 / 1); in the middle
 * lane, by my seed.
 * @param drv the driver (its line's lanes, its lane, its seed)
 * @returns -1 or 1
 */
function columnSide(drv: Drv): number {
  const lanes = drv.line.lanes, mine = drv.state.laneLat ?? 0;
  if (!lanes || !lanes.length) return drv.traits.seed % 2 ? 1 : -1;
  const middle = (Math.min(...lanes) + Math.max(...lanes)) / 2;
  return Math.abs(mine - middle) < 0.5 ? (drv.traits.seed % 2 ? 1 : -1) : Math.sign(mine - middle);
}

/**
 * ?hwfan, the gap picker in a highway start phase: 'hold' - no pick, my formation lane kept (no
 * truly slower car on my line within reading); else the room cut to my column's side.
 * @param drv the driver
 * @param seen the cars seen
 * @param mine where I am (m off my path), my m/s and reading s, my half width and length, the
 *   start phase left (startK) and the picker's room (lo / hi, m off my path)
 * @returns 'hold', the room to pick in, or null (not in a highway start phase)
 */
export function startFan(drv: Drv, seen: SeenCar[], mine: { myLat: number; speed: number;
  look: number; half: number; len: number; startK: number; lo: number; hi: number }):
  'hold' | { lo: number; hi: number } | null {
  if (!FIX.hwfan || !drv.state.roadRead || !(mine.startK > 0)) return null;
  const { myLat, speed, look, half, len } = mine;
  const slower = seen.filter((other) => other.fwd > 0 && other.fwd < speed * look + 8
    && other.v < FAN_SLOW * speed);
  if (!blockOn(slower, myLat, half, len)) return 'hold';
  const side = columnSide(drv);
  return side < 0 ? { lo: mine.lo, hi: Math.max(mine.lo, Math.min(mine.hi, myLat)) }
    : { lo: Math.min(mine.hi, Math.max(mine.lo, myLat)), hi: mine.hi };
}

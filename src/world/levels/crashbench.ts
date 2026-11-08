// world/levels/crashbench.ts - FESTIVAL OF SPLAT: the physics under load, to watch (owner 11-08:
// "slams 20 ai cars in two rows of 10 into a 3 deep by 100 wide tyre wall against an Armco at like
// 120mph"; "link me to watch the test so I can see how it runs on phone"). A bare tarmac floor, an
// Armco line 110 m long and in front of it a wall of tyre stacks 3 deep and 100 wide; twenty cars
// in two rows of 10 launched at it at 120 mph (game/crashbench.ts: you are the middle of the back
// row, the rest held flat out). tools/crashbench.mjs runs the same scene headless and times it.
import { SURFACES } from "../surfaces.ts";
import type { Cone, Level } from "../types.ts";

// m/s: 120 mph
export const BENCH_LAUNCH = 120 * 0.44704;
// the Armco's y and half its length; the tyre rows in front of it, half the wall's width; the two
// rows of cars behind, 10 a row this far apart, heading +y at the wall
export const BENCH_ARMCO_Y = 0, BENCH_ARMCO_HALF = 55;
export const BENCH_TYRE_ROWS = [-1.2, -2.2, -3.2], BENCH_WALL_HALF = 50;
export const BENCH_CAR_ROWS = [-70, -82], BENCH_CAR_GAP = 10, BENCH_PER_ROW = 10;
// your car: the back row's middle slot
export const BENCH_YOU = { row: 1, slot: 5 };

/**
 * Where the bench's car in a slot starts.
 * @param row 0 the front row, 1 the back
 * @param slot 0..9 across
 * @returns the start, heading at the wall
 */
export const benchSlot = (row: number, slot: number) => ({
  x: -(BENCH_PER_ROW - 1) * BENCH_CAR_GAP / 2 + slot * BENCH_CAR_GAP, y: BENCH_CAR_ROWS[row],
  heading: Math.PI / 2 });

/**
 * The tyre wall: 3 rows of stacks 1 m apart, 100 wide.
 * @returns the stacks
 */
function tyreWall(): Cone[] {
  const stacks: Cone[] = [];
  for (const rowY of BENCH_TYRE_ROWS)
    for (let x = -BENCH_WALL_HALF + 0.5; x < BENCH_WALL_HALF; x += 1)
      stacks.push({ kind: 'tyrestack', x, y: rowY } as Cone);
  return stacks;
}

const you = benchSlot(BENCH_YOU.row, BENCH_YOU.slot);
export const CRASH_BENCH_LEVEL = {
  id: 'crash-bench', name: 'Festival of Splat', base: SURFACES.tarmac, zones: [], bumps: [],
  paint: [], boards: [], cones: tyreWall(), props: [], solids: [],
  barriers: [{ kind: 'armco', pts: [[-BENCH_ARMCO_HALF, BENCH_ARMCO_Y],
    [BENCH_ARMCO_HALF, BENCH_ARMCO_Y]] }],
  spawn: { x: you.x, y: you.y, heading: you.heading },
} as unknown as Level;

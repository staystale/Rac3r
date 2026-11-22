// highway/hillgrade.ts - A HILL CLIMB'S GRADE (owner 11-22: Pikes Peak style, a real climb of 7 %
// on average, 10 % in the switchbacks): the ground's rise along the road's distance
// (world/types.ts Level.climb, added to every ground point at its nearest point of the road:
// world/terrain.ts bumpAt). The physics already feels it - world/wear.ts applySlopeForces pulls a
// car down the slope (m g sin of the grade along it). Step 1 (?hillgrade): the endless road a
// constant HILL_GRADE, to measure the engine piece alone (tools/scratch/_hillgrade.mjs).
import { FIX } from '../core/fixes.ts';

// the climb's rise per m along the road (Pikes Peak's average: 1,440 m in 19.99 km)
export const HILL_GRADE = 0.07;

/**
 * The endless road's climb: ?hillgrade's constant grade, else none.
 * @returns m risen at a road distance, or undefined
 */
export function climbOf(): ((dist: number) => number) | undefined {
  return FIX.hillgrade ? (dist: number) => HILL_GRADE * dist : undefined;
}

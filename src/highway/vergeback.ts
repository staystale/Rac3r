// highway/vergeback.ts - WHERE A RESET PUTS YOU on a road with no hard shoulder (?vergereset=1;
// owner 11-10 on Deaf Valley: resets "seem to sometimes set on a road ? Is that intentional or an
// issue ?", "it seems like there isn't many lay-bys and it's quite hard to make progress", "More
// reset spaces ... just off the road / half on half off is fine in some areas if there isn't much
// room"). Was: the last lay-by behind, however far, and with none left in the road's window the
// shoulder's offset - inside the lane's edge; and back to the same lay-by again and again
// (MEASURED, tools/scratch/_vergespots.mjs: a reset every 6 s, all 20 to the lay-by 87 m back).
// Now: a lay-by
// just behind (BAY_NEAR_M); else the verge where you are - the car clear off the road where the
// ground has room (no barrier, no rock, no drop), half on / half off where it has not, a
// VERGE_STEP_M further back each try; else a lay-by within BAY_FAR_M; the road last.
import { FIX } from '../core/fixes.ts';
import { roadPose } from '../highway.ts';
import { bayBehind, laybysOn } from './laybys.ts';
import { isFarFrom } from '../world/barriers.ts';
import type { HwLevel } from './hwtypes.ts';
import type { Barrier } from '../world/types.ts';

// m behind a reset a lay-by is gone back to before the verge, and after it; m further back each
// verge try, and how many tries
const BAY_NEAR_M = 40, BAY_FAR_M = 150, VERGE_STEP_M = 10, VERGE_TRIES = 15;
// m past the road edge a car's centre sits off the road / half on half off; m round it kept clear
// of a barrier; m the ground may fall below the road's edge there
const OFF_M = 1.6, HALF_ON_M = 0.1, CLEAR_M = 1.5, DROP_M = 0.6;

/**
 * Whether a car fits at a spot: no barrier (a rock wall, Armco) within CLEAR_M of its middle or of
 * its ends, the ground not fallen away below the road's edge (a gorge).
 * @param level the highway level
 * @param dist road distance, m
 * @param off m off the road's line
 * @returns room
 */
function roomAt(level: HwLevel, dist: number, off: number): boolean {
  const pose = roadPose(level, dist, off), half = level._hw.geo.hw;
  const ends = [-2, 0, 2].map((along) => [pose.x + Math.cos(pose.h) * along,
    pose.y + Math.sin(pose.h) * along]);
  for (const barrier of (level as unknown as { barriers?: Barrier[] }).barriers || []) {
    if (isFarFrom(barrier, pose.x, pose.y, 6)) continue;
    for (let i = 0; i + 1 < barrier.pts.length; i++) {
      const [fromX, fromY] = barrier.pts[i], [toX, toY] = barrier.pts[i + 1];
      for (const [x, y] of ends) {
        const dx = toX - fromX, dy = toY - fromY, len2 = dx * dx + dy * dy || 1e-9,
          frac = Math.max(0, Math.min(1, ((x - fromX) * dx + (y - fromY) * dy) / len2));
        if (Math.hypot(x - fromX - frac * dx, y - fromY - frac * dy) < CLEAR_M) return false;
      }
    }
  }
  const ground = (level as unknown as { roadside?: (s: number, o: number, h: number,
    at: { x: number; y: number }) => number }).roadside;
  if (ground) {
    const edge = roadPose(level, dist, -half);
    if (ground(dist, -half, half, edge) - ground(dist, off, half, pose) > DROP_M) return false;
  }
  return true;
}

/**
 * The reset spot on a road with no hard shoulder (?vergereset=1), or null to keep the old rule:
 * a lay-by within BAY_NEAR_M behind (one free), else the verge off the road or half on, else a
 * lay-by within BAY_FAR_M.
 * @param level the highway level
 * @param dist road distance the reset is for, m
 * @param floor the least road distance still laid (the window's start)
 * @param free whether a lay-by spot is clear of cars
 * @returns road distance and offset, or null
 */
export function vergeBack(level: HwLevel, dist: number, floor: number,
  free?: (at: number) => boolean): { s: number; off: number } | null {
  if (!FIX.vergereset || !laybysOn(level)) return null;
  const near = bayBehind(level, dist, free, Math.max(floor, dist - BAY_NEAR_M));
  if (near) return near;
  const half = level._hw.geo.hw;
  for (let tries = 0; tries < VERGE_TRIES; tries++) {
    const spot = Math.max(floor, dist - tries * VERGE_STEP_M);
    for (const off of [-(half + OFF_M), -(half + HALF_ON_M)])
      if (roomAt(level, spot, off)) return { s: spot, off };
  }
  return bayBehind(level, dist, free, Math.max(floor, dist - BAY_FAR_M));
}

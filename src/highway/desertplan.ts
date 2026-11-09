// highway/desertplan.ts - DEAF VALLEY's STRETCHES by road distance (highway/canyon.ts dresses them;
// owner 11-09: "higher up canyon parts where there's steep drops on one or both sides sometimes
// with or without barriers and windier roads", "I didn't see any sections that acted high up with
// slopey terrain or rocky valleys to the side"): a CANYON (CANYON_M, rock walls each side), the
// HIGH road (HIGH_M, a ledge with a gorge falling away one side or both - highway/gorge.ts), then
// the OPEN DESERT (DESERT_M, a dry wash beside the road and slopes). The same road distance is
// always the same stretch, so every dress call, the ground and the road shape agree.
import type { HwCfg } from './hwtypes.ts';

// (owner 11-09 on the canyons: "maybe slightly less frequent / shorter sections": 900 -> 500 m,
// the open desert 600 -> 900)
export const CANYON_M = 500, HIGH_M = 800, DESERT_M = 900;
export const CYCLE = CANYON_M + HIGH_M + DESERT_M;

/** Which stretch a road distance is in, how far into it, and which one of its kind. */
export interface Stretch { kind: 'canyon' | 'high' | 'desert'; along: number; len: number;
  index: number }

/**
 * The stretch at a road distance.
 * @param dist road distance, m
 * @returns its kind, m into it, its length and its number
 */
export function stretchAt(dist: number): Stretch {
  const index = Math.floor(dist / CYCLE), into = dist - index * CYCLE;
  if (into < CANYON_M) return { kind: 'canyon', along: into, len: CANYON_M, index };
  if (into < CANYON_M + HIGH_M)
    return { kind: 'high', along: into - CANYON_M, len: HIGH_M, index };
  return { kind: 'desert', along: into - CANYON_M - HIGH_M, len: DESERT_M, index };
}

/**
 * 0 at a stretch's ends rising to 1 over `over` m in from each (smooth).
 * @param stretch the stretch
 * @param over m
 * @returns 0..1
 */
export function inFrom(stretch: Stretch, over: number): number {
  const frac = Math.max(0, Math.min(1, Math.min(stretch.along, stretch.len - stretch.along)
    / over));
  return frac * frac * (3 - 2 * frac);
}

// the HIGH road's shape: tighter bends, few straights, and a curvature allowed to change four
// times as fast as the canyon's (road.ts nextElement: a hairpin of R 40 needs a short ramp)
const HIGH_ROAD: Partial<HwCfg> = { sweep: [90, 200], bend: [40, 90], pStraight: 0.06,
  pBend: 0.6, kRate: 4e-4 };
// the OPEN DESERT's: long straights (owner 11-09: "maybe some straight road sections too"), wide
// sweepers between them
const DESERT_ROAD: Partial<HwCfg> = { sweep: [350, 800], pStraight: 0.55, pBend: 0.1 };

/**
 * Deaf Valley's road type by road distance: the HIGH road windier, the open desert straighter
 * (presets.ts canyon.stretch).
 * @param dist road distance, m
 * @returns the stretch's changes, or null (the canyon: the road type's own)
 */
export function desertRoadAt(dist: number): Partial<HwCfg> | null {
  const kind = stretchAt(dist).kind;
  return kind === 'high' ? HIGH_ROAD : kind === 'desert' ? DESERT_ROAD : null;
}

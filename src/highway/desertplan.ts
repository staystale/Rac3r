// highway/desertplan.ts - DEAF VALLEY's STRETCHES by road distance (highway/canyon.ts dresses them;
// owner 11-09: "higher up canyon parts where there's steep drops on one or both sides sometimes
// with or without barriers and windier roads", "I didn't see any sections that acted high up with
// slopey terrain or rocky valleys to the side", "endless roads should cycle randomly between their
// potential next track sections so it always varies", "sand dunes yeah"): a CANYON (rock walls
// each side), the HIGH road (a ledge with a gorge falling away one side or both: highway/gorge.ts),
// the OPEN DESERT (a dry wash beside the road or a rise, rolling ground) and the DUNES - in a
// random order (never the same twice running) and random lengths, from the road's seed: the same
// road distance on the same road is always the same stretch, so every dress call, the ground and
// the road shape agree.
import type { HwCfg } from './hwtypes.ts';
import { makeStretchPlan, inFrom } from './stretchplan.ts';
import type { KindRule, PlanStretch } from './stretchplan.ts';

export type StretchKind = 'canyon' | 'high' | 'desert' | 'dunes';
/** A stretch: its kind, m into it, its length and its number along the road. */
export type Stretch = PlanStretch<StretchKind>;
export { inFrom };

// each kind's length range, m, and how often it is picked next (owner 11-09 on the canyons:
// "slightly less frequent / shorter sections")
const KINDS: Record<StretchKind, KindRule> = {
  canyon: { min: 350, max: 600, weight: 0.8 },
  high: { min: 600, max: 1000, weight: 1 },
  desert: { min: 500, max: 1100, weight: 1.2 },
  dunes: { min: 400, max: 800, weight: 0.8 },
};

/**
 * The stretch at a road distance on a road (the first a canyon, the start: highway/stretchplan.ts).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns its kind, m into it, its length and its number
 */
export const stretchAt: (dist: number, seed: number) => Stretch = makeStretchPlan(KINDS,
  'canyon', 500);

// the HIGH road's shape: tighter bends, few straights, and a curvature allowed to change four
// times as fast as the canyon's (road.ts nextElement: a hairpin of R 40 needs a short ramp)
const HIGH_ROAD: Partial<HwCfg> = { sweep: [90, 200], bend: [40, 90], pStraight: 0.06,
  pBend: 0.6, kRate: 4e-4 };
// the OPEN DESERT's and the DUNES': long straights (owner 11-09: "maybe some straight road sections
// too"), wide sweepers between them
const DESERT_ROAD: Partial<HwCfg> = { sweep: [350, 800], pStraight: 0.55, pBend: 0.1 };

/**
 * Deaf Valley's road type by road distance: the HIGH road windier, the open desert and the dunes
 * straighter (presets.ts canyon.stretch).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns the stretch's changes, or null (the canyon: the road type's own)
 */
export function desertRoadAt(dist: number, seed: number): Partial<HwCfg> | null {
  const kind = stretchAt(dist, seed).kind;
  return kind === 'high' ? HIGH_ROAD : kind === 'canyon' ? null : DESERT_ROAD;
}

// ?hwpick=1: a wide road's (a motorway's) open desert and dunes - longer straights, its own sweeps
const DESERT_WIDE: Partial<HwCfg> = { pStraight: 0.55, pBend: 0.1 };

/**
 * Deaf Valley's changes to a WIDE road by road distance (?hwpick=1: a motorway, a dual carriageway
 * there): the open desert and the dunes straighter; the canyons and the high road its own bends
 * (a hairpin is the twisty road's: desertRoadAt).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns the stretch's changes, or null
 */
export function desertWideAt(dist: number, seed: number): Partial<HwCfg> | null {
  const kind = stretchAt(dist, seed).kind;
  return kind === 'desert' || kind === 'dunes' ? DESERT_WIDE : null;
}

/**
 * A desert stretch's petrol station (highway/canyon.ts gasStation): three stretches in five have
 * one, 44-48 m in, on a side - the same pick every visit.
 * @param index the stretch's number
 * @param seed the road's seed
 * @returns its side (-1 / +1), or null: none
 */
export function stationSideOf(index: number, seed: number): number | null {
  const pick = Math.abs(Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453) % 1;
  return pick > 0.6 ? null : pick < 0.3 ? 1 : -1;
}

/**
 * Whether a road distance is by a petrol station's forecourt or its ways in and out on a side (a
 * lay-by keeps off it: highway/laybys.ts).
 * @param dist road distance, m
 * @param side -1 / +1
 * @param seed the road's seed
 * @returns true when it is
 */
export function byStation(dist: number, side: number, seed: number): boolean {
  const stretch = stretchAt(dist, seed);
  return stretch.kind === 'desert' && stretch.along > 8 && stretch.along < 90
    && stationSideOf(stretch.index, seed) === side;
}

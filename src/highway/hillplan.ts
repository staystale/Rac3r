// highway/hillplan.ts - THE HILL CLIMB'S ROAD (?hillclimb; owner 11-22: Pikes Peak style, 5 km
// fixed, a real 7 % climb - 10 % in the switchbacks -, 3-5 hairpins a cluster, drops at the
// outside edges, barriers only at the worst corners, the summit the finish with a stop zone). Its
// stretches by road distance (highway/stretchplan.ts, as Deaf Valley's and GETAWAY STOCKHOLM's):
// SWEEPERS, ESSES, a SWITCHBACK cluster (a "W": road.ts switchbackElements) and a short STRAIGHT,
// each with its own bends and grade (gradeOf, by the road kind each point was laid as - a
// switchback cluster's own elements its 10 %); the ground's rise along the road from them (the
// ground off the road: highway/hillground.ts).
import type { HwCfg } from './hwtypes.ts';
import { makeStretchPlan } from './stretchplan.ts';
import type { KindRule, PlanStretch } from './stretchplan.ts';

// the hill climb's name (a parody; the owner's pick 11-22 - one word to change)
export const HILL_NAME = 'SPIKES PEAK';
// m from the start line to the summit's finish line; m of level stop zone past it
export const HILL_LENGTH_M = 5000, HILL_STOP_M = 300;

export type HillKind = 'sweepers' | 'esses' | 'switchbacks' | 'straight';
/** A stretch: its kind, m into it, its length and its number along the road. */
export type HillStretch = PlanStretch<HillKind>;

// each kind's length range, m, and how often it is picked next
const KINDS: Record<HillKind, KindRule> = {
  sweepers: { min: 300, max: 600, weight: 1 },
  esses: { min: 250, max: 450, weight: 1 },
  switchbacks: { min: 550, max: 800, weight: 0.8 },
  straight: { min: 100, max: 200, weight: 0.5 },
};

/**
 * The stretch at a road distance (the first a straight: the start).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns its kind, m into it, its length and its number
 */
export const hillStretchAt: (dist: number, seed: number) => HillStretch = makeStretchPlan(KINDS,
  'straight', 400);

// each kind's grade (rise per m along the road): 10 % in the switchbacks, ~7 % over the climb (at
// 6 / 7 / 10 / 6 % the 5 km averaged 7.6-8.1 %, _hillroad.mjs: eased)
const GRADE: Record<HillKind, number> = {
  sweepers: 0.05, esses: 0.06, switchbacks: 0.10, straight: 0.05,
};

// each kind's road shape (road.ts nextElement): radius ranges, m, and the chances of a straight
// and of a tight bend
const SHAPES: Record<HillKind, Partial<HwCfg>> = {
  sweepers: { sweep: [120, 260], bend: [80, 120], pStraight: 0.15, pBend: 0.3, maxDeg: 60 },
  esses: { sweep: [60, 110], bend: [40, 70], pStraight: 0.05, pBend: 0.6, maxDeg: 70 },
  switchbacks: { bend: [40, 70] },
  straight: { sweep: [500, 900], pStraight: 0.9, pBend: 0, maxDeg: 40 },
};
// each kind's CLUSTER of bends (road.ts switchbackElements; the stretch's own shape above for
// what is left of it): its turns' radius and its legs' length ranges (m), its legs' heading off
// straight up (deg - each turn twice that), m of stretch a turn and the most and fewest turns -
// the switchbacks' hairpins; the esses' S-bends; the sweepers' long sweeps (the road's own
// lean-holding element runs left long, near-straight diagonals: stiff)
const CLUSTERS: Partial<Record<HillKind, { radius: number[]; leg: number[]; legDeg: number;
  each: number; turns: number[] }>> = {
  switchbacks: { radius: [14, 20], leg: [50, 110], legDeg: 80, each: 150, turns: [3, 5] },
  esses: { radius: [40, 70], leg: [20, 60], legDeg: 35, each: 80, turns: [3, 6] },
  sweepers: { radius: [120, 250], leg: [40, 120], legDeg: 20, each: 150, turns: [2, 4] },
};

/**
 * The hill climb's road shape at a road distance (presets.ts sceneryCfg's stretch hook).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns the stretch's changes
 */
export function hillRoadAt(dist: number, seed: number): Partial<HwCfg> {
  const stretch = hillStretchAt(dist, seed), shape = SHAPES[stretch.kind];
  const cluster = CLUSTERS[stretch.kind];
  // (what the cluster leaves of a stretch: its own shape - a switchbacks stretch's, esses)
  const tag = stretch.kind === 'switchbacks' ? 'esses' : stretch.kind;
  if (!cluster) return { ...shape, tag };
  const turns = Math.max(cluster.turns[0], Math.min(cluster.turns[1],
    Math.floor(stretch.len / cluster.each)));
  return { ...shape, tag, switchbacks: { index: stretch.index, hairpins: turns,
    radius: cluster.radius, leg: cluster.leg, legDeg: cluster.legDeg, tag: stretch.kind } };
}

/**
 * The grade of a road kind (a laid road point's tag: road.ts; none - the start's run-up - a
 * straight's).
 * @param tag the road kind
 * @returns the rise per m along the road
 */
export const gradeOf = (tag?: string): number => GRADE[(tag || 'straight') as HillKind]
  ?? GRADE.straight;

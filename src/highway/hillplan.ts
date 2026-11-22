// highway/hillplan.ts - THE HILL CLIMB'S ROAD (?hillclimb; owner 11-22: Pikes Peak style, 5 km
// fixed, a real 7 % climb - 10 % in the switchbacks -, 3-5 hairpins a cluster, drops at the
// outside edges, barriers only at the worst corners, the summit the finish with a stop zone). Its
// stretches by road distance (highway/stretchplan.ts, as Deaf Valley's and GETAWAY STOCKHOLM's):
// SWEEPERS, ESSES, a SWITCHBACK cluster (a "W": road.ts switchbackElements) and a short STRAIGHT,
// each with its own bends and grade; the ground's rise along the road from them (riseAt; the
// ground off the road: highway/hillground.ts).
import type { HwCfg } from './hwtypes.ts';
import { makeStretchPlan } from './stretchplan.ts';
import type { KindRule, PlanStretch } from './stretchplan.ts';

// the hill climb's name (a parody: the owner picks - one word to change)
export const HILL_NAME = "PIKER'S PEAK";
// m from the start line to the summit's finish line; m of level stop zone past it
export const HILL_LENGTH_M = 5000, HILL_STOP_M = 300;

export type HillKind = 'sweepers' | 'esses' | 'switchbacks' | 'straight';
/** A stretch: its kind, m into it, its length and its number along the road. */
export type HillStretch = PlanStretch<HillKind>;

// each kind's length range, m, and how often it is picked next
const KINDS: Record<HillKind, KindRule> = {
  sweepers: { min: 300, max: 600, weight: 1 },
  esses: { min: 250, max: 450, weight: 1 },
  switchbacks: { min: 550, max: 800, weight: 1.1 },
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

// each kind's grade (rise per m along the road): 10 % in the switchbacks, ~7 % over the climb
const GRADE: Record<HillKind, number> = {
  sweepers: 0.06, esses: 0.07, switchbacks: 0.10, straight: 0.06,
};

// each kind's road shape (road.ts nextElement): radius ranges, m, and the chances of a straight
// and of a tight bend; a switchback cluster's hairpins (R 14-20 m), its legs (50-110 m) running
// 80 deg off straight up, one hairpin for each ~150 m of its stretch (3-5)
const SHAPES: Record<HillKind, Partial<HwCfg>> = {
  sweepers: { sweep: [120, 260], bend: [80, 120], pStraight: 0.15, pBend: 0.3, maxDeg: 60 },
  esses: { sweep: [60, 110], bend: [40, 70], pStraight: 0.05, pBend: 0.6, maxDeg: 70 },
  switchbacks: { bend: [40, 70] },
  straight: { sweep: [500, 900], pStraight: 0.9, pBend: 0, maxDeg: 40 },
};
const HAIRPIN_R_M = [14, 20], LEG_M = [50, 110], LEG_DEG = 80, M_A_HAIRPIN = 150;

/**
 * The hill climb's road shape at a road distance (presets.ts sceneryCfg's stretch hook).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns the stretch's changes
 */
export function hillRoadAt(dist: number, seed: number): Partial<HwCfg> {
  const stretch = hillStretchAt(dist, seed), shape = SHAPES[stretch.kind];
  if (stretch.kind !== 'switchbacks') return shape;
  const hairpins = Math.max(3, Math.min(5, Math.floor(stretch.len / M_A_HAIRPIN)));
  return { ...shape, switchbacks: { index: stretch.index, hairpins, radius: HAIRPIN_R_M,
    leg: LEG_M, legDeg: LEG_DEG } };
}

// per road seed: each stretch's start (m) and the ground's rise there (m), laid as asked
const RISES = new Map<number, { starts: number[]; rise: number[] }>();

/**
 * The ground's rise at a road distance: each stretch's grade over its length, from the road's
 * start to the summit's finish line, level past it (the stop zone and on).
 * @param dist road distance, m
 * @param seed the road's seed
 * @param finishS the finish line's road distance, m
 * @returns m risen
 */
export function riseAt(dist: number, seed: number, finishS: number): number {
  const upTo = Math.max(0, Math.min(dist, finishS)), here = hillStretchAt(upTo, seed);
  let known = RISES.get(seed);
  if (!known) RISES.set(seed, (known = { starts: [0], rise: [0] }));
  while (known.starts.length <= here.index) {
    const last = known.starts.length - 1, stretch = hillStretchAt(known.starts[last], seed);
    known.starts.push(known.starts[last] + stretch.len);
    known.rise.push(known.rise[last] + GRADE[stretch.kind] * stretch.len);
  }
  return known.rise[here.index] + GRADE[here.kind] * here.along;
}

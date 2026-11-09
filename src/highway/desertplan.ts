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

export type StretchKind = 'canyon' | 'high' | 'desert' | 'dunes';
/** A stretch: its kind, m into it, its length and its number along the road. */
export interface Stretch { kind: StretchKind; along: number; len: number; index: number }

// each kind's length range, m, and how often it is picked next (owner 11-09 on the canyons:
// "slightly less frequent / shorter sections")
const KINDS: Record<StretchKind, { min: number; max: number; weight: number }> = {
  canyon: { min: 350, max: 600, weight: 0.8 },
  high: { min: 600, max: 1000, weight: 1 },
  desert: { min: 500, max: 1100, weight: 1.2 },
  dunes: { min: 400, max: 800, weight: 0.8 },
};
const ORDER = Object.keys(KINDS) as StretchKind[];

/** A road's plan: the stretches laid so far (starts ascending) and its random stream. */
interface Plan { starts: number[]; list: { kind: StretchKind; len: number }[]; rand: () => number }
const PLANS = new Map<number, Plan>();

/**
 * A seeded random stream (a road's plan is the same every visit).
 * @param seed the seed
 * @returns 0..1 numbers
 */
function streamOf(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mix = Math.imul(state ^ (state >>> 15), state | 1);
    mix ^= mix + Math.imul(mix ^ (mix >>> 7), mix | 61);
    return ((mix ^ (mix >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A road's plan laid out at least to a road distance: the first stretch a canyon (the start), each
 * next one picked by weight from the other kinds.
 * @param seed the road's seed
 * @param dist road distance, m
 * @returns the plan
 */
function planTo(seed: number, dist: number): Plan {
  let plan = PLANS.get(seed);
  if (!plan) {
    plan = { starts: [0], list: [{ kind: 'canyon', len: 500 }], rand: streamOf(seed) };
    PLANS.set(seed, plan);
  }
  while (plan.starts[plan.starts.length - 1] + plan.list[plan.list.length - 1].len <= dist) {
    const last = plan.list[plan.list.length - 1],
      kinds = ORDER.filter((kind) => kind !== last.kind),
      total = kinds.reduce((sum, kind) => sum + KINDS[kind].weight, 0);
    let pick = plan.rand() * total, kind = kinds[kinds.length - 1];
    for (const each of kinds) if ((pick -= KINDS[each].weight) < 0) { kind = each; break; }
    const { min, max } = KINDS[kind];
    plan.starts.push(plan.starts[plan.starts.length - 1] + last.len);
    plan.list.push({ kind, len: Math.round(min + plan.rand() * (max - min)) });
  }
  return plan;
}

/**
 * The stretch at a road distance on a road.
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns its kind, m into it, its length and its number
 */
export function stretchAt(dist: number, seed: number): Stretch {
  const plan = planTo(seed, Math.max(0, dist)), starts = plan.starts;
  let low = 0, high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (starts[mid] <= dist) low = mid; else high = mid - 1;
  }
  return { kind: plan.list[low].kind, along: Math.max(0, dist - starts[low]),
    len: plan.list[low].len, index: low };
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

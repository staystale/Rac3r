// highway/medians.ts - THE CENTRAL RESERVATION'S BARRIER along a road (?medians=1; owner 11-09:
// "can some roads have chain link fences or wooden fences or armco for the central reservation /
// Vary it randomly and appropriate to track"): each road type's own mix (presets.ts cfg.medians -
// a motorway's concrete Jersey barrier and Armco, a dual carriageway's Armco, chain link and
// wooden fences), the kind changing every STRETCH_M by the road's seed, never the same twice
// running; with the switch off, cfg.median all the way.
import { FIX } from "../core/fixes.ts";
import type { BarrierKind } from "../world/types.ts";
import type { HwCfg } from "./hwtypes.ts";

// m: the shortest and longest stretch of one kind
const STRETCH_M: [number, number] = [800, 2500];

/** A road's plan so far: where each stretch ends, its kind, and the plan's random state. */
interface MedianPlan { ends: number[]; kinds: BarrierKind[]; state: number }
const PLANS = new Map<string, MedianPlan>();

/**
 * The central reservation's barrier at a road distance.
 * @param cfg the road type (its median, and its mix)
 * @param seed the road's seed
 * @param dist m along the road
 * @returns the barrier's kind
 */
export function medianAt(cfg: HwCfg, seed: number, dist: number): BarrierKind {
  const mix = cfg.medians;
  if (!FIX.medians || !mix || !mix.length) return cfg.median || 'armco';
  const key = `${seed}:${mix.map(([kind, weight]) => kind + weight).join(',')}`;
  let plan = PLANS.get(key);
  if (!plan) PLANS.set(key, plan = { ends: [], kinds: [], state: (seed ^ 0x2545f491) >>> 0 || 1 });
  const rand = () => (plan!.state = (plan!.state * 16807) % 2147483647) / 2147483647;
  while (!plan.ends.length || plan.ends[plan.ends.length - 1] <= dist) {
    const last = plan.kinds[plan.kinds.length - 1];
    const next = mix.length > 1 ? mix.filter(([kind]) => kind !== last) : mix;
    let pick = rand() * next.reduce((sum, [, weight]) => sum + weight, 0), kind = next[0][0];
    for (const [each, weight] of next) if ((pick -= weight) < 0) { kind = each; break; }
    plan.kinds.push(kind);
    plan.ends.push((plan.ends[plan.ends.length - 1] || 0) + STRETCH_M[0]
      + rand() * (STRETCH_M[1] - STRETCH_M[0]));
  }
  let idx = 0;
  while (plan.ends[idx] <= dist) idx++;
  return plan.kinds[idx];
}

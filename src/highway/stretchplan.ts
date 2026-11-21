// highway/stretchplan.ts - A SCENERY'S STRETCHES by road distance (owner 11-09: "endless roads
// should cycle randomly between their potential next track sections so it always varies"): from a
// table of kinds - each with its length range and how often it is picked next - a road's plan in a
// random order (never the same kind twice running) and random lengths, from the road's seed: the
// same road distance on the same road is always the same stretch, so every dress call, the ground
// and the road shape agree. Deaf Valley's (highway/desertplan.ts) and GETAWAY STOCKHOLM's
// (highway/cityplan.ts).

/** A stretch: its kind, m into it, its length and its number along the road. */
export interface PlanStretch<Kind extends string> {
  kind: Kind; along: number; len: number; index: number;
}
/** A kind's length range, m, and how often it is picked next. */
export interface KindRule { min: number; max: number; weight: number }

/** A road's plan: the stretches laid so far (starts ascending) and its random stream. */
interface Plan<Kind> { starts: number[]; list: { kind: Kind; len: number }[]; rand: () => number }

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
 * A scenery's stretch plan: its first stretch, then each next one picked by weight from the other
 * kinds.
 * @param kinds each kind's rule (its order is the pick's)
 * @param first the first stretch's kind
 * @param firstLen its length, m
 * @returns the stretch at a road distance on a road (road distance m, the road's seed)
 */
export function makeStretchPlan<Kind extends string>(kinds: Record<Kind, KindRule>, first: Kind,
  firstLen: number): (dist: number, seed: number) => PlanStretch<Kind> {
  const order = Object.keys(kinds) as Kind[], plans = new Map<number, Plan<Kind>>();
  const planTo = (seed: number, dist: number): Plan<Kind> => {
    let plan = plans.get(seed);
    if (!plan) {
      plan = { starts: [0], list: [{ kind: first, len: firstLen }], rand: streamOf(seed) };
      plans.set(seed, plan);
    }
    while (plan.starts[plan.starts.length - 1] + plan.list[plan.list.length - 1].len <= dist) {
      const last = plan.list[plan.list.length - 1],
        others = order.filter((kind) => kind !== last.kind),
        total = others.reduce((sum, kind) => sum + kinds[kind].weight, 0);
      let pick = plan.rand() * total, kind = others[others.length - 1];
      for (const each of others) if ((pick -= kinds[each].weight) < 0) { kind = each; break; }
      const { min, max } = kinds[kind];
      plan.starts.push(plan.starts[plan.starts.length - 1] + last.len);
      plan.list.push({ kind, len: Math.round(min + plan.rand() * (max - min)) });
    }
    return plan;
  };
  return (dist: number, seed: number): PlanStretch<Kind> => {
    const plan = planTo(seed, Math.max(0, dist)), starts = plan.starts;
    let low = 0, high = starts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (starts[mid] <= dist) low = mid; else high = mid - 1;
    }
    return { kind: plan.list[low].kind, along: Math.max(0, dist - starts[low]),
      len: plan.list[low].len, index: low };
  };
}

/**
 * 0 at a stretch's ends rising to 1 over `over` m in from each (smooth).
 * @param stretch the stretch
 * @param stretch.along m into it
 * @param stretch.len its length, m
 * @param over m
 * @returns 0..1
 */
export function inFrom(stretch: { along: number; len: number }, over: number): number {
  const frac = Math.max(0, Math.min(1, Math.min(stretch.along, stretch.len - stretch.along)
    / over));
  return frac * frac * (3 - 2 * frac);
}

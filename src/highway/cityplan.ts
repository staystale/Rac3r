// highway/cityplan.ts - GETAWAY STOCKHOLM's STRETCHES by road distance (owner 11-21 on step 1:
// "very boring and not varied enough ... varying road terrain, more tunnels and bridges ... like a
// city, much busier"): its plan is Deaf Valley's mechanism (highway/stretchplan.ts) with the
// city's kinds - CITY (dense blocks of buildings), a TUNNEL (the road walled in under slats,
// Moanaco's), WATER (the road on a long bridge over open water), RAISED (an embankment: the ground
// falls away both sides),
// a CUTTING (the ground rises both sides behind retaining walls) and, now and then, a short GREEN
// park - in a random order, never the same twice running. And the ground beside the road by
// stretch (Level.roadside, as Deaf Valley's highway/gorge.ts desertGround): below the road on a
// raised stretch, above it in a cutting and over a tunnel, eased in and out at the ends.
import { makeStretchPlan, inFrom } from './stretchplan.ts';
import type { KindRule, PlanStretch } from './stretchplan.ts';
import type { BarrierKind } from '../world/types.ts';
import { REACH } from './gorge.ts';

export type CityKind = 'city' | 'tunnel' | 'water' | 'raised' | 'cutting' | 'green';
/** A city stretch: its kind, m into it, its length and its number along the road. */
export type CityStretch = PlanStretch<CityKind>;

// each kind's length range, m, and how often it is picked next: the city between every other
// stretch most of the time, a park rare and short (owner: "little open green")
// (owner 11-21: "I didn't see any slatted bridges or tunnels" - MEASURED, _citybridges.mjs: 0.29
// tunnels a km; the tunnels now the likeliest after the city, its blocks shorter)
const KINDS: Record<CityKind, KindRule> = {
  city: { min: 350, max: 700, weight: 2 },
  tunnel: { min: 250, max: 450, weight: 2 },
  water: { min: 350, max: 650, weight: 0.9 },
  raised: { min: 250, max: 500, weight: 0.6 },
  cutting: { min: 250, max: 450, weight: 0.6 },
  green: { min: 150, max: 250, weight: 0.25 },
};

/**
 * The city's stretch at a road distance on a road (the first the city, the start).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns its kind, m into it, its length and its number
 */
export const cityStretchAt: (dist: number, seed: number) => CityStretch = makeStretchPlan(KINDS,
  'city', 700);

// m: an embankment's drop and a cutting's (and a tunnel's ground's) rise beside the road; the
// verge before the ground starts to fall or rise (a cutting's: behind its retaining wall); the
// slope's width; and the ease at each end of the stretch
const RAISE_M = 6, CUT_M = 5, RAISE_VERGE_M = 2.5, CUT_VERGE_M = 1.4, SLOPE_M = 7;
const EASE_M = 70;
// m the ground eases back to the road's level before the road's lookup ends (REACH past its edge,
// as Deaf Valley's: past it the ground is flat - no step)
const FAR_FADE_M = 12;

/**
 * 0 at the slope's top, 1 at its foot (smooth), m past its start.
 * @param from m past the road edge it starts
 * @param past m past the road edge
 * @returns 0..1
 */
function slopeShare(from: number, past: number): number {
  const frac = Math.max(0, Math.min(1, (past - from) / SLOPE_M));
  return frac * frac * (3 - 2 * frac);
}

/**
 * The ground beside the road in the city (Level.roadside): an embankment's fall, a cutting's or a
 * tunnel's rise, else flat.
 * @param dist road distance, m
 * @param offset m off the centre line
 * @param halfWidth the road's half width, m
 * @param seed the road's seed
 * @returns m added to the ground's height
 */
export function cityGround(dist: number, offset: number, halfWidth: number, seed: number): number {
  const past = Math.abs(offset) - halfWidth;
  if (past <= 0) return 0;
  const stretch = cityStretchAt(dist, seed);
  const far = 1 - slopeShare(0, (past - (REACH - FAR_FADE_M - 2)) * SLOPE_M / FAR_FADE_M);
  if (stretch.kind === 'raised')
    return -RAISE_M * slopeShare(RAISE_VERGE_M, past) * inFrom(stretch, EASE_M) * far;
  if (stretch.kind === 'cutting' || stretch.kind === 'tunnel')
    return CUT_M * slopeShare(CUT_VERGE_M, past) * inFrom(stretch, EASE_M) * far;
  return 0;
}

// the barriers each stretch has along both road edges, and m off the edge: a cutting's and a
// tunnel's retaining walls; a raised stretch's Armco along the embankment's top; over the water
// a weak post-and-rail fence with GAPS (owner 11-21: "NOT walled the whole way - some gaps or weak
// fences, so you can go in"): WATER_GAP_M open in each WATER_GAP_EVERY_M
const WALL_GAP_M = 1.2, ARMCO_GAP_M = 1.8, FENCE_GAP_M = 2, WATER_GAP_EVERY_M = 110;
const WATER_GAP_M = 22;

/**
 * The barrier along the road's edges at a road distance in the city (highway/dress.ts layWalls),
 * or null for none there (a city stretch's noise walls are its lots': highway/city.ts).
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns its kind and m off the road edge, or null
 */
export function cityWallAt(dist: number, seed: number): { kind: BarrierKind; gap: number } | null {
  const kind = cityStretchAt(dist, seed).kind;
  if (kind === 'cutting' || kind === 'tunnel') return { kind: 'wall', gap: WALL_GAP_M };
  if (kind === 'raised') return { kind: 'armco', gap: ARMCO_GAP_M };
  if (kind === 'water') return ((dist + seed) % WATER_GAP_EVERY_M) < WATER_GAP_M ? null
    : { kind: 'woodfence', gap: FENCE_GAP_M };
  return null;
}

// the stretches nothing is built off - no slip, services, junction, bridge or lay-by, its station
// none: the water, a tunnel, a cutting, an embankment (owner 11-21: "petrol stations that had
// water in them")
const CLOSED = new Set<CityKind>(['water', 'tunnel', 'cutting', 'raised']);
// m between two looks along a span
const LOOK_STEP_M = 20;

/**
 * Whether a span of road is open for building off in the city: no closed stretch along it.
 * @param from road distance, m
 * @param upto road distance, m
 * @param seed the road's seed
 * @returns it is
 */
export function cityOpenSpan(from: number, upto: number, seed: number): boolean {
  for (let along = Math.max(0, from); along <= upto; along += LOOK_STEP_M)
    if (CLOSED.has(cityStretchAt(along, seed).kind)) return false;
  return !CLOSED.has(cityStretchAt(Math.max(0, upto), seed).kind);
}

// highway/laybys.ts - LAY-BYS (owner 11-09: "all roads should have some kind of extra tarmac
// breathing room for the reset / a hard shoulder / It's not always appropriate to have a hard
// shoulder tho", then "Let's try lay-bys"; passed 11-09): on a road whose hard shoulder is narrower
// than a car (the dual carriageway, the walled road, the canyon road) a tarmac pull-in on our left
// every GAP_MIN..GAP_MAX m - FLAT_M long, DEEP_M past the road edge, tapering in and out over
// TAPER_M - and every reset there goes back to the last one behind (game/session.ts, highway.ts
// highwayRespawn, highwayrace.ts hwPutBack); the other way's too, on the far side ("They should be
// on oncoming side of the roads that need them too so it's even and real"; passed 11-09), at
// their own spots. The walls, the Armco and Deaf Valley's ground step out round one, its rock is
// cut back; the scenery keeps off it. By road distance from the road's seed, so every dress call,
// the ground and the resets agree; none where Deaf Valley's gorge falls away on that side.
import { FIX } from '../core/fixes.ts';
import { SURFACES } from '../world/surfaces.ts';
import { gorgeAt } from './gorge.ts';
import { byStation } from './desertplan.ts';
import { keepOut } from './cuts.ts';
import { STEP } from './presets.ts';
import type { Point } from '../world/types.ts';
import type { DressCtx, HwLevel } from './hwtypes.ts';

// m of hard shoulder that is room enough for a reset: none on a road with one this wide
const SHOULDER_MIN_M = 2.2;
// m between lay-bys' middles; the first's middle this far into the road (the far side's further:
// not opposite ours)
const GAP_MIN = 250, GAP_MAX = 400, FIRST_M = 120, FAR_FIRST_M = 260;
// (?vergereset=1) Deaf Valley's gap between lay-bys, m (owner 11-10: "it seems like there isn't
// many lay-bys and it's quite hard to make progress on Death Valley")
const CANYON_GAP = [160, 260];
// m: the flat length, each taper's, the depth past the road edge
const FLAT_M = 32, TAPER_M = 18, DEEP_M = 3.2;
const HALF_M = FLAT_M / 2 + TAPER_M;

/** A road side's lay-bys: their middles so far (ascending), which are laid, its random stream. */
interface Plan { mids: number[]; open: boolean[]; next: number; state: number }
const PLANS = new Map<string, Plan>();

/**
 * Whether a road has lay-bys (each side): its hard shoulder narrower than a car.
 * @param level the highway level
 * @returns true when it does
 */
export const laybysOn = (level: HwLevel) => level._cfg.shoulder < SHOULDER_MIN_M;

/**
 * A road side's plan of lay-bys, laid out to past a road distance.
 * @param level the highway level
 * @param dist road distance, m
 * @param side -1 / +1
 * @returns the plan
 */
function planTo(level: HwLevel, dist: number, side: number): Plan {
  const seed = level._hw.seed, canyon = level._cfg.theme === 'canyon',
    key = `${seed}:${canyon}:${side}`;
  let plan = PLANS.get(key);
  if (!plan) PLANS.set(key, plan = { mids: [], open: [], next: side < 0 ? FIRST_M : FAR_FIRST_M,
    state: (seed ^ (side < 0 ? 0x6c8e9cf5 : 0x2f1b77a3)) >>> 0 || 1 });
  const rand = () => (plan!.state = (plan!.state * 16807) % 2147483647) / 2147483647;
  while (plan.next <= dist + HALF_M) {
    const mid = plan.next;
    // (none over a gorge falling away on that side: Deaf Valley's high road; none by a petrol
    // station - MEASURED, _desertroom.mjs: their keep-out stopped 2 stations in 3)
    const open = !canyon || [-HALF_M, 0, HALF_M].every((along) => !gorgeAt(mid + along, side,
      seed) && !byStation(mid + along, side, seed));
    plan.mids.push(mid);
    plan.open.push(open);
    // (?vergereset=1: Deaf Valley's oftener - CANYON_GAP)
    const [gapMin, gapMax] = canyon && FIX.vergereset ? CANYON_GAP : [GAP_MIN, GAP_MAX];
    plan.next = mid + gapMin + rand() * (gapMax - gapMin);
  }
  return plan;
}

/**
 * The plan's last middle at or before a road distance (its index), or -1.
 * @param mids the plan's middles (ascending)
 * @param dist road distance, m
 * @returns the index
 */
function lastAtOrBefore(mids: number[], dist: number): number {
  let low = 0, high = mids.length - 1, found = -1;
  while (low <= high) {
    const half = (low + high) >> 1;
    if (mids[half] <= dist) { found = half; low = half + 1; } else high = half - 1;
  }
  return found;
}

/**
 * The extra tarmac on a side at a road distance: DEEP_M in a lay-by's flat, tapering in and out.
 * @param level the highway level
 * @param dist road distance, m
 * @param side -1 our left (the default) / +1 the far side
 * @returns m past the road edge (0: none)
 */
export function bayOut(level: HwLevel, dist: number, side = -1): number {
  if (!laybysOn(level)) return 0;
  // (the lay-bys are further apart than two of them are long: the one at or before dist +
  // HALF_M is the only one that can reach dist)
  const plan = planTo(level, dist, side), i = lastAtOrBefore(plan.mids, dist + HALF_M);
  if (i < 0 || !plan.open[i]) return 0;
  const from = Math.abs(dist - plan.mids[i]);
  if (from > HALF_M) return 0;
  if (from <= FLAT_M / 2) return DEEP_M;
  const frac = 1 - (from - FLAT_M / 2) / TAPER_M;
  return DEEP_M * frac * frac * (3 - 2 * frac);
}

/**
 * Where a reset puts a car on a road with lay-bys: in our last one behind a road distance, from
 * its middle back (the first of the spots clear), across it at half its depth.
 * @param level the highway level
 * @param dist road distance, m
 * @param free whether a spot (road distance) is clear of cars (none: every one is)
 * @param floor the least road distance there is road at, m
 * @returns the spot (s, off), or null: no lay-by behind on the road
 */
export function bayBehind(level: HwLevel, dist: number, free: (at: number) => boolean = () => true,
  floor = -Infinity): { s: number; off: number } | null {
  if (!laybysOn(level)) return null;
  const plan = planTo(level, dist, -1), off = -(level._hw.geo.hw + DEEP_M / 2);
  // (the last one behind, then the one before it if it is full)
  for (let i = lastAtOrBefore(plan.mids, dist), tried = 0; i >= 0 && tried < 2; i--) {
    if (!plan.open[i]) continue;
    const mid = plan.mids[i];
    if (mid < floor) return null;
    tried++;
    for (const spot of [mid, mid - 9, mid + 9]) if (free(spot)) return { s: spot, off };
  }
  return null;
}

/**
 * Lays the lay-bys along road points [firstIdx, endIdx), each side: each run of points with one
 * beside them a tarmac zone from the road edge out (two dress calls' pieces meet at a point), and
 * keep-out rects over it every three points (the scenery, the fields stay off it).
 * @param ctx the dress context
 */
export function layLaybys(ctx: DressCtx) {
  const { level, road, firstIdx, endIdx, pointAt, halfWidth } = ctx;
  for (const side of [-1, 1]) {
    if (!laybysOn(level)) continue;
    let run: number[] = [];
    const flush = () => {
      if (run.length > 1) bayZone(ctx, run, side);
      run = [];
    };
    for (let i = Math.max(0, firstIdx - 1); i < endIdx; i++) {
      const out = bayOut(level, road[i].s, side);
      if (out <= 0.05) { flush(); continue; }
      run.push(i);
      if ((i - firstIdx) % 3 === 0) {
        const pos = pointAt(i, side * (halfWidth + out / 2));
        keepOut(level, { x: pos.x, y: pos.y, ax: Math.cos(pos.rot), ay: Math.sin(pos.rot),
          hu: STEP * 1.6, hv: out / 2 + 0.6 }, road[i].s);
      }
    }
    flush();
  }
}

/**
 * One run of a lay-by's points as a tarmac zone: the road edge, then back along its outer edge.
 * @param ctx the dress context
 * @param run the road points
 * @param side -1 / +1
 */
function bayZone(ctx: DressCtx, run: number[], side: number) {
  const { level, road, pointAt, halfWidth } = ctx, poly: Point[] = [];
  for (const i of run) {
    const pos = pointAt(i, side * (halfWidth - 0.2));
    poly.push([pos.x, pos.y]);
  }
  for (const i of [...run].reverse()) {
    const pos = pointAt(i, side * (halfWidth + bayOut(level, road[i].s, side)));
    poly.push([pos.x, pos.y]);
  }
  const allX = poly.map(([x]) => x), allY = poly.map(([, y]) => y), minX = Math.min(...allX),
    maxX = Math.max(...allX), minY = Math.min(...allY), maxY = Math.max(...allY);
  level.zones.push({ x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY,
    poly, surface: SURFACES.tarmac, art: null, boxed: true, _s: road[run[0]].s });
}

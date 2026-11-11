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
import { hash01, layStation } from './stations.ts';
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
// (?hwstations=1) a ROADSIDE STATION in a lay-by now and then (highway/stations.ts): m between
// their middles, the least and the most; the first one's middle this far in at the least; its
// flat, each taper and its depth past the road edge (the forecourt, the pumps, the shop), m; where
// a reset puts a car across it (the forecourt's front, short of the pumps), m past the edge
const STATION_EVERY = [2000, 3000], STATION_FIRST_M = 500;
// (a two-way road's far side: its first one this much further in, its own gaps - MEASURED,
// _stations.mjs: with the same, the single lane's came in pairs, ~150 m apart)
const FAR_STATION_M = 1200;
const STATION_FLAT_M = 34, STATION_TAPER_M = 20, STATION_DEEP_M = 28, STATION_RESET_M = 2.5;
const STATION_HALF_M = STATION_FLAT_M / 2 + STATION_TAPER_M;

/**
 * A road side's lay-bys: their middles so far (ascending), which are laid, which are stations
 * (?hwstations=1) and the last station's middle, its random stream.
 */
interface Plan {
  mids: number[]; open: boolean[]; station: boolean[]; lastStation: number; next: number;
  state: number;
}
const PLANS = new Map<string, Plan>();

/**
 * Whether a road has lay-bys (each side): its hard shoulder narrower than a car.
 * @param level the highway level
 * @returns true when it does
 */
export const laybysOn = (level: HwLevel) => level._cfg.shoulder < SHOULDER_MIN_M;

/**
 * (?hwstations=1) Whether a road side has roadside stations in its lay-bys: not Deaf Valley (its
 * own), not the walled road (a services); our side, and on a two-way road the far side too.
 * @param level the highway level
 * @param side -1 / +1
 * @returns true when it does
 */
const stationsOn = (level: HwLevel, side: number) => FIX.hwstations
  && level._cfg.theme !== 'canyon' && !level._cfg.walls && (side < 0
  || level._cfg.oncoming === 'lane');

/**
 * The m either side of a lay-by's middle it can reach on a road side.
 * @param level the highway level
 * @param side -1 / +1
 * @returns m
 */
const reachOf = (level: HwLevel, side: number) => (stationsOn(level, side)
  ? Math.max(HALF_M, STATION_HALF_M) : HALF_M);

/**
 * A road side's plan of lay-bys, laid out to past a road distance.
 * @param level the highway level
 * @param dist road distance, m
 * @param side -1 / +1
 * @returns the plan
 */
function planTo(level: HwLevel, dist: number, side: number): Plan {
  const seed = level._hw.seed, canyon = level._cfg.theme === 'canyon',
    stations = stationsOn(level, side), key = `${seed}:${canyon}:${side}:${stations}`;
  let plan = PLANS.get(key);
  if (!plan) PLANS.set(key, plan = { mids: [], open: [], station: [],
    lastStation: STATION_FIRST_M + (side < 0 ? 0 : FAR_STATION_M) - STATION_EVERY[0],
    next: side < 0 ? FIRST_M : FAR_FIRST_M,
    state: (seed ^ (side < 0 ? 0x6c8e9cf5 : 0x2f1b77a3)) >>> 0 || 1 });
  const rand = () => (plan!.state = (plan!.state * 16807) % 2147483647) / 2147483647;
  while (plan.next <= dist + reachOf(level, side)) {
    const mid = plan.next;
    // (none over a gorge falling away on that side: Deaf Valley's high road; none by a petrol
    // station - MEASURED, _desertroom.mjs: their keep-out stopped 2 stations in 3)
    const open = !canyon || [-HALF_M, 0, HALF_M].every((along) => !gorgeAt(mid + along, side,
      seed) && !byStation(mid + along, side, seed));
    plan.mids.push(mid);
    plan.open.push(open);
    // (?hwstations=1: a station when the last is far enough behind - its gap by the road's seed)
    const station = stations && open && mid - plan.lastStation >= STATION_EVERY[0]
      + hash01(mid + side * 101, seed) * (STATION_EVERY[1] - STATION_EVERY[0]);
    if (station) plan.lastStation = mid;
    plan.station.push(station);
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
  return bayHere(level, dist, side)?.out ?? 0;
}

/**
 * The lay-by reaching a road distance on a side: the extra tarmac there (its depth in the flat,
 * tapering in and out), its middle, and whether it is a station (?hwstations=1).
 * @param level the highway level
 * @param dist road distance, m
 * @param side -1 our left (the default) / +1 the far side
 * @returns the lay-by, or null: none there
 */
export function bayHere(level: HwLevel, dist: number, side = -1): { out: number; mid: number;
  station: boolean } | null {
  if (!laybysOn(level)) return null;
  // (the lay-bys are further apart than two of them are long: the one at or before dist + its
  // reach is the only one that can reach dist)
  const plan = planTo(level, dist, side), i = lastAtOrBefore(plan.mids, dist + reachOf(level,
    side));
  if (i < 0 || !plan.open[i]) return null;
  const station = plan.station[i], mid = plan.mids[i], from = Math.abs(dist - mid);
  const [flat, taper, deep] = station ? [STATION_FLAT_M, STATION_TAPER_M, STATION_DEEP_M]
    : [FLAT_M, TAPER_M, DEEP_M];
  if (from > flat / 2 + taper) return null;
  if (from <= flat / 2) return { out: deep, mid, station };
  const frac = 1 - (from - flat / 2) / taper;
  return { out: deep * frac * frac * (3 - 2 * frac), mid, station };
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
  const plan = planTo(level, dist, -1), half = level._hw.geo.hw;
  // (a station's forecourt front, short of the pumps: ?hwstations=1)
  const offOf = (i: number) => -(half + (plan.station[i] ? STATION_RESET_M : DEEP_M / 2));
  // (the last one behind, then the one before it if it is full)
  for (let i = lastAtOrBefore(plan.mids, dist), tried = 0; i >= 0 && tried < 2; i--) {
    if (!plan.open[i]) continue;
    const mid = plan.mids[i];
    if (mid < floor) return null;
    tried++;
    for (const spot of [mid, mid - 9, mid + 9]) if (free(spot)) return { s: spot, off: offOf(i) };
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
    let run: number[] = [], concrete = false;
    const flush = () => {
      if (run.length > 1) bayZone(ctx, run, side, concrete);
      run = [];
    };
    for (let i = Math.max(0, firstIdx - 1); i < endIdx; i++) {
      const here = bayHere(level, road[i].s, side), out = here ? here.out : 0;
      if (!here || out <= 0.05) { flush(); continue; }
      run.push(i);
      concrete = here.station;
      // (?hwstations=1: a station's shop, pumps and canopy at its middle - highway/stations.ts)
      if (here.station && i >= firstIdx && road[i].s <= here.mid && here.mid < road[i].s + STEP)
        layStation(ctx, i, side, STATION_HALF_M);
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
 * One run of a lay-by's points as a tarmac zone (a station's concrete): the road edge, then back
 * along its outer edge.
 * @param ctx the dress context
 * @param run the road points
 * @param side -1 / +1
 * @param concrete a station's forecourt (?hwstations=1)
 */
function bayZone(ctx: DressCtx, run: number[], side: number, concrete = false) {
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
    poly, surface: concrete ? SURFACES.concrete : SURFACES.tarmac, art: null, boxed: true,
    _s: road[run[0]].s });
}

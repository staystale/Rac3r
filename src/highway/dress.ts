// highway dress: the per-window dressing (trees, gantries, armco, walls, litter) and the
// NOX / NOF node-tool switches. Split out of highway.ts.
import { layLaybys, bayOut } from "./laybys.ts";
import { envValue } from "../core/debug.ts";
import { STEP, SIGNS, CITY_SIGNS } from "./presets.ts";
import { stateOf } from "./road.ts";
import { blocked, cutBy, isSignClear, sideStep, sideFlush, syncCovers, SLIP_W, cutSkips }
  from "./cuts.ts";
import { fields } from "./fields.ts";
import { extras } from "./extras.ts";
import { layLooseRoadside } from "./litter.ts";
import { layRoadLamps } from "./roadlamps.ts";
import { dressCanyon } from "./canyon.ts";
import { layCityLots } from "./city.ts";
import { layCityWater, layTunnelSlats } from "./citywater.ts";
import { cityStretchAt, cityWallAt } from "./cityplan.ts";
import { medianAt } from "./medians.ts";
import { layCushions, markBarriers, noteMedianPiece } from "./cushions.ts";
import type { LevelObj } from '../cones/coneTypes.ts';
import type { Point, BarrierKind } from '../world/types.ts';
import type { HwPose, HwLevel, DressCtx, Stamp } from './hwtypes.ts';
// node tools only: HWNOX=1 builds the road with NO slips / bridges / extras (an A/B of their effect
// on the AI, same roads)
export const NOX = !!envValue("HWNOX");
// node only: no FIELDS (scenery v2 A/B)
export const NOF = !!envValue("HWNOF");
/**
 * Build the shared context of one dress call: the road window and the two helpers every step
 * uses (pointAt, clear).
 * @param level the highway level
 * @param firstIdx first road point to dress
 * @param endIdx end (exclusive) road point
 * @param loose where loose objects go
 * @returns the dress context
 */
function makeDressContext(level: HwLevel, firstIdx: number, endIdx: number, loose: LevelObj[]) {
  const state = stateOf(level), rand = state.rnd, halfWidth = state.geo.hw, road = state.pts;
  const pointAt = (i: number, off: number): HwPose => {
    const before = road[Math.max(0, i - 1)],
      after = road[Math.min(road.length - 1, i + 1)],
      heading = Math.atan2(after.y - before.y, after.x - before.x);
    return {
      x: road[i].x - Math.sin(heading) * off,
      y: road[i].y + Math.cos(heading) * off,
      rot: heading,
    };
  };
  // clear of the road AND of the secret side road (its points carry sideOff) - and (clear) of every
  // approach / river / slip / lay-by (st.keep)
  const roadClear = (x: number, y: number, radius: number) => {
    for (let j = Math.max(0, firstIdx - 60); j < Math.min(road.length, endIdx + 60); j += 2) {
      const dist2 = (road[j].x - x) ** 2 + (road[j].y - y) ** 2;
      if (
        dist2 < (halfWidth + radius) ** 2 ||
        (road[j].sideOff && dist2 < (road[j].sideOff! + SLIP_W / 2 + radius) ** 2)
      )
        return false;
    }
    return true;
  };
  const clear = (x: number, y: number, radius: number) => roadClear(x, y, radius)
    && !blocked(state.keep, x, y, radius);
  // (the right side: the secret side road runs on the LEFT - roadClear's ring round each road
  // point it runs by reaches the right side as far out too)
  const clearRight = (x: number, y: number, radius: number) => {
    for (let j = Math.max(0, firstIdx - 60); j < Math.min(road.length, endIdx + 60); j += 2)
      if ((road[j].x - x) ** 2 + (road[j].y - y) ** 2 < (halfWidth + radius) ** 2) return false;
    return !blocked(state.keep, x, y, radius);
  };
  return { level, state, rand, halfWidth, road, firstIdx, endIdx, loose, pointAt, clear,
    roadClear, clearRight };
}

/**
 * Half the road is FARMLAND now (fields, hedges, villages: fields above), was a third.
 * @param dist road distance
 * @returns the biome name there
 */
// (owner 11-09: "endless roads should cycle randomly between their potential next track sections
// so it always varies"): the road's own random order and lengths (was farm, forest, farm, rocky,
// farm, forest, 2.2 km each, round and round)
// (GETAWAY STOCKHOLM: its own stretches - highway/cityplan.ts)
const biomeAtDist = (dist: number, seed: number, theme?: string): string => (theme === 'city'
  ? cityStretchAt(dist, seed).kind : biomePlanAt(dist, seed));

// the countryside's stretches in a random order: each 1.4-3 km, farmland the likeliest, never the
// same twice running; by road and road distance, laid as far as asked (biomePlanAt)
const BIOMES: [string, number][] = [["farm", 0.5], ["forest", 0.3], ["rocky", 0.2]];
const BIOME_PLANS = new Map<number, { ends: number[]; names: string[]; state: number }>();

/**
 * The countryside's stretch at a road distance on a road.
 * @param dist road distance, m
 * @param seed the road's seed
 * @returns the biome name there
 */
function biomePlanAt(dist: number, seed: number): string {
  let plan = BIOME_PLANS.get(seed);
  if (!plan) BIOME_PLANS.set(seed, plan = { ends: [2200], names: ["farm"], state: seed || 1 });
  const rand = () => (plan!.state = (plan!.state * 16807) % 2147483647) / 2147483647;
  while (plan.ends[plan.ends.length - 1] <= dist) {
    const last = plan.names[plan.names.length - 1], next = BIOMES.filter(([name]) => name !== last),
      total = next.reduce((sum, [, weight]) => sum + weight, 0);
    let pick = rand() * total, name = next[next.length - 1][0];
    for (const [each, weight] of next) if ((pick -= weight) < 0) { name = each; break; }
    plan.names.push(name);
    plan.ends.push(plan.ends[plan.ends.length - 1] + 1400 + rand() * 1600);
  }
  let idx = 0;
  while (plan.ends[idx] <= dist) idx++;
  return plan.names[idx];
}

/**
 * Trees (and, on rocky ground, rocks) beside the road at point i (every third point).
 * @param ctx the dress context
 * @param i road point index
 * @param dist road distance at i
 * @param biomeName biome at i
 * @param mark tags an object with its road distance
 * @returns {void}
 */
function layRoadsideTrees(ctx: DressCtx, i: number, dist: number, biomeName: string, mark: Stamp) {
  const { level, rand, halfWidth, pointAt, clear } = ctx;
  if (i % 3 === 0) for (const side of [-1, 1]) {
    const dens = biomeName === 'forest' ? 0.75 : biomeName === 'farm' ? 0.18 : 0.25;
    if (rand() < dens) {
      const pos = pointAt(
        i,
        side * (halfWidth + 10 + rand() * (biomeName === "forest" ? 40 : 25))
      );
      if (clear(pos.x, pos.y, 8))
        level.props.push(
          mark({ kind: "tree", x: pos.x, y: pos.y, s: 4 + rand() * 3, seed: (dist | 0) * 2 + 1 })
        );
    }
    if (biomeName === "rocky" && rand() < 0.3) {
      const pos = pointAt(i, side * (halfWidth + 6 + rand() * 30));
      if (clear(pos.x, pos.y, 5))
        level.props.push(
          mark({ kind: "rock", x: pos.x, y: pos.y, s: 2 + rand() * 4, seed: (dist | 0) + 7 })
        );
    }
  }
}

/**
 * A farm building block now and then (every 40th point on farmland).
 * @param ctx the dress context
 * @param i road point index
 * @param biomeName biome at i
 * @param mark tags an object with its road distance
 * @returns {void}
 */
function layFarmBlock(ctx: DressCtx, i: number, biomeName: string, mark: Stamp) {
  const { level, rand, halfWidth, pointAt, clear } = ctx;
  if (biomeName === "farm" && i % 40 === 0 && rand() < 0.4) {
    const side = rand() < 0.5 ? -1 : 1,
      pos = pointAt(i, side * (halfWidth + 30 + rand() * 25));
    if (clear(pos.x, pos.y, 12))
      level.props.push(
        mark({
          kind: "block",
          x: pos.x,
          y: pos.y,
          w: 14,
          h: 8,
          rot: pos.rot + rand(),
          roof: ["#8a3a2e", "#6e6a5e", "#3f5a3a"][(rand() * 3) | 0],
        })
      );
  }
}

/**
 * GANTRY every ~3 km, a SIGN every ~700 m (the distance to Hull GOES UP) (never with a leg /
 * board on a slip, an approach or the side road: a gantry there moves on 40 m, a board swaps
 * sides or is left out).
 * @param ctx the dress context
 * @param i road point index
 * @param dist road distance at i
 * @param mark tags an object with its road distance
 * @returns {void}
 */
function layGantryAndSign(ctx: DressCtx, i: number, dist: number, mark: Stamp) {
  const { level, state, halfWidth, road, pointAt } = ctx;
  const freeAt = (j: number, off: number, radius: number) => {
    const pos = pointAt(j, off);
    return !(road[j].sideOff && off < 0) && !blocked(state.keep, pos.x, pos.y, radius)
      ? pos
      : null;
  };
  if (Math.floor(dist / 3000) !== Math.floor((dist - STEP) / 3000)) state.gantryDue = true;
  // (no motorway gantry over a single carriageway - the single lane in the country)
  if (level._cfg.oncoming === 'lane') state.gantryDue = false;
  if (state.gantryDue && freeAt(i, -(halfWidth + 3), 2) && freeAt(i, halfWidth + 3, 2)) {
    state.gantryDue = false;
    const pos = pointAt(i, 0);
    level.props.push(
      mark({
        kind: "gantry",
        x: pos.x,
        y: pos.y,
        rot: pos.rot + Math.PI / 2,
        wid: state.geo.width + 6,
      })
    );
  }
  if (Math.floor(dist / 700) !== Math.floor((dist - STEP) / 700)) {
    const count = Math.floor(dist / 700),
      sideSign = count % 2 ? 1 : -1,
      isCity = level._cfg.theme === 'city',
      label = signLabel(count, state.seed, isCity);
    const pos =
      freeAt(i, sideSign * (halfWidth + 6), 10) || freeAt(i, -sideSign * (halfWidth + 6), 10);
    // (the city's signs blue, as its exit signs)
    if (pos) level.props.push(mark({ kind: 'board', x: pos.x, y: pos.y, rot: pos.rot, label,
      ...(isCity ? { blue: true } : {}) }));
  }
}

/**
 * A roadside sign's words: every third the distance that goes up (HULL in miles; the city's
 * CENTRUM in km), else a silly sign.
 * @param count the sign's number along the road
 * @param seed the road's seed
 * @param isCity GETAWAY STOCKHOLM's
 * @returns the words
 */
function signLabel(count: number, seed: number, isCity: boolean): string {
  if (isCity) return count % 3 === 0 ? `CENTRUM ${2 + count} KM`
    : CITY_SIGNS[(count * 7 + seed) % CITY_SIGNS.length];
  return count % 3 === 0 ? `HULL ${412 + count * 3} MI` : SIGNS[(count * 7 + seed) % SIGNS.length];
}

/**
 * ROLLING HILLS: a broad hump beside the road every ~250 m (the road climbs its flank).
 * @param ctx the dress context
 * @param i road point index
 * @param biomeName biome at i
 * @param mark tags an object with its road distance
 * @returns {void}
 */
function layHump(ctx: DressCtx, i: number, biomeName: string, mark: Stamp) {
  const { level, rand, pointAt } = ctx;
  // (the city's only in its parks)
  if (level._cfg.theme === 'city' && biomeName !== 'green') return;
  if (i % 60 === 0 && rand() < 0.6) {
    const pos = pointAt(i, (rand() < 0.5 ? -1 : 1) * (30 + rand() * 90));
    level.bumps.push(
      mark({
        kind: "hump",
        x: pos.x,
        y: pos.y,
        r: 110 + rand() * 160,
        h: (biomeName === "rocky" ? 6 : 3) + rand() * 8,
      })
    );
  }
}

/**
 * ARMCO on the OUTSIDE of the tighter bends: runs of points with |curv| > 1/400 (+curv = a
 * right-hander -> outside = the -normal side).
 * @param ctx the dress context
 * @returns {void}
 */
function layArmco(ctx: DressCtx) {
  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx;
  let run: { a: number; side: number } | null = null;
  for (let i = firstIdx; i <= (level._cfg.walls ? -1 : endIdx); i++) {
    const curv = i < endIdx ? road[i].curv : 0, active = Math.abs(curv) > 1 / 400;
    if (active && !run) run = { a: i, side: -Math.sign(curv) };
    // (left-side armco breaks where a slip leaves or the side road runs: P[j].gapL)
    if ((!active || i === endIdx) && run) {
      let pts: Point[] = [];
      const runNow = run;
      const flush = () => {
        if (pts.length > 2) level.barriers.push({ kind: "armco", pts, _s: road[runNow.a].s });
        pts = [];
      };
      // (as the walls: never past the points dressed)
      for (let j = Math.max(0, run.a - 8); j < Math.min(road.length, endIdx, i + 8); j += 2) {
        if (runNow.side < 0 && road[j].gapL) {
          flush();
          continue;
        }
        // (out round a lay-by)
        const pos = pointAt(j, runNow.side * (halfWidth + 1.8
          + bayOut(level, road[j].s, runNow.side)));
        pts.push([pos.x, pos.y]);
      }
      flush();
      run = null;
    }
  }
}


/**
 * WALLS (cfg.walls): both sides, in ~120 m pieces (each dropped behind with the rest),
 * overlapping by one point so there is no gap ... with a GAP in the left wall where a slip leaves
 * or the side road runs (P[j].gapL).
 * @param ctx the dress context
 * @returns {void}
 */
function layWalls(ctx: DressCtx) {
  const { level, firstIdx, endIdx } = ctx, cfg = level._cfg;
  // (the walled road's wall all along; GETAWAY STOCKHOLM's by stretch - highway/cityplan.ts)
  const wallAt: WallRule | null = cfg.walls ? () => ({ kind: cfg.walls as BarrierKind,
    gap: cfg.wallGap || 0 }) : cfg.theme === 'city' ? (dist) => cityWallAt(dist, level._hw.seed)
    : null;
  if (wallAt)
    for (let startIdx = Math.max(0, firstIdx - 1); startIdx < endIdx; startIdx += 30)
      for (const side of [-1, 1]) layWallPiece(ctx, wallAt, startIdx, side);
}

/** The wall along the road's edges at a road distance: its kind and m off the edge, or none. */
type WallRule = (dist: number) => { kind: BarrierKind; gap: number } | null;

/**
 * One ~120 m piece of the walls on one side (layWalls), a new one where the kind changes.
 * @param ctx the dress context
 * @param wallAt the wall by road distance
 * @param startIdx the piece's first road point
 * @param side -1 / +1
 */
function layWallPiece(ctx: DressCtx, wallAt: WallRule, startIdx: number, side: number) {
  const { level, halfWidth, road, endIdx, pointAt } = ctx;
  let pts: Point[] = [], kind: BarrierKind | null = null;
        const flush = () => {
          if (kind && pts.length > 1) level.barriers.push({ kind, pts, _s: road[startIdx].s });
          pts = [];
        };
        // (beside the SECRET SIDE ROAD the left wall swings out with it, to its far edge - it
        // starts and ends at the normal line; never past the last point dressed -
        // dresses behind the road's end, and the road past it has no side road marked yet: the
        // next stretch's first piece starts on that last point. MEASURED _serviceswall.mjs, a
        // wall across every services' way in)
        const lastIdx = Math.min(road.length - 1, endIdx - 1, startIdx + 30);
        for (let j = startIdx; j <= lastIdx; j++) {
          const wall = wallAt(road[j].s);
          if (!wall || wall.kind !== kind) {
            flush();
            kind = wall ? wall.kind : null;
          }
          if (!wall) continue;
          const wallGap = wall.gap, sideOffset = side < 0 && road[j].sideOff;
          if (!sideOffset && side < 0 && road[j].gapL) {
            flush();
            continue;
          }
          // (out round a lay-by)
          const edge = halfWidth + wallGap + bayOut(level, road[j].s, side);
          const pos = pointAt(
            j,
            sideOffset
              ? -Math.max(edge, sideOffset + SLIP_W / 2 + wallGap + (road[j].sideOut || 0))
              : side * edge
          );
          pts.push([pos.x, pos.y]);
        }
        flush();
}

/**
 * Deaf Valley's motorway extras for the dress window: the side road's offsets,
 * then the slips, bridges and services where the ground is open (highway/extras.ts).
 * @param ctx the dress context
 */
function layDesertExtras(ctx: DressCtx) {
  const { level, state, road, firstIdx, endIdx, pointAt } = ctx;
  state.desert = true;
  for (let i = firstIdx; i < endIdx; i++) {
    const dist = road[i].s,
      mark = ((obj: { _s?: number }) => {
        obj._s = dist;
        return obj;
      }) as unknown as Stamp;
    sideStep(level, i, pointAt);
    extras(level, i, dist, pointAt, mark);
  }
  sideFlush(level, false);
}

/**
 * Scenery for road points [firstIdx, endIdx): placed in WORLD coordinates (stays put when the
 * window moves); loose objects go into `loose`.
 * @param level the highway level
 * @param firstIdx first road point to dress
 * @param endIdx end (exclusive) road point
 * @param loose where loose objects go
 * @returns {void}
 */
export function dress(level: HwLevel, firstIdx: number, endIdx: number, loose: LevelObj[]) {
  dressStretch(level, firstIdx, endIdx, loose);
  clearSignsOffLanes(level, level._hw.pts[Math.max(0, firstIdx - SIGN_SWEEP_BACK)].s);
}

// road points back from a stretch's first a later road (a slip, a bridge's approach, a junction)
// can reach a sign laid before it (60 x 4 m: the dress context's reach)
const SIGN_SWEEP_BACK = 60;

/**
 * Takes away the roadside signs a road laid after them now runs over (cuts.ts isSignClear): a
 * sign is laid with its own feature, and a later one's lanes can cross it.
 * @param level the highway level
 * @param fromS road distance from which signs are checked, m
 */
function clearSignsOffLanes(level: HwLevel, fromS: number) {
  const kept = level.props.filter((prop) => (prop.kind !== 'board' && prop.kind !== 'slipcount')
    || (prop._s ?? 0) < fromS || isSignClear(prop.x, prop.y));
  if (kept.length === level.props.length) return;
  level.props.length = 0;
  level.props.push(...kept);
}

/**
 * Whether a road point gets the slips, bridges and services (highway/extras.ts): not with HWNOX,
 * nor off the city's water or out of its tunnels (no slip into the water or the walls).
 * @param isCity GETAWAY STOCKHOLM's
 * @param kind the stretch there
 * @returns it does
 */
const hasExtras = (isCity: boolean, kind: string) => !NOX && !(isCity && (kind === 'water'
  || kind === 'tunnel'));

/**
 * GETAWAY STOCKHOLM's dressing at road point i, in place of the countryside's fields, trees and
 * farm blocks: its lots (highway/city.ts), its water and its tunnels' slats (citywater.ts), and
 * trees - a park's a forest's, the city's a farm's few between the lots.
 * @param ctx the dress context
 * @param i road point index
 * @param kind the stretch (highway/cityplan.ts)
 * @param mark tags an object with its road distance
 */
function dressCityPoint(ctx: DressCtx, i: number, kind: string, mark: Stamp) {
  layCityLots(ctx, i, kind);
  layCityWater(ctx, i, kind);
  layTunnelSlats(ctx, i);
  if (kind === 'green' || kind === 'city')
    layRoadsideTrees(ctx, i, ctx.road[i].s, kind === 'green' ? 'forest' : 'farm', mark);
}

/**
 * Dresses road points [firstIdx, endIdx) (dress's body).
 * @param level the highway level
 * @param firstIdx first road point
 * @param endIdx end (exclusive) road point
 * @param loose where loose objects go
 */
function dressStretch(level: HwLevel, firstIdx: number, endIdx: number, loose: LevelObj[]) {
  const ctx = makeDressContext(level, firstIdx, endIdx, loose);
  // (the barriers this stretch lays are read for their ends)
  markBarriers(ctx);
  // (the lay-bys first - the scenery keeps off them)
  layLaybys(ctx);
  // a themed road dresses its own way (Deaf Valley: highway/canyon.ts)
  if (level._cfg.theme === 'canyon') {
    // (every road there gets the other roads' slips, bridges and services first, as those roads
    // have them - the scenery below keeps off them)
    layDesertExtras(ctx);
    dressCanyon(ctx);
    // (the reservation's columns only - a verge post would stand in a canyon wall: a road with a
    // central reservation)
    if (level._cfg.oncoming === 'carriageway') layRoadLamps(ctx);
    // (the shared litter, its slider and its amount - in the desert's kinds)
    layLooseRoadside(ctx);
    // (any road there - a twin carriageway's central reservation, the walled road's walls)
    layWalls(ctx);
    layMedian(ctx);
    layCushions(ctx);
    return;
  }
  const { state, road, pointAt, clear } = ctx;
  // a long road can come back across what was laid beside an EARLIER stretch: every new point cuts
  // the approaches / rivers / slips
  for (let j = firstIdx; j < endIdx; j += 2)
    for (const cut of state.cuts)
      if (!cutSkips(cut, road[j].s)) cutBy(level, cut, road[j].x, road[j].y);
  const isCity = level._cfg.theme === 'city';
  for (let i = firstIdx; i < endIdx; i++) {
    const dist = road[i].s,
      biomeName = biomeAtDist(dist, state.seed, level._cfg.theme),
      mark = ((obj: { _s?: number }) => {
        obj._s = dist;
        return obj;
      }) as unknown as Stamp;   // it stamps whatever it is given and hands it back
    // the side road's offset here first, so the trees below keep off it
    sideStep(level, i, pointAt);
    // (the city's own in place of the fields, trees and farm blocks: highway/city.ts)
    if (isCity) dressCityPoint(ctx, i, biomeName, mark);
    else {
      if (!NOF) fields(level, i, pointAt, clear, biomeName, loose);
      layRoadsideTrees(ctx, i, dist, biomeName, mark);
      layFarmBlock(ctx, i, biomeName, mark);
    }
    // SLIP ROADS + BRIDGES (requirement: an off-slip every 2-4 km - tapering lane, sign, ends in
    // fields, drivable; bridges over a road, a river and a railway, plus a footbridge; rare cheeky
    // extras): planned on the road's own distance, placed only on near-straight road (|curv| <
    // 1/900 over the stretch), never on top of each other. extras(lv, i, s) below. (every preset
    // since, requirement: all the types of highway should have bridges and slip roads you can take)
    if (hasExtras(isCity, biomeName)) extras(level, i, dist, pointAt, mark);
    layGantryAndSign(ctx, i, dist, mark);
    layHump(ctx, i, biomeName, mark);
  }
  sideFlush(level, false);
  if (state.coversDirty) syncCovers(level);
  layArmco(ctx);
  // the street lights, clear of the scenery laid above
  layRoadLamps(ctx);
  layLooseRoadside(ctx);
  layWalls(ctx);
  layMedian(ctx);
  // (the crash-cushion barrels)
  layCushions(ctx);
}

/**
 * The CENTRAL RESERVATION's barrier between two carriageways (geo.median), in
 * ~120 m pieces as the walls, overlapping by one point, each its stretch's kind (medians.ts).
 * @param ctx the dress context
 */
function layMedian(ctx: DressCtx) {
  const { level, road, firstIdx, endIdx, pointAt } = ctx, offset = level._hw.geo.median;
  if (offset == null) return;
  for (let startIdx = Math.max(0, firstIdx - 1); startIdx < endIdx; startIdx += 30) {
    const pts: Point[] = [];
    for (let j = startIdx; j <= Math.min(road.length - 1, startIdx + 30); j++) {
      const pos = pointAt(j, offset);
      pts.push([pos.x, pos.y]);
    }
    const kind = medianAt(level._cfg, level._hw.seed, road[startIdx].s);
    if (kind && pts.length > 1) level.barriers.push({ kind, pts, _s: road[startIdx].s });
    // (crash-cushion barrels before a Jersey barrier's or Armco's end)
    noteMedianPiece(ctx, startIdx, Math.min(road.length - 1, startIdx + 30),
      kind);
  }
}

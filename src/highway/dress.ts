// highway dress: the per-window dressing (trees, gantries, armco, walls, litter) and the
// NOX / NOF node-tool switches. Split out of highway.ts.
import { layLaybys, bayOut } from "./laybys.ts";
import { envValue } from "../core/debug.ts";
import { STEP, SIGNS } from "./presets.ts";
import { stateOf } from "./road.ts";
import { blocked, cutBy, sideStep, sideFlush, syncCovers, SLIP_W, cutSkips } from "./cuts.ts";
import { fields } from "./fields.ts";
import { extras } from "./extras.ts";
import { layLooseRoadside } from "./litter.ts";
import { layRoadLamps } from "./roadlamps.ts";
import { dressCanyon } from "./canyon.ts";
import { medianAt } from "./medians.ts";
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
  return { level, state, rand, halfWidth, road, firstIdx, endIdx, loose, pointAt, clear,
    roadClear };
}

/**
 * Half the road is FARMLAND now (fields, hedges, villages: fields above), was a third.
 * @param dist road distance
 * @returns the biome name there
 */
// (owner 11-09: "endless roads should cycle randomly between their potential next track sections
// so it always varies"): the road's own random order and lengths (was farm, forest, farm, rocky,
// farm, forest, 2.2 km each, round and round)
const biomeAtDist = (dist: number, seed: number) => biomePlanAt(dist, seed);

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
      label =
        count % 3 === 0
          ? `HULL ${412 + count * 3} MI`
          : SIGNS[(count * 7 + state.seed) % SIGNS.length];
    const pos =
      freeAt(i, sideSign * (halfWidth + 6), 10) || freeAt(i, -sideSign * (halfWidth + 6), 10);
    if (pos) level.props.push(mark({ kind: 'board', x: pos.x, y: pos.y, rot: pos.rot, label }));
  }
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
      for (let j = Math.max(0, run.a - 8); j < Math.min(road.length, i + 8); j += 2) {
        if (runNow.side < 0 && road[j].gapL) {
          flush();
          continue;
        }
        // (?laybys=1: out round a lay-by)
        const pos = pointAt(j, runNow.side * (halfWidth + 1.8
          + (runNow.side < 0 ? bayOut(level, road[j].s) : 0)));
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
  const { level, halfWidth, road, firstIdx, endIdx, pointAt } = ctx, cfg = level._cfg;
  const walls = cfg.walls as BarrierKind | undefined, wallGap = cfg.wallGap || 0;
  if (walls)
    for (let startIdx = Math.max(0, firstIdx - 1); startIdx < endIdx; startIdx += 30)
      for (const side of [-1, 1]) {
        let pts: Point[] = [];
        const flush = () => {
          if (pts.length > 1) level.barriers.push({ kind: walls, pts, _s: road[startIdx].s });
          pts = [];
        };
        // (beside the SECRET SIDE ROAD the left wall swings out with it, to its far edge - it
        // starts and ends at the normal line)
        for (let j = startIdx; j <= Math.min(road.length - 1, startIdx + 30); j++) {
          const sideOffset = side < 0 && road[j].sideOff;
          if (!sideOffset && side < 0 && road[j].gapL) {
            flush();
            continue;
          }
          // (?laybys=1: the left wall out round a lay-by)
          const edge = halfWidth + wallGap + (side < 0 ? bayOut(level, road[j].s) : 0);
          const pos = pointAt(
            j,
            sideOffset
              ? -Math.max(edge, sideOffset + SLIP_W / 2 + wallGap)
              : side * edge
          );
          pts.push([pos.x, pos.y]);
        }
        flush();
      }
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
  const ctx = makeDressContext(level, firstIdx, endIdx, loose);
  // (?laybys=1: the lay-bys first - the scenery keeps off them)
  layLaybys(ctx);
  // a themed road dresses its own way (Deaf Valley: highway/canyon.ts)
  if (level._cfg.theme === 'canyon') {
    dressCanyon(ctx);
    return;
  }
  const { state, road, pointAt, clear } = ctx;
  // a long road can come back across what was laid beside an EARLIER stretch: every new point cuts
  // the approaches / rivers / slips
  for (let j = firstIdx; j < endIdx; j += 2)
    for (const cut of state.cuts)
      if (!cutSkips(cut, road[j].s)) cutBy(level, cut, road[j].x, road[j].y);
  for (let i = firstIdx; i < endIdx; i++) {
    const dist = road[i].s,
      biomeName = biomeAtDist(dist, state.seed),
      mark = ((obj: { _s?: number }) => {
        obj._s = dist;
        return obj;
      }) as unknown as Stamp;   // it stamps whatever it is given and hands it back
    // the side road's offset here first, so the trees below keep off it
    sideStep(level, i, pointAt);
    if (!NOF) fields(level, i, pointAt, clear, biomeName, loose);
    layRoadsideTrees(ctx, i, dist, biomeName, mark);
    layFarmBlock(ctx, i, biomeName, mark);
    // SLIP ROADS + BRIDGES (requirement: an off-slip every 2-4 km - tapering lane, sign, ends in
    // fields, drivable; bridges over a road, a river and a railway, plus a footbridge; rare cheeky
    // extras): planned on the road's own distance, placed only on near-straight road (|curv| <
    // 1/900 over the stretch), never on top of each other. extras(lv, i, s) below. (every preset
    // since, requirement: all the types of highway should have bridges and slip roads you can take)
    if (!NOX) extras(level, i, dist, pointAt, mark);
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
  }
}

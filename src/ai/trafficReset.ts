// ai/trafficReset.ts: restarting the highway traffic (cars spread round the spawn) and
// making room by sending cars off the road.
import { roadFrame } from "../highway.ts";
import { resetBridgeCars } from "./trafficBridge.ts";
import type { HighwayLevel, TrafficCar } from "./types.ts";
import { MAX_CARS, PER_LANE, geo } from "./trafficCtx.ts";
import type { TrafficCtx } from "./trafficCtx.ts";
import { cruise, fresh, lanesOf, rebuildCars, roomAt } from "./trafficSpawn.ts";
import { applyKind, dealKind } from "./trafficKinds.ts";

/**
 * Spread a way's cars over the road round the spawn (none in your lane within 40 m ahead).
 * @param ctx the traffic
 * @param spawn where you start
 * @param want how many
 * @param dir 1 our way, -1 the other way
 */
function spreadCars(ctx: TrafficCtx, spawn: { s: number; off: number }, want: number, dir = 1) {
  const centres = lanesOf(ctx, dir), laneCount = centres.length, ents = [spawn],
    from = ctx.list.length;
  for (let tries = 0; ctx.list.length - from < want && tries < want * 25; tries++) {
    const dist = spawn.s - 100 + ctx.rnd() * 520, lane = (ctx.rnd() * laneCount) | 0,
      mine = Math.abs(centres[lane] - spawn.off) < 1.5;
    if ((mine && dist < spawn.s + 40) || Math.abs(dist - spawn.s) < 14
      || !roomAt(ctx, ents, dist, lane, 26, 26, dir)) continue;
    const slot = fresh(ctx, {} as TrafficCar, dist, lane, cruise(ctx, lane, laneCount), dir);
    // (your way's dealt its driver - ai/trafficKinds.ts)
    applyKind(ctx, slot, dealKind(ctx, dir));
    ctx.list.push(slot);
    ents.push({ s: dist, off: slot.off });
  }
  // no room at the start: they join from off screen
  while (ctx.list.length - from < want) ctx.list.push({ parked: true, dir } as TrafficCar);
}

/**
 * Whether a road's other way waits for the race to start: a single
 * carriageway's - the two ways on one road, no barrier between.
 * @param ctx the traffic
 * @returns true when it waits
 */
export const holdsOncoming = (ctx: TrafficCtx) => geo(ctx).median == null
  && geo(ctx).oncoming.length > 0;

/**
 * RESTART / a new density: cars spread over the road round the spawn (none behind you in
 * YOUR lane, none within 40 m in front of you).
 */
export function resetTraffic(ctx: TrafficCtx, nextLevel: HighwayLevel | null, density: number) {
  // (?bridgecars=1: a new road's bridges get new cars)
  resetBridgeCars(ctx);
  // (?police=1: a new road forgets the police's orders and the heat)
  ctx.police = undefined;
  ctx.level = nextLevel;
  ctx.list = [];
  ctx.placed = 0;
  ctx.recycled = 0;
  ctx.visHits = 0;
  const level = ctx.level;
  if (!level || !level.endless || !level._hw || !(density > 0)) {
    ctx.want = 0;
    rebuildCars(ctx);
    return;
  }
  const ours = Math.min(MAX_CARS, Math.round(density * PER_LANE * geo(ctx).own.length));
  // the other way's: as many a lane, up to half as many again in all
  const theirs = Math.min(MAX_CARS / 2,
    Math.round(density * PER_LANE * geo(ctx).oncoming.length));
  ctx.want = ours + theirs;
  const spawn = roadFrame(level, level.spawn.x, level.spawn.y, null)!;
  spreadCars(ctx, { s: spawn.s, off: spawn.off }, ours);
  // (a single carriageway's other way starts parked - none on the road at the
  // start, they join from out of sight ahead once the race is under way: trafficStep.ts)
  if (theirs && holdsOncoming(ctx)) {
    for (let i = 0; i < theirs; i++) ctx.list.push({ parked: true, dir: -1 } as TrafficCar);
  } else if (theirs) spreadCars(ctx, { s: spawn.s, off: spawn.off }, theirs, -1);
  rebuildCars(ctx);
}

/**
 * Make room: every traffic car within radius m of (x, y) leaves (the player was just put
 * back there).
 */
export function clearAround(ctx: TrafficCtx, x: number, y: number, radius: number) {
  let count = 0;
  for (const slot of ctx.list)
    if (!slot.parked && Math.hypot(slot.car.x - x, slot.car.y - y) < radius) {
      slot.parked = true;
      count++;
    }
  if (count) rebuildCars(ctx);
  return count;
}

/**
 * Make room for a RACE GRID: every traffic car with road distance in [fromS, toS] leaves
 * (it rejoins off screen ahead).
 */
export function clearSpan(ctx: TrafficCtx, fromS: number, toS: number) {
  let count = 0;
  for (const slot of ctx.list)
    if (!slot.parked && slot.s >= fromS && slot.s <= toS) {
      slot.parked = true;
      count++;
    }
  if (count) rebuildCars(ctx);
  return count;
}

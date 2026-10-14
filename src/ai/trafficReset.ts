// ai/trafficReset.ts: restarting the highway traffic (cars spread round the spawn) and
// making room by sending cars off the road.
import { roadFrame } from "../highway.js";
import type { HighwayLevel, TrafficCar } from "./types.ts";
import { MAX_CARS, PER_LANE, geo } from "./trafficCtx.ts";
import type { TrafficCtx } from "./trafficCtx.ts";
import { cruise, fresh, rebuildCars, roomAt } from "./trafficSpawn.ts";

/** Spread the cars over the road round the spawn (none in your lane within 40 m ahead). */
function spreadCars(ctx: TrafficCtx, spawn: { s: number; off: number }) {
  const centres = geo(ctx).centres, laneCount = centres.length, ents = [spawn];
  for (let i = 0, tries = 0; i < ctx.want && tries < ctx.want * 25; tries++) {
    const dist = spawn.s - 100 + ctx.rnd() * 520, lane = (ctx.rnd() * laneCount) | 0,
      mine = Math.abs(centres[lane] - spawn.off) < 1.5;
    if ((mine && dist < spawn.s + 40) || Math.abs(dist - spawn.s) < 14
      || !roomAt(ctx, ents, dist, lane, 26, 26)) continue;
    const slot = fresh(ctx, {} as TrafficCar, dist, lane, cruise(ctx, lane, laneCount));
    ctx.list.push(slot);
    ents.push({ s: dist, off: slot.off });
    i++;
  }
}

/**
 * RESTART / a new density: cars spread over the road round the spawn (none behind you in
 * YOUR lane, none within 40 m in front of you).
 */
export function resetTraffic(ctx: TrafficCtx, nextLevel: HighwayLevel | null, density: number) {
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
  const laneCount = geo(ctx).centres.length;
  ctx.want = Math.min(MAX_CARS, Math.round(density * PER_LANE * laneCount));
  const spawn = roadFrame(level, level.spawn.x, level.spawn.y, null)!;
  spreadCars(ctx, { s: spawn.s, off: spawn.off });
  while (ctx.list.length < ctx.want) {
    // no room at the start: they join from off screen
    ctx.list.push({ parked: true } as TrafficCar);
  }
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

// ai/trafficSpawn.ts: how the highway traffic puts cars on the road: picking a model and
// paint, placing a fresh car, finding a free off-screen spot, restarting and clearing room.
import { makeCar, reset } from "../vehicle.ts";
import { ROSTER } from "../cars.ts";
import { roadPose, roadSpan } from "../highway.ts";
import type { TrafficCar, TrafficVehicle } from "./types.ts";
import { PAINTS, SPAWN_AHEAD, SPAWN_BEHIND, VEH, geo } from "./trafficCtx.ts";
import { bridgeCarBodies } from "./trafficBridge.ts";
import type { TrafficCtx, VisFn } from "./trafficCtx.ts";

/** A random row of a weighted table (the weight is the last column). */
export function pick<T extends (string | number)[]>(ctx: TrafficCtx, tab: T[]): T {
  let roll = ctx.rnd() * tab.reduce((sum, row) => sum + (row[row.length - 1] as number), 0);
  for (const row of tab) {
    roll -= row[row.length - 1] as number;
    if (roll <= 0) return row;
  }
  return tab[0];
}

/** Cruise speed by lane: the left lane slowest (UK: keep left unless overtaking). */
export function cruise(ctx: TrafficCtx, lane: number, laneCount: number) {
  return (
    90 + (laneCount > 1 ? lane / (laneCount - 1) : 0.5) * 12 + ctx.rnd() * 8
  ) / 3.6;
}

/** A car placed already moving gets the gear (and revs) that speed needs. */
export function gearFor(car: TrafficVehicle, speed: number) {
  const spec = car.spec, rpmAt = (gearNo: number) => (
    (speed / spec.wheelR) * spec.gears[gearNo - 1] * spec.finalDrive * 60 / (2 * Math.PI)
  );
  let best = 1;
  for (let gearNo = 1; gearNo <= spec.gears.length; gearNo++)
    if (rpmAt(gearNo) > spec.downshiftRpm * 1.15) best = gearNo;
  car.gear = best;
  car.rpm = Math.max(spec.idleRpm, Math.min(spec.redline, rpmAt(best)));
}

/**
 * A car's way along the road: 1 ours, -1 the other way's.
 * @param slot the car
 * @returns 1 or -1
 */
export const dirOf = (slot: { dir?: number }) => slot.dir ?? 1;

/**
 * The lanes a way's traffic drives (the other way's, its nearside first).
 * @param ctx the traffic
 * @param dir 1 our way, -1 the other way
 * @returns the lanes' offsets, m
 */
export const lanesOf = (ctx: TrafficCtx, dir = 1) =>
  (dir < 0 ? geo(ctx).oncoming : geo(ctx).own);

/** Fill a slot with a fresh random car at road distance dist in lane, doing speed. */
export function fresh(
  ctx: TrafficCtx, slot: TrafficCar, dist: number, lane: number, speed: number, dir = 1,
) {
  const car = newTrafficVehicle(ctx);
  const lanes = lanesOf(ctx, dir), off = lanes[lane], pose = roadPose(ctx.level!, dist, off),
    heading = pose.h + (dir < 0 ? Math.PI : 0);
  reset(car, pose.x, pose.y, heading);
  car.vx = Math.cos(heading) * speed;
  car.vy = Math.sin(heading) * speed;
  gearFor(car, speed);
  Object.assign(slot, {
    car, lane, laneT: lane, laneOff: off, bias: 0,
    vWant: cruise(ctx, lane, lanes.length), s: dist, off, vAl: speed,
    ind: 0, indT: 0, think: ctx.rnd() * 0.3, keepLeftT: 0, wreck: false, deadT: 0,
    parked: false, kOff: null, kin: false, phys: true, dir, quick: false, racer: null, broke: null,
  });
  return slot;
}

/**
 * A road car for the traffic: a model and a paint picked by their weights, its aids as its spec.
 * @param ctx the traffic
 * @returns the car (not placed)
 */
export function newTrafficVehicle(ctx: TrafficCtx): TrafficVehicle {
  const ids = VEH.filter(([candId]) => ROSTER.some((entry) => entry.id === candId)),
    [vehId] = pick(ctx, ids), paintIdx = PAINTS.indexOf(pick(ctx, PAINTS)),
    [paint, trim] = PAINTS[paintIdx];
  const car: TrafficVehicle = makeCar(vehId);
  car.spec = { ...car.spec, id: vehId + '#t' + paintIdx, paint, trim };
  car.traffic = true;
  car.absOn = !!(car.spec.aids && car.spec.aids.abs);
  car.tcsOn = !!(car.spec.aids && car.spec.aids.tcs);
  return car;
}

/**
 * A placed car put moving at speed along its heading, its gear and revs for it.
 * @param slot the car
 * @param speed m/s
 */
export function setSpeed(slot: TrafficCar, speed: number) {
  const car = slot.car;
  car.vx = Math.cos(car.heading) * speed;
  car.vy = Math.sin(car.heading) * speed;
  slot.vAl = speed;
  gearFor(car, speed);
}

/** Rebuild the live car list from the slots that are not parked. */
export function rebuildCars(ctx: TrafficCtx) {
  ctx.cars.length = 0;
  ctx.ourSide.length = 0;
  const median = ctx.level?._hw?.geo.median ?? null;
  for (const slot of ctx.list) {
    if (slot.parked) continue;
    ctx.cars.push(slot.car);
    if (median == null || dirOf(slot) > 0) ctx.ourSide.push(slot.car);
  }
  // (?bridgecars=1: the bridges' cars live too - drawn and collided, ai/trafficBridge.ts)
  ctx.cars.push(...bridgeCarBodies(ctx));
}

/**
 * Room for a car in `lane` at road distance dist? (nobody within `ahead` m in front /
 * `behind` m behind, in that lane)
 */
export function roomAt(
  ctx: TrafficCtx, ents: { s: number; off: number }[], dist: number, lane: number,
  ahead = 30, behind = 30, dir = 1,
) {
  const centre = lanesOf(ctx, dir)[lane];
  for (const ent of ents)
    if (Math.abs(ent.off - centre) < 2.6 && ent.s - dist < ahead && dist - ent.s < behind)
      return false;
  return true;
}

/**
 * A free OFF-SCREEN spot ahead of / behind playerS; null if there is none this step
 * (try again next step).
 */
// m ahead your way's traffic is put back: as near as out of sight lets (the
// oncoming way's SPAWN_AHEAD) - MEASURED, tools/scratch/_trafficsides.mjs (a single carriageway,
// traffic 0.6): put back 300-470 m ahead, your way's cars kept about your speed out of sight
// ahead - 1.9 of them within 300 m of you on average, the other way's 3.2
const OWN_AHEAD = [140, 300];

export function spot(
  ctx: TrafficCtx, ents: { s: number; off: number }[], playerS: number, from: string,
  vis: VisFn, dir = 1,
) {
  const { s0: roadStart, s1: roadEnd } = roadSpan(ctx.level!),
    [near, far] = from === 'ahead' ? (dir > 0 ? OWN_AHEAD : SPAWN_AHEAD)
      : SPAWN_BEHIND,
    lanes = lanesOf(ctx, dir), laneCount = lanes.length;
  for (let attempt = 0; attempt < 8; attempt++) {
    const dist = playerS + (from === 'ahead' ? 1 : -1) * (near + ctx.rnd() * (far - near)),
      lane = (ctx.rnd() * laneCount) | 0;
    if (dist < roadStart + 60 || dist > roadEnd - 60
      || !roomAt(ctx, ents, dist, lane, 30, 30, dir)) continue;
    const pose = roadPose(ctx.level!, dist, lanes[lane]);
    if (vis(pose.x, pose.y, dist)) continue;
    return { s: dist, lane };
  }
  return null;
}

// ai/trafficSpawn.ts: how the highway traffic puts cars on the road: picking a model and
// paint, placing a fresh car, finding a free off-screen spot, restarting and clearing room.
import { makeCar, reset } from "../vehicle.ts";
import { ROSTER } from "../cars.ts";
import { roadPose, roadSpan } from "../highway.js";
import type { TrafficCar, TrafficVehicle } from "./types.ts";
import { PAINTS, SPAWN_AHEAD, SPAWN_BEHIND, VEH, geo } from "./trafficCtx.ts";
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

/** Fill a slot with a fresh random car at road distance dist in lane, doing speed. */
export function fresh(
  ctx: TrafficCtx, slot: TrafficCar, dist: number, lane: number, speed: number,
) {
  const ids = VEH.filter(([candId]) => ROSTER.some((entry) => entry.id === candId)),
    [vehId] = pick(ctx, ids), paintIdx = PAINTS.indexOf(pick(ctx, PAINTS)),
    [paint, trim] = PAINTS[paintIdx];
  const car: TrafficVehicle = makeCar(vehId);
  car.spec = { ...car.spec, id: vehId + '#t' + paintIdx, paint, trim };
  car.traffic = true;
  car.absOn = !!(car.spec.aids && car.spec.aids.abs);
  car.tcsOn = !!(car.spec.aids && car.spec.aids.tcs);
  const off = geo(ctx).centres[lane], pose = roadPose(ctx.level, dist, off);
  reset(car, pose.x, pose.y, pose.h);
  car.vx = Math.cos(pose.h) * speed;
  car.vy = Math.sin(pose.h) * speed;
  gearFor(car, speed);
  Object.assign(slot, {
    car, lane, laneT: lane, laneOff: off, bias: 0,
    vWant: cruise(ctx, lane, geo(ctx).centres.length), s: dist, off, vAl: speed,
    ind: 0, indT: 0, think: ctx.rnd() * 0.3, keepLeftT: 0, wreck: false, deadT: 0,
    parked: false, kOff: null, kin: false, phys: true,
  });
  return slot;
}

/** Rebuild the live car list from the slots that are not parked. */
export function rebuildCars(ctx: TrafficCtx) {
  ctx.cars.length = 0;
  for (const slot of ctx.list) if (!slot.parked) ctx.cars.push(slot.car);
}

/**
 * Room for a car in `lane` at road distance dist? (nobody within `ahead` m in front /
 * `behind` m behind, in that lane)
 */
export function roomAt(
  ctx: TrafficCtx, ents: { s: number; off: number }[], dist: number, lane: number,
  ahead = 30, behind = 30,
) {
  const centre = geo(ctx).centres[lane];
  for (const ent of ents)
    if (Math.abs(ent.off - centre) < 2.6 && ent.s - dist < ahead && dist - ent.s < behind)
      return false;
  return true;
}

/**
 * A free OFF-SCREEN spot ahead of / behind playerS; null if there is none this step
 * (try again next step).
 */
export function spot(
  ctx: TrafficCtx, ents: { s: number; off: number }[], playerS: number, from: string,
  vis: VisFn,
) {
  const { s0: roadStart, s1: roadEnd } = roadSpan(ctx.level),
    [near, far] = from === 'ahead' ? SPAWN_AHEAD : SPAWN_BEHIND,
    laneCount = geo(ctx).centres.length;
  for (let attempt = 0; attempt < 8; attempt++) {
    const dist = playerS + (from === 'ahead' ? 1 : -1) * (near + ctx.rnd() * (far - near)),
      lane = (ctx.rnd() * laneCount) | 0;
    if (dist < roadStart + 60 || dist > roadEnd - 60 || !roomAt(ctx, ents, dist, lane))
      continue;
    const pose = roadPose(ctx.level, dist, geo(ctx).centres[lane]);
    if (vis(pose.x, pose.y, dist)) continue;
    return { s: dist, lane };
  }
  return null;
}

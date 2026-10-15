// ai/trafficLane.ts: a highway traffic car's lane decisions each step: the car ahead, choosing
// a lane (overtake, keep left, for no reason), indicating, drifting across, aborting, and the
// lean away from you.
import { CROSS_T, IND_T } from "./trafficCtx.ts";
import type { TrafficCtx } from "./trafficCtx.ts";
import type { TrafficCar, TrafficEnt } from "./types.ts";

/** What every car's step shares: the step, everyone on the road and the road's lanes. */
export interface DriveEnv {
  dt: number;
  ents: TrafficEnt[];
  centres: number[];
  laneCount: number;
  minOff: number;
  maxOff: number;
}

/** The car ahead in my path (my lane line, or where I am now while crossing). */
export function findLead(slot: TrafficCar, ents: TrafficEnt[]) {
  const car = slot.car;
  let lead: TrafficEnt | null = null, gap = Infinity;
  for (const ent of ents) {
    if (ent.car === car) continue;
    const ahead = ent.s - slot.s;
    if (ahead <= 0 || ahead > 110) continue;
    if (Math.min(Math.abs(ent.off - slot.laneOff), Math.abs(ent.off - slot.off)) > 2.3) continue;
    const bumperGap = ahead - (car.spec.len + ent.car.spec.len) / 2;
    if (bumperGap < gap) {
      gap = bumperGap;
      lead = ent;
    }
  }
  return { lead, gap };
}

/**
 * CLEAR for the WHOLE manoeuvre (MEASURED, trafficcheck: a ~26 m look back let
 * a car 25 km/h faster arrive alongside during the ~5 s it takes to indicate + cross ->
 * traffic-on-traffic crashes): room ahead for a slower car, and a car behind must
 * not be able to close the gap within CROSS_T
 */
function laneClear(slot: TrafficCar, env: DriveEnv, laneNo: number) {
  if (laneNo < 0 || laneNo >= env.laneCount) return false;
  // a lane someone is MOVING INTO is taken too (MEASURED: two cars from lanes 0 and 2
  // both took the empty middle lane at once)
  for (const ent of env.ents) {
    if (ent.car === slot.car
      || (Math.abs(ent.off - env.centres[laneNo]) > 2.4 && !(ent.t && ent.t.laneT === laneNo)))
      continue;
    const ahead = ent.s - slot.s, rel = slot.vAl - ent.v;
    if (ahead < 14 + Math.max(0, rel) * 3 && ahead > -(12 + Math.max(0, -rel) * CROSS_T))
      return false;
  }
  return true;
}

/** Is a car slower than I want to go ahead of me in that lane? */
function slowIn(slot: TrafficCar, env: DriveEnv, laneNo: number) {
  for (const ent of env.ents) {
    if (ent.car === slot.car || Math.abs(ent.off - env.centres[laneNo]) > 2.0) continue;
    const ahead = ent.s - slot.s;
    if (ahead > 0 && ahead < 70 && ent.v < slot.vWant - 2) return true;
  }
  return false;
}

/** Blocked by a slower car: overtake on the right, else rarely on the left. */
function overtakeLane(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv) {
  if (laneClear(slot, env, slot.lane + 1)) return slot.lane + 1;
  return ctx.rnd() < 0.3 && laneClear(slot, env, slot.lane - 1) && !slowIn(slot, env, slot.lane - 1)
    ? slot.lane - 1 : null;
}

/** Pick a lane to move to (or none): overtake, keep left, or now and then for no reason. */
function chooseLane(
  ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, lead: TrafficEnt | null, gap: number,
) {
  const rnd = ctx.rnd;
  const blocked = lead && lead.v < slot.vWant - 3 && gap < 45;
  let goLane: number | null = null;
  if (blocked) goLane = overtakeLane(ctx, slot, env);
  else if (slot.lane > 0 && slot.keepLeftT > 8 && laneClear(slot, env, slot.lane - 1)
    && !slowIn(slot, env, slot.lane - 1)) goLane = slot.lane - 1;   // keep left
  else if (env.laneCount > 1 && rnd() < 0.004) {   // now and then, for no reason
    const laneNo = slot.lane + (rnd() < 0.5 ? 1 : -1);
    if (laneClear(slot, env, laneNo)) goLane = laneNo;
  }
  return goLane;
}
/** LANE DECISIONS, a few times a second. */
export function laneDecisions(
  ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, lead: TrafficEnt | null, gap: number,
) {
  if (!((slot.think -= env.dt) <= 0 && !slot.wreck)) return;
  slot.think = 0.25 + ctx.rnd() * 0.15;
  slot.keepLeftT += 0.3;
  if (slot.laneT === slot.lane) {
    const goLane = chooseLane(ctx, slot, env, lead, gap);
    if (goLane != null) {
      slot.laneT = goLane;
      slot.ind = Math.sign(goLane - slot.lane);
      slot.indT = IND_T;
    }
  } else if (slot.indT > 0 && !laneClear(slot, env, slot.laneT)) {   // changed its mind
    slot.laneT = slot.lane;
    slot.ind = 0;
  }
}

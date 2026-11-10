// ai/trafficDrive.ts: one highway traffic car's step: the lane decisions, the lean away from
// you and the speed to hold; then it is carried (kinematic) or driven by the real physics.
import { GAP0, HEADWAY, SPEEDER_HEADWAY } from "./trafficCtx.ts";
import type { TrafficCtx } from "./trafficCtx.ts";
import { crossLanes, leanAway } from "./trafficAcross.ts";
import { findLead, laneDecisions } from "./trafficLane.ts";
import type { DriveEnv } from "./trafficLane.ts";
import { carryKinematic, drivePhysics } from "./trafficPhys.ts";
import { driveBroken, mayBreak } from "./trafficBreak.ts";
import { driveSpeeder } from "./trafficSpeeder.ts";
import type { TrafficCar, TrafficEnt } from "./types.ts";

// s to meeting a car coming at it in its lane within which the other way's car brakes, the most
// it brakes, and the m it edges toward its own verge then (Deaf Valley: following it,
// it stopped dead in the road - MEASURED, hwracecheck: racers ran into the queue; braking in full
// as it edged over, it spun off - tools/trafficcheck.mjs TWOWAY=1: 92 car-steps off the road)
const MEET_T = 3, MEET_BRAKE = 0.5, MEET_EDGE_M = 0.8;

/** SPEED: cruise, or follow the car ahead; hard braking when a collision is close. */
function speedTarget(slot: TrafficCar, lead: TrafficEnt | null, gap: number) {
  let vTarget = slot.vWant, brakeX = 0;
  const dir = slot.dir ?? 1;
  if (dir < 0) slot.bias = 0;
  if (lead && dir < 0 && dir * lead.v < 0) {
    // the other way's car and one coming at it (a racer passing): no following - it brakes and
    // edges over as the meeting nears
    const ttc = gap / Math.max(1, slot.vAl - dir * lead.v);
    if (ttc < MEET_T) {
      brakeX = MEET_BRAKE * (MEET_T - ttc) / MEET_T;
      slot.bias = MEET_EDGE_M;
    }
    return { vTarget, brakeX };
  }
  if (lead) {
    // (the lead's speed this car's way)
    const leadV = dir * lead.v;
    // (?speeders=1: a speeder tailgates)
    const wantGap = GAP0 + (slot.racer ? SPEEDER_HEADWAY : HEADWAY) * Math.max(0, slot.vAl);
    vTarget = Math.min(vTarget, Math.max(0, leadV + (gap - wantGap) * 0.4));
    if (gap < 2.5) vTarget = 0;
    const close = slot.vAl - leadV;
    if (close > 0.5) {
      const ttc = gap / close;
      if (ttc < 2.5) brakeX = Math.min(1, (2.5 - ttc) / 1.8);
    }
  }
  return { vTarget, brakeX };
}

/** One traffic car's step: decide (lane, lean, speed), then carry it or drive it. */
export function driveOne(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv) {
  const car = slot.car;
  car._p = { x: car.x, y: car.y, h: car.heading };
  const speed = Math.hypot(car.vx, car.vy);
  // (?breakdowns=1: a car with an issue pulls over and stops; ?speeders=1: a speeder near a real
  // car is the racing driver's)
  mayBreak(ctx, slot, env);
  if (slot.broke) {
    driveBroken(ctx, slot, env, speed);
    return;
  }
  if (slot.racer && slot.phys) {
    driveSpeeder(ctx, slot, env, speed);
    return;
  }
  const { lead, gap } = findLead(slot, env.ents);
  // (the other way's traffic keeps its lane)
  if ((slot.dir ?? 1) > 0) {
    laneDecisions(ctx, slot, env, lead, gap);
    crossLanes(ctx, slot, env);
    leanAway(slot, env);
  }
  const { vTarget, brakeX } = speedTarget(slot, lead, gap);
  // ---- LOD (MEASURED, tools/_tfprof: applyGround alone is ~17 us per car-step,
  // 18 cars = 0.57 ms a step = a phone frame's budget gone): a car OUT OF VIEW and > PHYS_NEAR
  // m from every real car (you, the AI) is KINEMATIC — the same decisions, then carried
  // along its lane line at its speed (2 m/s^2 up, 7 down, 9 in an emergency). It becomes a
  // real car again before you can see it or touch it.
  if (!slot.phys) carryKinematic(ctx, slot, env, vTarget, brakeX);
  else drivePhysics(ctx, slot, env, speed, vTarget, brakeX);
}

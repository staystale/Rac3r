// ai/trafficDrive.ts: one highway traffic car's step: the lane decisions, the lean away from
// you and the speed to hold; then it is carried (kinematic) or driven by the real physics.
import { GAP0, HEADWAY } from "./trafficCtx.ts";
import type { TrafficCtx } from "./trafficCtx.ts";
import { crossLanes, leanAway } from "./trafficAcross.ts";
import { findLead, laneDecisions } from "./trafficLane.ts";
import type { DriveEnv } from "./trafficLane.ts";
import { carryKinematic, drivePhysics } from "./trafficPhys.ts";
import type { TrafficCar, TrafficEnt } from "./types.ts";

/** SPEED: cruise, or follow the car ahead; hard braking when a collision is close. */
function speedTarget(slot: TrafficCar, lead: TrafficEnt | null, gap: number) {
  let vTarget = slot.vWant, brakeX = 0;
  if (lead) {
    const wantGap = GAP0 + HEADWAY * Math.max(0, slot.vAl);
    vTarget = Math.min(vTarget, Math.max(0, lead.v + (gap - wantGap) * 0.4));
    if (gap < 2.5) vTarget = 0;
    const close = slot.vAl - lead.v;
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
  const { lead, gap } = findLead(slot, env.ents);
  laneDecisions(ctx, slot, env, lead, gap);
  crossLanes(ctx, slot, env);
  leanAway(slot, env);
  const { vTarget, brakeX } = speedTarget(slot, lead, gap);
  // ---- LOD (MEASURED 2026-10-05, tools/_tfprof: applyGround alone is ~17 us per car-step,
  // 18 cars = 0.57 ms a step = a phone frame's budget gone): a car OUT OF VIEW and > PHYS_NEAR
  // m from every real car (you, the AI) is KINEMATIC — the same decisions, then carried
  // along its lane line at its speed (2 m/s^2 up, 7 down, 9 in an emergency). It becomes a
  // real car again before you can see it or touch it.
  if (!slot.phys) carryKinematic(ctx, slot, env, vTarget, brakeX);
  else drivePhysics(ctx, slot, env, speed, vTarget, brakeX);
}

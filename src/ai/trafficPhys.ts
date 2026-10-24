// ai/trafficPhys.ts: how a highway traffic car is moved once it has decided: carried along its
// lane line (kinematic, out of view) or driven by the same physics as every car.
import { LAT_V } from "./trafficCtx.ts";
import type { TrafficCtx } from "./trafficCtx.ts";
import type { DriveEnv } from "./trafficLane.ts";
import { cruise, gearFor } from "./trafficSpawn.ts";
import { roadPose } from "../highway.js";
import { step } from "../vehicle.ts";
import { applyGround, fenceClamp, obstacleClamp } from "../world/wear.ts";
import { barrierClamp, solidClamp } from "../world/barriers.ts";
import { hit, tooInjured } from "../damage.js";
import { rolling, tripCheck, stepRoll } from "../roll.js";
import type { TrafficCar } from "./types.ts";

// HANDOVER EASE (owner: traffic "changes lane / shuffles into lane", traffic
// only). MEASURED (tools/scratch/_laneshuffle.mjs, highway, traffic 1.5, 180 s, undamaged cars):
// a driven car handed back to being carried - in view too - was put straight onto its old
// lane's line: 1-6 m sideways in one step, 3-4 times in 3 min. Now it starts where it really
// is, takes the nearest lane when it is not changing lanes, and drifts onto the line at no
// more than the lane-change speed, nose into the drift.

/**
 * A car just handed back to being carried (no carried offset yet): it carries on from where it
 * really is (slot.off), in the nearest lane unless it is changing lanes.
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 */
function takeOverFromPhysics(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv): void {
  slot.kOff = Math.max(env.minOff, Math.min(env.maxOff, slot.off));
  if (slot.laneT !== slot.lane) return;
  let nearest = slot.lane;
  env.centres.forEach((centre, lane) => {
    if (Math.abs(centre - slot.off) < Math.abs(env.centres[nearest] - slot.off)) nearest = lane;
  });
  if (nearest === slot.lane) return;
  slot.lane = slot.laneT = nearest;
  slot.laneOff = env.centres[nearest];
  slot.vWant = cruise(ctx, nearest, env.laneCount);
}

/**
 * The carried offset this step: a drift toward the lane line from the last step's offset at no
 * more than the lane-change speed (the line itself with no last offset).
 * @param slot the car
 * @param env the step's road
 * @returns the offset, m
 */
function carriedOffset(slot: TrafficCar, env: DriveEnv): number {
  const line = Math.max(env.minOff, Math.min(env.maxOff, slot.laneOff));
  if (slot.kOff == null) return line;
  const maxStep = LAT_V * env.dt;
  return slot.kOff + Math.max(-maxStep, Math.min(maxStep, line - slot.kOff));
}

/** A kinematic car carried along its lane line at its speed. */
export function carryKinematic(
  ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, vTarget: number, brakeX: number,
) {
  const car = slot.car, dt = env.dt;
  slot.vAl += Math.max((brakeX > 0 ? -9 : -7) * dt, Math.min(2 * dt, vTarget - slot.vAl));
  if (slot.vAl < 0) slot.vAl = 0;
  // the lateral drift (lane change) yaws the nose into it, as a driven car's would; the
  // lean toward you is not used (no one is near)
  // (MEASURED: a recycled car inherited the old car's kOff -> one step of a huge sideways
  // speed -> contacts + off the road; now fresh clears it and the drift rate is capped
  // at the lane-change speed)
  if (slot.kOff == null) takeOverFromPhysics(ctx, slot, env);
  const offK = carriedOffset(slot, env),
    latV = slot.kOff == null ? 0
      : Math.max(-LAT_V, Math.min(LAT_V, (offK - slot.kOff) / dt));
  slot.kOff = offK;
  const pose = roadPose(ctx.level, slot.s + slot.vAl * dt, offK),
    heading = pose.h + Math.atan2(latV, Math.max(3, slot.vAl));
  // yaw rate + steering held at what the BEND needs (MEASURED: woken with both 0 in a
  // bend, a car ran 0.3 m off the edge for 1.2 s)
  const poseAhead = roadPose(ctx.level, slot.s + slot.vAl * dt + 4, offK);
  let dHead = poseAhead.h - pose.h;
  dHead = Math.atan2(Math.sin(dHead), Math.cos(dHead));
  const kRoad = dHead / 4;
  car.x = pose.x;
  car.y = pose.y;
  car.heading = heading;
  car.vx = Math.cos(pose.h) * slot.vAl - Math.sin(pose.h) * latV;
  car.vy = Math.sin(pose.h) * slot.vAl + Math.cos(pose.h) * latV;
  car.yawRate = slot.vAl * kRoad;
  car.delta = Math.atan(kRoad * car.spec.L);
  car.indicator = slot.laneT !== slot.lane ? slot.ind : 0;
  car.brakeLight = brakeX;
  slot.deadT = 0;
  slot.kin = true;
}

/** The input of a real-physics car: a wreck brakes, else pure pursuit and the speed. */
function physicsInput(
  ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number, vTarget: number,
  brakeX: number,
) {
  const car = slot.car;
  if (slot.wreck || tooInjured(car)) {
    slot.wreck = true;
    return { steer: 0, throttle: 0, brake: 0.7, handbrake: 0, reverse: 0 };
  }
  // PURE PURSUIT on the lane line (+ the lean), kept inside the carriageway
  const offT = Math.max(env.minOff, Math.min(env.maxOff, slot.laneOff + slot.bias)),
    lookAhead = Math.max(10, Math.min(32, 8 + 0.5 * speed)),
    target = roadPose(ctx.level, slot.s + lookAhead, offT);
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading),
    toX = target.x - car.x, toY = target.y - car.y,
    xLocal = toX * cosH + toY * sinH, yLocal = -toX * sinH + toY * cosH;
  const curv = 2 * yLocal / Math.max(1, xLocal * xLocal + yLocal * yLocal),
    LOCK = car.spec.steerMax || 0.56;
  const steer = Math.max(-1, Math.min(1,
    (Math.atan(curv * car.spec.L) - 0.02 * (car.yawRate - speed * curv)) / LOCK));
  const err = vTarget - slot.vAl,
    brake = Math.max(brakeX, err < -0.8 ? Math.min(1, -err * 0.12) : 0);
  return {
    steer, throttle: brake > 0 || err <= 0 ? 0 : Math.min(0.75, err * 0.25),
    brake, handbrake: 0, reverse: 0,
  };
}

/** A real car: the input, then the same physics as every car. */
export function drivePhysics(
  ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number, vTarget: number,
  brakeX: number,
) {
  const car = slot.car, dt = env.dt;
  if (slot.kin) {   // waking up: the gear for the speed it is doing
    slot.kin = false;
    slot.kOff = null;
    gearFor(car, slot.vAl);
    // and seated on the ground where it is now, as a reset does (wear.ts applyGround): carried,
    // its suspension kept the height it last drove at - MEASURED (trafficcheck): woken on a
    // hill 4.4 m higher, the ground's jump read as 32 m/s up and threw the car 42 m in the air
    car.groundInit = false;
  }
  const input = physicsInput(ctx, slot, env, speed, vTarget, brakeX);
  car.indicator = slot.laneT !== slot.lane ? slot.ind : 0;
  car.hazard = slot.wreck;
  car.brakeLight = input.brake;
  slot.deadT = speed < 1 ? slot.deadT + dt : 0;
  // ---- the same physics as every car: clamps (+ the damage they do), ground, then the
  // tyres or the tumble
  const v0x = car.vx, v0y = car.vy;
  fenceClamp(car);
  obstacleClamp(car);
  barrierClamp(car);
  solidClamp(car);
  hit(car, v0x, v0y);
  applyGround(car, dt);
  if (rolling(car)) {
    stepRoll(car, dt, () => {});
    slot.wreck = true;
  }
  else {
    step(car, input, dt);
    tripCheck(car, dt);
  }
}

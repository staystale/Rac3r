// ai/trafficBreak.ts - BREAKDOWNS (owner 11-10: "And pull into hard shoulders if they have an
// issue ect haha"): now and then one of your way's cars in the nearside lane has an
// issue - it indicates left, slows and drifts onto the HARD SHOULDER (on a road without one, the
// verge, where a reset would find room: highway/vergeback.ts vergeRoom) and stops there, its
// hazards on; and now and then a car put back ahead is one already stopped there. It waits there
// for you (standing still ahead does not send it away) and goes once you have passed it, out of
// sight.
import { roadPose } from '../highway.ts';
import { vergeRoom } from '../highway/vergeback.ts';
import { reset } from '../vehicle.ts';
import { geo } from './trafficCtx.ts';
import type { TrafficCtx } from './trafficCtx.ts';
import type { DriveEnv } from './trafficLane.ts';
import { carryKinematic, drivePhysics } from './trafficPhys.ts';
import { setSpeed } from './trafficSpawn.ts';
import type { TrafficCar, TrafficEnt } from './types.ts';
import type { HwLevel } from '../highway/hwtypes.ts';

// a nearside car's chance a second of an issue; the share of the cars put back ahead that come
// back already stopped at the roadside
const BREAK_PER_S = 0.002, BROKEN_SHARE = 0.04;
// m/s^2 it slows at pulling over, then stopping; m/s it pulls over at; m/s it drifts across
const SLOW_MS2 = 2.5, STOP_MS2 = 2.2, PULL_MS = 11, DRIFT_MS = 0.9;
// m of hard shoulder a road needs to stop on it; m past the edge a car's middle stops on the
// verge; m along the road ahead it looks for room to stop, every LOOK_STEP_M
const SHOULDER_M = 2, VERGE_M = 1.6, LOOK_M = 160, LOOK_STEP_M = 40;
// m along the roadside kept clear of another stopped car, m across
const STOP_GAP_M = 30, STOP_ACROSS_M = 2.6;
// a stopped car's controls: the brakes and the handbrake on
export const PARKED = { steer: 0, throttle: 0, brake: 1, handbrake: 1, reverse: 0 };

/**
 * Where a car with an issue stops at road distance dist, m off the road's line: the hard
 * shoulder's middle, else the verge where there is room, else nowhere.
 * @param ctx the traffic
 * @param dist road distance, m
 * @returns the offset, or null
 */
export function stopOffAt(ctx: TrafficCtx, dist: number): number | null {
  const level = ctx.level!, half = geo(ctx).hw, shoulder = level._cfg.shoulder;
  if (shoulder >= SHOULDER_M) return -half + shoulder / 2;
  const off = -(half + VERGE_M);
  return vergeRoom(level as unknown as HwLevel, dist, off) ? off : null;
}

/**
 * Whether no other car stands at the roadside spot (STOP_GAP_M along, STOP_ACROSS_M across).
 * @param ents everyone on the road
 * @param dist road distance, m
 * @param off m off the road's line
 * @returns free
 */
export const roadsideFree = (ents: TrafficEnt[], dist: number, off: number) => !ents.some((ent) =>
  Math.abs(ent.off - off) < STOP_ACROSS_M && Math.abs(ent.s - dist) < STOP_GAP_M);

/**
 * Whether a car may have an issue now: your way's, in the nearside lane, not changing lanes,
 * not a speeder, a police car or a wreck or broken down already - and the dice.
 * @param ctx the traffic
 * @param slot the car
 * @param dt the step, s
 * @returns it may
 */
const mayHaveIssue = (ctx: TrafficCtx, slot: TrafficCar, dt: number) => !slot.broke
  && !slot.racer && !slot.police && !slot.wreck && (slot.dir ?? 1) > 0 && slot.lane === 0
  && slot.laneT === 0 && ctx.rnd() < BREAK_PER_S * dt;

/**
 * Now and then a nearside car has an issue: with room to stop all along the next LOOK_M, it
 * starts pulling over.
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 */
export function mayBreak(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv) {
  if (!mayHaveIssue(ctx, slot, env.dt)) return;
  const stopOff = stopOffAt(ctx, slot.s);
  if (stopOff == null) return;
  for (let ahead = LOOK_STEP_M; ahead <= LOOK_M; ahead += LOOK_STEP_M)
    if (stopOffAt(ctx, slot.s + ahead) !== stopOff
      || !roadsideFree(env.ents, slot.s + ahead, stopOff)) return;
  slot.broke = { stopOff, v: slot.vAl, off: slot.off, stopped: false };
}

/**
 * A car just put back ahead, now and then made one already stopped at the
 * roadside there, its hazards on.
 * @param ctx the traffic
 * @param slot the car
 * @param ents everyone on the road
 * @returns made one
 */
export function mayPlaceBroken(ctx: TrafficCtx, slot: TrafficCar, ents: TrafficEnt[]) {
  if (ctx.rnd() >= BROKEN_SHARE) return false;
  const stopOff = stopOffAt(ctx, slot.s);
  if (stopOff == null || !roadsideFree(ents, slot.s, stopOff)) return false;
  const pose = roadPose(ctx.level!, slot.s, stopOff);
  reset(slot.car, pose.x, pose.y, pose.h);
  setSpeed(slot, 0);
  Object.assign(slot, { lane: 0, laneT: 0, laneOff: stopOff, off: stopOff, kOff: stopOff,
    broke: { stopOff, v: 0, off: stopOff, stopped: true } });
  slot.car.hazard = true;
  return true;
}

/**
 * A car with an issue: across onto the roadside at DRIFT_MS, slowing to PULL_MS, then to a stop
 * there; carried or driven as any traffic car, the left indicator on until it has stopped, then
 * the hazards (and no brake lights: parked).
 * @param ctx the traffic
 * @param slot the car
 * @param env the step's road
 * @param speed its speed, m/s
 */
export function driveBroken(ctx: TrafficCtx, slot: TrafficCar, env: DriveEnv, speed: number) {
  const broke = slot.broke!, dt = env.dt, drift = DRIFT_MS * dt;
  broke.off += Math.max(-drift, Math.min(drift, broke.stopOff - broke.off));
  const there = Math.abs(broke.off - broke.stopOff) < 1e-6
    && Math.abs(slot.off - broke.stopOff) < 0.5;
  broke.v = there ? Math.max(0, broke.v - STOP_MS2 * dt)
    : Math.max(Math.min(broke.v, PULL_MS), broke.v - SLOW_MS2 * dt);
  slot.laneOff = broke.off;
  slot.laneT = slot.lane;
  slot.bias = 0;
  // (its road reaches the roadside)
  const roadside = { ...env, minOff: Math.min(env.minOff, broke.stopOff) };
  if (!slot.phys) carryKinematic(ctx, slot, roadside, broke.v, 0);
  else drivePhysics(ctx, slot, roadside, speed, broke.v, 0, broke.stopped ? PARKED : undefined);
  broke.stopped = broke.stopped || (there && slot.vAl < 0.5);
  const car = slot.car;
  car.indicator = broke.stopped ? 0 : -1;
  car.hazard = broke.stopped || slot.wreck;
  if (broke.stopped) car.brakeLight = 0;
}

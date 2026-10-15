// autodrive.js — the SCRIPTED DRIVER, in the game. Moved out of tools/lapdriver.mjs (
// menus) so one driver serves three jobs: the lap-time benchmark (tools/lapdriver.mjs imports
// this), the live demo lap behind the main menu, and the seed of the AI drivers (roadmap D1).
// One copy, so the bench always measures what the demo and the AI drive.
//
// The driver (history in tools/lapdriver.mjs and ENGINE.md): a STANLEY controller on the
// subtrack centreline for steering, and a target speed from the tightest radius ahead and the
// grip of the surface there, v = sqrt(K_GRIP * mu * g * R), with a braking allowance; it brakes
// firmly (gain 1.0) with a 35% floor while steering, and feathers the throttle by feel.
import { groundAt } from "../world/wear.ts";
import { GRAVITY } from '../cars.ts';
import type { Subtrack, TrackPoint } from "../world/types.ts";
import type { AiCar, DriveInput } from "./types.ts";

// fraction of the theoretical cornering speed it uses — a careful, CONSISTENT driver
const K_GRIP = 0.40;
const K_DECEL = 0.30;    // fraction of mu*g it plans to brake at

/** The scripted driver's state: where it is along the centreline and how far it has gone. */
interface AutoState {
  d: number | null;
  travelled: number;
  lastDist: number;
  vT: number;
}

/** What createAutoDriver makes once and passes to its step functions. */
interface AutoCtx {
  pts: Subtrack["pts"];
  total: number;
  pointAt: (dist: number) => TrackPoint;
  radiusAt: (dist: number) => number;
  state: AutoState;
}

/** The nearest centreline point to the car (the start of progress). */
function startDist(ctx: AutoCtx, car: AiCar) {
  const { pts, state } = ctx;
  // start at the nearest centreline point
  let bestDist2 = Infinity;
  for (const point of pts) {
    const dist2 = (point.x - car.x) ** 2 + (point.y - car.y) ** 2;
    if (dist2 < bestDist2) {
      bestDist2 = dist2;
      state.d = point.dist;
    }
  }
}

/** PROGRESS: the nearest point in a window just behind / ahead; keeps state.d and travelled. */
function progress(ctx: AutoCtx, car: AiCar) {
  const { pts, total, state } = ctx;
  if (state.d === null) startDist(ctx, car);
  // (state.d! below: the block above sets state.d from the centreline points,
  // which tsc cannot see)
  // PROGRESS: nearest point in a window just behind / ahead (see lapdriver history:
  // querySubtrack froze off the road)
  let best: TrackPoint | null = null, bestDist2 = Infinity;
  for (const point of pts) {
    let ahead = point.dist - state.d!;
    if (ahead < -total / 2) ahead += total;
    if (ahead > total / 2) ahead -= total;
    if (ahead < -5 || ahead > 40) continue;
    const dist2 = (point.x - car.x) ** 2 + (point.y - car.y) ** 2;
    if (dist2 < bestDist2) { bestDist2 = dist2; best = point; }
  }
  if (best) {
    let step = best.dist - state.d!;
    if (step < -total / 2) step += total;
    if (step > 0) state.travelled += step;
    state.d = best.dist;
  }
  state.lastDist = Math.sqrt(bestDist2);
  return best;
}

/** STANLEY steering at the front axle. */
function steerStep(ctx: AutoCtx, car: AiCar, best: TrackPoint | null, speed: number) {
  const { pts, total, pointAt, state } = ctx;
  const frontX = car.x + Math.cos(car.heading) * car.spec.lf,
    frontY = car.y + Math.sin(car.heading) * car.spec.lf;
  let frontPoint = best || pointAt(state.d!), frontBestDist2 = Infinity;
  for (const axlePoint of pts) {
    let axleAhead = axlePoint.dist - state.d!;
    if (axleAhead < -total / 2) axleAhead += total;
    if (axleAhead > total / 2) axleAhead -= total;
    if (axleAhead < -3 || axleAhead > 12) continue;
    const axleDist2 = (axlePoint.x - frontX) ** 2 + (axlePoint.y - frontY) ** 2;
    if (axleDist2 < frontBestDist2) { frontBestDist2 = axleDist2; frontPoint = axlePoint; }
  }
  const ahead = pointAt(frontPoint.dist + 2 + speed * 0.15);
  let psi = ahead.heading - car.heading; psi = Math.atan2(Math.sin(psi), Math.cos(psi));
  const cross = (frontX - frontPoint.x) * frontPoint.nx + (frontY - frontPoint.y) * frontPoint.ny;
  const deltaS = psi + Math.atan2(-1.2 * cross, speed + 2)
    - 0.03 * (car.yawRate - speed * Math.tan(car.delta) / car.spec.L);
  const muHere = car.surface.mu * car.spec.mu;
  const LOCK = car.spec.steerMax || 0.56;
  const cap = Math.min(
    1, (1.6 * car.spec.L * muHere * GRAVITY / Math.max(4, speed * speed)) / LOCK + 0.02);
  const steer = Math.max(-cap, Math.min(cap, deltaS / LOCK));
  return steer;
}

/** SPEED: the slowest corner in the next stretch, at the grip of the surface there. */
function targetSpeedAt(ctx: AutoCtx, car: AiCar, speed: number) {
  const { pointAt, radiusAt, state } = ctx;
  let targetSpeed = 60;
  for (let lookAhead = 5; lookAhead < 20 + speed * 2.2; lookAhead += 4) {
    const point = pointAt(state.d! + lookAhead),
      surfaceMu = groundAt(point.x, point.y).surface.mu * car.spec.mu;
    const cornerSpeed = Math.sqrt(K_GRIP * surfaceMu * GRAVITY * radiusAt(state.d! + lookAhead));
    targetSpeed = Math.min(
      targetSpeed,
      Math.sqrt(cornerSpeed * cornerSpeed + 2 * K_DECEL * surfaceMu * GRAVITY * lookAhead));
  }
  return targetSpeed;
}

/** The throttle and brake for the target speed, feathered by the rear slide. */
function pedals(car: AiCar, speed: number, targetSpeed: number, steer: number): DriveInput {
  const slideR = Math.abs(car.t.slipR),
    feel = Math.max(0, 1 - Math.max(0, slideR - 0.06) / 0.10)
    * (car.t.spinR || car.t.spinF ? 0.5 : 1);
  const throttle = speed < targetSpeed ? Math.min(1, (targetSpeed - speed) * 0.5) * feel : 0;
  const brake = speed > targetSpeed + 0.5
    ? Math.min(1, (speed - targetSpeed) * 1.0) * Math.max(0.35, 1 - Math.abs(steer) / 0.25)
    : 0;
  return { steer, throttle, brake, handbrake: 0 };
}

export function createAutoDriver(subtrack: Subtrack) {
  const pts = subtrack.pts, total = subtrack.totalDist;
  // binary search (the linear scan was 12 % of a frame with 5 AI drivers)
  const pointAt = (dist: number) => {
    dist = ((dist % total) + total) % total;
    let low = 0, high = pts.length - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (pts[mid].dist <= dist) low = mid;
      else high = mid - 1;
    }
    return pts[low];
  };
  const radiusAt = (dist: number) => {
    let headingChange = pointAt(dist + 4).heading - pointAt(dist - 4).heading;
    headingChange = Math.atan2(Math.sin(headingChange), Math.cos(headingChange));
    return 8 / Math.max(1e-4, Math.abs(headingChange));
  };
  const state: AutoState = { d: null, travelled: 0, lastDist: 0, vT: 60 };
  const ctx: AutoCtx = { pts, total, pointAt, radiusAt, state };

  // Returns { steer, throttle, brake, handbrake } for this step, and keeps progress
  // (state.d, state.travelled).
  function drive(car: AiCar): DriveInput {
    const best = progress(ctx, car);
    const speed = Math.hypot(car.vx, car.vy);
    const steer = steerStep(ctx, car, best, speed);
    const targetSpeed = targetSpeedAt(ctx, car, speed);
    state.vT = targetSpeed;
    return pedals(car, speed, targetSpeed, steer);
  }
  return { drive, state, total };
}

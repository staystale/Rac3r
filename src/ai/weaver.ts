// ai/weaver.js — the HIGHWAY driver (roadDriver) + driveOut (from aidriver.js).
import { envValue } from "../core/debug.ts";
import type {
  AiCar, DriveCtx, DriveInput, DriveOutState, HighwayLevel, Traits, WeaverState,
} from "./types.ts";
import { roadPose, roadSpan } from "../highway.js";
import { HWT, IDLE, MARGIN } from "./weaverCtx.ts";
import type { Wvr } from "./weaverCtx.ts";
import { makeStep } from "./weaverStep.ts";
import { aimTarget, chooseLine, wanderStep } from "./weaverLine.ts";
import { cornerSpeed, followStep, limitStep, pedalCmd } from "./weaverSpeed.ts";
import { steerCmd } from "./weaverSteer.ts";

// ---------------------------------------------------------------- DRIVE ITSELF OUT (both roads)
// Nearly still for DRIVE_OUT_T s after the green (nose in a wall, beached, tangled) -> REVERSE
// ~1-1.5 s with the wheel turned to swing the nose back toward the road direction roadH(); three
// tries inside 15 s and still stuck -> state.giveUp: main.js resets it (last resort). Returns the
// reversing controls, or null = drive on. (NOOUT=1 env: node A/B only - proves the highway merge
// changed nothing else)
const NOOUT = !!envValue("NOOUT");
const DRIVE_OUT_T = 1.2;
export function driveOut(
  state: DriveOutState, car: AiCar, speed: number, dt: number, ctx: DriveCtx,
  rnd: () => number, roadH: () => number,
) {
  if (ctx.hold || !(state.t > 3) || NOOUT) return null;
  if (state.t < (state.revUntil || 0)) {
    let headErr = roadH() - car.heading;
    headErr = Math.atan2(Math.sin(headErr), Math.cos(headErr));
    return { steer: -Math.sign(headErr || 1), throttle: 0, brake: 0, handbrake: 0, reverse: 1 };
  }
  state.slowT = speed < 1.5 ? (state.slowT || 0) + dt : 0;
  if (state.slowT > DRIVE_OUT_T) {
    state.slowT = 0;
    state.revUntil = state.t + 1 + 0.5 * rnd();
    state.nOut = (state.nOut || 0) + 1;
    state.outN = state.t - (state.outAt ?? -99) < 15 ? (state.outN || 0) + 1 : 1;
    state.outAt = state.t;
    if (state.outN >= 3) state.giveUp = true;
  }
  return null;
}

/** One step of the highway driver: the road, the line, the speed, then the controls. */
function driveStep(wvr: Wvr, car: AiCar, dt: number, ctx: DriveCtx): DriveInput {
  const { level, state, rnd } = wvr;
  if (!level._hw) return IDLE;
  const frame = car._hwf;
  if (!frame) return IDLE;
  const speed = Math.hypot(car.vx, car.vy);
  const { s0, s1 } = roadSpan(level);
  // past the road that exists (only once a race has ended)
  if (frame.s > s1 - 40 || frame.s < s0 + 20) return IDLE;
  state.t += dt;
  // DRIVE ITSELF OUT (shared with the circuit driver: driveOut) - the highway had none before AI
  // ROUND 2
  {
    const outCtl = driveOut(state, car, speed, dt, ctx, rnd, () => roadPose(level, frame.s, 0).h);
    if (outCtl) return outCtl;
  }
  const step = makeStep(wvr, car, dt, ctx, frame, speed);
  const vCorner = cornerSpeed(wvr, step);
  chooseLine(wvr, step);
  wanderStep(wvr, step);
  const here = aimTarget(wvr, step);
  const plan = followStep(wvr, step, here, vCorner);
  limitStep(step, plan);
  const { steer, yawRoad } = steerCmd(wvr, step);
  return pedalCmd(wvr, step, plan, steer, yawRoad);
}

/** The highway driver: one context for the step functions; drive, traits, state, relocate. */
export function roadDriver(level: HighwayLevel, traits: Traits, rnd: () => number) {
  const state: WeaverState = {
    line: null, tgt: null, think: 0, ph: (traits.seed || 1) % 100, t: 0,
  };
  const pace01 = Math.max(0, Math.min(1, (traits.pace - 0.8) / 0.185));
  // CORNER GRIP: a share of tarmac mu x the car's mu (the bench driver's 0.40; 0.38 Mobile .. 0.50
  // Real). MEASURED (hwracecheck): 0.6 x gripG planned 0.8 g at 230 km/h on an R 500 and the field
  // ran wide - the car's real grip at that speed is lower RACING, NOT A SUNDAY DRIVE (user,
  // 2026-10-06: "they seem slow ... make them faster and just try n handle it"; MEASURED pacesuite,
  // 18 races, vs the mirror-only build: mean 133.4 -> 138.2 km/h, under-130 40 -> 35 %, bad races 2
  // -> 1; weavecheck 0 spins, 1-2 of 45 close passes clip at 150 km/h): throttle floor 0.85 (was
  // 0.6), corner share 0.42-0.54 (was 0.33-0.42), follow decel 0.55 g share, turn feathering only
  // for yaw BEYOND the road's own bend, lane-changing traffic blocks the lane it is going to, verge
  // dodges
  const thrMax = (HWT.thr ?? 0.85) + (1 - (HWT.thr ?? 0.85)) * pace01,
    cornerK = (HWT.kC ?? 0.42) + (HWT.kCp ?? 0.12) * (traits.prec ?? 0.5),
    brakeK = (HWT.kB ?? 0.45) + 0.15 * (traits.prec ?? 0.5);
  // sloppier drivers leave more room
  const agg = traits.aggression ?? 0.5,
    margin = MARGIN + 0.25 * (1 - (traits.prec ?? 0.5));
  const wvr: Wvr = { level, traits, rnd, state, thrMax, cornerK, brakeK, agg, margin };
  function drive(car: AiCar, dt = 1 / 120, ctx: DriveCtx = {}): DriveInput {
    return driveStep(wvr, car, dt, ctx);
  }
  return {
    drive,
    traits,
    state,
    relocate: () => {
      state.line = null;
      state.base = null;
      state.tgt = null;
      state.tv = 0;
      state.revUntil = 0;
      state.slowT = 0;
      state.outN = 0;
      state.giveUp = false;
    },
  };
}

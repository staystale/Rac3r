// ai/driverPedals.ts: the circuit driver's steering, slide, throttle, brake and handbrake
// controls. Functions take the driver context.
import { profileOf } from "./line.ts";
import { steerAim, profileSpeed } from "./driverSteps.ts";
import type { AiCar } from "./types.ts";
import type { RejoinAim } from "./rejoin.ts";
import { footThrottle } from "./driverFoot.ts";
import { spinSteer } from "./driverSlide.ts";
import type { Drv, AiPath } from "./driverCtx.ts";
import { FIX } from "../core/fixes.ts";

// throttle kept through a front slide on loose ground (off road, dirt, gravel)
const UNDER_LOOSE = 0.35;
const DRIFT_BAN = 60;
// ?driftbrake=1: m/s over its speed plan past which a drifting car brakes, the drift not held
// (MEASURED, tools/scratch/_pbzoff.mjs: Pembreezy RX's drift held its throttle and no brake from
// 20-27 km/h over the plan into the corner after the gravel hairpin, and ran 5-20 m wide)
const DRIFT_OVER_MS = 1.5;
// m/s under which the rear-slip FEEL is not read (a slip ANGLE at a crawl is noise: it
// shut the throttle at 0.7 m/s on ice, MEASURED); over / under already wait for 5 m/s
const FEEL_FROM = 4;

/** Steering aim, then slip, the held drift, over / understeer and the steer. */
export function steerSlideStep(drv: Drv, car: AiCar, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, lineOff: number, latT: number,
    crossMax = Infinity) {
  const { slideStep } = drv;
  // ---- steering: Stanley on the path + latT at the front axle (the bench driver's controller)
  const { psi, deltaS, LOCK, cap } = steerAim(car, path, nearIdx, idx, speed, latT, crossMax);
  // OVERSTEER (rear slip past ~10 deg): no cap, so it can countersteer; UNDERSTEER (front past ~8
  // deg): more lock only scrubs, so lift and brake to get the front back (MEASURED: Sweaty Lamb's
  // S at sF 0.27 rad, then a spin at sR -0.78) LOOSE SURFACES (requirement: slow down weirdly on
  // surface changes, dirt to tarmac — they should predict it and speed up). loose = 0 on tarmac (mu
  // 1).. 1 at mu 0.5. MEASURED (tools/aisurface, rally-4x4 Real): 19 of 26 Slidden
  // surface changes lifted > 0.3 s with the target still above the speed — mostly WHEELSPIN
  // halving the throttle (normal on dirt), then the front-slip "understeer" lift. On loose
  // ground: no wheelspin cut, and 0.06 rad more front slip before the understeer lift -> 10 of
  // 26; laps (Real) Knobhill 47.6 -> 45.8 hatch / 41.5 -> 40.5 4x4, Sweaty Lamb 128.5 -> 125.2 /
  // 114.4 -> 112.7, Slidden 55.9 -> 55.1, tarmac unchanged. TRIED and REJECTED (same tool): more
  // rear slip before lifting, a later slide catch and power through the slide — each alone
  // harmless, together the 4x4 left the road at Knobhill / Sweaty Lamb (16-31 s off a lap).
  const slide = slideStep(car, path, nearIdx, speed, lineOff, { deltaS, LOCK, cap });
  // (a mistake that spins holds the wheel turned in - ai/driverSlide.ts)
  const spin = spinSteer(drv.state);
  return { psi, ...slide, steer: spin ?? slide.steer };
}
type Slide = ReturnType<typeof steerSlideStep>;

/** Throttle for the target speed: held drift, loose understeer, over / understeer, grip. */
export function throttleFor(drv: Drv, speed: number, targetSpeed: number, slide: Slide,
    looseUnder: boolean, drifting = slide.drifting) {
  const { slipRear, under, over, hold, feelK } = slide;
  // (the slip feel's angles x the ground's peak over tarmac's: ai/driverSlide.ts, 1 without it)
  const feel = speed < FEEL_FROM ? 1
    : Math.max(0, 1 - Math.max(0, slipRear - 0.07 * feelK) / (0.12 * feelK));
  const gap = (targetSpeed - speed) * 0.6;
  return drifting ? Math.max(0.25, Math.min(1, 0.6 + (hold - slipRear) * 3)) * (
      speed < targetSpeed * 1.1 ? 1 : 0.4) : looseUnder ? Math.min(
      UNDER_LOOSE, speed < targetSpeed ? gap : 0) : under ? 0 : over ? (
      speed < targetSpeed ? Math.min(0.2, gap) : 0) :
      speed < targetSpeed ? Math.min(1, gap) * feel : 0;
}

// ?aitune: m/s2 the plan must fall at (smoothed) to be a braking zone, the smoothing's share a
// step (~0.1 s at 120 steps a second: the plan falls in steps, one a path point), and the brake's
// dead band outside a zone (m/s over the plan)
const ZONE_DECEL = 2, ZONE_SMOOTH = 0.08, BRAKE_BAND = 0.3;
// ?aitune: the trim on the speed over the plan in a zone, pedal per m/s (1.5 swung the pedal
// 0 .. 0.8 on the plan's steps, one a path point; 0.7 held it 0.3 .. 0.5 - Thruston's 1600 m)
const ZONE_TRIM = 0.7;

/**
 * ?aitune, each step: the plan's fall (m/s2, smoothed over the path points' steps) and the brake
 * pedal that alone would hold it - the plan's deceleration over the car's full-pedal deceleration
 * (physics/loads.ts: brakeMaxDecel x g x the brakes' torque).
 * @param drv the driver (state)
 * @param car the car
 * @param dt the step, s
 */
function zoneStep(drv: Drv, car: AiCar, dt: number) {
  const { state } = drv;
  const fall = Math.max(0, ((state.vTPrev ?? state.vT) - state.vT) / dt);
  state.zoneDecel = (state.zoneDecel ?? 0) + (Math.min(fall, 30) - (state.zoneDecel ?? 0))
    * ZONE_SMOOTH;
  const spec = car.spec as { brakeMaxDecel?: number };
  const torque = (car as { mods?: { brakeTorque?: number } }).mods?.brakeTorque ?? 1;
  const fullDecel = (spec.brakeMaxDecel ?? 1.8) * 9.81 * torque;
  state.zoneFF = state.zoneDecel > ZONE_DECEL ? Math.min(1, state.zoneDecel / fullDecel) : 0;
  state.fullDecel = fullDecel;
}

/**
 * The brake for the target speed. ?aitune: in a braking zone (zoneFF) the pedal that holds the
 * plan's fall, and following a car (forCar) the pedal that copies its braking as I read it
 * (owner 11-21: "copying the leader is the idea") - each plus a trim on the speed over the target,
 * no dead band, no on / off; CAR_FULL m/s over a car's cap still brakes as before (closing too
 * fast). Else a share of the speed over the plan past a dead band.
 * @param drv the driver (state.zoneFF, followDec, fullDecel)
 * @param speed m/s
 * @param targetSpeed m/s
 * @param forCar a car ahead sets the target
 * @returns the pedal, 0..1 (before the turn's share)
 */
function brakeFor(drv: Drv, speed: number, targetSpeed: number, forCar: boolean): number {
  const { state } = drv;
  const tuned = FIX.aitune && !(forCar && speed > targetSpeed + CAR_FULL);
  const copy = forCar ? (state.followDec ?? 0) / (state.fullDecel || 17.7) : 0;
  const feed = tuned ? Math.max(state.zoneFF ?? 0, copy) : 0;
  if (feed > 0 || (tuned && forCar)) {
    return Math.max(0, Math.min(1, feed + (speed - targetSpeed) * ZONE_TRIM));
  }
  return speed > targetSpeed + BRAKE_BAND ? Math.min(1, (speed - targetSpeed) * 1.5) : 0;
}

/** Throttle and brake for the target speed. */
// m/s over the speed it wants, a car the reason, from which an AI brakes fully even turning
const CAR_FULL = 2;

export function pedals(drv: Drv, speed: number, targetSpeed: number, thrForce: boolean,
    slide: Slide,
    looseUnder: boolean, forCar = false) {
  const { under, over, steer } = slide;
  // (?driftbrake=1: a drift over the plan is not held - it brakes as any car too fast)
  const drifting = slide.drifting && !(FIX.driftbrake && speed > targetSpeed + DRIFT_OVER_MS);
  let throttle = throttleFor(drv, speed, targetSpeed, slide, looseUnder, drifting);
  if (thrForce && speed < targetSpeed * 1.1) throttle = 1;
  // (turning, a share off the brake - not with a car the reason, CAR_FULL m/s too fast:
  // MEASURED, _ploughtrace.mjs, into Spa's La Source cars 20-30 km/h over the speed they wanted
  // braked 30-47 % and ran into the car ahead)
  const turnShare = forCar && speed > targetSpeed + CAR_FULL ? 1
    : Math.max(0.6, 1 - Math.abs(steer) / 0.5);
  // (?aitune: in a braking zone the pedal holds the plan's fall - the dead band's on / off read
  // as dabbing, owner 11-21)
  let brake = brakeFor(drv, speed, targetSpeed, forCar) * turnShare;
  if (under && !looseUnder && speed > 0.85 * targetSpeed) brake = Math.max(brake, 0.35);
  if (over || drifting) brake = 0;
  return { throttle, brake };
}

/** SPEED, throttle, brake and the handbrake turn: the controls the driver returns. */
export function pedalStep(drv: Drv, car: AiCar, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, dt: number, prof: ReturnType<typeof profileOf>,
    latT: number, lineOff: number, scale: { push: number, vMul: number, jCap: number,
    followCap: number, thrForce: boolean, aim?: RejoinAim | null }, slide: Slide) {
  const { traits, main, state, handbrakeStep } = drv;
  const pts = path.pts;
  const { push, vMul, jCap, followCap, thrForce } = scale;
  const { psi, loose, drifting, edgeRoom, under, steer } = slide;
  // ---- SPEED: the profile (it already brakes for what is ahead) x pace x mistakes, capped by
  // the joker approach and traffic
  let targetSpeed = profileSpeed(main, car, path, nearIdx, idx, speed, prof, latT, lineOff,
    scale.aim);
  targetSpeed = Math.min(targetSpeed * traits.pace * push * vMul, jCap, followCap);
  state.vTPrev = state.vT;
  state.vT = targetSpeed;
  if (FIX.aitune) zoneStep(drv, car, dt);
  // (read only, the held traces: a car's cap is the speed I am held to, not one above my plan)
  state.capBinds = followCap <= targetSpeed + 0.01;
  // OFF ROAD / LOOSE (requirement: they still slow down like mad off road / changing surfaces): on
  // loose ground a sliding front is the surface, not a mistake — keep driving (UNDER_LOOSE
  // throttle) and never brake for it. MEASURED before (aifieldcheck SURF, Brands +
  // Castle Kum, 6 cars): on grass / dirt the AI braked 26-36 % and lifted 13-33 % of the time,
  // front slip > 0.14 for 19-40 %. ...only OFF THE PLANNED SURFACE (the car on clearly worse
  // ground than its racing line: off the road, onto a loose patch). On a loose line (Sweaty
  // Lamb's gravel) the old lift + brake stays: applied there too, the 4x4 at Real left the stage
  // 16 s a lap (MEASURED).
  const offPlan = path === main && car.surface.mu < 0.85 * (pts[nearIdx].mu || 1);
  const looseUnder = under && loose > 0.3 && offPlan;
  if (drifting) { state.driftT = (state.driftT || 0) + dt; state.lastDrift = state.t; }
  // a drift that ran it OFF the road: it backs off drifting for DRIFT_BAN s (a driver who scares
  // himself)
  // off within 2 s of a drift
  if (edgeRoom < -0.5 && state.t - (state.lastDrift ?? -99) < 2) {
    state.driftOn = false;
    state.driftBan = state.t + DRIFT_BAN;
  }
  let { throttle, brake } = pedals(drv, speed, targetSpeed, thrForce, slide, looseUnder,
    followCap <= targetSpeed + 0.01);
  // the foot feathers the wheelspin (by skill; held near the peak on grippy ground)
  throttle = footThrottle(drv, car, speed, throttle, dt, drifting || thrForce);
  // HANDBRAKE TURNS (requirement: they should also use handbrake and drift and stuff): into a
  // HAIRPIN (apex R < HB_R) before the apex, a big turn still ahead (> HB_TURN rad) and
  // moving -> one pull of HB_T s per hairpin, off the throttle, full lock that way: the rear
  // steps out and the car pivots. The better driver times it (skill), a weaker one sometimes
  // doesn't bother.
  const handbrake = handbrakeStep(path, nearIdx, speed, loose);
  if (handbrake) {
    throttle = 0;
    brake = 0;
  }
  return {
    steer: handbrake ? Math.sign(steer || psi) * Math.max(Math.abs(steer), 0.9) : steer,
        throttle, brake, handbrake
  };
}

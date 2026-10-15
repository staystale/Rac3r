// ai/driverPedals.ts: the circuit driver's steering, slide, throttle, brake and handbrake
// controls. Functions take the driver context.
import { profileOf } from "./line.ts";
import { steerAim, profileSpeed, DRIFT_SLIP } from "./driverSteps.ts";
import type { AiCar } from "./types.ts";
import type { Drv, AiPath } from "./driverCtx.ts";

// throttle kept through a front slide on loose ground (off road, dirt, gravel)
const UNDER_LOOSE = 0.35;
const DRIFT_BAN = 60;

/** Steering aim, then slip, the held drift, over / understeer and the steer. */
export function steerSlideStep(drv: Drv, car: AiCar, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, lineOff: number, latT: number) {
  const { slideStep } = drv;
  // ---- steering: Stanley on the path + latT at the front axle (the bench driver's controller)
  const { psi, deltaS, LOCK, cap } = steerAim(car, path, nearIdx, idx, speed, latT);
  // OVERSTEER (rear slip past ~10 deg): no cap, so it can countersteer; UNDERSTEER (front past ~8
  // deg): more lock only scrubs, so lift and brake to get the front back (MEASURED: Sweaty Lamb's
  // S at sF 0.27 rad, then a spin at sR -0.78) LOOSE SURFACES (user: "slow down
  // weirdly on surface changes, dirt to tarmac — they should predict it and speed up"). loose = 0
  // on tarmac (mu 1) .. 1 at mu 0.5. MEASURED (tools/aisurface, rally-4x4 Real): 19 of 26 Slidden
  // surface changes lifted > 0.3 s with the target still above the speed — mostly WHEELSPIN
  // halving the throttle (normal on dirt), then the front-slip "understeer" lift. On loose
  // ground: no wheelspin cut, and 0.06 rad more front slip before the understeer lift -> 10 of
  // 26; laps (Real) Knobhill 47.6 -> 45.8 hatch / 41.5 -> 40.5 4x4, Sweaty Lamb 128.5 -> 125.2 /
  // 114.4 -> 112.7, Slidden 55.9 -> 55.1, tarmac unchanged. TRIED and REJECTED (same tool): more
  // rear slip before lifting, a later slide catch and power through the slide — each alone
  // harmless, together the 4x4 left the road at Knobhill / Sweaty Lamb (16-31 s off a lap).
  const slide = slideStep(car, path, nearIdx, speed, lineOff, { deltaS, LOCK, cap });
  return { psi, ...slide };
}
type Slide = ReturnType<typeof steerSlideStep>;

/** Throttle for the target speed: held drift, loose understeer, over / understeer, grip. */
export function throttleFor(drv: Drv, speed: number, targetSpeed: number, slide: Slide,
    looseUnder: boolean) {
  const { drifting, slipRear, under, over } = slide;
  const feel = Math.max(0, 1 - Math.max(0, slipRear - 0.07) / 0.12);
  const gap = (targetSpeed - speed) * 0.6;
  return drifting ? Math.max(0.25, Math.min(1, 0.6 + (DRIFT_SLIP - slipRear) * 3)) * (
      speed < targetSpeed * 1.1 ? 1 : 0.4) : looseUnder ? Math.min(
      UNDER_LOOSE, speed < targetSpeed ? gap : 0) : under ? 0 : over ? (
      speed < targetSpeed ? Math.min(0.2, gap) : 0) :
      speed < targetSpeed ? Math.min(1, gap) * feel : 0;
}

/** Throttle and brake for the target speed. */
export function pedals(drv: Drv, speed: number, targetSpeed: number, thrForce: boolean,
    slide: Slide,
    looseUnder: boolean) {
  const { drifting, under, over, steer } = slide;
  let throttle = throttleFor(drv, speed, targetSpeed, slide, looseUnder);
  if (thrForce && speed < targetSpeed * 1.1) throttle = 1;
  let brake = speed > targetSpeed + 0.3 ? Math.min(1, (speed - targetSpeed) * 1.5) * Math.max(
      0.6, 1 - Math.abs(steer) / 0.5) : 0;
  if (under && !looseUnder && speed > 0.85 * targetSpeed) brake = Math.max(brake, 0.35);
  if (over || drifting) brake = 0;
  return { throttle, brake };
}

/** SPEED, throttle, brake and the handbrake turn: the controls the driver returns. */
export function pedalStep(drv: Drv, car: AiCar, path: AiPath, nearIdx: number,
    idx: (pos: number) => number, speed: number, dt: number, prof: ReturnType<typeof profileOf>,
    latT: number, lineOff: number, scale: { push: number, vMul: number, jCap: number,
    followCap: number, thrForce: boolean }, slide: Slide) {
  const { traits, main, state, handbrakeStep } = drv;
  const pts = path.pts;
  const { push, vMul, jCap, followCap, thrForce } = scale;
  const { psi, loose, drifting, edgeRoom, under, steer } = slide;
  // ---- SPEED: the profile (it already brakes for what is ahead) x pace x mistakes, capped by
  // the joker approach and traffic
  let targetSpeed = profileSpeed(main, car, path, nearIdx, idx, speed, prof, latT, lineOff);
  targetSpeed = Math.min(targetSpeed * traits.pace * push * vMul, jCap, followCap);
  state.vT = targetSpeed;
  // OFF ROAD / LOOSE (user: "they still slow down like mad off road / changing
  // surfaces"): on loose ground a sliding front is the surface, not a mistake — keep driving
  // (UNDER_LOOSE throttle) and never brake for it. MEASURED before (aifieldcheck SURF, Brands +
  // Castle Cum, 6 cars): on grass / dirt the AI braked 26-36 % and lifted 13-33 % of the time,
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
  let { throttle, brake } = pedals(drv, speed, targetSpeed, thrForce, slide, looseUnder);
  // HANDBRAKE TURNS (user: "they should also use handbrake and drift and stuff"):
  // into a HAIRPIN (apex R < HB_R) before the apex, a big turn still ahead (> HB_TURN rad) and
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

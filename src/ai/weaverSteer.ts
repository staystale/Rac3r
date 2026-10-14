// ai/weaverSteer.ts: the highway driver's steering: the Stanley controller of autodrive.ts on
// the lateral target, with yaw damping and counter-steer.
import { GRAVITY } from "./weaverCtx.ts";
import type { Step, Wvr } from "./weaverCtx.ts";
import { roadPose } from "../highway.js";

/** The steering command (and the road's own yaw rate, which the throttle reads). */
export function steerCmd(wvr: Wvr, step: Step) {
  const { level, state } = wvr;
  const { car, frame, pts, speed, vAl, grip, idx0, vLo, vHi } = step;
  const offT = Math.max(vLo, Math.min(vHi, state.tgt!));
  // ---- STEER: the STANLEY controller of autodrive.js on the target line: heading error to the
  // road a little ahead + the front axle's cross-track error + yaw damping. MEASURED
  // (hwracecheck, v1): pure pursuit weaved +-1 m and ran 7 m wide out of an R 500. (the front
  // axle's road frame from the car's own frame + its heading: a SECOND roadFrame search per step
  // snapped to the wrong road point and read the car 2 m off where it was - MEASURED weavecheck:
  // the car drifted onto a car it had chosen to pass)
  const hRoad = roadPose(level, frame.s, 0).h, rel = car.heading - hRoad,
    axle = {
      s: frame.s + Math.cos(rel) * car.spec.lf,
      off: frame.off + Math.sin(rel) * car.spec.lf,
    };
  const aheadPose = roadPose(level, axle.s + 2 + speed * 0.15, offT);
  // + the swerve's own sideways speed as a FEED-FORWARD heading (without it the car lagged the
  // moving target, then overshot: spins) (an extra AIM term at the line ahead was tried: MEASURED
  // weavecheck, spins in 17 of 45 scenarios - Stanley's own gain stays) COURSE, not heading
  // (MEASURED weavecheck: in a bend the car's sideslip, ~1 deg at 180 km/h, left a steady 0.5 m
  // drift off the line that Stanley's heading term never saw - and it drifted into the car it was
  // passing): the angle the car is actually TRAVELLING at
  const course = speed > 3 ? Math.atan2(car.vy, car.vx) : car.heading;
  let psi = aheadPose.h + Math.atan2(state.tv || 0, speed + 1) - course;
  psi = Math.atan2(Math.sin(psi), Math.cos(psi));
  const cross = axle.off - offT, LOCK = car.spec.steerMax || 0.56;
  // the HEADING to the road is capped by speed (a swerve at 240 km/h is a few degrees, not 18),
  // and the car's own sideways speed across
  // the road is damped toward the target's (MEASURED weavecheck: lateral momentum carried it 30
  // m into the grass)
  const relH = Math.atan2(Math.sin(car.heading - hRoad), Math.cos(car.heading - hRoad)),
    hMax = Math.max(0.05, Math.min(0.35, 4 / Math.max(1, speed)));
  // YAW DAMPING on the ACTUAL yaw rate vs the road's (MEASURED weavecheck, Real: at 200 km/h the
  // car rotated 0.4 rad/s through the line while Stanley's psi still pointed across - yaw kept
  // building into a 35 deg slide). The car should turn with the road plus what the swerve needs;
  // anything beyond that is countered.
  const latVel = vAl * Math.sin(relH), latErr = latVel - (state.tv || 0),
    yawRoad = vAl * (pts[Math.max(0, Math.min(pts.length - 1, idx0))].curv || 0);
  let deltaS = psi + Math.atan2(-1.2 * cross, speed + 2)
    - 0.03 * (car.yawRate - speed * Math.tan(car.delta) / car.spec.L)
    - 0.02 * latErr - 0.12 * (car.yawRate - yawRoad);
  if (relH > hMax) deltaS = Math.min(deltaS, -(relH - hMax) * 2);
  else if (relH < -hMax) deltaS = Math.max(deltaS, (-hMax - relH) * 2);
  // COUNTER-STEER a sliding rear: the slip angle itself, as a driver catches it (and hold off
  // the brakes, below)
  const slipRear = (car.t && car.t.slipR) || 0;
  if (Math.abs(slipRear) > 0.08) deltaS -= slipRear * 0.9;
  const cap = Math.min(1,
    (1.6 * car.spec.L * grip * GRAVITY / Math.max(4, speed * speed)) / LOCK + 0.02);
  const steer = Math.max(-cap, Math.min(cap, deltaS / LOCK));
  return { steer, yawRoad };
}

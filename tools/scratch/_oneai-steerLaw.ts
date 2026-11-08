// ai/steerLaw.ts - ONE STEERING LAW for every AI driver (the AI rework R8 stage 2, one AI; owner
// 11-04 "just do it all and let me test at the end"). The highway driver's Stanley controller,
// lifted out whole (ai/weaverSteer.ts, every term MEASURED there with weavecheck / hwracecheck at
// up to 240 km/h): the heading to the line a little ahead (by the car's COURSE - its sideslip left
// a steady drift - with the swerve's own sideways speed fed forward), the front axle's cross-track
// error, damping of the steering's own yaw, of the sideways speed against the target's and of yaw
// beyond the road's own bend, a cap on the heading to the road that tightens with speed, and a
// counter-steer for a sliding rear. ?oneai: the circuit driver steers by it too (driverSteps.ts).
// The caller works out the geometry; this is the law.
import { FIX } from '../core/fixes.ts';

// THE AIM: the heading error is measured from the car's COURSE (the way it is travelling), for
// every driver - its sideslip otherwise leaves a steady drift off the line (the highway's own
// finding). MEASURED 11-04: a heading aim at circuit speeds, course at highway speeds made
// highway races 3x the racer contact (99 -> 305); the course everywhere keeps the highway as it was
// (131.2 km/h, contact 96) for 0.1-0.4 s a lap on tarmac circuits, rallycross the same.
/**
 * The direction a driver aims from (one rule for every driver): its course.
 * @param heading the car's heading, rad
 * @param vx m/s
 * @param vy m/s
 * @returns rad
 */
export function aimFrom(heading: number, vx: number, vy: number): number {
  return Math.hypot(vx, vy) > 3 ? Math.atan2(vy, vx) : heading;
}

// ?oneai: rad of rear slip past which the law counter-steers, the slip BEYOND it (a circuit car at
// its cornering limit runs ~0.1 rad - the highway's 0.08 onset cost 0.5 s a lap at Brands)
const CS_FROM = 0.12;

/** What the law reads: all angles in rad, lateral in m, speeds in m/s. */
export interface SteerIn {
  psi: number;       // the heading error to the line ahead (feed-forward added)
  cross: number;     // the front axle's cross-track error to the target, m
  speed: number;     // m/s
  yawRate: number;   // the car's yaw rate, rad/s
  delta: number;     // the front wheels' angle now, rad
  wheelbase: number; // m
  latErr: number;    // the car's sideways speed across the road minus the target's, m/s
  yawRoad: number;   // the road's own yaw rate at this speed, rad/s
  relH: number;      // the car's heading to the road, rad
  slipRear: number;  // the rear slip angle, rad
}

/**
 * The steering demand, rad at the wheels (the caller caps and scales it to the lock).
 * @param input the geometry (SteerIn)
 * @returns rad
 */
export function steerDemand(input: SteerIn): number {
  const { psi, cross, speed, yawRate, delta, wheelbase, latErr, yawRoad, relH } = input;
  let deltaS = psi + Math.atan2(-1.2 * cross, speed + 2)
    - 0.03 * (yawRate - speed * Math.tan(delta) / wheelbase)
    - 0.02 * latErr - 0.12 * (yawRate - yawRoad);
  // the HEADING to the road capped by speed (a swerve at 240 km/h is a few degrees, not 18)
  const hMax = Math.max(0.05, Math.min(0.35, 4 / Math.max(1, speed)));
  if (relH > hMax) deltaS = Math.min(deltaS, -(relH - hMax) * 2);
  else if (relH < -hMax) deltaS = Math.max(deltaS, (-hMax - relH) * 2);
  // COUNTER-STEER a sliding rear (the highway's own, past 0.08 rad) - ?oneai: none. MEASURED 11-04:
  // 0.08 rad is a racing car at the cornering limit on a circuit (it cost 0.5 s a lap at Brands);
  // without it the highway weave scenarios stay clean (45 of 45) - the other terms hold the slide
  if (!FIX.oneai && Math.abs(input.slipRear) > 0.08) deltaS -= input.slipRear * 0.9;
  const over = Math.abs(input.slipRear) - CS_FROM;
  if (FIX.oneai && over > 0) deltaS -= Math.sign(input.slipRear) * over * 0.9;
  return deltaS;
}

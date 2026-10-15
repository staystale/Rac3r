// Loads: weight transfer, axle vertical forces and the longitudinal demand of step.

import type { Spec } from '../cars.ts';
import { TUNE, VERT_G, AIR_DENSITY, TCS_SPIN, clamp, torqueAt, ENGINE_BRAKE } from '../vehicle.ts';
import type { Car } from '../vehicle.ts';
import { CLUTCH_RELEASE, CLUTCH_TAKEUP } from './powertrain.ts';
import { LOAD_MAX } from './tyres.ts';

/**
 * Section 4 of step: longitudinal weight transfer, the per-axle suspension springs riding the
 * ground profile, and aero downforce. Returns the load factor and vertical force of each axle.
 */
export function computeAxleLoads(car: Car, carSpec: Spec, mass: number, gravity: number,
    vLong: number, vLat: number, dt: number) {
  // ---- 4. vertical loads with one step of longitudinal transfer lag (stable; implicit is not
  // worth it) Longitudinal weight transfer, THROUGH THE SUSPENSION. Braking loads the front axle,
  // which raises its peak grip (D = mu*Fz in the tyre curve) and makes the car turn in better;
  // accelerating unloads it and makes it push wide. That was always in the model, but it was
  // INSTANT — the load appeared the same step the pedal moved. A real car takes ~0.2 s to roll onto
  // its springs, and that delay is what makes trail-braking a technique rather than a number.
  // First-order lag, stiffer suspension (a higher mods.rigidity) transfers faster: that is the seam
  // the suspension component will pull on later.
  const targetTransfer = (mass * car.aLongPrev * carSpec.cgH) / carSpec.L;
  car.transfer += (targetTransfer - car.transfer)
      * Math.min(1, dt / (TUNE.transferTau / car.mods.rigidity));
  // VERTICAL: ONE SUSPENSION DEGREE OF FREEDOM, riding a ground height profile.
  //
  // REWRITTEN. It used to be a scripted hop: the lab decided "you are now airborne for
  // 0.6 s" and the car played that out. The user was right that it read as an animation done TO the
  // car — "it should be a physics change to the state of the car that temporarily occurs rather
  // than like a jump that you make happen to it".
  //
  // So there is no jump, and nothing here knows what a kerb is. The lab supplies a ground height
  // under the car (car.ground, metres) and how fast it is changing (car.groundV). The body is a
  // mass on a spring/damper over that profile, and EVERYTHING else falls out of it:
  //   * a crest lifts the ground away faster than the body can follow -> load drops -> less grip,
  //     and the yaw damping and self-aligning torque that stabilise the car drop with it. It
  //     gets loose.
  //   * hit it fast enough and the spring reaches full extension: load clamps at 0, the body goes
  //     ballistic, and that is airtime — emergent, not scheduled.
  //   * coming down, the spring compresses past static: load OVERSHOOTS above 1 and it plants hard.
  //   * rumble ridges in the profile shake it through the damper term, which is why the shake
  //     scales with speed on its own and vanishes at a crawl.
  // None of it interrupts anything. You can be turning, braking, sideways on the handbrake, and
  // this is just a number multiplying your vertical load while it lasts. ONE SPRING PER AXLE, not
  // one for the whole car. This is the part that makes a kerb a DRIVING problem instead of a
  // bounce: the front wheels reach the bump ~2.6 m before the rear do, so the two axles are out of
  // phase and the car is unsettled ASYMMETRICALLY. Front light while the rear is still planted is
  // understeer arriving by itself; rear light while the front bites is the back stepping out.
  // Neither is scripted — it is just which end is in the air. Per-car (cars.js susF/susZ), and
  // mods.rigidity is the upgrade seam for stiffer springs — rule 6, so it defaults to 1.0 and an
  // un-upgraded car rides exactly as it did before the mod existed.
  const susW = 2 * Math.PI * carSpec.susF * car.mods.rigidity;
  const susK = susW * susW;
  const susC = 2 * carSpec.susZ * susW;
  const DROOP_MAX = 0.22; // m maximum wheel extension before tyre leaves ground
  const susp = (groundH: number, groundV: number, zKey: 'zF' | 'zR', vKey: 'zvF' | 'zvR') => {
    // If body height is above ground + droop, tyre is in free air: ballistic free-fall
    if (car[zKey] - DROOP_MAX > groundH) {
      car[vKey] += -gravity * VERT_G * dt;
      car[zKey] += car[vKey] * dt;
      return 0;
    }
    const rel = groundH - car[zKey];                           // + = spring compressed past static
    // m/s^2 of body accel from spring + damper
    const aSus = susK * rel + susC * (groundV - car[vKey]);
    let load = 1 + aSus / (gravity * VERT_G);
    // full droop: this end is off the ground
    if (load < 0) load = 0;
    // bump stop, so a big landing stays finite
    else if (load > LOAD_MAX) load = LOAD_MAX;
    // free flight is exactly the lk = 0 case
    car[vKey] += Math.max(aSus, -gravity * VERT_G) * dt;
    car[zKey] += car[vKey] * dt;
    // solid ground penetration limit
    if (car[zKey] < groundH - 0.12) car[zKey] = groundH - 0.12;
    return load;
  };
  const loadKF = susp(car.groundF, car.groundVF, 'zF', 'zvF');
  const loadKR = susp(car.groundR, car.groundVR, 'zR', 'zvR');
  car.loadK = (loadKF + loadKR) / 2;                    // what the HUD reads
  car.z = (car.zF + car.zR) / 2;                        // what the renderer lifts the car by
  car.air = loadKF <= 0 && loadKR <= 0 ? car.air + dt : 0;

  return axleVerticalForces(car, carSpec, mass, gravity, vLong, vLat, loadKF, loadKR);
}

/**
 * Aero part of the loads section: downforce scaling with v^2 added to the static axle loads, the
 * transfer and the suspension load factors. Returns the load factor and vertical force of each
 * axle.
 */
function axleVerticalForces(car: Car, carSpec: Spec, mass: number, gravity: number,
    vLong: number, vLat: number, loadKF: number, loadKR: number) {
  // Aerodynamic downforce scaling with v^2
  const vSqPlanar = vLong * vLong + vLat * vLat;
  const FdownF = 0.5 * AIR_DENSITY * (carSpec.downforceF || 0) * vSqPlanar * (TUNE.aeroMul || 1);
  const FdownR = 0.5 * AIR_DENSITY * (carSpec.downforceR || 0) * vSqPlanar * (TUNE.aeroMul || 1);

  const FzF = Math.max(0,
      (((mass * gravity * carSpec.lr) / carSpec.L - car.transfer + FdownF) * loadKF)
          * (car.bankLoadFactor || 1));
  const FzR = Math.max(0,
      (((mass * gravity * carSpec.lf) / carSpec.L + car.transfer + FdownR) * loadKR)
          * (car.bankLoadFactor || 1));
  return { loadKF, loadKR, FzF, FzR };
}

/**
 * Traction half of TCS: updates car.tcsK and returns the engine cut factor of both aid halves.
 */
function tractionCut(car: Car, vLongAbs: number, inReverse: boolean, dt: number) {
  // TCS, TRACTION HALF: when the driven wheels run more than TCS_SPIN m/s ahead of the
  // road, cut the engine — smoothly, a discontinuous force is a judder — and give it back as grip
  // returns. The stability half sets car.escCut (below, from the last step). Both only when the car
  // HAS TCS and it is switched on.
  if (car.tcsOn && !inReverse) {
    // allowed slip = 10% of road speed (min TCS_SPIN): real systems let ~10-15% slip through, it is
    // where traction peaks. MEASURED (user: "TCS too strong"): a flat 0.8 m/s cut in on plain
    // tarmac in most corner exits; gentler slope too.
    const spin = car.wheelSpin || 0, allow = Math.max(TCS_SPIN, 0.10 * vLongAbs);
    const target = spin > allow ? Math.max(0.15, 1 - (spin - allow) * 0.35) : 1;
    car.tcsK += (target - car.tcsK) * Math.min(1, 25 * dt);
  } else car.tcsK = 1;
  return car.tcsOn ? car.tcsK * car.escCut : 1;
}

/**
 * Section 5 of step: clutch ramp, traction-control cut, rev limiter, engine braking, drive force
 * and brake force per axle. Returns the demands the tyre blocks start from.
 */
export function computeLongitudinalDemand(car: Car, carSpec: Spec, mass: number, gravity: number,
    vLong: number, vLongAbs: number, dirSign: number, inReverse: boolean, throttle: number,
    brakeIn: number, totalRatio: number, dt: number) {
  // ---- 5. longitudinal demand per axle CLUTCH RAMP. MEASURED BUG, (user: "still
  // getting judder sometimes"): torque was zeroed during a shift and then restored in ONE step —
  // dumped on the track car, FxR jumping 0 -> 6480 N on the step the shift timer expired, which via
  // the friction ellipse instantly crushed rear lateral force 5842 -> 2232 N and kicked the yaw. A
  // real clutch takes ~0.1 s to take up. Same lesson as the yaw damping and the tyre laws: a
  // discontinuous force is always a judder. BOTH WAYS. The first cut ramped the clutch back IN but
  // still cut it to zero in one step at the START of a shift — dumped: FxR dropping 6212 -> 0 N on
  // the step the shift began, jerk 94. A clutch takes up and releases; neither edge may be a step.
  car.clutch = car.shiftTimer > 0
    ? Math.max(0, car.clutch - dt / CLUTCH_RELEASE)
    : Math.min(1, car.clutch + dt / CLUTCH_TAKEUP);
  const aidCut = tractionCut(car, vLongAbs, inReverse, dt);
  // REV LIMITER. MEASURED BUG (tools/carstats.mjs): there was none — the engine rpm
  // was CLAMPED at the redline but kept making torque, so in top gear a car accelerated until drag
  // alone stopped it: the Naffcar V8 reached 759 km/h, the hatch 271. Now the engine cuts as the
  // WHEEL-derived revs pass the redline, faded over 2% so the cut is not a force step (a
  // discontinuous force is a judder). revs from ROAD speed, not wheel speed: a first cut read the
  // spinning wheels and cut the engine on every launch (muscle 0-100 km/h 3.5 -> 7.8 s). Wheelspin
  // revs are handled by the clamp above; the limiter caps SPEED per gear.
  const rawRpm = ((Math.abs(vLong) / carSpec.wheelR) * totalRatio * 60) / (2 * Math.PI);
  const limiter = clamp((carSpec.redline * 1.02 - rawRpm) / (carSpec.redline * 0.02), 0, 1);
  let torque = torqueAt(carSpec, car.rpm) * car.mods.power * (car.wreck ? car.wreck.power : 1)
      * throttle * aidCut * car.clutch * limiter;
  // ENGINE BRAKING (step 2). MEASURED before: a lift-off at 100 km/h slowed a hatch at
  // 0.04 g (drag + rolling resistance only) and took 47 s to reach 50 km/h; a real car in gear
  // pulls ~0.1-0.15 g. Off the gas the engine drags in proportion to revs, through the DRIVEN
  // wheels (so a RWD lift still loads the rear, as in life), and only while the car rolls the way
  // its gear drives — never pushing a car that is rolling backwards.
  const gearDir = car.gear < 0 ? -1 : 1;
  if (throttle < 0.02 && vLong * gearDir > 0.5) {
    const revK = clamp((car.rpm - carSpec.idleRpm) / (carSpec.redline - carSpec.idleRpm), 0, 1);
    // a FORCE scaled by weight and revs, not by the engine's torque: MEASURED, torque-scaled
    // braking (0.25 x drive torque) gave the 3x-power muscle 0.51 g and the track car 0.45 g from a
    // mere lift — a brake, not a lift. CAPPED at half the driven wheels' grip. MEASURED BUG:
    // uncapped, a coast across ice (mu 0.12) slid the driven wheels and scrubbed the ice —
    // tools/wearcheck 3a "rolling over ice does NOT wear it" failed. In life the wheel slows, the
    // revs fall and the engine stops dragging long before the tyre lets go.
    const drivenShare = carSpec.drive * (carSpec.lr / carSpec.L) + (1 - carSpec.drive)
        * (carSpec.lf / carSpec.L);
    const ebMax = 0.5 * carSpec.mu * car.surface.mu * mass * gravity * drivenShare;
    const Feb = Math.min(ENGINE_BRAKE * mass * gravity * revK, ebMax) * car.clutch;
    torque = -Feb * carSpec.wheelR / Math.max(0.1, totalRatio * carSpec.driveEff);
  }
  let driveForce = (torque * totalRatio * carSpec.driveEff) / carSpec.wheelR;
  if (inReverse) driveForce = -driveForce;
  if (inReverse && -vLong > carSpec.reverseMaxSpeed) driveForce = 0;   // reverse speed cap

  // THE mechanism that makes drive layout real (PLAN.md): split by `drive`, then let each axle's
  // ellipse eat its own lateral budget. One force on the body instead => all five cars identical.
  const FxDriveF = driveForce * carSpec.drive;
  const FxDriveR = driveForce * (1 - carSpec.drive);

  // A7: brakes in newtons so the per-axle lock-up test is possible at all.
  const brakeForce = carSpec.brakeMaxDecel * mass * gravity * brakeIn * car.mods.brakeTorque;
  let FbF = brakeForce * carSpec.brakeBiasF;
  let FbR = brakeForce * (1 - carSpec.brakeBiasF);
  const brakeSign = -dirSign;                     // brakes oppose motion
  let FxBrakeF = vLongAbs < 0.05 ? 0 : FbF * brakeSign;
  let FxBrakeR = vLongAbs < 0.05 ? 0 : FbR * brakeSign;
  return { torque, driveForce, FxDriveF, FxDriveR, FbF, FbR, brakeSign, FxBrakeF, FxBrakeR };
}

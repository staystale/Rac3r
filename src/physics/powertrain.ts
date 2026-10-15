// Powertrain: steering, reverse engagement, shifting and engine rpm of step.

import type { Spec } from '../cars.ts';
import { clamp, STEER_MAX, STEER_RATE } from '../vehicle.ts';
import type { Car, CarInput } from '../vehicle.ts';

export const CLUTCH_RELEASE = 0.12;   // s to cut drive at the start of a shift

                               // the track car judder 33 -> 27; 0.20 only reached 25, so the clutch
                               // is no longer the dominant term. Total since the first report: 413
                               // -> 27.
// s for the clutch to take up after a shift — NEVER restore torque in one step
export const CLUTCH_TAKEUP = 0.11;

function ratio(carSpec: Spec, gear: number) {
  if (gear < 0) return carSpec.reverseRatio;
  // CLAMPED. An out-of-range gear returns undefined, which makes the total ratio NaN, which makes
  // every force NaN, which makes the car vanish — and it does so SILENTLY (rule 20). Found when a
  // harness set gear 5 on the four-speed muscle car. The auto box cannot do this, but nothing else
  // was stopping it.
  const index = Math.max(1, Math.min(carSpec.gears.length, gear | 0));
  return carSpec.gears[index - 1];
}

/**
 * Section 2 of step: turn the front wheels toward the steer input at the steering rate, and
 * return the effective wheel angle (damage toe included).
 */
export function steerFrontWheels(car: Car, carSpec: Spec, input: CarInput, dt: number) {
  // ---- 2. steering: front wheels turn and match player input directly regardless of speed or grip
  // per-car LOCK (spec.steerMax: the drift car's angle kit); every other car the shared STEER_MAX
  const deltaTarget = clamp(input.steer, -1, 1) * (carSpec.steerMax || STEER_MAX);
  const dDelta = clamp(deltaTarget - car.delta, -STEER_RATE * dt, STEER_RATE * dt);
  car.delta += dDelta;
  // DAMAGE (damage.js): a bent front corner toes the wheels — the car pulls (car.wreck: no-op when
  // undamaged)
  const delta = car.delta + (car.wreck ? car.wreck.toe : 0);
  return delta;
}

/**
 * Reverse part of the powertrain section: the R pedal selects and releases reverse gear (with the
 * gear lock that stops it hunting). Returns the R pedal, 0..1.
 */
function engageReverse(car: Car, input: CarInput, rawThrottle: number, vLong: number, dt: number) {
  if (car.gearLock > 0) car.gearLock = Math.max(0, car.gearLock - dt);
  const rawRev = clamp(+input.reverse! || 0, 0, 1);
  if (rawRev > 0.05 && car.gear > 0 && vLong < 1.0 && car.gearLock <= 0) {
    car.gear = -1;
    car.gearLock = 0.4;
  }
  if (car.gear < 0 && rawRev <= 0.05 && car.gearLock <= 0
      && (vLong > -1.0 || (rawThrottle > 0.05 && vLong > -0.5))) {
    car.gear = 1;
    car.gearLock = 0.4;
  }
  return rawRev;
}

/**
 * Powertrain section of step: pedal mapping, reverse engagement, wheelspin, rpm and gear shifts.
 * Returns the pedal and ratio values the rest of step reads.
 */
export function runPowertrain(car: Car, carSpec: Spec, input: CarInput, vLong: number, dt: number) {
  // ---- powertrain: reverse engagement (A5), shifting, rpm
  //
  // MEASURED BUG, (user: "braking still causes you to go backwards"). Holding the brake
  // at a standstill engages reverse, and in reverse the pedals SWAP — so the brake a player was
  // ALREADY holding became the accelerator and drove them backwards. Measured on every car: stops
  // at 2.6 s, reverse engages at 3.0 s, travelling backwards at 5.6 m/s, all from one continuous
  // brake press.
  //
  // Every bench I had written measured body slip only while speed > 3 m/s, so not one of them could
  // ever have seen it. The reports were right and the harnesses were blind.
  //
  // A press that began while MOVING can never arm reverse. You must come to a stop, release, and
  // press again — which is the deliberate "I want reverse" gesture, and is unambiguous.
  const handbrakeRaw = input.handbrake === true ? 1 : clamp(+input.handbrake || 0, 0, 1);
  const rawBrake = clamp(input.brake, 0, 1);
  const rawThrottle = clamp(input.throttle, 0, 1);
  if (rawBrake < 0.1) car.brakeArmed = true;
  // this press is a STOPPING press, not a reverse one
  else if (Math.abs(vLong) > 1.0) car.brakeArmed = false;

  // REVERSE IS A DELIBERATE SELECTION, NEVER A CONSEQUENCE OF BRAKING.
  //
  // It used to engage by holding the brake at a standstill (amendment A5), and in reverse the
  // pedals swap — so the brake became the accelerator. That produced the SAME user report three
  // separate times ("braking makes you go backwards"), in three different guises: from a continuous
  // press that stopped the car; from the gear hunting 1 -> -1 -> 1 with both pedals held; and
  // finally from a fresh brake press at a standstill, which was the feature working exactly as
  // specified. Caught in the end by fuzz-driving the real game (tools/_hunt.mjs) rather than by any
  // scenario I thought to write.
  //
  // A feature that keeps generating the same bug report is the wrong feature. Reverse now needs its
  // own input, so no amount of braking can ever select it. A5 is superseded.
  //
  // HOLD R TO REVERSE (user: the guide card said "Hold R to reverse" and the user ruled
  // "it should work how the card says and the game is wrong"). It WAS a toggle, and in reverse the
  // pedals swapped (BRAKE drove you backwards, GAS braked). Now R is its own pedal, 0..1, ramped
  // like GAS (input.js), and NO PEDAL EVER SWAPS:
  //   R held, rolling forward  -> R brakes, then reverse engages below 1 m/s and R drives you
//                               backwards
  //   R released               -> coast; back to a forward gear once nearly stopped
  //   GAS while rolling back   -> brakes, then forward drive below 1 m/s
  //   BRAKE                    -> always brakes. It can never select reverse, so the old bug
//                               cannot return.
  const rawRev = engageReverse(car, input, rawThrottle, vLong, dt);

  const inReverse = car.gear < 0;
  const throttle = inReverse ? rawRev : (rawRev > 0.05 ? 0 : rawThrottle);
  const brakeIn = inReverse ? Math.max(rawBrake, rawThrottle) : Math.max(rawBrake, rawRev);

  if (car.shiftTimer > 0) car.shiftTimer = Math.max(0, car.shiftTimer - dt);
  const gearRatio = ratio(carSpec, car.gear);
  const totalRatio = Math.abs(gearRatio) * carSpec.finalDrive;

  updateEngineRpm(car, carSpec, vLong, dt, inReverse, throttle, totalRatio);
  shiftGears(car, carSpec, input, inReverse);
  return { handbrakeRaw, inReverse, throttle, brakeIn, totalRatio };
}

/**
 * Engine part of the powertrain section: wheelspin of the driven wheels, the rpm target from wheel
 * speed with the clutch-slip launch, and the rpm chasing it.
 */
function updateEngineRpm(car: Car, carSpec: Spec, vLong: number, dt: number, inReverse: boolean,
    throttle: number, totalRatio: number) {
  // rpmTarget from wheel speed; chased at a rate set by drivetrain inertia. When tyres grip, wheels
  // roll with ground speed: wheelRps = |vLong| / wheelR. When driven tyres genuinely break traction
  // (wheelspin on slippery surfaces or burnout), the driven wheels spin faster than ground speed.
  // As soon as tyres grip up, wheelspin decays to zero.
  const tPrev = car.t;
  const isDrivenSpinning = carSpec.drive >= 0.99 ? tPrev.spinF : carSpec.drive <= 0.01 ? tPrev.spinR
      : (tPrev.spinF || tPrev.spinR);
  const drivenSlip = isDrivenSpinning ? Math.max(0, tPrev.slipSpeedDriven || 0) : 0;

  car.wheelSpin = (car.wheelSpin || 0) + (drivenSlip - (car.wheelSpin || 0)) * Math.min(1, 14 * dt);
  if (throttle < 0.02 || !isDrivenSpinning) car.wheelSpin *= Math.exp(-18 * dt);

  const wheelSpeed = Math.abs(vLong) + (car.wheelSpin || 0);
  const wheelRps = wheelSpeed / carSpec.wheelR;              // rad/s of the wheel
  let rpmTarget = clamp((wheelRps * totalRatio * 60) / (2 * Math.PI), carSpec.idleRpm,
      carSpec.redline);
  
  // TORQUE CONVERTER / CLUTCH SLIP LAUNCH MODEL If we just lock RPM to wheel speed, pulling away
  // from 0 mph means the engine is at 850 RPM (idle) producing very little power. We allow the
  // engine to slip the clutch and rev up to a "stall speed" (e.g. 3500-4500 RPM depending on
  // throttle) to build power for the launch, smoothly blending into a locked drivetrain as wheel
  // speed catches up.
  if (car.gear === 1 || inReverse) {
    // How hard they are pressing the gas dictates how high the engine revs against the slipping
    // clutch
    const launchRpm = carSpec.idleRpm + (carSpec.upshiftRpm * 0.55 - carSpec.idleRpm) * throttle;
    // If the wheels are moving slower than the engine, let the engine sit at the launch RPM
    rpmTarget = Math.max(rpmTarget, launchRpm);
  }

  const revRate = 12 / car.mods.inertia;
  car.rpm += (rpmTarget - car.rpm) * Math.min(1, revRate * dt);
}

/** The auto box's up or down shift off the rpm, held while drifting or while traction is broken. */
function autoShift(car: Car, carSpec: Spec, isDrifting: boolean, isTractionBroken: boolean) {
  if (!isDrifting && !isTractionBroken && car.rpm >= carSpec.upshiftRpm
      && car.gear < carSpec.gears.length) {
    car.gear++; car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
  } else if (car.rpm <= carSpec.downshiftRpm && car.gear > 1) {
    car.gear--; car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
  }
}

/** Gearbox part of the powertrain section: the auto box's up and down shifts, or the manual's. */
function shiftGears(car: Car, carSpec: Spec, input: CarInput, inReverse: boolean) {
  // auto box Hold gear during a drift or power-slide. Upshifting mid-drift cuts the clutch,
  // dropping drive torque to zero and bogging the car down. Holding the gear keeps continuous power
  // delivery throughout the slide.
  const isDrifting = Math.abs(car.t.vLat || 0) > 2.0 && Math.abs(car.t.slipR || 0) > 0.15;
  // Hold gear if we are actively spinning the wheels hard on loose surfaces or a launch (wheelSpin
  // > 2.5 m/s). Otherwise the RPM spike from wheelspin forces an upshift that kills the power.
  const isTractionBroken = (car.wheelSpin || 0) > 2.5;

  if (car.autoBox && car.shiftTimer <= 0 && !inReverse) {
    autoShift(car, carSpec, isDrifting, isTractionBroken);
  } else if (!car.autoBox && car.shiftTimer <= 0) {
    if (input.shiftUp && car.gear < carSpec.gears.length) {
      car.gear++;
      car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
    } else if (input.shiftDown && car.gear > 1) {
      car.gear--;
      car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
    }
  }
}

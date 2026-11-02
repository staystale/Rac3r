// physics/wheelspin.ts - WHEEL SPEED AS REAL STATE (the driving ROOT FIX; owner 11-02: "ok", then
// "pass"). Each axle has a wheel speed (car.wU, m/s at the tyre's surface) that the engine,
// the brakes and the tyre's own force turn. The tyre's longitudinal slip comes FROM it, so lock-ups
// and wheelspin are what the wheel does, not a guess from demand vs grip (tyres.ts slidingLaw:
// "we do not model wheel spin as a state"). MEASURED before (tools/scratch/_brakebase.mjs, 100
// km/h, tarmac): a locked stop was as short as an ABS stop (+-1 m), full pedal was the best pedal,
// and half lock under full ABS braking moved the car 0.7-1.2 m - no threshold braking, no steering.
//
// ONE COMBINED LAW per axle: the longitudinal slip (kappa) and the slip angle (alpha), each over
// its own peak, make one normalised slip n; the force is the lateral curve's shape at n
// (vehicle.ts curveFactor: rises to the peak at n = 1, falls to slideGrip past it), split between
// the two directions by their share of n. Pure cornering is exactly the old lateral curve; a
// locked wheel (kappa -1, n ~8) slides almost straight on and steers little; a wheel held near the
// peak (ABS) keeps a share for steering. Peaks on loose ground come later (the surface's peakK), as
// the lateral curve's do: on gravel the tyre digs a wedge into the loose layer, so the peak
// arrives at 15-25 deg of slip instead of the 7-8 of tarmac and the curve falls away far more
// gently past it - why a rally driver can hold a car sideways on gravel and steer it on the
// throttle, and why the same technique spins you on tarmac. Lowering mu alone would only make
// gravel feel like wet tarmac: slippery, not loose.
//
// BEFORE (tyres.ts until 11-02): two laws - a lagged friction circle while the drive / brake
// demand was under grip, a sliding law past it with the slip GUESSED from how far past - and an
// ABS that capped each axle's brake just under grip. Two attempts to smooth the hand-over were
// measured and reverted (ENGINE.md); this replaces both laws.
//
// ABS releases and re-applies each axle's brake as its wheel passes the peak slip (car.absP), so
// it PULSES: staggered marks, steering kept, a shorter stop than locked.
import type { Spec } from '../cars.ts';
import type { Car } from '../vehicle.ts';
import { TUNE, curveFactor, clamp } from '../vehicle.ts';
import {
  axleGrip, axleTyreGrip, relaxAxleForces, tyreGripOn, type AxleForce,
} from './tyres.ts';
import { axleFrictionWork } from './tyreheat.ts';
import { DIAL, LOCK_REAL } from '../realism.ts';
import { FIX } from '../core/fixes.ts';


// longitudinal slip at the peak on hard ground (real tyres 0.10-0.15); x the surface's peakK
const KAPPA_PEAK = 0.12;
// m/s: slip is measured against at least this speed (a stopped car's slip would divide by 0)
const SLIP_V_MIN = 3;
// kg: the equivalent mass of an axle's two wheels and tyres at the tread (I / R^2; ~0.7 x the
// wheel + tyre mass), for a 1300 kg car - scaled by the car's mass
const WHEEL_MASS = 25, WHEEL_MASS_REF = 1300;
// kg m^2: the engine's rotating inertia (flywheel, crank), reflected through the gearing while
// the clutch is in - in first gear it outweighs the wheels many times, as in life
const ENGINE_I = 0.12;
// substeps of the wheel per physics step (480 Hz): with the implicit slope below, stable at rest
const SUBSTEPS = 4;
// ABS, as the real units: past ABS_RELEASE x the peak slip the valve DUMPS the pressure (full to
// none in ABS_DUMP_S) and remembers the level that let go until the wheel is back under
// ABS_REAPPLY; then it snaps back to ABS_SNAP of that level (ABS_SNAP_S for full) and CREEPS up
// (ABS_CREEP_S for full) until the wheel lets go again - so it pulses round the peak, 9-18 a s
// (MEASURED, all cars). The REAR watches its tyres' WHOLE slip (braking and cornering, the
// combined law's n) and lets go at ABS_REAR of the peak: braking moves the weight forward
// (MEASURED, hatch at 1 g: rear 3.6 kN of 6.2), a rear braking at its peak has nothing left to
// hold the corner and the car slid round - real units hold the rear below the front for the same
// reason (EBD, cornering brake control).
const ABS_RELEASE = 1.1, ABS_REAPPLY = 0.7, ABS_REAR = 0.85;
const ABS_DUMP_S = 0.012, ABS_SNAP = 0.8, ABS_SNAP_S = 0.02, ABS_CREEP_S = 0.5;
// s for the remembered level to drift back to full while the wheel holds (a grippier patch)
const ABS_MEM_S = 1.5;
// a driven wheel counts as SPINNING past this x the peak slip (gearbox hold, TCS, the HUD)
const SPIN_AT = 1.5;
// x the peak slip where the patch starts to count as slipping (marks, squeal)
const MARK_FROM = 0.9;
// N per m/s between the axles' wheel speeds: an AWD car's centre coupling (viscous / limited
// slip, as the roster's fixed torque split assumes) hands drive from the faster axle to the
// slower. MEASURED without it (rally car on mud): the rear spun to the limiter at 82 km/h, the
// limiter cut the engine and the front got 750 N - 0-50 km/h 3.7 -> 7.0 s.
const AWD_COUPLE = 4000;

/** What one axle's step needs, fixed over its substeps. */
interface AxleIn {
  axle: 0 | 1;          // 0 front, 1 rear
  vx: number;           // the contact patch's speed along the wheel, m/s
  syl: number;          // ... and across it, m/s
  slip: number;         // the slip angle, rad
  load: number; FzNom: number; cornering: number; gripT: number;
  drive: number;        // N at the tread from the engine (engine braking negative)
  brake: number;        // N of foot brake at the tread (ABS scales it)
  hb: number;           // N of handbrake at the tread (ABS leaves it)
  mass: number;         // kg: the axle's equivalent mass at the tread
}

/** The axle's grip numbers for the law, fixed over its substeps. */
interface Law {
  vx: number; vRef: number; kPeak: number; ny: number;
  FxPk: number; FyPk: number; sgLat: number; sgLong: number;
}

// ?lockfade=1: rubber sliding on tarmac grips less the faster it slides (it skates on its own
// melt): a locked or spinning tyre's grip share falls by up to LOCK_FADE at LOCK_FADE_V of slide.
const LOCK_FADE = 0.25, LOCK_FADE_V = 25;
/**
 * The share of a sliding tyre's grip kept at a sliding speed (?lockfade).
 * @param slideV the tyre's sliding speed along the car, m/s (wheel minus ground)
 * @returns 1 - LOCK_FADE at LOCK_FADE_V and above
 */
function slideFade(slideV: number): number {
  return 1 - LOCK_FADE * Math.min(1, Math.abs(slideV) / LOCK_FADE_V);
}

/**
 * The tyre's force at a wheel speed: the combined law.
 * @param law the axle's grip numbers
 * @param wheelU the wheel speed, m/s
 * @returns the longitudinal and lateral force (N) and the normalised slip
 */
function lawForce(law: Law, wheelU: number) {
  const nx = (wheelU - law.vx) / law.vRef / law.kPeak, slipN = Math.hypot(nx, law.ny);
  if (slipN < 1e-6) return { fx: 0, fy: 0, slipN: 0, nx: 0 };
  const share = (nx * nx) / (slipN * slipN);
  const sgLong = FIX.lockFade ? law.sgLong * slideFade(wheelU - law.vx) : law.sgLong;
  const shape = curveFactor(slipN, 1, law.sgLat + (sgLong - law.sgLat) * share);
  return { fx: law.FxPk * shape * nx / slipN, fy: -law.FyPk * shape * law.ny / slipN, slipN, nx };
}

/**
 * A locked or spinning tyre's grip share, moved toward the real one by ?reallock (realism.ts).
 * @param slideGrip the car's share
 * @returns the share used
 */
function lockGrip(slideGrip: number): number {
  return DIAL.lock ? slideGrip + (LOCK_REAL - slideGrip) * DIAL.lock : slideGrip;
}

/**
 * The axle's grip numbers this step (axleGrip, the lateral peak as the old lateral law's).
 * @param car the car
 * @param carSpec its spec
 * @param tick the step's shared values
 * @param inp the axle's input
 * @returns the law
 */
function axleLaw(car: Car, carSpec: Spec, tick: { muBase: number; longK: number; peakK: number },
    inp: AxleIn): Law {
  const { muEff, FmaxRoll, caEff } = axleGrip(car, carSpec, inp.load, inp.FzNom, inp.cornering,
      tick.muBase, tick.longK, inp.gripT);
  const FyPk = muEff * inp.load * car.mods.gripLat;
  const aPeak = Math.max(0.10, (FyPk / Math.max(1, caEff * car.mods.gripLat)) * TUNE.alphaPeakK
      * tick.peakK);
  const sgLat = carSpec.slideGrip;
  return { vx: inp.vx, vRef: Math.max(SLIP_V_MIN, Math.abs(inp.vx)), kPeak: KAPPA_PEAK * tick.peakK,
    ny: inp.slip / aPeak, FxPk: FmaxRoll, FyPk, sgLat,
    sgLong: lockGrip(sgLat * (carSpec.tyre && carSpec.tyre.slide || 1)) };
}

/**
 * ABS: one substep of an axle's brake pressure (car.absP) - released past the peak slip, built
 * back under it.
 * @param car the car
 * @param inp the axle's input
 * @param law its grip numbers
 * @param wheelU the wheel speed, m/s
 * @param sub the substep, s
 * @param on whether ABS works this step
 */
function stepAbs(car: Car, inp: AxleIn, law: Law, wheelU: number, sub: number, working: boolean) {
  const press = car.absP!, mem = car.absMem!, axle = inp.axle;
  if (!working) { press[axle] = 1; mem[axle] = 1; car.absDump![axle] = false; return; }
  // braking slip over the peak (negative while the wheel turns slower than the road, either
  // way); the rear: its whole slip, as a braking slip
  const slip = axle ? -lawForce(law, wheelU).slipN / ABS_REAR
    : ((wheelU - law.vx) / law.vRef) * (law.vx < 0 ? -1 : 1) / law.kPeak;
  const dumping = car.absDump!;
  if (slip < -ABS_RELEASE && !dumping[axle]) {
    mem[axle] = press[axle]; dumping[axle] = true; car.absPulses! += 1;
  }
  if (dumping[axle] && slip > -ABS_REAPPLY) dumping[axle] = false;
  if (dumping[axle]) press[axle] = Math.max(0, press[axle] - sub / ABS_DUMP_S);
  else {
    const snapTo = ABS_SNAP * mem[axle];
    const fill = press[axle] < snapTo ? ABS_SNAP_S : ABS_CREEP_S;
    press[axle] = Math.min(1, press[axle] + sub / fill);
    mem[axle] = Math.min(1, mem[axle] + sub / ABS_MEM_S);
  }
}

/**
 * One substep of the wheel: implicit in the tyre's slope (stable however stiff), the brakes as
 * friction (they hold a stopped wheel, never turn it backwards).
 * @param wheelU the wheel speed, m/s
 * @param law the grip numbers
 * @param drive N of drive at the tread
 * @param brake N of brake at the tread
 * @param mass kg at the tread
 * @param sub the substep, s
 * @returns the new wheel speed
 */
function stepWheel(wheelU: number, law: Law, drive: number, brake: number, mass: number,
    sub: number): number {
  const here = lawForce(law, wheelU).fx;
  const slope = Math.max(0, (lawForce(law, wheelU + 0.01).fx - here) / 0.01);
  const free = drive - here;
  let dir = Math.abs(wheelU) < 1e-4 ? 0 : Math.sign(wheelU);
  if (dir === 0) {
    if (Math.abs(free) <= brake) return 0;
    dir = Math.sign(free);
  }
  const next = wheelU + (sub * (free - brake * dir)) / (mass + sub * slope);
  return brake > 0 && Math.sign(next) !== dir ? 0 : next;
}

/**
 * Both axles' wheels over the substeps (with ABS and the AWD coupling), and the force each gave
 * the car (the mean over the substeps).
 * @param car the car
 * @param carSpec its spec
 * @param tick the step's shared values
 * @param inps the two axles' inputs, front then rear
 * @param absOn whether ABS works this step
 * @returns each axle's force, lock and ABS state
 */
function stepAxles(car: Car, carSpec: Spec, tick: WheelTick, inps: [AxleIn, AxleIn],
    absOn: boolean) {
  const laws = inps.map((inp) => axleLaw(car, carSpec, tick, inp));
  const wheels = car.wU!, sub = tick.dt / SUBSTEPS, sumX = [0, 0], sumY = [0, 0];
  const couple = carSpec.drive > 0.01 && carSpec.drive < 0.99 ? AWD_COUPLE * car.clutch : 0;
  for (let i = 0; i < SUBSTEPS; i++) {
    // N the coupling hands from the rear to the front (negative: the other way)
    const pull = couple * (wheels[1] - wheels[0]);
    for (const inp of inps) {
      const axle = inp.axle, law = laws[axle];
      stepAbs(car, inp, law, wheels[axle], sub, absOn);
      wheels[axle] = stepWheel(wheels[axle], law, inp.drive + (axle ? -pull : pull),
          inp.brake * car.absP![axle] + inp.hb, inp.mass, sub);
      const force = lawForce(law, wheels[axle]);
      sumX[axle] += force.fx / SUBSTEPS; sumY[axle] += force.fy / SUBSTEPS;
    }
  }
  return inps.map((inp) => axleOutcome(car, tick, inp, laws[inp.axle], sumX[inp.axle],
      sumY[inp.axle]));
}

/**
 * One axle's outcome (tyres.ts AxleForce), from its wheel at the end of the step.
 * @param car the car
 * @param tick the step's shared values
 * @param inp the axle's input
 * @param law its grip numbers
 * @param meanX its mean longitudinal force, N
 * @param meanY its mean lateral force, N
 * @returns the axle's force, whether it is locked and whether ABS released it
 */
function axleOutcome(car: Car, tick: WheelTick, inp: AxleIn, law: Law, meanX: number,
    meanY: number) {
  const wheelU = car.wU![inp.axle];
  const end = lawForce(law, wheelU), slipLong = wheelU - law.vx;
  const sliding = end.slipN >= TUNE.slideAt;
  const spinning = slipLong * Math.sign(wheelU || law.vx) > 0 && Math.abs(end.nx) > SPIN_AT;
  // the patch's slip speed (marks, squeal, heat), from just under the peak: a wheel ABS holds
  // round the peak marks in dashes as it pulses past it (MEASURED: from the peak to slideAt, an
  // ABS stop left no mark at all - the marks need 2.2 m/s)
  const slipSpeed = Math.hypot(slipLong, inp.syl)
      * clamp((end.slipN - MARK_FROM) / (1.1 - MARK_FROM), 0, 1);
  const axle: AxleForce = { Fx: meanX, Fy: meanY * tick.latFade,
    FyMax: law.FyPk * (sliding ? law.sgLat : 1), sliding, sat: Math.min(1, end.slipN), spinning,
    slipSpeed };
  const locked = Math.abs(law.vx) > 1 && Math.abs(wheelU) < 0.15 * Math.abs(law.vx);
  return { axle, locked, released: car.absP![inp.axle] < 0.97 };
}

/** The step's shared values the wheel blocks read. */
export interface WheelTick {
  mass: number; gravity: number; muBase: number; longK: number; peakK: number;
  latFade: number; dt: number;
}

/** What computeWheelForces reads from step. */
export interface WheelStepIn {
  dt: number; delta: number; vLong: number; vLat: number; vLongAbs: number;
  slipF: number; slipR: number; brakeIn: number; FzF: number; FzR: number;
  FbF: number; FbR: number; handbrake: number; FxDriveF: number; FxDriveR: number;
  totalRatio: number; mass: number; gravity: number;
}

/**
 * The equivalent mass of each axle at the tread: its wheels, plus the engine through the gearing
 * while the clutch is in (shared by the drive split).
 * @param car the car
 * @param carSpec its spec
 * @param inp the step's input
 * @returns [front, rear] kg
 */
function axleMasses(car: Car, carSpec: Spec, inp: WheelStepIn): [number, number] {
  const wheels = WHEEL_MASS * (inp.mass / WHEEL_MASS_REF), radius = carSpec.wheelR;
  const engine = car.clutch * ENGINE_I * car.mods.inertia * (inp.totalRatio / radius) ** 2;
  return [wheels + engine * carSpec.drive, wheels + engine * (1 - carSpec.drive)];
}

/**
 * The step's shared values.
 * @param car the car
 * @param carSpec its spec
 * @param inp the step's input
 * @returns the tick
 */
function wheelTick(car: Car, carSpec: Spec, inp: WheelStepIn): WheelTick {
  const tyreK = carSpec.tyre ? tyreGripOn(carSpec.tyre, car.surface) : 1;
  return { mass: inp.mass, gravity: inp.gravity, muBase: carSpec.mu * car.surface.mu * tyreK,
    longK: car.surface.longK || 1, peakK: car.surface.peakK || 1,
    latFade: clamp(Math.hypot(inp.vLong, inp.vLat) / 1.2, 0, 1), dt: inp.dt };
}

/**
 * Sections 6/7 of step: both axles' wheels and forces, the lock flags, ABS, the friction work
 * and the relaxation lag.
 * @param car the car
 * @param carSpec its spec
 * @param inp the step's input
 * @returns the tick, the axle outcome and whether ABS is working
 */
export function computeWheelForces(car: Car, carSpec: Spec, inp: WheelStepIn) {
  const tick = wheelTick(car, carSpec, inp), { vLong, vLat, delta } = inp;
  const patchLatF = vLat + car.yawRate * carSpec.lf, patchLatR = vLat - car.yawRate * carSpec.lr;
  const sxlF = vLong * Math.cos(delta) + patchLatF * Math.sin(delta);
  const sylF = -vLong * Math.sin(delta) + patchLatF * Math.cos(delta);
  if (!car.wU) car.wU = [sxlF, vLong];
  if (!car.absP) { car.absP = [1, 1]; car.absMem = [1, 1]; car.absDump = [false, false]; }
  car.absPulses = car.absPulses || 0;
  const FzNomF = (inp.mass * inp.gravity * carSpec.lr) / carSpec.L;
  const FzNomR = (inp.mass * inp.gravity * carSpec.lf) / carSpec.L;
  const gripTF = axleTyreGrip(car, carSpec, 0), gripTR = axleTyreGrip(car, carSpec, 2);
  const wreck = car.wreck, [massF, massR] = axleMasses(car, carSpec, inp);
  const handbrake = inp.handbrake * TUNE.handbrakeForce * tick.muBase * inp.FzR * car.mods.gripLong;
  const absOn = car.absOn && inp.brakeIn > 0.05 && inp.vLongAbs > 1;
  const [front, rear] = stepAxles(car, carSpec, tick, [{
    axle: 0, vx: sxlF, syl: sylF, slip: inp.slipF,
    load: inp.FzF, FzNom: FzNomF, cornering: carSpec.caF, gripT: gripTF * (wreck ? wreck.gripF : 1),
    drive: inp.FxDriveF, brake: inp.FbF, hb: 0, mass: massF }, {
    axle: 1, vx: vLong, syl: patchLatR, slip: inp.slipR,
    load: inp.FzR, FzNom: FzNomR, cornering: carSpec.caR, gripT: gripTR * (wreck ? wreck.gripR : 1),
    drive: inp.FxDriveR, brake: inp.FbR, hb: handbrake, mass: massR }], absOn);
  noteWheelSpin(car, carSpec, sxlF, vLong);
  const workF = axleFrictionWork(front.axle, sylF, front.locked, inp.FzF, vLong, vLat,
      inp.vLongAbs, tick.muBase);
  const workR = axleFrictionWork(rear.axle, patchLatR, rear.locked, inp.FzR, vLong, vLat,
      inp.vLongAbs, tick.muBase);
  const axles = { frontAxle: front.axle, rearAxle: rear.axle, lockedF: front.locked,
    lockedR: rear.locked, FzF: inp.FzF, FzR: inp.FzR, FzNomF, FzNomR, workF, workR, gripTF,
    gripTR };
  relaxAxleForces(car, inp.dt, vLong, vLat, front.axle, rear.axle);
  return { tick, axles, absWorking: absOn && (front.released || rear.released) };
}

/**
 * car.wheelSpin (m/s the driven wheels run ahead of the road: the gearbox hold, TCS) from the
 * real wheel speeds.
 * @param car the car
 * @param carSpec its spec
 * @param roadF the front patch's speed along the wheel, m/s
 * @param roadR the rear's, m/s
 */
function noteWheelSpin(car: Car, carSpec: Spec, roadF: number, roadR: number) {
  const ahead = (wheelU: number, road: number) => Math.max(0, Math.abs(wheelU) - Math.abs(road));
  car.wheelSpin = carSpec.drive * ahead(car.wU![0], roadF)
      + (1 - carSpec.drive) * ahead(car.wU![1], roadR);
}

/**
 * The driven wheels' speed (m/s at the tread) for the engine's revs (powertrain.ts).
 * @param car the car
 * @param carSpec its spec
 * @returns the drive-weighted wheel speed, m/s
 */
export function drivenWheelSpeed(car: Car, carSpec: Spec): number {
  const wheels = car.wU;
  if (!wheels) return 0;
  return carSpec.drive * Math.abs(wheels[0]) + (1 - carSpec.drive) * Math.abs(wheels[1]);
}

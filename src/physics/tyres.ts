// Tyre forces: the axle force blocks, brake lock state and ploughing of step.

import type { Spec } from '../cars.ts';
import { TUNE, curveFactor, clamp, tyreGrip } from '../vehicle.ts';
import type { Car } from '../vehicle.ts';
import { axleFrictionWork } from './tyreheat.ts';

// REVERTED to effectively a switch,. Cross-fading the rolling and sliding laws over a
// 0.30 band DID kill the track car judder (max jerk 457 -> 210) but wrecked the thing the slice
// exists for: a handbrake flick went from 49 deg keeping 75% of its speed to 101 deg keeping 27%
// and running backwards. The two laws simply do not agree near the boundary — the ellipse sends
// lateral capacity toward zero while the sliding law gives full lateral — so blending them averages
// two answers that are both wrong in the middle. Measure, then KEEP OR REVERT; this one reverts.
// The judder is chased separately rather than paid for with the drift.
const SLIDE_BLEND = 0.001;

const CIRCLE_TAU = 0.06;       // s to hand the friction budget between directions — see the circle

// Suspension rate and damping are PER CAR, in cars.js (susF / susZ) — see the note there.
export const LOAD_MAX = 2.6;

const ABS_K = 0.92;        // brake capped at this fraction of the grip left after cornering

// PLOUGHING (loose surfaces). See step 7b.
// sideways bulldozing vs forwards. Going in sideways digs in far harder.
const PLOUGH_LAT = 2.2;

const PLOUGH_VREF = 14;        // m/s at which ploughing reaches full strength

// fraction of full force still there at walking pace, so you get STUCK
const PLOUGH_CRAWL = 0.55;

const RELAX_LEN = 0.55;        // m of rolling before a tyre develops its lateral force

export const ALPHA_PEAK_MIN = 0.10;   // rad (~5.7 deg); never peak earlier than this

// peakK — PEAK SLIP ANGLE MULTIPLIER, from the surface. The single most important thing that makes
// a loose surface feel loose, and it is not grip: on gravel the tyre digs a wedge into the loose
// layer, so peak cornering force arrives at 15-25 deg of slip instead of the 7-8 deg of tarmac, and
// the curve falls away far more gently past it. That is the whole reason a rally driver can hold a
// car sideways on gravel and steer it on the throttle, and why the same technique instantly spins
// you on tarmac. Lowering mu alone would only make gravel feel like wet tarmac — slippery, not
// loose.
function tyreLateral(
  alpha: number, peakForce: number, cornerStiff: number, slideGrip: number, peakK = 1,
) {
  if (peakForce <= 1) return 0;
  const aPeak = Math.max(ALPHA_PEAK_MIN, (peakForce / cornerStiff) * TUNE.alphaPeakK * peakK);
  return -Math.sign(alpha) * curveFactor(alpha, aPeak, slideGrip) * peakForce;
}

/** Per-step values shared by the tyre and stability blocks of step. */
export interface AxleTick {
  mass: number; gravity: number; muBase: number; longK: number; peakK: number;
  latFade: number; dt: number;
}

/** Load-sensitive friction and effective cornering stiffness of one axle. */
function axleGrip(
  car: Car, carSpec: Spec, axleLoad: number, FzNom: number, cornering: number,
  muBase: number, longK: number, gripT: number,
) {
  // TYRE LOAD SENSITIVITY — real, standard tyre behaviour, and its absence was the root of the
  // high-speed spin. Grip is NOT proportional to load: a tyre's coefficient of friction FALLS as
  // it is loaded, so doubling the load gives roughly 1.7x the grip, not 2x.
  //
  // Why it fixes the spin: a decelerating sliding car has a destabilising yaw moment of
  // mu*transfer*L (derived, and measured as a permanent +341 N.m that rotated the car forever).
  // That term exists ONLY because the loaded front axle was generating proportionally MORE force
  // than the unloaded rear. With load sensitivity the front gains less and the rear loses less,
  // and the moment largely cancels. This is also the reason lateral load transfer changes a real
  // car's balance at all — the single most important tyre property for handling, and it was
  // missing.
  //
  // AERO FIX: Downforce adds massive Fz. If we apply standard load sensitivity to downforce,
  // mu plummets and the wings do nothing. We must separate mechanical load (which penalizes mu)
  // from aero load (which just adds grip). We approximate this by limiting the load ratio.
  const loadRatio = FzNom > 1 ? axleLoad / FzNom : 1;
  // Cap the load ratio penalty so massive downforce doesn't destroy the friction coefficient.
  // We only want to penalize mechanical weight transfer (which rarely exceeds 1.8x static load).
  const cappedLoadRatio = Math.min(loadRatio, 1.8);
  const muL = muBase * (1 - TUNE.loadSens * (cappedLoadRatio - 1));
  // gripT: tyre temperature, hard surfaces only
  const muEff = Math.max(muBase * 0.35, muL) * gripT;
  const FmaxRoll = muEff * axleLoad * car.mods.gripLong * longK;
  const FmaxSlide = muEff * carSpec.slideGrip * (carSpec.tyre && carSpec.tyre.slide || 1)
      * axleLoad * car.mods.gripLong * longK;
  
  // SECOND AERO FIX: Cornering stiffness (Ca) must scale with vertical load.
  // The peak slip angle is (Fmax / Ca). If Fmax triples due to downforce but Ca stays fixed,
  // the peak slip angle moves from 7 degrees to 21 degrees. You would never reach the peak grip
  // unless you were drifting an F1 car. Scaling Ca with load keeps the peak angle realistic.
  const caEff = cornering * loadRatio;
  return { muEff, FmaxRoll, FmaxSlide, caEff };
}

/** The sliding law of one axle: locked, handbraked or spinning tyres. */
function slidingLaw(
  car: Car, carSpec: Spec, FmaxRoll: number, caEff: number, sxl: number, syl: number,
  FxDemand: number, forceSlide: boolean, demandRatio: number, latFade: number,
) {
  let slideFx = 0, slideFy = 0, slipSpeed = 0;
  // Longitudinal slip speed: a LOCKED wheel skates at the patch speed; a SPINNING one skates in
  // proportion to how far past grip the demand is (we do not model wheel spin as a state).
  // KNOWN ISSUE, diagnosed but NOT fixed — see ENGINE.md. At breakaway the rolling law
  // (ellipse- limited) and the sliding law disagree: measured FyR stepping 2115 -> 5951 N in a
  // single step on the track car. Two attempts to close it both cost more than the judder was
  // worth and were reverted with their numbers: cross-fading the laws over a band took a
  // handbrake flick from 49 deg / 75% speed kept to 101 deg / 27% and running backwards;
  // flooring sx relative to the lateral slip took it to 180 deg / 20%. The honest fix is to
  // model wheel angular velocity as a real state so longitudinal slip is derived rather than
  // approximated. Until then the drift is worth more than the smoothness.
  const overLongSlip = Math.max(0, demandRatio - 1);
  const slipLong = forceSlide
    ? sxl
    : -Math.sign(FxDemand) * (Math.abs(sxl) + Math.min(18, overLongSlip * 12));
  const mag = Math.hypot(slipLong, syl) + 1e-4;
  // Magnitude from the SAME curve the rolling branch uses, evaluated at this axle's COMBINED
  // slip angle. Previously this was a flat mu*slideGrip*Fz, which disagreed with the
  // ellipse-limited rolling law by up to 2.8x at the hand-over (measured FyR stepping 2115 ->
  // 5951 N in one step) — the track-car judder. Taking both from one curve removes the step at
  // source, and leaves slideGrip free to be what it should be: how much grip a tyre loses once
  // it is past the peak.
  const aPeakS = Math.max(ALPHA_PEAK_MIN,
      (FmaxRoll / (caEff * car.mods.gripLat)) * TUNE.alphaPeakK);
  const alphaComb = Math.atan2(Math.abs(syl), Math.abs(slipLong) + 0.5);
  // FLOORED at slideGrip. curveFactor is a LATERAL curve — it is zero at zero slip angle, which
  // is correct for cornering force but catastrophic here: a wheel spinning in a straight line
  // has no slip ANGLE, and using the curve raw gave it no force at all, so no car could
  // accelerate (measured: vmax 0 for four of five). A fully sliding tyre keeps ~slideGrip of
  // its friction whatever direction it is sliding; the curve only adds the bulge up to peak
  // near the limit.
  const Ftot = FmaxRoll
      * Math.max(carSpec.slideGrip, curveFactor(alphaComb, aPeakS, carSpec.slideGrip));
  slideFx = (-Ftot * slipLong) / mag;
  slideFy = ((-Ftot * syl) / mag) * latFade;
  slipSpeed = Math.hypot(slipLong, syl);
  return { fx: slideFx, fy: slideFy, slipSpeed };
}

/** The friction circle of one axle: both demands scaled by one lagged factor. */
function circleForce(
  car: Car, carSpec: Spec, tick: AxleTick, axleLoad: number, FxDemand: number,
  slip: number, syl: number, muEff: number, caEff: number,
  latchKey: 'spinLatchF' | 'spinLatchR',
) {
  const { latFade, peakK, dt } = tick;
  // THE FRICTION CIRCLE. One budget shared between the two directions: take both demands and, if
  // together they exceed it, scale BOTH by the same factor. No branch and no threshold, so there
  // is nothing to chatter — and that chatter was the judder (the rear sat on the limit and
  // flipped in and out of the wheelspin branch, swinging ~6.8 kN every few steps).
  //
  // The old code gave longitudinal demand PRIORITY and handed lateral the remainder, which let a
  // tyre at 30 deg of slip still deliver full longitudinal force, and made the two laws
  // near-opposites at the hand-over: rolling full Fx / no Fy, sliding no Fx / full Fy.
  //
  // The SCALE IS LAGGED. Without that, a gear shift drops Fx to zero in a moment, the freed
  // budget lands on Fy all at once, and the track car spiked to 223. Smoothing the scale is what
  // makes the circle usable — the budget cannot be handed over faster than the carcass can take
  // it up.
  const FyWant = tyreLateral(slip, muEff * axleLoad * car.mods.gripLat, caEff * car.mods.gripLat,
      carSpec.slideGrip, peakK);
  // NOT multiplied by longK. MEASURED: it was, and that inflated the SHARED friction
  // budget, which aPeak is derived from — so raising gravel longitudinal grip quietly moved its
  // lateral peak from 13.4 deg of body slip to 8.4, i.e. made the loosest surface feel tighter.
  // longK is a LONGITUDINAL property and belongs only on the longitudinal capacity below.
  const Fcircle = muEff * axleLoad * car.mods.gripLong;
  const demand = Math.hypot(FxDemand, FyWant);
  const over = Fcircle > 1 ? demand / Fcircle : 1;
  const kTarget = over > 1 ? 1 / over : 1;
  car[latchKey] += (kTarget - car[latchKey]) * Math.min(1, dt / CIRCLE_TAU);
  const latchScale = car[latchKey];
  let forceLong = FxDemand * latchScale;
  let forceLat = FyWant * latchScale * latFade;
  // the SAME peakK, or the saturation test and the force curve would disagree about where the
  // peak is
  const aPeak = Math.max(ALPHA_PEAK_MIN,
      (Fcircle / (caEff * car.mods.gripLat)) * TUNE.alphaPeakK * peakK);
  const saturated = Math.abs(slip) >= aPeak * TUNE.slideAt || over > 1.02;
  return {
    Fx: forceLong, Fy: forceLat, FyMax: Fcircle, sliding: saturated,
    sat: Math.min(1, over),
    spinning: over > 1.02 && Math.abs(FxDemand) > Math.abs(FyWant),
    slipSpeed: Math.max(saturated ? Math.abs(syl) : 0, (over - 1) * 6),
  };
}

const NO_SLIDE = { fx: 0, fy: 0, slipSpeed: 0 };

/**
 * Sections 6/7 of step: the force one axle's tyres make. Rolling (cornering stiffness x slip
 * angle inside the friction circle) blended into sliding (locked, handbraked or spinning).
 */
export function axleForce(
  car: Car, carSpec: Spec, tick: AxleTick,
  axleLoad: number, sxl: number, syl: number, FxDemand: number, slip: number, cornering: number,
  forceSlide: boolean, FzNom: number, latchKey: 'spinLatchF' | 'spinLatchR', gripT = 1,
) {
  const { muBase, longK, latFade } = tick;
  // A TYRE IN THE AIR MAKES NO FORCE. FIXED (Claude) — the "freeze when you brake
  // mid-jump".
  //
  // MEASURED: driving off the lab ramp and braking while airborne turned x/y into NaN on the
  // FIRST airborne step, 8 of 8 cars (tools/airbrake.mjs). Cause: the "SECOND AERO FIX" below
  // scales cornering stiffness by load (caEff = ca * Fz/FzNom), so with Fz = 0 the sliding branch
  // computes aPeakS = 0/0 = NaN. Braking is what reaches that branch (lockedF/lockedR ->
  // forceSlide), which is why only brake-in-the-air froze it. The NaN position then made
  // groundAt return no surface, step threw on `surface.mu`, and the frame loop died — the
  // screen froze on its last frame and RESTART/RESET looked broken because nothing was being
  // drawn any more.
  //
  // It also fixes a quieter bug on the same path: with Fz = 0 the rolling branch handed out the
  // FULL drive and brake demand (the friction budget of 0 skipped its own scaling), so throttle
  // and brakes still pushed the car while it was flying. 1 N is far below any real axle load
  // (~4000 N+), so this never touches a wheel that is on the ground.
  if (!(axleLoad > 1)) {
    return { Fx: 0, Fy: 0, FyMax: 0, sliding: false, sat: 0, spinning: false, slipSpeed: 0 };
  }
  const { muEff, FmaxRoll, FmaxSlide, caEff } =
    axleGrip(car, carSpec, axleLoad, FzNom, cornering, muBase, longK, gripT);

  // longitudinal demand alone beyond grip => the wheel spins up or locks
  // WHEELSPIN / LOCK-UP: the longitudinal demand alone exceeds grip. This is a DIFFERENT thing
  // from a tyre merely at a big slip angle, and conflating the two made the donut bench report
  // that the muscle car could donut at 0.7x power when by hand it needed 2.4x (CLAUDE.md rule
  // 15).
  const demandRatio = FmaxRoll > 1 ? Math.abs(FxDemand) / FmaxRoll : 0;
  // NOTE: hysteresis on this state was tried (enter above 1.0 of grip, leave below 0.85) to stop
  // the rear flipping in and out of wheelspin during a slide. It made the track car WORSE (judder
  // 63 -> 175) because holding the state longer makes the eventual jump bigger. A shared friction
  // circle was tried too and was better physics and better almost everywhere, but worse again for
  // the track car at gear shifts (223). Both reverted. See ENGINE.md.
  const overLong = demandRatio > 1;

  // BLENDED, never switched. MEASURED BUG, (requirement: the track spec car seems juddery),
  // returning after the power went up): this was a hard `if` between the rolling and sliding
  // laws, and at the boundary the two disagree by (1 - slideGrip) in magnitude AND in direction.
  // With plenty of power the demand sits right on that boundary, so the force flipped between the
  // two every step — track car max jerk 457 against 7-11 for the others. Same lesson as the yaw
  // damping: a discontinuous force is always a judder. Fade across a band so the two laws meet
  // smoothly. Use the HYSTERETIC state, not a fresh threshold — computing the latch and then
  // ignoring it here is why the first attempt at this changed nothing at all.
  const wSlide = forceSlide ? 1 : clamp((demandRatio - 1) / SLIDE_BLEND, 0, 1);


  const slide = wSlide > 0 ? slidingLaw(car, carSpec, FmaxRoll, caEff, sxl, syl, FxDemand,
    forceSlide, demandRatio, latFade) : NO_SLIDE;
  if (wSlide >= 1) {
    return {
      Fx: slide.fx, Fy: slide.fy,
      FyMax: FmaxSlide, sliding: true, sat: 1, spinning: overLong && !forceSlide,
      slipSpeed: slide.slipSpeed,
    };
  }
  return circleForce(car, carSpec, tick, axleLoad, FxDemand, slip, syl, muEff, caEff, latchKey);
}

/**
 * Section 7b of step: gravel-trap ploughing, a retarding force per axle along that axle's own
 * contact velocity. All zero on surfaces that do not plough.
 */
export function ploughingForces(car: Car, carSpec: Spec, mass: number, vLong: number, vLat: number,
    loadKF: number, loadKR: number) {
  // PLOUGHING — what makes a gravel trap a gravel trap (user: "can the gravel
  // trap
  //          actually work like a gravel trap, slow you down, grab ya wheels").
  //
  // Lower grip alone does NOT model gravel. Gravel stops you because the wheels SINK and bulldoze a
  // wedge of stones ahead of themselves, which is a retarding force that has nothing to do with
  // friction at all: it does not care about vertical load the way mu*Fz does, it does not care
  // whether you are braking, and you cannot steer out of it. The tyre friction (mu 0.55) is
  // separate and says you also cannot brake or accelerate well — both are true at once, which is
  // why a gravel trap works.
  //
  // Applied PER AXLE along that axle's own contact velocity, which gives the "grabs ya wheels" part
  // for free: a yawed car has different velocity directions at each end, so the two forces are not
  // parallel and their moment about the CG hauls the car straight. And because the lateral
  // component is amplified, going in sideways digs in far harder than going in straight — which is
  // the real behaviour, and the reason a spun car stops dead in the gravel.
  //
  // It reaches here only as car.surface.plough, so vehicle.js still does not know what gravel is.
  const plough = car.surface.plough || 0;
  let FpxF = 0, FpyF = 0, FpxR = 0, FpyR = 0;
  if (plough > 0) {
    // Still strong at a crawl (PLOUGH_CRAWL of full), so you get STUCK rather than gently coasting
    // out.
    const spAll = Math.hypot(vLong, vLat);
    const scale = PLOUGH_CRAWL + (1 - PLOUGH_CRAWL) * Math.min(1, spAll / PLOUGH_VREF);
    // share = static load share, lk = this end's suspension load: airborne over gravel ploughs
    // nothing.
    const ploughForce = (velLong: number, velLat: number, share: number, load: number) => {
      const sp2 = Math.hypot(velLong, velLat);
      if (sp2 < 0.05) return [0, 0];
      const Fmag = mass * share * plough * scale * Math.min(1, load);
      return [(-velLong / sp2) * Fmag, (-velLat / sp2) * Fmag * PLOUGH_LAT];
    };
    [FpxF, FpyF] = ploughForce(vLong, vLat + carSpec.lf * car.yawRate, carSpec.lr / carSpec.L,
        loadKF);
    [FpxR, FpyR] = ploughForce(vLong, vLat - carSpec.lr * car.yawRate, carSpec.lf / carSpec.L,
        loadKR);
  }
  return { FpxF, FpyF, FpxR, FpyR };
}

/**
 * Section 6 of step, brake side: ABS caps on each axle's brake force, the lock-up tests, and the
 * handbrake force on the rear. Returns the brake forces and lock flags the tyre blocks read.
 */
function brakeLockState(car: Car, tick: AxleTick, brakeIn: number, vLongAbs: number, FzF: number,
    FzR: number, FbF: number, FbR: number, FxBrakeF: number, FxBrakeR: number, brakeSign: number,
    handbrake: number) {
  const { muBase } = tick;
  // lock-up test: brake demand alone exceeding available grip ABS: cap each axle's
  // brake at ABS_K of the grip LEFT after cornering (last step's lateral force, friction ellipse),
  // so the wheels keep turning and the tyre keeps steering. Without it the lap driver locked the
  // track car's fronts at 32% pedal mid-corner and went straight on. The handbrake is not touched.
  let absWorking = false;
  if (car.absOn && brakeIn > 0.05 && vLongAbs > 1) {
    const lastTelem = car.t;
    const cap = (load: number, lateralForce: number) =>
      ABS_K * Math.sqrt(Math.max(0,
          (muBase * load * car.mods.gripLong) ** 2 - lateralForce * lateralForce));
    const capF = cap(FzF, lastTelem.FyF || 0), capR = cap(FzR, lastTelem.FyR || 0);
    if (FbF > capF) { FbF = capF; absWorking = true; }
    if (FbR > capR) { FbR = capR; absWorking = true; }
    FxBrakeF = FbF * brakeSign; FxBrakeR = FbR * brakeSign;
  }
  const lockedF = brakeIn > 0.05 && vLongAbs > 0.3
      && Math.abs(FbF) > muBase * FzF * car.mods.gripLong;
  // HANDBRAKE AS A FORCE, not a boolean. MEASURED (requirement: hand braking at higher speeds still
  // feels off and ends up in the car swinging backwards): as an instant full lock, its violence
  // scaled with FRONT grip — and raising mu to 1.25 made every flick, at every speed, in
  // every car, reach 90 deg of body slip. Identical outcomes across different inputs is rule 1. As
  // a rear brake DEMAND it locks only when it actually exceeds rear grip, the existing over-demand
  // path handles the transition continuously, and its strength is one tunable number.
  const hbForce = handbrake * TUNE.handbrakeForce * muBase * FzR * car.mods.gripLong;
  // Does the handbrake demand actually EXCEED rear grip? If so the wheel genuinely LOCKS, and a
  // locked wheel skates at the full contact-patch speed — which is what makes it lose its lateral
  // grip and lay rubber. MEASURED BUG, (requirement: handbrake does not seem to lock up the rear
  // wheels): converting the handbrake from a lock into a force meant it no longer set forceSlide,
  // so the rear's longitudinal slip was derived from how far past grip the demand was —
  // 0.7 m/s at 20 m/s instead of ~20. The rear kept almost all its lateral grip and laid no marks
  // at all (the mark floor is 2.2 m/s).
  const hbLocksRear = hbForce > muBase * FzR * car.mods.gripLong * 0.98;
  const lockedR = hbLocksRear
      || (brakeIn > 0.05 && vLongAbs > 0.3 && Math.abs(FbR) > muBase * FzR * car.mods.gripLong);
  return { absWorking, FxBrakeF, FxBrakeR, lockedF, hbForce, lockedR };
}

/**
 * Tyre relaxation section of step: lags each axle's lateral force behind its slip angle by a
 * rolling distance and writes the lagged Fy back onto both axle outcomes.
 */
function relaxAxleForces(car: Car, dt: number, vLong: number, vLat: number,
    frontAxle: ReturnType<typeof axleForce>, rearAxle: ReturnType<typeof axleForce>) {
  // TYRE RELAXATION LENGTH — real, standard, and its absence was the turn-in bug.
  //
  // A tyre does not develop its lateral force the instant a slip angle appears: the carcass has to
  // deflect, which takes a ROLLING DISTANCE (the relaxation length, ~0.5 m) rather than a time. So
  // the lag is RELAX_LEN / v — sharp at speed, soft when slow, exactly as in a real car.
  //
  // MEASURED BUG, (requirement: braking when turning... it slides weird): without it the
  // FRONT reached full grip instantly at turn-in while the rear was still at zero — dumped FyF
  // 10178 N against FyR -89 N, a net yaw moment of +12658 N.m that spun the car up to 0.66 rad/s
  // before the rear contributed anything at all. Four of five cars then rotated past 90 deg. Brake
  // force made no difference to it (identical at 1.35 g and 0.90 g), which is what ruled the brakes
  // out.
  const relaxTau = RELAX_LEN / Math.max(3, Math.hypot(vLong, vLat));
  const relaxK = 1 - Math.exp(-dt / relaxTau);
  car.FyFlag += (frontAxle.Fy - car.FyFlag) * relaxK;
  car.FyRlag += (rearAxle.Fy - car.FyRlag) * relaxK;
  frontAxle.Fy = car.FyFlag;
  rearAxle.Fy = car.FyRlag;
}

/**
 * Sections 6/7 of step: the tick values shared by the tyre blocks, the brake lock state and the
 * force of both axles (with the tyre relaxation lag applied to Fy). Returns the tick, the axle
 * outcome and whether ABS is working.
 */
export function computeAxleForces(car: Car, carSpec: Spec, mass: number, gravity: number,
    dt: number, delta: number, vLong: number, vLat: number, vLongAbs: number, dirSign: number,
    slipF: number, slipR: number, brakeIn: number, FzF: number, FzR: number, FbF: number,
    FbR: number, FxBrakeF0: number, FxBrakeR0: number, brakeSign: number, handbrake: number,
    FxDriveF: number, FxDriveR: number) {
  // ---- 6/7. per-axle tyre force.
  //
  // MEASURED BUG: the first cut gave a locked axle its friction as pure LONGITUDINAL
  // demand at 1.2*Fmax, which the ellipse then turned into FyMax = 0 — a handbraked rear axle
  // produced exactly zero lateral force (dumped: FyR = 0 N for every tick of a handbrake turn), so
  // the car scrubbed to a dead stop in 0.7 s and never passed 50 deg of yaw. A locked tyre's
  // friction is mu*Fz opposing its SLIP-VELOCITY VECTOR. That is what the `sliding` branch below
  // does, and it is also what makes the mark direction correct in step 4.
  //
  // Two regimes per axle:
  //   ROLLING  — cornering stiffness x slip angle, clamped by the friction ellipse (grippy,
//              forgiving)
  //   SLIDING  — locked, handbraked, or spinning: mu_slide * Fz along -slipDir (breakaway, drift)
  const cosDelta = Math.cos(delta), sinDelta = Math.sin(delta);
  // TYRES (cars.js TYRES): x grip on this surface's group; none fitted (Pre-Spun) = 1
  const tyreK = carSpec.tyre ? (carSpec.tyre.bySurf![car.surface.id] ?? 1) : 1;
  const muBase = carSpec.mu * car.surface.mu * tyreK;
  const peakK = car.surface.peakK || 1;   // loose surfaces peak much later — see tyreLateral
  // LONGITUDINAL GRIP RELATIVE TO LATERAL. Added (requirement: grass mud and gravel feel too
  // similar) because grip, slip angle and drag alone could not separate them — all three merely
  // made a surface "worse" by degrees. This one is the difference between a wheel that DIGS IN and
  // one that CHURNS. On gravel a driven wheel packs the loose stones and finds more bite than a
  // cornering wheel does (longK 1.30, so power pays even while sideways); in mud it just spins
  // itself a hole (0.65). Lateral grip is untouched by it, which is exactly what makes gravel feel
  // fast and mud feel bogged at almost the same mu.
  const longK = car.surface.longK || 1;

  // Lateral-force speed fade. MEASURED ARTIFACT: a car parked at 0.1 m/s with the wheel
  // at 19 deg reported FyF = 5610 N — because slip angle is atan2(lat, |vLong| + eps) and at rest
  // the eps IS the denominator, so a stationary tyre reads a huge slip angle. The low-speed blend
  // was deleting the resulting velocity every step, i.e. hiding it rather than fixing it. No slip
  // velocity => no slip force: fade the lateral component out below 1.2 m/s. Longitudinal is
  // untouched (you must still be able to pull away and to brake to a stop).
  const latFade = clamp(Math.hypot(vLong, vLat) / 1.2, 0, 1);

  const tick = { mass, gravity, muBase, longK, peakK, latFade, dt };

  // contact-patch velocities. Front is in the WHEEL frame (rotated by delta); rear is the body
  // frame.
  const patchLatF = vLat + car.yawRate * carSpec.lf;
  const patchLatR = vLat - car.yawRate * carSpec.lr;
  const sxlF = vLong * cosDelta + patchLatF * sinDelta;
  const sylF = -vLong * sinDelta + patchLatF * cosDelta;
  const sxlR = vLong;
  const sylR = patchLatR;

  const brakeState = brakeLockState(car, tick, brakeIn, vLongAbs, FzF, FzR, FbF, FbR, FxBrakeF0,
      FxBrakeR0, brakeSign, handbrake);
  const FxBrakeF = brakeState.FxBrakeF;
  const FxBrakeR = brakeState.FxBrakeR;
  const { absWorking, lockedF, hbForce, lockedR } = brakeState;

  // static axle loads
  const FzNomF = (mass * gravity * carSpec.lr) / carSpec.L,
      FzNomR = (mass * gravity * carSpec.lf) / carSpec.L;
  const hard = !!car.surface.hard, tyreTemps = car.tyreT;
  const gripTF = hard ? (tyreGrip(tyreTemps[0], carSpec) + tyreGrip(tyreTemps[1], carSpec)) / 2 : 1;
  const gripTR = hard ? (tyreGrip(tyreTemps[2], carSpec) + tyreGrip(tyreTemps[3], carSpec)) / 2 : 1;
  const wreckMul = car.wreck;   // DAMAGE: axle grip (bent suspension, a puncture)
  const frontAxle = axleForce(car, carSpec, tick, FzF, sxlF, sylF, FxDriveF + FxBrakeF, slipF,
      carSpec.caF, lockedF, FzNomF, 'spinLatchF', gripTF * (wreckMul ? wreckMul.gripF : 1));
  const rearAxle = axleForce(car, carSpec, tick, FzR, sxlR, sylR,
      FxDriveR + FxBrakeR - dirSign * hbForce, slipR,
      carSpec.caR, lockedR, FzNomR, 'spinLatchR', gripTR * (wreckMul ? wreckMul.gripR : 1));
  // friction work per axle (W), taken BEFORE the relaxation lag below changes Fy. A sliding /
  // spinning / locked axle skates at slipSpeed; a rolling one scrubs at a fraction of its lateral
  // patch speed, plus ~8% longitudinal slip at its drive / brake force.
  const workF = axleFrictionWork(frontAxle, sylF, lockedF, FzF, vLong, vLat, vLongAbs, muBase);
  const workR = axleFrictionWork(rearAxle, sylR, lockedR, FzR, vLong, vLat, vLongAbs, muBase);
  const axles = { frontAxle, rearAxle, lockedF, lockedR, FzF, FzR, FzNomF, FzNomR, workF, workR,
    gripTF, gripTR };

  relaxAxleForces(car, dt, vLong, vLat, frontAxle, rearAxle);
  return { tick, axles, absWorking };
}

// vehicle.js — THE MODEL.
//
// Knows nothing about upgrades, cones, rendering or archetypes. PURE: no DOM, no canvas, no imports
// beyond cars.js data — tools/probe.mjs imports this file directly in node and must keep working.
// Everything tunable comes through `mods` (CLAUDE.md rule 6); every mod defaults to 1.0.
//
// Fixed step, ALWAYS. Never hand this function a frame delta (CLAUDE.md §8 / rule 4): tyre friction
// near the grip limit is stiff, and at 60Hz / 40m/s the car moves 0.67m per step and never feels
// the lateral force it should have. main.js accumulates into PHYSICS_STEP_SECONDS-sized calls.
//
// Bicycle model, per-axle friction ellipse. Body-frame integration with centripetal terms, which is
// more stable near the limit than integrating in world frame and rotating back.

import { defaultMods, spec, SURFACE_LAB, GRAVITY } from './cars.ts';
import type { Spec, Mods, Surface } from './cars.ts';
import type { WheelGround } from './world/types.ts';
import { computeAxleLoads, computeLongitudinalDemand } from './physics/loads.ts';
import { steerFrontWheels, runPowertrain } from './physics/powertrain.ts';
import { updateTyreTemps } from './physics/tyreheat.ts';
import { WEATHER } from './world/weather.ts';
import type { AxleOutcome } from './physics/tyreheat.ts';
import { ALPHA_PEAK_MIN, computeAxleForces, ploughingForces } from './physics/tyres.ts';
import type { AxleTick } from './physics/tyres.ts';

// What step reads from the input: steer -1..1, pedals 0..1, handbrake (on/off or 0..1), manual
// shifts, reverse pedal.
export interface CarInput {
  steer: number; throttle: number; brake: number;
  handbrake: boolean | number; shiftUp?: boolean; shiftDown?: boolean;   // shifts: manual box only
  reverse?: number;
}

// The car.t telemetry (read by the dev overlay, the bench and the marks layer; never drives
// physics). The last two lines are not in makeCar's literal: step adds those fields.
export type CarTelemetry = {
  vLong: number; vLat: number; slipF: number; slipR: number;
  FzF: number; FzR: number; FyF: number; FyR: number; FyMaxF: number; FyMaxR: number;
  FxF: number; FxR: number;
  loadKF: number; loadKR: number;
  satF: number; satR: number;
  slidingF: boolean; slidingR: boolean;
  lockedF: boolean; lockedR: boolean;
  slipSpeedF: number; slipSpeedR: number;
  spinF: boolean; spinR: boolean;
  torque: number; driveForce: number; speed: number;
  ax: number; ay: number;
  absWorking?: boolean; tcsWorking?: boolean; gripTF?: number; gripTR?: number;
  slipSpeedDriven?: number; delta?: number; gear?: number; rpm?: number;
}

// The damage state vehicle.ts reads (damage.ts sets car.wreck; multipliers, 1 = undamaged; smoke:
// the nose smokes, for the particles).
export interface CarWreck {
  toe: number; power: number; roll: number; gripF: number; gripR: number; smoke: boolean;
}
// The rollover state (roll.js): vehicle.ts only nulls it.
export interface CarRoll { phase: string }
// Render position of the last frame (main.js, traffic.ts): vehicle.ts only nulls it.
export interface CarPrev { x: number; y: number; h: number }
// A wheel position from last step (world/wear.ts): vehicle.ts only nulls the list.
export interface CarWheelPos { x: number; y: number }
// Tape stuck to the car (cones.js): vehicle.ts only nulls the list.
export interface CarStreamer { born: number }

// The car: everything makeCar's literal creates, what reset adds, and what other files set on it.
export interface Car {
  spec: Spec; mods: Mods; surface: Surface;
  x: number; y: number; vx: number; vy: number;
  heading: number; yawRate: number; delta: number;
  rpm: number; gear: number;
  absOn: boolean; tcsOn: boolean; tcsK: number; escCut: number;
  shiftTimer: number; aLongPrev: number;
  spinLatchF: number; spinLatchR: number;
  FyFlag: number; FyRlag: number;
  revLatch: boolean; gearLock: number;
  zF: number; zvF: number; zR: number; zvR: number;
  groundF: number; groundVF: number; groundR: number; groundVR: number;
  z: number; loadK: number; air: number;
  brakeArmed: boolean; slipFPrev: number; aPeakFPrev: number;
  align: number; clutch: number; transfer: number;
  spec0: Spec; reverseTimer: number; autoBox: boolean;
  t: CarTelemetry;
  // added by reset, which makeCar calls right after building the literal
  wheelSpin: number; tyreT: number[]; groundInit: boolean;
  // TYRE WEAR (physics/tyrewear.ts): 0 new .. 1 bald per tyre, and a tyre that burst
  // this step (-1 none; damage.ts applyBurst)
  tyreWear?: number[]; burstTyre?: number; tyreWearOwned?: boolean; tyreWearStart?: number[];
  _p: CarPrev | null; prevWheels: CarWheelPos[] | null;
  // the ground under each wheel (world/wear.ts stepWear; null after a reset)
  wheelSurf?: WheelGround[] | null;
  roll: CarRoll | null; sparks: boolean; streamers: CarStreamer[] | null;
  // set by world/wear.ts (the slope and bank forces under the car)
  slopeLong?: number; slopeLat?: number; slopeYaw?: number;
  bankLatForce?: number; bankLoadFactor?: number;
  // set by contact.js (the slipstream) and by vehicle.ts itself (the handbrake hold)
  dragMul?: number; hbAfter?: number;
  // set by damage.ts
  wreck?: CarWreck;
  wheelOff?: boolean[];
  // set by tools / the debug panel only
  yawDampOverride?: number;
}

export const PHYSICS_STEP_SECONDS = 1 / 120;

// slip-angle divide guard (CLAUDE.md rule 20). Stationary is frame 1 of every run.
const EPS_SLIP = 0.5;
export const STEER_RATE = 8.0;        // rad/s at the road wheel (~458 deg/s; full lock in 70 ms)
export const STEER_MAX = 0.56;        // 32 deg parked
const LOWSPEED_BLEND = 1.5;    // m/s, below which we lerp toward a kinematic result
const REST_SPEED = 0.15;       // m/s, below which we snap to rest with no throttle
// g of slope pull along the car before a stopped car rolls (what being in gear holds)
const SLOPE_ROLL = 0.06;
// g of slope pull across the car (~19 deg) before a stopped car slides sideways
const SLOPE_SLIDE = 0.35;


// ---------------------------------------------------------------------------------------------
// THE TYRE CURVE. Replaced the linear-plus-hard-clamp law on, after the user reported
// "super slippy, handbrake and turning too hard create strange drift dynamics, doesn't feel good".
//
// MEASURED CAUSE, not guessed (occupancy over 12 s runs, CLAUDE.md rule 3):
//   - a GENTLE WEAVE spent 56% of its time with the front axle saturated and sliding, and reached
//     28 deg of body slip. A gentle weave should not slide at all.
//   - a NORMAL sinusoidal steer input reached 90 deg of body slip — it spun the car.
//   - cause: Fy = clamp(-Ca*alpha, +/- mu*Fz) saturates at mu*Fz/Ca = 4.6 deg front, 4.3 deg rear.
//     A real tyre peaks near 8 deg. The model hit its ceiling at half the slip angle it should, and
//     past that was a FLAT PLATEAU with no progressive feel, then a hard switch to a sliding regime
//     at 0.75*mu — a 25% instant grip cliff AND a direction change. That is the "strange drift".
//
// The replacement is ONE continuous curve: it rises to the peak at ~7.4 deg with the SAME initial
// cornering stiffness Ca, then decays gently to `slideGrip` of peak. Because the sliding branch now
// uses the same `slideGrip`, the two regimes agree in magnitude at the boundary and the snap is
// gone. LIVE-TUNABLE MODEL CONSTANTS. One mutable object so the in-game debug panel can move them
// while driving (the user asked for sliders rather than another round of me guessing). These are
// GLOBAL model shape, not per-car numbers — per-car values live in cars.js.
export const TUNE = {
  alphaPeakK: 1.6,      // aPeak = (mu*Fz/Ca) * this — stretches the linear region into a peak
  falloff: 1.5,
  // 0.35 — SWEPT under hard braking, where load transfer is most extreme: 0.20 spun 4 of 5 cars,
  // 0.35 spun 1, and 0.50/0.65 got worse again. Real tyres lose roughly this much over their
  // working range.
  aeroMul: 1,           // audit hook only; 1 in normal play
  // 0.35, not 0.15. The audit showed 0.15 gave slightly more grip and was fine for the high-speed
  // coast spin — but it then let the FWD hatch and the track car run backwards under hard braking
  // at 45+ m/s, where load transfer is most extreme and this term does the most work. Real tyres
  // lose 10-35% over their working range, so 0.35 is inside the honest band. Grip costs 0.01 g.
  // how much grip a tyre loses as it is loaded. 0 = the old, wrong, linear model
  loadSens: 0.35,
  steerHeadroom: 1.75,  // how far past the grip-limited steer angle the player is allowed
  slideAt: 1.30,        // x aPeak before an axle counts as SLIDING (marks, squeal, overlay)
  yawDamp: 1.15,        // 1/s, opposes yaw IN EXCESS of what the steering asked for
  transferTau: 0.18,    // s, suspension time constant for longitudinal load transfer
  reverseSteer: 0.62,   // steering lock multiplier in reverse
  // 0.90 — SWEPT,. Handbrake at 28 m/s with the lock HELD: 0.00 and 0.55 both spun all
  // five cars backwards; 0.75 fixed four of five; 0.90 fixed all five (worst 76 deg, none
  // backwards) and left ordinary cornering yaw UNCHANGED at 0.343 rad/s. It costs nothing in normal
  // driving.
  selfAlign: 0.90,      // how much lock the front gives back once past its grip peak (0 = none)
  handbrakeForce: 1.15, // rear brake demand as a multiple of rear grip. >1 locks; below 1 it only
                        // drags, so this is a real STRENGTH rather than an on/off switch.
};
// TYRE TEMPERATURE. Four tyres, each its own temperature (deg C), indexed by
// side of the BODY:
//   0 front +y, 1 front -y, 2 rear +y, 3 rear -y.
// HEAT IN = the friction work at the contact patch (force x slip speed), per axle, split
// left/right by the lateral load transfer — so cornering loads (and heats) the OUTSIDE pair,
// wheelspin heats only the DRIVEN axle (FWD / RWD / 4WD differ by construction), and the axle
// doing more cornering work heats more. HEAT OUT = toward ambient at TYRE_COOL + TYRE_AIR * speed,
// plus the surface's own coolK (grass, snow, ice, mud, wet cool tyres; tarmac does not) — data on
// the surface, so this file still knows no surface by name.
// GRIP: only on a HARD surface (surface.hard), a tyre outside its working window grips less;
// off-road grip ignores temperature, as in real life (user). Per-car window: spec.tyreOpt [lo, hi],
// spec.tyreColdGrip. Tyres start COLD (ambient) on every reset (requirement: cold, warm them up).
// deg C: a cold tyre, the reference of the warm-up grip curve (tyreGrip); the air and track
// temperatures are the weather's (weather.ts), 18 C when there is none
export const TYRE_AMBIENT = 18;
// deg C a tyre is held at; a burst replaces this once damage exists
export const TYRE_T_MAX = 260;
// 3500, was 2200 (requirement: temp seems a bit easy to build in tyres, it should be a bit harder).
// With the cooling also x0.8 below, warming takes ~2x as long and settles a little cooler.
// Measured in tools/tyrecheck.mjs. HARD TO OVERHEAT (requirement: tyres heat up too easy and pass
// the good range too easy — it should take long burnouts to pop them and excessive drifting on
// tarmac to overheat; off-road surfaces shouldn't get them up much). MEASURED before
// (tools/tyrecheck.mjs section 7, hatch-rwd): a tarmac drift went warm 1.3 s / too hot 2.3 s / 260
// C in 8 s — FASTER than a pinned burnout (260 C in 20 s) — and a gravel drift reached 260 C in 14
// s. Sliding heat was force x slip speed with no limit and no surface factor. Three physical
// changes, each a number here or on the surface:
//   slipSat: above a few m/s of slip, extra slip heats the ROAD more than the rubber (tanh
//            saturation)
//   roadV:   sliding over FRESH road dumps heat into it; the tyre's share is
//            1 / (1 + ground speed / roadV). A pinned burnout (speed 0) keeps it all — so
//            burnouts pop, drifts only overheat. Rolling scrub is unaffected.
//   surface.heatK (lab.js): on loose ground the slip is IN the ground — the tyre gets HEAT_OFFROAD
//            of it
// Swept 48 combinations (tools/_tyresweep, deleted); the only one meeting every target is below.
// MEASURED after:
//   burnout   too hot 18 s, 260 C 57 s      drift   warm 13 s, too hot 27 s, never 260 C in 90 s
//   gravel drift 25 C at 30 s               clean cornering warm at 80 s (unchanged)
export const TYRE_HEAT = { cap: 3500, slipSat: 4, air: 0.0008, roadV: 12, massRef: 1440 };
// Flex heat toward T (deg C, inside every car's working window) at k per s per unit of axle
// utilisation. See the tyre-temperature block in step. Added; measured results are in
// tools/tyrecheck.mjs sections 2 / 2a / 7.
export const TYRE_FLEX = { k: 0.07, T: 85, vRef: 12 };
// Engine braking at the redline, in g of the car's weight (falls with revs). See step 5 in step.
// MEASURED 100 -> 50 km/h lift-off: hatch 47.5 s -> 13.3 s, muscle 36.9 -> 10.3, track 30.4 -> 9.8
// (0.12 g: 17.4 s; 0.25 g: 10.6 s).
export let ENGINE_BRAKE = 0.18;
export const setEngineBrake = (value: number) => { ENGINE_BRAKE = value; };   // for tools only
// DRIVER AIDS (step 2). See ABS / TCS in step. Measured results in
// tools/aidcheck.mjs. Tools that measure RAW tyre / surface physics (burnouts, wheelspin, locked
// passes) create cars with the aids OFF: with TCS on, a burnout is not a burnout. The game itself
// never calls this.
const AIDS_DEFAULT = { on: true };
export const setAidsDefault = (enabled: boolean) => { AIDS_DEFAULT.on = !!enabled; };
// VERTICAL GRAVITY multiplier for the suspension / airtime only (grip and weight still use g). See
// the measured note at the suspension. Exported setter for tools. 1 -> 1.4 (requirement: I seem to
// get airborne slightly too easily / stay in the air too long). MEASURED: all airtime in normal
// laps came from the Test Track table (hatch 0.79 s, track car 1.17 s at 90 km/h). More
// DAMPING made it WORSE (the damper ties the body to the lip's upward speed). Heavier vertical
// gravity shortens flight AND raises the speed a crest needs to launch you: x1.4 -> hatch 0.79 ->
// ~0.5 s, whoops 0.75 -> ~0.4 s. Grip and weight still use g.
export let VERT_G = 1.4;
export const setVertG = (scale: number) => { VERT_G = scale; };
// m/s of driven-wheel spin (or 10% of road speed if more) before the traction half cuts
export const TCS_SPIN = 1.2;
// vMin 5 -> 10 m/s: MEASURED, at 5 m/s on full lock the body slip is ~14 deg of pure GEOMETRY, the
// slip term chased it and the judder bench slow corner went 0 -> 11 flips/s on the RWD hatch.
// betaLim rad (~4 deg) of body slip stability half: rad/s dead band, 1/s gain, throttle cut
const ESC = { dead: 0.10, deadRel: 0.25, gain: 6, cutAt: 0.10, vMin: 10, betaLim: 0.07,
    betaGain: 20, underK: 0.2, hbHold: 0.6 };
// THE GRIP CURVE (requirement: cold tyres are sloppier than warm tyres, hot tyres grippier still;
// tyres that are too hot are less grippy than hot but still grippier than cold — keep it
// realistic):
//   ambient (cold) ..... tyreColdGrip (0.86)
//   tyreOpt[0] (warm) .. 0.97          rising linearly from cold
//   tyrePeak .......... 1.00          hot: the peak band, tyrePeak[0]..tyreOpt[1]
//   above tyreOpt[1] ... falls 0.15%/C, FLOORED at TYRE_HOT_FLOOR (0.90) — above cold, always.
// The first version dropped an overheated tyre to 0.72, BELOW cold (0.86) — the user called that
// out.
const TYRE_HOT_FLOOR = 0.90;
export function tyreGrip(temp: number, carSpec: Spec) {
  const [warm, tooHot] = carSpec.tyreOpt || [65, 110];
  const peak = carSpec.tyrePeak || 90;
  const cold = carSpec.tyreColdGrip ?? 0.86;
  if (temp <= warm) return cold + (0.97 - cold)
      * Math.max(0, (temp - TYRE_AMBIENT) / (warm - TYRE_AMBIENT));
  if (temp <= peak) return 0.97 + 0.03 * (temp - warm) / (peak - warm);
  if (temp <= tooHot) return 1;
  return Math.max(TYRE_HOT_FLOOR, 1 - (temp - tooHot) * 0.0015);
}          // bump stop: the most vertical load a landing can produce
export const AIR_DENSITY = 1.225;     // kg/m^3
const CY_SIDE = 1.0;           // sideforce coefficient with the flank to the wind
// rad/s band over which yaw damping fades in — NEVER make this a hard switch
const YAW_DAMP_BAND = 0.30;

// MEASURED (requirement: the rear wheels seem to fight turning too much now). At 1.35 the cap
// allowed 14.8 deg of lock at 20 m/s where the old hand-tuned falloff allowed 22 — a third less
// authority to rotate the car, which read as understeer. 1.75 restores the authority while still
// being derived from the grip limit rather than guessed.

// Lateral force from slip angle. Continuous everywhere. Initial slope is (pi/2)*D/aPeak = Ca, so
// small-slip behaviour is unchanged; the difference is entirely at and beyond the limit. The
// curve's shape factor, 0..1 of peak, as a function of slip angle. Shared by BOTH regimes — that is
// the whole point: the sliding branch takes its magnitude from this same curve, so the two laws
// agree by construction at every angle instead of stepping by up to 2.8x at the hand-over.
export function curveFactor(alpha: number, aPeak: number, slideGrip: number) {
  const normAlpha = Math.abs(alpha) / aPeak;
  if (normAlpha <= 1) return Math.sin((Math.PI / 2) * normAlpha);
  const base = 1 - (1 - slideGrip) * Math.min(1, (normAlpha - 1) / TUNE.falloff);
  // (A further fade at very large slip angles was tried and MEASURED to do nothing at all —
  // identical spin, grip and turn-in with it on and off — so it was deleted rather than left in
  // looking useful.)
  return base;
}

export function neutralInput(): CarInput {
  return { steer: 0, throttle: 0, brake: 0, handbrake: false, shiftUp: false, shiftDown: false };
}

export function makeCar(carId: string, mods = defaultMods()) {
  const carSpec = spec(carId);
  const car = {
    spec: carSpec,
    mods,
    surface: SURFACE_LAB,
    x: 0, y: 0,            // m, world
    vx: 0, vy: 0,          // m/s, world
    heading: 0,            // rad. 0 = +x. The lab spawns facing north (-y) => -PI/2.
    yawRate: 0,            // rad/s
    delta: 0,              // rad, current road-wheel angle (rate-limited)
    rpm: carSpec.idleRpm,
    gear: 1,               // 1..n forward, -1 reverse
    // driver aids: switchable, ON by default on cars that have them
    absOn: AIDS_DEFAULT.on && !!(carSpec.aids && carSpec.aids.abs),
    // TCS = traction (wheelspin) AND stability (slides) — one switch (user)
    tcsOn: AIDS_DEFAULT.on && !!(carSpec.aids && carSpec.aids.tcs),
    tcsK: 1, escCut: 1,
    shiftTimer: 0,
    aLongPrev: 0,          // last step's longitudinal accel, for weight transfer
    // lagged friction-circle scale, per axle hysteresis latches, so the spin state cannot chatter
    spinLatchF: 1, spinLatchR: 1,
    FyFlag: 0, FyRlag: 0,  // lateral force lagged by the tyre relaxation length
    revLatch: false,       // edge-detect on the reverse control
    gearLock: 0,           // s of lockout after a forward/reverse change, so the box cannot hunt
    // vertical: one spring per axle (body height + rate)
    zF: 0, zvF: 0, zR: 0, zvR: 0,
    // the ground under each axle, set by the lab
    groundF: 0, groundVF: 0, groundR: 0, groundVR: 0,
    z: 0, loadK: 1, air: 0,                       // derived readouts for the HUD and the renderer
    // false once a brake press has been held while moving — see reverse logic
    brakeArmed: true,
    // last step's front slip and its peak, for self-aligning torque
    slipFPrev: 0, aPeakFPrev: 0.12,
    align: 1, clutch: 1,   // smoothed self-align factor, and clutch take-up 0..1
    transfer: 0,           // N of longitudinal load transfer, lagged through the suspension
    spec0: { ...carSpec },       // pristine copy, so the debug panel can restore it
    reverseTimer: 0,
    autoBox: true,
    // telemetry — read by the dev overlay, the bench and the marks layer. Never drives physics.
    t: {
      vLong: 0, vLat: 0, slipF: 0, slipR: 0,
      FzF: 0, FzR: 0, FyF: 0, FyR: 0, FyMaxF: 0, FyMaxR: 0, FxF: 0, FxR: 0,
      loadKF: 1, loadKR: 1,
      satF: 0, satR: 0,                 // |Fy| / FyMax, 1.0 = sliding
      slidingF: false, slidingR: false,
      lockedF: false, lockedR: false,
      slipSpeedF: 0, slipSpeedR: 0,     // m/s at the contact patch — drives the marks
      // TRUE wheelspin: drive demand beyond grip, not just slip angle
      spinF: false, spinR: false,
      torque: 0, driveForce: 0, speed: 0,
      ax: 0, ay: 0,                     // body-frame accel, m/s^2. ay/g IS the lateral grip number.
    },
  } as Car;   // cast: reset below fills in wheelSpin, tyreT, groundInit, _p, prevWheels, ...
  reset(car);
  return car;
}

export function reset(car: Car, x = 0, y = 0, heading = -Math.PI / 2) {
  car._p = null;          // no render interpolation across a teleport (main.js)
  // ... and no WEAR across it. MEASURED BUG (requirement: dirt in the road on highway levels is
  // still a bug; tools/_dirtroad.mjs): lab.js stepWear sweeps each tyre from car.prevWheels to
  // where it is now, so after a teleport (an AI / traffic respawn, the highway put-back) it wore a
  // straight line from the old spot to the new one - across the verge AND the carriageway.
  car.prevWheels = null; car.wheelSurf = null;
  // ROLLOVER (roll.js): a reset puts the car back on its wheels
  car.roll = null; car.sparks = false;
  // tape stuck to the car goes with it (requirement: resetting should remove any tape)
  car.streamers = null;
  car.x = x; car.y = y;
  car.vx = 0; car.vy = 0;
  car.heading = heading;
  car.yawRate = 0; car.delta = 0;
  car.rpm = car.spec.idleRpm;
  car.gear = 1; car.shiftTimer = 0;
  car.aLongPrev = 0; car.reverseTimer = 0; car.transfer = 0;
  car.wheelSpin = 0;
  // a cold start (user): at the track's temperature (weather.ts; 18 C with no weather)
  const startC = WEATHER.trackC;
  car.tyreT = [startC, startC, startC, startC];
  car.slipFPrev = 0;
  car.aPeakFPrev = 0.12;
  car.align = 1;
  car.clutch = 1;
  car.brakeArmed = true;
  car.gearLock = 0;
  car.zF = 0;
  car.zvF = 0;
  car.zR = 0;
  car.zvR = 0;
  car.groundF = 0;
  car.groundVF = 0;
  car.groundR = 0;
  car.groundVR = 0;
  car.z = 0;
  car.groundInit = false;
  car.loadK = 1;
  car.air = 0;
  car.revLatch = false;
  car.FyFlag = 0;
  car.FyRlag = 0;
  car.spinLatchF = 1;
  car.spinLatchR = 1;
  const telemetry = car.t as Record<string, number | boolean | undefined>;
  for (const field in telemetry) if (typeof telemetry[field] === 'number') telemetry[field] = 0;
  else telemetry[field] = false;
}

// Torque at rpm from the car's curve, linearly interpolated. Off the ends, hold the end value.
export function torqueAt(carSpec: Spec, rpm: number) {
  const curve = carSpec.curve;
  if (rpm <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (rpm <= curve[i][0]) {
      const [rpmLo, torqueLo] = curve[i - 1], [rpmHi, torqueHi] = curve[i];
      return torqueLo + ((torqueHi - torqueLo) * (rpm - rpmLo)) / (rpmHi - rpmLo);
    }
  }
  return curve[curve.length - 1][1];
}

export const clamp = (value: number, low: number, high: number) => (
  value < low ? low : value > high ? high : value);

/**
 * Yaw moment the stability aid wants: against the yaw error outside the dead band, plus the pull
 * back from a slip angle past its limit.
 */
function escYawDemand(carSpec: Spec, err: number, dead: number, over: boolean, betaNow: number) {
  let want = 0;
  // UNDERSTEER correction (adding rotation) is GENTLE and fades out as slip builds. MEASURED: at
  // full gain the estate, floored on full lock at 45 km/h, went from pushing wide (3 deg) to a 16
  // deg slide WITH the aid on.
  if (Math.abs(err) > dead) {
    const escScale = over ? 1 : ESC.underK * Math.max(0, 1 - Math.abs(betaNow) / ESC.betaLim);
    want = -Math.sign(err) * (Math.abs(err) - dead) * ESC.gain * carSpec.Izz * escScale;
  }
  if (Math.abs(betaNow) > ESC.betaLim) want += Math.sign(betaNow)
      * (Math.abs(betaNow) - ESC.betaLim) * ESC.betaGain * carSpec.Izz;
  return want;
}

/**
 * Section 8 of step, stability half of TCS: the yaw moment and drag of the stability aid, and
 * the engine cut it asks for (stored in car.escCut). Returns zeros when the aid is idle.
 */
function stabilityControl(car: Car, carSpec: Spec, tick: AxleTick, handbrakeRaw: number,
    inReverse: boolean, vLong: number, vLat: number, vLongAbs: number, dirSign: number,
    delta: number, FzF: number, FzR: number) {
  const { mass, gravity, muBase, dt } = tick;
  let escMz = 0, escFx = 0, escWorking = false;
  // HANDBRAKE OVERRIDES STABILITY (user: holding the handbrake should be full force,
  // like the brake). While it is pulled, and for ESC.hbHold s after, the stability half stands down
  // — otherwise it straightens every handbrake turn the player asked for. Traction control
  // (wheelspin) is unaffected.
  car.hbAfter = handbrakeRaw > 0.1 ? ESC.hbHold : Math.max(0, (car.hbAfter || 0) - dt);
  if (car.tcsOn && !inReverse && vLongAbs > ESC.vMin && car.hbAfter <= 0) {
    // REFERENCE YAW = the car's OWN steady-state response, understeer included (linear bicycle
    // model: K = m/L x (lr/caF - lf/caR)). MEASURED BUG (requirement: TCS is too strong, making the
    // hatch RWD nearly undrivable): against the pure kinematic v.tan(delta)/L every road car
    // "understeered" in EVERY corner, so the aid ran 65% of a lap (3 of 4 s in a gentle
    // corner) cutting the engine and nudging the car.
    const Kus = (mass / carSpec.L) * (carSpec.lr / carSpec.caF - carSpec.lf / carSpec.caR);
    const yawCap = (muBase * gravity) / Math.max(5, vLongAbs);
    const yawRef = clamp((vLong * Math.tan(delta)) / (carSpec.L + Kus * vLong * vLong), -yawCap,
        yawCap);
    const err = car.yawRate - yawRef;
    // a wider band in big corners: act on REAL deviations
    const dead = ESC.dead + ESC.deadRel * Math.abs(yawRef);
    // SLIP FIRST. MEASURED BUG in the first cut: mid-slide the car rotates LESS than the wheel
    // asks, so a yaw-only controller "fixed understeer" by ADDING rotation — the RWD hatch's flick
    // went from 7 to 15 deg of slip with it on. Real systems watch body slip too: once the car is
    // sideways they only ever turn the nose back toward where it is going (sign of beta, as
    // aeroYaw), and the add-rotation (understeer) correction is allowed only while straight.
    const betaNow = Math.atan2(vLat, vLongAbs + 0.5);
    const over = Math.sign(err) === Math.sign(car.yawRate)
        && Math.abs(car.yawRate) > Math.abs(yawRef);
    const want = escYawDemand(carSpec, err, dead, over, betaNow);
    if (want !== 0) {
      const half = (carSpec.trackWidth || 1.5) / 2;
      const MzMax = muBase * ((FzF + FzR) / 4) * half;
      escMz = Math.sign(want) * Math.min(MzMax, Math.abs(want));
      escFx = -dirSign * Math.abs(escMz) / half;
      escWorking = true;
    }
    // the engine is cut only for OVERSTEER (a spin starting) or a real slide — never for mild
    // understeer
    const cutT = (over && Math.abs(err) > dead + ESC.cutAt) || Math.abs(betaNow) > ESC.betaLim * 1.5
        ? 0.3 : 1;
    car.escCut += (cutT - car.escCut) * Math.min(1, 12 * dt);
  } else car.escCut = 1;
  return { escMz, escFx, escWorking };
}

/**
 * Yaw section of step: aerodynamic directional stability, the tyre and ploughing yaw moment, and
 * the one-sided yaw damping. Updates car.yawRate.
 */
function integrateYaw(car: Car, carSpec: Spec, dt: number, axles: AxleOutcome, delta: number,
    vLong: number, vLat: number, FpyF: number, FpyR: number, escMz: number) {
  const { frontAxle, rearAxle } = axles;
  const cosDelta = Math.cos(delta), sinDelta = Math.sin(delta);
  // AERODYNAMIC DIRECTIONAL STABILITY, from geometry rather than a tuned constant.
  //
  // A car sliding at body-slip angle beta presents its flank to the airflow. The sideforce is
  //     Fy_aero = 0.5 * rho * A_side * Cy * v^2 * sin(beta)
  // and it acts at the aerodynamic centre of pressure, which on a road car sits BEHIND the centre
  // of mass — so it pushes the tail back into line. This is why real cars are directionally stable
  // at speed, and it is a first-order effect at 160 km/h, not a nicety.
  //
  // It is the ONLY stabiliser that grows with speed. Tyre yaw damping does the opposite: front and
  // rear slip angles differ by yawRate*L/v, which SHRINKS as speed rises — measured at 45 m/s in a
  // full slide, slipF and slipR were within 0.4 deg of each other, so the tyres were contributing
  // almost no damping at all. With nothing growing to oppose the destabilising weight-transfer
  // moment, every car spun above ~40 m/s. Its absence was the bug.
  // m^2 of flank, x the car's own aero (a wing, a spoiler)
  const A_SIDE = carSpec.len * 1.35 * (carSpec.aeroK || 1) * (TUNE.aeroMul || 1);
  const CP_BEHIND_CG = carSpec.len * 0.15;        // m, centre of pressure aft of the CG
  const betaBody = Math.atan2(vLat, Math.abs(vLong) + 0.5);
  const vSq = vLong * vLong + vLat * vLat;
  // sign: steering right gives POSITIVE yaw and NEGATIVE beta here, so realigning the nose with the
  // velocity vector needs a moment carrying beta's sign. Had this inverted first time and it fed
  // the spin instead of arresting it.
  const aeroYaw = 0.5 * AIR_DENSITY * A_SIDE * CY_SIDE * vSq * Math.sin(betaBody) * CP_BEHIND_CG;

  // The ploughing terms enter the yaw moment at their own axle, which is where the straightening
  // comes from — nothing is added to make gravel stabilising, it just is.
  const yawMoment = carSpec.lf * (frontAxle.Fy * cosDelta + frontAxle.Fx * sinDelta) - carSpec.lr
      * rearAxle.Fy + aeroYaw + carSpec.lf * FpyF - carSpec.lr * FpyR + escMz + (car.slopeYaw || 0);
  car.yawRate += (yawMoment / carSpec.Izz) * dt;

  // Yaw damping. MEASURED: a flick-and-release handbrake turn reached 92 deg, then swung
  // BACK through centre at -1.4 rad/s and oscillated (92 -> 7 -> 37 deg). The bicycle model has no
  // tyre relaxation length and no suspension compliance, both of which damp yaw on a real car, so
  // the rotation had nothing to settle it and the car behaved like a pendulum. This term stands in
  // for them. Deliberately small — enough to settle the oscillation, not enough to stop a drift.
  // MEASURED: damping yawRate ABSOLUTELY cost 40% of the steady-state cornering rate
  // (0.29 rad/s against a grip-limited 0.49), which the user felt as "the rear wheels fight
  // turning". Real damping opposes CHANGE, not steady cornering. Damp the deviation from the turn
  // rate the steering is actually asking for, so a held corner is untouched while a pendulum or a
  // spin is still arrested. ONE-SIDED. Damping toward yawRef symmetrically was worse than the
  // original: when yawRate was BELOW the commanded rate it ADDED yaw, forcing the car to follow the
  // steering angle regardless of grip — measured 1.22 rad/s against a grip-limited maximum of 0.49.
  // It may only ever oppose yaw the car has in EXCESS of what the steering asked for, which is the
  // spin/pendulum case and nothing else.
  //
  // AND IT MUST BE CONTINUOUS. MEASURED BUG, (requirement: the track spec car seems juddery): the
  // sign test above was a HARD SWITCH, so when the yaw rate sat near the commanded rate it
  // flipped every few steps and applied/removed a finite impulse each time. Dumped on the track
  // car: yaw acceleration going -0.41 -> +1.88 -> -0.26 in SINGLE steps, repeating every ~5 steps,
  // while slip angles and tyre forces evolved perfectly smoothly through it. Max jerk 268 against
  // 4-13 for every other car; the track car triggered it because its grip is highest, so yawRate
  // and yawRef sit closest together. A discontinuous force is always a judder — fade it in over a
  // band so it is zero at the boundary.
  const yawRef = clamp((vLong * Math.tan(delta)) / carSpec.L, -3, 3);
  const over = Math.abs(car.yawRate) - Math.abs(yawRef);
  const ramp = clamp(over / YAW_DAMP_BAND, 0, 1);
  if (ramp > 0) car.yawRate -= car.yawRate * ramp * (car.yawDampOverride ?? TUNE.yawDamp) * dt;
}

/**
 * Section 9 of step: the low-speed blend toward the kinematic yaw rate and the rest snap, with
 * steep ground allowed to keep a stopped car moving. Returns the body velocity after the blend.
 */
function lowSpeedBlend(car: Car, carSpec: Spec, mass: number, gravity: number, delta: number,
    throttle: number, inVLong: number, inVLat: number) {
  // low-speed blend. Without this the car shivers and creeps at a standstill and it reads
  //         as a bug in the friction model (PLAN.md "What would count as wrong").
  //
  // MEASURED BUG: this was gated on |vLong| while it zeroes vLat. A car sliding
  // sideways at 10 m/s with only 1.2 m/s of FORWARD speed satisfied the gate, so the blend deleted
  // the slide — 10.1 m/s to 0 in 0.1 s (10 g) at the end of every handbrake turn. Gate on the TOTAL
  // planar speed; that is the quantity that does not vanish when the car is sideways (CLAUDE.md
  // rule 9).
  let vLong = inVLong, vLat = inVLat;
  const speed = Math.hypot(vLong, vLat);
  // STEEP GROUND MOVES A STOPPED CAR (requirement: super steep angles should still move / push /
  // pull the car even when parked or moving). The blend and the rest-snap below exist so a car does
  // not shiver on FLAT ground; they used to hold it on any slope too. Now: it ROLLS along
  // its length once the slope pull beats what a car in gear holds (SLOPE_ROLL g), and SLIDES
  // sideways on genuinely steep ground (SLOPE_SLIDE g).
  const mgS = mass * gravity;
  const rollFree = Math.abs(car.slopeLong || 0) > SLOPE_ROLL * mgS;
  const slideFree = Math.abs(car.slopeLat || 0) > SLOPE_SLIDE * mgS;
  if (speed < LOWSPEED_BLEND) {
    const blend = 1 - speed / LOWSPEED_BLEND;              // 1 at rest, 0 at the blend speed
    const kinYaw = (vLong * Math.tan(delta)) / carSpec.L;
    car.yawRate += (kinYaw - car.yawRate) * blend * 0.5;
    if (!slideFree) vLat += (0 - vLat) * blend * 0.5;
  }
  if (speed < REST_SPEED && throttle < 0.05 && !rollFree && !slideFree) {
    vLong = 0; vLat = 0; car.yawRate *= 0.5;
  }
  return { vLong, vLat };
}

/**
 * Telemetry section of step: publish this step's forces, slips and aid activity on car.t, and
 * remember the slip angle and peak for the next step.
 */
function writeTelemetry(car: Car, carSpec: Spec, tick: AxleTick, axles: AxleOutcome,
    vLong: number, vLat: number, slipF: number, slipR: number, loadKF: number, loadKR: number,
    absWorking: boolean, escWorking: boolean, handbrake: number, torque: number,
    driveForce: number, accelLong: number, accelLat: number, delta: number) {
  //      slipSpeed comes straight out of the axle function — it is the magnitude of the contact
  //      patch's slip velocity, which is exactly what the marks layer and the squeal need. Do not
  //      re-derive it here; two derivations of one quantity is how they drift apart.
  const telem = car.t;
  const { muBase } = tick;
  const { frontAxle, rearAxle, lockedF, lockedR, FzF, FzR } = axles;
  telem.vLong = vLong; telem.vLat = vLat;
  telem.slipF = slipF; telem.slipR = slipR;
  car.slipFPrev = slipF;
  car.aPeakFPrev = Math.max(ALPHA_PEAK_MIN,
      (muBase * FzF * car.mods.gripLat / (carSpec.caF * car.mods.gripLat)) * TUNE.alphaPeakK);
  telem.FzF = FzF; telem.FzR = FzR;
  // per-axle suspension load: which END is light is the story
  telem.loadKF = loadKF; telem.loadKR = loadKR;
  telem.FyF = frontAxle.Fy;
  telem.FyR = rearAxle.Fy;
  telem.FyMaxF = frontAxle.FyMax;
  telem.FyMaxR = rearAxle.FyMax;
  telem.FxF = frontAxle.Fx; telem.FxR = rearAxle.Fx;
  telem.satF = frontAxle.sat; telem.satR = rearAxle.sat;
  telem.slidingF = frontAxle.sliding; telem.slidingR = rearAxle.sliding;
  const drivenAxle = carSpec.drive >= 0.99 ? frontAxle : carSpec.drive <= 0.01 ? rearAxle : null;
  telem.slipSpeedDriven = drivenAxle ? (drivenAxle.spinning ? drivenAxle.slipSpeed : 0)
      : Math.max(frontAxle.spinning ? frontAxle.slipSpeed : 0, rearAxle.spinning
          ? rearAxle.slipSpeed : 0);
  telem.spinF = frontAxle.spinning; telem.spinR = rearAxle.spinning;
  // aid activity for the HUD chips (they flash while working — the silent twin, the phone may be
  // muted)
  telem.absWorking = absWorking; telem.tcsWorking = escWorking || car.tcsK < 0.95;
  telem.lockedF = lockedF; telem.lockedR = lockedR || (handbrake > 0.5 && rearAxle.sliding);
  telem.slipSpeedF = frontAxle.slipSpeed;
  telem.slipSpeedR = rearAxle.slipSpeed;
  telem.torque = torque; telem.driveForce = driveForce;
  telem.ax = accelLong; telem.ay = accelLat;
  telem.speed = Math.hypot(car.vx, car.vy);
  telem.delta = delta; telem.gear = car.gear; telem.rpm = car.rpm;
}

/**
 * Force sum of step: drag, rolling resistance, the axle and ploughing forces, stability drag and
 * slopes, resolved in the body frame and divided by mass. Returns the body accelerations.
 */
function bodyAccelerations(car: Car, carSpec: Spec, mass: number, gravity: number, delta: number,
    vLong: number, vLongAbs: number, dirSign: number, axles: AxleOutcome,
    plough: { FpxF: number; FpyF: number; FpxR: number; FpyR: number }, escFx: number) {
  const { frontAxle, rearAxle } = axles;
  const { FpxF, FpyF, FpxR, FpyR } = plough;
  const cosDelta = Math.cos(delta), sinDelta = Math.sin(delta);
  // dragMul: the slipstream (contact.js), 1 when alone
  const drag = -carSpec.dragC * (car.dragMul ?? 1) * vLong * vLongAbs;
  // DAMAGE: a wheel off drags its corner
  const roll = vLongAbs < 0.05 ? 0
      : -carSpec.rollC * mass * gravity * dirSign * (car.wreck ? car.wreck.roll : 1);
  const Fxbody = frontAxle.Fx * cosDelta - frontAxle.Fy * sinDelta + rearAxle.Fx + drag + roll
      + FpxF + FpxR + escFx + (car.slopeLong || 0);
  const Fybody = frontAxle.Fy * cosDelta + frontAxle.Fx * sinDelta + rearAxle.Fy + FpyF + FpyR
      + (car.bankLatForce || 0) + (car.slopeLat || 0);
  const accelLong = Fxbody / mass;
  const accelLat = Fybody / mass;
  return { accelLong, accelLat };
}

/**
 * Position section of step: remembers the longitudinal acceleration, turns the heading and
 * projects the body velocity back to world x/y before moving the car.
 */
function advanceCar(car: Car, dt: number, vLong: number, vLat: number, accelLong: number) {
  car.aLongPrev = accelLong;
  car.heading += car.yawRate * dt;
  // The body-frame equations above already carry the frame rotation (the centripetal terms), so the
  // components they produce belong to the END-of-step body frame — they must be projected back with
  // the END heading, not the start one. The old code used the pre-rotation basis and so
  // under-rotated the velocity vector by yawRate*dt EVERY step. Harmless going straight; a
  // systematic error exactly when the car is rotating fast, i.e. in the slides that felt wrong.
  const ch2 = Math.cos(car.heading), sh2 = Math.sin(car.heading);
  car.vx = vLong * ch2 - vLat * sh2;
  car.vy = vLong * sh2 + vLat * ch2;
  car.x += car.vx * dt;
  car.y += car.vy * dt;
}

export function step(car: Car, input: CarInput, dt = PHYSICS_STEP_SECONDS) {
  const carSpec = car.spec;
  const mass = carSpec.mass * car.mods.mass;
  const gravity = GRAVITY;

  // ---- 1. to body frame
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  let vLong = car.vx * cosH + car.vy * sinH;
  let vLat = -car.vx * sinH + car.vy * cosH;

  // ---- 2. steering
  const delta = steerFrontWheels(car, carSpec, input, dt);

  // ---- powertrain: reverse engagement (A5), shifting, rpm
  const { handbrakeRaw, inReverse, throttle, brakeIn, totalRatio } = runPowertrain(
      car, carSpec, input, vLong, dt);

  // ---- 3. slip angles (guarded divide — rule 20)
  const vLongAbs = Math.abs(vLong);
  const dirSign = vLong === 0 ? 1 : Math.sign(vLong);
  const slipF = Math.atan2(vLat + car.yawRate * carSpec.lf, vLongAbs + EPS_SLIP) - delta * dirSign;
  const slipR = Math.atan2(vLat - car.yawRate * carSpec.lr, vLongAbs + EPS_SLIP);

  // ---- 4. vertical loads
  const { loadKF, loadKR, FzF, FzR } = computeAxleLoads(
      car, carSpec, mass, gravity, vLong, vLat, dt);

  // ---- 5. longitudinal demand per axle
  let { torque, driveForce, FxDriveF, FxDriveR, FbF, FbR, brakeSign, FxBrakeF, FxBrakeR } =
      computeLongitudinalDemand(car, carSpec, mass, gravity, vLong, vLongAbs, dirSign, inReverse,
          throttle, brakeIn, totalRatio, dt);

  // handbrake locks the rear outright 0..1, not a boolean: the handbrake is modulated (see
  // input.js). still means full, so the headless benches and any older caller keep working.
  const handbrake = handbrakeRaw;


  // ---- 6/7. per-axle tyre force.
  const { tick, axles, absWorking } = computeAxleForces(car, carSpec, mass, gravity, dt, delta,
      vLong, vLat, vLongAbs, dirSign, slipF, slipR, brakeIn, FzF, FzR, FbF, FbR, FxBrakeF, FxBrakeR,
      brakeSign, handbrake, FxDriveF, FxDriveR);

  // ---- 7b. PLOUGHING (see ploughingForces)
  const ploughF = ploughingForces(
      car, carSpec, mass, vLong, vLat, loadKF, loadKR);

  // ---- 8. integrate TCS, STABILITY HALF (user: one TCS switch covers wheelspin AND
  // slides). Real stability control brakes ONE wheel to make a yaw moment; this model has one tyre
  // per axle, so it applies that moment directly — capped at what one wheel braked at its grip
  // limit could give (mu x a quarter of the load x half the track) — plus the matching drag of that
  // brake, and cuts the engine while the car is rotating more than the wheel asks for.
  const { escMz, escFx, escWorking } = stabilityControl(car, carSpec, tick, handbrakeRaw,
      inReverse, vLong, vLat, vLongAbs, dirSign, delta, FzF, FzR);
  const { accelLong, accelLat } = bodyAccelerations(car, carSpec, mass, gravity, delta, vLong,
      vLongAbs, dirSign, axles, ploughF, escFx);

  vLong += (accelLong + car.yawRate * vLat) * dt;
  vLat += (accelLat - car.yawRate * vLong) * dt;
  integrateYaw(car, carSpec, dt, axles, delta, vLong, vLat, ploughF.FpyF, ploughF.FpyR, escMz);

  // ---- 9. low-speed blend (see lowSpeedBlend)
  ({ vLong, vLat } = lowSpeedBlend(car, carSpec, mass, gravity, delta, throttle, vLong, vLat));

  // ---- tyre temperatures (see TYRE TEMPERATURE at the top)
  updateTyreTemps(car, carSpec, tick, axles, vLong, vLat, accelLat);

  advanceCar(car, dt, vLong, vLat, accelLong);

  // ---- telemetry (see writeTelemetry)
  writeTelemetry(car, carSpec, tick, axles, vLong, vLat, slipF, slipR, loadKF, loadKR,
      absWorking, escWorking, handbrake, torque, driveForce, accelLong, accelLat, delta);

  return car;
}

// Assert finite on everything that can kill the renderer (rule 20). Called from main.js under
// ?dev=1 and from the bench unconditionally. A silent NaN is a vanished car.
export function assertFinite(car: Car) {
  const state = [car.x, car.y, car.vx, car.vy, car.heading, car.yawRate, car.rpm, car.delta];
  for (let i = 0; i < state.length; i++) {
    if (!Number.isFinite(state[i])) {
      throw new Error(`vehicle: non-finite state [${[
        'x', 'y', 'vx', 'vy', 'heading', 'yawRate', 'rpm', 'delta',
      ][i]}] = ${state[i]}`);
    }
  }
}

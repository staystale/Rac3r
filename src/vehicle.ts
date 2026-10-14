// vehicle.js — THE MODEL.
//
// Knows nothing about upgrades, cones, rendering or archetypes. PURE: no DOM, no canvas, no imports
// beyond cars.js data — tools/probe.mjs imports this file directly in node and must keep working.
// Everything tunable comes through `mods` (CLAUDE.md rule 6); every mod defaults to 1.0.
//
// Fixed step, ALWAYS. Never hand this function a frame delta (CLAUDE.md §8 / rule 4): tyre friction
// near the grip limit is stiff, and at 60Hz / 40m/s the car moves 0.67m per step and never feels
// the lateral force it should have. main.js accumulates into DT-sized calls.
//
// Bicycle model, per-axle friction ellipse. Body-frame integration with centripetal terms, which is
// more stable near the limit than integrating in world frame and rotating back.

import { GRAVITY, defaultMods, SURFACE_LAB, spec } from './cars.ts';
import type { Mods, Spec, Surface } from './cars.ts';

// What step() reads from the input: steer -1..1, pedals 0..1, handbrake (on/off or 0..1), manual
// shifts, reverse pedal.
export interface CarInput {
  steer: number; throttle: number; brake: number;
  handbrake: boolean | number; shiftUp?: boolean; shiftDown?: boolean;   // shifts: manual box only
  reverse?: number;
}

// The car.t telemetry (read by the dev overlay, the bench and the marks layer; never drives
// physics). The last two lines are not in makeCar's literal: step() adds those fields.
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

// The damage state vehicle.ts reads (damage.js sets car.wreck; multipliers, 1 = undamaged).
export interface CarWreck { toe: number; power: number; roll: number; gripF: number; gripR: number }
// The rollover state (roll.js): vehicle.ts only nulls it.
export interface CarRoll { phase: string }
// Render position of the last frame (main.js, traffic.ts): vehicle.ts only nulls it.
export interface CarPrev { x: number; y: number; h: number }
// A wheel position from last step (world/wear.ts): vehicle.ts only nulls the list.
export interface CarWheelPos { x: number; y: number }
// Tape stuck to the car (cones.js): vehicle.ts only nulls the list.
export interface CarStreamer { born: number }

// The car: everything makeCar's literal creates, what reset() adds, and what other files set on it.
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
  // added by reset(), which makeCar calls right after building the literal
  wheelSpin: number; tyreT: number[]; groundInit: boolean;
  _p: CarPrev | null; prevWheels: CarWheelPos[] | null;
  roll: CarRoll | null; sparks: boolean; streamers: CarStreamer[] | null;
  // set by world/wear.ts (the slope and bank forces under the car)
  slopeLong?: number; slopeLat?: number; slopeYaw?: number;
  bankLatForce?: number; bankLoadFactor?: number;
  // set by contact.js (the slipstream) and by vehicle.ts itself (the handbrake hold)
  dragMul?: number; hbAfter?: number;
  // set by damage.js
  wreck?: CarWreck;
  // set by tools / the debug panel only
  yawDampOverride?: number;
}

export const DT = 1 / 120;

// slip-angle divide guard (CLAUDE.md rule 20). Stationary is frame 1 of every run.
const EPS_SLIP = 0.5;
const STEER_RATE = 8.0;        // rad/s at the road wheel (~458 deg/s; full lock in 70 ms)
const STEER_MAX = 0.56;        // 32 deg parked
const LOWSPEED_BLEND = 1.5;    // m/s, below which we lerp toward a kinematic result
const REST_SPEED = 0.15;       // m/s, below which we snap to rest with no throttle
// g of slope pull along the car before a stopped car rolls (what being in gear holds)
const SLOPE_ROLL = 0.06;
// g of slope pull across the car (~19 deg) before a stopped car slides sideways
const SLOPE_SLIDE = 0.35;
const REVERSE_HOLD = 0.40;     // s of brake at a standstill to engage reverse (A5)


// ---------------------------------------------------------------------------------------------
// THE TYRE CURVE. Replaced the linear-plus-hard-clamp law on 2026-09-27, after the user reported
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
  // 0.90 — SWEPT, 2026-09-27. Handbrake at 28 m/s with the lock HELD: 0.00 and 0.55 both spun all
  // five cars backwards; 0.75 fixed four of five; 0.90 fixed all five (worst 76 deg, none
  // backwards) and left ordinary cornering yaw UNCHANGED at 0.343 rad/s. It costs nothing in normal
  // driving.
  selfAlign: 0.90,      // how much lock the front gives back once past its grip peak (0 = none)
  handbrakeForce: 1.15, // rear brake demand as a multiple of rear grip. >1 locks; below 1 it only
                        // drags, so this is a real STRENGTH rather than an on/off switch.
};
// min (1 - use^2) under the friction ellipse — never let lateral hit 0
const ELLIPSE_FLOOR = 0.10;
// REVERTED to effectively a switch, 2026-09-27. Cross-fading the rolling and sliding laws over a
// 0.30 band DID kill the track car judder (max jerk 457 -> 210) but wrecked the thing the slice
// exists for: a handbrake flick went from 49 deg keeping 75% of its speed to 101 deg keeping 27%
// and running backwards. The two laws simply do not agree near the boundary — the ellipse sends
// lateral capacity toward zero while the sliding law gives full lateral — so blending them averages
// two answers that are both wrong in the middle. Measure, then KEEP OR REVERT; this one reverts.
// The judder is chased separately rather than paid for with the drift.
const SLIDE_BLEND = 0.001;

// leave the wheelspin state only below this much of grip — hysteresis
const SPIN_EXIT = 0.85;
const CIRCLE_TAU = 0.06;       // s to hand the friction budget between directions — see the circle
// Suspension rate and damping are PER CAR, in cars.js (susF / susZ) — see the note there.
const LOAD_MAX = 2.6;
// TYRE TEMPERATURE (user, 2026-10-03). Four tyres, each its own temperature (deg C), indexed by
// side of the BODY:
//   0 front +y, 1 front -y, 2 rear +y, 3 rear -y.
// HEAT IN = the friction work at the contact patch (force x slip speed), per axle, split left/right
// by the lateral load transfer — so cornering loads (and heats) the OUTSIDE pair, wheelspin heats
// only the DRIVEN axle (FWD / RWD / 4WD differ by construction), and the axle doing more cornering
// work heats more. HEAT OUT = toward ambient at TYRE_COOL + TYRE_AIR * speed, plus the surface's
// own coolK (grass, snow, ice, mud, wet cool tyres; tarmac does not) — data on the surface, so this
// file still knows no surface by name.
// GRIP: only on a HARD surface (surface.hard), a tyre outside its working window grips less;
// off-road grip ignores temperature, as in real life (user). Per-car window: spec.tyreOpt [lo, hi],
// spec.tyreColdGrip. Tyres start COLD (ambient) on every reset (user: "cold, warm them up").
export const TYRE_AMBIENT = 18;    // deg C until weather exists
// deg C a tyre is held at; a burst replaces this once damage exists
export const TYRE_T_MAX = 260;
// 3500, was 2200 — user, 2026-10-03: "temp seems a bit easy to build in tyres, it should be a bit
// harder". With the cooling also x0.8 below, warming takes ~2x as long and settles a little cooler.
// Measured in tools/tyrecheck.mjs. HARD TO OVERHEAT (user, 2026-10-03: "tyres heat up too easy and
// pass the good range too easy — it should take long burnouts to pop them and excessive drifting on
// tarmac to overheat; off-road surfaces shouldn't get them up much"). MEASURED before
// (tools/tyrecheck.mjs section 7, hatch-rwd): a tarmac drift went warm 1.3 s / too hot 2.3 s / 260
// C in 8 s — FASTER than a pinned burnout (260 C in 20 s) — and a gravel drift reached 260 C in 14
// s. Sliding heat was force x slip speed with no limit and no surface factor. Three physical
// changes, each a number here or on the surface:
//   slipSat: above a few m/s of slip, extra slip heats the ROAD more than the rubber (tanh
//            saturation)
//   roadV:   sliding over FRESH road dumps heat into it; the tyre's share is
//            1 / (1 + ground speed / roadV). A pinned burnout (speed 0) keeps it all — so
//            burnouts pop, drifts only overheat. Rolling scrub is unaffected.
//   surface.heatK (lab.js): on loose ground the slip is IN the ground — the tyre gets
//            HEAT_OFFROAD of it
// Swept 48 combinations (tools/_tyresweep, deleted); the only one meeting every target is below.
// MEASURED after:
//   burnout   too hot 18 s, 260 C 57 s      drift   warm 13 s, too hot 27 s, never 260 C in 90 s
//   gravel drift 25 C at 30 s               clean cornering warm at 80 s (unchanged)
export const TYRE_HEAT = { cap: 3500, slipSat: 4, air: 0.0008, roadV: 12, massRef: 1440 };
// Flex heat toward T (deg C, inside every car's working window) at k per s per unit of axle
// utilisation. See the tyre-temperature block in step(). Added 2026-10-03; measured results are in
// tools/tyrecheck.mjs sections 2 / 2a / 7.
export const TYRE_FLEX = { k: 0.07, T: 85, vRef: 12 };
// Engine braking at the redline, in g of the car's weight (falls with revs). See step 5 in step().
// MEASURED 100 -> 50 km/h lift-off: hatch 47.5 s -> 13.3 s, muscle 36.9 -> 10.3, track 30.4 -> 9.8
// (0.12 g: 17.4 s; 0.25 g: 10.6 s).
let ENGINE_BRAKE = 0.18;
export const setEngineBrake = (value: number) => { ENGINE_BRAKE = value; };   // for tools only
// DRIVER AIDS (2026-10-03, step 2). See ABS / TCS in step(). Measured results in
// tools/aidcheck.mjs. Tools that measure RAW tyre / surface physics (burnouts, wheelspin, locked
// passes) create cars with the aids OFF: with TCS on, a burnout is not a burnout. The game itself
// never calls this.
const AIDS_DEFAULT = { on: true };
export const setAidsDefault = (enabled: boolean) => { AIDS_DEFAULT.on = !!enabled; };
// VERTICAL GRAVITY multiplier for the suspension / airtime only (grip and weight still use g). See
// the measured note at the suspension. Exported setter for tools. 1 -> 1.4 (user, 2026-10-03: "I
// seem to get airborne slightly too easily / stay in the air too long"). MEASURED: all airtime in
// normal laps came from the Test Track table (hatch 0.79 s, track car 1.17 s at 90 km/h). More
// DAMPING made it WORSE (the damper ties the body to the lip's upward speed). Heavier vertical
// gravity shortens flight AND raises the speed a crest needs to launch you: x1.4 -> hatch 0.79 ->
// ~0.5 s, whoops 0.75 -> ~0.4 s. Grip and weight still use g.
let VERT_G = 1.4;
export const setVertG = (scale: number) => { VERT_G = scale; };
const ABS_K = 0.92;        // brake capped at this fraction of the grip left after cornering
// m/s of driven-wheel spin (or 10% of road speed if more) before the traction half cuts
const TCS_SPIN = 1.2;
// vMin 5 -> 10 m/s: MEASURED, at 5 m/s on full lock the body slip is ~14 deg of pure GEOMETRY, the
// slip term chased it and the judder bench slow corner went 0 -> 11 flips/s on the RWD hatch.
// betaLim rad (~4 deg) of body slip stability half: rad/s dead band, 1/s gain, throttle cut
const ESC = { dead: 0.10, deadRel: 0.25, gain: 6, cutAt: 0.10, vMin: 10, betaLim: 0.07,
    betaGain: 20, underK: 0.2, hbHold: 0.6 };
// MEASURED 2026-10-03 (tools/tyrecheck.mjs): 0.020 + 0.0022/(m/s) cooled with a ~17 s time
// constant, so a clean 0.8 g corner held 30 s only reached 30 C. Real tyres hold heat for minutes:
// 0.010 + 0.0010.
// 1/s toward ambient, always (0.010 before the "harder to build" pass)
const TYRE_COOL = 0.008;
// THE GRIP CURVE (user, 2026-10-03: "cold tyres are sloppier than warm tyres, hot tyres grippier
// still; tyres that are too hot are less grippy than hot but still grippier than cold — keep it
// realistic"):
//   ambient (cold) ..... tyreColdGrip (0.86)
//   tyreOpt[0] (warm) .. 0.97          rising linearly from cold
//   tyrePeak .......... 1.00          hot: the peak band, tyrePeak[0]..tyreOpt[1]
//   above tyreOpt[1] ... falls 0.15%/C, FLOORED at TYRE_HOT_FLOOR (0.90) — above cold, always.
// The first version dropped an overheated tyre to 0.72, BELOW cold (0.86) — the user called that
// out.
const TYRE_HOT_FLOOR = 0.90;
export function tyreGrip(temp: number, spec: Spec) {
  const [warm, tooHot] = spec.tyreOpt || [65, 110];
  const peak = spec.tyrePeak || 90;
  const cold = spec.tyreColdGrip ?? 0.86;
  if (temp <= warm) return cold + (0.97 - cold)
      * Math.max(0, (temp - TYRE_AMBIENT) / (warm - TYRE_AMBIENT));
  if (temp <= peak) return 0.97 + 0.03 * (temp - warm) / (peak - warm);
  if (temp <= tooHot) return 1;
  return Math.max(TYRE_HOT_FLOOR, 1 - (temp - tooHot) * 0.0015);
}          // bump stop: the most vertical load a landing can produce
// PLOUGHING (loose surfaces). See step 7b.
// sideways bulldozing vs forwards. Going in sideways digs in far harder.
const PLOUGH_LAT = 2.2;
const PLOUGH_VREF = 14;        // m/s at which ploughing reaches full strength
// fraction of full force still there at walking pace, so you get STUCK
const PLOUGH_CRAWL = 0.55;
const RELAX_LEN = 0.55;        // m of rolling before a tyre develops its lateral force
const AIR_DENSITY = 1.225;     // kg/m^3
const CY_SIDE = 1.0;           // sideforce coefficient with the flank to the wind
const CLUTCH_RELEASE = 0.12;   // s to cut drive at the start of a shift
                               // the track car judder 33 -> 27; 0.20 only reached 25, so the clutch
                               // is no longer the dominant term. Total since the first report: 413
                               // -> 27.
// s for the clutch to take up after a shift — NEVER restore torque in one step
const CLUTCH_TAKEUP = 0.11;
// rad/s band over which yaw damping fades in — NEVER make this a hard switch
const YAW_DAMP_BAND = 0.30;
const ALPHA_PEAK_MIN = 0.10;   // rad (~5.7 deg); never peak earlier than this

// MEASURED 2026-09-27 (user: "the rear wheels seem to fight turning too much now"). At 1.35 the cap
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
  } as Car;   // cast: reset() below fills in wheelSpin, tyreT, groundInit, _p, prevWheels, ...
  reset(car);
  return car;
}

export function reset(car: Car, x = 0, y = 0, heading = -Math.PI / 2) {
  car._p = null;          // no render interpolation across a teleport (main.js)
  // ... and no WEAR across it. MEASURED BUG (user, 2026-10-06: "dirt in the road on highway levels
  // is still a bug"; tools/_dirtroad.mjs): lab.js stepWear sweeps each tyre from car.prevWheels to
  // where it is now, so after a teleport (an AI / traffic respawn, the highway put-back) it wore a
  // straight line from the old spot to the new one - across the verge AND the carriageway.
  car.prevWheels = null;
  // ROLLOVER (roll.js): a reset puts the car back on its wheels
  car.roll = null; car.sparks = false;
  // tape stuck to the car goes with it (user: "resetting should remove any tape")
  car.streamers = null;
  car.x = x; car.y = y;
  car.vx = 0; car.vy = 0;
  car.heading = heading;
  car.yawRate = 0; car.delta = 0;
  car.rpm = car.spec.idleRpm;
  car.gear = 1; car.shiftTimer = 0;
  car.aLongPrev = 0; car.reverseTimer = 0; car.transfer = 0;
  car.wheelSpin = 0;
  car.tyreT = [TYRE_AMBIENT, TYRE_AMBIENT, TYRE_AMBIENT, TYRE_AMBIENT];   // cold start (user)
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
export function torqueAt(spec: Spec, rpm: number) {
  const curve = spec.curve;
  if (rpm <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (rpm <= curve[i][0]) {
      const [rpmLo, torqueLo] = curve[i - 1], [rpmHi, torqueHi] = curve[i];
      return torqueLo + ((torqueHi - torqueLo) * (rpm - rpmLo)) / (rpmHi - rpmLo);
    }
  }
  return curve[curve.length - 1][1];
}

function ratio(spec: Spec, gear: number) {
  if (gear < 0) return spec.reverseRatio;
  // CLAMPED. An out-of-range gear returns undefined, which makes the total ratio NaN, which makes
  // every force NaN, which makes the car vanish — and it does so SILENTLY (rule 20). Found when a
  // harness set gear 5 on the four-speed muscle car. The auto box cannot do this, but nothing else
  // was stopping it.
  const index = Math.max(1, Math.min(spec.gears.length, gear | 0));
  return spec.gears[index - 1];
}

const clamp = (value: number, low: number, high: number) => (value < low ? low : value > high ? high
    : value);

export function step(car: Car, input: CarInput, dt = DT) {
  const carSpec = car.spec;
  const mass = carSpec.mass * car.mods.mass;
  const gravity = GRAVITY;
  const telem = car.t;

  // ---- 1. to body frame
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  let vLong = car.vx * cosH + car.vy * sinH;
  let vLat = -car.vx * sinH + car.vy * cosH;

  // ---- 2. steering: front wheels turn and match player input directly regardless of speed or grip
  // per-car LOCK (spec.steerMax: the drift car's angle kit); every other car the shared STEER_MAX
  const deltaTarget = clamp(input.steer, -1, 1) * (carSpec.steerMax || STEER_MAX);
  const dDelta = clamp(deltaTarget - car.delta, -STEER_RATE * dt, STEER_RATE * dt);
  car.delta += dDelta;
  // DAMAGE (damage.js): a bent front corner toes the wheels — the car pulls (car.wreck: no-op when
  // undamaged)
  const delta = car.delta + (car.wreck ? car.wreck.toe : 0);

  // ---- powertrain: reverse engagement (A5), shifting, rpm
  //
  // MEASURED BUG, 2026-09-27 (user: "braking still causes you to go backwards"). Holding the brake
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
  // HOLD R TO REVERSE (user, 2026-10-03: the guide card said "Hold R to reverse" and the user ruled
  // "it should work how the card says and the game is wrong"). It WAS a toggle, and in reverse the
  // pedals swapped (BRAKE drove you backwards, GAS braked). Now R is its own pedal, 0..1, ramped
  // like GAS (input.js), and NO PEDAL EVER SWAPS:
  //   R held, rolling forward  -> R brakes, then reverse engages below 1 m/s and R drives you
//                               backwards
  //   R released               -> coast; back to a forward gear once nearly stopped
  //   GAS while rolling back   -> brakes, then forward drive below 1 m/s
  //   BRAKE                    -> always brakes. It can never select reverse, so the old bug
//                               cannot return.
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

  const inReverse = car.gear < 0;
  const throttle = inReverse ? rawRev : (rawRev > 0.05 ? 0 : rawThrottle);
  const brakeIn = inReverse ? Math.max(rawBrake, rawThrottle) : Math.max(rawBrake, rawRev);

  if (car.shiftTimer > 0) car.shiftTimer = Math.max(0, car.shiftTimer - dt);
  const gearRatio = ratio(carSpec, car.gear);
  const totalRatio = Math.abs(gearRatio) * carSpec.finalDrive;

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

  // auto box Hold gear during a drift or power-slide. Upshifting mid-drift cuts the clutch,
  // dropping drive torque to zero and bogging the car down. Holding the gear keeps continuous power
  // delivery throughout the slide.
  const isDrifting = Math.abs(car.t.vLat || 0) > 2.0 && Math.abs(car.t.slipR || 0) > 0.15;
  // Hold gear if we are actively spinning the wheels hard on loose surfaces or a launch (wheelSpin
  // > 2.5 m/s). Otherwise the RPM spike from wheelspin forces an upshift that kills the power.
  const isTractionBroken = (car.wheelSpin || 0) > 2.5;

  if (car.autoBox && car.shiftTimer <= 0 && !inReverse) {
    if (!isDrifting && !isTractionBroken && car.rpm >= carSpec.upshiftRpm
        && car.gear < carSpec.gears.length) {
      car.gear++; car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
    } else if (car.rpm <= carSpec.downshiftRpm && car.gear > 1) {
      car.gear--; car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
    }
  } else if (!car.autoBox && car.shiftTimer <= 0) {
    if (input.shiftUp && car.gear < carSpec.gears.length) {
      car.gear++;
      car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
    } else if (input.shiftDown && car.gear > 1) {
      car.gear--;
      car.shiftTimer = carSpec.shiftTime * car.mods.shiftTime;
    }
  }

  // ---- 3. slip angles (guarded divide — rule 20)
  const vLongAbs = Math.abs(vLong);
  const dirSign = vLong === 0 ? 1 : Math.sign(vLong);
  const slipF = Math.atan2(vLat + car.yawRate * carSpec.lf, vLongAbs + EPS_SLIP) - delta * dirSign;
  const slipR = Math.atan2(vLat - car.yawRate * carSpec.lr, vLongAbs + EPS_SLIP);

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
  // REWRITTEN 2026-09-28. It used to be a scripted hop: the lab decided "you are now airborne for
  // 0.6 s" and the car played that out. The user was right that it read as an animation done TO the
  // car — "it should be a physics change to the state of the car that temporarily occurs rather
  // than like a jump that you make happen to it".
  //
  // So there is no jump, and nothing here knows what a kerb is. The lab supplies a ground height
  // under the car (car.ground, metres) and how fast it is changing (car.groundV). The body is a
  // mass on a spring/damper over that profile, and EVERYTHING else falls out of it:
  //   * a crest lifts the ground away faster than the body can follow -> load drops -> less grip,
  //     and the yaw damping and self-aligning torque that stabilise the car drop with it. It gets
  //     loose.
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

  // ---- 5. longitudinal demand per axle CLUTCH RAMP. MEASURED BUG, 2026-09-27 (user: "still
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
  // TCS, TRACTION HALF (2026-10-03): when the driven wheels run more than TCS_SPIN m/s ahead of the
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
  const aidCut = car.tcsOn ? car.tcsK * car.escCut : 1;
  // REV LIMITER (2026-10-03). MEASURED BUG (tools/carstats.mjs): there was none — the engine rpm
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
  // ENGINE BRAKING (2026-10-03, step 2). MEASURED before: a lift-off at 100 km/h slowed a hatch at
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

  // handbrake locks the rear outright 0..1, not a boolean: the handbrake is modulated (see
  // input.js). still means full, so the headless benches and any older caller keep working.
  const handbrake = handbrakeRaw;


  // ---- 6/7. per-axle tyre force.
  //
  // MEASURED BUG, 2026-09-27: the first cut gave a locked axle its friction as pure LONGITUDINAL
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
  // LONGITUDINAL GRIP RELATIVE TO LATERAL. Added 2026-09-28 (user: "grass mud and gravel feel too
  // similar") because grip, slip angle and drag alone could not separate them — all three merely
  // made a surface "worse" by degrees. This one is the difference between a wheel that DIGS IN and
  // one that CHURNS. On gravel a driven wheel packs the loose stones and finds more bite than a
  // cornering wheel does (longK 1.30, so power pays even while sideways); in mud it just spins
  // itself a hole (0.65). Lateral grip is untouched by it, which is exactly what makes gravel feel
  // fast and mud feel bogged at almost the same mu.
  const longK = car.surface.longK || 1;

  // Lateral-force speed fade. MEASURED ARTIFACT, 2026-09-27: a car parked at 0.1 m/s with the wheel
  // at 19 deg reported FyF = 5610 N — because slip angle is atan2(lat, |vLong| + eps) and at rest
  // the eps IS the denominator, so a stationary tyre reads a huge slip angle. The low-speed blend
  // was deleting the resulting velocity every step, i.e. hiding it rather than fixing it. No slip
  // velocity => no slip force: fade the lateral component out below 1.2 m/s. Longitudinal is
  // untouched (you must still be able to pull away and to brake to a stop).
  const latFade = clamp(Math.hypot(vLong, vLat) / 1.2, 0, 1);

  const axle = (
    axleLoad: number, sxl: number, syl: number, FxDemand: number, slip: number, cornering: number,
    forceSlide: boolean, FzNom: number, latchKey: 'spinLatchF' | 'spinLatchR', gripT = 1,
  ) => {
    // A TYRE IN THE AIR MAKES NO FORCE. FIXED 2026-10-03 (Claude) — the "freeze when you brake
    // mid-jump".
    //
    // MEASURED: driving off the lab ramp and braking while airborne turned x/y into NaN on the
    // FIRST airborne step, 8 of 8 cars (tools/airbrake.mjs). Cause: the "SECOND AERO FIX" below
    // scales cornering stiffness by load (caEff = ca * Fz/FzNom), so with Fz = 0 the sliding branch
    // computes aPeakS = 0/0 = NaN. Braking is what reaches that branch (lockedF/lockedR ->
    // forceSlide), which is why only brake-in-the-air froze it. The NaN position then made
    // groundAt() return no surface, step() threw on `surface.mu`, and the frame loop died — the
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

    // longitudinal demand alone beyond grip => the wheel spins up or locks
    // WHEELSPIN / LOCK-UP: the longitudinal demand alone exceeds grip. This is a DIFFERENT thing
    // from a tyre merely at a big slip angle, and conflating the two made the donut bench report
    // that the muscle car could donut at 0.7x power when by hand it needed 2.4x (CLAUDE.md rule
    // 15).
    const demandRatio = FmaxRoll > 1 ? Math.abs(FxDemand) / FmaxRoll : 0;
    // NOTE: hysteresis on this state was tried (enter above 1.0 of grip, leave below 0.85) to stop
    // the rear flipping in and out of wheelspin during a slide. It made the track car WORSE (judder
    // 63 ->
    // 175) because holding the state longer makes the eventual jump bigger. A shared friction
    // circle was tried too and was better physics and better almost everywhere, but worse again for
    // the track car at gear shifts (223). Both reverted. See ENGINE.md.
    const overLong = demandRatio > 1;

    // BLENDED, never switched. MEASURED BUG, 2026-09-27 (user: "the track spec car seems juddery",
    // returning after the power went up): this was a hard `if` between the rolling and sliding
    // laws, and at the boundary the two disagree by (1 - slideGrip) in magnitude AND in direction.
    // With plenty of power the demand sits right on that boundary, so the force flipped between the
    // two every step — track car max jerk 457 against 7-11 for the others. Same lesson as the yaw
    // damping: a discontinuous force is always a judder. Fade across a band so the two laws meet
    // smoothly. Use the HYSTERETIC state, not a fresh threshold — computing the latch and then
    // ignoring it here is why the first attempt at this changed nothing at all.
    const wSlide = forceSlide ? 1 : clamp((demandRatio - 1) / SLIDE_BLEND, 0, 1);

    let slideFx = 0, slideFy = 0, slipSpeed = 0;
    if (wSlide > 0) {
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
      const overLong = Math.max(0, demandRatio - 1);
      const slipLong = forceSlide
        ? sxl
        : -Math.sign(FxDemand) * (Math.abs(sxl) + Math.min(18, overLong * 12));
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
    }
    if (wSlide >= 1) {
      return {
        Fx: slideFx, Fy: slideFy,
        FyMax: FmaxSlide, sliding: true, sat: 1, spinning: overLong && !forceSlide,
        slipSpeed,
      };
    }
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
    // NOT multiplied by longK. MEASURED 2026-09-28: it was, and that inflated the SHARED friction
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
  };

  // contact-patch velocities. Front is in the WHEEL frame (rotated by delta); rear is the body
  // frame.
  const patchLatF = vLat + car.yawRate * carSpec.lf;
  const patchLatR = vLat - car.yawRate * carSpec.lr;
  const sxlF = vLong * cosDelta + patchLatF * sinDelta;
  const sylF = -vLong * sinDelta + patchLatF * cosDelta;
  const sxlR = vLong;
  const sylR = patchLatR;

  // lock-up test: brake demand alone exceeding available grip ABS (2026-10-03): cap each axle's
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
  // HANDBRAKE AS A FORCE, not a boolean. MEASURED 2026-09-27 (user: "hand braking at higher speeds
  // still feels off and ends up in the car swinging backwards"): as an instant full lock, its
  // violence scaled with FRONT grip — and raising mu to 1.25 made every flick, at every speed, in
  // every car, reach 90 deg of body slip. Identical outcomes across different inputs is rule 1. As
  // a rear brake DEMAND it locks only when it actually exceeds rear grip, the existing over-demand
  // path handles the transition continuously, and its strength is one tunable number.
  const hbForce = handbrake * TUNE.handbrakeForce * muBase * FzR * car.mods.gripLong;
  // Does the handbrake demand actually EXCEED rear grip? If so the wheel genuinely LOCKS, and a
  // locked wheel skates at the full contact-patch speed — which is what makes it lose its lateral
  // grip and lay rubber. MEASURED BUG, 2026-09-27 (user: "handbrake does not seem to lock up the
  // rear wheels"): converting the handbrake from a lock into a force meant it no longer set
  // forceSlide, so the rear's longitudinal slip was derived from how far past grip the demand was —
  // 0.7 m/s at 20 m/s instead of ~20. The rear kept almost all its lateral grip and laid no marks
  // at all (the mark floor is 2.2 m/s).
  const hbLocksRear = hbForce > muBase * FzR * car.mods.gripLong * 0.98;
  const lockedR = hbLocksRear
      || (brakeIn > 0.05 && vLongAbs > 0.3 && Math.abs(FbR) > muBase * FzR * car.mods.gripLong);

  // static axle loads
  const FzNomF = (mass * gravity * carSpec.lr) / carSpec.L,
      FzNomR = (mass * gravity * carSpec.lf) / carSpec.L;
  const hard = !!car.surface.hard, tyreTemps = car.tyreT;
  const gripTF = hard ? (tyreGrip(tyreTemps[0], carSpec) + tyreGrip(tyreTemps[1], carSpec)) / 2 : 1;
  const gripTR = hard ? (tyreGrip(tyreTemps[2], carSpec) + tyreGrip(tyreTemps[3], carSpec)) / 2 : 1;
  const wreckMul = car.wreck;   // DAMAGE: axle grip (bent suspension, a puncture)
  const frontAxle = axle(FzF, sxlF, sylF, FxDriveF + FxBrakeF, slipF, carSpec.caF, lockedF, FzNomF,
      'spinLatchF', gripTF * (wreckMul ? wreckMul.gripF : 1));
  const rearAxle = axle(FzR, sxlR, sylR, FxDriveR + FxBrakeR - dirSign * hbForce, slipR,
      carSpec.caR, lockedR, FzNomR, 'spinLatchR', gripTR * (wreckMul ? wreckMul.gripR : 1));
  // friction work per axle (W), taken BEFORE the relaxation lag below changes Fy. A sliding /
  // spinning / locked axle skates at slipSpeed; a rolling one scrubs at a fraction of its lateral
  // patch speed, plus ~8% longitudinal slip at its drive / brake force.
  const work = (
    axleState: ReturnType<typeof axle>, syl: number, locked: boolean, load: number,
  ) => (axleState.spinning || locked || (axleState.sliding && axleState.slipSpeed > 2))
    ? Math.hypot(axleState.Fx, axleState.Fy) * TYRE_HEAT.slipSat
        * Math.tanh(axleState.slipSpeed / TYRE_HEAT.slipSat)
            / (1 + Math.hypot(vLong, vLat) / TYRE_HEAT.roadV)
    : Math.abs(axleState.Fy) * Math.abs(syl) + Math.abs(axleState.Fx) * 0.08 * vLongAbs
        * Math.min(1, Math.abs(axleState.Fx) / (muBase * load + 1));
  const workF = work(frontAxle, sylF, lockedF, FzF), workR = work(rearAxle, sylR, lockedR, FzR);

  // TYRE RELAXATION LENGTH — real, standard, and its absence was the turn-in bug.
  //
  // A tyre does not develop its lateral force the instant a slip angle appears: the carcass has to
  // deflect, which takes a ROLLING DISTANCE (the relaxation length, ~0.5 m) rather than a time. So
  // the lag is RELAX_LEN / v — sharp at speed, soft when slow, exactly as in a real car.
  //
  // MEASURED BUG, 2026-09-27 (user: "braking when turning... it slides weird"): without it the
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

  // ---- 7b. PLOUGHING — what makes a gravel trap a gravel trap (user, 2026-09-28: "can the gravel
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

  // ---- 8. integrate TCS, STABILITY HALF (2026-10-03; user: one TCS switch covers wheelspin AND
  // slides). Real stability control brakes ONE wheel to make a yaw moment; this model has one tyre
  // per axle, so it applies that moment directly — capped at what one wheel braked at its grip
  // limit could give (mu x a quarter of the load x half the track) — plus the matching drag of that
  // brake, and cuts the engine while the car is rotating more than the wheel asks for.
  let escMz = 0, escFx = 0, escWorking = false;
  // HANDBRAKE OVERRIDES STABILITY (user, 2026-10-03: holding the handbrake should be full force,
  // like the brake). While it is pulled, and for ESC.hbHold s after, the stability half stands down
  // — otherwise it straightens every handbrake turn the player asked for. Traction control
  // (wheelspin) is unaffected.
  car.hbAfter = handbrakeRaw > 0.1 ? ESC.hbHold : Math.max(0, (car.hbAfter || 0) - dt);
  if (car.tcsOn && !inReverse && vLongAbs > ESC.vMin && car.hbAfter <= 0) {
    // REFERENCE YAW = the car's OWN steady-state response, understeer included (linear bicycle
    // model: K = m/L x (lr/caF - lf/caR)). MEASURED BUG (user, 2026-10-03: "TCS is too strong,
    // making the hatch RWD nearly undrivable"): against the pure kinematic v.tan(delta)/L every
    // road car "understeered" in EVERY corner, so the aid ran 65% of a lap (3 of 4 s in a gentle
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
    let want = 0;
    const over = Math.sign(err) === Math.sign(car.yawRate)
        && Math.abs(car.yawRate) > Math.abs(yawRef);
    // UNDERSTEER correction (adding rotation) is GENTLE and fades out as slip builds. MEASURED: at
    // full gain the estate, floored on full lock at 45 km/h, went from pushing wide (3 deg) to a 16
    // deg slide WITH the aid on.
    if (Math.abs(err) > dead) {
      const escScale = over ? 1 : ESC.underK * Math.max(0, 1 - Math.abs(betaNow) / ESC.betaLim);
      want = -Math.sign(err) * (Math.abs(err) - dead) * ESC.gain * carSpec.Izz * escScale;
    }
    if (Math.abs(betaNow) > ESC.betaLim) want += Math.sign(betaNow)
        * (Math.abs(betaNow) - ESC.betaLim) * ESC.betaGain * carSpec.Izz;
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

  vLong += (accelLong + car.yawRate * vLat) * dt;
  vLat += (accelLat - car.yawRate * vLong) * dt;
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

  // Yaw damping. MEASURED 2026-09-27: a flick-and-release handbrake turn reached 92 deg, then swung
  // BACK through centre at -1.4 rad/s and oscillated (92 -> 7 -> 37 deg). The bicycle model has no
  // tyre relaxation length and no suspension compliance, both of which damp yaw on a real car, so
  // the rotation had nothing to settle it and the car behaved like a pendulum. This term stands in
  // for them. Deliberately small — enough to settle the oscillation, not enough to stop a drift.
  // MEASURED 2026-09-27: damping yawRate ABSOLUTELY cost 40% of the steady-state cornering rate
  // (0.29 rad/s against a grip-limited 0.49), which the user felt as "the rear wheels fight
  // turning". Real damping opposes CHANGE, not steady cornering. Damp the deviation from the turn
  // rate the steering is actually asking for, so a held corner is untouched while a pendulum or a
  // spin is still arrested. ONE-SIDED. Damping toward yawRef symmetrically was worse than the
  // original: when yawRate was BELOW the commanded rate it ADDED yaw, forcing the car to follow the
  // steering angle regardless of grip — measured 1.22 rad/s against a grip-limited maximum of 0.49.
  // It may only ever oppose yaw the car has in EXCESS of what the steering asked for, which is the
  // spin/pendulum case and nothing else.
  //
  // AND IT MUST BE CONTINUOUS. MEASURED BUG, 2026-09-27 (user: "the track spec car seems juddery"):
  // the sign test above was a HARD SWITCH, so when the yaw rate sat near the commanded rate it
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

  // ---- 9. low-speed blend. Without this the car shivers and creeps at a standstill and it reads
  //         as a bug in the friction model (PLAN.md "What would count as wrong").
  //
  // MEASURED BUG, 2026-09-27: this was gated on |vLong| while it zeroes vLat. A car sliding
  // sideways at 10 m/s with only 1.2 m/s of FORWARD speed satisfied the gate, so the blend deleted
  // the slide — 10.1 m/s to 0 in 0.1 s (10 g) at the end of every handbrake turn. Gate on the TOTAL
  // planar speed; that is the quantity that does not vanish when the car is sideways (CLAUDE.md
  // rule 9).
  const speed = Math.hypot(vLong, vLat);
  // STEEP GROUND MOVES A STOPPED CAR (user, 2026-10-03: "super steep angles should still move /
  // push / pull the car even when parked or moving"). The blend and the rest-snap below exist so a
  // car does not shiver on FLAT ground; they used to hold it on any slope too. Now: it ROLLS along
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

  // ---- tyre temperatures (see TYRE TEMPERATURE at the top)
  {
    // share of each axle's load (and work) on the +y side: cornering moves it to the outside
    const frontShare = clamp(0.5 - (accelLat * carSpec.cgH) / (carSpec.trackWidth * gravity), 0.1,
        0.9);
    const cool = TYRE_COOL + TYRE_HEAT.air * Math.hypot(vLong, vLat) + (car.surface.coolK || 0);
    const heatScale = (car.surface.heatK ?? 1)
        * (car.surface.hard && carSpec.tyre ? carSpec.tyre.heatHard || 1 : 1);
    // tyre thermal mass scales with the car (a tractor tyre holds far more rubber than a hatch's).
    // MEASURED: at one capacity for every car the 5.2 t tractor popped in a 14 s burnout.
    // Reference: the 1440 kg hatch.
    // share of the slip heat that goes into the TYRE (loose ground takes most of it)
    const capK = TYRE_HEAT.cap * (carSpec.mass || 1440) / TYRE_HEAT.massRef;
    const wheelWork = [workF * frontShare, workF * (1 - frontShare), workR * frontShare,
        workR * (1 - frontShare)];
    // FLEX HEAT (user, 2026-10-03: "should be semi easy to get warm but you'd have to try to over
    // heat them"). A tyre working in a corner flexes, and that warms it toward TYRE_FLEX.T — INSIDE
    // the working window — and no further: above it this term is zero, so only sliding (the slip
    // work above) can overheat a tyre. Rate = how hard the axle is working (force / load) x this
    // tyre's share x speed; on loose ground x heatK like everything else. GRIPPING axles only: a
    // sliding / spinning / locked axle already heats by slip work, and adding flex on top MEASURED
    // took the tarmac drift from too-hot-at-27 s to 17 s (the user wants overheating to stay hard).
    const grips = (axleState: ReturnType<typeof axle>, locked: boolean) =>
      !(axleState.spinning || locked || axleState.sliding);
    // CORNERING force only. MEASURED: with |Fx| included, holding 90 km/h on a straight (throttle
    // on, then engine braking off) warmed the rears to 46 C in 30 s; the rule is that a cruise
    // barely warms them. Drive and brake heat still arrive through the slip work above. MEASURED
    // BUG (user, 2026-10-03: "tyres heat up like crazy if you brake or slide over jumps"): over the
    // Test Track table with the handbrake on, the fronts gained +203 C in ONE step — the axle was
    // airborne (Fz 0) but still carried 7.6 kN of lagged lateral force, so force / max(1, Fz) read
    // as ~7600 x "working hard". Now: grounded axles only, load floored at a quarter of static,
    // utilisation capped at the tyre's own grip (it cannot work harder than that).
    const utilOf = (
      axleState: ReturnType<typeof axle>, locked: boolean, load: number, FzNom: number,
    ) => (grips(axleState, locked) && load > 0.05 * FzNom)
      ? Math.min(muBase, Math.abs(axleState.Fy) / Math.max(0.25 * FzNom, load)) : 0;
    const utilF = utilOf(frontAxle, lockedF, FzF, FzNomF),
        utilR = utilOf(rearAxle, lockedR, FzR, FzNomR);
    const speedFrac = Math.min(1, Math.hypot(vLong, vLat) / TYRE_FLEX.vRef);
    const flex = [utilF * frontShare, utilF * (1 - frontShare), utilR * frontShare,
        utilR * (1 - frontShare)];
    for (let i = 0; i < 4; i++) {
      // never overshoot: the flex step can at most close the gap to TYRE_FLEX.T this step
      // (CLAUDE.md rule 11 — explicit integration with a big rate overshoots; the +203 C step went
      // straight past 85 C to 249 C)
      const flexHeat = Math.min(1 / dt, TYRE_FLEX.k * 2 * flex[i] * speedFrac * heatScale)
          * Math.max(0, TYRE_FLEX.T - tyreTemps[i]);
      tyreTemps[i] += ((wheelWork[i] * heatScale) / capK + flexHeat - cool
          * (tyreTemps[i] - TYRE_AMBIENT)) * dt;
      // NaN guard ONLY. MEASURED BUG (user, 2026-10-03: "tyres that get too hot just roll over the
      // temp table and start cold again — they should pop or hold temp until cooled"): this used to
      // reset anything over 400 C to ambient. Now a real number is CAPPED and HELD until it cools;
      // bursting arrives with the damage system.
      if (!Number.isFinite(tyreTemps[i])) tyreTemps[i] = TYRE_AMBIENT;
      else if (tyreTemps[i] > TYRE_T_MAX) tyreTemps[i] = TYRE_T_MAX;
    }
    telem.gripTF = gripTF; telem.gripTR = gripTR;
  }

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

  // ---- telemetry
  //      slipSpeed comes straight out of the axle function — it is the magnitude of the contact
  //      patch's slip velocity, which is exactly what the marks layer and the squeal need. Do not
  //      re-derive it here; two derivations of one quantity is how they drift apart.
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

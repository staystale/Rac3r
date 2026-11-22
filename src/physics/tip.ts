// physics/tip.ts - THE TWO-WHEEL STATE (owner: "two wheel state approved so long as it
// meets performance requirements", "global apply"; the Routemonster its showcase: "it should use
// the first 1-2 roll over frames to show it's tipping - but steering into it etc should correct
// it"). Between four wheels and a roll (roll.ts) a car may be up on its two outside wheels -
// car.roll.phase 'tipping', its lean phi (+ toward +y) - still driven on them (vehicle.ts steps
// it). It lifts when its sideways acceleration beats gravity times its static stability (half its
// track over its centre of gravity's height): ordinary cars slide first, a bus can lift. The lean
// is the body pivoting on its outside wheels' line: the sideways acceleration's moment against
// gravity's, the suspension damping it. Past the balance point (the centre of gravity over that
// line) it goes over into the roll; back to level, it is down on four wheels. Steering into it or
// lifting off cuts the sideways acceleration and gravity brings it down. A dice trip on loose
// ground (roll.ts tripGround) starts here too, with a lean rate about the one that just carries it
// over: some are saved. While tipping its grip falls (the inside tyres carry nothing, the outside
// ones are past their best load) and the rolled-body drawing shows its lean (render/cars.ts).
import type { RollCar } from '../roll.ts';

/** The lean phase's name (car.roll.phase). */
export const TIP_PHASE = 'tipping';
// the body's roll inertia about the outside wheels' line, x mass x (cg height^2 + half track^2)
// (EST: a box's, its mass a little spread)
const INERTIA_K = 1.3;
// 1/s the suspension and tyres' damping of the lean rate (EST: it settles a lift within ~1 s)
const TIP_DAMP = 1.5;
// rad a lift starts at (the inside wheels just off)
const LIFT_RAD = 0.004;
// the grip the axles lose at the balance point, the share of their grip (EST: the outside tyres
// carry the whole load, past their best - load sensitivity)
const TIP_GRIP_LOSS = 0.15;
// rad/s a car going over keeps at least (the roll goes on to its side, roll.ts spinStep)
const OVER_W = 3.2;
// a dice trip's lean rate, a share of the rate that just carries it over: from LOW to LOW + SPREAD
const TRIP_LOW = 0.6, TRIP_SPREAD = 0.8;
const GRAVITY = 9.81;
// the share of the static tip point the body's roll on its springs and tyres takes off (its centre
// of gravity swings out as it leans: EST, the rollover-threshold literature's 10-20 % for tall
// vehicles): none for a car whose centre of gravity is low (to COMPLIANCE_FROM m), all of
// ROLL_COMPLIANCE from COMPLIANCE_FULL m up (a bus) - a low car slides long before it lifts
const ROLL_COMPLIANCE = 0.12, COMPLIANCE_FROM = 0.6, COMPLIANCE_FULL = 1.3;
// s the body's roll lags the tyres' pull by (its springs and dampers): the lean reads the pull
// smoothed over this, not a step's spike (EST, a car's roll response ~0.2-0.3 s)
const ROLL_LAG_S = 0.25;

/** What the two-wheel state reads of a car: its sideways acceleration (car.t.ay, m/s^2, + toward
 * +y) and that pull as its body feels it, smoothed (_tipPull). */
type TipCar = RollCar & { t?: { ay?: number }; _tipPull?: number };

/** A car's tipping geometry: its half track, its centre of gravity's height, m. */
function geometry(car: RollCar) {
  const halfT = (car.spec.trackWidth || 1.5) / 2, high = car.spec.cg || car.spec.cgH || 0.52;
  // (a spec may give its own: ?trailroll's trailer - physics/trailroll.ts)
  const give = car.spec.tipGive ?? ROLL_COMPLIANCE * Math.max(0, Math.min(1,
    (high - COMPLIANCE_FROM) / (COMPLIANCE_FULL - COMPLIANCE_FROM)));
  return { halfT, high, give, balance: Math.atan2(halfT, high),
    inertia: INERTIA_K * (high * high + halfT * halfT) };
}

/**
 * Whether a car is up on two wheels now.
 * @param car the car
 * @returns tipping
 */
export const isTipping = (car: RollCar) => !!car.roll && car.roll.phase === TIP_PHASE;

/**
 * The share of its grip a tipping car's axles keep (1 on four wheels).
 * @param car the car
 * @returns 0..1
 */
export function tipGrip(car: RollCar): number {
  if (!isTipping(car)) return 1;
  return 1 - TIP_GRIP_LOSS * Math.min(1, Math.abs(car.roll!.phi) / geometry(car).balance);
}

/**
 * A car on its four wheels on the ground: does its sideways acceleration lift it? (on its outside
 * wheels: away from where it is pulled).
 * @param car the car (car.t.ay: its sideways acceleration, m/s^2, + toward +y)
 * @returns true when it lifted
 */
export function tipCheck(car: TipCar): boolean {
  if (car.roll || car.air > 0) return false;
  const pull = car._tipPull ?? 0, { halfT, high, give } = geometry(car);
  if (Math.abs(pull) * high <= GRAVITY * halfT * (1 - give)) return false;
  car.roll = { phase: TIP_PHASE, phi: -Math.sign(pull) * LIFT_RAD, w: 0, still: 0 };
  return true;
}

/**
 * A dice trip (roll.ts tripGround): the car lifts toward its slide with a lean rate about the one
 * that just carries it over (TRIP_LOW .. + TRIP_SPREAD of it), so some are saved.
 * @param car the car
 * @param dir +1 toward +y, -1 toward -y
 * @param rnd the random source
 */
export function startTip(car: RollCar, dir: number, rnd: () => number): void {
  const { high, inertia } = geometry(car), reach = Math.sqrt(inertia / INERTIA_K);
  const overRate = Math.sqrt(2 * GRAVITY * (reach - high) / inertia);
  car.roll = { phase: TIP_PHASE, phi: dir * LIFT_RAD,
    w: dir * overRate * (TRIP_LOW + TRIP_SPREAD * rnd()), still: 0 };
}

/**
 * One step of a tipping car's lean: the sideways acceleration's moment about its outside wheels
 * against gravity's, damped; over the balance point it goes into the roll, back to level it is
 * down on four wheels.
 * @param car the car (car.t.ay its sideways acceleration)
 * @param dt the step, s
 * @returns 'over' (now rolling), 'down' (on four wheels) or 'tipping'
 */
export function stepTip(car: TipCar, dt: number): string {
  const roll = car.roll!, dir = Math.sign(roll.phi) || 1,
    { halfT, high, give, balance, inertia } = geometry(car);
  // the pull outward, toward the lean (the tyres pull the car the other way)
  const outward = -(car._tipPull ?? 0) * dir;
  let lean = Math.abs(roll.phi), rate = roll.w * dir;
  const arm = halfT * Math.cos(lean) - high * Math.sin(lean),
    lift = halfT * Math.sin(lean) + high * Math.cos(lean);
  rate += ((outward * lift - GRAVITY * arm * (1 - give)) / inertia - TIP_DAMP * rate) * dt;
  lean += rate * dt;
  if (lean >= balance) {
    roll.phase = 'rolling';
    roll.phi = dir * lean;
    roll.w = dir * Math.max(rate, OVER_W);
    return 'over';
  }
  if (lean <= 0) {
    car.roll = null;
    return 'down';
  }
  roll.phi = dir * lean;
  roll.w = dir * rate;
  return TIP_PHASE;
}

// the share of its steering a driver keeps when its car lifts (the rest let go: into the lean)
const SAVE_STEER = 0.3;

/**
 * A driver's save when the car lifts (the AI, the traffic): the steering eased toward straight,
 * off the throttle, no brake - the sideways pull falls and gravity brings it down.
 * @param input the controls wanted
 * @returns the controls
 */
export function tipSave<T extends { steer: number; throttle: number; brake: number }>(input: T): T {
  return { ...input, steer: input.steer * SAVE_STEER, throttle: 0, brake: 0 };
}

/**
 * After a car's step on its wheels: a tipping car's lean steps; one on four wheels may
 * lift.
 * @param car the car
 * @param dt the step, s
 */
export function stepTipping(car: TipCar, dt: number): void {
  const pull = car.t?.ay ?? 0;
  const was = car._tipPull ?? pull;
  car._tipPull = was + (pull - was) * Math.min(1, dt / ROLL_LAG_S);
  if (isTipping(car)) stepTip(car, dt);
  else tipCheck(car);
}

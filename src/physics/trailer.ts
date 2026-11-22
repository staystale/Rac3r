// physics/trailer.ts - THE SCANYAH's TRAILER ON ITS PIN (owner: yes to the four choices:
// a half load of ~10 t, the hitch stop at +-85 deg, a broken pin in a big crash, reversing as in
// life). The trailer is a second body (x, y, heading, vx, vy, yawRate) with no engine and no
// steering: one axle group (its three axles' grip and load), rolling resistance, drag, and brakes
// that follow the tractor's pedal (its EBS: they never lock). Each step, after the tractor and the
// trailer have moved, a POINT JOINT at the fifth wheel (the tractor 0.5 m ahead of its rear axle,
// the trailer's kingpin) pulls the two pins together: a sequential impulse that removes the pins'
// relative speed, each body taking its share by its mass and its yaw inertia about the pin - so
// the tractor pulls it, it pushes the tractor under braking, it cuts inside a bend, and a tractor
// whose rear wheels lock or spin while the trailer pushes folds round (a jack-knife). The hitch
// angle stops at HITCH_MAX (the cab against the trailer's front); an impulse past PIN_BREAK_NS in
// one step (a big crash) breaks the pin and the trailer runs free. The trailer's front weight on
// the fifth wheel loads the tractor's axles (car.hitchLoad: physics/loads.ts). A teleport of the
// tractor (a reset) lines the trailer up behind it again, on a whole pin.
import { makeCar, type Car } from '../vehicle.ts';
import { spec as rowSpec, type Spec } from '../cars.ts';
import { SCANYAH_TRAILER } from '../newcars.ts';
import { PAINT_STOCK } from '../carpaint.ts';
import { FIX } from '../core/fixes.ts';
import { trailerTipGive } from './trailroll.ts';

/**
 * A trailer: a car body stepped here, whether its pin still holds, the pin's gap (m), and where
 * its tractor was after the last step (a jump from there is a reset).
 */
export type Trailer = Car & { pinFree?: boolean; pinGap?: number;
  towedBy?: { x: number; y: number; heading: number };
  // (where a reset puts it - game/rigreset.ts; taken once by lineUpTrailer)
  resetPose?: { x: number; y: number; heading: number } | null };
/** A tractor that may tow one. */
export type Tractor = Car & { trailer?: Trailer | null; hitchLoad?: number };

// the tractor that tows a trailer
export const TRACTOR_ID = 'scanyah-r450';
// the garage's TRAILER row for a tractor unit (menu/garage.ts; owner: no load chooser): none, or
// the half-loaded curtainsider - hitched unless the player chose none
export const TRAILER_CHOICES = [{ id: 'curtain', name: 'CURTAINSIDER · HALF-FULL' },
  { id: 'none', name: 'WITHOUT' }];

/**
 * A launch's trailer for a tractor (the garage's choice): none drops it; else hitched at the first
 * step (hitchTrailer).
 * @param car the player's car
 * @param choice the garage's choice (TRAILER_CHOICES id; none set: the curtainsider)
 */
export function chooseTrailer(car: Tractor, choice: string | undefined): void {
  if (String(car.spec.id).split('#')[0] !== TRACTOR_ID) return;
  if (choice === 'none') car.trailer = null;
  else if (car.trailer === null) car.trailer = undefined;
}
// m the fifth wheel sits ahead of the tractor's rear axle
const FIFTH_WHEEL_AHEAD = 0.5;
const GRAVITY = 9.81;
// rad the hitch angle stops at (the cab against the trailer's front)
const HITCH_MAX = 85 * Math.PI / 180;
// m/s of the trailer's speed the pin takes away in one step that breaks it (EST: the barrier clamp
// stops a car dead in one step, so a head-on hit of ~45 km/h+ - the joint shares that stop by mass;
// never braking, pulling or a crash spread over steps: those take well under 1 m/s a step)
const PIN_BREAK_DV = 4;
// the joint's sweeps a step, its position correction's share a step (Baumgarte)
const JOINT_PASSES = 3, JOINT_BETA = 0.2;
// a tractor's move in one step past its speed's (m) or turn (rad) that is a reset, not driving
const JUMP_M = 0.5, JUMP_RAD = 0.2;
// the trailer's rolling resistance (its tyres' share of its axle load) and its brakes' share of
// its axle's grip at a full pedal (EBS: short of locking)
const ROLL_RES = 0.006, BRAKE_SHARE = 0.9;

/**
 * The trailer's full spec: its row (newcars.ts SCANYAH_TRAILER) and its paint parts over a spec's
 * shared defaults (the tractor's), its wheelbase (the pin to its axle group) and its yaw inertia
 * (a box's: no izzK, a car's feel).
 * @returns the spec
 */
function trailerSpec(): Spec {
  const out = { ...rowSpec(TRACTOR_ID), ...SCANYAH_TRAILER,
    ...PAINT_STOCK[SCANYAH_TRAILER.id] } as Spec;
  out.L = out.lf + out.lr;
  out.Izz = out.mass * (out.len * out.len + out.wid * out.wid) / 12;
  // (?trailroll: its springs, tyres and load lift it at physics/trailroll.ts TRAILER_TIP_G)
  if (FIX.trailroll) (out as Spec & { tipGive?: number }).tipGive = trailerTipGive(out);
  return out;
}

/** The lamps' state a trailer shows of its tractor's (render/riglamps.ts). */
interface Lamps { lightsOn?: boolean; brakeLight?: number; indicator?: number; hazard?: boolean;
  hazardUntil?: number; rainLight?: boolean; gear?: number }

/**
 * The trailer's rear lamps lit as its tractor's - tail, brake, indicators, hazards, rain and
 * reversing light - while its pin holds (their cable); dark once the pin has broken.
 * @param car the tractor
 */
export function mirrorLamps(car: Tractor): void {
  const trailer = car.trailer as (Trailer & Lamps) | null | undefined;
  if (!trailer) return;
  const from = car as Tractor & Lamps, lit = !trailer.pinFree;
  trailer.lightsOn = lit && !!from.lightsOn;
  trailer.brakeLight = lit ? from.brakeLight || 0 : 0;
  trailer.indicator = lit ? from.indicator || 0 : 0;
  trailer.hazard = lit && !!from.hazard;
  trailer.hazardUntil = lit ? from.hazardUntil || 0 : 0;
  trailer.rainLight = lit && !!from.rainLight;
  trailer.gear = lit && (from.gear || 0) < 0 ? -1 : 1;
}

/**
 * The tractor's pin, world m: 0.5 m ahead of its rear axle.
 * @param car the tractor
 * @returns its offset from the tractor's middle and the point
 */
function tractorPin(car: Car) {
  const along = -(car.spec.lr - FIFTH_WHEEL_AHEAD), cosH = Math.cos(car.heading),
    sinH = Math.sin(car.heading);
  const offX = cosH * along, offY = sinH * along;
  return { rx: offX, ry: offY, x: car.x + offX, y: car.y + offY };
}

/**
 * The trailer's kingpin, world m: its row's lf ahead of its middle.
 * @param trailer the trailer
 * @returns its offset from the trailer's middle and the point
 */
function trailerPin(trailer: Car) {
  const offX = Math.cos(trailer.heading) * trailer.spec.lf,
    offY = Math.sin(trailer.heading) * trailer.spec.lf;
  return { rx: offX, ry: offY, x: trailer.x + offX, y: trailer.y + offY };
}

/**
 * ?trailroll: holds a trailer rolling with its tractor on the pin - its kingpin put on the fifth
 * wheel (its own heading kept), sliding as the tractor does (physics/trailroll.ts).
 * @param car the tractor
 * @param trailer its trailer
 */
export function holdOnPin(car: Car, trailer: Trailer): void {
  const pin = tractorPin(car), own = trailerPin(trailer);
  trailer.x += pin.x - own.x;
  trailer.y += pin.y - own.y;
  trailer.vx = car.vx;
  trailer.vy = car.vy;
}

/**
 * Puts the trailer in line behind its tractor, at rest with it (a reset, a new car).
 * @param car the tractor
 * @param trailer its trailer
 */
export function lineUpTrailer(car: Car, trailer: Trailer): void {
  const pin = tractorPin(car), placed = trailer.resetPose;
  trailer.resetPose = null;
  // (a reset's pose following the road - game/rigreset.ts - else straight behind)
  trailer.heading = placed ? placed.heading : car.heading;
  trailer.x = placed ? placed.x : pin.x - Math.cos(car.heading) * trailer.spec.lf;
  trailer.y = placed ? placed.y : pin.y - Math.sin(car.heading) * trailer.spec.lf;
  trailer.vx = car.vx; trailer.vy = car.vy; trailer.yawRate = 0;
  trailer.pinFree = false;
  // (?trailroll: a reset rights it - its two-wheel state or roll gone)
  if (FIX.trailroll) {
    trailer.roll = null;
    (trailer as Trailer & { _tipPull?: number })._tipPull = 0;
  }
  trailer.towedBy = { x: car.x, y: car.y, heading: car.heading };
  trailer._p = null;
}

/**
 * How far a car reaches ahead of and behind its middle, m: a tractor that will tow (its trailer
 * not dropped by the garage's row) to its trailer's tail - lined up as lineUpTrailer puts it;
 * any other car half its length each way.
 * @param car the car
 * @param towing it will tow
 * @returns { front, rear } m
 */
export function rigExtents(car: Tractor, towing: boolean): { front: number; rear: number } {
  const half = car.spec.len / 2;
  if (!towing || car.trailer === null || String(car.spec.id).split('#')[0] !== TRACTOR_ID)
    return { front: half, rear: half };
  const trailer = trailerSpec();
  const pinBack = car.spec.lr - FIFTH_WHEEL_AHEAD;
  return { front: half, rear: Math.max(half, pinBack + trailer.lf + trailer.len / 2) };
}

/**
 * A rig's lengths for placing its trailer (game/rigreset.ts): the tractor's pin behind its middle,
 * the trailer's middle and its axle group behind the pin, its length and width, m.
 * @param car the tractor
 * @returns the lengths
 */
export function rigGeometry(car: Car) {
  const trailer = trailerSpec();
  return { pinBack: car.spec.lr - FIFTH_WHEEL_AHEAD, lf: trailer.lf, wheelbase: trailer.L!,
    len: trailer.len, wid: trailer.wid };
}

/**
 * The trailer's middle behind a tractor's, m (lined up: lineUpTrailer).
 * @param car the tractor
 * @returns m behind its middle, its length and width
 */
export function trailerBehind(car: Car): { back: number; len: number; wid: number } {
  const trailer = trailerSpec();
  return { back: car.spec.lr - FIFTH_WHEEL_AHEAD + trailer.lf, len: trailer.len,
    wid: trailer.wid };
}

/**
 * Hitches a trailer to a tractor that tows one (a new player car).
 * @param car the car
 * @returns its trailer, or null
 */
export function attachTrailer(car: Tractor): Trailer | null {
  if (String(car.spec.id).split('#')[0] !== TRACTOR_ID) return null;
  const trailer = makeCar(TRACTOR_ID) as Trailer;
  trailer.spec = trailerSpec();
  car.trailer = trailer;
  lineUpTrailer(car, trailer);
  return trailer;
}

/**
 * Once a frame and before each step: hitches a trailer to a tractor that has none yet (a
 * new player car, before its race starts), and lines it up again behind one that was put
 * somewhere (a reset).
 * @param car the player's car
 * @returns its trailer, or null
 */
export function hitchTrailer(car: Tractor): Trailer | null {
  if (car.trailer === undefined) return attachTrailer(car);
  if (car.trailer && wasReset(car, car.trailer, 0)) lineUpTrailer(car, car.trailer);
  return car.trailer;
}

/**
 * The trailer's own forces for one step - its axle group's sideways grip (cornering stiffness x
 * slip, capped by its grip x load), its brakes on the tractor's pedal, rolling resistance and drag
 * - and its body moved by them.
 * @param trailer the trailer
 * @param brake the tractor's brake pedal, 0..1
 * @param dt the step, s
 */
function stepBody(trailer: Trailer, brake: number, dt: number): void {
  const spec = trailer.spec, mass = spec.mass, cosH = Math.cos(trailer.heading),
    sinH = Math.sin(trailer.heading);
  const vLong = trailer.vx * cosH + trailer.vy * sinH,
    vLat = -trailer.vx * sinH + trailer.vy * cosH;
  // its axle group carries its middle's share (the rest is on the pin)
  const load = mass * GRAVITY * spec.lf / (spec.lf + spec.lr);
  const grip = spec.mu * (trailer.surface?.mu ?? 1) * load;
  const slip = Math.atan2(vLat - trailer.yawRate * spec.lr, Math.max(1, Math.abs(vLong)));
  const lateral = Math.max(-grip, Math.min(grip, -spec.caR * slip));
  const rolling = Math.abs(vLong) > 0.05 ? -Math.sign(vLong) * ROLL_RES * load : 0;
  const braking = Math.abs(vLong) > 0.1 ? -Math.sign(vLong) * brake * BRAKE_SHARE * grip : 0;
  const longitudinal = rolling + braking - spec.dragC * vLong * Math.abs(vLong);
  trailer.vx += (longitudinal * cosH - lateral * sinH) / mass * dt;
  trailer.vy += (longitudinal * sinH + lateral * cosH) / mass * dt;
  trailer.yawRate += (lateral * -spec.lr) / spec.Izz * dt;
  trailer.heading += trailer.yawRate * dt;
  trailer.x += trailer.vx * dt;
  trailer.y += trailer.vy * dt;
}

/**
 * One sweep of the point joint: the impulse that removes the pins' relative speed (and a share of
 * their gap), split by each body's mass and yaw inertia about its pin.
 * @param car the tractor
 * @param trailer the trailer
 * @param dt the step, s
 * @returns the impulse's size, N s
 */
function jointSweep(car: Car, trailer: Trailer, dt: number): number {
  const pinA = tractorPin(car), pinB = trailerPin(trailer);
  const massA = car.spec.mass * (car.mods?.mass ?? 1), inertiaA = car.spec.Izz;
  const massB = trailer.spec.mass, inertiaB = trailer.spec.Izz;
  const relX = car.vx - car.yawRate * pinA.ry - (trailer.vx - trailer.yawRate * pinB.ry)
    + JOINT_BETA / dt * (pinA.x - pinB.x);
  const relY = car.vy + car.yawRate * pinA.rx - (trailer.vy + trailer.yawRate * pinB.rx)
    + JOINT_BETA / dt * (pinA.y - pinB.y);
  const inv = 1 / massA + 1 / massB;
  const k11 = inv + pinA.ry * pinA.ry / inertiaA + pinB.ry * pinB.ry / inertiaB;
  const k12 = -pinA.rx * pinA.ry / inertiaA - pinB.rx * pinB.ry / inertiaB;
  const k22 = inv + pinA.rx * pinA.rx / inertiaA + pinB.rx * pinB.rx / inertiaB;
  const det = k11 * k22 - k12 * k12;
  if (!(Math.abs(det) > 1e-12)) return 0;
  const impX = -(k22 * relX - k12 * relY) / det, impY = -(-k12 * relX + k11 * relY) / det;
  car.vx += impX / massA; car.vy += impY / massA;
  car.yawRate += (pinA.rx * impY - pinA.ry * impX) / inertiaA;
  trailer.vx -= impX / massB; trailer.vy -= impY / massB;
  trailer.yawRate -= (pinB.rx * impY - pinB.ry * impX) / inertiaB;
  return Math.hypot(impX, impY);
}

/**
 * The hitch angle's stop, one sweep: folded past HITCH_MAX, a yaw impulse between the two (shared
 * by their yaw inertias) takes away their folding rate and a share of the overshoot - the cab
 * against the trailer's front.
 * @param car the tractor
 * @param trailer the trailer
 * @param dt the step, s
 */
function hitchStop(car: Car, trailer: Trailer, dt: number): void {
  const angle = Math.atan2(Math.sin(trailer.heading - car.heading),
    Math.cos(trailer.heading - car.heading));
  const over = Math.abs(angle) - HITCH_MAX;
  if (over <= 0) return;
  const side = Math.sign(angle);
  const folding = (trailer.yawRate - car.yawRate) * side + JOINT_BETA / dt * over;
  if (folding <= 0) return;
  const turn = folding / (1 / car.spec.Izz + 1 / trailer.spec.Izz);
  trailer.yawRate -= side * turn / trailer.spec.Izz;
  car.yawRate += side * turn / car.spec.Izz;
}

/**
 * Whether the tractor was put somewhere since the trailer's last step (a reset, a teleport) rather
 * than driven there: it moved further than its speed takes it, or turned more than it can.
 * @param car the tractor
 * @param trailer its trailer
 * @param dt the step, s
 * @returns it jumped
 */
function wasReset(car: Car, trailer: Trailer, dt: number): boolean {
  const last = trailer.towedBy;
  if (!last) return false;
  const moved = Math.hypot(car.x - last.x, car.y - last.y),
    turned = Math.abs(Math.atan2(Math.sin(car.heading - last.heading),
      Math.cos(car.heading - last.heading)));
  return moved > Math.hypot(car.vx, car.vy) * dt * 2 + JUMP_M || turned > JUMP_RAD;
}

/**
 * One step of a tractor's trailer, after the tractor's own step: its body moved by its
 * forces, then the joint and the hitch stop (unless the pin has broken), and its weight on the
 * fifth wheel for the tractor's next step.
 * @param car the tractor
 * @param brake the tractor's brake pedal, 0..1
 * @param dt the step, s
 */
export function stepTrailer(car: Tractor, brake: number, dt: number): void {
  const trailer = car.trailer;
  if (!trailer) return;
  if (wasReset(car, trailer, dt)) lineUpTrailer(car, trailer);
  stepBody(trailer, trailer.pinFree ? 0 : brake, dt);
  car.hitchLoad = 0;
  trailer.towedBy = { x: car.x, y: car.y, heading: car.heading };
  if (trailer.pinFree) return;
  let impulse = 0;
  for (let pass = 0; pass < JOINT_PASSES; pass++) {
    hitchStop(car, trailer, dt);
    impulse += jointSweep(car, trailer, dt);
  }
  if (impulse > PIN_BREAK_DV * trailer.spec.mass) {
    trailer.pinFree = true;
    return;
  }
  trailer.pinGap = Math.hypot(tractorPin(car).x - trailerPin(trailer).x,
    tractorPin(car).y - trailerPin(trailer).y);
  car.hitchLoad = trailer.spec.mass * GRAVITY * trailer.spec.lr
    / (trailer.spec.lf + trailer.spec.lr);
}

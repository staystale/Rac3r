// OPEN WHEELS (owner C10): a single-seater's wheels stand outside its bodywork - the
// F1 / F2 body box is 1.30 m wide, the wheels 2.17 m across - and every collision tested only the
// box, so other cars, walls, armco, posts, trees and cones went through the wheels. Here each
// EXPOSED wheel (outside the box by more than EXPOSED_BY) is a small box of its own, tyre sized:
//  - against another car's body or wheels (contact.js carContacts -> wheelContacts), pushed at
//    the wheel so a wheel tap turns the car; wheel against wheel is a HARD KICK (owner: rubber
//    on rubber, the wheels turning against each other - bouncier, with a spin);
//  - against walls / armco (world/barriers.ts: its outer edge, corner by corner), posts, trees,
//    huts (the solid clamp, as a box) and the loose objects (cones/coneCar.js);
//  - a hard hit INTO a wheel (car, wall or solid) may RIP IT OFF (owner: from ~40 km/h, likelier
//    the harder) without the corner first being near wrecked, as a covered wheel needs
//    (damage.ts takes the note: the loose wheel, the bare corner dragging - its usual rules),
//    and the hit's damage lands mostly on that wheel's corner.
import { CORNER_OF_WHEEL } from '../world/wheels.ts';

// a tyre's radius (its box's half length), m; a wheel this far past the body box is exposed, m
const WHEEL_R = 0.33, EXPOSED_BY = 0.1;
// the bounce of a wheel on a car body (contact.js CAR_E) and of wheel on wheel (the kick), and the
// extra spin of the kick (x its impulse's own); the side scrub (contact.js CAR_SCRAPE)
const WHEEL_BODY_E = 0.25, WHEEL_WHEEL_E = 0.6, KICK_SPIN = 1.5, WHEEL_SCRAPE = 0.12;
// ripped off: a chance from RIP_FROM m/s into the wheel (40 km/h), RIP_P0 there, rising to every
// time RIP_SPAN m/s further (80 km/h)
const RIP_FROM = 40 / 3.6, RIP_P0 = 0.3, RIP_SPAN = 40 / 3.6;
// the share of a wheel hit's damage on its own corner (the rest by the hit's direction)
const WHEEL_SHARE = 0.6;
// the repair bill for a lost wheel (damage.ts)
const LOST_WHEEL_BILL = 400;

/** What this file reads of a car's spec. */
interface WheelSpec {
  len: number; wid: number; lf: number; lr: number; mass: number;
  trackWidth?: number; tyreWidth?: number;
}
/** A car as this file reads and moves it. */
export interface WheelCar {
  x: number; y: number; vx: number; vy: number; heading: number; yawRate: number;
  shake?: number; spec: WheelSpec; wheelOff?: boolean[];
  _wheelHit?: WheelHit | null;
}
/** The hardest hit into one of a car's wheels this step. */
export interface WheelHit { corner: number; into: number }
/** An oriented box, world m. */
interface Box { x: number; y: number; hl: number; hw: number; cos: number; sin: number }

/**
 * Whether a car's wheels stand outside its body box (the single-seaters).
 * @param car the car
 * @returns true when they are exposed
 */
export function hasOpenWheels(car: { spec: WheelSpec }): boolean {
  const spec = car.spec;
  return !!spec.trackWidth
    && spec.trackWidth / 2 + (spec.tyreWidth || 0.25) / 2 > spec.wid * 0.48 + EXPOSED_BY;
}

/**
 * The half length and half width of a car's wheel box, m.
 * @param car the car
 * @returns [half length, half width]
 */
export const wheelHalf = (car: { spec: WheelSpec }): [number, number] =>
  [WHEEL_R, (car.spec.tyreWidth || 0.25) / 2];

/**
 * How far from its centre a car's wheels reach, m (the solid grid's query).
 * @param car the car
 * @returns m
 */
export const wheelReach = (car: { spec: WheelSpec }): number => Math.hypot(
  Math.max(car.spec.lf, car.spec.lr) + WHEEL_R,
  (car.spec.trackWidth || 1.5) / 2 + (car.spec.tyreWidth || 0.25) / 2);

/**
 * One wheel's box, written into out (no allocation), or null when that wheel is off.
 * @param car the car
 * @param wheel carWheels order: 0 FL (+lateral), 1 FR, 2 RL, 3 RR
 * @param out the box to fill
 * @returns out, or null
 */
export function wheelBox(car: WheelCar, wheel: number, out: Box): Box | null {
  if (car.wheelOff && car.wheelOff[CORNER_OF_WHEEL[wheel]]) return null;
  const spec = car.spec, cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const fore = wheel < 2 ? spec.lf : -spec.lr, side = wheel % 2 === 0 ? 1 : -1;
  const lateral = side * (spec.trackWidth || 1.5) / 2;
  out.x = car.x + cosH * fore - sinH * lateral;
  out.y = car.y + sinH * fore + cosH * lateral;
  [out.hl, out.hw] = wheelHalf(car);
  out.cos = cosH;
  out.sin = sinH;
  return out;
}

/**
 * The outer edge of a wheel, front or back of the tyre (the barriers test points), into out.
 * @param car the car
 * @param index 0..7: wheel index * 2 + (0 the tyre's front, 1 its back)
 * @param out the point to fill
 * @param out.x world x
 * @param out.y world y
 * @returns out, or null when that wheel is off
 */
export function wheelEdge(car: WheelCar, index: number, out: { x: number; y: number }):
    { x: number; y: number } | null {
  const box = wheelBox(car, index >> 1, scratchA);
  if (!box) return null;
  const along = index % 2 === 0 ? WHEEL_R : -WHEEL_R;
  // outward: the side of the car the wheel is on
  const side = (index >> 1) % 2 === 0 ? 1 : -1, across = side * box.hw;
  out.x = box.x + box.cos * along - box.sin * across;
  out.y = box.y + box.sin * along + box.cos * across;
  return out;
}

/**
 * The damage corner of a wheel edge point (wheelEdge's index).
 * @param index 0..7
 * @returns the corner, damage.ts order
 */
export const edgeCorner = (index: number): number => CORNER_OF_WHEEL[index >> 1];

/**
 * Notes a hit into one of a car's wheels (the hardest of the step counts; damage.ts takes it).
 * @param car the car
 * @param corner the wheel's damage corner
 * @param into the closing speed into it, m/s
 */
export function noteWheelHit(car: WheelCar, corner: number, into: number): void {
  if (!(into > 0) || (car._wheelHit && car._wheelHit.into >= into)) return;
  car._wheelHit = { corner, into };
}

/**
 * Notes a wheel bump from the velocity a clamp changed: the closing speed is the old velocity
 * into the direction it was pushed.
 * @param car the car (velocity after the clamp)
 * @param corner the wheel's corner
 * @param vx0 velocity x before, m/s
 * @param vy0 velocity y before, m/s
 */
export function noteWheelBump(car: WheelCar, corner: number, vx0: number, vy0: number): void {
  const dvx = car.vx - vx0, dvy = car.vy - vy0, change = Math.hypot(dvx, dvy);
  if (change < 1e-6) return;
  noteWheelHit(car, corner, -(vx0 * dvx + vy0 * dvy) / change);
}

/**
 * Takes this step's wheel hit off the car.
 * @param car the car
 * @param car._wheelHit the note
 * @returns the hit, or null
 */
export function takeWheelHit(car: { _wheelHit?: WheelHit | null }): WheelHit | null {
  const note = car._wheelHit || null;
  car._wheelHit = null;
  return note;
}

/**
 * A hit's corner shares with most of it on the wheel's corner.
 * @param shares the shares by the hit's direction
 * @param note the wheel hit
 * @returns the shares, summing to 1
 */
export function wheelShares(shares: number[], note: WheelHit): number[] {
  return shares.map((share, corner) =>
    share * (1 - WHEEL_SHARE) + (corner === note.corner ? WHEEL_SHARE : 0));
}

/**
 * A hard hit into an exposed wheel may rip it off (the chance by the closing speed).
 * @param car the car (its damage state made)
 * @param car.wheelOff the wheels gone, by corner
 * @param car.wheelSpawn the corners whose loose wheel is still to be thrown (game/sim.js)
 * @param car.dmgBill the repair bill
 * @param note the wheel hit
 * @param rnd the random source
 */
export function ripWheel(car: { wheelOff: boolean[]; wheelSpawn?: number[]; dmgBill?: number },
    note: WheelHit, rnd: () => number): void {
  if (note.into < RIP_FROM || car.wheelOff[note.corner]) return;
  if (rnd() >= Math.min(1, RIP_P0 + (1 - RIP_P0) * (note.into - RIP_FROM) / RIP_SPAN)) return;
  car.wheelOff[note.corner] = true;
  car.dmgBill = (car.dmgBill || 0) + LOST_WHEEL_BILL;
  (car.wheelSpawn || (car.wheelSpawn = [])).push(note.corner);
}

// scratch boxes and the SAT result (no allocation per call: the contact pass runs every step)
const scratchA: Box = { x: 0, y: 0, hl: 0, hw: 0, cos: 1, sin: 0 };
const scratchB: Box = { x: 0, y: 0, hl: 0, hw: 0, cos: 1, sin: 0 };
const bodyBox: Box = { x: 0, y: 0, hl: 0, hw: 0, cos: 1, sin: 0 };
const sat = { best: 0, nx: 0, ny: 0 };

/**
 * A car's body box, as contact.js tests it, into out.
 * @param car the car
 * @param out the box to fill
 * @returns out
 */
function bodyOf(car: WheelCar, out: Box): Box {
  out.x = car.x;
  out.y = car.y;
  out.hl = car.spec.len * 0.48;
  out.hw = car.spec.wid * 0.48;
  out.cos = Math.cos(car.heading);
  out.sin = Math.sin(car.heading);
  return out;
}

/**
 * Separating-axis test of two boxes: the smallest overlap and its normal (first -> second) into
 * sat.
 * @param first a box
 * @param second a box
 * @returns true when they overlap
 */
function overlapBoxes(first: Box, second: Box): boolean {
  const dx = second.x - first.x, dy = second.y - first.y;
  sat.best = Infinity;
  for (let axis = 0; axis < 4; axis++) {
    const axisBox = axis < 2 ? first : second;
    const axisX = axis % 2 === 0 ? axisBox.cos : -axisBox.sin;
    const axisY = axis % 2 === 0 ? axisBox.sin : axisBox.cos;
    const reachFirst = first.hl * Math.abs(first.cos * axisX + first.sin * axisY)
      + first.hw * Math.abs(-first.sin * axisX + first.cos * axisY);
    const reachSecond = second.hl * Math.abs(second.cos * axisX + second.sin * axisY)
      + second.hw * Math.abs(-second.sin * axisX + second.cos * axisY);
    const gap = dx * axisX + dy * axisY, overlap = reachFirst + reachSecond - Math.abs(gap);
    if (overlap <= 0) return false;
    if (overlap < sat.best) {
      const sign = gap >= 0 ? 1 : -1;
      sat.best = overlap;
      sat.nx = axisX * sign;
      sat.ny = axisY * sign;
    }
  }
  return true;
}

/**
 * Pushes two overlapping cars apart and bounces them at the boxes' meeting point (contact.js's
 * response, at the wheel instead of half way between the centres).
 * @param first the first car
 * @param firstBox its box that touched
 * @param second the second car
 * @param secondBox its box that touched
 * @param bounce the restitution
 * @param spin the scale on the yaw the hit gives (1: the impulse's own)
 * @returns the closing speed, m/s (0 when they were already parting)
 */
function bounceBoxes(first: WheelCar, firstBox: Box, second: WheelCar, secondBox: Box,
    bounce: number, spin: number): number {
  const { best, nx, ny } = sat;
  const massA = first.spec.mass, massB = second.spec.mass, invSum = 1 / massA + 1 / massB;
  first.x -= nx * best * (1 / massA) / invSum;
  first.y -= ny * best * (1 / massA) / invSum;
  second.x += nx * best * (1 / massB) / invSum;
  second.y += ny * best * (1 / massB) / invSum;
  const pointX = (firstBox.x + secondBox.x) / 2, pointY = (firstBox.y + secondBox.y) / 2;
  const rax = pointX - first.x, ray = pointY - first.y, rbx = pointX - second.x,
    rby = pointY - second.y;
  const vax = first.vx - first.yawRate * ray, vay = first.vy + first.yawRate * rax;
  const vbx = second.vx - second.yawRate * rby, vby = second.vy + second.yawRate * rbx;
  const rvx = vbx - vax, rvy = vby - vay, normalSpeed = rvx * nx + rvy * ny;
  if (normalSpeed >= 0) return 0;
  const inertiaA = massA * (first.spec.len ** 2 + first.spec.wid ** 2) / 12;
  const inertiaB = massB * (second.spec.len ** 2 + second.spec.wid ** 2) / 12;
  const raxn = rax * ny - ray * nx, rbxn = rbx * ny - rby * nx;
  const jolt = -(1 + bounce) * normalSpeed
    / (invSum + raxn * raxn / inertiaA + rbxn * rbxn / inertiaB);
  const joltX = nx * jolt, joltY = ny * jolt;
  first.vx -= joltX / massA;
  first.vy -= joltY / massA;
  second.vx += joltX / massB;
  second.vy += joltY / massB;
  first.yawRate -= spin * (rax * joltY - ray * joltX) / inertiaA;
  second.yawRate += spin * (rbx * joltY - rby * joltX) / inertiaB;
  const tangentX = -ny, tangentY = nx, tangentSpeed = rvx * tangentX + rvy * tangentY;
  const scrub = -tangentSpeed * WHEEL_SCRAPE / invSum;
  first.vx -= tangentX * scrub / massA;
  first.vy -= tangentY * scrub / massA;
  second.vx += tangentX * scrub / massB;
  second.vy += tangentY * scrub / massB;
  const shake = Math.min(1, -normalSpeed * 0.08 * (bounce > WHEEL_BODY_E ? 2 : 1));
  first.shake = Math.min(1, (first.shake || 0) + shake);
  second.shake = Math.min(1, (second.shake || 0) + shake);
  return -normalSpeed;
}

/**
 * One car's exposed wheels against another car's body, and against its wheels when they are
 * exposed too.
 * @param owner the car whose wheels these are
 * @param other the other car
 * @param otherWheels whether the other's wheels are exposed
 * @returns true when anything touched
 */
function wheelsInto(owner: WheelCar, other: WheelCar, otherWheels: boolean): boolean {
  let touched = false;
  for (let wheel = 0; wheel < 4; wheel++) {
    if (!wheelBox(owner, wheel, scratchA)) continue;
    const corner = CORNER_OF_WHEEL[wheel];
    if (overlapBoxes(scratchA, bodyOf(other, bodyBox))) {
      touched = true;
      noteWheelHit(owner, corner, bounceBoxes(owner, scratchA, other, bodyBox, WHEEL_BODY_E, 1));
      if (!wheelBox(owner, wheel, scratchA)) continue;
    }
    if (!otherWheels) continue;
    for (let theirs = 0; theirs < 4; theirs++) {
      if (!wheelBox(other, theirs, scratchB) || !overlapBoxes(scratchA, scratchB)) continue;
      touched = true;
      const into = bounceBoxes(owner, scratchA, other, scratchB, WHEEL_WHEEL_E, KICK_SPIN);
      noteWheelHit(owner, corner, into);
      noteWheelHit(other, CORNER_OF_WHEEL[theirs], into);
    }
  }
  return touched;
}

/**
 * Two cars' exposed wheels (contact.js carContacts, after their bodies): each one's wheels
 * against the other's body and wheels.
 * @param first a car
 * @param second another
 * @returns true when anything touched
 */
export function wheelContacts(first: WheelCar, second: WheelCar): boolean {
  const firstOpen = hasOpenWheels(first), secondOpen = hasOpenWheels(second);
  if (!firstOpen && !secondOpen) return false;
  const reach = wheelReach(first) + wheelReach(second);
  const dx = second.x - first.x, dy = second.y - first.y;
  if (dx * dx + dy * dy > reach * reach) return false;
  let touched = false;
  if (firstOpen) touched = wheelsInto(first, second, secondOpen);
  if (secondOpen && wheelsInto(second, first, false)) touched = true;
  return touched;
}

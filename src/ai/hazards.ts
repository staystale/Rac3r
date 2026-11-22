// ai/hazards.ts - ?hazard: SHARED HAZARD AWARENESS (owner 11-22: when there is a crash ahead "ALL
// nearby cars react, like real life ... the car alongside the swerver also sees the crash and makes
// room"; "they shouldn't auto-slow, but avoid, and slow only if needed"). MEASURED before
// (tools/scratch/_pileups.mjs, round182, Brands / Spa): the drivers saw a stopped car and braked
// (11 of 13 / 11 of 17 touches into one were by a driver who had judged it stopped), but each chose
// its own way round, and the pack squeezed past at a median 12 km/h - most touches in a pile-up
// were between moving cars. Now:
// - ONE SIDE: the first driver to go round a stopped or crawling car (driverTraffic.ts haltedAhead)
//   sets the side for the field - the side it is already on - and every later driver's gap picker
//   reads the other side as taken (a phantom car there), so the field goes round together;
// - ROOM ALONGSIDE: a driver going round marks its car (car._hazardMove, the side), and a car
//   beside it, on that side, moves over to give it room.
// No speed cap of its own: the existing stopped-car brake (ai/stopDodge.ts) slows a car only when
// it cannot get across in time.
import { FIX } from '../core/fixes.ts';
import type { SeenCar } from './gapPick.ts';
import type { AiCar, CarsAcc } from './types.ts';
import type { StoppedCar } from './stopDodge.ts';

// the side each stopped car is gone round on (+1 / -1 off the line), kept while it stays stopped
const SIDES = new WeakMap<object, number>();
// m/s from which a stopped car is moving again (its side forgotten)
const MOVING_AGAIN = 6;
// THE TUNE (owner 11-22, round185: "still follow lines that are blocked / don't avoid pile-ups
// early enough ... multiple crashed / stopped cars make the AI want to go round earlier / wider /
// slow slightly"), each scaled by N, the stopped cars in the hazard (within HAZARD_SPAN of each
// other):
// m ahead a driver starts going round (ROUND_M, + ROUND_PER_CAR a car more, at most ROUND_MAX)
const ROUND_M = 60, ROUND_PER_CAR = 30, ROUND_MAX = 150;
// m wider than the stopped car's clearance it goes round, a car of the hazard
const WIDE_PER_CAR = 0.6;
// m/s2 a driver in line or beside plans to slow at for it, over N (one car: a slight lift, mostly
// near; several: earlier and more)
const LIFT_DECEL = 9;
// m along / across within which stopped cars are one hazard
const HAZARD_SPAN = 40, HAZARD_ACROSS = 8;
// m beside the stopped car's place counted as in line with it, past its clearance and the width
const IN_LINE_M = 1.5;
// a car slower than this share of my plan where it is, and 5 m/s slower than me, is a hazard
// (?hazard: the field's stranded share is 0.5 - a spinning car was read only once nearly stopped)
const SLOW_SHARE = 0.6;
// the reading distance x this for a car much slower than me (a hazard seen earlier)
const SLOW_LOOK = 1.5;
// m between middles a car beside a swerver opens to (a car's width and some)
const MAKE_ROOM_M = 3.2;

/**
 * Going round one hazard: within its range and in line (or beside), my car marked, my line moved
 * to its shared side, wider by its size, and a lift planned toward it (the stopped-car brake, as
 * ever, still stops me short when I cannot get across).
 * @param car my car
 * @param acc the cars' read (dodge, conflict, follow cap)
 * @param stop the stopped car
 * @param how its side, the hazard's size (cars), my m off my path and my target's
 * @param how.side -1 / 1
 * @param how.size cars
 * @param how.myLat m
 * @param how.latT m
 */
function goRound(car: AiCar, acc: CarsAcc, stop: StoppedCar, how: { side: number; size: number;
  myLat: number; latT: number }) {
  const { side, size, myLat, latT } = how;
  const range = Math.min(ROUND_MAX, ROUND_M + ROUND_PER_CAR * (size - 1));
  const wide = stop.clear + WIDE_PER_CAR * size;
  if (stop.fwd > range || Math.abs(myLat - stop.lat) >= wide + IN_LINE_M) return;
  car._hazardMove = side;
  const target = stop.lat + side * wide;
  // (already clear of it on the other side: carry on there, never cut back across it)
  const clearOther = Math.sign(myLat - stop.lat) === -side
    && Math.abs(myLat - stop.lat) > stop.clear;
  if (!clearOther && side * (target - (latT + acc.dodgeT)) > 0) {
    acc.dodgeT = target - latT;
    acc.conflict = true;
  }
  const gap = Math.max(0, stop.fwd - stop.along - car.spec.len / 2);
  acc.followCap = Math.min(acc.followCap, Math.max(0, stop.v)
    + Math.sqrt(2 * (LIFT_DECEL / size) * gap));
}

/**
 * The side a stopped car is gone round on: the one set, or mine (set now for the field).
 * @param stopped the stopped car
 * @param myLat my m off my path
 * @param stoppedLat its m off my path
 * @returns -1 / 1
 */
function sideFor(stopped: AiCar, myLat: number, stoppedLat: number): number {
  if (Math.hypot(stopped.vx, stopped.vy) > MOVING_AGAIN) SIDES.delete(stopped);
  let side = SIDES.get(stopped);
  if (!side) {
    side = Math.sign(myLat - stoppedLat) || 1;
    SIDES.set(stopped, side);
  }
  return side;
}

/**
 * ?hazard: a car ahead much slower than my plan where it is - a hazard before it has stopped.
 * @param vAlong its m/s along my way
 * @param speed my m/s
 * @param planV my plan's m/s where it is
 * @returns a hazard
 */
export function hazardSlow(vAlong: number, speed: number, planV: number): boolean {
  return FIX.hazard && vAlong < SLOW_SHARE * planV && vAlong < speed - 5;
}

/**
 * ?hazard: the reading distance's share for a car - further for one much slower than me.
 * @param vAlong its m/s along my way
 * @param speed my m/s
 * @returns the multiplier
 */
export function hazardLook(vAlong: number, speed: number): number {
  return FIX.hazard && vAlong < 0.5 * speed ? SLOW_LOOK : 1;
}

/**
 * The stopped cars in one hazard with a stopped car: those within HAZARD_SPAN along and
 * HAZARD_ACROSS across of it (itself included).
 * @param stop the stopped car
 * @param all every stopped car I see
 * @returns how many
 */
function hazardSize(stop: StoppedCar, all: StoppedCar[]): number {
  let size = 0;
  for (const other of all) {
    if (Math.abs(other.fwd - stop.fwd) < HAZARD_SPAN
      && Math.abs(other.lat - stop.lat) < HAZARD_ACROSS) size++;
  }
  return Math.max(1, size);
}

/**
 * ?hazard, after a driver has read the cars round it (driverTraffic.ts carsStep): the field's one
 * side round each stopped car (the other side read as taken by the gap picker), my car marked while
 * I go round one, and room made for a car beside me that is going round one toward me.
 * @param car my car
 * @param acc the cars' read (its stopped cars; its dodge for making room)
 * @param seen the cars the gap picker reads (a phantom added per stopped car)
 * @param mine my m off my path, my target's, and the cars beside me (m off my path, their cars)
 * @param mine.myLat m
 * @param mine.latT m
 * @param mine.beside the cars alongside: m off my path, the car
 */
export function hazardStep(car: AiCar, acc: CarsAcc, seen: SeenCar[], mine: { myLat: number;
  latT: number; beside: { lat: number; car: AiCar }[] }): void {
  car._hazardMove = 0;
  if (!FIX.hazard) return;
  const { myLat, latT, beside } = mine;
  const all = acc.stopped ?? [];
  for (const stop of all) {
    const side = sideFor(stop.car, myLat, stop.lat), size = hazardSize(stop, all);
    seen.push({ fwd: stop.fwd, lat: stop.lat - side * stop.clear, v: stop.v, across: 1,
      along: stop.along });
    goRound(car, acc, stop, { side, size, myLat, latT });
  }
  for (const other of beside) {
    const move = other.car._hazardMove ?? 0;
    if (!move || Math.sign(myLat - other.lat) !== move) continue;
    if (Math.abs(myLat - other.lat) >= MAKE_ROOM_M) continue;
    acc.dodgeT = other.lat + move * MAKE_ROOM_M - latT;
    acc.conflict = true;
  }
}

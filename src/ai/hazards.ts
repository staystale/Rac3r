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

// the side each stopped car is gone round on (+1 / -1 off the line), kept while it stays stopped
const SIDES = new WeakMap<object, number>();
// m/s from which a stopped car is moving again (its side forgotten)
const MOVING_AGAIN = 6;
// m ahead within which a driver in line with a stopped car is going round it (marks its car)
const ROUND_M = 60;
// m beside the stopped car's place counted as in line with it, past its clearance
const IN_LINE_M = 1.5;
// m between middles a car beside a swerver opens to (a car's width and some)
const MAKE_ROOM_M = 3.2;

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
  for (const stop of acc.stopped ?? []) {
    const side = sideFor(stop.car, myLat, stop.lat);
    seen.push({ fwd: stop.fwd, lat: stop.lat - side * stop.clear, v: stop.v, across: 1,
      along: stop.along });
    if (stop.fwd < ROUND_M && Math.abs(myLat - stop.lat) < stop.clear + IN_LINE_M) {
      car._hazardMove = side;
    }
  }
  for (const other of beside) {
    const move = other.car._hazardMove ?? 0;
    if (!move || Math.sign(myLat - other.lat) !== move) continue;
    if (Math.abs(myLat - other.lat) >= MAKE_ROOM_M) continue;
    acc.dodgeT = other.lat + move * MAKE_ROOM_M - latT;
    acc.conflict = true;
  }
}

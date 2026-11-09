// world/jersey.ts - THE JERSEY BARRIER (owner 11-09: "Can central reservation be a jersey barrier
// that flips cars at higher speed ?"): the motorway's concrete central barrier, its face sloped so
// a car glancing off it rides up on the near side's wheels. Fast enough, the lift throws it over -
// it rolls away from the barrier (roll.ts tripCheck, the one way any car starts to roll, as a flip
// ramp's: world/flipramps.ts). A car hitting it near square is stopped as by any wall.

import { FIX } from "../core/fixes.ts";
import type { BarrierSeg } from "./types.ts";

// m/s along the road from which a glancing car can ride up, and from which it nearly always does
const RIDE_FROM_V = 22, RIDE_FULL_V = 42;
// m/s into the face (the speed the hit took off it): a scrape below the first, a square hit above
// the second
const INTO_FROM = 1.2, INTO_UPTO = 12;
// the chance of the roll at RIDE_FULL_V and above, and the share of the car's speed it rolls with
const RIDE_MOST = 0.8, ROLL_SHARE = 0.12;
// steps after a ride-up chance before the next (one chance a hit, not every step of a scrape)
const RIDE_COOL_STEPS = 60;
// ?jerseyover=1: m/s from which a car can ride up (40 mph) and at which it always rolls (100 mph);
// from there a hit of any angle, under it a harder hit the faster it goes
const OVER_FROM_V = 17.9, OVER_FULL_V = 44.7;
// the share of the rolls at OVER_FULL_V that go on over the top into the other carriageway (fewer
// slower: x the speed's share), and m/s across it it goes over at: OVER_SHARE of the hit's, from
// OVER_CROSS_MIN to OVER_CROSS_MAX (a lane or two over, not across the whole carriageway)
const OVER_MOST = 0.9, OVER_SHARE = 0.5, OVER_CROSS_MIN = 6, OVER_CROSS_MAX = 8;

/**
 * A ride up the face (for roll.ts tripCheck): the roll's way, its sideways speed and chance, and
 * (?jerseyover=1) over the top - the way across the barrier and m/s it goes across at.
 */
export interface RideUp {
  dir: number; vLat: number; chance: number;
  over?: { nx: number; ny: number; v: number };
}

/** What the barrier reads of a car (and leaves for roll.ts tripCheck). */
export interface RidingCar {
  x: number; y: number; vx: number; vy: number; heading: number;
  _rideUp?: RideUp | null;
  _rideCool?: number;
}

/**
 * A car just clamped off a Jersey barrier (its speed before, after the clamp): the chance it rides
 * up and rolls, left for tripCheck - more the faster it goes, none for a scrape or a square hit.
 * @param car the car (its velocity after the clamp)
 * @param vx0 its velocity before, x
 * @param vy0 its velocity before, y
 * @param segs the barrier's segments (?jerseyover=1: the way across it)
 * @param rnd the dice (?jerseyover=1: over the top or back off it)
 */
export function rideUp(car: RidingCar, vx0: number, vy0: number, segs: BarrierSeg[] = [],
  rnd = Math.random): void {
  if ((car._rideCool ?? 0) > 0) return;
  const dvx = car.vx - vx0, dvy = car.vy - vy0, into = Math.hypot(dvx, dvy);
  const speed = Math.hypot(vx0, vy0);
  if (FIX.jerseyover) { rideOver(car, { dvx, dvy, into, speed }, segs, rnd); return; }
  if (into < INTO_FROM || into > INTO_UPTO || speed < RIDE_FROM_V) return;
  car._rideCool = RIDE_COOL_STEPS;
  // the barrier pushed the car toward the side its Δv points: the other side is on the face and
  // lifts, so it rolls toward the push (startRoll's dir: + toward the car's +y)
  const lat = -dvx * Math.sin(car.heading) + dvy * Math.cos(car.heading);
  const share = Math.min(1, (speed - RIDE_FROM_V) / (RIDE_FULL_V - RIDE_FROM_V));
  car._rideUp = { dir: Math.sign(lat) || 1, vLat: into + ROLL_SHARE * speed,
    chance: RIDE_MOST * share };
}

/**
 * rideUp's ?jerseyover=1 law: from 40 mph a car rides up and rolls, more the faster it goes and
 * the harder it hits - every car at 100 mph - most of the fast ones over the top: rolling toward
 * the barrier, going on across it (a tumbling car goes over it: physics/tumble.ts).
 * @param car the car (its velocity after the clamp)
 * @param hit the clamp's change of velocity (dvx, dvy), its size and the car's speed before
 * @param hit.dvx x
 * @param hit.dvy y
 * @param hit.into m/s
 * @param hit.speed m/s
 * @param segs the barrier's segments
 * @param rnd the dice
 */
function rideOver(car: RidingCar, hit: { dvx: number; dvy: number; into: number; speed: number },
  segs: BarrierSeg[], rnd: () => number): void {
  const share = Math.min(1, Math.max(0, (hit.speed - OVER_FROM_V) / (OVER_FULL_V - OVER_FROM_V)));
  if (hit.into < INTO_FROM || hit.speed < OVER_FROM_V || hit.into > INTO_UPTO / (1 - share))
    return;
  car._rideCool = RIDE_COOL_STEPS;
  const lat = -hit.dvx * Math.sin(car.heading) + hit.dvy * Math.cos(car.heading),
    away = Math.sign(lat) || 1, vLat = hit.into + ROLL_SHARE * hit.speed;
  // (across: from the car to the barrier's line - not the hit's push, which a scrape along the
  // face turns back along the road: MEASURED, _jerseycheck.mjs, every glancing car went back)
  const across = acrossTo(car, segs, hit), cross = Math.min(OVER_CROSS_MAX,
    Math.max(OVER_CROSS_MIN, OVER_SHARE * Math.abs(hit.dvx * across.nx + hit.dvy * across.ny)));
  const over = { nx: across.nx, ny: across.ny, v: cross };
  car._rideUp = rnd() < OVER_MOST * share ? { dir: -away, vLat, chance: share, over }
    : { dir: away, vLat, chance: share };
}

/**
 * The way across a barrier from a car: toward the nearest point of its line (no segments: against
 * the hit's push).
 * @param car the car (x, y)
 * @param segs the barrier's segments
 * @param hit the clamp's change of velocity (dvx, dvy) and its size
 * @param hit.dvx x
 * @param hit.dvy y
 * @param hit.into m/s
 * @returns the unit vector
 */
function acrossTo(car: { x: number; y: number }, segs: BarrierSeg[],
  hit: { dvx: number; dvy: number; into: number }): { nx: number; ny: number } {
  let best = Infinity, nx = -hit.dvx / hit.into, ny = -hit.dvy / hit.into;
  for (const seg of segs) {
    const frac = Math.max(0, Math.min(1, ((car.x - seg.ax) * seg.dx + (car.y - seg.ay) * seg.dy)
      / seg.l2));
    const awayX = seg.ax + seg.dx * frac - car.x, awayY = seg.ay + seg.dy * frac - car.y,
      dist = Math.hypot(awayX, awayY);
    if (dist < best && dist > 1e-6) { best = dist; nx = awayX / dist; ny = awayY / dist; }
  }
  return { nx, ny };
}

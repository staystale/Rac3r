// world/jersey.ts - THE JERSEY BARRIER (owner 11-09: "Can central reservation be a jersey barrier
// that flips cars at higher speed ?"; passed 11-09: "There should be a high chance to roll over
// jersey barrier - hitting it over 100mph should flip you and have a high chance to allow you over
// it into on coming traffic"): the motorway's concrete central barrier, its face sloped so a car
// hitting it rides up on the near side's wheels and rolls (roll.ts tripCheck, the one way any car
// starts to roll, as a flip ramp's: world/flipramps.ts) - from 40 mph, more the faster and harder,
// every car at 100 mph; most of the fast ones over the top into the other carriageway.
import type { BarrierSeg } from "./types.ts";

// m/s into the face (the speed the hit took off it): a scrape below the first; above the second,
// a square hit - it rolls only the faster it goes (INTO_UPTO / (1 - the speed's share))
const INTO_FROM = 1.2, INTO_UPTO = 12;
// the share of the car's speed it rolls with
const ROLL_SHARE = 0.12;
// steps after a ride-up chance before the next (one chance a hit, not every step of a scrape)
const RIDE_COOL_STEPS = 60;
// m/s from which a car can ride up (40 mph) and at which it always rolls (100 mph); from there a
// hit of any angle, under it a harder hit the faster it goes
const OVER_FROM_V = 17.9, OVER_FULL_V = 44.7;
// the share of the rolls at OVER_FULL_V that go on over the top into the other carriageway (fewer
// slower: x the speed's share), and m/s across it it goes over at: OVER_SHARE of the hit's, from
// OVER_CROSS_MIN to OVER_CROSS_MAX (a lane or two over, not across the whole carriageway)
const OVER_MOST = 0.9, OVER_SHARE = 0.5, OVER_CROSS_MIN = 6, OVER_CROSS_MAX = 8;

/**
 * A ride up the face (for roll.ts tripCheck): the roll's way, its sideways speed and chance, and
 * over the top - the way across the barrier and m/s it goes across at.
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
 * up and rolls, left for tripCheck - from 40 mph, more the faster it goes and the harder it hits,
 * every car at 100 mph - most of the fast ones over the top: rolling toward the barrier, going on
 * across it (a tumbling car goes over it: physics/tumble.ts); none for a scrape.
 * @param car the car (its velocity after the clamp)
 * @param vx0 its velocity before, x
 * @param vy0 its velocity before, y
 * @param segs the barrier's segments (the way across it)
 * @param rnd the dice (over the top or back off it)
 */
export function rideUp(car: RidingCar, vx0: number, vy0: number, segs: BarrierSeg[] = [],
  rnd = Math.random): void {
  if ((car._rideCool ?? 0) > 0) return;
  const dvx = car.vx - vx0, dvy = car.vy - vy0, into = Math.hypot(dvx, dvy);
  const speed = Math.hypot(vx0, vy0);
  const share = Math.min(1, Math.max(0, (speed - OVER_FROM_V) / (OVER_FULL_V - OVER_FROM_V)));
  if (into < INTO_FROM || speed < OVER_FROM_V || into > INTO_UPTO / (1 - share)) return;
  car._rideCool = RIDE_COOL_STEPS;
  // the barrier pushed the car toward the side its Δv points: the other side is on the face and
  // lifts (startRoll's dir: + toward the car's +y)
  const lat = -dvx * Math.sin(car.heading) + dvy * Math.cos(car.heading),
    away = Math.sign(lat) || 1, vLat = into + ROLL_SHARE * speed;
  // (across: from the car to the barrier's line - not the hit's push, which a scrape along the
  // face turns back along the road: MEASURED, _jerseycheck.mjs, every glancing car went back)
  const across = acrossTo(car, segs, { dvx, dvy, into }), cross = Math.min(OVER_CROSS_MAX,
    Math.max(OVER_CROSS_MIN, OVER_SHARE * Math.abs(dvx * across.nx + dvy * across.ny)));
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

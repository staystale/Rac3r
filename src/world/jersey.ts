// world/jersey.ts - THE JERSEY BARRIER (owner 11-09: "Can central reservation be a jersey barrier
// that flips cars at higher speed ?"): the motorway's concrete central barrier, its face sloped so
// a car glancing off it rides up on the near side's wheels. Fast enough, the lift throws it over -
// it rolls away from the barrier (roll.ts tripCheck, the one way any car starts to roll, as a flip
// ramp's: world/flipramps.ts). A car hitting it near square is stopped as by any wall.

// m/s along the road from which a glancing car can ride up, and from which it nearly always does
const RIDE_FROM_V = 22, RIDE_FULL_V = 42;
// m/s into the face (the speed the hit took off it): a scrape below the first, a square hit above
// the second
const INTO_FROM = 1.2, INTO_UPTO = 12;
// the chance of the roll at RIDE_FULL_V and above, and the share of the car's speed it rolls with
const RIDE_MOST = 0.8, ROLL_SHARE = 0.12;
// steps after a ride-up chance before the next (one chance a hit, not every step of a scrape)
const RIDE_COOL_STEPS = 60;

/** What the barrier reads of a car (and leaves for roll.ts tripCheck). */
export interface RidingCar {
  vx: number; vy: number; heading: number;
  _rideUp?: { dir: number; vLat: number; chance: number } | null;
  _rideCool?: number;
}

/**
 * A car just clamped off a Jersey barrier (its speed before, after the clamp): the chance it rides
 * up and rolls, left for tripCheck - more the faster it goes, none for a scrape or a square hit.
 * @param car the car (its velocity after the clamp)
 * @param vx0 its velocity before, x
 * @param vy0 its velocity before, y
 */
export function rideUp(car: RidingCar, vx0: number, vy0: number): void {
  if ((car._rideCool ?? 0) > 0) return;
  const dvx = car.vx - vx0, dvy = car.vy - vy0, into = Math.hypot(dvx, dvy);
  const speed = Math.hypot(vx0, vy0);
  if (into < INTO_FROM || into > INTO_UPTO || speed < RIDE_FROM_V) return;
  car._rideCool = RIDE_COOL_STEPS;
  // the barrier pushed the car toward the side its Δv points: the other side is on the face and
  // lifts, so it rolls toward the push (startRoll's dir: + toward the car's +y)
  const lat = -dvx * Math.sin(car.heading) + dvy * Math.cos(car.heading);
  const share = Math.min(1, (speed - RIDE_FROM_V) / (RIDE_FULL_V - RIDE_FROM_V));
  car._rideUp = { dir: Math.sign(lat) || 1, vLat: into + ROLL_SHARE * speed,
    chance: RIDE_MOST * share };
}

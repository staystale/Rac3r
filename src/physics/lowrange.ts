// physics/lowrange.ts - THE LOW RANGE of a car with a two-speed transfer box (the
// Defunder 110's LT230, the Strange Rover L322's). In LOW every gear turns the wheels LOW_RANGE
// times slower for the same engine speed - that much more pull at the wheels, that much less top
// speed (physics/powertrain.ts runPowertrain multiplies the final drive by rangeRatio). It is
// selected only when nearly stopped (SWITCH_BELOW_MS), by the player's lever (hud/lowlever.ts) or,
// for the AI, when it is bogged (stepAIRange). The traffic stays in high.

// the low range against the high, by car (the transfer box's own ratios)
// Defunder 110 (Land Rover Defender Td5): the LT230 box, high 1.211, low 3.320 - 2.742
// Strange Rover (Range Rover L322 2002-05): its two-speed box, high 1.0, low 2.69
export const LOW_RANGE: Record<string, number> = { 'defunder-110': 3.32 / 1.211,
  'strange-l322': 2.69 };
// LOW's traction: the driven wheels' longitudinal grip x this in low (owner: "turn grip up
// slightly when it's in low range ... to simulate the effect" - the low gearing's finer control of
// wheelspin, which this engine model, never stalling or lugging, does not give by itself). The
// owner's number to tune.
export const LOW_GRIP = 1.3;
// m/s under which the range may be changed (10 km/h: as a real box, nearly stopped)
export const SWITCH_BELOW_MS = 10 / 3.6;
// THE AI'S RULE: bogged on loose ground (grip under LOOSE_MU) or slow on a steep climb (a grade
// of 1 in 3 or more: STEEP_SIN, the slope's sine) - slower than BOGGED_MS for BOGGED_S with the
// throttle at BOGGED_THROTTLE or more - it takes low; back to high once on firm ground that is not
// steep, under the switch speed, for FIRM_S
const LOOSE_MU = 0.7, BOGGED_MS = 2, BOGGED_S = 1.5, BOGGED_THROTTLE = 0.8, FIRM_S = 2;
const STEEP_SIN = Math.sin(Math.atan(1 / 3));

/** A car as the range reads it: its spec's id, its velocity, its range and the AI's timers. */
export interface RangeCar {
  spec: { id: string; mass?: number }; vx: number; vy: number; lowRange?: boolean;
  slopeLong?: number;   // N along the car (physics/slopes: negative facing uphill)
  _bogS?: number; _firmS?: number;
  rangeRefusedAt?: number;   // wall-clock ms of the last refused pull (the lever's flash)
}

/**
 * The car's model id (a racer's "#2" suffix off).
 * @param car the car
 * @returns its id
 */
const modelOf = (car: RangeCar) => String(car.spec.id).split('#')[0];

/**
 * Whether the car has a low range (a two-speed box).
 * @param car the car
 * @returns it has
 */
export const hasLowRange = (car: RangeCar) => !!LOW_RANGE[modelOf(car)];

/**
 * The final drive's multiplier: LOW_RANGE in low, else 1.
 * @param car the car
 * @returns the multiplier
 */
export const rangeRatio = (car: RangeCar) =>
  car.lowRange && hasLowRange(car) ? LOW_RANGE[modelOf(car)] : 1;

/**
 * The traction grip multiplier of one axle: LOW_GRIP on a driven axle in low, else 1.
 * @param car the car (its spec's drive split: 0 rear .. 1 front)
 * @param axle 0 front, 1 rear
 * @returns the multiplier
 */
export function rangeGrip(car: RangeCar & { spec: { drive?: number } }, axle: number): number {
  if (!car.lowRange || !hasLowRange(car)) return 1;
  const drive = car.spec.drive ?? 0;
  return (axle === 0 ? drive > 0 : drive < 1) ? LOW_GRIP : 1;
}

/**
 * Asks for the low (or high) range: done only under SWITCH_BELOW_MS.
 * @param car the car
 * @param low true for low
 * @returns true when the car is in the asked range now (false: refused, too fast)
 */
export function requestRange(car: RangeCar, low: boolean): boolean {
  if (!hasLowRange(car)) return false;
  if (!!car.lowRange === low) return true;
  if (Math.hypot(car.vx, car.vy) >= SWITCH_BELOW_MS) return false;
  car.lowRange = low;
  return true;
}

/**
 * Whether the going calls for low: loose ground, or a climb of 1 in 3 or more.
 * @param car the car (its slope force and mass)
 * @param groundMu the grip of the ground under it
 * @returns hard going
 */
function isHardGoing(car: RangeCar, groundMu: number): boolean {
  const climb = -(car.slopeLong || 0) / ((car.spec.mass || 1500) * 9.81);
  return groundMu < LOOSE_MU || climb >= STEEP_SIN;
}

/**
 * The AI's range, each step: low when bogged or slow on a steep climb, high again when on firm,
 * gentler ground and slow.
 * @param car the AI car
 * @param throttle its throttle this step, 0..1
 * @param groundMu the grip of the ground under it
 * @param dt the step, s
 */
export function stepAIRange(car: RangeCar, throttle: number, groundMu: number, dt: number): void {
  if (!hasLowRange(car)) return;
  const speed = Math.hypot(car.vx, car.vy), hard = isHardGoing(car, groundMu);
  const bogged = hard && speed < BOGGED_MS && throttle >= BOGGED_THROTTLE;
  car._bogS = bogged ? (car._bogS || 0) + dt : 0;
  const firm = !hard && speed < SWITCH_BELOW_MS;
  car._firmS = firm && car.lowRange ? (car._firmS || 0) + dt : 0;
  if (!car.lowRange && car._bogS >= BOGGED_S) requestRange(car, true);
  else if (car.lowRange && car._firmS >= FIRM_S) requestRange(car, false);
}

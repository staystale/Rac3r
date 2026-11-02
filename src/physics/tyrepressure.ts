// tyrepressure.ts - TYRE PRESSURE (car systems C1 / C2; owner: punctures that go down by what
// caused them, a flat that squashes, pulls and drags, then runs to the rim). Each tyre keeps a
// pressure (1 full .. 0 flat) and a leak rate. A big hit or a heat burst lets it go at once
// (about half a second, with a sharp pull at the moment it goes); debris, nails or a bush let it
// down slowly (10-30 s). Driven flat, the rubber comes off by a CHANCE that grows with the
// metres run flat (owner: so the tyres do not all go at the same moment): half by ~1 km, sooner
// when cornering hard; then the wheel runs on its rim - less grip again, more drag, and metal on
// hard ground (world/metalscrape.ts: sparks, a scored line, a chance to break the surface).
// damage.ts owns the puncture (where it starts) and turns these numbers into car.wreck; RESET /
// RESTART / an AI's reset mend them with the rest of the damage. Arrays are by damage CORNER
// (0 front -y, 1 front +y, 2 rear -y, 3 rear +y). A wheel that has come off (world/wheels.ts
// wheelGone) has no tyre: no new leak, no air lost, no run to the rim, nothing in car.wreck.
import { wheelGone } from '../world/wheels.ts';
import { FIX } from '../core/fixes.ts';

/** The tyre-pressure state on a car (all four arrays by damage corner). */
export interface PressureState {
  tyreP: number[];       // pressure, 1 full .. 0 flat
  tyreLeak: number[];    // pressure lost a second (0 = holding)
  flatRun: number[];     // metres driven flat (toward the rim)
  onRim: boolean[];      // the rubber has come off: running on the rim
  tyreKick: number;      // the sharp pull at the moment a tyre goes, rad of toe, decaying
}
/** A car as this file reads it. */
export interface PressureCar extends Partial<PressureState> {
  vx: number; vy: number; yawRate?: number;
  tyreFx?: TyreEvent[];
  wheelOff?: boolean[];
}
/** A moment the particles show: the puff when a tyre goes, the shreds when it reaches the rim. */
export interface TyreEvent { corner: number; kind: 'puff' | 'shreds' }

// pressure lost a second when a tyre BURSTS (a big hit, a heat burst): flat in half a second
const FAST_LEAK = 2;
// a slow puncture (debris, nails, a bush) goes flat in SLOW_MIN_S..SLOW_MIN_S + SLOW_SPREAD_S
const SLOW_MIN_S = 10, SLOW_SPREAD_S = 20;
// below this a tyre counts as flat: it runs toward the rim
const FLAT_BELOW = 0.05;
// the run to the rim is a Weibull wear-out over the metres driven flat (a hazard rising with
// them): shape RIM_SHAPE, scale RIM_SCALE_M - a tenth of flat tyres are on the rim by ~530 m,
// half by ~1 km, nine tenths by ~1.5 km (owner: ~1 km). Cornering wears it sooner (RIM_CORNER_K
// more metres a g of cornering).
const RIM_SHAPE = 3, RIM_SCALE_M = 1130, RIM_CORNER_K = 2;
// the sharp pull when a tyre bursts (rad of toe toward that side, dying away over KICK_TAU_S)
const KICK_TOE = 0.04, KICK_TAU_S = 0.35;
// grip of an axle by its softest tyre: a flat one 0.7 (the old puncture), a rim 0.45 (as a lost
// wheel)
const FLAT_GRIP = 0.7, RIM_GRIP = 0.45;
// the steady pull of a soft tyre toward its side (rad of toe at flat; front, rear), and the
// extra rolling drag (share of the car's) of a flat wheel / a rim
const PULL_FRONT = 0.012, PULL_REAR = 0.005, DRAG_FLAT = 0.75, DRAG_RIM = 1.5;
const GRAVITY = 9.81;
// ?flatgrip=1 (owner 11-02: "when punctured and flat but still rubber there, a tyre should be
// nearly as grippy although not quite but it should create a reasonable amount of drag on that
// side / currently it seems even one puncture make the whole axel slippy"; the muscle car could
// hardly pull away on one flat rear). A flat tyre keeps FLAT_GRIP_REAL of its grip, an axle's grip
// is the MEAN of its two tyres (was the softer one's), and a flat wheel / a rim drags at its own
// corner with a rolling coefficient of CRR_FLAT / CRR_RIM of that wheel's static load (a good
// tyre ~0.015): the drag slows the car and, being one side, turns it toward the flat
// (vehicle.ts). The symmetric DRAG_FLAT / DRAG_RIM are left out under it.
const FLAT_GRIP_REAL = 0.9, CRR_FLAT = 0.12, CRR_RIM = 0.18;


/**
 * Makes the pressure state new: four full tyres.
 * @param car the car
 */
export function pressureInit(car: PressureCar): void {
  car.tyreP = [1, 1, 1, 1];
  car.tyreLeak = [0, 0, 0, 0];
  car.flatRun = [0, 0, 0, 0];
  car.onRim = [false, false, false, false];
  car.tyreKick = 0;
}

/**
 * A tyre starts losing air: a burst (fast, a sharp pull and a puff) or a slow puncture.
 * @param car the car (pressureInit has run)
 * @param corner the damage corner
 * @param fast true for a burst
 * @param rnd the random source (a slow leak's pace)
 */
export function startLeak(car: PressureCar, corner: number, fast: boolean,
  rnd: () => number = Math.random): void {
  if (!car.tyreLeak || !car.tyreP || car.tyreLeak[corner] > 0 || wheelGone(car, corner)) return;
  car.tyreLeak[corner] = fast ? FAST_LEAK : 1 / (SLOW_MIN_S + SLOW_SPREAD_S * rnd());
  if (fast) {
    // the car pulls hard toward the side that went (+y corners 1 and 3 pull +y)
    car.tyreKick = KICK_TOE * (corner % 2 ? 1 : -1) * (corner < 2 ? 1 : 0.5);
    pushTyreEvent(car, { corner, kind: 'puff' });
  }
}

/**
 * One physics step of the tyres' air: leaks, the run to the rim, the burst pull dying away.
 * @param car the car
 * @param dt the step, s
 * @param rnd the random source (the run to the rim)
 * @returns true when anything changed that car.wreck reads (damage.ts re-derives it)
 */
export function stepTyrePressure(car: PressureCar, dt: number,
  rnd: () => number = Math.random): boolean {
  const pressure = car.tyreP, leak = car.tyreLeak, run = car.flatRun, rim = car.onRim;
  if (!pressure || !leak || !run || !rim) return false;
  let changed = false;
  if (car.tyreKick) {
    car.tyreKick *= Math.exp(-dt / KICK_TAU_S);
    if (Math.abs(car.tyreKick) < 1e-4) car.tyreKick = 0;
    changed = true;
  }
  const speed = Math.hypot(car.vx, car.vy);
  const cornerG = Math.abs((car.yawRate || 0) * speed) / GRAVITY;
  const metres = speed * dt * (1 + RIM_CORNER_K * cornerG);
  for (let corner = 0; corner < 4; corner++) {
    if (!wheelGone(car, corner) && stepCorner(car, corner, metres, dt, rnd)) changed = true;
  }
  return changed;
}

/**
 * One tyre's step: its leak, then (flat) the run toward the rim.
 * @param car the car (pressureInit has run)
 * @param corner the damage corner
 * @param metres how far it ran this step, cornering counted
 * @param dt seconds
 * @param rnd the random source
 * @returns true when anything changed that car.wreck reads
 */
function stepCorner(car: PressureCar, corner: number, metres: number, dt: number,
  rnd: () => number): boolean {
  const pressure = car.tyreP!, leak = car.tyreLeak!, run = car.flatRun!, rim = car.onRim!;
  let changed = false;
  if (leak[corner] > 0 && pressure[corner] > 0) {
    pressure[corner] = Math.max(0, pressure[corner] - leak[corner] * dt);
    changed = true;
  }
  if (rim[corner] || pressure[corner] > FLAT_BELOW) return changed;
  const before = run[corner];
  run[corner] += metres;
  if (rnd() < rimChance(before, run[corner])) {
    rim[corner] = true;
    pressure[corner] = 0;
    pushTyreEvent(car, { corner, kind: 'shreds' });
    changed = true;
  }
  return changed;
}

/**
 * The chance the rubber comes off while the flat run goes from one distance to the next (the
 * Weibull wear-out: the chance it survived to the start that it fails before the end).
 * @param fromM metres run flat before this step
 * @param toM metres run flat after it
 * @returns the chance, 0..1
 */
function rimChance(fromM: number, toM: number): number {
  const wearFrom = (fromM / RIM_SCALE_M) ** RIM_SHAPE, wearTo = (toM / RIM_SCALE_M) ** RIM_SHAPE;
  return 1 - Math.exp(wearFrom - wearTo);
}

/**
 * The grip of one tyre by its air: full 1, flat FLAT_GRIP, on the rim RIM_GRIP.
 * @param pressure the tyre's pressure, 0..1
 * @param isOnRim the rubber is off
 * @returns the grip multiplier
 */
function tyreGrip(pressure: number, isOnRim: boolean): number {
  const flat = FIX.flatGrip ? FLAT_GRIP_REAL : FLAT_GRIP;
  return isOnRim ? RIM_GRIP : 1 - (1 - flat) * (1 - pressure);
}

/**
 * What the tyres' air adds to car.wreck. flatDrag / flatYaw (?flatgrip): the soft wheels' extra
 * rolling coefficients summed, and summed by side (+y +), each a share of one wheel's load.
 */
export interface PressureWreck {
  gripF: number; gripR: number; toe: number; roll: number; flatDrag: number; flatYaw: number;
}
/**
 * The axles' grip (by the softer tyre), the pull toward soft tyres plus the burst kick, and the
 * extra rolling drag.
 * @param car the car (pressureInit has run)
 * @returns the multipliers / additions for car.wreck
 */
export function pressureWreck(car: PressureCar): PressureWreck {
  const pressure = car.tyreP!, rim = car.onRim!;
  // a wheel gone counts as a full tyre here: the lost wheel's own rules (tyres.ts, damage.ts)
  const grip = [0, 1, 2, 3].map((corner) => (wheelGone(car, corner) ? 1
    : tyreGrip(pressure[corner], rim[corner])));
  let toe = car.tyreKick || 0, roll = 0, flatDrag = 0, flatYaw = 0;
  for (let corner = 0; corner < 4; corner++) {
    if (wheelGone(car, corner)) continue;
    const soft = 1 - pressure[corner], side = corner % 2 ? 1 : -1;
    toe += (corner < 2 ? PULL_FRONT : PULL_REAR) * side * soft;
    if (!FIX.flatGrip) { roll += rim[corner] ? DRAG_RIM : DRAG_FLAT * soft; continue; }
    const crr = rim[corner] ? CRR_RIM : CRR_FLAT * soft;
    flatDrag += crr;
    flatYaw += crr * side;
  }
  const axle = FIX.flatGrip ? (left: number, right: number) => (left + right) / 2 : Math.min;
  return { gripF: axle(grip[0], grip[1]), gripR: axle(grip[2], grip[3]), toe, roll, flatDrag,
    flatYaw };
}

/**
 * Has this tyre been punctured (leaking, flat or on its rim) since the last repair?
 * @param car the car
 * @param corner the damage corner
 * @returns true once a leak has started
 */
export function isPunctured(car: PressureCar, corner: number): boolean {
  return !!car.tyreLeak && car.tyreLeak[corner] > 0;
}

/**
 * Is this tyre flat (or on its rim)?
 * @param car the car
 * @param corner the damage corner
 * @returns true when flat
 */
export function isFlat(car: PressureCar, corner: number): boolean {
  return !!car.tyreP && (car.tyreP[corner] <= FLAT_BELOW || !!car.onRim?.[corner]);
}

/**
 * Queues a tyre moment for the particles, keeping the last 8.
 * @param car the car
 * @param event the moment
 */
function pushTyreEvent(car: PressureCar, event: TyreEvent) {
  const queue = car.tyreFx || (car.tyreFx = []);
  queue.push(event);
  if (queue.length > 8) queue.shift();
}

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
// (0 front -y, 1 front +y, 2 rear -y, 3 rear +y), as car.punct.

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

let flatsOn = false;
/**
 * ?flats=1: punctures go through tyre pressure (owner test).
 * @param isOn the switch
 */
export function setFlats(isOn: boolean): void { flatsOn = isOn; }
/** @returns true when ?flats=1 is on */
export function flatsEnabled(): boolean { return flatsOn; }

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
  if (!car.tyreLeak || !car.tyreP || car.tyreLeak[corner] > 0) return;
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
  for (let corner = 0; corner < 4; corner++) {
    if (leak[corner] > 0 && pressure[corner] > 0) {
      pressure[corner] = Math.max(0, pressure[corner] - leak[corner] * dt);
      changed = true;
    }
    if (rim[corner] || pressure[corner] > FLAT_BELOW) continue;
    const before = run[corner];
    run[corner] += speed * dt * (1 + RIM_CORNER_K * cornerG);
    if (rnd() < rimChance(before, run[corner])) {
      rim[corner] = true;
      pressure[corner] = 0;
      pushTyreEvent(car, { corner, kind: 'shreds' });
      changed = true;
    }
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
  return isOnRim ? RIM_GRIP : 1 - (1 - FLAT_GRIP) * (1 - pressure);
}

/** What the tyres' air adds to car.wreck. */
export interface PressureWreck { gripF: number; gripR: number; toe: number; roll: number }
/**
 * The axles' grip (by the softer tyre), the pull toward soft tyres plus the burst kick, and the
 * extra rolling drag.
 * @param car the car (pressureInit has run)
 * @returns the multipliers / additions for car.wreck
 */
export function pressureWreck(car: PressureCar): PressureWreck {
  const pressure = car.tyreP!, rim = car.onRim!;
  const grip = [0, 1, 2, 3].map((corner) => tyreGrip(pressure[corner], rim[corner]));
  let toe = car.tyreKick || 0, roll = 0;
  for (let corner = 0; corner < 4; corner++) {
    const soft = 1 - pressure[corner], side = corner % 2 ? 1 : -1;
    toe += (corner < 2 ? PULL_FRONT : PULL_REAR) * side * soft;
    roll += rim[corner] ? DRAG_RIM : DRAG_FLAT * soft;
  }
  return { gripF: Math.min(grip[0], grip[1]), gripR: Math.min(grip[2], grip[3]), toe, roll };
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

// engineheat.ts - RADIATOR + ENGINE TEMPERATURE (car systems C3; owner: a thermostat holds the
// engine at its temperature, airflow / air temperature / rain / splashes cool it, a front hit
// cracks the radiator and the water drips out, it overheats only when the water is nearly gone,
// power fades when hot, and it SEIZES - RESET mends it; an oil leak -> pressure light -> seize).
// A lumped engine: heat comes in by the power used (throttle x revs), goes out through the
// radiator (thermostat opening, the water left, the airflow over it, engine minus air) and a
// little through the block. With a full radiator it holds ~88-90 C on any day, a crawl at 40 C
// included; with the water gone only the block sheds heat, so driving on rises ~0.5-1 C a second
// and coasting cools it. damage.ts owns the cracks (a hit) and folds the power share into
// car.wreck; RESET / RESTART / an AI's reset mend it with the rest of the damage.
// THE LEAK IS WATER (owner: the same liquid as the rain, behaving the same): what leaks out
// lands as the tyres' water in the wear cells (world/puddles.ts rules - the field's look and the
// puddle grip, tyres clear it, it dries in a dry spell, freezes to black ice, churns dirt to
// mud), a cell's worth for every 1 / WATER_CELLS of the radiator lost: the worse the leak, the
// closer together the wet cells; a car standing still pools under its nose.
import { WEATHER } from '../world/weather.ts';
import { SPRAY_WET } from '../world/surfaces.ts';
import { getCell, wearDirty, WEAR_CELL } from '../world/wear.ts';
import { spillOil, DRIP_GEN } from '../world/oil.ts';

/** The engine state on a car. */
export interface EngineState {
  engT: number;          // engine temperature, C
  engWater: number;      // radiator water, 1 full .. 0 empty
  engLeak: number;       // water lost a second (0 = sound)
  engOil: number;        // oil, 1 full .. 0 empty
  oilLeak: number;       // oil lost a second (0 = sound)
  seizeT: number;        // s of seizing (130 C+ or no oil); SEIZE_S seizes it
  engSeized: boolean;    // seized: no power until a reset
  engPowerK: number;     // the power share heat leaves, 1 .. 0 (damage.ts derive reads it)
  leakCells: number;     // wet cells owed by the water lost (one lands each time it passes 1)
  oilCells: number;      // oil cells owed by the oil lost (?oil=1, world/oil.ts)
}
/** A car as this file reads it. */
export interface EngineCar extends Partial<EngineState> {
  x: number; y: number; vx: number; vy: number; heading: number; rpm: number;
  spec: { redline: number; len: number };
  throttleUsed?: number;
  wheelSurf?: ({ spray?: unknown } | null)[] | null;
}

// C: the thermostat starts to open at THERMO_C and is fully open THERMO_SPAN later (holds ~88-90)
const THERMO_C = 87, THERMO_SPAN = 5;
// C a second of heat in: HEAT_FULL at full throttle at the redline, HEAT_IDLE_SHARE of it idling
const HEAT_FULL = 1.6, HEAT_IDLE_SHARE = 0.08;
// the radiator: C a second per C over the air per unit of airflow, fully open with full water;
// it loses its grip on the heat only below RAD_LOW_WATER water (owner: overheats nearly empty).
// RAD_K 0.1 holds a full-throttle crawl at 40 C air under 92 C.
const RAD_K = 0.1, RAD_LOW_WATER = 0.25;
// airflow: the fan at a standstill, + up to 1 by FULL_AIR_MPS, rain and wheel splashes on top
const FAN_AIR = 0.35, FULL_AIR_MPS = 30, RAIN_AIR = 0.3, SPLASH_AIR = 0.6;
// what the block sheds with no radiator, C a second per C over the air, up to 1 + BLOCK_AIR
// times that in the full airflow (coasting at 70 km/h with the water gone cools ~0.1 C a second)
const BLOCK_K = 0.0015, BLOCK_AIR = 1;
// power fades from FADE_FROM_C to FADE_LOW at SEIZE_C; SEIZE_S s at SEIZE_C (or with no oil)
// seizes it
const FADE_FROM_C = 115, FADE_LOW = 0.5, SEIZE_C = 130, SEIZE_S = 10;
// a front hit adding CRACK_HIT+ to a front corner cracks the radiator: empty in SLOW_LEAK_S, down
// to FAST_LEAK_S for a hit of CRACK_HIT + CRACK_SPAN
const CRACK_HIT = 0.15, CRACK_SPAN = 0.45, SLOW_LEAK_S = 240, FAST_LEAK_S = 40;
// a front hit adding SUMP_HIT+ cracks the sump SUMP_P of the time, a rollover impact ROLL_SUMP_P;
// the oil drains in OIL_MIN_S..OIL_MIN_S + OIL_SPREAD_S; the light comes on under OIL_LOW
const SUMP_HIT = 0.35, SUMP_P = 0.3, ROLL_SUMP_P = 0.1, OIL_MIN_S = 60, OIL_SPREAD_S = 60;
export const OIL_LOW = 0.2;
// a full radiator's water, in wear cells of water on the ground (1.5 m squares); where it
// leaves the car (share of the length ahead of the centre)
const WATER_CELLS = 60, LEAK_AT = 0.3;
// a full sump's oil, in wear cells of oil on the ground (?oil=1), dripped under the engine
const OIL_CELLS = 20;
// the power share moves car.wreck in steps this big (derive is not run every step)
const POWER_STEP = 0.01;


/**
 * Makes the engine state new: warm, full of water and oil, nothing leaking.
 * @param car the car
 */
export function engineInit(car: EngineCar): void {
  car.engT = THERMO_C + 1;
  car.engWater = 1;
  car.engLeak = 0;
  car.engOil = 1;
  car.oilLeak = 0;
  car.seizeT = 0;
  car.engSeized = false;
  car.engPowerK = 1;
  car.leakCells = 0;
  car.oilCells = 0;
}

/**
 * The share of the wheels throwing water (a puddle or a wet road), 0..1.
 * @param car the car
 * @returns 0..1
 */
function splashShare(car: EngineCar): number {
  const under = car.wheelSurf;
  if (!under) return 0;
  let wet = 0;
  for (const ground of under) if (ground && ground.spray === SPRAY_WET) wet++;
  return wet / 4;
}

/**
 * C a second the radiator and the block take out at the car's temperature.
 * @param car the car
 * @param state the engine state
 * @returns C a second
 */
function coolingRate(car: EngineCar, state: EngineState): number {
  const speed = Math.hypot(car.vx, car.vy);
  const overAir = state.engT - WEATHER.tempC;
  const open = Math.max(0, Math.min(1, (state.engT - THERMO_C) / THERMO_SPAN));
  const water = Math.min(1, state.engWater / RAD_LOW_WATER);
  const speedShare = Math.min(1, speed / FULL_AIR_MPS);
  const airflow = FAN_AIR + speedShare + RAIN_AIR * WEATHER.rain
    + SPLASH_AIR * splashShare(car) * Math.min(1, speed / 5);
  return RAD_K * open * water * airflow * overAir
    + BLOCK_K * (1 + BLOCK_AIR * speedShare) * overAir;
}

/**
 * The power share the heat leaves: 1 under FADE_FROM_C, FADE_LOW at SEIZE_C, 0 seized.
 * @param state the engine state
 * @returns 0..1
 */
function heatPower(state: EngineState): number {
  if (state.engSeized) return 0;
  const over = Math.max(0, Math.min(1, (state.engT - FADE_FROM_C) / (SEIZE_C - FADE_FROM_C)));
  return 1 - (1 - FADE_LOW) * over;
}

/**
 * Water lands on the ground under the radiator: bare ground in that wear cell becomes the tyres'
 * water (as meltwater does, world/puddles.ts); a cell already covered takes it in.
 * @param x world x, m
 * @param y world y, m
 */
function wetCellAt(x: number, y: number) {
  const cell = getCell(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL), true);
  if (!cell || cell.fixed || cell.cover) return;
  cell.cover = 'wet';
  cell.standing = true;
  cell.dry = 0;
  cell.scrub = 0;
  cell.passes = 0;
  cell.current = 'wet';
  wearDirty.push(cell);
}

/**
 * Lets the water and oil out; the water lands on the ground as water, the oil as oil.
 * @param car the car
 * @param state the engine state
 * @param dt the step, s
 */
function stepLeaks(car: EngineCar, state: EngineState, dt: number) {
  if (state.engLeak > 0 && state.engWater > 0) {
    const lost = Math.min(state.engWater, state.engLeak * dt);
    state.engWater -= lost;
    state.leakCells += lost * WATER_CELLS;
    if (state.leakCells >= 1) {
      state.leakCells -= 1;
      const ahead = car.spec.len * LEAK_AT;
      wetCellAt(car.x + Math.cos(car.heading) * ahead, car.y + Math.sin(car.heading) * ahead);
    }
  }
  if (state.oilLeak > 0 && state.engOil > 0) {
    const lost = Math.min(state.engOil, state.oilLeak * dt);
    state.engOil -= lost;
    state.oilCells += lost * OIL_CELLS;
    if (state.oilCells >= 1) {
      state.oilCells -= 1;
      const ahead = car.spec.len * LEAK_AT * 0.5;
      spillOil(car.x + Math.cos(car.heading) * ahead, car.y + Math.sin(car.heading) * ahead,
        DRIP_GEN);
    }
  }
}

/**
 * One physics step of the engine: heat in and out, the leaks, the seizing.
 * @param car the car (engineInit has run)
 * @param dt the step, s
 * @returns true when the power share moved (damage.ts derives car.wreck again)
 */
export function stepEngine(car: EngineCar, dt: number): boolean {
  if (car.engT === undefined) return false;
  const state = car as EngineCar & EngineState;
  stepLeaks(car, state, dt);
  const revs = Math.max(0, Math.min(1, car.rpm / car.spec.redline));
  const load = (car.throttleUsed || 0) * revs;
  const heatIn = state.engSeized ? 0
    : HEAT_FULL * (HEAT_IDLE_SHARE + (1 - HEAT_IDLE_SHARE) * load) * state.engPowerK;
  state.engT += (heatIn - coolingRate(car, state)) * dt;
  const seizing = !state.engSeized && (state.engT >= SEIZE_C || state.engOil <= 0);
  state.seizeT = seizing ? state.seizeT + dt : Math.max(0, state.seizeT - dt * 0.5);
  const wasSeized = state.engSeized;
  if (state.seizeT >= SEIZE_S) state.engSeized = true;
  const power = heatPower(state);
  if (state.engSeized !== wasSeized || Math.abs(power - state.engPowerK) >= POWER_STEP
      || (power === 1 && state.engPowerK !== 1)) {
    state.engPowerK = power;
    return true;
  }
  return false;
}

/**
 * A hard hit's share on the front: cracks the radiator, and maybe the sump.
 * @param car the car (engineInit has run)
 * @param frontAdd the damage the hit added to the harder-hit front corner
 * @param rnd the random source
 */
export function crackOnHit(car: EngineCar, frontAdd: number, rnd: () => number): void {
  if (car.engT === undefined || frontAdd < CRACK_HIT) return;
  const state = car as EngineCar & EngineState;
  const size = Math.min(1, (frontAdd - CRACK_HIT) / CRACK_SPAN);
  const rate = 1 / SLOW_LEAK_S + size * (1 / FAST_LEAK_S - 1 / SLOW_LEAK_S);
  // a second crack opens it further
  const reopen = state.engLeak ? rate * 0.3 : 0;
  state.engLeak = Math.min(1 / 30, Math.max(state.engLeak, rate) + reopen);
  if (frontAdd >= SUMP_HIT && rnd() < SUMP_P) crackSump(state, rnd);
}

/**
 * A rollover impact (roll.js via damage.ts hitRoll) may crack the sump.
 * @param car the car (engineInit has run)
 * @param rnd the random source
 */
export function crackOnRoll(car: EngineCar, rnd: () => number): void {
  if (car.engT === undefined) return;
  if (rnd() < ROLL_SUMP_P) crackSump(car as EngineCar & EngineState, rnd);
}

/**
 * The oil starts to drain (once).
 * @param state the engine state
 * @param rnd the random source
 */
function crackSump(state: EngineState, rnd: () => number) {
  if (state.oilLeak > 0) return;
  state.oilLeak = 1 / (OIL_MIN_S + OIL_SPREAD_S * rnd());
}

/**
 * The speedo lights' states: 0 dim, 1 amber, 2 flashing red.
 * @param car the car
 * @returns the temperature light and the oil light, or null before the engine state is made
 */
export function engineLights(car: EngineCar): { temp: number; oil: number } | null {
  if (car.engT === undefined) return null;
  const temp = car.engSeized || car.engT >= FADE_FROM_C ? 2 : car.engT >= 105 ? 1 : 0;
  const oil = car.engSeized || (car.engOil ?? 1) < OIL_LOW ? 2 : 0;
  return { temp, oil };
}

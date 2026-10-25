// render/enginesmoke.ts - what the ENGINE throws out (car systems C3 / C5, ?engine=1; mockup
// approved): EXHAUST from each car's pipe - more on the throttle and in the cold (white at 2 C,
// faint at 15 C, almost nothing at 30 C), none from a seized engine; BACKFIRES (an orange pop and
// dark puffs) at a power cut - the moment it seizes, now and then while the heat fades the
// power, and sometimes a lift-off near the redline; STEAM from a cracked radiator's nose while
// there is water to boil; DARK SMOKE from an overheating engine, thinning after it seizes.
// It replaces the old grey nose smoke of a bent front (render/particles.ts) under the switch.
// Puffs go into the particle layer's pools (render/particles.ts emitPuff): exhaust and backfires
// at road level under the cars, steam and engine smoke OVER them (they rise off the bonnet). The
// dice are the drawing's own (fxRandom), never the race's. Wall clock (rule 5).
import { fxRandom } from './shared.ts';
import { WEATHER } from '../world/weather.ts';
import { engineEnabled } from '../physics/engineheat.ts';

/** A puff's look, as render/particles.ts emitPuff takes it (size / lift m, life s). */
interface PuffLook { rgb: string; size: number; lift: number; life: number; grow: number }
/** Throws one puff at (x, y), flung against (vx, vy) as emitPuff does. */
export type PuffAt = (x: number, y: number, vx: number, vy: number, look: PuffLook,
  scale: number) => void;
/** What this file reads of a car (physics/engineheat.ts, vehicle.ts). */
export interface SmokeCar {
  x: number; y: number; vx: number; vy: number; heading: number; rpm?: number;
  spec: { kind?: string; len: number; wid: number; redline?: number };
  throttleUsed?: number;
  engT?: number; engWater?: number; engLeak?: number; engSeized?: boolean; engPowerK?: number;
  _exDebt?: number; _stDebt?: number; _esDebt?: number; _exThr?: number;
  _wasSeized?: boolean; _seizeAge?: number;
}

// EXHAUST SPOTS by car kind: along the car (share of its length from the centre, + forward) and
// across it (share of its width, + right), one entry per pipe; 'up' for a stack that puffs
// straight up (no throw back). Every kind in cars.ts has a row (tools/scratch/_engine.mjs checks).
type Pipe = [along: number, across: number];
export const EXHAUST_SPOTS: Record<string, { pipes: Pipe[]; up?: boolean }> = {
  hatch: { pipes: [[-0.5, -0.28]] },
  saloon: { pipes: [[-0.5, -0.3]] },
  wrz: { pipes: [[-0.5, 0.3]] },
  estate: { pipes: [[-0.5, -0.3]] },
  muscle: { pipes: [[-0.5, -0.3], [-0.5, 0.3]] },
  rally: { pipes: [[-0.5, 0.3]] },
  track: { pipes: [[-0.5, 0]] },
  tractor: { pipes: [[0.28, -0.3]], up: true },
  mini: { pipes: [[-0.5, -0.25]] },
  lambo: { pipes: [[-0.5, -0.1], [-0.5, 0.1]] },
  mikra: { pipes: [[-0.5, -0.25]] },
  kit: { pipes: [[-0.5, 0.3]] },
  rxcar: { pipes: [[-0.42, 0.42]] },
  banger: { pipes: [[-0.5, -0.3]] },
  grass: { pipes: [[-0.5, -0.3]] },
  drift: { pipes: [[-0.5, -0.15], [-0.5, 0.15]] },
};
const DEFAULT_SPOT = EXHAUST_SPOTS.hatch;

// exhaust puffs a second per pipe in the cold (mockup: 26 at 2 C), scaled by the cold share and
// the throttle; the cold share is 1 at COLD_C and below, EXHAUST_MIN at HOT_C
const EXHAUST_RATE = 26, COLD_C = 2, HOT_C = 25, EXHAUST_MIN = 0.04;
const EXHAUST = { rgb: '236,238,242', size: 0.16, lift: 0.35, life: 1.2, grow: 0.55 };
// the pipe's push: puffs leave it at ~1.4 m/s (emitPuff throws at 0.28 of what it is given)
const PIPE_PUSH = 5;
// a backfire: the flash, its core and the dark puffs after it
const POP_FLASH = { rgb: '255,179,71', size: 0.2, lift: 0.1, life: 0.09, grow: 0.12 };
const POP_CORE = { rgb: '255,241,194', size: 0.09, lift: 0, life: 0.07, grow: 0.05 };
const POP_SMOKE = { rgb: '24,24,30', size: 0.22, lift: 0.6, life: 1.0, grow: 0.7 };
// pops a second while the heat takes power, per unit of power lost; a lift-off from LIFT_FROM+
// throttle with the revs over LIFT_REVS of the redline pops LIFT_POP of the time
const FADE_POPS = 3, LIFT_FROM = 0.4, LIFT_REVS = 0.85, LIFT_POP = 0.35;
// steam from a cracked radiator: puffs a second for a leak, white, over STEAM_FROM_C
const STEAM_BASE = 6, STEAM_PER_LEAK = 400, STEAM_FROM_C = 60;
const STEAM = { rgb: '246,248,252', size: 0.18, lift: 1.4, life: 0.7, grow: 0.6 };
// standing still the puffs pile up: STEAM_STILL of the rate, all of it from STEAM_FULL_MPS
const STEAM_STILL = 0.3, STEAM_FULL_MPS = 10;
// dark engine smoke: from SMOKE_FROM_C, SMOKE_RATE a second when fully over; a seized engine
// smokes on at SEIZED_RATE, thinning to nothing over SEIZED_FADE_S
const SMOKE_FROM_C = 112, SMOKE_SPAN_C = 18, SMOKE_RATE = 18, SEIZED_RATE = 14,
  SEIZED_FADE_S = 20;
const ENGINE_SMOKE = { rgb: '30,30,36', size: 0.5, lift: 0.7, life: 1.4, grow: 1.6 };

/**
 * A point on the car, from the car frame (along +forward, across +right, m) to the world.
 * @param car the car
 * @param along m ahead of the centre
 * @param across m right of the centre
 * @returns world x and y, m
 */
function carPoint(car: SmokeCar, along: number, across: number): [number, number] {
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  return [car.x + cosH * along - sinH * across, car.y + sinH * along + cosH * across];
}

/**
 * The share of exhaust the air temperature lets show: 1 cold .. EXHAUST_MIN hot.
 * @returns 0..1
 */
function coldShare(): number {
  const share = (HOT_C - WEATHER.tempC) / (HOT_C - COLD_C);
  return Math.max(EXHAUST_MIN, Math.min(1, share));
}

/**
 * A backfire at each pipe: a flash and a few dark puffs.
 * @param puffAt the particle layer's emitter
 * @param car the car
 */
function backfire(puffAt: PuffAt, car: SmokeCar) {
  const spot = EXHAUST_SPOTS[car.spec.kind || ''] || DEFAULT_SPOT;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  for (const [along, across] of spot.pipes) {
    const [x, y] = carPoint(car, along * car.spec.len, across * car.spec.wid);
    puffAt(x, y, cosH * PIPE_PUSH, sinH * PIPE_PUSH, POP_FLASH, 1);
    puffAt(x, y, 0, 0, POP_CORE, 0);
    for (let i = 0; i < 3; i++) puffAt(x, y, cosH * PIPE_PUSH, sinH * PIPE_PUSH, POP_SMOKE, 1);
  }
}

/**
 * The exhaust's puffs from each pipe, by throttle and air temperature.
 * @param puffAt the particle layer's emitter
 * @param car the car
 * @param wallDt wall-clock frame time, s
 */
function emitExhaust(puffAt: PuffAt, car: SmokeCar, wallDt: number) {
  const spot = EXHAUST_SPOTS[car.spec.kind || ''] || DEFAULT_SPOT;
  const cold = coldShare(), throttle = car.throttleUsed || 0;
  car._exDebt = (car._exDebt || 0) + EXHAUST_RATE * cold * (0.3 + throttle) * wallDt;
  if (car._exDebt > 4) car._exDebt = 4;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const pushX = spot.up ? 0 : cosH * PIPE_PUSH, pushY = spot.up ? 0 : sinH * PIPE_PUSH;
  const scale = 0.6 + 0.4 * cold;
  while (car._exDebt >= 1) {
    car._exDebt--;
    for (const [along, across] of spot.pipes) {
      const [x, y] = carPoint(car, along * car.spec.len, across * car.spec.wid);
      puffAt(x, y, pushX + car.vx * 0.3, pushY + car.vy * 0.3, EXHAUST, scale);
    }
  }
}

/**
 * The backfires of this frame: the seizing moment, the heat's power cuts, a lift-off at revs.
 * @param puffAt the particle layer's emitter
 * @param car the car
 * @param wallDt wall-clock frame time, s
 */
function emitBackfires(puffAt: PuffAt, car: SmokeCar, wallDt: number) {
  const throttle = car.throttleUsed || 0, lastThrottle = car._exThr ?? throttle;
  car._exThr = throttle;
  if (car.engSeized) return;
  const lost = 1 - (car.engPowerK ?? 1);
  if (lost > 0 && fxRandom() < FADE_POPS * lost * wallDt) backfire(puffAt, car);
  const revs = (car.rpm || 0) / (car.spec.redline || 1);
  if (lastThrottle >= LIFT_FROM && throttle < 0.05 && revs >= LIFT_REVS
      && fxRandom() < LIFT_POP) backfire(puffAt, car);
}

/**
 * Steam from a cracked radiator's nose, and dark smoke from a hot or seized engine, over the car.
 * @param puffAt the particle layer's emitter over the cars
 * @param car the car
 * @param wallDt wall-clock frame time, s
 */
function emitNose(puffAt: PuffAt, car: SmokeCar, wallDt: number) {
  const engT = car.engT || 0, nose = car.spec.len * 0.45;
  const [x, y] = carPoint(car, nose, 0);
  if ((car.engLeak || 0) > 0 && (car.engWater || 0) > 0 && engT > STEAM_FROM_C) {
    const moving = Math.min(1, Math.hypot(car.vx, car.vy) / STEAM_FULL_MPS);
    const steamRate = (STEAM_BASE + STEAM_PER_LEAK * (car.engLeak || 0))
      * (STEAM_STILL + (1 - STEAM_STILL) * moving);
    car._stDebt = Math.min(4, (car._stDebt || 0) + steamRate * wallDt);
    while (car._stDebt >= 1) {
      car._stDebt--;
      puffAt(x, y, car.vx * 0.4, car.vy * 0.4, STEAM, 0.6);
    }
  }
  let rate = SMOKE_RATE * Math.max(0, Math.min(1, (engT - SMOKE_FROM_C) / SMOKE_SPAN_C));
  if (car.engSeized) {
    rate = SEIZED_RATE * Math.max(0, 1 - (car._seizeAge || 0) / SEIZED_FADE_S);
  }
  if (rate <= 0) return;
  car._esDebt = Math.min(4, (car._esDebt || 0) + rate * wallDt);
  while (car._esDebt >= 1) {
    car._esDebt--;
    puffAt(x, y, car.vx * 0.4, car.vy * 0.4, ENGINE_SMOKE, 0.6);
  }
}

/**
 * Everything the engine throws out this frame (?engine=1 only).
 * @param puffAt the particle layer's emitter at road level
 * @param puffOver its emitter over the cars
 * @param car the car
 * @param wallDt wall-clock frame time, s
 */
export function emitEngineSmoke(puffAt: PuffAt, puffOver: PuffAt, car: SmokeCar,
    wallDt: number): void {
  if (!engineEnabled() || car.engT === undefined) return;
  if (car.engSeized && !car._wasSeized) {
    car._seizeAge = 0;
    backfire(puffAt, car);
  }
  car._wasSeized = !!car.engSeized;
  if (car.engSeized) car._seizeAge = (car._seizeAge || 0) + wallDt;
  else emitExhaust(puffAt, car, wallDt);
  emitBackfires(puffAt, car, wallDt);
  emitNose(puffOver, car, wallDt);
}

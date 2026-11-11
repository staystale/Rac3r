// ai/policeHeat.ts - THE HEAT (?police=1; TODO.md ROUND 4, the design agreed 11-11): 0-3 stars,
// what sends the police (ai/trafficPolice.ts) after you. A speed camera catching you is at least 1
// star; over LIMIT_MPH within SPEED_NEAR_M of a police car at least 1, over HARD_MPH there at least
// 2. FLASHING your lights (on and off inside FLASH_S) or changing lane without indicating (in the
// last INDICATE_S) with a police car within WITNESS_M (on your level: a car on a bridge is on
// another) is at least 1 star (in a chase they would add up with every swerve); running into a car
// there is a star more, and so is a PILE-UP you were in (PILE_CARS cars hurt inside PILE_S), each
// once a COOL_S. Over the limit, and a camera, make police DUE over
// the next DUE_M of road (more of the cars put back are police). ESCAPE: no chaser within SIGHT_M
// of you, on your level, for ESCAPE_S - the heat clears and they give up. BUSTED: a chaser within
// BUST_GAP_M of you (box to box) while you are under BUST_STILL_MS, for BUST_S.
import { sameLevel } from '../world/crossinggeo.ts';
import { tooInjured } from '../damage.ts';
import type { PoliceOrders } from './trafficPolice.ts';
import type { AiCar, TrafficCar, TrafficVehicle } from './types.ts';
import type { HwLevel } from '../highway/hwtypes.ts';

// m/s in a mile an hour
const MPH_MS = 0.44704;
// mph: the limit (the speed camera's: highway.ts CAM_MPH) and speeding hard
const LIMIT_MPH = 70, HARD_MPH = 100;
// m from a police car inside which speeding is seen; m inside which the other offences are
export const SPEED_NEAR_M = 30, WITNESS_M = 60;
// m of road ahead of you over which police are due after you sped or set off a camera
const DUE_M = 500;
// m inside which a chaser sees you; s out of every chaser's sight that loses them
export const SIGHT_M = 200, ESCAPE_S = 10;
// m box to box, m/s and s: a chaser this close while you are this slow for this long is a bust
export const BUST_GAP_M = 1, BUST_STILL_MS = 2, BUST_S = 3;
// s: the lights on and off inside FLASH_S is a flash; an indicator on in the last INDICATE_S
// counts for a lane change; one offence counts once a COOL_S
const FLASH_S = 1.2, INDICATE_S = 4, COOL_S = 3;
// m from a lane's middle inside which you are in it (a lane is ~3.65 m: well across)
const LANE_IN_M = 1.2;
// a pile-up: PILE_CARS cars within PILE_NEAR_M of you hurt (their mean damage up PILE_HURT)
// inside PILE_S, you having hit one in that time
const PILE_CARS = 3, PILE_NEAR_M = 60, PILE_HURT = 0.02, PILE_S = 6;
// the most stars
const MAX_STARS = 3;

/** Your car as the heat reads it: its box, speed, lights, indicator and level. */
export type HeatCar = AiCar & { lightsOn?: boolean; indicator?: number; crossing?: number };

/** The heat's state: the stars and its clocks (s), what it last saw of your lights and lane. */
export interface Heat {
  stars: number; escapeT: number; bustT: number; clock: number;
  cool: Record<string, number>; lightsWas: boolean | null; lightsAt: number;
  lane: number; indAt: Record<number, number>; touchAt: number;
  hurt: WeakMap<object, number>; pile: { car: object; at: number }[];
  sees: boolean; offences: string[];
}

/** One step's input: you, the road, the traffic's slots and cars, the police orders, events. */
export interface HeatInput {
  dt: number; player: HeatCar; level: HwLevel; slots: TrafficCar[]; cars: TrafficVehicle[];
  orders: PoliceOrders; camera?: boolean; touched?: boolean;
}

/**
 * A new heat: no stars.
 * @returns the heat
 */
export function createHeat(): Heat {
  return { stars: 0, escapeT: 0, bustT: 0, clock: 0, cool: {}, lightsWas: null, lightsAt: -99,
    lane: -1, indAt: { [-1]: -99, 1: -99 }, touchAt: -99, hurt: new WeakMap(), pile: [],
    sees: false, offences: [] };
}

/**
 * The gap between two cars' boxes, m (the separating axes': 0 or less touching).
 * @param first a car
 * @param second another
 * @returns m
 */
export function boxGap(first: AiCar, second: AiCar): number {
  const dx = second.x - first.x, dy = second.y - first.y;
  let gap = -Infinity;
  for (const axisHeading of [first.heading, first.heading + Math.PI / 2, second.heading,
    second.heading + Math.PI / 2]) {
    const axisX = Math.cos(axisHeading), axisY = Math.sin(axisHeading);
    const reach = (car: AiCar) => car.spec.len / 2 * Math.abs(Math.cos(car.heading - axisHeading))
      + car.spec.wid / 2 * Math.abs(Math.sin(car.heading - axisHeading));
    gap = Math.max(gap, Math.abs(dx * axisX + dy * axisY) - reach(first) - reach(second));
  }
  return gap;
}

/**
 * Whether a police car within a distance of you, on your level, sees it.
 * @param input the step's input
 * @param reachM m
 * @returns seen
 */
const witnessed = (input: HeatInput, reachM: number) => input.slots.some((slot) => !slot.parked
  && !!slot.police && !slot.wreck
  && Math.hypot(slot.car.x - input.player.x, slot.car.y - input.player.y) < reachM
  && sameLevel(slot.car, input.player));

/**
 * A star more (once a COOL_S for one kind of offence).
 * @param heat the heat
 * @param kind the offence
 */
function raiseHeat(heat: Heat, kind: string) {
  if (heat.clock - (heat.cool[kind] ?? -99) < COOL_S) return;
  heat.cool[kind] = heat.clock;
  heat.stars = Math.min(MAX_STARS, heat.stars + 1);
  heat.escapeT = 0;
  heat.offences.push(kind);
}

/**
 * At least a number of stars.
 * @param heat the heat
 * @param stars the least
 * @param kind the offence
 */
function heatAtLeast(heat: Heat, stars: number, kind: string) {
  if (heat.stars >= stars) return;
  heat.stars = stars;
  heat.escapeT = 0;
  heat.offences.push(kind);
}

/**
 * Speeding and the speed camera: the stars, and police due over the next DUE_M.
 * @param heat the heat
 * @param input the step's input
 */
function speedOffences(heat: Heat, input: HeatInput) {
  const speed = Math.hypot(input.player.vx, input.player.vy), youS = input.level._hw.q?.s;
  if ((speed > LIMIT_MPH * MPH_MS || input.camera) && youS != null)
    input.orders.dueUntil = youS + DUE_M;
  if (input.camera) heatAtLeast(heat, 1, 'camera');
  if (speed <= LIMIT_MPH * MPH_MS || !witnessed(input, SPEED_NEAR_M)) return;
  heatAtLeast(heat, speed > HARD_MPH * MPH_MS ? 2 : 1, 'speeding');
}

/**
 * Your lights on and off inside FLASH_S: whether that just happened.
 * @param heat the heat
 * @param lightsOn your lights now
 * @returns a flash
 */
function flashed(heat: Heat, lightsOn: boolean): boolean {
  if (heat.lightsWas === null) heat.lightsWas = lightsOn;
  if (lightsOn === heat.lightsWas) return false;
  const isFlash = heat.clock - heat.lightsAt < FLASH_S;
  heat.lightsWas = lightsOn;
  heat.lightsAt = heat.clock;
  return isFlash;
}

/**
 * Your lane (the nearest lane's middle within LANE_IN_M, either way's on a single carriageway): a
 * lane change unsignalled in the last INDICATE_S, whether that just happened.
 * @param heat the heat
 * @param input the step's input
 * @returns an unsignalled lane change
 */
function changedLaneUnsignalled(heat: Heat, input: HeatInput): boolean {
  const geom = input.level._hw.geo, here = input.level._hw.q, player = input.player;
  if (player.indicator) heat.indAt[player.indicator] = heat.clock;
  if (!here) return false;
  const lanes = geom.median == null ? [...geom.centres, ...geom.oncoming] : geom.centres;
  let lane = -1;
  lanes.forEach((centre, i) => {
    if (Math.abs(here.off - centre) < LANE_IN_M) lane = i;
  });
  if (lane < 0 || lane === heat.lane) return false;
  const was = heat.lane;
  heat.lane = lane;
  if (was < 0) return false;
  const side = Math.sign(lanes[lane] - lanes[was]);
  return heat.clock - (heat.indAt[side] ?? -99) > INDICATE_S;
}

/**
 * Whether you just ran into a car that is not chasing you (a chaser ramming you is no offence).
 * @param input the step's input
 * @returns a crash
 */
function crashedIntoTraffic(input: HeatInput): boolean {
  if (!input.touched) return false;
  const player = input.player;
  let nearest: TrafficCar | null = null, best = Infinity;
  for (const slot of input.slots) {
    if (slot.parked) continue;
    const gap = Math.hypot(slot.car.x - player.x, slot.car.y - player.y);
    if (gap < best) {
      best = gap;
      nearest = slot;
    }
  }
  return !!nearest && nearest.police?.mode !== 'chase';
}

/**
 * A pile-up: PILE_CARS cars near you hurt inside PILE_S, you having hit one in that time.
 * @param heat the heat
 * @param input the step's input
 * @returns a pile-up
 */
function pileUp(heat: Heat, input: HeatInput): boolean {
  const player = input.player;
  for (const car of input.cars) {
    if (Math.abs(car.x - player.x) > PILE_NEAR_M || Math.abs(car.y - player.y) > PILE_NEAR_M)
      continue;
    const hurt = car.dmg ? (car.dmg[0] + car.dmg[1] + car.dmg[2] + car.dmg[3]) / 4 : 0;
    const before = heat.hurt.get(car) ?? hurt;
    heat.hurt.set(car, hurt);
    if (hurt - before > PILE_HURT && !heat.pile.some((entry) => entry.car === car))
      heat.pile.push({ car, at: heat.clock });
  }
  if (heat.pile.length && heat.clock - heat.pile[0].at >= PILE_S)
    heat.pile = heat.pile.filter((entry) => heat.clock - entry.at < PILE_S);
  if (heat.pile.length < PILE_CARS || heat.clock - heat.touchAt > PILE_S) return false;
  heat.pile = [];
  return true;
}

/**
 * Every offence of the step.
 * @param heat the heat
 * @param input the step's input
 */
function noteOffences(heat: Heat, input: HeatInput) {
  const crash = crashedIntoTraffic(input);
  if (input.touched) heat.touchAt = heat.clock;
  speedOffences(heat, input);
  const near = witnessed(input, WITNESS_M);
  if (flashed(heat, !!input.player.lightsOn) && near) heatAtLeast(heat, 1, 'flash');
  if (changedLaneUnsignalled(heat, input) && near) heatAtLeast(heat, 1, 'lane');
  if (crash && near) raiseHeat(heat, 'crash');
  if (pileUp(heat, input)) raiseHeat(heat, 'pileup');
}

/**
 * One step of the heat: the offences, then (with stars) whether a chaser sees you - the escape
 * clock - and whether one has you boxed in, stopped - the bust clock. Writes the stars to the
 * police orders.
 * @param heat the heat
 * @param input the step's input
 * @returns 'escaped', 'busted' or null
 */
export function stepHeat(heat: Heat, input: HeatInput): 'escaped' | 'busted' | null {
  const { dt, player } = input;
  heat.clock += dt;
  noteOffences(heat, input);
  input.orders.stars = heat.stars;
  const isChaser = (slot: TrafficCar) => !slot.parked && slot.police?.mode === 'chase';
  heat.sees = input.slots.some((slot) => isChaser(slot) && !slot.wreck && !tooInjured(slot.car)
    && Math.hypot(slot.car.x - player.x, slot.car.y - player.y) < SIGHT_M
    && sameLevel(slot.car, player));
  if (!heat.stars) {
    heat.escapeT = heat.bustT = 0;
    return null;
  }
  heat.escapeT = heat.sees ? 0 : heat.escapeT + dt;
  if (heat.escapeT >= ESCAPE_S) {
    clearHeat(heat);
    input.orders.stars = 0;
    return 'escaped';
  }
  const boxed = Math.hypot(player.vx, player.vy) < BUST_STILL_MS && input.slots.some((slot) =>
    isChaser(slot) && sameLevel(slot.car, player) && boxGap(slot.car, player) < BUST_GAP_M);
  heat.bustT = boxed ? heat.bustT + dt : 0;
  return heat.bustT >= BUST_S ? 'busted' : null;
}

/**
 * The heat cleared (an escape, a bust): no stars, the clocks stopped.
 * @param heat the heat
 */
export function clearHeat(heat: Heat) {
  heat.stars = 0;
  heat.escapeT = heat.bustT = 0;
  heat.sees = false;
}

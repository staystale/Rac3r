// render/airflow.ts - THE AIR the puffs hang in (airfx, passed 11-03; owner 11-02: smoke, dirt,
// sand and dust "can it have slightly more varied deviation from its normal path the further away
// from the car it gets - like real life so it can spread out ... maybe we can make wind / wind
// direction slightly affect this stuff as long as small ... effects of slip stream?" and "make sure
// exhaust smoke behaves correctly too / engine steam / anything else I've forgotten"). Every puff
// of the shared pools takes it: tyre smoke, wheel dust / spray / clods, exhaust, pops, steam,
// engine smoke, cone / bale dust, sheep fluff. Render only - the sim never reads it.
//   SPREAD  a random-walk kick on each puff that grows with its age (SPREAD m/s per root second
//           at the end of its life): it leaves the car on its path, then fans out and breaks up.
//   WIND    each session a gentle wind (WIND_BY_KIND for the weather, x0.5 .. x1.5, a random
//           direction, slow gusts of +-GUST): the puffs settle toward the moving air, not still
//           air.
//   STIR    a car moving through the air drags it along: puffs beside it and up to STIR_BACK m
//           behind are pulled toward STIR_SHARE of its velocity (most close in), and pushed out
//           sideways off its body - a car blasting through a dust cloud tears a gap in it.
// HOW AIRBORNE a puff is (air, AIR_MIN .. 1): fine dust, smoke and steam ride the air fully; heavy
// mud clods and grass clippings far less - from the look's bloom (grow) unless it says.
import { WEATHER } from '../world/weather.ts';
import { LEVEL } from '../world/state.ts';
import type { Puff } from './types.ts';

const SPREAD = 2.4, SETTLE = 2.6;
const WIND_BY_KIND: Record<string, number> = { dry: 1.4, hot: 0.9, superhot: 0.6, rain: 2.6,
  heavy: 4, snow: 2.2 };
const GUST = 0.3, GUST_RATE = 0.35;
const STIR_BACK = 9, STIR_SHARE = 0.55, STIR_PULL = 3.5, STIR_PUSH = 3.5, STIR_FROM_V = 3;
const AIR_FROM_GROW = 0.9, AIR_MIN = 0.15;

/** A car as the air reads it. */
export interface AirCar { x: number; y: number; vx: number; vy: number; heading: number;
  spec: { len: number; wid: number } }

const wind = { key: '', x: 0, y: 0, time: 0 };

/**
 * A string's hash, 0..1 (a session's wind from its level and weather, steady all session).
 * @param text the text
 * @returns 0..1
 */
function hash01(text: string): number {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) value = Math.imul(value ^ text.charCodeAt(i), 16777619);
  return ((value >>> 0) % 100000) / 100000;
}

/**
 * The wind now (m/s), picked once per level and weather, with slow gusts.
 * @param wallDt wall-clock frame time (0: read without moving the gusts on)
 * @returns the wind vector
 */
export function windNow(wallDt: number): { x: number; y: number } {
  const key = `${LEVEL?.id || ''}|${WEATHER.kind}|${WEATHER.season}`;
  if (key !== wind.key) {
    const angle = hash01(key + 'a') * Math.PI * 2;
    const speed = (WIND_BY_KIND[WEATHER.kind] ?? 1.4) * (0.5 + hash01(key + 's'));
    wind.key = key; wind.x = Math.cos(angle) * speed; wind.y = Math.sin(angle) * speed;
  }
  wind.time += wallDt;
  const gust = 1 + GUST * Math.sin(wind.time * GUST_RATE) * Math.sin(wind.time * GUST_RATE * 0.37);
  return { x: wind.x * gust, y: wind.y * gust };
}

/**
 * How airborne a look is.
 * @param look its bloom and, maybe, its own air share
 * @param look.grow how much it blooms
 * @param look.air its own share, when set
 * @returns AIR_MIN .. 1
 */
export function airOf(look: { grow: number; air?: number }): number {
  return look.air ?? Math.max(AIR_MIN, Math.min(1, look.grow / AIR_FROM_GROW));
}

/**
 * One car's stir on a puff.
 * @param puff the puff
 * @param car the car
 * @param airK how airborne the puff is
 * @param wallDt wall-clock frame time
 */
function stir(puff: Puff, car: AirCar, airK: number, wallDt: number): void {
  const speed = Math.hypot(car.vx, car.vy);
  if (speed < STIR_FROM_V) return;
  const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
  const relX = puff.x - car.x, relY = puff.y - car.y;
  const along = relX * cosH + relY * sinH, lat = -relX * sinH + relY * cosH;
  const half = car.spec.len / 2, side = car.spec.wid;
  if (along > half || along < -half - STIR_BACK || Math.abs(lat) > side) return;
  const behind = along < -half ? (-half - along) / STIR_BACK : 0;
  const close = (1 - behind) * (1 - Math.abs(lat) / side) * airK;
  const pull = Math.min(1, STIR_PULL * close * wallDt);
  puff.vx += (car.vx * STIR_SHARE - puff.vx) * pull;
  puff.vy += (car.vy * STIR_SHARE - puff.vy) * pull;
  if (along > -half) {
    const out = Math.sign(lat || 1) * speed * STIR_PUSH * close * wallDt;
    puff.vx += -sinH * out;
    puff.vy += cosH * out;
  }
}

/**
 * One frame of a puff in the air: settle toward the wind, the age-grown wander, the cars' stir.
 * @param puff the puff (velocity changed in place)
 * @param wallDt wall-clock frame time
 * @param air the wind now
 * @param cars the cars stirring it
 * @param rnd the render random source
 */
export function airMove(puff: Puff, wallDt: number, air: { x: number; y: number },
  cars: AirCar[], rnd: () => number): void {
  const airK = puff.air ?? 1, settle = Math.min(1, SETTLE * wallDt);
  const goalX = air.x * airK, goalY = air.y * airK;
  puff.vx = goalX + (puff.vx - goalX) * (1 - settle);
  puff.vy = goalY + (puff.vy - goalY) * (1 - settle);
  const kick = SPREAD * airK * (puff.age / puff.life) * Math.sqrt(wallDt) * 2;
  puff.vx += (rnd() - 0.5) * kick;
  puff.vy += (rnd() - 0.5) * kick;
  for (const car of cars) stir(puff, car, airK, wallDt);
}

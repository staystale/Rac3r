// ai/driverCool.ts - TYRE COOLING BY SKILL (?aicool=1; owner 11-02: "ai should generally just drive
// and if their tyres wear so be it - although maybe we can build it into driver skill so skilled
// drivers try a little bit to cool tyres if too hot by slowing or driving in water / grass / mud
// anything that would cool, but this should be on a gradient so they don't do it 100 % of the time,
// just they have a chance to, and that chance is higher with a more skilled driver"). Round 2
// (owner: "ai should only cool tyres if they are really hot! otherwise they race like normal"): 8
// -> 20 C over. While its hottest tyre is COOL_OVER_C above the top of its window, a driver weighs
// it up every COOL_CHECK_S: with a chance of COOL_CHANCE_MIN (skill 0) .. COOL_CHANCE_MAX (skill 1)
// it eases to COOL_PACE of its pace for COOL_S, and if water, grass or mud (anything with coolK)
// lies within the track's usable width up to COOL_LOOK m ahead it moves onto it. The usual edge
// clamp (driverDrive.ts) still applies, so it never leaves the road for it. NEVER IN A BATTLE (a
// car within 25 m: battleStep's state.pushing): MEASURED without that rule, cars easing off with a
// rival right behind were run into (Thruston, 6 drift cars: nose-to-tail touches 37 -> 56, time off
// the road 14 -> 48 car-s); it ends a cool early too.
import { FIX } from '../core/fixes.ts';
import { groundAt } from '../world/wear.ts';
import type { AiCar } from './types.ts';
import type { Drv, AiPath } from './driverCtx.ts';

const COOL_OVER_C = 20, COOL_CHECK_S = 3, COOL_S = 5, COOL_PACE = 0.96;
const COOL_CHANCE_MIN = 0.08, COOL_CHANCE_MAX = 0.7;
const COOL_LOOK = 25, COOL_SURFACE_K = 0.05, COOL_REACH = [1, -1, 2, -2, 3, -3];

/** What the cooling reads of a car beyond the AI's narrow view. */
interface HotCar { tyreT?: number[]; spec: { tyreOpt?: [number, number] } }

/**
 * How far over its window the car's hottest tyre is.
 * @param car the car
 * @returns C over the top of the window (negative inside it)
 */
function overC(car: AiCar): number {
  const hot = car as unknown as HotCar;
  if (!hot.tyreT) return -Infinity;
  return Math.max(...hot.tyreT) - (hot.spec.tyreOpt || [65, 110])[1];
}

/**
 * The lateral offset from the line onto cooling ground just ahead, if any inside the edges.
 * @param path the path
 * @param aheadIdx the point COOL_LOOK m ahead
 * @param latLim the usable half-width from the centre
 * @returns metres from the line, or 0
 */
function coolLane(path: AiPath, aheadIdx: number, latLim: number): number {
  const point = path.pts[aheadIdx], off = (point as { off?: number }).off || 0;
  for (const lat of COOL_REACH) {
    if (Math.abs(off + lat) > latLim) continue;
    const ground = groundAt(point.x - Math.sin(point.h) * lat, point.y + Math.cos(point.h) * lat);
    if ((ground.surface?.coolK || 0) > COOL_SURFACE_K) return lat;
  }
  return 0;
}

/**
 * One tick of the cooling: the pace factor and the lateral nudge while it cools (1 and 0 off).
 * @param drv the driver
 * @param car its car
 * @param path the path it follows
 * @param aheadIdx the point COOL_LOOK m ahead
 * @param latLim the usable half-width from the centre
 * @returns the pace factor and the lateral offset to add
 */
export function coolStep(drv: Drv, car: AiCar, path: AiPath, aheadIdx: number, latLim: number) {
  const state = drv.state;
  if (!FIX.aiCool) return { vMul: 1, lat: 0 };
  if (state.pushing) { state.coolUntil = 0; return { vMul: 1, lat: 0 }; }
  if (state.t < (state.coolUntil || 0)) return { vMul: COOL_PACE, lat: state.coolLat || 0 };
  if (overC(car) < COOL_OVER_C || state.t < (state.coolNext || 0)) return { vMul: 1, lat: 0 };
  state.coolNext = state.t + COOL_CHECK_S;
  const chance = COOL_CHANCE_MIN + (COOL_CHANCE_MAX - COOL_CHANCE_MIN) * drv.traits.skill;
  if (drv.rnd() >= chance) return { vMul: 1, lat: 0 };
  state.coolUntil = state.t + COOL_S;
  state.coolLat = coolLane(path, aheadIdx, latLim);
  state.cools = (state.cools || 0) + 1;
  return { vMul: COOL_PACE, lat: state.coolLat };
}

export { COOL_LOOK };

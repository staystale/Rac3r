// ai/trafficYield.ts - TRAFFIC MOVING OVER (?moveover=1; owner 11-11: "Can traffic move over for
// police", "Can flashing a traffic AI encourage them but not guarantee them to move over") and ROAD
// RAGE (?roadrage=1: "flashing the same car multiple times ... they are angry"). A car of our way
// with a chasing police car closing up behind it in its lane moves over - into the lane on its
// left through its own lane change (ai/trafficLane.ts chooseLane: signalling, clear for the whole
// move), or in the nearside lane to the hard shoulder's edge, its left indicator on - and keeps
// out of the lane to its right meanwhile. You flashing your lights (on and off quickly: the police
// heat's flash, ai/policeHeat.ts flashed) at the car ahead of you in your lane within FLASH_REACH_M
// asks it the same: FLASH_CHANCE it does, for YIELD_S (a car that cannot - no lane, a car
// alongside - does not). The same car flashed RAGE_FLASHES times inside RAGE_WINDOW_S instead gets
// ANGRY: it drives at you as a chasing police car does, without the lights (ai/trafficPolice.ts
// makeAngry), its headlights flashing back.
import { FIX } from '../core/fixes.ts';
import { makeAngry } from './trafficPolice.ts';
import type { TrafficCtx } from './trafficCtx.ts';
import type { DriveEnv } from './trafficLane.ts';
import type { AiCar, TrafficCar } from './types.ts';

// m behind a car a chasing police car is seen coming up in its lane
const YIELD_BEHIND_M = 90;
// m across within which a car behind is in its lane
const SAME_LANE_M = 2.6;
// s a car flashed (and moving over) keeps doing so
const YIELD_S = 8;
// the share of its speed a car asked over keeps while it waits for room on its left (it drops in
// behind the car alongside - MEASURED, _police.mjs PART=traffic4: at its own speed it waited by
// the nearside lane's cars the whole time, 1 flashed car in 16 moved over)
const YIELD_SLOW_SHARE = 0.85;
// m it edges out of the nearside lane toward the hard shoulder, and the least hard shoulder that
// has room for it (a road without one: it cannot)
const EDGE_M = 1.6, EDGE_SHOULDER_M = 2;
// m/s it closes the edge at (a gentle move over)
const EDGE_RATE_MS = 0.8;
// m ahead of you the car you flash may be, and across from your line it is in your lane
const FLASH_REACH_M = 60, FLASH_LANE_M = 1.8;
// the chance a flashed car moves over (asked, not told: half do)
const FLASH_CHANCE = 0.5;
// flashes of the same car inside RAGE_WINDOW_S (s) that make its driver angry
const RAGE_FLASHES = 3, RAGE_WINDOW_S = 20;

/**
 * Whether a chasing police car (its lights on - not an angry driver) is closing up behind a car in
 * its lane.
 * @param slot the car
 * @param env the step's road
 * @returns one is
 */
function policeBehind(slot: TrafficCar, env: DriveEnv): boolean {
  for (const ent of env.ents) {
    const police = ent.t?.police;
    if (!police || police.mode !== 'chase' || police.angry || !ent.t!.car.blues) continue;
    const behind = slot.s - ent.s;
    if (behind > 0 && behind < YIELD_BEHIND_M && Math.abs(ent.off - slot.off) < SAME_LANE_M
      && ent.v > slot.vAl) return true;
  }
  return false;
}

/**
 * Whether a car is moving over now (?moveover=1): our way's, flashed lately or a chasing police
 * car behind it.
 * @param slot the car
 * @param env the step's road
 * @returns it is
 */
export function isYielding(slot: TrafficCar, env: DriveEnv): boolean {
  if (!FIX.moveover || (slot.dir ?? 1) < 0 || slot.police || slot.broke) return false;
  return (slot.yieldT ?? 0) > 0 || policeBehind(slot, env);
}

/**
 * The lane a car moving over goes to: the one on its left when it is clear (null: the nearside
 * lane - it edges over instead - or no room yet: it waits, and goes nowhere to its right).
 * @param slot the car
 * @param isClear whether a lane is clear for the whole move (ai/trafficLane.ts laneClear)
 * @returns the lane, or null
 */
export function yieldLane(slot: TrafficCar,
  isClear: (laneNo: number) => boolean): number | null {
  return slot.lane > 0 && isClear(slot.lane - 1) ? slot.lane - 1 : null;
}

/**
 * A car moving over in the nearside lane edges toward the hard shoulder (where there is one wide
 * enough), its left indicator on (ai/trafficDrive.ts); its edge (slot.edge: m off its line,
 * ai/trafficPhys.ts) eased back once it is done. Its road for the step: the edge reached.
 * @param slot the car
 * @param env the step's road
 * @param shoulder the road's hard shoulder, m
 * @param isYieldingNow it is moving over now
 * @returns the road it drives on (env, its nearside widened while it edges over)
 */
export function edgeOver(slot: TrafficCar, env: DriveEnv, shoulder: number,
  isYieldingNow: boolean): DriveEnv {
  if ((slot.yieldT ?? 0) > 0) slot.yieldT = Math.max(0, slot.yieldT! - env.dt);
  const canEdge = shoulder >= EDGE_SHOULDER_M && slot.lane === 0 && slot.laneT === 0;
  const want = isYieldingNow && canEdge ? -EDGE_M : 0;
  const now = slot.edge ?? 0, stepM = EDGE_RATE_MS * env.dt;
  slot.edge = now + Math.max(-stepM, Math.min(stepM, want - now));
  if (!slot.edge) return env;
  return { ...env, minOff: env.minOff + slot.edge };
}

/**
 * The car you flash: our way's nearest ahead of you in your lane within FLASH_REACH_M (not a
 * police car, not one stopped at the roadside).
 * @param ctx the traffic
 * @param you your road frame (s, off), m
 * @param you.s m along
 * @param you.off m across
 * @returns the car, or null
 */
function flashTarget(ctx: TrafficCtx, you: { s: number; off: number }): TrafficCar | null {
  let best: TrafficCar | null = null;
  for (const slot of ctx.list) {
    if (slot.parked || slot.police || slot.broke || (slot.dir ?? 1) < 0) continue;
    const ahead = slot.s - you.s;
    if (ahead <= 0 || ahead > FLASH_REACH_M || Math.abs(slot.off - you.off) > FLASH_LANE_M)
      continue;
    if (!best || ahead < best.s - you.s) best = slot;
  }
  return best;
}

/**
 * You flashed your lights: the car ahead of you in your lane (if any) is asked to move over
 * (FLASH_CHANCE, ?moveover=1) - or, flashed RAGE_FLASHES times inside RAGE_WINDOW_S, gets angry
 * (?roadrage=1).
 * @param ctx the traffic
 * @param player you
 * @param you your road frame (s, off), m
 * @param you.s m along
 * @param you.off m across
 * @param clock the sim clock, s
 * @returns what it did: 'angry', 'yield', 'ignored', or null (no car)
 */
export function noteFlash(ctx: TrafficCtx, player: AiCar, you: { s: number; off: number },
  clock: number): string | null {
  const slot = flashTarget(ctx, you);
  if (!slot) return null;
  if (FIX.roadrage) {
    const times = (slot.flashes ||= []);
    times.push(clock);
    while (times.length && times[0] < clock - RAGE_WINDOW_S) times.shift();
    if (times.length >= RAGE_FLASHES) {
      times.length = 0;
      makeAngry(ctx, slot, player);
      return 'angry';
    }
  }
  if (FIX.moveover && ctx.rnd() < FLASH_CHANCE) {
    slot.yieldT = YIELD_S;
    return 'yield';
  }
  return 'ignored';
}

/**
 * The share of its speed a car keeps: one asked over, its left lane not taken yet, eases off to
 * drop in behind whoever is alongside there (1: any other car).
 * @param slot the car
 * @returns 0..1
 */
export const yieldSlowing = (slot: TrafficCar): number => ((slot.yieldT ?? 0) > 0
  && slot.lane > 0 && slot.laneT === slot.lane ? YIELD_SLOW_SHARE : 1);

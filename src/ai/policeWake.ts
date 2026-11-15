// ai/policeWake.ts - A WAITING (PARKED) POLICE CAR WAKES (passed 11-15; TODO-DONE item
// 14, the owner's answer 11-15: "wake when you pass within their sight with >= 1 star: pull out
// after ~1 s and join the chase; no stars = stay parked"). A police car waiting at the roadside
// (ai/trafficPolice.ts putWaiting: a forecourt, a lay-by, the hard shoulder) that a driver with
// heat passes - level with it or past it, within its sight (JOIN_M) on its level - pulls out
// WAKE_S later and joins the chase, whatever chasers the stars have already sent, up to the most
// there may be (MAX_CHASERS). Without the switch a waiting car joins only while a star's chaser
// is still owed (joinBySight), so with one star and its chaser out it stays put. Speeding past
// one with no stars gives a star already, as any police car within SPEED_NEAR_M sees it
// (ai/policeHeat.ts speedOffences): a star, then it wakes.
import { sameLevel } from '../world/crossinggeo.ts';
import { JOIN_M, MAX_CHASERS, makeChaser, ordersOf } from './trafficPolice.ts';
import type { PoliceOrders } from './trafficPolice.ts';
import type { TrafficCtx } from './trafficCtx.ts';
import type { TrafficCar } from './types.ts';

// s from a driver with heat passing it to a waiting car pulling out (the owner: "~1 s")
const WAKE_S = 1;
// m of road a driver with heat may still be short of a waiting car and be passing it (its car's
// length: level with it)
const LEVEL_M = 4;
// s a woken car waits for a free seat in the chase (the most chasers out) before it stays put
const SEAT_WAIT_S = 3;

/**
 * Whether a driver with heat is passing a waiting police car: within its sight, on its level,
 * level with it or past it along the road.
 * @param orders the police orders (the suspects)
 * @param slot the waiting car
 * @param sightM its sight, m
 * @returns true when one is
 */
function isPassedByHeat(orders: PoliceOrders, slot: TrafficCar, sightM: number) {
  return orders.suspects.some((each) => each.car !== slot.car && each.s >= slot.s - LEVEL_M
    && sameLevel(slot.car, each.car)
    && Math.hypot(slot.car.x - each.car.x, slot.car.y - each.car.y) < sightM);
}

/**
 * Whether a slot is a police car of our way waiting at the roadside, whole.
 * @param slot the slot
 * @returns true when it is
 */
const isWaitingOurs = (slot: TrafficCar) => !slot.parked && slot.police?.mode === 'wait'
  && !slot.police.angry && (slot.dir ?? 1) > 0 && !slot.wreck;

/**
 * The waiting police cars of our way (ai/trafficPolice.ts runChase, with the heat on): one a
 * driver with heat passes starts its clock; WAKE_S on (passed or not by then: it saw you) it is
 * made a chaser and joins the chase while there are fewer than MAX_CHASERS - taking a chaser owed,
 * if one is; none free for SEAT_WAIT_S more, it stays put.
 * @param ctx the traffic
 * @param dt the step, s
 * @param chasers the chasers (added to)
 * @returns how many woke
 */
export function wakeWaiting(ctx: TrafficCtx, dt: number, chasers: TrafficCar[]) {
  const orders = ordersOf(ctx);
  let woke = 0;
  for (const slot of ctx.list) {
    const police = slot.police;
    if (!police || !isWaitingOurs(slot)) continue;
    if (police.wakeT == null && !isPassedByHeat(orders, slot, JOIN_M)) continue;
    police.wakeT = (police.wakeT ?? 0) + dt;
    if (police.wakeT > WAKE_S + SEAT_WAIT_S) police.wakeT = undefined;
    if ((police.wakeT ?? 0) < WAKE_S || chasers.length >= MAX_CHASERS) continue;
    police.wakeT = undefined;
    makeChaser(ctx, slot);
    chasers.push(slot);
    if (orders.owed > 0) orders.owed--;
    orders.joined++;
    woke++;
  }
  return woke;
}

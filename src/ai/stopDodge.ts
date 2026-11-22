// ai/stopDodge.ts - A STOPPED OR MUCH SLOWER CAR IN THE WAY (passed 11-15): brake enough to miss it
// while going round it, then race pace as soon as it is clear. MEASURED before
// (tools/scratch/_stopcar.mjs, a car stopped across the line, 6 AI x 3 laps: Thruston 26-48 hits
// a run, up to 66 km/h; the highway trace tools/scratch/_hwracerhits.mjs: most pile-up follow-on
// touches were a racer running into a stopped one it had read 1 s before, not braking). Three
// causes, each traced: (1) the way round was planned off the line at the stopped car's point while
// the steering keeps a place across the ROAD (driverSteps.ts offRoad) - where the line crossed the
// road the planned way ended on the car (fixed where the car is read: driverTraffic.ts
// placeAcross); (2) the swerve's speed cap trusted the plan (the dodge target), not where the car
// really was, and once the plan looked clear the steering went back to a soft rejoin's; (3) half a
// length short of it the stopped car "owned the line" and the car gave way to it at its speed - 0.
// Here the brake reads where the car REALLY is: while its body is still in line with the stopped
// car the speed is capped to what lets it get across in time braking as it goes - or stop short
// when no way round is planned - and going round it is a move. Once its body is clear, no cap.
import { GRAVITY } from "../cars.ts";
import { FIX } from "../core/fixes.ts";
import { carGrip } from "./line.ts";
import { lateralOf } from "./rejoin.ts";
import { SWERVE_RATE } from "./dodge.ts";
import type { AiCar } from "./types.ts";
import type { AiPath, Drv } from "./driverCtx.ts";

/** A car not racing ahead of me (stopped, crawling), in my path's frame. */
export interface StoppedCar {
  car: AiCar;
  fwd: number;     // m ahead of me
  lat: number;     // m off my path, at its point
  v: number;       // m/s along my way
  clear: number;   // m between our middles, across, that keeps us apart (dodge.ts clearOf)
  along: number;   // m it reaches along my path from its middle
}

// the share of the car's full braking planned (it steers round at the same time: the tyres'
// grip is shared)
const STOP_BRAKE = 0.7;
// s before the car begins to move across (the steering's own lag)
const LAG_S = 0.3;
// m kept short of the car when it must stop
const KEEP_M = 1.5;
// m/s a car with a way round planned may still go at, however close (held to a crawl it could not
// steer out: _stopcar.mjs, the cars stopped behind a stopped one and queued)
const CREEP_V = 3;
// the most a skill-0 driver's judged room is off, as a share of it (none at skill 1)
const JUDGE = 0.2;

/**
 * The relative speed from which I can still miss a car, braking at decel: stop short of it in
 * the room, or reach it no sooner than the time I need to get across.
 * @param room m to it
 * @param time s I need to be across (Infinity: no way round, stop)
 * @param decel m/s/s
 * @returns m/s
 */
function missSpeed(room: number, time: number, decel: number): number {
  if (room <= 0) return 0;
  if (!Number.isFinite(time) || room <= decel * time * time / 2) {
    return Math.sqrt(2 * decel * room);
  }
  return (room + decel * time * time / 2) / time;
}

/**
 * The driver's judgement of the room to the nearest car in its way: a new draw from its own
 * random stream for each car, off by up to JUDGE, less the more skilled.
 * @param drv the driver context
 * @param other the car
 * @returns the share the room is judged by (1 = exact)
 */
function judgeOf(drv: Drv, other: AiCar): number {
  const { state, traits, rnd } = drv;
  if (state.stopCar !== other) {
    state.stopCar = other;
    const skill = Math.max(0, Math.min(1, traits.skill));
    state.stopJudge = (1 - skill) * JUDGE * (2 * rnd() - 1);
  }
  return 1 + (state.stopJudge ?? 0);
}

// ?passearly: m inside its clearance a car once clear of a stopped one must come before it is in
// line with it again (MEASURED tools/scratch/_passscene.mjs: at the clearance's edge the brake
// held and let go every step, the target 12 <-> 60 m/s, the brake in pulses)
const IN_LINE_HYST_M = 0.3;

/**
 * Whether my body is in line with a stopped car - inside its clearance; ?passearly: once clear of
 * it, not again until IN_LINE_HYST_M inside (the driver's state keeps the cars it is clear of).
 * @param drv the driver context
 * @param other the stopped car
 * @param offset m between my place across and its
 * @returns in line
 */
function inLineOf(drv: Drv, other: StoppedCar, offset: number): boolean {
  const apart = Math.abs(offset);
  if (!FIX.passearly) return apart < other.clear;
  const clearOf = (drv.state.stopClear ??= new WeakSet());
  if (apart >= other.clear) {
    clearOf.add(other.car);
    return false;
  }
  if (clearOf.has(other.car) && apart >= other.clear - IN_LINE_HYST_M) return false;
  clearOf.delete(other.car);
  return true;
}

// what stopCap returns (reused: no allocation per step)
const stopRead = { cap: Infinity, inLine: false };

/**
 * The speed cap for the stopped and much slower cars ahead: Infinity when my body is clear
 * of every one of them; and whether it is in line with one (then going round it is a move).
 * @param drv the driver context
 * @param car my car
 * @param mine my path, my point on it, my m/s and my lateral target (m off the path)
 * @param mine.path my path
 * @param mine.nearIdx my point on it
 * @param mine.latT m off the path I am going to
 * @param stopped the cars not racing ahead (driverTraffic.ts carsStep)
 * @returns the cap (m/s) and whether my body is in line with one (shared: read before the next
 *   call)
 */
export function stopCap(drv: Drv, car: AiCar, mine: { path: AiPath; nearIdx: number;
  latT: number }, stopped: StoppedCar[]): typeof stopRead {
  const actual = lateralOf(car, mine.path, mine.nearIdx);
  let cap = Infinity, nearest: StoppedCar | null = null;
  for (const other of stopped) {
    if (!inLineOf(drv, other, actual - other.lat)) continue;
    if (!nearest || other.fwd < nearest.fwd) nearest = other;
  }
  stopRead.inLine = !!nearest;
  if (!nearest) {
    drv.state.stopCar = null;
    stopRead.cap = cap;
    return stopRead;
  }
  const judge = judgeOf(drv, nearest.car);
  const decel = STOP_BRAKE * carGrip(car.spec).brakeG * GRAVITY * (car.surface.mu || 1);
  for (const other of stopped) {
    const offset = actual - other.lat;
    if (!inLineOf(drv, other, offset)) continue;
    const gap = other.fwd - other.along - car.spec.len / 2;
    const room = (gap - KEEP_M) * judge;
    // the side my plan goes round it on; none when the plan itself ends on it
    const planOff = mine.latT - other.lat;
    const way = Math.abs(planOff) >= other.clear;
    const need = way ? other.clear - Math.sign(planOff) * offset : Infinity;
    let miss = Math.max(0, other.v) + missSpeed(room, LAG_S + need / SWERVE_RATE, decel);
    if (way) miss = Math.max(miss, CREEP_V);
    cap = Math.min(cap, miss);
  }
  stopRead.cap = cap;
  return stopRead;
}

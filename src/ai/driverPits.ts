// ai/driverPits.ts - THE AI'S PIT STOPS (?pitstops step 2; owner 11-15: "AI: the same rules, a
// short skill-based delay for the menu"). Each lap, ~220 m before the pit lane's branch (the
// joker's way: ai/line.ts branches.pit), a driver decides whether to stop: the compulsory stop
// (a dry F1 race: fresh tyres) on its planned lap - drawn from laps 2 .. the last but one - or
// worn tyres or damage past its own limits (the more aggressive, the more it puts up with). On
// the pit lane the limiter (60 km/h), then it brakes into ITS box (its grid slot's) and stands
// there for its "menu" (1.5 s for the best driver .. 4 s) and the work (world/pitlane.ts
// pitWorkTime: the same as yours), with fresh tyres and the damage repaired; then on along the
// lane and back to the line.
import { FIX } from "../core/fixes.ts";
import { GRAVITY } from "../cars.ts";
import { K_BRAKE, carGrip, nearestIdx } from "./line.ts";
import { repair } from "../damage.ts";
import { PIT_LIMIT_V, onPitLane, pitWorkTime } from "../world/pitlane.ts";
import type { PitLevel } from "../world/pitlane.ts";
import type { AiCar, DriveCtx } from "./types.ts";
import type { Drv, AiPath } from "./driverCtx.ts";

// m before the branch the stop is decided, and from the switch point the driver turns in
const DECIDE_M = 220, TURN_IN_M = 3;
// the share of the field's damage / tyre wear past which a driver stops anyway (an aggressive one
// later: + the aggression x these)
const DAMAGE_STOP = 0.3, DAMAGE_STOP_AGGR = 0.3, WEAR_STOP = 0.7, WEAR_STOP_AGGR = 0.2;
// s: its "menu" - the best driver's and the slowest's
const MENU_TOP_S = 1.5, MENU_WEAK_S = 4;
// m from its box it counts as there, and the m/s under which it has stopped
const AT_BOX_M = 1.2, STOPPED_V = 0.5;
// the share of the car's full braking it plans to stop in its box with
const BOX_BRAKE = 0.5;
// s added at the finish when a compulsory stop was not made
const MISSED_STOP_S = 30;

/** One driver's pit stops: its planned lap, the lap decided, the stop wanted, made, its phase. */
export interface PitState {
  plan: number; decLap: number; want: boolean; done: boolean;
  phase: 'race' | 'lane' | 'stopped'; until: number; boxI: number;
}

/** What the game tells the driver about the race's stops. */
export interface PitCtx { on: boolean; compulsory: boolean }

/**
 * The car's mean tyre wear and damage, 0..1.
 * @param car the car
 * @returns wear and damage
 */
function carWear(car: AiCar): { wear: number; damage: number } {
  const mean = (list: number[] | undefined) => (list && list.length
    ? list.reduce((all, one) => all + one, 0) / list.length : 0);
  return { wear: mean((car as { tyreWear?: number[] }).tyreWear),
    damage: mean((car as { dmg?: number[] }).dmg) };
}

/**
 * Decides once a lap whether this lap is a stop.
 * @param drv the driver
 * @param car the car
 * @param pit the stop's state
 * @param race the race's stops, its lap and length
 * @param race.rules what the game says (compulsory)
 * @param race.lap the lap
 * @param race.laps the race's laps
 */
function decidePit(drv: Drv, car: AiCar, pit: PitState, race: { rules: PitCtx; lap: number;
  laps: number }) {
  const { lap, laps, rules } = race, aggr = drv.traits.aggression;
  pit.decLap = lap;
  if (lap >= laps) { pit.want = false; return; }
  const { wear, damage } = carWear(car);
  pit.want = (rules.compulsory && !pit.done && lap >= pit.plan)
    || damage > DAMAGE_STOP + DAMAGE_STOP_AGGR * aggr || wear > WEAR_STOP + WEAR_STOP_AGGR * aggr;
}

/**
 * At the box: the work done on the car (fresh tyres; the damage repaired), and its time.
 * @param drv the driver
 * @param car the car
 * @param pit the stop's state
 */
function workAtBox(drv: Drv, car: AiCar, pit: PitState) {
  const { damage } = carWear(car);
  const menu = MENU_WEAK_S - (MENU_WEAK_S - MENU_TOP_S) * Math.max(0, Math.min(1,
    drv.traits.skill));
  pit.until = drv.state.t + menu + pitWorkTime(true, damage > 0, damage);
  (car as { tyreWear?: number[] }).tyreWear = [0, 0, 0, 0];
  if (damage > 0) repair(car as Parameters<typeof repair>[0]);
  pit.done = true;
  pit.phase = 'stopped';
}

/**
 * The stop's state for a driver (made on the first call).
 * @param drv the driver
 * @param laps the race's laps
 * @returns the state
 */
function pitStateOf(drv: Drv, laps: number): PitState {
  const state = drv.state as { pit?: PitState };
  state.pit ??= { plan: 2 + Math.floor(drv.rnd() * Math.max(1, laps - 2)), decLap: -1,
    want: false, done: false, phase: 'race', until: 0, boxI: -1 };
  return state.pit;
}

/**
 * The pit stop's step for a driver: on the lap - the decision and the turn in at the branch; on
 * the pit lane - the limiter, the stop in its box, the wait. The speed cap, and the place across
 * the path its box asks for (m, 0 when none).
 * @param drv the driver
 * @param car the car
 * @param ctx what the game tells it (ctx.pits: the race's stops)
 * @param where its path, point on it, lap and the race's laps
 * @param where.path its path
 * @param where.nearIdx its point
 * @param where.lap the lap
 * @param where.laps the race's laps
 * @returns the cap (m/s) and the place across (m)
 */
export function pitStep(drv: Drv, car: AiCar, ctx: DriveCtx & { pits?: PitCtx },
  where: { path: AiPath; nearIdx: number; lap: number; laps: number }): { cap: number;
  lat: number } {
  const branch = drv.branches.pit, pits = (drv.level as PitLevel).pits, rules = ctx.pits;
  const free = { cap: Infinity, lat: 0 };
  const carPen = car as AiCar & { _pitPen?: number };
  if (!FIX.pitstops || !branch || !pits || !rules?.on) return free;
  const pit = pitStateOf(drv, where.laps), { path, nearIdx } = where;
  carPen._pitPen = rules.compulsory && !pit.done ? MISSED_STOP_S : 0;
  if (path === drv.main) {
    pit.phase = 'race';
    const count = drv.count;
    const toSwitch = (((branch.switchI! - nearIdx) % count) + count) % count * drv.line.sp;
    if (toSwitch < DECIDE_M && pit.decLap !== where.lap) {
      decidePit(drv, car, pit, { rules, lap: where.lap, laps: where.laps });
    }
    if (pit.want && toSwitch <= TURN_IN_M) {
      drv.state.path = branch;
      drv.state.i = 0;
      pit.want = false;
      pit.phase = 'lane';
    }
    return free;
  }
  if (path !== branch) return free;
  return onTheLane(drv, car, { pit, pits, branch, nearIdx });
}

/**
 * On the pit lane: the limiter, braking into its box, standing there for the menu and the work.
 * @param drv the driver
 * @param car the car
 * @param lane the stop's state, the pit lane, its branch and its point on it
 * @param lane.pit the stop's state
 * @param lane.pits the pit lane
 * @param lane.branch the branch
 * @param lane.nearIdx its point
 * @returns the cap (m/s) and the place across (m)
 */
function onTheLane(drv: Drv, car: AiCar, lane: { pit: PitState; pits: NonNullable<PitLevel['pits']>;
  branch: AiPath; nearIdx: number }): { cap: number; lat: number } {
  const { pit, pits, branch, nearIdx } = lane;
  const box = pits.boxes[Math.min(pits.boxes.length - 1,
    Math.max(0, (car as { _pitBox?: number })._pitBox ?? 0))];
  if (pit.boxI < 0) pit.boxI = nearestIdx(branch.pts, box.x, box.y);
  const point = branch.pts[pit.boxI];
  const lat = (box.x - point.x) * -Math.sin(point.h) + (box.y - point.y) * Math.cos(point.h);
  let cap = onPitLane(drv.level as PitLevel, car.x, car.y) ? PIT_LIMIT_V : Infinity;
  if (pit.phase === 'stopped') {
    if (drv.state.t < pit.until) return { cap: 0, lat };
    pit.phase = 'race';
    return { cap, lat: 0 };
  }
  if (pit.phase !== 'lane') return { cap, lat: 0 };
  const toBox = (pit.boxI - nearIdx) * branch.sp;
  if (toBox < -AT_BOX_M) return { cap, lat: 0 };
  const decel = BOX_BRAKE * K_BRAKE * carGrip(car.spec).brakeG * GRAVITY;
  cap = Math.min(cap, Math.sqrt(2 * decel * Math.max(0, toBox)));
  if (toBox <= AT_BOX_M && Math.hypot(car.vx, car.vy) < STOPPED_V) workAtBox(drv, car, pit);
  return { cap, lat };
}

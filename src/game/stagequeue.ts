// game/stagequeue.ts - A RALLY STAGE'S START QUEUE (owner 11-22: "the next car creeps
// up to the start line and leaves from a standstill on its own green"). The cars due after you
// wait nose to tail behind your start spot, STAGE_GAP_M apart (game/grid.ts gridPos); as each one
// goes (you first, at your green) every car behind it creeps up a place at a walking pace, its own
// driver steering, and stops on its spot - the next car on your start spot, where it waits for its
// own green (game/order.ts carHeld) and is timed from it (grid.ts placeStageCar: its start).
import { holdSpeed } from '../ai/formation.ts';
import { querySubtrack } from '../world/tyrewall.ts';
import { LEVEL } from '../world/state.ts';
import { FIX } from '../core/fixes.ts';
import { STAGE_GAP_M } from './grid.ts';
import { startHeld, carHeld } from './order.ts';
import { game } from './state.ts';
import type { AiEntry, GameCar } from './state.ts';
import type { CarInput } from '../vehicle.ts';

// m/s a queued car creeps up at; m short of its spot it brakes to a stop (the creep's own
// stopping distance at a gentle 1.5 m/s^2 is ~2 m: it eases down over QUEUE_EASE_M)
const QUEUE_CREEP_MS = 3, QUEUE_STOP_M = 0.5, QUEUE_EASE_M = 4;
// m: (?queuefit) a queued car stops while any car is this close ahead of its nose (MEASURED, on a
// generated stage: two queued cars came 2.3 m apart centre to centre - one read its place straight
// back from your spot, the other along the road)
const QUEUE_CLEAR_M = 7;

/** The start spot's stage progress (you start here: the spawn), m (negative: before the line). */
let spotLevel: object | null = null, spotProg = 0;

/**
 * Your start spot's progress on the current stage, found once per level.
 * @returns m (negative: before the line)
 */
function startSpotProg(): number {
  if (spotLevel !== LEVEL) {
    const sub = LEVEL.subtrack!, hit = querySubtrack(sub, LEVEL.spawn.x, LEVEL.spawn.y);
    spotProg = hit.trackDist > sub.totalDist / 2 ? hit.trackDist - sub.totalDist : hit.trackDist;
    spotLevel = LEVEL;
  }
  return spotProg;
}

/**
 * A held queued car's spot: your start spot, back one place for each car still waiting ahead
 * of it (you until your green, and every queued car due before it).
 * @param car the car
 * @returns its spot's progress, m
 */
function queueSpot(car: GameCar): number {
  let ahead = startHeld() ? 1 : 0;
  for (const entry of game.ai) {
    const other = entry.car;
    if (other !== car && (other._slot ?? 0) > 0 && (other._slot ?? 0) < (car._slot ?? 0)
      && carHeld(other)) ahead++;
  }
  return startSpotProg() - ahead * STAGE_GAP_M;
}

/**
 * Whether any other car (you too) is within QUEUE_CLEAR_M ahead of a queued car's nose.
 * @param car the queued car
 * @returns there is
 */
function carAhead(car: GameCar): boolean {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  for (const other of [game.car, ...game.ai.map((entry) => entry.car)]) {
    if (other === car) continue;
    const dx = other.x - car.x, dy = other.y - car.y, along = dx * cos + dy * sin;
    if (along > 0 && along < QUEUE_CLEAR_M && Math.abs(dy * cos - dx * sin) < 2.5) return true;
  }
  return false;
}

/**
 * The controls of a queued car held for its green: creeping up to its spot, else
 * stopped there. Null when it is not a queued car.
 * @param entry the AI
 * @param want its driver's own controls (their steering is kept)
 * @returns the controls, or null
 */
export function queueInput(entry: AiEntry, want: CarInput): CarInput | null {
  const car = entry.car;
  // (?queuefit: a car queued past the run-up, off the road, has no progress yet - read straight
  // back from your start spot: the run-up and the queue past it are straight)
  const prog = car._prog ?? (FIX.queuefit ? startSpotProg() - Math.hypot(car.x - LEVEL.spawn.x,
    car.y - LEVEL.spawn.y) : null);
  if ((car._slot ?? 0) <= 0 || prog == null) return null;
  const toGo = queueSpot(car) - prog, speed = Math.hypot(car.vx, car.vy);
  if (toGo < QUEUE_STOP_M || (FIX.queuefit && carAhead(car)))
    return { steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0 };
  const target = QUEUE_CREEP_MS * Math.min(1, toGo / QUEUE_EASE_M);
  return { ...holdSpeed(speed, target), steer: want.steer, handbrake: 0, reverse: 0 };
}

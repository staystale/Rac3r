// game/aistuck.ts - A RACING AI TRULY STUCK (?stuckreset=1, TODO 3a2 bug 8): when the game puts an
// AI racer back, and where. Two watches, both from the green to the end, never while the start
// holds it or a crash is playing out:
// - STAYED: the car has stayed within STUCK_RADIUS_M of one spot for STUCK_RESET_S - nose in a
//   wall, beached, rocking back and forth on its drive-outs, on its side or roof. Not stuck: a car
//   QUEUED (one close in front, facing its way and itself nearly still: the head of the queue is
//   what is stuck), and a car PULLING AWAY (going forwards and gaining since it went slow, never
//   backed up since: an icy start creeping off).
// - NO PROGRESS: slower than CRAWL_MS and not queued, it has not gained PROGRESS_M along the race
//   in NO_PROGRESS_S - crawling round in sand or gravel, creeping backwards out of a jam.
// MEASURED (tools/scratch/_stuckai.mjs, the old rules): the 3 s under 1 m/s reset reset cars in a
// jam and missed the ones rocking on their drive-outs (over 1 m/s while reversing: 10-15 s
// stuck), the ones creeping backwards out of a jam, and the ones bogged in the Sahara's sand at
// ~2 m/s (20-29 s); its put-back went 4 m behind where the car last was on the road, onto the jam.
// Put back the way your reset is (?resetback=1, game/resetspot.ts): never ahead of where the car
// is, the next free spot behind a car in the way.
import { game } from './state.ts';
import { LEVEL } from '../world/state.ts';
import { onTrack } from '../world/tyrewall.ts';
import { trackSpotOf } from '../world/trackunder.ts';
import { sameLevel } from '../world/crossinggeo.ts';
import { firstFree, lapStepBack, notAheadOf } from './resetspot.ts';
import type { SpotBody } from './resetspot.ts';
import type { AiEntry, GameCar, StuckWatch } from './state.ts';
import type { Subtrack } from '../world/types.ts';

// s a car stays put before it is put back (the owner's 5-10 s)
export const STUCK_RESET_S = 6;
// m it may move about one spot and still be stuck there (a drive-out reverses 2-4 m)
export const STUCK_RADIUS_M = 5;
// s slow without gaining PROGRESS_M along the race before it is put back
export const NO_PROGRESS_S = 10;
// m/s under which a car counts as crawling, m of race progress that counts as getting on
const CRAWL_MS = 4, PROGRESS_M = 3;
// m/s gained since it went slow that says TRYING (an icy start creeping away), not stuck -
// MEASURED: a muscle car on ice crawls under 1 m/s for 4-7 s on its way off the grid
// (ai/driveOut.ts holds the same)
export const TRYING_GAIN = 0.08;
// m/s backwards that counts as having backed up (a drive-out)
const BACKING_MS = 0.3;
// m bumper to bumper, and m/s, within which a car in front makes a QUEUE; how far off its heading
const QUEUE_GAP_M = 6, QUEUE_STILL_MS = 2, QUEUE_TURN_COS = Math.cos(Math.PI / 3);

/**
 * Whether one car stands close in front of another, facing its way and nearly still.
 * @param car the car waiting
 * @param other the car in front
 * @param cos cosine of the car's heading
 * @param sin sine of the car's heading
 * @returns true when other holds car up
 */
function holdsUp(car: SpotBody, other: GameCar, cos: number, sin: number): boolean {
  if (other === car || !sameLevel(other, car as GameCar)) return false;
  if (Math.hypot(other.vx, other.vy) > QUEUE_STILL_MS) return false;
  if (Math.cos(other.heading) * cos + Math.sin(other.heading) * sin < QUEUE_TURN_COS) return false;
  const dx = other.x - car.x, dy = other.y - car.y;
  const along = dx * cos + dy * sin, across = -dx * sin + dy * cos;
  return along > 0 && along < (car.spec.len + other.spec.len) / 2 + QUEUE_GAP_M
    && Math.abs(across) < (car.spec.wid + other.spec.wid) / 2;
}

/**
 * Whether a car waits in a queue: you, a racing AI or a highway car close in front holds it up.
 * @param car the car
 * @returns true when queued
 */
export function isQueued(car: GameCar): boolean {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  if (holdsUp(car, game.car, cos, sin)) return true;
  for (const entry of game.ai) if (holdsUp(car, entry.car, cos, sin)) return true;
  for (const other of game.traffic.cars) if (holdsUp(car, other as GameCar, cos, sin)) return true;
  return false;
}

/**
 * The car's progress along the race, m: round the lap, or up the endless road.
 * @param car the car
 * @returns m, or null before it has any
 */
function raceProgress(car: GameCar): number | null {
  const progress = LEVEL.endless ? car._hwf?.s : car._prog;
  return progress === undefined || !Number.isFinite(progress) ? null : progress;
}

/**
 * Starts the watch again where the car is now.
 * @param watch the watch
 * @param car the car
 */
function restartWatch(watch: StuckWatch, car: GameCar) {
  watch.x = car.x;
  watch.y = car.y;
  watch.t = 0;
  watch.from = Math.hypot(car.vx, car.vy);
  watch.backed = false;
}

/**
 * The STAYED watch for one step: true once the car has stayed put, not queued and not pulling
 * away, for STUCK_RESET_S.
 * @param watch the watch
 * @param car the car
 * @param dt the step, s
 * @returns true when stuck
 */
function stayedStuck(watch: StuckWatch, car: GameCar, dt: number): boolean {
  const speed = Math.hypot(car.vx, car.vy), forward = car.t.vLong;
  if (Math.hypot(car.x - watch.x, car.y - watch.y) > STUCK_RADIUS_M
    || (!watch.backed && forward > 0 && speed - watch.from > TRYING_GAIN) || isQueued(car)) {
    restartWatch(watch, car);
    return false;
  }
  if (forward < -BACKING_MS) watch.backed = true;
  watch.t += dt;
  return watch.t > STUCK_RESET_S;
}

/**
 * The NO PROGRESS watch for one step: true once the car, slow and not queued, has not gained
 * PROGRESS_M along the race for NO_PROGRESS_S.
 * @param entry the AI entry
 * @param dt the step, s
 * @returns true when it is getting nowhere
 */
function noProgress(entry: AiEntry, dt: number): boolean {
  const car = entry.car, progress = raceProgress(car);
  if (progress === null || entry.progressFrom === undefined || progress > entry.progressFrom
    + PROGRESS_M) {
    entry.progressFrom = progress ?? undefined;
    entry.progressT = 0;
    return false;
  }
  entry.progressT = (entry.progressT ?? 0) + dt;
  if (entry.progressT <= NO_PROGRESS_S) return false;
  if (Math.hypot(car.vx, car.vy) < CRAWL_MS && !isQueued(car)) return true;
  // (quick, or queued: getting on - a bridge or a joker lane holds the lap's progress)
  entry.progressFrom = progress;
  entry.progressT = 0;
  return false;
}

/**
 * Steps an AI car's stuck watches; true when it is truly stuck and must be put back.
 * @param entry the AI entry
 * @param held true while the start holds it (or a crash is playing out)
 * @param dt the step, s
 * @returns true to put it back now
 */
export function stuckWatchFires(entry: AiEntry, held: boolean, dt: number): boolean {
  const car = entry.car;
  const watch = entry.stuckWatch ??= { x: car.x, y: car.y, t: 0, from: 0, backed: false };
  if (held) {
    restartWatch(watch, car);
    entry.progressFrom = undefined;
    return false;
  }
  const stayed = stayedStuck(watch, car, dt), nowhere = noProgress(entry, dt);
  if (!stayed && !nowhere) return false;
  restartWatch(watch, car);
  entry.progressFrom = undefined;
  return true;
}

/**
 * Where a stuck AI goes back to on a lap or stage: from where it last was on the road (no record:
 * where it is), never ahead of where it is now (game/resetspot.ts notAheadOf).
 * @param sub the road
 * @param car the car
 * @returns road distance and offset, m, or null when it has no place on the road
 */
export function behindRecord(sub: Subtrack, car: GameCar): { dist: number; off: number } | null {
  let rec = car._lastOn ?? null;
  if (!rec) {
    const point = trackSpotOf(sub, car.x, car.y, car);
    if (!point) return null;
    rec = { dist: point.dist, off: (car.x - point.x) * point.nx + (car.y - point.y) * point.ny };
  }
  return notAheadOf(sub, rec, car);
}

/**
 * The first spot free of every other racer (you and the AI) from a lap reset's spot backwards,
 * FREE_STEP_M at a time (game/resetspot.ts firstFree).
 * @param car the car put back
 * @param sub the road
 * @param dist the reset's own road distance, m
 * @param across its offset from the centre line, m
 * @param turn its nose turned from the road's heading, radians
 * @returns the road distance, m
 */
export function freeLapSpot(car: GameCar, sub: Subtrack, dist: number, across: number,
  turn: number): number {
  const others: SpotBody[] = [game.car];
  for (const entry of game.ai) if (entry.car !== car) others.push(entry.car);
  return firstFree(dist, (spotAt) => {
    const point = onTrack(sub, spotAt, across, {});
    return { x: point.x, y: point.y, heading: point.rot + turn };
  }, lapStepBack(sub), 0, { spec: car.spec, others });
}

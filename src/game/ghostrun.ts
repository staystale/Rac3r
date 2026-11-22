// game/ghostrun.ts - GHOST CARS in a session (passed 11-22): in TEST MODE only, on every
// track but the highways, with the setup's GHOST on. Each lap (the lap timer's: lap 1 from the
// move off the grid, then every crossing of the line) or stage run (start line to finish) is
// recorded (game/ghostcar.ts); the quickest - this session's or the saved one, whichever is
// quicker, any lap, resets and all - is played back on the same clock as a see-through car that
// is only drawn (game.ghostCar, render/screen.ts): never in the field, the contacts or the AI's
// view.
// A new best is saved at the safe moments (game/session.ts saveRecords).
import { LEVEL } from '../world/state.ts';
import { makeCar } from '../vehicle.ts';
import { game, shared } from './state.ts';
import type { GameCar } from './state.ts';
import { ghostKey, loadGhost, newTape, poseAt, recordTape, saveGhost } from './ghostcar.ts';
import type { GhostTape } from './ghostcar.ts';

// this session's ghost: its key, the tape being recorded and its lap, the best (played), whether
// that best is new since the last save, and the car drawn for it
const run = { key: '', rec: null as GhostTape | null, recLap: 0, best: null as GhostTape | null,
  dirty: false, car: null as GameCar | null };

/**
 * Whether ghosts run in this session: the setup's GHOST, TEST MODE, a track (not a highway).
 * @returns on
 */
const ghostOn = () => !!shared.ghostOn && !!game.testMode && !!LEVEL.subtrack
  && !LEVEL.endless;

/**
 * The car drawn for the best: the player's own (its paint), placed only by the tape.
 * @param tape the best
 * @returns the car
 */
function ghostCarOf(tape: GhostTape): GameCar {
  const car = makeCar(tape.car) as GameCar;
  car.spec = { ...game.car.spec };
  return car;
}

/**
 * A session (re)starts: the best for this track, direction and car - kept from before on the same
 * key (a restart), else the saved one - and nothing recording.
 */
export function resetGhost(): void {
  game.ghostCar = null;
  run.rec = null;
  run.recLap = 0;
  if (!ghostOn()) return;
  const carId = String(game.car.spec.id).split('#')[0];
  // (a level's direction for its bests - a hill climb's up / down: its own ghostDir)
  const key = ghostKey(LEVEL.id, (LEVEL as { ghostDir?: string }).ghostDir, carId);
  if (key !== run.key) {
    run.key = key;
    run.best = loadGhost(key);
    run.dirty = false;
  }
  run.car = run.best ? ghostCarOf(run.best) : null;
}

/**
 * A lap or run done: its tape the best when it is quicker.
 * @param tape the tape
 * @param time its time, s
 */
function finishTape(tape: GhostTape, time: number): void {
  tape.time = time;
  if (run.best && run.best.time <= time) return;
  run.best = tape;
  run.dirty = true;
  run.car = ghostCarOf(tape);
}

/**
 * The clock the ghost runs on: the stage's while running, else the lap's once started; null when
 * neither runs.
 * @returns s, or null
 */
function clockNow(): number | null {
  if (LEVEL.stage) return game.stage.state === 'running' ? game.stage.t : null;
  return shared.lapState.started ? shared.lapState.lapTime : null;
}

/** Records this step into the lap's or the stage run's tape, closing it at the line / finish. */
function recordStep(): void {
  const carId = String(game.car.spec.id).split('#')[0];
  const pose = { x: game.car.x, y: game.car.y, h: game.car.heading };
  if (LEVEL.stage) {
    const stage = game.stage;
    if (stage.state === 'running') {
      run.rec ??= newTape(carId);
      recordTape(run.rec, stage.t, pose);
    } else if (stage.state === 'done' && run.rec) {
      finishTape(run.rec, stage.t);
      run.rec = null;
    } else run.rec = null;
    return;
  }
  const lap = shared.lapState;
  if (!lap.started) return;
  if (lap.lap !== run.recLap) {
    if (run.rec && run.recLap > 0 && lap.lastTime != null) finishTape(run.rec, lap.lastTime);
    run.rec = newTape(carId);
    run.recLap = lap.lap;
  }
  recordTape(run.rec!, lap.lapTime, pose);
}

/** One sim step: record, then place the ghost on the best's tape at the clock (or hide it). */
export function stepGhost(): void {
  if (!ghostOn()) {
    game.ghostCar = null;
    return;
  }
  recordStep();
  const clock = clockNow();
  const pose = clock === null ? null : poseAt(run.best, clock);
  if (!pose || !run.car) {
    game.ghostCar = null;
    return;
  }
  run.car.x = pose.x;
  run.car.y = pose.y;
  run.car.heading = pose.h;
  game.ghostCar = run.car;
}

/** Saves a new best (a safe moment: game/session.ts saveRecords) when it beats the saved one. */
export function saveGhostBest(): void {
  if (!run.dirty || !run.best || !run.key) return;
  run.dirty = false;
  const saved = loadGhost(run.key);
  if (saved && saved.time <= run.best.time) return;
  saveGhost(run.key, run.best, String(LEVEL.name || LEVEL.id));
}

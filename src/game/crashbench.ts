// game/crashbench.ts - FESTIVAL OF SPLAT's field (world/levels/crashbench.ts): on each start of the
// level, 19 cars of the roster in the two rows held flat out (AI entries with held controls:
// game/ai.ts - no driver, never put back on a road) and you in the back row's middle, all at
// 120 mph at the tyre wall.
import { makeCar, reset } from '../vehicle.ts';
import { ROSTER } from '../cars.ts';
import { LEVEL } from '../world/state.ts';
import {
  BENCH_LAUNCH, BENCH_PER_ROW, BENCH_YOU, benchSlot,
} from '../world/levels/crashbench.ts';
import { game, shared } from './state.ts';
import type { AiEntry } from './state.ts';

// what the held cars drive with: flat out, straight
const FLAT_OUT = { steer: 0, throttle: 1, brake: 0, handbrake: 0 };

/**
 * Lines up the bench's field when its level starts (game/session.ts doRestart): the held cars in
 * their slots and you in yours, every one launched at the wall.
 * @returns true when this is the bench's level (its field is set)
 */
export function lineUpCrashBench(): boolean {
  if (LEVEL.id !== 'crash-bench') return false;
  const ids = ROSTER.map((row) => row.id);
  game.ai = [];
  for (let row = 0; row < 2; row++)
    for (let slot = 0; slot < BENCH_PER_ROW; slot++) {
      const start = benchSlot(row, slot);
      if (row === BENCH_YOU.row && slot === BENCH_YOU.slot) {
        reset(game.car, start.x, start.y, start.heading);
        game.car.vy = BENCH_LAUNCH;
        continue;
      }
      const car = makeCar(ids[(row * BENCH_PER_ROW + slot) % ids.length]);
      reset(car, start.x, start.y, start.heading);
      car.vy = BENCH_LAUNCH;
      game.ai.push({ car, held: FLAT_OUT, stuckT: 0, inGate: false,
        drv: { state: {} } } as unknown as AiEntry);
    }
  // the camera on you, not swept from the spawn
  if (shared.renderer && shared.renderer.snap) shared.renderer.snap(game.car);
  return true;
}

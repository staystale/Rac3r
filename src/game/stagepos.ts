// game/stagepos.ts - A RALLY STAGE'S LIVE POSITION (?stagepos; owner 11-22: "P n/N should show
// true to the current times available"): like real live timing, each car's time at every SPLIT_M
// of the stage from its own start; a car is ahead of you when, at the furthest split you both have
// (yours if it has passed you, its own if not), its time is less than yours. A car not started yet
// is behind. A car placed down the stage at your green (game/grid.ts placeStageCar) has its splits
// up to there from the pace that placed it; one already home the whole stage, scaled to its
// result. Display only: the result is the race flow's (raceflow.ts).
import { lineRun } from '../ai/line.ts';
import { LEVEL } from '../world/state.ts';
import type { GameCar } from './state.ts';
import type { RaceFlow } from '../raceflow.ts';

// m between two splits
const SPLIT_M = 20;

/** A car's splits: s from its start at each split (NaN not reached), how many filled, its race. */
interface Splits { times: Float64Array; filled: number; flow: RaceFlow | null }
const SPLITS = new WeakMap<object, Splits>();

/**
 * A car's splits for this race (new for a new race: your car runs every race).
 * @param car the car
 * @param flow the race, or null before it is made
 * @returns its splits
 */
function splitsOf(car: object, flow: RaceFlow | null): Splits {
  let splits = SPLITS.get(car);
  if (!splits || (flow && splits.flow && splits.flow !== flow)) {
    const count = Math.floor((LEVEL.stage?.finish || 0) / SPLIT_M) + 1;
    splits = { times: new Float64Array(count).fill(NaN), filled: 0, flow };
    SPLITS.set(car, splits);
  }
  if (flow && !splits.flow) splits.flow = flow;
  return splits;
}

/**
 * Fills a car's splits from its own pace (ai/line.ts lineRun), for the stage it ran before your
 * green: up to where it is placed, or the whole stage for a car already home.
 * @param car the car
 * @param pace its driver's pace
 * @param upToM how far, m
 * @param scale its times x this (a home car: its result over its predicted time)
 */
export function prefillStageSplits(car: GameCar, pace: number, upToM: number, scale: number) {
  const splits = splitsOf(car, null);
  const last = Math.min(splits.times.length - 1, Math.floor(upToM / SPLIT_M));
  splits.times[0] = 0;
  for (let i = 1; i <= last; i++)
    splits.times[i] = lineRun(LEVEL, car.spec, pace, Infinity, i * SPLIT_M).t * scale;
  splits.filled = Math.max(1, last + 1);
}

/**
 * Records every started car's splits up to where it is now (one sim step).
 * @param flow the stage's race
 */
function recordStageSplits(flow: RaceFlow) {
  for (const entry of flow.entries) {
    const car = entry.car as GameCar;
    if (entry.start == null || car._prog == null) continue;
    const splits = splitsOf(car, flow), finish = LEVEL.stage!.finish;
    const reached = Math.min(splits.times.length - 1, Math.floor(Math.min(car._prog, finish)
      / SPLIT_M));
    const elapsed = entry.finish != null ? entry.time! : flow.t - entry.start;
    for (let i = splits.filled; i <= reached; i++) splits.times[i] = elapsed;
    splits.filled = Math.max(splits.filled, reached + 1);
  }
}

/**
 * Your live place on a stage (one sim step): the splits recorded, then every car ahead of you on
 * the times so far counted.
 * @param flow the stage's race
 * @returns your place, 1 = first
 */
export function stagePosition(flow: RaceFlow): number {
  recordStageSplits(flow);
  const mine = flow.entries.find((entry) => entry.player);
  if (!mine) return 1;
  const own = splitsOf(mine.car, flow);
  if (own.filled === 0) return 1;
  let ahead = 0;
  for (const entry of flow.entries) {
    if (entry === mine) continue;
    const other = splitsOf(entry.car, flow);
    if (other.filled === 0) continue;
    // (the start line itself decides nothing: every time there is ~0)
    const split = Math.min(own.filled, other.filled) - 1;
    if (split >= 1 && other.times[split] < own.times[split]) ahead++;
  }
  return ahead + 1;
}

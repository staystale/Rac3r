// world/trains.ts - A RAIL BRIDGE'S TRAIN, where it is (the drawing, render/props/bridges.ts, and,
// with, the cars it meets on the deck, world/crossings.ts): every trainEvery s a
// train crosses the whole length of the bridge's track, one way or the other - a passenger train,
// 3-5 coaches of COACH_M at COACH_MS; on Deaf Valley's trestles (look 'desert') a freight, a
// locomotive and 6-9 wagons of WAGON_M at WAGON_MS, every 1.5 x as long between.
import type { Prop } from './types.ts';

// m a coach is long (and the pitch it is laid at), m/s a passenger train runs; a coach's half width
// and its track's offset from the bridge's line, m
export const COACH_M = 18, COACH_PITCH_M = 19, COACH_MS = 32, COACH_HALF_M = 1.4;
export const TRACK_OFF_M = 1.25;
// a freight wagon's length and pitch, m; m/s; half width, m (it runs on the middle track)
export const WAGON_M = 15, WAGON_PITCH_M = 16, WAGON_MS = 22, WAGON_HALF_M = 1.5;
// m the train starts before the track's near end and runs past its far end
const RUN_IN_M = 10;

/** A train on a bridge's track, in the bridge's frame (+x along its track from its middle). */
export interface TrainSpan {
  /** each car's start along the track, m (its length CAR_M on), and which is the engine */
  cars: number[];
  carM: number;
  /** m across the track's line, its half width */
  across: number;
  halfWidth: number;
  /** m/s along +x (negative: the other way); the engine's index in cars */
  speed: number;
  dir: number;
  cycle: number;
}

/** A kind of train: how often, how many cars at a cycle, their pitch and length, speed, width. */
interface TrainKind { every: number; count: (pick: number) => number; pitch: number; carM: number;
  speed: number; halfWidth: number; onMiddle: boolean }
/** The passenger train and the desert's freight. */
const PASSENGER: Omit<TrainKind, 'every'> = { count: (pick) => 3 + (pick % 3), pitch: COACH_PITCH_M,
  carM: COACH_M, speed: COACH_MS, halfWidth: COACH_HALF_M, onMiddle: false };
const FREIGHT: Omit<TrainKind, 'every'> = { count: (pick) => 7 + (pick % 4), pitch: WAGON_PITCH_M,
  carM: WAGON_M, speed: WAGON_MS, halfWidth: WAGON_HALF_M, onMiddle: true };

/**
 * A rail bridge's kind of train.
 * @param prop the bridge (look 'desert': a freight; trainEvery its passenger train's gap, s)
 * @returns the kind
 */
function trainKindOf(prop: Prop): TrainKind {
  const isFreight = prop.look === 'desert', gap = prop.trainEvery || 20;
  return { ...(isFreight ? FREIGHT : PASSENGER), every: gap * (isFreight ? 1.5 : 1) };
}

/**
 * The train on a rail bridge's track at a time, or null between trains.
 * @param prop the rail bridge (wid its span, appL its approaches, trainEvery, seed, look)
 * @param clock seconds (the bridge's own phase added)
 * @returns where its cars are
 */
export function trainAt(prop: Prop, clock: number): TrainSpan | null {
  const half = (prop.wid || 30) / 2, seed = prop.seed || 0, [negApp, posApp] = prop.appL || [0, 0];
  const negEnd = half + 3 + negApp, posEnd = half + 3 + posApp, kind = trainKindOf(prop);
  const cycle = Math.floor(clock / kind.every), since = clock - cycle * kind.every;
  const dir = (cycle + seed) % 2 ? 1 : -1, count = kind.count(cycle + seed);
  const head = -negEnd - RUN_IN_M + since * kind.speed;
  if (head - count * kind.pitch >= posEnd + RUN_IN_M) return null;
  const cars: number[] = [];
  for (let car = 0; car < count; car++) {
    const tailX = head - (car + 1) * kind.pitch;
    // (the other way: mirrored about the middle of [-negEnd, posEnd])
    cars.push(dir > 0 ? tailX : posEnd - negEnd - tailX - kind.carM);
  }
  return { cars, carM: kind.carM, across: kind.onMiddle ? 0 : dir * TRACK_OFF_M,
    halfWidth: kind.halfWidth, speed: dir * kind.speed, dir, cycle };
}

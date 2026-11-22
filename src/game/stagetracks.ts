// game/stagetracks.ts - A STAGE'S TYRE TRACKS FROM THE CARS ALREADY THROUGH (owner
// 11-22: "paint tyre tracks from the start line for each car that has already driven,
// randomised", connected to where each car is when it appears down the stage; cheap - no run is
// simulated). Each car started before you lays its wheels' marks (the skid-mark layer's own:
// marks.ts, a rut on loose ground, nothing on tarmac where a rolling tyre leaves nothing) along
// the racing line from the start line to where it was placed (game/grid.ts spawnAI) - or the
// whole stage for a car already home - off the line by a smooth wander of its own, easing back
// onto the line over TRACK_JOIN_M before the car so its own marks carry straight on (the painted
// wheels are the car's: the layer joins each wheel's next mark to its last).
import { racingLine } from '../ai/line.ts';
import { lcg } from '../core/random.ts';
import { groundAt } from '../world/wear.ts';
import { LEVEL } from '../world/state.ts';
import { game } from './state.ts';
import type { GameCar } from './state.ts';

// m: a car's own line off the racing line (its base, either side); the long and the short wander's
// size and length; the run back onto the line before the car
// (owner on round202: the cars' ruts merged into one dark band - each car now further off the
// next, its own line wandering less: two thin tracks a car)
const TRACK_BASE_M = 1, TRACK_LONG_M = 0.4, TRACK_LONG_L = 120, TRACK_SHORT_M = 0.15,
  TRACK_SHORT_L = 37, TRACK_JOIN_M = 25;
// m between the painted wheels' stamps: a car's own at ~30 m/s (the sim's 120 Hz step). At the
// racing line's own spacing (~1.5 m) every joint of two strokes doubled up into a dark bar across
// the rut - the owner's "strange horizontal lines" (round202).
const TRACK_STAMP_M = 0.25;
// m: kept this far inside the road's edge
const TRACK_EDGE_M = 1;

/**
 * A number of the level's own (its id), so each stage's tracks are its own.
 * @returns the seed
 */
const levelSeed = () => [...LEVEL.id].reduce((sum, char) => Math.imul(sum, 31) + char.charCodeAt(0)
  | 0, 7);

/**
 * A car's wander off the racing line along the stage: smooth, its own (seeded by its number).
 * @param seed the car's seed
 * @returns m off the line at a stage distance, m
 */
function wanderOf(seed: number): (dist: number) => number {
  const rand = lcg(seed >>> 0);
  const base = (rand() * 2 - 1) * TRACK_BASE_M, phaseLong = rand() * Math.PI * 2,
    phaseShort = rand() * Math.PI * 2;
  return (dist) => base + TRACK_LONG_M * Math.sin(dist / TRACK_LONG_L * Math.PI * 2 + phaseLong)
    + TRACK_SHORT_M * Math.sin(dist / TRACK_SHORT_L * Math.PI * 2 + phaseShort);
}

/**
 * Lays one car's tracks from the start line to a stage distance.
 * @param car the car (its marks carry on from these)
 * @param endDist the stage distance its tracks run to, m
 * @returns the marks stamped
 */
function layTracks(car: GameCar, endDist: number): number {
  const line = racingLine(LEVEL), pts = line.pts, count = line.n;
  let index = 0;
  for (let i = 1; i < count; i++) if (pts[i].dist < pts[index].dist) index = i;
  // (the car's own mark id first: the painted wheels share it, so its marks join on)
  game.marks.wheelsOf(car);
  const wander = wanderOf(Math.imul(car.num || 1, 2654435761) ^ levelSeed()), painter =
    Object.create(car) as GameCar;
  painter.t = { ...car.t, slipSpeedF: 0, slipSpeedR: 0 };
  painter.wheelSurf = null;
  let stamps = 0;
  const room = line.hw - TRACK_EDGE_M;
  let prev = pts[index];
  for (let step = 1; step < count; step++) {
    index = (index + 1) % count;
    const point = pts[index];
    // (past the car, or round the line's end)
    if (point.dist < prev.dist || prev.dist >= endDist) break;
    // every TRACK_STAMP_M between two of the line's points
    const span = point.dist - prev.dist, parts = Math.max(1, Math.ceil(span / TRACK_STAMP_M));
    for (let part = 1; part <= parts; part++) {
      const share = part / parts, dist = prev.dist + span * share;
      if (dist > endDist) break;
      const ease = Math.min(1, (endDist - dist) / TRACK_JOIN_M);
      const lineOff = prev.off + (point.off - prev.off) * share;
      const off = Math.max(-room, Math.min(room, lineOff + wander(dist) * ease)) - lineOff;
      const normalX = prev.nx + (point.nx - prev.nx) * share,
        normalY = prev.ny + (point.ny - prev.ny) * share;
      painter.x = prev.x + (point.x - prev.x) * share + normalX * off;
      painter.y = prev.y + (point.y - prev.y) * share + normalY * off;
      painter.heading = Math.atan2(point.y - prev.y, point.x - prev.x);
      painter.surface = groundAt(painter.x, painter.y).surface as GameCar['surface'];
      game.marks.stamp(game.marks.wheelsOf(painter));
      stamps++;
    }
    prev = point;
  }
  return stamps;
}

/**
 * Lays the tracks of every car already through the start (a rally stage): on the
 * road ahead of you to where it is, home over the whole stage.
 * @returns ms it took (the tools read it: window.__game.stageTracksMs)
 */
export function layStageTracks(): number {
  const began = performance.now();
  if (!LEVEL.stage) return 0;
  for (const entry of game.ai) {
    const car = entry.car;
    if ((car._slot ?? 0) < 0 && car._prog != null) layTracks(car, car._prog);
  }
  for (const car of game.aiDone || []) layTracks(car, LEVEL.stage.finish);
  return performance.now() - began;
}

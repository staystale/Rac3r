// world/venuegeo.ts - the geometry a venue's scenery is built with (world/venue.ts,
// venueedge.ts, venuescenery.ts): lines resampled and measured, the nearest race road, a road's
// centre point by distance, and THE PLACER - a real map point at game scale, stepped back from the
// race road so the game's wider road (13 m against the real one at scale) keeps the real gaps
// between the road and what stands beside it.
import { querySubtrack } from "./tyrewall.ts";
import type { Point, Subtrack, SubtrackHit, TrackPoint } from "./types.ts";

// m (game): the game's road on every circuit
export const VENUE_ROAD_M = 13;
export const HALF_ROAD = VENUE_ROAD_M / 2;
// m (game) from a race road within which the map is stepped back in full, and where the step has
// faded to nothing (so far scenery stays where the map puts it)
const STEP_FULL_M = 40, STEP_GONE_M = 110;

/**
 * A line resampled every stepM metres (its corners kept).
 * @param pts the line
 * @param stepM metres between points
 * @returns the points
 */
export function resample(pts: Point[], stepM: number): Point[] {
  const out: Point[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1];
    const count = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / stepM));
    for (let part = 1; part <= count; part++)
      out.push([fromX + (toX - fromX) * part / count, fromY + (toY - fromY) * part / count]);
  }
  return out;
}

/**
 * An open line's length.
 * @param pts the points
 * @returns metres
 */
export function lineLength(pts: Point[]): number {
  let total = 0;
  for (let i = 1; i < pts.length; i++)
    total += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return total;
}

/**
 * How far a point is from a line's nearest segment.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @returns metres
 */
export function distToLine(pts: Point[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1];
    const dx = toX - fromX, dy = toY - fromY, lenSq = dx * dx + dy * dy || 1e-9;
    const frac = Math.max(0, Math.min(1, ((x - fromX) * dx + (y - fromY) * dy) / lenSq));
    best = Math.min(best, Math.hypot(x - fromX - dx * frac, y - fromY - dy * frac));
  }
  return best;
}

/**
 * The point a distance along an open line, with the line's left normal there.
 * @param line the points
 * @param distM metres from its first point
 * @returns the point and normal, or null past its end
 */
export function pointAlong(line: Point[], distM: number):
  { x: number; y: number; nx: number; ny: number } | null {
  let left = distM;
  for (let i = 0; i < line.length - 1; i++) {
    const [fromX, fromY] = line[i], [toX, toY] = line[i + 1];
    const len = Math.hypot(toX - fromX, toY - fromY);
    if (len > 0 && left <= len) {
      const frac = left / len;
      return { x: fromX + (toX - fromX) * frac, y: fromY + (toY - fromY) * frac,
        nx: -(toY - fromY) / len, ny: (toX - fromX) / len };
    }
    left -= len;
  }
  return null;
}

/**
 * A road's centre sample at a distance along it (the samples are in distance order).
 * @param sub the road
 * @param dist metres along it (wrapped)
 * @returns the sample at or before that distance
 */
export function centreAt(sub: Subtrack, dist: number): TrackPoint {
  const pts = sub.pts, want = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
  let low = 0, high = pts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (pts[mid].dist <= want) low = mid; else high = mid - 1;
  }
  return pts[low];
}

/**
 * The nearest of the venue's layout roads to a point (a point past every road's lookup grid
 * reads Infinity).
 * @param loops every layout's road
 * @param x world x
 * @param y world y
 * @returns that road and the hit (dist = metres from its centreline)
 */
export function nearestLoop(loops: Subtrack[], x: number, y: number):
  { sub: Subtrack; hit: SubtrackHit } {
  let best = { sub: loops[0], hit: querySubtrack(loops[0], x, y) };
  for (const sub of loops.slice(1)) {
    const hit = querySubtrack(sub, x, y);
    if (hit.dist < best.hit.dist) best = { sub, hit };
  }
  return best;
}

/**
 * THE PLACER: a real map point at game scale, stepped back from the nearest race road by the
 * road's extra half width (in full near the road, fading out by STEP_GONE_M), so what stood at the
 * real road's edge stands at the game road's edge, and a trap or a stand keeps its real gap.
 * @param scale game m per real m
 * @param loops every layout's road at game scale
 * @param widenM the game road's extra half width over the real road's at scale, m
 * @returns the point placer
 */
export function makePlacer(scale: number, loops: Subtrack[], widenM: number): (pt: Point) => Point {
  return ([realX, realY]) => {
    const x = realX * scale, y = realY * scale;
    const { sub, hit } = nearestLoop(loops, x, y);
    if (!Number.isFinite(hit.dist) || hit.dist >= STEP_GONE_M) return [x, y];
    const share = hit.dist <= STEP_FULL_M ? 1
      : 1 - (hit.dist - STEP_FULL_M) / (STEP_GONE_M - STEP_FULL_M);
    const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
    const step = widenM * share * side;
    return [x + centre.nx * step, y + centre.ny * step];
  };
}

/**
 * Splits a line into the runs that stay clear, each at most maxM long (short runs keep collision
 * and drawing cheap: a far run is skipped by its box).
 * @param pts the line
 * @param clear true where a point may stand
 * @param stepM resample spacing in metres
 * @param maxM the longest run, m
 * @returns the clear runs (2+ points each)
 */
export function clearRuns(pts: Point[], clear: (x: number, y: number) => boolean, stepM = 2,
  maxM = Infinity): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  const close = () => { if (run.length > 1) runs.push(run); };
  for (const point of resample(pts, stepM)) {
    if (!clear(point[0], point[1])) { close(); run = []; continue; }
    run.push(point);
    if ((run.length - 1) * stepM >= maxM) { close(); run = [point]; }
  }
  close();
  return runs;
}

/**
 * How far a point is from the nearest race road's centreline, however far (the roads' lookup grid
 * only reaches a few cells out: past it, the samples are walked).
 * @param loops every layout's road
 * @param x world x
 * @param y world y
 * @returns metres
 */
export function roadDistance(loops: Subtrack[], x: number, y: number): number {
  const near = nearestLoop(loops, x, y).hit.dist;
  if (Number.isFinite(near)) return near;
  let bestSq = Infinity;
  for (const sub of loops)
    for (let i = 0; i < sub.pts.length; i += 4) {
      const point = sub.pts[i], distSq = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (distSq < bestSq) bestSq = distSq;
    }
  return Math.sqrt(bestSq);
}

/**
 * A line eased by a running mean of its points (its ends kept): it follows its shape without its
 * small jogs (a painted line, a road traced off a map).
 * @param pts the line
 * @param reach points either side in the mean
 * @param passes how many times
 * @returns the eased line
 */
export function smoothLine(pts: Point[], reach = 3, passes = 3): Point[] {
  let line = pts;
  for (let pass = 0; pass < passes; pass++)
    line = line.map((point, i) => {
      if (i < reach || i >= line.length - reach) return point;
      let sumX = 0, sumY = 0;
      for (let near = -reach; near <= reach; near++) {
        sumX += line[i + near][0];
        sumY += line[i + near][1];
      }
      return [sumX / (2 * reach + 1), sumY / (2 * reach + 1)] as Point;
    });
  return line;
}

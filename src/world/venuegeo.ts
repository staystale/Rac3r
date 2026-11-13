// world/venuegeo.ts - the geometry a venue's scenery is built with (world/venue.ts,
// venueedge.ts, venuescenery.ts): lines resampled and measured, the nearest race road, a road's
// centre point by distance, and THE PLACER - a real map point at game scale, stepped back from the
// race road so the game's wider road (13 m against the real one at scale) keeps the real gaps
// between the road and what stands beside it.
import { querySubtrack } from "./tyrewall.ts";
import { FIX } from "../core/fixes.ts";
import type { Point, Subtrack, SubtrackHit, TrackPoint } from "./types.ts";

// m (game): the game's road on every circuit
export const VENUE_ROAD_M = 13;
export const HALF_ROAD = VENUE_ROAD_M / 2;
// m: the kart track's width (the venue tells its lanes from the roads by it)
export const KART_W = 4;
// m (game) from a race road within which the map is stepped back in full, and where the step has
// faded to nothing (so far scenery stays where the map puts it)
const STEP_FULL_M = 40, STEP_GONE_M = 110;
// m between the race roads' centre samples the placer looks across to
const ACROSS_SAMPLE_M = 3;

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
 * Points every stepM along a line, the spacing carried across its corners (resample splits each
 * segment on its own: a 1 m segment at 0.95 gives two points 0.5 m apart - the tyre rows in front
 * of the eased Armco stood twice as close as laid, on one another).
 * @param pts the line
 * @param stepM metres between points
 * @returns the points, the line's first one first
 */
export function evenly(pts: Point[], stepM: number): Point[] {
  const out: Point[] = [pts[0]];
  let next = stepM;
  for (let i = 1; i < pts.length; i++) {
    const [fromX, fromY] = pts[i - 1], [toX, toY] = pts[i];
    const len = Math.hypot(toX - fromX, toY - fromY);
    for (; next <= len; next += stepM)
      out.push([fromX + (toX - fromX) * next / len, fromY + (toY - fromY) * next / len]);
    next -= len;
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

// m: a line whose ends lie this close, at least LOOP_MIN_M long, is a closed loop (no ends)
const LOOP_GAP_M = 3, LOOP_MIN_M = 30;

/**
 * Whether a line is a closed loop (a kart track): its two ends one point.
 * @param pts the points
 * @returns true when closed
 */
export function isClosedLoop(pts: Point[]): boolean {
  const [firstX, firstY] = pts[0], [lastX, lastY] = pts[pts.length - 1];
  return Math.hypot(firstX - lastX, firstY - lastY) < LOOP_GAP_M && lineLength(pts) > LOOP_MIN_M;
}

/**
 * How far a point is from a line's nearest segment.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @returns metres
 */
export function distToLine(pts: Point[], x: number, y: number): number {
  if (pts.length - 1 <= LINE_CHUNK * 2)
    return distToSegments(pts, x, y, 0, pts.length - 1, Infinity);
  const boxes = chunkBoxes(pts);
  // the chunk nearest last time first (the builders ask along a line: the answer is near there)
  let best = distToChunk(pts, x, y, boxes.last, Infinity);
  for (let group = 0; group < boxes.groups; group++) {
    // (a group's box no nearer than the best so far holds no nearer segment: skipped exactly)
    if (isBoxFarther(boxes.groupBox, group, x, y, best)) continue;
    const last = Math.min(boxes.count, (group + 1) * CHUNK_GROUP);
    for (let chunk = group * CHUNK_GROUP; chunk < last; chunk++) {
      if (chunk === boxes.last || isBoxFarther(boxes.box, chunk, x, y, best)) continue;
      const found = distToChunk(pts, x, y, chunk, best);
      if (found < best) {
        best = found;
        boxes.last = chunk;
      }
    }
  }
  return best;
}

/**
 * Whether box `index` of a packed list (minX, minY, maxX, maxY each) is no nearer than best.
 * @param boxes the packed boxes
 * @param index the box
 * @param x world x
 * @param y world y
 * @param best metres
 * @returns true when every point in it is at least best away
 */
function isBoxFarther(boxes: Float64Array, index: number, x: number, y: number,
  best: number): boolean {
  const base = index * 4;
  const outX = Math.max(boxes[base] - x, 0, x - boxes[base + 2]);
  const outY = Math.max(boxes[base + 1] - y, 0, y - boxes[base + 3]);
  const reach = best + BOX_SLACK_M;
  return outX * outX + outY * outY > reach * reach;
}

/**
 * The nearest segment of one chunk of a line.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @param chunk the chunk
 * @param start the best so far
 * @returns metres (start when none is nearer)
 */
const distToChunk = (pts: Point[], x: number, y: number, chunk: number, start: number) =>
  distToSegments(pts, x, y, chunk * LINE_CHUNK, Math.min(pts.length - 1, (chunk + 1) * LINE_CHUNK),
    start);

/**
 * Whether a point is nearer a line than reach (distToLine < reach), the line's box first.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns true when nearer
 */
export const isNearLine = (pts: Point[], x: number, y: number, reach: number): boolean =>
  !isBeyondBox(lineBox(pts), x, y, reach) && distToLine(pts, x, y) < reach;

/**
 * Whether a point is farther from a line than reach (distToLine > reach), the line's box first: a
 * point more than reach outside the box is farther from every segment in it.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns true when farther
 */
export const isFarFromLine = (pts: Point[], x: number, y: number, reach: number): boolean =>
  isBeyondBox(lineBox(pts), x, y, reach) || distToLine(pts, x, y) > reach;

/**
 * Whether a point is nearer a line than reach: the builders' question, asked with the line's box
 * first under ?fastbuild=1 (the same answer: the box only skips lines too far to be nearer).
 * @param pts the line
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns true when nearer
 */
export const isWithinLine = (pts: Point[], x: number, y: number, reach: number): boolean =>
  (FIX.fastbuild ? isNearLine(pts, x, y, reach) : distToLine(pts, x, y) < reach);

/**
 * Whether a point is farther from a line than reach, the line's box first under ?fastbuild=1.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns true when farther
 */
export const isBeyondLine = (pts: Point[], x: number, y: number, reach: number): boolean =>
  (FIX.fastbuild ? isFarFromLine(pts, x, y, reach) : distToLine(pts, x, y) > reach);

/** A line's bounding box. */
export interface LineBox { minX: number; minY: number; maxX: number; maxY: number }
const LINE_BOXES = new WeakMap<Point[], LineBox & { length: number }>();

/**
 * A line's bounding box, cached per line (built again if its length changed): a query far outside
 * it can skip the line's points.
 * @param pts the line
 * @returns its box
 */
export function lineBox(pts: Point[]): LineBox {
  const cached = LINE_BOXES.get(pts);
  if (cached && cached.length === pts.length) return cached;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [pointX, pointY] of pts) {
    minX = Math.min(minX, pointX);
    minY = Math.min(minY, pointY);
    maxX = Math.max(maxX, pointX);
    maxY = Math.max(maxY, pointY);
  }
  const box = { minX, minY, maxX, maxY, length: pts.length };
  LINE_BOXES.set(pts, box);
  return box;
}

/**
 * Whether a point is more than reach outside a box.
 * @param box the box
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns true when that far out
 */
export const isBeyondBox = (box: LineBox, x: number, y: number, reach: number): boolean =>
  x < box.minX - reach || x > box.maxX + reach || y < box.minY - reach || y > box.maxY + reach;

// segments a line's chunk holds (each chunk's bounding box cached: distToLine skips far chunks)
const LINE_CHUNK = 8;
// chunks a group's box covers (a long line's far stretches skipped a group at a time)
const CHUNK_GROUP = 8;
// m a box's distance may round above a segment's in it (float slack: a skip must never be wrong)
const BOX_SLACK_M = 1e-6;
/** A line's chunks' and their groups' boxes (minX, minY, maxX, maxY each), the nearest chunk last
 * time. */
interface ChunkBoxes {
  box: Float64Array; count: number; groupBox: Float64Array; groups: number; last: number;
  length: number;
}
const CHUNK_BOXES = new WeakMap<Point[], ChunkBoxes>();

/**
 * A line's chunk boxes, built on its first query (and again if its length changed). The builders
 * lay a line, then ask about it: a line's points are not moved once it has been asked about.
 * @param pts the line
 * @returns its boxes
 */
function chunkBoxes(pts: Point[]): ChunkBoxes {
  const cached = CHUNK_BOXES.get(pts);
  if (cached && cached.length === pts.length) return cached;
  const count = Math.ceil((pts.length - 1) / LINE_CHUNK), box = new Float64Array(count * 4);
  for (let chunk = 0; chunk < count; chunk++) {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const last = Math.min(pts.length - 1, (chunk + 1) * LINE_CHUNK);
    for (let i = chunk * LINE_CHUNK; i <= last; i++) {
      const [pointX, pointY] = pts[i];
      minX = Math.min(minX, pointX);
      minY = Math.min(minY, pointY);
      maxX = Math.max(maxX, pointX);
      maxY = Math.max(maxY, pointY);
    }
    box.set([minX, minY, maxX, maxY], chunk * 4);
  }
  const groups = Math.ceil(count / CHUNK_GROUP), groupBox = new Float64Array(groups * 4);
  for (let group = 0; group < groups; group++) {
    const base = group * 4;
    groupBox.set([Infinity, Infinity, -Infinity, -Infinity], base);
    for (let chunk = group * CHUNK_GROUP; chunk < Math.min(count, (group + 1) * CHUNK_GROUP);
      chunk++) {
      for (let side = 0; side < 2; side++) {
        groupBox[base + side] = Math.min(groupBox[base + side], box[chunk * 4 + side]);
        groupBox[base + 2 + side] = Math.max(groupBox[base + 2 + side], box[chunk * 4 + 2 + side]);
      }
    }
  }
  const boxes = { box, count, groupBox, groups, last: 0, length: pts.length };
  CHUNK_BOXES.set(pts, boxes);
  return boxes;
}

/**
 * The nearest of a run of a line's segments, from point index `from` to `to`.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @param from the run's first point
 * @param upTo the run's last point
 * @param start the best so far
 * @returns metres (start when none is nearer)
 */
function distToSegments(pts: Point[], x: number, y: number, from: number, upTo: number,
  start: number): number {
  let best = start;
  for (let i = from; i < upTo; i++) {
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
 * A race road's centre at a distance along it, between its samples: the point and its left
 * normal.
 * @param sub the road
 * @param dist metres along it (wrapped round the lap)
 * @returns the point and the normal
 */
export function centreBetween(sub: Subtrack, dist: number):
  { x: number; y: number; nx: number; ny: number } {
  const total = sub.totalDist, want = ((dist % total) + total) % total;
  const pts = sub.pts, low = pts.indexOf(centreAt(sub, want));
  const next = pts[(low + 1) % pts.length], from = pts[low];
  const span = (next.dist > from.dist ? next.dist : next.dist + total) - from.dist;
  const frac = span > 0 ? Math.min(1, (want - from.dist) / span) : 0;
  const nx = from.nx + (next.nx - from.nx) * frac, ny = from.ny + (next.ny - from.ny) * frac;
  const len = Math.hypot(nx, ny) || 1;
  return { x: from.x + (next.x - from.x) * frac, y: from.y + (next.y - from.y) * frac,
    nx: nx / len, ny: ny / len };
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
 * How far ahead along a heading the next race road lies: the nearest centre sample in front,
 * one off to the side counting as further (its distance over the cosine of its angle off the
 * heading, so a road coming into view counts in smoothly).
 * @param samples the race roads' centre samples
 * @param x the point
 * @param y the point
 * @param dirX the heading (unit)
 * @param dirY the heading (unit)
 * @returns metres, Infinity with no road ahead
 */
function roadAhead(samples: Point[], x: number, y: number, dirX: number, dirY: number): number {
  let best = Infinity;
  for (const [sampleX, sampleY] of samples) {
    const offX = sampleX - x, offY = sampleY - y;
    const along = offX * dirX + offY * dirY;
    if (along <= 0) continue;
    best = Math.min(best, (offX * offX + offY * offY) / along);
  }
  return best;
}

/**
 * THE PLACER: a real map point at game scale, stepped back from the nearest race road by the
 * road's extra half width (in full near the road, fading out by STEP_GONE_M), so what stood at the
 * real road's edge stands at the game road's edge, and a trap or a stand keeps its real gap.
 * Between two stretches of road (the infield behind the pits, a hairpin's inside) the ground
 * between is squeezed instead - the step easing to nothing halfway across - so the map never
 * folds where the nearest road changes side (it pushed both ways there: 8 m of map doubled over).
 * @param scale game m per real m
 * @param loops every layout's road at game scale
 * @param widenM the game road's extra half width over the real road's at scale, m
 * @returns the point placer
 */
export function makePlacer(scale: number, loops: Subtrack[], widenM: number): (pt: Point) => Point {
  const samples: Point[] = [];
  for (const sub of loops) {
    let last = -Infinity;
    for (const point of sub.pts)
      if (point.dist - last >= ACROSS_SAMPLE_M) {
        samples.push([point.x, point.y]);
        last = point.dist;
      }
  }
  return ([realX, realY]) => {
    const x = realX * scale, y = realY * scale;
    const { sub, hit } = nearestLoop(loops, x, y);
    if (!Number.isFinite(hit.dist) || hit.dist >= STEP_GONE_M) return [x, y];
    const share = hit.dist <= STEP_FULL_M ? 1
      : 1 - (hit.dist - STEP_FULL_M) / (STEP_GONE_M - STEP_FULL_M);
    const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
    const awayX = centre.nx * side, awayY = centre.ny * side;
    // the share of the way across to the road beyond: the step in full by this road, none halfway
    const across = hit.dist / (hit.dist + roadAhead(samples, x, y, awayX, awayY));
    const step = widenM * Math.min(share, Math.cos(Math.PI * across));
    return [x + awayX * step, y + awayY * step];
  };
}

/**
 * A line with each end carried on to the nearest of some points within reachM of it (a barrier's
 * end joined to the next barrier's).
 * @param pts the line
 * @param targets the points an end may join
 * @param reachM metres
 * @returns the line, its ends joined where one is near
 */
export function joinEnds(pts: Point[], targets: Point[], reachM: number): Point[] {
  const nearest = (end: Point): Point[] => {
    let best: Point | null = null, bestGap = reachM;
    for (const point of targets) {
      const gap = Math.hypot(point[0] - end[0], point[1] - end[1]);
      if (gap > 1e-6 && gap < bestGap) [best, bestGap] = [point, gap];
    }
    return best ? [best] : [];
  };
  return [...nearest(pts[0]), ...pts, ...nearest(pts[pts.length - 1])];
}

/**
 * A line with its ends cut back while a test holds there (a barrier's end off a road).
 * @param pts the line
 * @param cut true where an end point goes
 * @returns what is left of it
 */
export function trimEnds(pts: Point[], cut: (x: number, y: number) => boolean): Point[] {
  let first = 0, last = pts.length;
  while (first < last && cut(...pts[first])) first++;
  while (last > first && cut(...pts[last - 1])) last--;
  return pts.slice(first, last);
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
 * @param toEnds the mean narrowing toward the two end points (only they kept), so a jog by an
 *   end is eased too (a settled road's last metres kept a hook); else the first and last reach
 *   points are kept
 * @returns the eased line
 */
export function smoothLine(pts: Point[], reach = 3, passes = 3, toEnds = false): Point[] {
  let line = pts;
  for (let pass = 0; pass < passes; pass++)
    line = line.map((point, i) => {
      const fromEnd = Math.min(i, line.length - 1 - i);
      if (!toEnds && fromEnd < reach) return point;
      const span = Math.min(reach, fromEnd);
      if (span < 1) return point;
      let sumX = 0, sumY = 0;
      for (let near = -span; near <= span; near++) {
        sumX += line[i + near][0];
        sumY += line[i + near][1];
      }
      return [sumX / (2 * span + 1), sumY / (2 * span + 1)] as Point;
    });
  return line;
}

/**
 * How far the raced road's kerb reaches past its edge at a spot (0 where it has none there).
 * @param sub the raced road
 * @param trackDist metres along it
 * @param side the side of it
 * @returns metres
 */
export function kerbOut(sub: Subtrack, trackDist: number, side: string): number {
  let out = 0;
  for (const kerb of sub.curvedKerbs || []) {
    if (kerb.side !== side) continue;
    const onKerb = (dist: number) => dist >= kerb.startDist && dist <= kerb.endDist;
    if (onKerb(trackDist) || onKerb(trackDist + sub.totalDist)) out = Math.max(out, kerb.width);
  }
  return out;
}

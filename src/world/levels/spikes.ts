// world/levels/spikes.ts - SPIKES PEAK, THE HILL CLIMB (owner 11-22: its own track type, a single
// real road like Pikes Peak - the full true course at half scale, real grades, one run up; the name
// SPIKES PEAK). The road: the real course traced (venues/spikes.ts, tools/spikestrace.mjs), 9.99
// km, 718 m up, 23 hairpins as tight as the real ones (5.1-14.9 m). ROUND 2 (?spikespeak): the road
// and its climb - tarmac, point to point as a rally stage (a run-up, the start line, the finish at
// the summit, a stop zone, the loop closed by one ghost segment: world/subtrack.ts ghostSegment),
// the ground rising with it and the hillside between its legs blended (highway/hillground.ts).
// Next rounds: the dressing (drops, armco at the worst corners, rocks and trees by height, the
// start gantry and the summit), the AI, the menu.
// WHAT IT IS MEANT TO FAIL YOU AT: the tight hairpins on a steep road, the drops at their outside.
import { createSubtrack, ghostSegment } from '../subtrack.ts';
import { onTrack, querySubtrack } from '../tyrewall.ts';
import { SURFACES } from '../surfaces.ts';
import { hillClimbOf, hillRoadsideOf } from '../../highway/hillground.ts';
import { REACH } from '../../highway/gorge.ts';
import { STEP } from '../../highway/presets.ts';
import { SPIKES_ROAD, SPIKES_RISE } from './venues/spikes.ts';
import { SPIKES5_ROAD, SPIKES5_RISE } from './venues/spikes5.ts';
import { spikeStones, spikeRocks } from './spikesdress.ts';
import { FIX } from '../../core/fixes.ts';
import type { Level, Point } from '../types.ts';

// m: the road's width (the twisty road's two 3.5 m lanes and 0.6 m shoulders:
// highway/presets.ts); the run-up to the start line and the stop zone past the summit (the
// generated stages' 60 m: stagegen.ts placeStopZone); the ground's margin round the road
const SPIKES_ROAD_M = 8.2, SPIKES_RUNUP_M = 60, SPIKES_STOP_M = 60, SPIKES_MARGIN_M = 150;
// m the hillside is laid ahead of the furthest road distance the ground is asked about (laying the
// whole 10 km at once is seconds of work: highway/hillground.ts)
const SPIKES_LAY_AHEAD_M = 300;
// m: (?spikedrops) no drop where another part of the road comes this near - the drop reaches
// ~36 m past the edge and eases back up before the lookup's REACH (50 m), so REACH + half the road
// + a margin; the endless road's 120 m (hillground.ts DROP_CLEAR_M) left drops only on the first
// 2.3 km here, every switchback within 120 m of another
const SPIKES_DROP_CLEAR_M = 60;
// m between the points the run-up and the stop zone are laid with (the road's own spacing)
const SPIKES_PT_M = 2;
// (?spikesmooth; owner on round203: the corners looked "hexagonal" - the road's 2 m points, 23 deg
// apart round a 5 m hairpin) a Catmull-Rom point between two of the road's points for each
// SMOOTH_DEG it turns there
const SMOOTH_RAD = 2 * Math.PI / 180;

/**
 * The road as true curves (?spikesmooth): Catmull-Rom points between two of its points, one for
 * each SMOOTH_RAD it turns there, the rise along them in step.
 * @param road the road's points
 * @param rises its rise at each
 * @returns the points and their rises
 */
function smoothRoad(road: Point[], rises: number[]): { road: Point[]; rises: number[] } {
  const last = road.length - 1, out: Point[] = [road[0]], outRise = [rises[0]];
  const head = (start: Point, end: Point) => Math.atan2(end[1] - start[1], end[0] - start[0]);
  const turn = (one: number, two: number) => Math.abs(Math.atan2(Math.sin(two - one),
    Math.cos(two - one)));
  for (let i = 0; i < last; i++) {
    const before = road[Math.max(0, i - 1)], from = road[i], next = road[i + 1],
      after = road[Math.min(last, i + 2)];
    const bend = Math.max(turn(head(before, from), head(from, next)),
      turn(head(from, next), head(next, after)));
    const parts = Math.max(1, Math.ceil(bend / SMOOTH_RAD));
    for (let part = 1; part <= parts; part++) {
      const share = part / parts, square = share * share, cube = square * share;
      const along = (axis: number) => 0.5 * (2 * from[axis] + (next[axis] - before[axis]) * share
        + (2 * before[axis] - 5 * from[axis] + 4 * next[axis] - after[axis]) * square
        + (3 * from[axis] - before[axis] - 3 * next[axis] + after[axis]) * cube);
      out.push([along(0), along(1)]);
      outRise.push(rises[i] + (rises[i + 1] - rises[i]) * share);
    }
  }
  return { road: out, rises: outRise };
}

/**
 * Points straight on from an end of the road, every SPIKES_PT_M.
 * @param from the end point
 * @param toward the point before it (the heading runs from this to `from`)
 * @param lengthM how far, m
 * @returns the points, nearest first
 */
function straightOn(from: Point, toward: Point, lengthM: number): Point[] {
  const heading = Math.atan2(from[1] - toward[1], from[0] - toward[0]), out: Point[] = [];
  for (let along = SPIKES_PT_M; along <= lengthM; along += SPIKES_PT_M)
    out.push([from[0] + Math.cos(heading) * along, from[1] + Math.sin(heading) * along]);
  return out;
}

/**
 * The road's rise at a road distance: the course's own (SPIKES_RISE, along it), the summit's on
 * the stop zone, the start's on the run-up.
 * @param courseDists each course point's road distance, m
 * @param stopEnd the stop zone's end, m
 * @returns m above the start at a road distance
 */
function riseAlong(courseDists: number[], stopEnd: number, rises: number[]):
  (dist: number) => number {
  const last = courseDists.length - 1, courseEnd = courseDists[last];
  return (dist) => {
    if (!(dist > 0) || dist > stopEnd) return 0;
    if (dist >= courseEnd) return rises[last];
    // (the pair either side: a binary search - the points are closer in the curves, ?spikesmooth;
    // a guess by index walked from there cost the drops' looks 5-12 ms a shade chunk)
    let low = 0, high = last - 1;
    while (low < high) {
      const mid = (low + high + 1) >> 1;
      if (courseDists[mid] <= dist) low = mid; else high = mid - 1;
    }
    const i = low;
    const span = courseDists[i + 1] - courseDists[i] || 1, share = (dist - courseDists[i]) / span;
    return rises[i] + (rises[i + 1] - rises[i]) * share;
  };
}

/**
 * The road as the hillside reads it (highway/hillground.ts HillRoad): STEP m apart, the course
 * and the stop zone.
 * @param sub the road
 * @param stopEnd the stop zone's end, m
 * @returns its points
 */
function hillRoadOf(sub: ReturnType<typeof createSubtrack>, stopEnd: number) {
  const pts: { x: number; y: number; s: number }[] = [];
  for (let dist = 0; dist <= stopEnd; dist += STEP) {
    const pose = onTrack(sub, dist, 0, {});
    pts.push({ x: pose.x, y: pose.y, s: dist });
  }
  return { _hw: { pts } };
}

/**
 * Builds SPIKES PEAK (on first use: world/load.ts buildLevel).
 * @returns the level
 */
export function buildSpikes(): Level {
  // (?spikeshort: the ~5 km course - three real stretches joined by sweepers: venues/spikes5.ts)
  const course = FIX.spikeshort ? { road: SPIKES5_ROAD, rises: SPIKES5_RISE }
    : { road: SPIKES_ROAD, rises: SPIKES_RISE };
  const { road, rises } = FIX.spikesmooth ? smoothRoad(course.road, course.rises) : course;
  const count = road.length;
  const stop = straightOn(road[count - 1], road[count - 2], SPIKES_STOP_M);
  // (the run-up ends one point before the start line: the closing segment is the last real one)
  const runUp = straightOn(road[0], road[1], SPIKES_RUNUP_M).reverse();
  const pts = [...road, ...stop, ...runUp], ghostIdx = count + stop.length - 1;
  // (?spikedrops: the road's lookup reaching REACH, as the endless road's - the drop eases back
  // up before it ends; at the 18 m default it stepped back to the hillside there)
  const sub = ghostSegment(createSubtrack(pts, SPIKES_ROAD_M,
    [{ startDist: 0, endDist: 1e9, surface: SURFACES.tarmac }], [], true,
    FIX.spikedrops ? REACH : undefined), ghostIdx);
  const courseDists = sub.pts.slice(0, count).map((point) => point.dist);
  const finish = courseDists[count - 1], stopEnd = sub.pts[ghostIdx].dist;
  const roadX = pts.map((point) => point[0]), roadY = pts.map((point) => point[1]);
  const bounds = { x0: Math.min(...roadX) - SPIKES_MARGIN_M,
    x1: Math.max(...roadX) + SPIKES_MARGIN_M,
    y0: Math.min(...roadY) - SPIKES_MARGIN_M, y1: Math.max(...roadY) + SPIKES_MARGIN_M };
  const line = (dist: number) => {
    const pose = onTrack(sub, dist, 0, {});
    return { kind: 'chequered', x: pose.x, y: pose.y, len: 1.6, wid: SPIKES_ROAD_M,
      rot: pose.rot };
  };
  const spawn = onTrack(sub, sub.totalDist - 6, 0, {});
  // (the run-up's road distances run on past the ghost to the loop's end: read as before the
  // start - its rise none, and the hillside not laid out to them)
  const hillRoad = hillRoadOf(sub, stopEnd);
  const hill = hillClimbOf(hillRoad, riseAlong(courseDists, stopEnd, rises), SPIKES_LAY_AHEAD_M);
  // (?spikedrops: the kept drop code - past the verge on a bend's outside the ground falls away
  // DROP_M, where no other part of the road comes near: highway/hillground.ts)
  const drop = FIX.spikedrops ? hillRoadsideOf(hillRoad, SPIKES_DROP_CLEAR_M) : null;
  // (?spikemarks: the two-way road's centre line, as the highway's twisty road: render/road.ts)
  if (FIX.spikemarks) sub.laneDash = [0];
  const props = FIX.spikestones ? spikeStones(sub, stopEnd) : [];
  const rise = riseAlong(courseDists, stopEnd, rises);
  // (the drops' looks: the nearest road's height and how far past its edge - render/droplooks.ts)
  const roadRiseAt = (x: number, y: number) => {
    const hit = querySubtrack(sub, x, y);
    if (!Number.isFinite(hit.dist)) return null;
    const dist = hit.trackDist > stopEnd ? hit.trackDist - sub.totalDist : hit.trackDist;
    return { rise: rise(dist), outM: hit.dist - SPIKES_ROAD_M / 2 };
  };
  return {
    id: 'spikes-peak', name: 'Spikes Peak',
    base: SURFACES.gravel,                    // the mountain's broken rock
    subtrack: sub, bounds,
    floor: Math.ceil(Math.max(-bounds.x0, bounds.x1, -bounds.y0, bounds.y1)),
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    climb: (dist: number, x: number, y: number, outM: number) => hill(dist > stopEnd
      ? dist - sub.totalDist : dist, x, y, outM),
    zones: [], bumps: [], covers: [], paint: [line(0), line(finish)], boards: [], seams: false,
    cones: FIX.spikerocks ? spikeRocks(sub, finish) : [], props, barriers: [], solids: [],
    lanes: [],
    stage: { finish }, roadRiseAt,
    ...(drop ? { roadside: (dist: number, offset: number, halfWidth: number) => drop(dist
      > stopEnd ? dist - sub.totalDist : dist, offset, halfWidth) } : {}),
    spawn: { x: spawn.x, y: spawn.y, heading: spawn.rot },
  } as Level;
}

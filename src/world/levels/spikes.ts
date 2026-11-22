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
import { onTrack } from '../tyrewall.ts';
import { SURFACES } from '../surfaces.ts';
import { hillClimbOf } from '../../highway/hillground.ts';
import { STEP } from '../../highway/presets.ts';
import { SPIKES_ROAD, SPIKES_RISE } from './venues/spikes.ts';
import type { Level, Point } from '../types.ts';

// m: the road's width (the twisty road's two 3.5 m lanes and 0.6 m shoulders:
// highway/presets.ts); the run-up to the start line and the stop zone past the summit (the
// generated stages' 60 m: stagegen.ts placeStopZone); the ground's margin round the road
const SPIKES_ROAD_M = 8.2, SPIKES_RUNUP_M = 60, SPIKES_STOP_M = 60, SPIKES_MARGIN_M = 150;
// m the hillside is laid ahead of the furthest road distance the ground is asked about (laying the
// whole 10 km at once is seconds of work: highway/hillground.ts)
const SPIKES_LAY_AHEAD_M = 300;
// m between the points the run-up and the stop zone are laid with (the road's own spacing)
const SPIKES_PT_M = 2;

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
function riseAlong(courseDists: number[], stopEnd: number): (dist: number) => number {
  const last = courseDists.length - 1, courseEnd = courseDists[last];
  return (dist) => {
    if (!(dist > 0) || dist > stopEnd) return 0;
    if (dist >= courseEnd) return SPIKES_RISE[last];
    // (the points are SPIKES_PT_M apart along the road: the nearest two by index, then exact)
    let i = Math.min(last - 1, Math.floor(dist / SPIKES_PT_M));
    while (i > 0 && courseDists[i] > dist) i--;
    while (i < last - 1 && courseDists[i + 1] < dist) i++;
    const span = courseDists[i + 1] - courseDists[i] || 1, share = (dist - courseDists[i]) / span;
    return SPIKES_RISE[i] + (SPIKES_RISE[i + 1] - SPIKES_RISE[i]) * share;
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
  const road = SPIKES_ROAD, count = road.length;
  const stop = straightOn(road[count - 1], road[count - 2], SPIKES_STOP_M);
  // (the run-up ends one point before the start line: the closing segment is the last real one)
  const runUp = straightOn(road[0], road[1], SPIKES_RUNUP_M).reverse();
  const pts = [...road, ...stop, ...runUp], ghostIdx = count + stop.length - 1;
  const sub = ghostSegment(createSubtrack(pts, SPIKES_ROAD_M,
    [{ startDist: 0, endDist: 1e9, surface: SURFACES.tarmac }], [], true), ghostIdx);
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
  const hill = hillClimbOf(hillRoadOf(sub, stopEnd), riseAlong(courseDists, stopEnd),
    SPIKES_LAY_AHEAD_M);
  return {
    id: 'spikes-peak', name: 'Spikes Peak',
    base: SURFACES.gravel,                    // the mountain's broken rock
    subtrack: sub, bounds,
    floor: Math.ceil(Math.max(-bounds.x0, bounds.x1, -bounds.y0, bounds.y1)),
    camber: { maxDeg: 0, refR: 60, crown: 0.03, edge: 5, sections: [] },
    climb: (dist: number, x: number, y: number, outM: number) => hill(dist > stopEnd
      ? dist - sub.totalDist : dist, x, y, outM),
    zones: [], bumps: [], covers: [], paint: [line(0), line(finish)], boards: [], seams: false,
    cones: [], props: [], barriers: [], solids: [], lanes: [],
    stage: { finish },
    spawn: { x: spawn.x, y: spawn.y, heading: spawn.rot },
  } as Level;
}

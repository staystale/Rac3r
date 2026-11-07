// ai/roadLine.ts - THE HIGHWAY AS A LINE (the AI rework R8 stage 3, one AI, passed; owner 11-04:
// "we just worked into circuit ai loads... try that on the highway... if there's issues like no
// racing line etc then maybe put that as a middle line"; "it should all work on highway providing
// the ai know which way to drive"). The highway road is built as you go - ~300 m at a time laid
// ahead and dropped behind (highway.ts stepHighway: a new subtrack each time) - so its line is made
// again for each new subtrack: the MIDDLE of the lanes (not the hard shoulder), a point every
// LINE_SP m, its corners found as a circuit's are. The circuit driver drives it like any racing
// line; the traffic is cars to go round (driverTraffic.ts), so it races through, not queueing.
import { finishPath, findCorners } from './line.ts';
import type { LinePoint, RacingLine } from './types.ts';
import type { HighwayLevel } from './types.ts';

// m between the line's points
const LINE_SP = 2;
// m of the lane block either side of its middle the line may use (the driver keeps WANDER_EDGE,
// 1.1 m, inside this): the car's centre reaches the outer lanes' outer edge less a half car
const LANE_ROOM_M = 0.2;
// rounds of neighbour smoothing (owner: "ai should move smoothly between any jolts or joints in the
// line"): the road's 4 m points joined straight kink the heading at each one
const SMOOTH = 6;

const LINES = new WeakMap<object, RacingLine>();

/**
 * The highway's line for the road as it stands (one per subtrack, made when the road grows).
 * @param level the highway level
 * @returns the line
 */
export function roadLine(level: HighwayLevel): RacingLine {
  const sub = (level as unknown as { subtrack: object }).subtrack;
  const known = LINES.get(sub);
  if (known) return known;
  const road = level._hw.pts, geo = level._hw.geo;
  const mid = (geo.centres[0] + geo.centres[geo.centres.length - 1]) / 2;
  const laneHalf = (geo.centres[geo.centres.length - 1] - geo.centres[0]) / 2
    + (geo.centres.length > 1 ? (geo.centres[1] - geo.centres[0]) / 2 : 1.8);
  const pts: LinePoint[] = [];
  const sFirst = road[0].s, sLast = road[road.length - 1].s, step = (road[1].s - road[0].s) || 4;
  for (let dist = sFirst; dist <= sLast - step; dist += LINE_SP) {
    const fracIdx = (dist - sFirst) / step, i = Math.min(road.length - 2, Math.floor(fracIdx));
    const blend = fracIdx - i, prev = road[i], next = road[i + 1];
    const head = Math.atan2(next.y - prev.y, next.x - prev.x);
    const nx = -Math.sin(head), ny = Math.cos(head);
    pts.push({ x: prev.x + (next.x - prev.x) * blend + nx * mid,
      y: prev.y + (next.y - prev.y) * blend + ny * mid,
      // (off 0: the line IS the middle the driver keeps its room either side of)
      h: head, R: 1e4, turn: 0, mu: 1, nx, ny, dist: dist - sFirst, off: 0 } as LinePoint);
  }
  // the joints smoothed out (the ends held: they meet the line made before and after)
  for (let round = 0; round < SMOOTH; round++) {
    for (let i = 1; i < pts.length - 1; i++) {
      pts[i].x = 0.5 * pts[i].x + 0.25 * (pts[i - 1].x + pts[i + 1].x);
      pts[i].y = 0.5 * pts[i].y + 0.25 * (pts[i - 1].y + pts[i + 1].y);
    }
  }
  const path = finishPath(pts, false, (pts.length - 1) * LINE_SP);
  const { cid, corners } = findCorners(path.pts, path.n);
  // its LANES (passed 11-07) - a driver keeps the one it is in (driverLane.ts laneStep)
  const lanes = geo.centres.map((centre: number) => centre - mid);
  const line = Object.assign(path, { hw: laneHalf + LANE_ROOM_M, lat: [], mu: [], best: [], cid,
    corners, lanes }) as RacingLine;
  LINES.set(sub, line);
  return line;
}

// world/venuejoin.ts - A VENUE BRIDGE'S APPROACHES joined to the roads it carries, as a road would
// be built (owner 11-07: "it should be clean smooth transition ... plenty of room to sort the roads
// out"): straight off the end of the ramp, then a curve into the road along its own heading - the
// smoothest of every join within reach - at the road's width, the road's dead end past the joint
// trimmed, the drawn ramp (render/props/venueprops.ts, appL) shortened when the road is near.
import { lineLength } from "./venuegeo.ts";
import type { Lane, Point, Prop } from "./types.ts";

// m beyond a deck's end a road is looked for to join its approach to
const JOIN_REACH_M = 40;
// m: a bridge's abutment past the deck's end, its ramp's full and shortest length (the drawing,
// render/props/venueprops.ts, takes each end's from appL); a curve's pull (share of its chord); a
// dead end within TRIM_M of a joint is trimmed; degrees of turn a metre of a longer join costs
const ABUT_M = 1.6, RAMP_FULL_M = 9, RAMP_MIN_M = 3, CURVE_PULL = 0.45, TRIM_M = 30;
const JOIN_LENGTH_COST = 0.15;
// m of the straight run off a bridge with no road to meet
const APPROACH_M = 8;

/** The road an approach meets: the lane, the point's index on it, the point. */
interface Meet { road: Lane; index: number; spot: Point }

/** The join an approach makes: where it meets the road, its ramp's length and its curve. */
interface Join { meet: Meet; ramp: number; curve: Point[]; score: number }

/**
 * The sharpest turn along a line, degrees between one segment and the next.
 * @param pts the line
 * @returns degrees
 */
function sharpestTurn(pts: Point[]): number {
  let worst = 0;
  for (let i = 2; i < pts.length; i++) {
    const first = Math.atan2(pts[i - 1][1] - pts[i - 2][1], pts[i - 1][0] - pts[i - 2][0]);
    const second = Math.atan2(pts[i][1] - pts[i - 1][1], pts[i][0] - pts[i - 1][0]);
    const bend = Math.abs(((second - first + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    worst = Math.max(worst, bend * 180 / Math.PI);
  }
  return worst;
}

/**
 * The smoothest join for an approach: every road point within JOIN_REACH_M ahead of the deck's
 * end is tried - the ramp as long as the drawing's (shorter when the road is near), then a curve
 * from its foot into the road along the road's heading - and the one with the gentlest sharpest
 * turn wins (a longer way round costs a little).
 * @param roads the service roads
 * @param deckEnd the deck's end
 * @param dir the way off the bridge (unit)
 * @returns the join, or null with no road there
 */
function smoothestJoin(roads: Lane[], deckEnd: Point, dir: Point): Join | null {
  let best: Join | null = null;
  for (const road of roads)
    road.pts.forEach((spot, index) => {
      const ahead = (spot[0] - deckEnd[0]) * dir[0] + (spot[1] - deckEnd[1]) * dir[1];
      const gap = Math.hypot(spot[0] - deckEnd[0], spot[1] - deckEnd[1]);
      if (ahead < RAMP_MIN_M + 4 || gap > JOIN_REACH_M) return;
      const ramp = Math.min(RAMP_FULL_M, ahead - 4), foot = ABUT_M + ramp;
      const start: Point = [deckEnd[0] + dir[0] * foot, deckEnd[1] + dir[1] * foot];
      const meet = { road, index, spot };
      const curve = easeCurve(start, dir, spot, onwardHeading(meet, start));
      const score = sharpestTurn([deckEnd, start, ...curve]) + gap * JOIN_LENGTH_COST;
      if (!best || score < best.score) best = { meet, ramp, curve: [start, ...curve], score };
    });
  return best;
}

/**
 * A cubic curve from a point along a heading to another point along a heading, as points every
 * ~2 m (the first left out).
 * @param from the start
 * @param fromDir the heading leaving it (unit)
 * @param dest the end
 * @param destDir the heading arriving (unit)
 * @returns the points
 */
function easeCurve(from: Point, fromDir: Point, dest: Point, destDir: Point): Point[] {
  const reach = Math.hypot(dest[0] - from[0], dest[1] - from[1]) * CURVE_PULL;
  const pull1: Point = [from[0] + fromDir[0] * reach, from[1] + fromDir[1] * reach];
  const pull2: Point = [dest[0] - destDir[0] * reach, dest[1] - destDir[1] * reach];
  const count = Math.max(2, Math.ceil(Math.hypot(dest[0] - from[0], dest[1] - from[1]) / 2));
  const pts: Point[] = [];
  for (let step = 1; step <= count; step++) {
    const frac = step / count, rest = 1 - frac;
    const weights = [rest ** 3, 3 * rest * rest * frac, 3 * rest * frac * frac, frac ** 3];
    pts.push([
      weights[0] * from[0] + weights[1] * pull1[0] + weights[2] * pull2[0] + weights[3] * dest[0],
      weights[0] * from[1] + weights[1] * pull1[1] + weights[2] * pull2[1] + weights[3] * dest[1]]);
  }
  return pts;
}

/**
 * The road's heading spot a point of it, the way that leads on away from a spot.
 * @param meet the meeting
 * @param from the spot (the ramp's end)
 * @returns the unit heading
 */
function onwardHeading(meet: Meet, from: Point): Point {
  const pts = meet.road.pts, before = pts[Math.max(0, meet.index - 1)];
  const after = pts[Math.min(pts.length - 1, meet.index + 1)];
  const len = Math.hypot(after[0] - before[0], after[1] - before[1]) || 1;
  const heading: Point = [(after[0] - before[0]) / len, (after[1] - before[1]) / len];
  const away = (meet.spot[0] - from[0]) * heading[0] + (meet.spot[1] - from[1]) * heading[1];
  return away >= 0 ? heading : [-heading[0], -heading[1]];
}

/**
 * Trims a road's dead end past the joint: when the joint is within TRIM_M of one of the road's
 * ends and that end lies back toward the bridge, the road starts spot the joint instead.
 * @param meet the meeting (its road is changed)
 * @param from the ramp's end
 */
function trimDeadEnd(meet: Meet, from: Point): void {
  const pts = meet.road.pts;
  const toStart = lineLengthOf(pts.slice(0, meet.index + 1));
  const toEnd = lineLengthOf(pts.slice(meet.index));
  const nearer = (point: Point) => Math.hypot(point[0] - from[0], point[1] - from[1])
    < Math.hypot(meet.spot[0] - from[0], meet.spot[1] - from[1]);
  if (toStart < TRIM_M && nearer(pts[0])) meet.road.pts = pts.slice(meet.index);
  else if (toEnd < TRIM_M && nearer(pts[pts.length - 1]))
    meet.road.pts = pts.slice(0, meet.index + 1);
}

const lineLengthOf = (pts: Point[]) => (pts.length > 1 ? lineLength(pts) : 0);

/**
 * Each road bridge's approaches joined to its roads, as a road would be built: straight off the
 * end of the ramp, then a smooth curve into the road it carries, arriving along that road's own
 * heading, spot that road's width; the road's dead end past the joint trimmed. Left as a short
 * straight run when no road is there.
 * @param bridges the bridges (props and their approach lanes, two a road bridge, in order)
 * @param roads the service roads (a dead end may be trimmed)
 */
export function joinApproaches(bridges: { props: Prop[]; lanes: Lane[] }, roads: Lane[]): void {
  let lane = 0;
  for (const bridge of bridges.props.filter((prop) => prop.kind === 'bridge')) {
    const ramps: [number, number] = [RAMP_FULL_M, RAMP_FULL_M];
    for (const side of [-1, 1]) {
      const approach = bridges.lanes[lane++];
      const dir: Point = [Math.cos(bridge.rot!) * side, Math.sin(bridge.rot!) * side];
      const deckEnd = approach.pts[0], join = smoothestJoin(roads, deckEnd, dir);
      if (!join) {
        const far = ABUT_M + RAMP_FULL_M + APPROACH_M;
        approach.pts = [deckEnd, [deckEnd[0] + dir[0] * far, deckEnd[1] + dir[1] * far]];
        continue;
      }
      trimDeadEnd(join.meet, join.curve[0]);
      approach.width = join.meet.road.width;
      approach.pts = [deckEnd, ...join.curve];
      ramps[side < 0 ? 0 : 1] = join.ramp;
    }
    // the drawing's ramp spot each end ends where the curve begins (render/props/venueprops.ts)
    bridge.appL = ramps;
  }
}


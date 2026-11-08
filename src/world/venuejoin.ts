// world/venuejoin.ts - A VENUE BRIDGE'S APPROACHES joined to the roads it carries, as a road would
// be built (owner 11-07: "it should be clean smooth transition ... plenty of room to sort the roads
// out"): straight off the end of the ramp, then a curve into the road along its own heading - the
// smoothest of every join within reach - at the road's width, the road's dead end past the joint
// trimmed, the drawn ramp (render/props/venueprops.ts, appL) shortened when the road is near.
import { isClosedLoop, lineLength } from "./venuegeo.ts";
import type { Lane, Point, Prop } from "./types.ts";

// m beyond a deck's end a road is looked for to join its approach to
const JOIN_REACH_M = 40;
// m: a bridge's abutment past the deck's end, its ramp's full and shortest length (the drawing,
// render/props/venueprops.ts, takes each end's from appL); a curve's pull (share of its chord); a
// dead end within TRIM_M of a joint is trimmed; degrees of turn a metre of a longer join costs
const ABUT_M = 1.6, RAMP_FULL_M = 9, RAMP_MIN_M = 3, CURVE_PULL = 0.45, TRIM_M = 30;
// m: a ramp between full and shortest tried; degrees of turn each metre a ramp is cut short costs
const RAMP_MID_M = 6, RAMP_SHORT_COST = 1;
const JOIN_LENGTH_COST = 0.15;
// m a driveway runs on past where the blocked test first trips (half a road and a metre out)
const DRIVEWAY_IN_M = 2;
// degrees of turn a join gains by carrying on a road from its end; a merge alongside costs
const END_BONUS = -12, MERGE_COST = 10;
// m ahead of a fixed start (a tunnel's mouth) a road's end may be met
const END_NEAR_M = 0.5;
// m back along a road ending at a tunnel's mouth it may be cut to run on into the tunnel
const CONTINUE_M = 45;
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
 * @param blocked true where a building stands
 * @returns the join, or null with no road there
 */
function smoothestJoin(roads: Lane[], deckEnd: Point, dir: Point,
  blocked: (x: number, y: number) => boolean): Join | null {
  let best: Join | null = null;
  for (const road of roads)
    road.pts.forEach((spot, index) => {
      const ahead = (spot[0] - deckEnd[0]) * dir[0] + (spot[1] - deckEnd[1]) * dir[1];
      const gap = Math.hypot(spot[0] - deckEnd[0], spot[1] - deckEnd[1]);
      // a road's end may be met close in (the road runs on to the bridge); elsewhere room to bend
      const isEnd = index === 0 || index === road.pts.length - 1;
      if (ahead < (isEnd ? RAMP_MIN_M + 0.5 : RAMP_MIN_M + 4) || gap > JOIN_REACH_M) return;
      // the ramp as long as the road ahead leaves room for, or shorter when that gives the curve
      // after it room to turn (a shorter ramp costs a little)
      const longest = Math.max(RAMP_MIN_M, Math.min(RAMP_FULL_M, ahead - 4));
      for (const ramp of new Set([longest, Math.min(longest, RAMP_MID_M), RAMP_MIN_M])) {
        const foot = ABUT_M + ramp;
        const start: Point = [deckEnd[0] + dir[0] * foot, deckEnd[1] + dir[1] * foot];
        const meet = { road, index, spot };
        for (const [arrive, cost] of arrivals(meet, start)) {
          const curve = easeCurve(start, dir, spot, arrive);
          // the ramp's foot and the whole curve clear of buildings
          if ([start, ...curve].some(([x, y]) => blocked(x, y))) continue;
          const score = sharpestTurn([deckEnd, start, ...curve]) + gap * JOIN_LENGTH_COST
            + (longest - ramp) * RAMP_SHORT_COST;
          const total = score + cost;
          if (!best || total < best.score)
            best = { meet, ramp, curve: [start, ...curve], score: total };
        }
      }
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
 * The ways a join may arrive at a road point, each with its cost: at the road's end, carrying on
 * into it (the road is continued: preferred); into a through road square to it (a T-junction);
 * or along it (a merge: only when nothing better fits). Where the road's stub past the point
 * will be trimmed (trimDeadEnd) the point is its end: only carrying on along what is left (a T
 * there became a corner once the stub went).
 * @param meet the meeting
 * @param from where the join's curve starts
 * @returns [heading, cost] pairs
 */
function arrivals(meet: Meet, from: Point): [Point, number][] {
  const along = onwardHeading(meet, from), pts = meet.road.pts, last = pts.length - 1;
  if (meet.index === 0 || meet.index === last) return [[along, END_BONUS]];
  const stub = stubTrimmed(meet, from);
  if (stub) {
    const next = pts[stub === 'start' ? meet.index + 1 : meet.index - 1];
    const len = Math.hypot(next[0] - meet.spot[0], next[1] - meet.spot[1]) || 1;
    return [[[(next[0] - meet.spot[0]) / len, (next[1] - meet.spot[1]) / len], END_BONUS]];
  }
  const square: Point = [-along[1], along[0]];
  const toward = (meet.spot[0] - from[0]) * square[0] + (meet.spot[1] - from[1]) * square[1];
  return [[toward >= 0 ? square : [-square[0], -square[1]], 0], [along, MERGE_COST]];
}

/**
 * Which of a road's ends past a joint is a dead end to trim: one within TRIM_M of the joint that
 * lies back toward the bridge. A closed loop has none: its end runs on as its start.
 * @param meet the meeting
 * @param from the ramp's end
 * @returns the end, or null with none
 */
function stubTrimmed(meet: Meet, from: Point): 'start' | 'end' | null {
  const pts = meet.road.pts;
  if (isClosedLoop(pts)) return null;
  const toStart = lineLengthOf(pts.slice(0, meet.index + 1));
  const toEnd = lineLengthOf(pts.slice(meet.index));
  const nearer = (point: Point) => Math.hypot(point[0] - from[0], point[1] - from[1])
    < Math.hypot(meet.spot[0] - from[0], meet.spot[1] - from[1]);
  if (toStart < TRIM_M && nearer(pts[0])) return 'start';
  if (toEnd < TRIM_M && nearer(pts[pts.length - 1])) return 'end';
  return null;
}

/**
 * Trims a road's dead end past the joint (stubTrimmed): the road starts or ends at the joint.
 * @param meet the meeting (its road is changed)
 * @param from the ramp's end
 */
function trimDeadEnd(meet: Meet, from: Point): void {
  const stub = stubTrimmed(meet, from), pts = meet.road.pts;
  if (stub === 'start') meet.road.pts = pts.slice(meet.index);
  else if (stub === 'end') meet.road.pts = pts.slice(0, meet.index + 1);
}

const lineLengthOf = (pts: Point[]) => (pts.length > 1 ? lineLength(pts) : 0);

/**
 * Each road bridge's approaches joined to its roads, as a road would be built: straight off the
 * end of the ramp, then a smooth curve into the road it carries, arriving along that road's own
 * heading, spot that road's width; the road's dead end past the joint trimmed. Left as a short
 * straight run when no road is there.
 * @param bridges the bridges (props and their approach lanes, two a road bridge, in order)
 * @param roads the service roads (a dead end may be trimmed)
 * @param blocked true where a building stands (an approach goes round)
 */
/**
 * Where a road straight off a bridge ends with no road to meet: just short of the first building
 * ahead within JOIN_REACH_M (its driveway), or APPROACH_M past the ramp's foot.
 * @param deckEnd the deck's end
 * @param dir the way off the bridge (unit)
 * @param blocked true where a building stands (with the road's half width round it)
 * @returns the end point
 */
function straightOn(deckEnd: Point, dir: Point, blocked: (x: number, y: number) => boolean): Point {
  const plain = ABUT_M + RAMP_FULL_M + APPROACH_M;
  for (let ahead = ABUT_M + RAMP_MIN_M; ahead <= JOIN_REACH_M; ahead += 1)
    if (blocked(deckEnd[0] + dir[0] * ahead, deckEnd[1] + dir[1] * ahead)) {
      // blocked reads the road's half width and a metre round the building: run on to its face
      const stop = Math.max(ABUT_M + RAMP_MIN_M, ahead + DRIVEWAY_IN_M);
      return [deckEnd[0] + dir[0] * stop, deckEnd[1] + dir[1] * stop];
    }
  return [deckEnd[0] + dir[0] * plain, deckEnd[1] + dir[1] * plain];
}

export function joinApproaches(bridges: { props: Prop[]; lanes: Lane[] }, roads: Lane[],
  blocked: (x: number, y: number) => boolean): void {
  let lane = 0;
  for (const bridge of bridges.props.filter((prop) => prop.kind === 'bridge')) {
    const ramps: [number, number] = [RAMP_FULL_M, RAMP_FULL_M];
    for (const side of [-1, 1]) {
      const approach = bridges.lanes[lane++];
      const dir: Point = [Math.cos(bridge.rot!) * side, Math.sin(bridge.rot!) * side];
      const deckEnd = approach.pts[0], join = smoothestJoin(roads, deckEnd, dir, blocked);
      if (!join) {
        // no road to meet: straight on - to a building's frontage when one lies ahead (its
        // driveway), else a short run
        approach.pts = [deckEnd, straightOn(deckEnd, dir, blocked)];
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


/**
 * A road from a fixed start (a tunnel portal's open end) along a heading, joined to the road
 * network the same way a bridge's approach is: a straight run, then the smoothest curve into a
 * road within reach, the road's dead end trimmed.
 * @param roads the service roads (a dead end may be trimmed)
 * @param from where the road starts
 * @param dir the heading it leaves along (unit)
 * @param blocked true where a building stands
 * @param reach metres a road is looked for
 * @returns the road's points, or null with no road within reach
 */
export function joinFrom(roads: Lane[], from: Point, dir: Point,
  blocked: (x: number, y: number) => boolean, reach = JOIN_REACH_M): Point[] | null {
  // smoothestJoin starts its curve a ramp's length out: measured back from there it starts here
  const back = ABUT_M + RAMP_MIN_M;
  const virtualEnd: Point = [from[0] - dir[0] * back, from[1] - dir[1] * back];
  const join = smoothestJoinFrom(roads, virtualEnd, dir, blocked, back, reach);
  if (!join) return null;
  trimDeadEnd(join.meet, join.curve[0]);
  // the curve starts at from itself: not twice (a doubled point read as a turn back)
  return [from, ...join.curve.filter((point) =>
    Math.hypot(point[0] - from[0], point[1] - from[1]) > 0.5)];
}

/**
 * smoothestJoin with the ramp fixed at its shortest (a straight start of a set length).
 * @param roads the service roads
 * @param deckEnd where the start is measured from
 * @param dir the heading (unit)
 * @param blocked true where a building stands
 * @param foot metres from deckEnd the curve starts
 * @param reach metres a road is looked for
 * @returns the join, or null with no road there
 */
function smoothestJoinFrom(roads: Lane[], deckEnd: Point, dir: Point,
  blocked: (x: number, y: number) => boolean, foot: number, reach: number): Join | null {
  let best: Join | null = null;
  const start: Point = [deckEnd[0] + dir[0] * foot, deckEnd[1] + dir[1] * foot];
  for (const road of roads)
    road.pts.forEach((spot, index) => {
      const ahead = (spot[0] - start[0]) * dir[0] + (spot[1] - start[1]) * dir[1];
      const gap = Math.hypot(spot[0] - start[0], spot[1] - start[1]);
      // a road's end may be met close in (the road runs on into the mouth); elsewhere room to bend
      const isEnd = index === 0 || index === road.pts.length - 1;
      if (ahead < (isEnd ? END_NEAR_M : 4) || gap > reach) return;
      const meet = { road, index, spot };
      for (const [arrive, cost] of arrivals(meet, start)) {
      const curve = easeCurve(start, dir, spot, arrive);
      if (curve.some(([x, y]) => blocked(x, y))) continue;
      const score = sharpestTurn([deckEnd, start, ...curve]) + gap * JOIN_LENGTH_COST;
      const total = score + cost;
      if (!best || total < best.score)
        best = { meet, ramp: 0, curve: [start, ...curve], score: total };
      }
    });
  return best;
}

/**
 * A tunnel's road carried on from the road that ends at its mouth (owner 11-07: roads "don't go
 * anywhere"; a tunnel's road looped round into that road further back): that road is cut back
 * to the point where the smoothest curve from the mouth runs on into it - along it, away from the
 * cut end - and the stub past the cut goes.
 * @param roads the service roads (the one carried on is cut)
 * @param from the mouth (the tunnel road's start)
 * @param dir the heading out of the mouth (unit)
 * @param blocked true where a building stands
 * @param reach metres from the mouth an end of the road may lie
 * @returns the tunnel road's points from the mouth, or null with no road ending near
 */
export function continueRoad(roads: Lane[], from: Point, dir: Point,
  blocked: (x: number, y: number) => boolean, reach: number): Point[] | null {
  let best: Cut | null = null;
  for (const road of roads)
    for (const fromStart of [true, false]) {
      const end = fromStart ? road.pts[0] : road.pts[road.pts.length - 1];
      if (Math.hypot(end[0] - from[0], end[1] - from[1]) > reach) continue;
      const cut = bestCut(road, fromStart, from, dir, blocked);
      if (cut && (!best || cut.score < best.score)) best = cut;
    }
  if (!best) return null;
  const { road, index, fromStart, curve } = best;
  // the road from the cut on, its first point the joint (the curve ends there)
  road.pts = fromStart ? road.pts.slice(index) : road.pts.slice(0, index + 1);
  return [from, ...curve.filter((point) =>
    Math.hypot(point[0] - from[0], point[1] - from[1]) > 0.5)];
}

/** Where a road is cut to run on from a tunnel's mouth: the road, the index, which end goes. */
interface Cut { road: Lane; index: number; fromStart: boolean; curve: Point[]; score: number }

/**
 * The smoothest cut of a road within CONTINUE_M of one of its ends for a curve from a tunnel's
 * mouth to run on into it, along it away from that end.
 * @param road the road
 * @param fromStart its first end goes, else its last
 * @param from the mouth
 * @param dir the heading out of the mouth (unit)
 * @param blocked true where a building stands
 * @returns the cut, or null with no clear curve
 */
function bestCut(road: Lane, fromStart: boolean, from: Point, dir: Point,
  blocked: (x: number, y: number) => boolean): Cut | null {
  const pts = road.pts, last = pts.length - 1;
  let best: Cut | null = null;
  for (let step = 0; step <= last - 1; step++) {
    const index = fromStart ? step : last - step, spot = pts[index];
    const stub = fromStart ? pts.slice(0, index + 1) : pts.slice(index);
    if (lineLengthOf(stub) > CONTINUE_M) break;
    const ahead = (spot[0] - from[0]) * dir[0] + (spot[1] - from[1]) * dir[1];
    if (ahead < END_NEAR_M) continue;
    const next = pts[fromStart ? index + 1 : index - 1];
    const len = Math.hypot(next[0] - spot[0], next[1] - spot[1]) || 1;
    const curve = easeCurve(from, dir, spot,
      [(next[0] - spot[0]) / len, (next[1] - spot[1]) / len]);
    if (curve.some(([x, y]) => blocked(x, y))) continue;
    const gap = Math.hypot(spot[0] - from[0], spot[1] - from[1]);
    const score = sharpestTurn([[from[0] - dir[0], from[1] - dir[1]], from, ...curve, next])
      + gap * JOIN_LENGTH_COST;
    if (!best || score < best.score) best = { road, index, fromStart, curve, score };
  }
  return best;
}

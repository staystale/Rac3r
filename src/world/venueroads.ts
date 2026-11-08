// world/venueroads.ts - A VENUE'S ROADS: the mapped service roads, rally stages and kart track as
// lanes outside the edge (a road beside the track steps out to clear it), each piece joined up;
// then (owner 11-07: "ugly / badly or unconnected roads") every end must meet something - another
// lane, a paddock, a building, the track - or run off the map; a dangling spur is trimmed back to
// its last junction, a road joining nothing goes.
import { SURFACES } from "./surfaces.ts";
import { KART_W, centreAt, clearRuns, distToLine, isClosedLoop, lineLength, nearestLoop,
  resample, roadDistance, smoothLine } from "./venuegeo.ts";
import { inZones, pastRim } from "./venueedge.ts";
import { joinFrom } from "./venuejoin.ts";
import { REACH_M, inSolid, nearArmco, nearRace, onLanes, placeAll, stepOut }
  from "./venuesite.ts";
import type { Site } from "./venuesite.ts";
import type { VenueScenery } from "./venuescenery.ts";
import type { Lane, Point, Zone } from "./types.ts";

// m: a service road keeps this far outside the edge; a piece of one shorter than MIN_ROAD_M once
// cut is left out (a stub)
const ROAD_OUT_M = 2, MIN_ROAD_M = 30;
// m inside the edge beyond which a road is not stepped out (it crosses the run-off: cut there)
const ROAD_STEP_LIMIT_M = 3;
// m a stepped-out road keeps from the Armco beyond its half width (past nearArmco's reach: its
// 2 m cells read up to two cells out)
const ROAD_ARMCO_GAP_M = 4.5;
// m: a road piece going nowhere is kept only this long; an end within JOIN_M of a lane meets it
const LONE_ROAD_M = 90, JOIN_M = 3;
// m: a road end within this of another lane (beyond both half widths) meets it; a road end this
// near
// the venue's reach was cut by it (the road goes on into the world)
const JOIN_GAP_M = 3, LEAVE_MARGIN_M = 8;
// a road beside another within PARALLEL_M, the same way (within PARALLEL_DEG), for more than
// DUPLICATE_M doubles it
const PARALLEL_M = 9, PARALLEL_DEG = 35, DUPLICATE_M = 16;
// m: the kart track keeps this far off every road beyond both half widths; it moves out from the
// race track KART_STEP_M at a time, at most KART_SHIFT_M, to clear them
const KART_GAP_M = 1.5, KART_STEP_M = 1, KART_SHIFT_M = 15;
// m from a building's wall a road's edge may stop and still reach it (tools/venueaudit.mjs: same)
const BUILDING_REACH_M = 2;
// points (2 m apart) back from a road end where the lane it already met is looked for
const STUB_PTS = 12, STUB_FROM = 3;
// m past both road edges that still counts as touching; m a short end is carried on to meet one
const TOUCH_M = 0.5, CARRY_M = 30;
// m from a bridge's ramp foot or a tunnel's mouth a road end meets it (the join runs on to it)
export const FOOT_REACH_M = 22;
// a carried-on end's last points (at its joint) that may lie beside the road it meets
const CARRY_JOINT_PTS = 6;
// m from a hand finish's point a road passes to be cut or dropped there; m between a drawn road's
// end and a road's end that makes them one road
const FINISH_REACH_M = 3, FINISH_JOIN_M = 3;

/**
 * The service roads, rally stages and kart track as lanes, all outside the edge (real widths);
 * each piece left after the cut must be at least MIN_ROAD_M long.
 * @param site the venue's builders' state
 * @returns the lanes
 */
export function venueRoads(site: Site): Lane[] {
  const data = site.build.spec.data, lanes: Lane[] = [];
  // a line at game scale laid as a lane where clear
  const lay = (pts: Point[], width: number, surface: Lane['surface']) => {
    const clear = (x: number, y: number) => pastRim(site.rims, x, y) > ROAD_OUT_M + width / 2
      && nearRace(site, x, y, REACH_M) && !onLanes(site.lanes, x, y, width / 2)
      && !inSolid(site, x, y, width / 2 + 1) && !nearArmco(site, x, y, width / 2 + 1);
    // a road beside the track but too close to the edge (the game road is wider) steps out to
    // clear it, as a building does; one that cuts across the run-off is cut there
    const placed = smoothLine(resample(pts, 2).map((point) =>
      stepOut(site, point, ROAD_OUT_M + width / 2 + ROAD_ARMCO_GAP_M, ROAD_STEP_LIMIT_M)), 3, 4);
    for (const run of clearRuns(placed, clear))
      if (lineLength(run) >= MIN_ROAD_M) lanes.push({ pts: run, width, surface });
  };
  const add = (pts: Point[], width: number, surface: Lane['surface']) =>
    lay(placeAll(site, pts), width, surface);
  // the venue's own roads: the village streets next door (residential) are not its
  for (const road of data.roads)
    if (!road.bridge && road.kind !== 'residential')
      add(road.pts, road.width, road.kind === 'track' ? SURFACES.dirt : SURFACES.tarmac);
  for (const stage of data.dirt) add(stage.pts, 5, SURFACES.dirt);
  // the kart track: karts' width (its mapped tyre lines stand at its edges)
  for (const kart of data.karting)
    lay(kartClear(site, placeAll(site, kart.pts), lanes), KART_W, SURFACES.tarmac);
  return joinedUp(site, lanes);
}

/**
 * A kart track kept off the roads: the whole of it moved straight out from the race track (a road
 * stepped out from the track's edge can run over it - Castle Combe's ring road beside its kart
 * track), KART_STEP_M at a time up to KART_SHIFT_M; left where it is when it never clears.
 * @param site the venue's builders' state
 * @param pts the kart track at game scale
 * @param roads the roads laid
 * @returns the kart track
 */
function kartClear(site: Site, pts: Point[], roads: Lane[]): Point[] {
  const midX = pts.reduce((sum, [x]) => sum + x, 0) / pts.length;
  const midY = pts.reduce((sum, [, y]) => sum + y, 0) / pts.length;
  const { sub, hit } = nearestLoop(site.loops, midX, midY);
  const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
  for (let shift = 0; shift <= KART_SHIFT_M; shift += KART_STEP_M) {
    const moved = pts.map(([x, y]): Point =>
      [x + centre.nx * side * shift, y + centre.ny * side * shift]);
    if (moved.every(([x, y]) => !onLanes(roads, x, y, KART_W / 2 + KART_GAP_M))) return moved;
  }
  return pts;
}

/**
 * The road pieces that read as roads: each long (LONE_ROAD_M), or with an end meeting another
 * lane (the pit lane, a road kept, a bridge's approach, a tunnel's road) or a building. A piece
 * the cut left alone, going nowhere, is left out (asked again until nothing more goes).
 * @param site the venue's builders' state
 * @param lanes the road pieces
 * @returns the ones kept
 */
function joinedUp(site: Site, lanes: Lane[]): Lane[] {
  let kept = lanes;
  for (let pass = 0; pass < 4; pass++) {
    const others = [...site.lanes, ...kept];
    const meets = (run: Lane) => [run.pts[0], run.pts[run.pts.length - 1]].some(([x, y]) =>
      others.some((other) => other !== run
        && distToLine(other.pts, x, y) < (other.width + run.width) / 2 + JOIN_M)
      || inSolid(site, x, y, run.width / 2 + JOIN_M));
    const next = kept.filter((run) => lineLength(run.pts) >= LONE_ROAD_M || meets(run));
    if (next.length === kept.length) break;
    kept = next;
  }
  return kept;
}

/** Where a road end may stop: another lane, a paddock, a building, the track, or the map's edge. */
export interface RoadEnds {
  zones: Zone[]; bounds: VenueScenery['bounds'];
  feet: Point[];   // where the bridges' and tunnels' roads begin (joined to the roads after)
}

/**
 * Whether a road's end meets something: another lane, a zone (a paddock, a car park), a
 * building, the race track (the pit lane's ends) or its own other end (a loop).
 * @param site the venue's builders' state
 * @param road the road
 * @param end the end point
 * @param ends the zones
 * @returns true when it meets something
 */
function endMeets(site: Site, road: Lane, end: Point, ends: RoadEnds): boolean {
  const [x, y] = end, [firstX, firstY] = road.pts[0];
  const [lastX, lastY] = road.pts[road.pts.length - 1];
  // the lane the road already meets anywhere in its last stretch before this end is a junction,
  // not where it ends: a stub carried on past a T meets nothing
  const count = road.pts.length, atStart = end === road.pts[0];
  const before = (step: number) => road.pts[atStart ? Math.min(count - 1, step)
    : Math.max(0, count - 1 - step)];
  const reach = (other: Lane, point: Point) =>
    distToLine(other.pts, point[0], point[1]) < (other.width + road.width) / 2 + TOUCH_M;
  const metBefore = (other: Lane) => {
    for (let step = STUB_FROM; step <= STUB_PTS; step++)
      if (reach(other, before(step))) return true;
    return false;
  };
  return site.lanes.some((other) => other !== road && reach(other, end) && !metBefore(other))
    || inZones(ends.zones, x, y)
    || ends.feet.some(([footX, footY]) => Math.hypot(footX - x, footY - y) < FOOT_REACH_M)
    || inSolid(site, x, y, BUILDING_REACH_M + road.width / 2)
    || nearRace(site, x, y, road.width) || Math.hypot(firstX - lastX, firstY - lastY) < JOIN_GAP_M;
}

/**
 * A road end the venue's reach cut (it goes on into the world) carried straight on to the map's
 * edge.
 * @param site the venue's builders' state
 * @param road the road (changed)
 * @param atStart its first end, else its last
 * @param bounds the map's edge
 * @returns true when it was carried on
 */
function carryOff(site: Site, road: Lane, atStart: boolean,
  bounds: VenueScenery['bounds']): boolean {
  const pts = road.pts, tip = atStart ? pts[0] : pts[pts.length - 1];
  const prev = atStart ? pts[Math.min(1, pts.length - 1)] : pts[Math.max(0, pts.length - 2)];
  if (roadDistance(site.loops, tip[0], tip[1]) < REACH_M - LEAVE_MARGIN_M) return false;
  const len = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
  const dirX = (tip[0] - prev[0]) / len, dirY = (tip[1] - prev[1]) / len;
  // how far on along each axis to the edge it heads for
  const toEdge = (dir: number, from: number, low: number, high: number) =>
    (dir > 0 ? (high - from) / dir : dir < 0 ? (low - from) / dir : Infinity);
  const reach = [toEdge(dirX, tip[0], bounds.x0, bounds.x1),
    toEdge(dirY, tip[1], bounds.y0, bounds.y1)];
  const out = Math.min(...reach) + 2;
  if (!Number.isFinite(out) || out < 0) return false;
  const edge: Point = [tip[0] + dirX * out, tip[1] + dirY * out];
  // never across the race track or its run-off on the way (a road cut by the reach on the far side
  // of the oval ran straight over it to the map's edge)
  for (let along = 2; along < out; along += 2) {
    const x = tip[0] + dirX * along, y = tip[1] + dirY * along;
    if (pastRim(site.rims, x, y) < ROAD_OUT_M + road.width / 2) return false;
  }
  road.pts = atStart ? [edge, ...pts] : [...pts, edge];
  return true;
}

/**
 * A road end that stops short of another road carried on into it: straight on along the road,
 * then the smoothest curve into a road within reach (world/venuejoin.ts joinFrom) - a road that
 * could join does.
 * @param site the venue's builders' state
 * @param road the road (changed)
 * @param atStart its first end, else its last
 * @param roads the service roads it may be carried into
 * @returns true when it was joined
 */
function carryInto(site: Site, road: Lane, atStart: boolean, roads: Lane[]): boolean {
  const pts = road.pts, tip = atStart ? pts[0] : pts[pts.length - 1];
  const prev = atStart ? pts[Math.min(2, pts.length - 1)] : pts[Math.max(0, pts.length - 3)];
  const len = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
  const dir: Point = [(tip[0] - prev[0]) / len, (tip[1] - prev[1]) / len];
  // only into the other service roads (the bridges' and tunnels' roads are joined after)
  const others = roads.filter((lane) => lane !== road);
  const joined = joinFrom(others, tip, dir,
    (x, y) => inSolid(site, x, y, 1 + road.width / 2)
      || nearArmco(site, x, y, road.width / 2 + 0.5) || nearRace(site, x, y, road.width), CARRY_M);
  if (!joined) return false;
  // never alongside another road on its way (two roads to the same place): its last few points,
  // at the joint, may be
  const added = joined.slice(1, -CARRY_JOINT_PTS);
  const beside = added.filter(([x, y]) => others.some((lane) =>
    distToLine(lane.pts, x, y) < (lane.width + road.width) / 2 + PARALLEL_M)).length;
  if (beside * 2 > DUPLICATE_M / 2) return false;
  road.pts = atStart ? [...joined.slice(1).reverse(), ...pts] : [...pts, ...joined.slice(1)];
  return true;
}

/**
 * The index along a road nearest one end where another lane meets it (a junction), or -1.
 * @param site the venue's builders' state
 * @param road the road
 * @param fromStart look from its first end, else its last
 * @returns the index
 */
function firstJunction(site: Site, road: Lane, fromStart: boolean): number {
  const count = road.pts.length;
  for (let step = 1; step < count; step++) {
    const i = fromStart ? step : count - 1 - step, [x, y] = road.pts[i];
    if (site.lanes.some((other) => other !== road
      && distToLine(other.pts, x, y) < (other.width + road.width) / 2 + 1)) return i;
  }
  return -1;
}

/**
 * Roads that go somewhere (owner 11-07: "ugly / badly or unconnected roads"): each end that
 * meets nothing is carried on to the map's edge if the venue's reach cut it, else trimmed back to
 * the road's last junction; a road with no junction left goes. Asked again until nothing changes.
 * @param site the venue's builders' state (its lanes lose the roads dropped)
 * @param roads the roads (changed)
 * @param ends where an end may stop
 * @returns the roads kept
 */
export function tidyRoads(site: Site, roads: Lane[], ends: RoadEnds): Lane[] {
  let kept = roads;
  for (let pass = 0; pass < 6; pass++) {
    let changed = false;
    kept = kept.filter((road) => {
      for (const atStart of [true, false]) {
        const tip = atStart ? road.pts[0] : road.pts[road.pts.length - 1];
        if (endMeets(site, road, tip, ends) || carryOff(site, road, atStart, ends.bounds)
          || carryInto(site, road, atStart, kept)) continue;
        const cut = firstJunction(site, road, atStart);
        changed = true;
        if (cut < 0) return false;
        road.pts = atStart ? road.pts.slice(cut) : road.pts.slice(0, cut + 1);
        if (road.pts.length < 2) return false;
      }
      return true;
    });
    // a bypass: both ends on the same other road (a fork back to where it left) does its job twice
    const before = kept.length;
    kept = kept.filter((road) => !isBypass(site, road));
    if (kept.length !== before) changed = true;
    const gone = new Set(roads.filter((road) => !kept.includes(road)));
    site.lanes = site.lanes.filter((lane) => !gone.has(lane));
    if (!changed) break;
  }
  return kept;
}

/**
 * Whether a road is a bypass: both its ends join the same other lane (a fork that comes back to
 * the road it left - two roads to the same place). A closed loop is not one (a kart track whose
 * start is by a road: both its ends are the one point).
 * @param site the venue's builders' state
 * @param road the road
 * @returns true when it is
 */
function isBypass(site: Site, road: Lane): boolean {
  if (isClosedLoop(road.pts)) return false;
  const joined = (end: Point) => site.lanes.filter((other) => other !== road
    && distToLine(other.pts, end[0], end[1]) < (other.width + road.width) / 2 + JOIN_GAP_M);
  const first = joined(road.pts[0]), last = joined(road.pts[road.pts.length - 1]);
  return first.some((lane) => last.includes(lane));
}

/**
 * The local heading of a line at a point of it.
 * @param pts the line
 * @param i the point
 * @returns radians
 */
function headingAt(pts: Point[], i: number): number {
  const before = pts[Math.max(0, i - 1)], after = pts[Math.min(pts.length - 1, i + 1)];
  return Math.atan2(after[1] - before[1], after[0] - before[0]);
}

/**
 * Whether a point of a road runs beside another line the same way (within PARALLEL_M, headings
 * within PARALLEL_DEG either way round).
 * @param road the road
 * @param i its point
 * @param other the other line's points
 * @returns true when it doubles it
 */
function doubles(road: Lane, i: number, other: Point[]): boolean {
  const [x, y] = road.pts[i];
  let best = Infinity, nearest = 0;
  other.forEach(([pointX, pointY], index) => {
    const gap = Math.hypot(pointX - x, pointY - y);
    if (gap < best) { best = gap; nearest = index; }
  });
  if (best > PARALLEL_M) return false;
  const turn = Math.abs(headingAt(road.pts, i) - headingAt(other, nearest)) % Math.PI;
  return Math.min(turn, Math.PI - turn) < PARALLEL_DEG * Math.PI / 180;
}

/**
 * Roads with no road doubled (owner 11-07: "two nearly go to the same place"): longest first, a
 * road running beside one already kept (or a bridge's / tunnel's road) for more than DUPLICATE_M
 * is cut there; the pieces left are tidied after (tidyRoads joins or drops them). The kart track
 * and the roads are told apart: a kart track beside a road is two things, not one mapped twice
 * (Castle Combe's runs beside the ring road).
 * @param site the venue's builders' state (its lanes follow the roads)
 * @param roads the roads
 * @param fixed the bridges' and tunnels' roads (kept as they are)
 * @returns the roads, cut
 */
export function withoutDuplicates(site: Site, roads: Lane[], fixed: Lane[]): Lane[] {
  const kept: Lane[] = [];
  const order = roads.slice()
    .sort((first, second) => lineLength(second.pts) - lineLength(first.pts));
  const isKart = (lane: Lane) => lane.width === KART_W;
  for (const road of order) {
    const others = [...fixed, ...kept].filter((lane) => isKart(lane) === isKart(road))
      .map((lane) => resample(lane.pts, 2));
    const dup = road.pts.map((point, i) => others.some((other) => doubles(road, i, other)));
    // a doubled stretch longer than DUPLICATE_M goes whole (from where it starts to where it ends)
    const drop = dup.slice();
    for (let i = 0; i < dup.length; i++) {
      if (!dup[i] || (i > 0 && dup[i - 1])) continue;
      let stop = i;
      while (stop < dup.length && dup[stop]) stop++;
      if ((stop - i) * 2 <= DUPLICATE_M) for (let keep = i; keep < stop; keep++) drop[keep] = false;
    }
    let run: Point[] = [];
    const pieces: Point[][] = [];
    road.pts.forEach((point, i) => {
      if (drop[i]) { if (run.length > 1) pieces.push(run); run = []; return; }
      run.push(point);
    });
    if (run.length > 1) pieces.push(run);
    for (const pts of pieces) if (lineLength(pts) >= MIN_ROAD_M) kept.push({ ...road, pts });
  }
  site.lanes = site.lanes.filter((lane) => !roads.includes(lane)).concat(kept);
  return kept;
}

/**
 * The venue's hand finish (spec.finish): generated roads cut short or dropped where the mapped
 * roads cannot be joined cleanly by rule, and roads drawn by hand laid in - one whose end lies on
 * a road's end carries that road on (one road, its joint eased). A finish point that meets no
 * road is reported (the generated roads moved under it).
 * @param site the venue's builders' state (its lanes follow)
 * @param roads the settled service roads
 * @returns the roads finished
 */
export function handFinish(site: Site, roads: Lane[]): Lane[] {
  const finish = site.build.spec.finish;
  if (!finish) return roads;
  const near = (road: Lane, [x, y]: Point) => distToLine(road.pts, x, y) < FINISH_REACH_M;
  const miss = (what: string, [x, y]: Point) =>
    console.warn(`venue ${site.build.spec.id}: finish ${what} at ${x},${y} meets no road`);
  let kept = roads.filter((road) => !(finish.drop || []).some((spot) => near(road, spot)));
  for (const spot of finish.drop || [])
    if (!roads.some((road) => near(road, spot))) miss('drop', spot);
  for (const { at, keep } of finish.cut || []) {
    const road = kept.find((lane) => near(lane, at));
    if (road) cutRoad(road, at, keep);
    else miss('cut', at);
  }
  for (const drawn of finish.roads || []) kept = laidIn(kept, drawn);
  site.lanes = site.lanes.filter((lane) => !roads.includes(lane)).concat(kept);
  return kept;
}

/**
 * A road cut at its own point nearest a spot (a point off its line would bend its end), the
 * side toward keep kept.
 * @param road the road (changed)
 * @param spot where it is cut
 * @param keep a point by the side kept
 */
function cutRoad(road: Lane, spot: Point, keep: Point): void {
  let index = 0, best = Infinity;
  road.pts.forEach(([x, y], i) => {
    const gap = Math.hypot(x - spot[0], y - spot[1]);
    if (gap < best) [best, index] = [gap, i];
  });
  const head = road.pts.slice(0, index + 1), tail = road.pts.slice(index);
  const from = (part: Point[]) => (part.length > 1 ? distToLine(part, keep[0], keep[1]) : Infinity);
  road.pts = from(head) < from(tail) ? head : tail;
}

/**
 * A road drawn by hand laid in among the roads: an end on (within FINISH_JOIN_M of) a road's end
 * carries that road on - one road, the joint eased.
 * @param roads the roads
 * @param drawn the drawn road
 * @returns the roads with it
 */
function laidIn(roads: Lane[], drawn: { pts: Point[]; width?: number }): Lane[] {
  let pts = resample(drawn.pts, 2), surface = SURFACES.tarmac, kept = roads;
  for (const atStart of [true, false]) {
    const end = atStart ? pts[0] : pts[pts.length - 1];
    const touches = (point: Point) =>
      Math.hypot(point[0] - end[0], point[1] - end[1]) < FINISH_JOIN_M;
    const road = kept.find((lane) =>
      touches(lane.pts[0]) || touches(lane.pts[lane.pts.length - 1]));
    if (!road) continue;
    // that road turned to run up to the end, then on along the drawn one (or the other way)
    const into = touches(road.pts[road.pts.length - 1]) ? road.pts : road.pts.slice().reverse();
    pts = atStart ? [...into, ...pts.slice(1)] : [...pts, ...into.slice().reverse().slice(1)];
    surface = road.surface;
    kept = kept.filter((lane) => lane !== road);
  }
  return [...kept, { pts: smoothLine(pts, 3, 3, true), width: drawn.width || 5, surface }];
}

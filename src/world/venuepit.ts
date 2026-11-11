// world/venuepit.ts - A VENUE'S PIT LANE (world/venuescenery.ts builds the rest): the mapped
// lane at game scale, held clear of the pit wall and eased in at its two ends, the wall parallel
// to the road, and the painted lines - the fast / working lane divider and the solid entry and
// exit lines along the track's edge.
import { alongTrack } from "./barriers.ts";
import { SURFACES } from "./surfaces.ts";
import { querySubtrack } from "./tyrewall.ts";
import { HALF_ROAD, centreAt, centreBetween, distToLine, nearestLoop, resample, smoothLine }
  from "./venuegeo.ts";
import { RUNOFF_M } from "./venueedge.ts";
import { inBuilding, placeAll } from "./venuesite.ts";
import { insidePolygon } from "./zones.ts";
import type { Site } from "./venuesite.ts";
import type { Barrier, Lane, Paint, Point, Prop, Subtrack } from "./types.ts";

// m: the pit lane's width, the wall's gap from it, where it may meet the track (its ends) and the
// wall's distance past the road's edge
export const PIT_W = 9, EDGE_TO_WALL = 3;
const PIT_WALL_GAP = 0.6, PIT_MERGE_M = 30;
// m along the road either side of a spot the lane's nearest point is read over (pitWall)
const LANE_READ_M = 3;
// m the pit wall's ends keep off a road beside them
const WALL_ROAD_M = 1;
// m either side of a point the road's bend is measured over, and the share of the bend's radius
// a point inside it may stand off before the road's measure folds there
const BEND_SPAN_M = 4, FOLD_SHARE = 0.8;
// a cut pit lane's joints eased: points either side in the mean, passes
const CUT_EASE_REACH = 5, CUT_EASE_PASSES = 3;
// (owner 11-09 on Sillystone: "a lot of crashes"; passed 11-09): where the road beside it bends
// tighter than PIT_BEND_R (read over BEND_READ_M either side) the pit wall stands back at the
// Armco's run-off, RUNOFF_M past the edge, eased in and out over BEND_EASE_M along the road (and
// the lane with it). MEASURED (tools/scratch/_startcrash.mjs, 20-car starts): two thirds of
// Sillystone's barrier hits, and most of Oulton Pork's, were on the wall inside the first corner,
// 3 m past the edge, where the field runs over the kerb.
const PIT_BEND_R = 150, BEND_READ_M = 10, BEND_EASE_M = 20;
// m: the garages' front stands at least this far behind the pit lane's edge
const GARAGE_GAP_M = 1.5;
// the pit lane's easing beside the track: points either side in the mean, rounds of easing
const PIT_EASE_REACH = 6, PIT_EASE_ROUNDS = 4;

/**
 * The pit lane at game scale, kept clear of the wall (the game's road is wider than the real
 * one), and the pit wall: parallel to the road, EDGE_TO_WALL past its edge, along the stretch the
 * lane runs beside it.
 * @param site the venue's builders' state
 * @param name the data's pit lane
 * @returns the lane and the wall
 */
export function pitLane(site: Site, name: string): { lane: Lane; wall: Barrier | null } {
  const spec = site.build.spec;
  const data = spec.data.pitLanes.find((entry) => entry.name === name);
  if (!data) throw new Error(`venue ${spec.id}: no pit lane ${name}`);
  const dense = resample(placeAll(site, data.pts), 2);
  const need = HALF_ROAD + EDGE_TO_WALL + PIT_WALL_GAP + PIT_W / 2;
  const held = spec.pitHeld?.[name];
  // m from a merging end (a held end does not merge: VenueSpec.pitHeld)
  const fromMerge = (i: number) => (held === 'start' ? dense.length - 1 - i
    : held === 'end' ? i : Math.min(i, dense.length - 1 - i));
  let beside = besideSpots(site, dense, fromMerge);
  // the lane in the track's own measure - distance along it, offset beside it - held out to its
  // clearance and eased there, then laid back beside the track (held out point by point along
  // the track's normals it bunched and jogged on a bend's inside)
  const sub = nearestLoop(site.loops, ...dense[Math.floor(dense.length / 2)]).sub;
  // (a stretch beyond the road's lookup, or clear of it inside a corner tighter than its offset -
  // a pit entry road cutting inside Club, where the road's measure folds - is laid as mapped)
  const lost = dense.map(([x, y]) => {
    const hit = querySubtrack(sub, x, y);
    return !!spec.pitCuts && (!Number.isFinite(hit.dist)
      || (hit.dist > need && folds(sub, hit.trackDist, x, y)));
  });
  // (a cut lane's wall stands along its longest stretch beside the road only, not round the cut)
  if (lost.some(Boolean)) {
    const [from, until] = longestRun(lost);
    beside = beside.filter((spot) => spot.at >= from && spot.at < until);
  }
  const eased = easedLane(sub, dense, lost,
    (along) => HALF_ROAD + wallGap(sub, along) + PIT_WALL_GAP + PIT_W / 2, fromMerge);
  // (where a stretch was laid as mapped, the joints eased: spec.pitCuts)
  const lanePts = spec.pitCuts ? smoothLine(eased, CUT_EASE_REACH, CUT_EASE_PASSES) : eased;
  return { lane: { pts: lanePts, width: PIT_W, surface: SURFACES[spec.pitSurface || 'concrete'] },
    wall: beside.length > 8 ? pitWall(site, beside, lanePts, held) : null };
}

/** A pit lane point beside a race road: the road, the distance along it, the side, its index. */
interface Beside { sub: Subtrack; dist: number; side: number; at: number }

/**
 * The points of a pit lane beside a race road (its merges at the two ends left out).
 * @param site the venue's builders' state
 * @param dense the lane, resampled
 * @param fromMerge points from the nearer end that merges into the road
 * @returns the spots beside the road
 */
function besideSpots(site: Site, dense: Point[], fromMerge: (i: number) => number): Beside[] {
  const beside: Beside[] = [];
  dense.forEach(([x, y], i) => {
    if (fromMerge(i) * 2 < PIT_MERGE_M) return;
    const { sub, hit } = nearestLoop(site.loops, x, y);
    // (a stretch of lane beyond the road's lookup has no side: the tri-oval's chord)
    if (!Number.isFinite(hit.dist)) return;
    beside.push({ sub, dist: hit.trackDist, side: hit.side === 'left' ? 1 : -1, at: i });
  });
  return beside;
}

/**
 * The pit lane in the road's measure, held out to its clearance and eased there, laid back beside
 * the road - each run of points the lookup found on its own (a lost stretch laid as mapped).
 * @param sub the road
 * @param dense the lane, resampled
 * @param lost true for each point laid as mapped
 * @param need m the lane's centre keeps from the road's at a distance along it
 * @param fromMerge points from the nearer end that merges into the road
 * @returns the lane's points
 */
function easedLane(sub: Subtrack, dense: Point[], lost: boolean[],
  need: (along: number) => number, fromMerge: (i: number) => number): Point[] {
  const total = sub.totalDist, measured: Point[] = [];
  let sideSum = 0;
  for (const [i, [x, y]] of dense.entries()) {
    if (lost[i]) {
      measured.push([NaN, NaN]);
      continue;
    }
    const hit = querySubtrack(sub, x, y), side = hit.side === 'left' ? 1 : -1;
    let along = hit.trackDist;
    // one measure through the lap's start (no jump of a lap)
    const known = measured.filter(([dist]) => Number.isFinite(dist));
    const prev = known.length ? known[known.length - 1][0] : along;
    while (along - prev > total / 2) along -= total;
    while (prev - along > total / 2) along += total;
    measured.push([along, side * hit.dist]);
    sideSum += side;
  }
  const out = Math.sign(sideSum || 1);
  // the clearance the lane needs: in full along the wall, easing to nothing over each merge (a
  // jump in it was a kink where the merge ended), eased in and out (a straight ramp left a corner
  // where it topped out)
  const clearance = (i: number, along: number) => {
    const frac = Math.min(1, fromMerge(i) * 2 / PIT_MERGE_M);
    return need(along) * frac * frac * (3 - 2 * frac);
  };
  const eased: Point[] = dense.slice();
  for (let from = 0; from < dense.length;) {
    if (lost[from]) { from++; continue; }
    let until = from;
    while (until < dense.length && !lost[until]) until++;
    // eased and held to the clearance in turn (easing alone pulled it in where the ramp tops out)
    const hold = (pts: Point[]) => pts.map(([along, off], i): Point =>
      [along, out * Math.max(out * off, clearance(from + i, along))]);
    let measuredEased = hold(measured.slice(from, until));
    for (let round = 0; round < PIT_EASE_ROUNDS; round++)
      measuredEased = hold(smoothLine(measuredEased, PIT_EASE_REACH, 1, true));
    measuredEased.forEach(([along, off], i) => {
      const centre = centreBetween(sub, along);
      eased[from + i] = [centre.x + centre.nx * off, centre.y + centre.ny * off];
    });
    from = until;
  }
  return eased;
}

/**
 * How far past the road's edge the pit wall stands at a distance along it: EDGE_TO_WALL, eased
 * back to RUNOFF_M by a bend.
 * @param sub the road
 * @param dist metres along it
 * @returns metres past the edge
 */
export function wallGap(sub: Subtrack, dist: number): number {
  let share = 0;
  for (let near = -BEND_EASE_M; near <= BEND_EASE_M; near += 2)
    if (bendRadius(sub, dist + near) < PIT_BEND_R)
      share = Math.max(share, 1 - Math.abs(near) / BEND_EASE_M);
  return EDGE_TO_WALL + (RUNOFF_M - EDGE_TO_WALL) * share * share * (3 - 2 * share);
}

/**
 * The road's bend radius at a distance along it, read over BEND_READ_M either side.
 * @param sub the road
 * @param dist metres along it
 * @returns metres (Infinity on a straight)
 */
function bendRadius(sub: Subtrack, dist: number): number {
  const before = centreAt(sub, dist - BEND_READ_M), after = centreAt(sub, dist + BEND_READ_M);
  const turn = Math.abs(Math.atan2(before.dirX * after.dirY - before.dirY * after.dirX,
    before.dirX * after.dirX + before.dirY * after.dirY));
  return turn > 1e-3 ? 2 * BEND_READ_M / turn : Infinity;
}

/**
 * The pit wall: parallel to the road, EDGE_TO_WALL past its edge (wallGap: further by a bend),
 * along the stretch the lane runs beside it - its ends off any road beside them (a closed race
 * piece meets the straight by the lane's end) and off the lane itself (a long merge runs in under
 * the wall's end) - but at a held end (VenueSpec.pitHeld: the lane runs on away from the road, no
 * merge under it) it runs on to the lane's end.
 * @param site the venue's builders' state
 * @param beside the lane's spots beside the road
 * @param lanePts the lane
 * @param held the lane's end that does not merge, if one
 * @returns the wall
 */
function pitWall(site: Site, beside: Beside[], lanePts: Point[], held?: 'start' | 'end'): Barrier {
  const sides = beside.reduce((sum, spot) => sum + spot.side, 0), trim = 6;
  const out = Math.sign(sides || 1), road = beside[0].sub;
  const from = beside[0].dist + (held === 'start' ? 0 : trim);
  const until = beside[beside.length - 1].dist - (held === 'end' ? 0 : trim);
  const pts = alongTrack(road, from, until,
    (along) => out * (HALF_ROAD + wallGap(road, from + along)), 2);
  const onRoad = ([x, y]: Point) => site.lanes.some((lane) =>
    distToLine(lane.pts, x, y) < lane.width / 2 + WALL_ROAD_M)
    || distToLine(lanePts, x, y) < PIT_W / 2;
  let first = 0, last = pts.length - 1;
  while (last - first > 1 && onRoad(pts[first])) first++;
  while (last - first > 1 && onRoad(pts[last])) last--;
  // what is left kept PIT_WALL_GAP short of the lane, in toward the road if need be (never nearer
  // than EDGE_TO_WALL past its edge): the lane's clearance and the wall read wallGap at different
  // spots, and a bend near PIT_BEND_R flickers it (MEASURED, barriercheck: Thruston's wall stood in
  // the pit lane by the line, Dieatona's on the tri-oval's)
  const laneOff = laneOffsets(road, lanePts);
  const kept = alongTrack(road, from, until, (along) => out * Math.max(HALF_ROAD + EDGE_TO_WALL,
    Math.min(HALF_ROAD + wallGap(road, from + along),
      laneOff(from + along) - PIT_W / 2 - PIT_WALL_GAP)), 2);
  return { kind: 'pitwall', pts: unfold(kept.slice(first, last + 1)) };
}

/**
 * A line with its fold-backs left out: a point whose step turns back on the one before it (more
 * than a right angle - a wall offset inside a corner tighter than its offset: Bathworst's pit wall
 * round the inside of Murray's Corner and Hell Corner) dropped, until no step does.
 * @param pts the line
 * @returns the line unfolded
 */
function unfold(pts: Point[]): Point[] {
  const out = pts.slice();
  for (let idx = 2; idx < out.length;) {
    const [backX, backY] = out[idx - 2], [midX, midY] = out[idx - 1], [nextX, nextY] = out[idx];
    if ((midX - backX) * (nextX - midX) + (midY - backY) * (nextY - midY) < 0) {
      out.splice(idx - 1, 1);
      idx = Math.max(2, idx - 1);
    } else idx++;
  }
  return out;
}

/**
 * The lane's centre off the road by distance along it: the nearest of its points within
 * LANE_READ_M (along the lap, through its start).
 * @param road the road
 * @param lanePts the lane
 * @returns m from the road's centre at a distance along it (Infinity where it does not run)
 */
function laneOffsets(road: Subtrack, lanePts: Point[]): (dist: number) => number {
  const total = road.totalDist, spots = lanePts.map(([x, y]) => querySubtrack(road, x, y))
    .filter((hit) => Number.isFinite(hit.dist));
  return (dist: number) => {
    let least = Infinity;
    for (const hit of spots) {
      const apart = Math.abs((((hit.trackDist - dist) % total) + total * 1.5) % total - total / 2);
      if (apart < LANE_READ_M) least = Math.min(least, hit.dist);
    }
    return least;
  };
}

/**
 * The longest run of points not lost.
 * @param lost true for each point lost
 * @returns its first index and the index after its last
 */
function longestRun(lost: boolean[]): [number, number] {
  let best: [number, number] = [0, 0];
  for (let from = 0; from < lost.length;) {
    if (lost[from]) { from++; continue; }
    let until = from;
    while (until < lost.length && !lost[until]) until++;
    if (until - from > best[1] - best[0]) best = [from, until];
    from = until;
  }
  return best;
}

/**
 * Whether a point stands inside a bend of the road further off than the bend's radius allows
 * (FOLD_SHARE of it): there the road's measure - distance along, offset across - folds.
 * @param sub the road
 * @param dist the point's distance along it
 * @param x world x
 * @param y world y
 * @returns true when it folds
 */
function folds(sub: Subtrack, dist: number, x: number, y: number): boolean {
  const before = centreAt(sub, dist - BEND_SPAN_M), after = centreAt(sub, dist + BEND_SPAN_M);
  const turn = Math.atan2(Math.sin(after.heading - before.heading),
    Math.cos(after.heading - before.heading));
  if (Math.abs(turn) < 1e-3) return false;
  const radius = 2 * BEND_SPAN_M / Math.abs(turn), here = centreAt(sub, dist);
  // inside: on the side the road turns toward (its tangent's change points there)
  const turnX = Math.cos(after.heading) - Math.cos(before.heading);
  const turnY = Math.sin(after.heading) - Math.sin(before.heading);
  const inside = (x - here.x) * turnX + (y - here.y) * turnY > 0;
  return inside && Math.hypot(x - here.x, y - here.y) > radius * FOLD_SHARE;
}

/**
 * A line moved sideways by an offset (its left normal +).
 * @param pts the line
 * @param off metres
 * @returns the moved line
 */
function offsetLine(pts: Point[], off: number): Point[] {
  return pts.slice(1).map(([x, y], i) => {
    const [prevX, prevY] = pts[i], len = Math.hypot(x - prevX, y - prevY) || 1;
    return [x - (y - prevY) / len * off, y + (x - prevX) / len * off] as Point;
  });
}

/**
 * The pit lane's painted lines: the divider between the fast lane (by the wall) and the working
 * lane (by the garages), and the solid entry / exit lines along the track's edge where the lane
 * leaves and joins it.
 * @param site the venue's builders' state
 * @param pit the pit lane
 * @returns the lines
 */
export function pitLines(site: Site, pit: Lane): Paint[] {
  const mid = Math.floor(pit.pts.length / 2), [x, y] = pit.pts[mid];
  const [nextX, nextY] = pit.pts[mid + 1], len = Math.hypot(nextX - x, nextY - y) || 1;
  const { sub, hit } = nearestLoop(site.loops, x, y), centre = centreAt(sub, hit.trackDist);
  // the wall side: + when the track lies on the lane's left
  const across = (centre.x - x) * -(nextY - y) / len + (centre.y - y) * (nextX - x) / len;
  const wallSide = Math.sign(across) || 1;
  const divider = smoothLine(offsetLine(smoothLine(pit.pts).slice(15, -15),
    wallSide * (PIT_W / 2 - PIT_W / 3)));
  const lines: Paint[] = [{ kind: 'line', x: 0, y: 0, pts: divider, lw: 0.15, tone: 0.75 }];
  for (const end of [pit.pts.slice(0, 16), pit.pts.slice(-16)]) {
    const hits = end.map(([endX, endY]) => nearestLoop(site.loops, endX, endY));
    // the lane's side of the road: where it lies furthest out (a merge ending on the centreline
    // puts its last points either side - each on its own side, the line crossed the road)
    const far = hits.reduce((best, near) => (near.hit.dist > best.hit.dist ? near : best));
    const side = far.hit.side === 'left' ? 1 : -1;
    const edge = hits.map((near) => {
      const road = centreAt(near.sub, near.hit.trackDist);
      return [road.x + road.nx * side * (HALF_ROAD - 0.4),
        road.y + road.ny * side * (HALF_ROAD - 0.4)] as Point;
    });
    lines.push({ kind: 'line', x: 0, y: 0, pts: smoothLine(edge), lw: 0.3, tone: 0.9 });
  }
  return lines;
}

/**
 * The pit garages placed as a garage row, in place of any building already standing in its
 * footprint (one structure mapped twice).
 * @param props the buildings so far (changed)
 * @param box the pit garages' building at game scale
 * @param pit the pit lane
 */
export function placeGarageRow(props: Prop[], box: Prop, pit: Lane): void {
  const row = garageRow(box, pit);
  for (let idx = props.length - 1; idx >= 0; idx--)
    if (props[idx].kind === 'block' && inRow(row, props[idx])) props.splice(idx, 1);
  props.push(row);
}

/**
 * Whether a building box meets a garage row (a corner of either inside the other).
 * @param row the garage row
 * @param box the building
 * @returns true when they meet
 */
export function inRow(row: Prop, box: Prop): boolean {
  const outline = [...row.front!, ...row.back!.slice().reverse()];
  const cosR = Math.cos(box.rot || 0), sinR = Math.sin(box.rot || 0);
  const corners = [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]): Point =>
    [box.x + cosR * along * (box.w || 0) / 2 - sinR * across * (box.h || 0) / 2,
      box.y + sinR * along * (box.w || 0) / 2 + cosR * across * (box.h || 0) / 2]);
  return corners.some(([x, y]) => insidePolygon(outline, x, y))
    || outline.some(([x, y]) => inBuilding([box], x, y, 0));
}

/**
 * The pit garages as a garage row: its long side nearer the pit lane is the front, moved back
 * until it stands GARAGE_GAP_M behind the lane's edge.
 * @param box the building at game scale
 * @param pit the pit lane
 * @returns the garage row prop
 */
function garageRow(box: Prop, pit: Lane): Prop {
  const cosR = Math.cos(box.rot!), sinR = Math.sin(box.rot!), halfW = box.w! / 2;
  const halfH = box.h! / 2;
  const edge = (shift: number, across: number): Point[] => {
    const out: Point[] = [];
    for (let along = -halfW; along <= halfW + 0.01; along += 2.5)
      out.push([box.x + cosR * along - sinR * (across + shift),
        box.y + sinR * along + cosR * (across + shift)]);
    return out;
  };
  const mean = (line: Point[]) =>
    line.reduce((sum, [x, y]) => sum + distToLine(pit.pts, x, y), 0) / line.length;
  const sign = mean(edge(0, -halfH)) <= mean(edge(0, halfH)) ? -1 : 1;
  let shift = 0;
  for (let tries = 0; tries < 6; tries++) {
    const nearest = Math.min(...edge(shift, sign * halfH)
      .map(([x, y]) => distToLine(pit.pts, x, y)));
    if (nearest >= PIT_W / 2 + GARAGE_GAP_M - 0.01) break;
    shift -= sign * (PIT_W / 2 + GARAGE_GAP_M - nearest);
  }
  return { kind: 'garagerow', brand: 'KUM TYRES', x: box.x, y: box.y,
    front: edge(shift, sign * halfH), back: edge(shift, -sign * halfH),
    banner: edge(shift, sign * (halfH - 0.9)) };
}

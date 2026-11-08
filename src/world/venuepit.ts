// world/venuepit.ts - A VENUE'S PIT LANE (world/venuescenery.ts builds the rest): the mapped
// lane at game scale, held clear of the pit wall and eased in at its two ends, the wall parallel
// to the road, and the painted lines - the fast / working lane divider and the solid entry and
// exit lines along the track's edge.
import { alongTrack } from "./barriers.ts";
import { SURFACES } from "./surfaces.ts";
import { querySubtrack } from "./tyrewall.ts";
import { HALF_ROAD, centreAt, centreBetween, nearestLoop, resample, smoothLine }
  from "./venuegeo.ts";
import { placeAll } from "./venuesite.ts";
import type { Site } from "./venuesite.ts";
import type { Barrier, Lane, Paint, Point, Subtrack } from "./types.ts";

// m: the pit lane's width, the wall's gap from it, where it may meet the track (its ends) and the
// wall's distance past the road's edge
export const PIT_W = 9, EDGE_TO_WALL = 3;
const PIT_WALL_GAP = 0.6, PIT_MERGE_M = 30;
// the pit lane's easing beside the track: points either side in the mean, rounds of easing
const PIT_EASE_REACH = 6, PIT_EASE_ROUNDS = 4;

/**
 * The pit lane at game scale, kept clear of the wall (the game's road is wider than the real
 * one), and the pit wall: parallel to the road, EDGE_TO_WALL past its edge, along the stretch the
 * lane runs beside it.
 * @param site the venue's builders' state
 * @returns the lane and the wall
 */
export function pitLane(site: Site): { lane: Lane; wall: Barrier | null } {
  const spec = site.build.spec;
  const data = spec.data.pitLanes.find((entry) => entry.name === spec.pitLane);
  if (!data) throw new Error(`venue: no pit lane ${spec.pitLane}`);
  const dense = resample(placeAll(site, data.pts), 2);
  const need = HALF_ROAD + EDGE_TO_WALL + PIT_WALL_GAP + PIT_W / 2;
  const beside: { sub: Subtrack; dist: number; side: number }[] = [];
  // the clearance the lane needs: in full along the wall, easing to nothing over each merge (a
  // jump in it was a kink where the merge ended)
  const clearance = (i: number, count: number) => {
    const frac = Math.min(1, Math.min(i, count - 1 - i) * 2 / PIT_MERGE_M);
    // eased in and out (a straight ramp left a corner where it topped out)
    return need * frac * frac * (3 - 2 * frac);
  };
  dense.forEach(([x, y], i) => {
    if (Math.min(i, dense.length - 1 - i) * 2 < PIT_MERGE_M) return;
    const { sub, hit } = nearestLoop(site.loops, x, y);
    // (a stretch of lane beyond the road's lookup has no side: the tri-oval's chord)
    if (!Number.isFinite(hit.dist)) return;
    beside.push({ sub, dist: hit.trackDist, side: hit.side === 'left' ? 1 : -1 });
  });
  // the lane in the track's own measure - distance along it, offset beside it - held out to its
  // clearance and eased there, then laid back beside the track (held out point by point along
  // the track's normals it bunched and jogged on a bend's inside)
  const sub = nearestLoop(site.loops, ...dense[Math.floor(dense.length / 2)]).sub;
  const total = sub.totalDist, measured: Point[] = [];
  let sideSum = 0;
  for (const [x, y] of dense) {
    const hit = querySubtrack(sub, x, y), side = hit.side === 'left' ? 1 : -1;
    let along = hit.trackDist;
    // one measure through the lap's start (no jump of a lap)
    const prev = measured.length ? measured[measured.length - 1][0] : along;
    while (along - prev > total / 2) along -= total;
    while (prev - along > total / 2) along += total;
    measured.push([along, side * hit.dist]);
    sideSum += side;
  }
  const out = Math.sign(sideSum || 1);
  const hold = (pts: Point[]) => pts.map(([along, off], i): Point =>
    [along, out * Math.max(out * off, clearance(i, pts.length))]);
  // eased and held to the clearance in turn (easing alone pulled it in where the ramp tops out)
  let measuredEased = hold(measured);
  for (let round = 0; round < PIT_EASE_ROUNDS; round++)
    measuredEased = hold(smoothLine(measuredEased, PIT_EASE_REACH, 1, true));
  const eased = measuredEased.map(([along, off]) => {
    const centre = centreBetween(sub, along);
    return [centre.x + centre.nx * off, centre.y + centre.ny * off] as Point;
  });
  let wall: Barrier | null = null;
  if (beside.length > 8) {
    const sides = beside.reduce((sum, spot) => sum + spot.side, 0), trim = 6;
    const offset = Math.sign(sides || 1) * (HALF_ROAD + EDGE_TO_WALL);
    wall = { kind: 'pitwall', pts: alongTrack(beside[0].sub, beside[0].dist + trim,
      beside[beside.length - 1].dist - trim, offset, 2) };
  }
  return { lane: { pts: eased, width: PIT_W, surface: SURFACES.concrete }, wall };
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

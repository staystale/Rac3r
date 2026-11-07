// world/venueedge.ts - A VENUE'S TRACK EDGE, sealed as a real circuit is: past the road and its
// run-off, ONE continuous Armco line each side of every layout's road (behind the real gravel
// traps where they are, RUNOFF_M past the edge elsewhere), its runs ending only where another road
// leaves - the pit lane's two ends, a layout's own junctions - and each end flared smoothly away
// from the track; two rows of tyres in front of it behind each trap. A CATCH FENCE (owner 11-07:
// weaker than the Armco, as real ones are) stands behind the Armco where spectators are: the
// grandstands and the earth banks. The gravel traps are the real ones' outlines (zones with
// poly). Marshal posts stand behind the Armco outside each corner, boards on it.
import { SURFACES } from "./surfaces.ts";
import { insidePolygon } from "./zones.ts";
import { HALF_ROAD, centreAt, clearRuns, distToLine, nearestLoop } from "./venuegeo.ts";
import type { Barrier, Cone, Point, Prop, Subtrack, TrackPoint, Zone } from "./types.ts";

// m past the road's edge the Armco stands where there is no trap (the run-off: grass)
export const RUNOFF_M = 5;
// m behind a trap's outer edge the Armco stands; how far out from the edge a trap is looked for
const TRAP_BACK_M = 2.5, TRAP_LOOK_M = 45;
// m past the road's edge within which a mapped trap must come to count as one (and its gravel
// must start, beside each point); a gap in the gravel longer than TRAP_GAP_M ends it
const TRAP_NEAR_M = 6, TRAP_GAP_M = 2;
// the share of a mapped trap's outline that must lie that near (it sits against the track)
const TRAP_SHARE = 0.15;
// m either side over which a bend's radius is read; the share of it the rim may reach inside
const CURVE_SPAN_M = 10, INSIDE_SHARE = 0.8;
// m between the rim samples; the window (samples each side) the rim is eased over, so it bends
// round a trap's ends instead of stepping
const RIM_STEP_M = 2, RIM_EASE = 6;
// m (game): a rim point nearer another road's centre than its half width + this is left out
const ROAD_CLEAR_M = 2.5;
// m: the longest single Armco run (collision and drawing skip far runs by their box)
const RUN_MAX_M = 60;
// m: an Armco end's flare - how far on, and how far it bends away from the track
const FLARE_ON_M = 3.5, FLARE_OUT_M = 2.2;
// m in front of the Armco of its two tyre rows behind a trap, and the second row's stagger
const TYRE_ROWS: [number, number][] = [[1.4, 0], [2.35, 0.475]];
// m behind the Armco of the catch fence; m behind the Armco within which a stand or bank puts one
const CATCH_BACK_M = 1.8, CATCH_REACH_M = 32;
// m behind the Armco of a marshal post, and of a board's face
const MARSHAL_BACK_M = 3.2, BOARD_BACK_M = 1;

/** One layout road's rim: the Armco's distance from the centre, per side, every RIM_STEP_M. */
export interface Rim { sub: Subtrack; left: Float32Array; right: Float32Array }

/**
 * Whether a point lies in any of a list of outlined zones.
 * @param zones the zones (with poly)
 * @param x world x
 * @param y world y
 * @returns true inside one
 */
export function inZones(zones: Zone[], x: number, y: number): boolean {
  return zones.some((zone) => Math.abs(x - zone.x) <= zone.w / 2
    && Math.abs(y - zone.y) <= zone.h / 2 && insidePolygon(zone.poly!, x, y));
}

/**
 * An outline as a zone of a surface (its bounding box as x / y / w / h).
 * @param poly the outline at game scale
 * @param surface the surface
 * @returns the zone
 */
export function outlineZone(poly: Point[], surface: Zone['surface']): Zone {
  const allX = poly.map(([x]) => x), allY = poly.map(([, y]) => y);
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY, surface,
    poly };
}

/**
 * The real gravel traps as outlined zones (only those beside the track).
 * @param traps the outlines at game scale
 * @param loops every layout's road
 * @returns the zones
 */
export function trapZones(traps: Point[][], loops: Subtrack[]): Zone[] {
  // a trap is beside the track: its nearest point within TRAP_NEAR_M of a race road's edge (a
  // mapped gravel patch off in the paddock is not a trap)
  const beside = (poly: Point[]) => poly.filter(([x, y]) =>
    nearestLoop(loops, x, y).hit.dist < HALF_ROAD + TRAP_NEAR_M).length >= poly.length * TRAP_SHARE;
  const zones = traps.filter((poly) => poly.length > 2 && beside(poly))
    .map((poly) => outlineZone(poly, SURFACES.gravel));
  return zones.filter((zone) => touchesRunoff(zone, loops));
}

/**
 * Whether a trap's gravel starts at the run-off somewhere: within TRAP_NEAR_M of a road's edge
 * at one of its samples (a patch beyond the grass is not a trap).
 * @param zone the trap zone
 * @param loops every layout's road
 * @returns true when it touches
 */
function touchesRunoff(zone: Zone, loops: Subtrack[]): boolean {
  for (const sub of loops)
    for (let dist = 0; dist < sub.totalDist; dist += RIM_STEP_M * 2) {
      const centre = centreAt(sub, dist);
      const far = Math.abs(centre.x - zone.x) > zone.w / 2 + 25
        || Math.abs(centre.y - zone.y) > zone.h / 2 + 25;
      if (far) continue;
      for (const side of [1, -1])
        for (let out = HALF_ROAD + 0.5; out <= HALF_ROAD + TRAP_NEAR_M; out += 1)
          if (inZones([zone], centre.x + centre.nx * side * out, centre.y + centre.ny * side * out))
            return true;
    }
  return false;
}

/**
 * How far out the Armco stands on one side at each rim sample: RUNOFF_M past the edge, or behind
 * the trap found there, eased over RIM_EASE samples each side.
 * @param sub the road
 * @param side +1 the left normal, -1 the right
 * @param traps the trap zones
 * @returns the offsets from the centre, m
 */
function rimSide(sub: Subtrack, side: number, traps: Zone[]): Float32Array {
  const count = Math.ceil(sub.totalDist / RIM_STEP_M), raw = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const centre = centreAt(sub, i * RIM_STEP_M), trapOut = trapDepth(centre, side, traps);
    raw[i] = Math.min(Math.max(HALF_ROAD + RUNOFF_M, trapOut ? trapOut + TRAP_BACK_M : 0),
      insideReach(sub, i * RIM_STEP_M, side));
  }
  // ease: the most within the window, then its mean (a bend, never a step)
  const most = raw.map((value, i) => {
    let top = value;
    for (let near = -RIM_EASE; near <= RIM_EASE; near++)
      top = Math.max(top, raw[(i + near + count) % count]);
    return top;
  });
  return most.map((value, i) => {
    let sum = 0;
    for (let near = -RIM_EASE; near <= RIM_EASE; near++) sum += most[(i + near + count) % count];
    return sum / (2 * RIM_EASE + 1);
  });
}

/**
 * How far out the trap beside a road point reaches: gravel must start within TRAP_NEAR_M of the
 * edge and is followed outward while it runs on (gaps under TRAP_GAP_M), so a patch beyond the
 * grass does not count.
 * @param centre the road's centre sample
 * @param side +1 the left normal, -1 the right
 * @param traps the trap zones
 * @returns metres from the centre to the trap's outer edge, or 0 with none there
 */
function trapDepth(centre: TrackPoint, side: number, traps: Zone[]): number {
  let last = 0;
  for (let out = HALF_ROAD + 0.5; out <= HALF_ROAD + TRAP_LOOK_M; out += 1) {
    const x = centre.x + centre.nx * side * out, y = centre.y + centre.ny * side * out;
    if (inZones(traps, x, y)) last = out;
    else if (last ? out - last > TRAP_GAP_M : out > HALF_ROAD + TRAP_NEAR_M) break;
  }
  return last;
}

/**
 * The deepest the rim may stand on a bend's inside: short of the bend's radius there (deeper,
 * the line would fold over itself), unlimited on its outside or a straight.
 * @param sub the road
 * @param dist metres along it
 * @param side +1 the left normal, -1 the right
 * @returns metres from the centre
 */
function insideReach(sub: Subtrack, dist: number, side: number): number {
  const before = centreAt(sub, dist - CURVE_SPAN_M), after = centreAt(sub, dist + CURVE_SPAN_M);
  const turn = Math.atan2(before.dirX * after.dirY - before.dirY * after.dirX,
    before.dirX * after.dirX + before.dirY * after.dirY);
  // turning toward the left normal (turn > 0) puts the left side inside the bend
  if (Math.abs(turn) < 1e-3 || Math.sign(turn) !== side) return Infinity;
  return INSIDE_SHARE * (2 * CURVE_SPAN_M) / Math.abs(turn);
}

/**
 * Every layout road's rim.
 * @param loops every layout's road
 * @param traps the trap zones
 * @returns the rims
 */
export function buildRims(loops: Subtrack[], traps: Zone[]): Rim[] {
  return loops.map((sub) => ({ sub, left: rimSide(sub, 1, traps),
    right: rimSide(sub, -1, traps) }));
}

/**
 * How far past a point the rim stands: negative inside the sealed edge (between a road and its
 * Armco), positive outside it.
 * @param rims every layout road's rim
 * @param x world x
 * @param y world y
 * @returns metres outside the rim (Infinity far from every road)
 */
export function pastRim(rims: Rim[], x: number, y: number): number {
  let best = Infinity;
  for (const rim of rims) {
    const { hit } = nearestLoop([rim.sub], x, y);
    if (!Number.isFinite(hit.dist)) continue;
    const offs = hit.side === 'left' ? rim.left : rim.right;
    const index = Math.floor(hit.trackDist / RIM_STEP_M) % offs.length;
    best = Math.min(best, hit.dist - offs[index]);
  }
  return best;
}

/**
 * A rim line: one side of one road at its Armco offsets.
 * @param rim the road's rim
 * @param side +1 left, -1 right
 * @param back metres further out than the Armco (the tyres in front: negative)
 * @returns the closed line's points
 */
function rimLine(rim: Rim, side: number, back = 0): Point[] {
  const offs = side > 0 ? rim.left : rim.right, pts: Point[] = [];
  for (let i = 0; i < offs.length; i++) {
    const centre = centreAt(rim.sub, i * RIM_STEP_M), out = side * (offs[i] + back);
    pts.push([centre.x + centre.nx * out, centre.y + centre.ny * out]);
  }
  pts.push(pts[0]);
  return pts;
}

/** What the edge must keep clear of: every race road, and the lanes that leave them. */
export interface EdgeClear { loops: Subtrack[]; lanes: { pts: Point[]; width: number }[] }

/**
 * Whether a point may carry the edge: clear of every race road (but its own side's rim) and of
 * every lane (pit lane, the closed pieces).
 * @param keep what to keep clear of
 * @param x world x
 * @param y world y
 * @returns true when clear
 */
function edgeClear(keep: EdgeClear, x: number, y: number): boolean {
  for (const sub of keep.loops)
    if (nearestLoop([sub], x, y).hit.dist < HALF_ROAD + ROAD_CLEAR_M) return false;
  return keep.lanes.every((lane) => distToLine(lane.pts, x, y) > lane.width / 2 + 1);
}

/**
 * A run's two ends flared smoothly away from the track (the points only if they stay clear).
 * @param run the run
 * @param away the unit direction away from the track at each end, [start, end]
 * @param clear true where a point may stand
 * @returns the run with its flares
 */
function flare(run: Point[], away: [Point, Point], clear: (x: number, y: number) => boolean):
  Point[] {
  const bend = (tip: Point, next: Point, out: Point): Point[] => {
    const len = Math.hypot(tip[0] - next[0], tip[1] - next[1]) || 1;
    const onX = (tip[0] - next[0]) / len, onY = (tip[1] - next[1]) / len;
    const pts: Point[] = [0.45, 1].map((share) => [
      tip[0] + onX * FLARE_ON_M * share + out[0] * FLARE_OUT_M * share * share,
      tip[1] + onY * FLARE_ON_M * share + out[1] * FLARE_OUT_M * share * share]);
    return pts.every(([x, y]) => clear(x, y)) ? pts : [];
  };
  const head = bend(run[0], run[1], away[0]).reverse();
  const tail = bend(run[run.length - 1], run[run.length - 2], away[1]);
  return [...head, ...run, ...tail];
}

/**
 * The unit direction away from the nearest race road at a point.
 * @param loops every layout's road
 * @param point the point
 * @returns the direction
 */
function awayFrom(loops: Subtrack[], point: Point): Point {
  const { sub, hit } = nearestLoop(loops, point[0], point[1]);
  const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
  return [centre.nx * side, centre.ny * side];
}

/**
 * Drops the points of a line within gapM of any point already used, and splits it there.
 * @param pts the line
 * @param used points already standing (added to)
 * @param gapM metres
 * @returns the runs left
 */
function withoutDoubles(pts: Point[], used: Point[], gapM: number): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const point of pts) {
    const doubled = used.some(([x, y]) => Math.abs(x - point[0]) < gapM
      && Math.abs(y - point[1]) < gapM && Math.hypot(x - point[0], y - point[1]) < gapM);
    if (doubled) { if (run.length > 1) runs.push(run); run = []; } else run.push(point);
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/**
 * The sealed edge: the Armco both sides of every layout's road (a road shared by two layouts gets
 * one), flared at the openings, and two tyre rows in front of it behind each trap.
 * @param rims every layout road's rim
 * @param keep what to keep clear of
 * @param traps the trap zones
 * @returns the Armco runs and the tyre stacks
 */
export function buildEdge(rims: Rim[], keep: EdgeClear, traps: Zone[]):
  { barriers: Barrier[]; cones: Cone[] } {
  const barriers: Barrier[] = [], cones: Cone[] = [], used: Point[] = [];
  const clear = (x: number, y: number) => edgeClear(keep, x, y);
  for (const rim of rims)
    for (const side of [1, -1]) {
      const fresh: Point[] = [];
      for (const part of withoutDoubles(rimLine(rim, side), used, 1.5))
        for (const run of clearRuns(part, clear, RIM_STEP_M)) {
          // flared at its real ends, then cut into short runs (no flare where it was only cut)
          const flared = flare(run,
            [awayFrom(keep.loops, run[0]), awayFrom(keep.loops, run[run.length - 1])], clear);
          for (const chunk of chunks(flared, RUN_MAX_M / RIM_STEP_M))
            barriers.push({ kind: 'armco', pts: chunk });
          fresh.push(...run);
          cones.push(...trapTyres(run, keep.loops, traps, clear));
        }
      used.push(...fresh);
    }
  return { barriers, cones };
}

/**
 * A line cut into pieces of at most count segments, each sharing its end point with the next.
 * @param pts the line
 * @param count segments a piece
 * @returns the pieces
 */
function chunks(pts: Point[], count: number): Point[][] {
  const out: Point[][] = [];
  for (let from = 0; from < pts.length - 1; from += count)
    out.push(pts.slice(from, Math.min(pts.length, from + count + 1)));
  return out;
}

/**
 * The two tyre rows in front of an Armco run, where it stands behind a trap (gravel within reach
 * just in front of it).
 * @param run the Armco run
 * @param loops every layout's road
 * @param traps the trap zones
 * @param clear true where a point may stand
 * @returns the tyre stacks
 */
function trapTyres(run: Point[], loops: Subtrack[], traps: Zone[],
  clear: (x: number, y: number) => boolean): Cone[] {
  const out: Cone[] = [];
  for (const [front, shift] of TYRE_ROWS) {
    const row = run.map((point) => {
      const away = awayFrom(loops, point);
      return [point[0] - away[0] * front, point[1] - away[1] * front] as Point;
    });
    for (const line of clearRuns(row, (x, y) => clear(x, y) && nearTrap(traps, x, y, 3), 0.95))
      for (let i = shift ? 1 : 0; i < line.length; i++)
        out.push({ x: line[i][0], y: line[i][1], kind: 'tyrestack' });
  }
  return out;
}

/**
 * Whether a trap lies within reach of a point.
 * @param traps the trap zones
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns true when near
 */
function nearTrap(traps: Zone[], x: number, y: number, reach: number): boolean {
  return traps.some((zone) => Math.abs(x - zone.x) <= zone.w / 2 + reach
    && Math.abs(y - zone.y) <= zone.h / 2 + reach
    && (insidePolygon(zone.poly!, x, y)
      || distToLine([...zone.poly!, zone.poly![0]], x, y) < reach));
}

/**
 * The catch fences: CATCH_BACK_M behind the Armco wherever a grandstand or a bank stands within
 * CATCH_REACH_M behind it.
 * @param armco the Armco runs
 * @param spectators where people stand: points (stand corners and centres, bank points)
 * @param loops every layout's road
 * @returns the catch fence runs
 */
export function buildCatchFences(armco: Barrier[], spectators: Point[], loops: Subtrack[]):
  Barrier[] {
  const out: Barrier[] = [];
  for (const rail of armco) {
    const behind = rail.pts.map((point) => {
      const away = awayFrom(loops, point);
      return [point[0] + away[0] * CATCH_BACK_M, point[1] + away[1] * CATCH_BACK_M] as Point;
    });
    const watched = (x: number, y: number) => spectators.some(([spotX, spotY]) =>
      Math.abs(spotX - x) < CATCH_REACH_M && Math.abs(spotY - y) < CATCH_REACH_M
      && Math.hypot(spotX - x, spotY - y) < CATCH_REACH_M);
    for (const run of clearRuns(behind, watched, 2, RUN_MAX_M))
      if (run.length > 4) out.push({ kind: 'catchfence', pts: run });
  }
  return out;
}

/**
 * A marshal post behind the Armco outside each corner of every layout (one where layouts share a
 * corner).
 * @param rims every layout road's rim
 * @returns the posts
 */
export function marshalPosts(rims: Rim[]): Prop[] {
  const posts: Prop[] = [];
  for (const rim of rims)
    for (const kerb of rim.sub.curvedKerbs) {
      const mid = (kerb.startDist + kerb.endDist) / 2;
      const before = centreAt(rim.sub, mid - 8), after = centreAt(rim.sub, mid + 8);
      // the turn: toward the left normal when the heading swings that way; outside the other
      const turn = before.dirX * after.dirY - before.dirY * after.dirX;
      const side = turn > 0 ? -1 : 1, offs = side > 0 ? rim.left : rim.right;
      const centre = centreAt(rim.sub, mid);
      const out = side * (offs[Math.floor(mid / RIM_STEP_M) % offs.length] + MARSHAL_BACK_M);
      const spot = { x: centre.x + centre.nx * out, y: centre.y + centre.ny * out };
      if (posts.some((post) => Math.hypot(post.x - spot.x, post.y - spot.y) < 25)) continue;
      posts.push({ kind: 'marshal', ...spot, rot: Math.atan2(centre.dirY, centre.dirX) });
    }
  return posts;
}

/**
 * A board at the Armco nearest a spot, facing the track.
 * @param armco the Armco runs
 * @param loops every layout's road
 * @param spot where the board should be
 * @param label its words
 * @param rims every layout road's rim (the board stands on the side away from the track)
 * @returns the board prop, or null with no Armco near
 */
export function boardOnArmco(armco: Barrier[], loops: Subtrack[], spot: Point,
  label: string, rims: Rim[]): Prop | null {
  let best: Point | null = null, bestSq = 60 * 60;
  for (const rail of armco)
    for (const point of rail.pts) {
      const distSq = (point[0] - spot[0]) ** 2 + (point[1] - spot[1]) ** 2;
      if (distSq < bestSq) { bestSq = distSq; best = point; }
    }
  if (!best) return null;
  // away from the NEAREST road can point at another layout's road where two meet: take the
  // side of the rail that lies further outside the edge
  const near = awayFrom(loops, best), rail = best;
  const outside = (sign: number) => pastRim(rims, rail[0] + near[0] * sign * BOARD_BACK_M,
    rail[1] + near[1] * sign * BOARD_BACK_M);
  const sign = outside(1) >= outside(-1) ? 1 : -1, away = [near[0] * sign, near[1] * sign];
  return { kind: 'board', label, x: rail[0] + away[0] * BOARD_BACK_M,
    y: rail[1] + away[1] * BOARD_BACK_M, rot: Math.atan2(away[0], -away[1]) };
}

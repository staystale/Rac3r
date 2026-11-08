// world/venueedge.ts - A VENUE'S TRACK EDGE, sealed as a real circuit is: past the road and its
// run-off, ONE continuous Armco line each side of every layout's road (behind the real gravel
// traps where they are, RUNOFF_M past the edge elsewhere), its runs ending only where another road
// leaves - the pit lane's two ends, a layout's own junctions - and each end flared smoothly away
// from the track; two rows of tyres in front of it behind each trap and along a real tyre wall. A
// CATCH FENCE (owner 11-07: weaker than the Armco, as real ones are) stands instead where
// spectators are: the grandstands and the earth banks. The gravel traps are the real ones'
// outlines (zones with poly). A venue that follows its real rails (Castle Cum) has Armco where
// they are, else open run-off away from traps and hazards. Marshal posts stand behind the Armco
// outside each corner, boards on it.
import { SURFACES } from "./surfaces.ts";
import { insidePolygon } from "./zones.ts";
import { HALF_ROAD, centreAt, clearRuns, distToLine, lineLength, nearestLoop, roadDistance }
  from "./venuegeo.ts";
import type { Barrier, Cone, Point, Prop, Subtrack, TrackPoint, Zone } from "./types.ts";

// m past the road's edge the Armco stands where there is no trap (the run-off: grass)
export const RUNOFF_M = 5;
// m behind a trap's outer edge the Armco stands; how far out from the edge a trap is looked for
const TRAP_BACK_M = 2.5, TRAP_LOOK_M = 45;
// m behind an unraced road piece beside the road the Armco stands (the piece is the run-off)
const PIECE_BACK_M = 2;
// m past the road's edge the Armco stands along a real tyre wall: at the mapped wall, at least
// WALL_RUNOFF_M (its nearer tyre row, 2.35 m in front, then measured 3.4 m off the edge round a
// bend - no nearer than the least behind a Brands trap, 3.38 m); how far out the mapped wall is
// looked for, and how near counts as on it
const WALL_RUNOFF_M = 5.85, WALL_LOOK_M = 25, WALL_HIT_M = 1;
// m from a real tyre wall's (or rail's) mapped line within which the edge stands along it (its
// Armco, its tyres and the floor above all reach as far)
export const WALL_REACH_M = 6;
// m past the edge a real rail is looked for (a venue that follows its rails: Castle Combe's
// infield rails stand 17-28 m in); m of gap filled between two Armco runs there (OSM maps a rail
// in pieces)
const RAIL_LOOK_M = 30, RAIL_GAP_FILL_M = 60;
// the rim line's easing there: rim samples either side in the mean, and passes
const RAIL_EASE_PTS = 3, RAIL_EASE_PASSES = 6;
// m within which a barrier point repeats the one before it (left out)
const REPEAT_M = 0.5;
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
const FLARE_ON_M = 6, FLARE_OUT_M = 1.6;
// m a flare's points keep from a catch fence (an Armco end meeting one is not flared across it)
const FLARE_CLEAR_M = 3;
// m in front of the Armco of its two tyre rows behind a trap, and the second row's stagger
const TYRE_ROWS: [number, number][] = [[1.4, 0], [2.35, 0.475]];
// m beyond the rim a hazard is looked for (Armco before it); m of gap filled between two runs of a
// kind; m a run is grown each way; the fewest points a run keeps
const HAZARD_M = 14, GAP_FILL_M = 24, EXTEND_M = 8, MIN_RUN_PTS = 14, MIN_RUN_M = 26;
// the fewest tyres a row in front of a barrier keeps (a few alone read as litter)
const MIN_TYRE_ROW = 16;
// m behind the Armco of a marshal post, and of a board (behind the catch fence too)
const MARSHAL_BACK_M = 3.2, BOARD_BACK_M = 3;
// m: half a board's face, how far it keeps from a barrier point or a tyre, how far along the
// rail a clear spot is looked for
const BOARD_HALF_M = 9, BOARD_GAP_M = 2.5, BOARD_LOOK_M = 80;

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
 * How far out the Armco stands on one side at each rim sample: RUNOFF_M past the edge, behind
 * the trap found there, at a real tyre wall's mapped line (WALL_RUNOFF_M past the edge at least)
 * or PIECE_BACK_M past an unraced road piece beside it (an old line beside a chicane lies inside
 * the edge), eased over RIM_EASE samples each side.
 * @param sub the road
 * @param side +1 the left normal, -1 the right
 * @param traps the trap zones
 * @param lines the real tyre walls and the unraced pieces at game scale
 * @returns the offsets from the centre, m
 */
function rimSide(sub: Subtrack, side: number, traps: Zone[], lines: RimLines): Float32Array {
  const count = Math.ceil(sub.totalDist / RIM_STEP_M), raw = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const centre = centreAt(sub, i * RIM_STEP_M), trapOut = trapDepth(centre, side, traps);
    const pieceOut = pieceDepth(centre, side, lines.pieces);
    raw[i] = Math.min(Math.max(HALF_ROAD + RUNOFF_M, trapOut ? trapOut + TRAP_BACK_M : 0,
      wallDepth(centre, side, lines.walls), pieceOut ? pieceOut + PIECE_BACK_M : 0),
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

/** A real line at game scale (a tyre wall, a rail) with its box (a far one is not looked at). */
export interface WallLine { pts: Point[]; box: [number, number, number, number] }

/**
 * A line with its box.
 * @param pts the line at game scale
 * @returns the line and its box
 */
export function boxedLine(pts: Point[]): WallLine {
  const allX = pts.map(([x]) => x), allY = pts.map(([, y]) => y);
  return { pts, box: [Math.min(...allX), Math.min(...allY), Math.max(...allX),
    Math.max(...allY)] };
}

/**
 * The real lines whose box comes within reach of a point.
 * @param lines the lines
 * @param x world x
 * @param y world y
 * @param reach metres
 * @returns those near
 */
function linesNear(lines: WallLine[], x: number, y: number, reach: number): WallLine[] {
  return lines.filter(({ box }) => x > box[0] - reach && x < box[2] + reach
    && y > box[1] - reach && y < box[3] + reach);
}

/**
 * How far out a real tyre wall's mapped line stands beside a road point: where it is met within
 * WALL_LOOK_M of the edge (WALL_RUNOFF_M past the edge at least); just past its ends - the run-off
 * rim within WALL_REACH_M of it, where its Armco and tyres still stand - at WALL_RUNOFF_M; 0
 * elsewhere.
 * @param centre the road's centre sample
 * @param side +1 the left normal, -1 the right
 * @param walls the walls
 * @returns metres from the centre
 */
function wallDepth(centre: TrackPoint, side: number, walls: WallLine[]): number {
  const near = linesNear(walls, centre.x, centre.y, HALF_ROAD + WALL_LOOK_M + WALL_REACH_M);
  if (!near.length) return 0;
  for (let out = HALF_ROAD + 0.5; out <= HALF_ROAD + WALL_LOOK_M; out += 0.5) {
    const x = centre.x + centre.nx * side * out, y = centre.y + centre.ny * side * out;
    if (near.some((wall) => distToLine(wall.pts, x, y) < WALL_HIT_M))
      return Math.max(out, HALF_ROAD + WALL_RUNOFF_M);
  }
  const rimX = centre.x + centre.nx * side * (HALF_ROAD + RUNOFF_M);
  const rimY = centre.y + centre.ny * side * (HALF_ROAD + RUNOFF_M);
  return near.some((wall) => distToLine(wall.pts, rimX, rimY) < WALL_REACH_M)
    ? HALF_ROAD + WALL_RUNOFF_M : 0;
}

/**
 * Whether a real rail stands beside a road point: met along its normal on that side within
 * RAIL_LOOK_M of the edge (a venue that follows its rails: Armco at the rim there).
 * @param centre the road's centre sample
 * @param side +1 the left normal, -1 the right
 * @param rails the rails
 * @returns true when one does
 */
function railBeside(centre: TrackPoint, side: number, rails: WallLine[]): boolean {
  const near = linesNear(rails, centre.x, centre.y, HALF_ROAD + RAIL_LOOK_M);
  for (let out = HALF_ROAD + 0.5; near.length && out <= HALF_ROAD + RAIL_LOOK_M; out += 1) {
    const x = centre.x + centre.nx * side * out, y = centre.y + centre.ny * side * out;
    if (near.some((rail) => distToLine(rail.pts, x, y) < WALL_HIT_M)) return true;
  }
  return false;
}

/** What the rim stands beyond besides the traps (game scale; none on most venues). */
export interface RimLines {
  walls: WallLine[];   // the real tyre walls (spec.tyreWalls)
  pieces: { pts: Point[]; width: number }[];   // the road pieces no layout races
}

/**
 * How far out an unraced road piece beside a road point reaches: its far edge, through the
 * piece's nearest point on this side, when that point lies within TRAP_NEAR_M of the edge
 * (measured square to the piece - marched along the road's normal, a chicane's bend crossed the
 * piece at a slant and read it tens of metres deep).
 * @param centre the road's centre sample
 * @param side +1 the left normal, -1 the right
 * @param pieces the pieces no layout races
 * @returns metres from the centre to its far edge, or 0 with none there
 */
function pieceDepth(centre: TrackPoint, side: number, pieces: RimLines['pieces']): number {
  let deepest = 0;
  for (const piece of pieces) {
    let best = Infinity, bestX = 0, bestY = 0;
    for (let i = 0; i + 1 < piece.pts.length; i++) {
      const [fromX, fromY] = piece.pts[i], [toX, toY] = piece.pts[i + 1];
      const dx = toX - fromX, dy = toY - fromY;
      const frac = Math.max(0, Math.min(1,
        ((centre.x - fromX) * dx + (centre.y - fromY) * dy) / (dx * dx + dy * dy || 1e-9)));
      const x = fromX + dx * frac, y = fromY + dy * frac;
      const gap = Math.hypot(x - centre.x, y - centre.y);
      if (gap < best) { best = gap; bestX = x; bestY = y; }
    }
    const onSide = ((bestX - centre.x) * centre.nx + (bestY - centre.y) * centre.ny) * side > 0;
    if (onSide && best - piece.width / 2 < HALF_ROAD + TRAP_NEAR_M)
      deepest = Math.max(deepest, best + piece.width / 2);
  }
  return deepest;
}

/**
 * Every layout road's rim.
 * @param loops every layout's road
 * @param traps the trap zones
 * @param lines the real tyre walls and the pieces no layout races
 * @returns the rims
 */
export function buildRims(loops: Subtrack[], traps: Zone[],
  lines: RimLines = { walls: [], pieces: [] }): Rim[] {
  return loops.map((sub) => ({ sub, left: rimSide(sub, 1, traps, lines),
    right: rimSide(sub, -1, traps, lines) }));
}

/**
 * How far past a point the rim stands: negative inside the sealed edge (between a road and its
 * Armco), positive outside it.
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
export interface EdgeClear {
  loops: Subtrack[]; lanes: { pts: Point[]; width: number }[];
  blocked: (x: number, y: number) => boolean;   // a building there (the edge keeps off it)
}

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
  return keep.lanes.every((lane) => distToLine(lane.pts, x, y) > lane.width / 2 + 1)
    && !keep.blocked(x, y);
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

/** What stands at a rim sample. */
const EDGE_NONE = 0, EDGE_ARMCO = 1, EDGE_CATCH = 2;

/**
 * What decides the edge beside a road: hazards beyond it, where spectators stand, and the real
 * tyre walls (a venue whose run-off is grass to a tyre wall, no trap: Castle Combe's Quarry).
 */
export interface EdgeNeeds {
  hazard: (x: number, y: number) => boolean;   // a solid thing there (Armco protects it)
  watched: (x: number, y: number) => boolean;   // spectators near (a catch fence instead)
  walled?: (x: number, y: number) => boolean;   // a real tyre wall (Armco, tyres in front)
  rails?: WallLine[];   // the real rails of a venue that follows them (Armco where they are)
}

/**
 * What stands at each rim sample of one side: Armco behind a trap, along a real tyre wall or rail,
 * or before a hazard within HAZARD_M beyond the rim, a catch fence where spectators are, else
 * nothing (open run-off); gaps under GAP_FILL_M (RAIL_GAP_FILL_M following real rails) between
 * two runs of the same kind filled, each run grown EXTEND_M each way.
 * @param rim the road's rim
 * @param side +1 left, -1 right
 * @param traps the trap zones
 * @param needs the hazards and spectators
 * @param loops every layout's road (another stretch of track is a hazard)
 * @returns the kind at each sample
 */
function edgeKinds(rim: Rim, side: number, traps: Zone[], needs: EdgeNeeds,
  loops: Subtrack[]): Uint8Array {
  const offs = side > 0 ? rim.left : rim.right, count = offs.length;
  const kinds = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const centre = centreAt(rim.sub, i * RIM_STEP_M);
    const outX = centre.nx * side, outY = centre.ny * side;
    const x = centre.x + outX * offs[i], y = centre.y + outY * offs[i];
    let hazard = trapDepth(centre, side, traps) > 0 || !!needs.walled?.(x, y)
      || (!!needs.rails && railBeside(centre, side, needs.rails));
    for (let past = 0; past <= HAZARD_M && !hazard; past += 2) {
      const probeX = x + outX * past, probeY = y + outY * past;
      hazard = needs.hazard(probeX, probeY)
        || nearestLoop(loops, probeX, probeY).hit.dist < HALF_ROAD + 1;
    }
    kinds[i] = needs.watched(x, y) ? EDGE_CATCH : hazard ? EDGE_ARMCO : EDGE_NONE;
  }
  fillGaps(kinds, Math.round((needs.rails ? RAIL_GAP_FILL_M : GAP_FILL_M) / RIM_STEP_M));
  growRuns(kinds, Math.round(EXTEND_M / RIM_STEP_M));
  return kinds;
}

/**
 * Fills each gap of nothing no longer than most samples between two runs of the same kind (no
 * random short gaps).
 * @param kinds the kinds round the loop (changed)
 * @param most samples
 */
function fillGaps(kinds: Uint8Array, most: number): void {
  const count = kinds.length;
  for (let i = 0; i < count; i++) {
    if (kinds[i] === EDGE_NONE || kinds[(i + 1) % count] !== EDGE_NONE) continue;
    let gap = 1;
    while (gap <= most && kinds[(i + gap) % count] === EDGE_NONE) gap++;
    if (gap <= most && kinds[(i + gap) % count] === kinds[i])
      for (let fill = 1; fill < gap; fill++) kinds[(i + fill) % count] = kinds[i];
  }
}

/**
 * Grows every run into the nothing either side of it by up to grow samples.
 * @param kinds the kinds round the loop (changed)
 * @param grow samples
 */
function growRuns(kinds: Uint8Array, grow: number): void {
  const count = kinds.length, before = kinds.slice();
  for (let i = 0; i < count; i++) {
    if (before[i] !== EDGE_NONE) continue;
    for (let reach = 1; reach <= grow; reach++) {
      const ahead = before[(i + reach) % count], behind = before[(i - reach + count) % count];
      if (ahead !== EDGE_NONE || behind !== EDGE_NONE) {
        kinds[i] = ahead !== EDGE_NONE ? ahead : behind;
        break;
      }
    }
  }
}

/**
 * The runs of one kind round a rim side, as point lists (a run across the loop's start joined).
 * @param pts the rim line's points (one a sample)
 * @param kinds the kinds
 * @param kind the kind wanted
 * @returns the runs
 */
function kindRuns(pts: Point[], kinds: Uint8Array, kind: number): Point[][] {
  const count = kinds.length, runs: Point[][] = [];
  const first = kinds.findIndex((value) => value !== kind);
  if (first < 0) return [pts.slice(0, count).concat([pts[0]])];
  let run: Point[] = [];
  for (let step = 1; step <= count; step++) {
    const i = (first + step) % count;
    if (kinds[i] === kind) run.push(pts[i]);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs.filter((line) => line.length > 1);
}

/**
 * The edge: per stretch Armco (behind the traps and before hazards), a catch fence where
 * spectators are (instead, never both) or open run-off; a road two layouts share gets one; Armco
 * ends flared smoothly; two tyre rows in front of it behind each trap.
 * @param rims every layout road's rim
 * @param keep what to keep clear of
 * @param traps the trap zones
 * @param needs the hazards and spectators
 * @returns the barriers and the tyre stacks
 */
export function buildEdge(rims: Rim[], keep: EdgeClear, traps: Zone[], needs: EdgeNeeds):
  { barriers: Barrier[]; cones: Cone[] } {
  const barriers: Barrier[] = [], cones: Cone[] = [], used: Point[] = [];
  const clear = (x: number, y: number) => edgeClear(keep, x, y);
  for (const rim of rims) {
    // one barrier round the run-off of every layout: none inside another layout's run-off
    const others = rims.filter((other) => other !== rim);
    const outsideOthers = (x: number, y: number) => clear(x, y) && pastRim(others, x, y) > -1;
    for (const side of [1, -1]) {
      const kinds = edgeKinds(rim, side, traps, needs, keep.loops);
      const line = needs.rails ? easedLoop(rimLine(rim, side), rim, side) : rimLine(rim, side);
      const fresh: Point[] = [];
      // where Armco gives way to a catch fence the line runs on: no flare across the fence (along
      // a venue that follows its real rails)
      const fence = needs.rails ? kindRuns(line, kinds, EDGE_CATCH).flat() : [];
      const flareClear = (x: number, y: number) => clear(x, y) && fence.every(([fenceX, fenceY]) =>
        Math.abs(fenceX - x) > FLARE_CLEAR_M || Math.abs(fenceY - y) > FLARE_CLEAR_M);
      for (const [kind, barrierKind] of [[EDGE_ARMCO, 'armco'], [EDGE_CATCH, 'catchfence']] as
        [number, Barrier['kind']][])
        for (const part of kindRuns(line, kinds, kind)
          .flatMap((run) => withoutDoubles(run, used, 3)))
          for (const run of clearRuns(part, outsideOthers, RIM_STEP_M)) {
            if (run.length < MIN_RUN_PTS || lineLength(run) < MIN_RUN_M) continue;
            // Armco flared at its real ends, then cut into short runs (no flare where only cut)
            const ends: [Point, Point] = [awayFrom(keep.loops, run[0]),
              awayFrom(keep.loops, run[run.length - 1])];
            const flared = barrierKind === 'armco' ? flare(run, ends, flareClear) : run;
            const shaped = needs.rails ? withoutRepeats(flared) : flared;
            for (const chunk of chunks(shaped, RUN_MAX_M / RIM_STEP_M))
              barriers.push({ kind: barrierKind, pts: chunk });
            fresh.push(...run);
            // a tyre wall in front of either, where it stands behind a trap
            cones.push(...trapTyres(run, keep.loops, traps, clear, needs.walled));
          }
      used.push(...fresh);
    }
  }
  return { barriers, cones };
}

/**
 * A closed rim line eased by a running mean round the loop (RAIL_EASE_PTS either side,
 * RAIL_EASE_PASSES times), never nearer the road than the rim (eased, the outside of a bend came
 * in on its tyre walls): along a venue that follows its real rails the Armco stands nearly all
 * round, and the offset line's jogs on a chicane's tight bends showed as kinks in it.
 * @param pts the closed line (its last point its first again)
 * @param rim the road's rim
 * @param side +1 left, -1 right
 * @returns the eased line, closed the same way
 */
function easedLoop(pts: Point[], rim: Rim, side: number): Point[] {
  const count = pts.length - 1, offs = side > 0 ? rim.left : rim.right;
  // never nearer the road than the rim there
  const floor = ([x, y]: Point): Point => {
    const { hit } = nearestLoop([rim.sub], x, y);
    const least = offs[Math.floor(hit.trackDist / RIM_STEP_M) % offs.length];
    if (!(hit.dist < least) || (hit.side === 'left' ? 1 : -1) !== side) return [x, y];
    const centre = centreAt(rim.sub, hit.trackDist);
    return [centre.x + centre.nx * side * least, centre.y + centre.ny * side * least];
  };
  let line = pts.slice(0, count);
  for (let pass = 0; pass < RAIL_EASE_PASSES; pass++)
    line = line.map((point, i) => {
      let sumX = 0, sumY = 0;
      for (let near = -RAIL_EASE_PTS; near <= RAIL_EASE_PTS; near++) {
        const [x, y] = line[(i + near + count) % count];
        sumX += x;
        sumY += y;
      }
      return floor([sumX / (2 * RAIL_EASE_PTS + 1), sumY / (2 * RAIL_EASE_PTS + 1)]);
    });
  return [...line, line[0]];
}

/**
 * A line without its points that repeat the one before (within REPEAT_M): the eased rim line's
 * floor can hold several samples on one spot by a tight bend.
 * @param pts the line
 * @returns the line
 */
function withoutRepeats(pts: Point[]): Point[] {
  const out = [pts[0]];
  for (const point of pts.slice(1)) {
    const [lastX, lastY] = out[out.length - 1];
    if (Math.hypot(point[0] - lastX, point[1] - lastY) >= REPEAT_M) out.push(point);
  }
  return out.length > 1 ? out : pts;
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
 * just in front of it) or along a real tyre wall.
 * @param run the Armco run
 * @param loops every layout's road
 * @param traps the trap zones
 * @param clear true where a point may stand
 * @param walled true along a real tyre wall (none when absent)
 * @returns the tyre stacks
 */
function trapTyres(run: Point[], loops: Subtrack[], traps: Zone[],
  clear: (x: number, y: number) => boolean, walled?: (x: number, y: number) => boolean): Cone[] {
  const behind = (x: number, y: number) => nearTrap(traps, x, y, 3) || !!walled?.(x, y);
  const out: Cone[] = [];
  for (const [front, shift] of TYRE_ROWS) {
    const row = run.map((point) => {
      const away = awayFrom(loops, point);
      return [point[0] - away[0] * front, point[1] - away[1] * front] as Point;
    });
    for (const line of clearRuns(row, (x, y) => clear(x, y) && behind(x, y), 0.95)) {
      if (line.length < MIN_TYRE_ROW) continue;
      for (let i = shift ? 1 : 0; i < line.length; i++)
        out.push({ x: line[i][0], y: line[i][1], kind: 'tyrestack' });
    }
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
 * Which way is behind a rail point: away from the road the rail was built from (the rim whose
 * offset matches the point's distance from it - away from the NEAREST road can point at another
 * layout's road where two meet).
 * @param point the rail point
 * @param loops every layout's road
 * @param rims every layout road's rim
 * @returns the unit direction
 */
function behindRail(point: Point, loops: Subtrack[], rims: Rim[]): Point {
  let away: Point = awayFrom(loops, point), match = Infinity;
  for (const rim of rims) {
    const { hit } = nearestLoop([rim.sub], point[0], point[1]);
    if (!Number.isFinite(hit.dist)) continue;
    const offs = hit.side === 'left' ? rim.left : rim.right;
    const miss = Math.abs(hit.dist - offs[Math.floor(hit.trackDist / RIM_STEP_M) % offs.length]);
    if (miss >= match) continue;
    match = miss;
    const centre = centreAt(rim.sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
    away = [centre.nx * side, centre.ny * side];
  }
  return away;
}

/**
 * A board behind the Armco (and its catch fence) near a spot, facing the track: the rail's points
 * are tried from the nearest outward until the board's whole face stands clear of every barrier
 * and tyre stack (on a bend a straight board would cross the curved rail). With no Armco within
 * BOARD_LOOK_M, behind a catch fence (a spectator bank with no Armco near).
 * @param barriers every barrier (the Armco and catch fences)
 * @param cones the tyre stacks
 * @param loops every layout's road
 * @param spot where the board should be
 * @param label its words
 * @param rims every layout road's rim
 * @param blocked true where a building stands (the board keeps off it)
 * @returns the board prop, or null with no clear spot within BOARD_LOOK_M
 */
export function boardOnArmco(barriers: Barrier[], cones: Cone[], loops: Subtrack[], spot: Point,
  label: string, rims: Rim[], blocked: (x: number, y: number) => boolean): Prop | null {
  const railPts = (kind: Barrier['kind']) => barriers.filter((rail) => rail.kind === kind)
    .flatMap((rail) => rail.pts)
    .filter(([x, y]) => Math.hypot(x - spot[0], y - spot[1]) < BOARD_LOOK_M)
    .sort((first, second) => Math.hypot(first[0] - spot[0], first[1] - spot[1])
      - Math.hypot(second[0] - spot[0], second[1] - spot[1]));
  const near = barriers.flatMap((rail) => rail.pts);
  const armco = railPts('armco');
  for (const point of armco.length ? armco : railPts('catchfence')) {
    const away = behindRail(point, loops, rims);
    const x = point[0] + away[0] * BOARD_BACK_M, y = point[1] + away[1] * BOARD_BACK_M;
    const alongX = -away[1], alongY = away[0];
    // behind the rail: every point of the face further from the road than the rail itself
    const railGap = roadDistance(loops, point[0], point[1]);
    const apart = (fromX: number, fromY: number, toX: number, toY: number) =>
      Math.hypot(fromX - toX, fromY - toY) > BOARD_GAP_M;
    let clear = true;
    for (let along = -BOARD_HALF_M; along <= BOARD_HALF_M && clear; along += 1.5) {
      const faceX = x + alongX * along, faceY = y + alongY * along;
      clear = near.every(([railX, railY]) => apart(railX, railY, faceX, faceY))
        && cones.every((cone) => apart(cone.x, cone.y, faceX, faceY))
        && pastRim(rims, faceX, faceY) > 1 && !blocked(faceX, faceY)
        && roadDistance(loops, faceX, faceY) > railGap + 1.5;
    }
    if (clear) return { kind: 'board', label, x, y, rot: Math.atan2(alongY, alongX) };
  }
  return null;
}

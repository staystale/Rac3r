// world/venuejoker.ts - A RALLYCROSS LAYOUT'S JOKER AND START LANE (world/venue.ts). The JOKER
// (spec.joker): the part of another layout's loop round a spot that this layout does not race, as
// the lane a car must take once in a race (game/rules.ts). Knobhill's: the rallycross lap cuts up
// the escape road from the Railway Straight to the start straight; the joker runs on round the
// circuit's hairpin. The START LANE (spec.startLane): a start straight off the lap, its dead end
// behind the grid (Slidden Hill's).
import { SURFACES } from "./surfaces.ts";
import { querySubtrack } from "./tyrewall.ts";
import { HALF_ROAD, VENUE_ROAD_M, centreAt, resample, smoothLine } from "./venuegeo.ts";
import type { VenueBuild } from "./venue.ts";
import type { Lane, Point, Subtrack } from "./types.ts";

// m past the raced road's edge a point of the other loop lies to be off it (the joker's own road)
const OFF_M = 1;
// m on along the shared road the lane reaches before and after its own road (its mouths, on the
// raced road: the driver's line branches off and rejoins there, ai/line.ts)
const MOUTH_M = 20;

/**
 * A layout's joker lane, in driving order (the other loop runs the same way round).
 * @param build the venue at game scale
 * @param layout the layout raced
 * @returns the lane, or null when the layout has no joker
 */
export function venueJoker(build: VenueBuild, layout: string): Lane | null {
  const joker = build.spec.joker;
  if (!joker || joker.layout !== layout) return null;
  const own = build.loops[layout], via = build.loops[joker.loop];
  const pts = via.pts, count = pts.length, wrap = (i: number) => ((i % count) + count) % count;
  const off = (i: number) => {
    const point = pts[wrap(i)];
    return querySubtrack(own, point.x, point.y).dist > HALF_ROAD + OFF_M;
  };
  const nearX = joker.near[0] * build.scale, nearY = joker.near[1] * build.scale;
  let mid = 0, best = Infinity;
  pts.forEach((point, i) => {
    const gap = Math.hypot(point.x - nearX, point.y - nearY);
    if (gap < best) [best, mid] = [gap, i];
  });
  if (!off(mid)) return null;
  let first = mid, last = mid;
  while (off(first - 1) && mid - first < count) first--;
  while (off(last + 1) && last - mid < count) last++;
  // lap m between two of the loop's points, forward
  const ahead = (from: number, until: number) =>
    ((pts[wrap(until)].dist - pts[wrap(from)].dist) % via.totalDist + via.totalDist)
      % via.totalDist;
  const offFirst = first, offLast = last;
  while (ahead(first - 1, offFirst) < MOUTH_M) first--;
  while (ahead(offLast, last + 1) < MOUTH_M) last++;
  const lane: [number, number][] = [];
  for (let i = first; i <= last; i++) lane.push([pts[wrap(i)].x, pts[wrap(i)].y]);
  // on the joker loop's own surface at its middle (a dirt joker: L.A. Lively's), race tarmac else
  const midDist = pts[mid].dist;
  const sector = via.sectors.find((part) => midDist >= part.startDist && midDist < part.endDist);
  return { pts: lane, width: VENUE_ROAD_M, surface: sector?.surface || SURFACES.racetarmac };
}

// m of the start lane behind the pole's slot where the venue does not say (VenueSpec.startLane
// gridRoomM): the grid's slots 7 m apart, two abreast
const GRID_ROOM_M = 75;
// m between the start lane's centre and the lap's where they run side by side (the two roads and
// a strip of grass for the wall between: the game's 13 m road at half scale ran a real start
// straight 12 m off the lap onto it), eased in over START_EASE_M back from where it meets the lap
const START_APART_M = VENUE_ROAD_M + 5, START_EASE_M = 45;
// the held lane's easing: points either side in the mean (2 m apart), rounds
const START_EASE_REACH = 10, START_EASE_ROUNDS = 4;

/**
 * A layout's start lane (spec.startLane): its pieces end to end in driving order, from the dead
 * end of the start straight to where it meets the lap.
 * @param build the venue at game scale
 * @param layout the layout raced
 * @returns the lane, or null when the layout starts on its lap
 */
export function venueStartLane(build: VenueBuild, layout: string): Lane | null {
  const start = build.spec.startLane;
  if (!start || start.layout !== layout) return null;
  // (the lane laid on back past the map's dead end first, where the venue lays one)
  const pts: [number, number][] = (start.back || [])
    .map(([x, y]) => [x * build.scale, y * build.scale]);
  for (const name of start.pieces) {
    const piece = build.pieces.find((entry) => entry.name === name);
    if (!piece) throw new Error(`venue: no start lane piece ${name}`);
    const last = pts[pts.length - 1];
    // each piece run on from the end of the one before
    const forward = !last || Math.hypot(piece.pts[0][0] - last[0], piece.pts[0][1] - last[1])
      <= Math.hypot(piece.pts.at(-1)![0] - last[0], piece.pts.at(-1)![1] - last[1]);
    const run = forward ? piece.pts : piece.pts.slice().reverse();
    pts.push(...(last ? run.slice(1) : run));
  }
  return { pts: heldApart(resample(pts, 2), build.loops[layout]), width: VENUE_ROAD_M,
    surface: SURFACES.racetarmac };
}

/**
 * A start lane held START_APART_M off the lap where it runs beside it, eased back onto the lap
 * over its last START_EASE_M (where it meets it), then smoothed.
 * @param pts the lane, its last point on the lap
 * @param own the lap
 * @returns the lane
 */
function heldApart(pts: Point[], own: Subtrack): Point[] {
  let toEnd = 0;
  const ease = pts.map((point, i) => {
    if (i) toEnd += Math.hypot(pts[pts.length - i][0] - pts[pts.length - i - 1][0],
      pts[pts.length - i][1] - pts[pts.length - i - 1][1]);
    const frac = Math.min(1, toEnd / START_EASE_M);
    return frac * frac * (3 - 2 * frac);
  }).reverse();
  const hold = (line: Point[]) => line.map(([x, y], i): Point => {
    const hit = querySubtrack(own, x, y), need = START_APART_M * ease[i];
    if (!(hit.dist < need)) return [x, y];
    const centre = centreAt(own, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
    return [centre.x + centre.nx * side * need, centre.y + centre.ny * side * need];
  });
  // held and eased in turn (a wide easing: a start straight, not a lane hugging the lap)
  let line = hold(pts);
  for (let round = 0; round < START_EASE_ROUNDS; round++)
    line = hold(smoothLine(line, START_EASE_REACH, 2));
  return smoothLine(line, 2, 2);
}

/**
 * The pole's spot on a start lane: the room behind it from its dead end (the grid behind it on
 * the lane), facing along it.
 * @param lane the start lane
 * @param roomM m of the lane behind the pole (GRID_ROOM_M when not given)
 * @returns the spot and its heading
 */
export function laneSpawn(lane: Lane, roomM = GRID_ROOM_M): { x: number; y: number; rot: number } {
  const { x, y, rot } = lanePole(lane, roomM);
  return { x, y, rot };
}

/**
 * The pole's spot on a start lane (roomM from its dead end) and the lane's point after it.
 * @param lane the start lane
 * @param roomM m of the lane behind the pole
 * @returns the spot, its heading and the index of the lane's next point
 */
function lanePole(lane: Lane, roomM: number): { x: number; y: number; rot: number; next: number } {
  let left = roomM;
  for (let i = 1; i < lane.pts.length; i++) {
    const [fromX, fromY] = lane.pts[i - 1], [toX, toY] = lane.pts[i];
    const len = Math.hypot(toX - fromX, toY - fromY);
    if (len >= left || i === lane.pts.length - 1) {
      const frac = Math.min(1, left / (len || 1));
      return { x: fromX + (toX - fromX) * frac, y: fromY + (toY - fromY) * frac,
        rot: Math.atan2(toY - fromY, toX - fromX), next: i };
    }
    left -= len;
  }
  return { x: lane.pts[0][0], y: lane.pts[0][1], rot: 0, next: 0 };
}

/**
 * The start lane's line behind the pole (Level.startLine: the grid stands along it, game/grid.ts):
 * from the pole back to the lane's dead end.
 * @param lane the start lane
 * @param roomM m of the lane behind the pole (GRID_ROOM_M when not given)
 * @returns the points, the pole's first
 */
export function laneBehindPole(lane: Lane, roomM = GRID_ROOM_M): Point[] {
  const pole = lanePole(lane, roomM);
  return [[pole.x, pole.y], ...lane.pts.slice(0, pole.next).reverse()];
}

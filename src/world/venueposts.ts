// world/venueposts.ts - WHAT STANDS BEHIND A VENUE'S EDGE (world/venueedge.ts builds the edge): a
// marshal post behind the Armco outside each corner, and the boards on the Armco (or a catch
// fence where no Armco is near), facing the track - and the start gantry across the road.
import { onTrack } from "./tyrewall.ts";
import { FIX } from "../core/fixes.ts";
import { HALF_ROAD, centreAt, distToLine, nearestLoop, roadDistance } from "./venuegeo.ts";
import { RIM_STEP_M, RUNOFF_M, awayFrom, pastRim } from "./venueedge.ts";
import { EDGE_TO_WALL } from "./venuepit.ts";
import { onLanes } from "./venuesite.ts";
import type { Rim } from "./venueedge.ts";
import type { Site } from "./venuesite.ts";
import type { Barrier, Cone, Point, Prop, Subtrack } from "./types.ts";

// m behind the Armco of a marshal post, and of a board (behind the catch fence too)
const MARSHAL_BACK_M = 3.2, BOARD_BACK_M = 3;
// m: half a board's face, how far it keeps from a barrier point or a tyre, how far along the
// rail a clear spot is looked for
const BOARD_HALF_M = 9, BOARD_GAP_M = 2.5, BOARD_LOOK_M = 80;

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
 * BOARD_LOOK_M, behind a catch fence (a spectator bank with no Armco near), else a wall.
 * @param barriers every barrier (the Armco and catch fences)
 * @param cones the tyre stacks
 * @param loops every layout's road
 * @param spot where the board should be
 * @param label its words
 * @param rims every layout road's rim
 * @param blocked true where a building stands (the board keeps off it)
 * @param back m behind the rail (an oval wall's boards stand past the run-off's rim beyond it)
 * @returns the board prop, or null with no clear spot within BOARD_LOOK_M
 */
export function boardOnArmco(barriers: Barrier[], cones: Cone[], loops: Subtrack[], spot: Point,
  label: string, rims: Rim[], blocked: (x: number, y: number) => boolean, back = BOARD_BACK_M):
  Prop | null {
  const railPts = (kind: Barrier['kind']) => barriers.filter((rail) => rail.kind === kind)
    .flatMap((rail) => rail.pts)
    .filter(([x, y]) => Math.hypot(x - spot[0], y - spot[1]) < BOARD_LOOK_M)
    .sort((first, second) => Math.hypot(first[0] - spot[0], first[1] - spot[1])
      - Math.hypot(second[0] - spot[0], second[1] - spot[1]));
  const near = barriers.flatMap((rail) => rail.pts);
  // (an oval's: none of either near, on its outside wall)
  const armco = railPts('armco'), fence = railPts('catchfence');
  for (const point of armco.length ? armco : fence.length ? fence : railPts('wall')) {
    const away = behindRail(point, loops, rims);
    const x = point[0] + away[0] * back, y = point[1] + away[1] * back;
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

// m behind the edge's rim the start gantry's leg stands where no pit wall is beside the start;
// m a leg's spot keeps off a lane's edge (its box 0.6 m either way, and a gap)
const LEG_BACK_M = 1, LEG_LANE_M = 1.5;

/**
 * The start gantry across the raced road at its start: a leg on the pit wall's line where the
 * wall stands beside the start (not in the pit lane), the other LEG_BACK_M behind the edge's rim
 * (where no lane runs there), the lights over the road's centre (podX). MEASURED
 * (tools/scratch/_startcrash.mjs, 20-car starts; owner 11-09 on Sillystone: "a lot of crashes"):
 * on the wall's line both sides, the far leg stood 1.9 m past the edge in the open run-off and
 * took the hardest hits of the starts, 31 m/s at Sillystone and 39 m/s at Oulton Pork.
 * @param site the venue's builders' state
 * @param sub the raced road
 * @param pitWalls the pit walls
 * @returns the gantry
 */
export function startGantry(site: Site, sub: Subtrack, pitWalls: Barrier[]): Prop {
  const start = onTrack(sub, 2, 0, {}), onWall = HALF_ROAD + EDGE_TO_WALL;
  const gantry = { kind: 'gantry', x: start.x, y: start.y, wid: 2 * onWall,
    rot: start.rot + Math.PI / 2 };
  // (the gantry's own across: its rot a quarter turn on from the road's, toward the left normal)
  const acrossX = Math.cos(gantry.rot), acrossY = Math.sin(gantry.rot);
  const spot = (out: number): Point => [start.x + acrossX * out, start.y + acrossY * out];
  const legOut = (side: number) => {
    for (let out = HALF_ROAD; out <= HALF_ROAD + RUNOFF_M + 1; out += 0.25) {
      const [x, y] = spot(side * out);
      if (pitWalls.some((wall) => distToLine(wall.pts, x, y) < 0.2)) return out;
    }
    // (none there: behind the rim - unless a lane runs there, the pit lane beside the start with
    // no wall by it, then between the road and the lane, as before)
    for (let out = HALF_ROAD; out < HALF_ROAD + 40; out += 0.25) {
      const [x, y] = spot(side * out);
      // (?clearance=1: another road first - the Club's start beside Mansfield at Cadwallop - the
      // leg stays this side of it, on the old spot)
      // (past the old spot any road this near is another stretch's)
      if (FIX.clearance && out > onWall
        && nearestLoop(site.loops, x, y).hit.dist < HALF_ROAD + LEG_LANE_M) return onWall;
      if (pastRim(site.rims, x, y) >= LEG_BACK_M)
        return onLanes(site.lanes, x, y, LEG_LANE_M) ? onWall : out;
    }
    return onWall;
  };
  const left = legOut(1), right = legOut(-1), shift = (left - right) / 2;
  const [x, y] = spot(shift);
  return { ...gantry, x, y, wid: left + right, podX: -shift };
}

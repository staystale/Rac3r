// THE ROAD'S STREET LIGHTS: the endless highway lit as a motorway is, a street light
// every LAMP_GAP_M along the road on ALTERNATING sides (owner: not paired), each post
// STREET_OUT_M off the road edge (behind the armco or the wall) with its arm out over the edge.
// Laid with the rest of the scenery as the road grows (highway/dress.js) and dropped behind with
// it (highway.js keeps level.lamps by road distance); world/lamps.ts makes each entry a lamp
// (solid, knockable, lit from dusk) and keeps it, damage and all, while it is loaded. A spot
// that is not clear (a slip road, a bridge, a river, a gantry leg, a sign) is left dark.
import { solidsFromProps } from '../world/barriers.ts';
import type { Level, Prop } from '../world/types.ts';
import { blocked } from './cuts.js';
import { STEP } from './presets.js';

// the gap from one street light to the next, m (the sides alternate: each side every 68 m); the
// circuits' start-straight spacing
const LAMP_GAP_M = 34;
// how far out from the road edge a post stands, m (as on the circuits)
const STREET_OUT_M = 2.5;
// a post's clearance from the road's points and keep-out areas, and from scenery solids, m
const ROAD_CLEAR_M = 1, SOLID_CLEAR_M = 1.5;
// scenery this far along the road either way is checked for a post's spot, m; and the road
// points either side of the post's own that it must be clear of (60 x 4 m: as the dress context)
const NEAR_ALONG_M = 40, NEAR_POINTS = 60;

/** The parts of highway/dress.js's dress context the lamps use. */
interface DressContext {
  level: Level & { lamps: Prop[]; props: Prop[] };
  state: { keep: object[] };
  halfWidth: number;
  road: { x: number; y: number; s: number; sideOff?: number }[];
  firstIdx: number;
  endIdx: number;
  pointAt: (i: number, off: number) => { x: number; y: number; rot: number };
}

/**
 * Whether a post's spot is off the road everywhere near (a tight bend brings the road's other
 * points closer than its own). The dress context's `clear` is not used: it keeps everything off
 * a circle as wide as the side road's offset, so it would leave the right side dark wherever the
 * side road runs along the left.
 * @param ctx the dress context
 * @param index the road point the post stands beside
 * @param x the post's foot, m
 * @param y the post's foot, m
 * @returns true when clear
 */
function isClearOfRoad(ctx: DressContext, index: number, x: number, y: number): boolean {
  const { road, halfWidth } = ctx, reach2 = (halfWidth + ROAD_CLEAR_M) ** 2;
  const first = Math.max(0, index - NEAR_POINTS), end = Math.min(road.length, index + NEAR_POINTS);
  for (let j = first; j < end; j++) {
    if ((road[j].x - x) ** 2 + (road[j].y - y) ** 2 < reach2) return false;
  }
  return true;
}

/**
 * Whether a post's spot is clear of the scenery solids laid near it (gantry legs, signs, rocks,
 * bridges, buildings).
 * @param props the level's props
 * @param dist the road distance of the spot, m
 * @param x the post's foot, m
 * @param y the post's foot, m
 * @returns true when clear
 */
function isClearOfScenery(props: Prop[], dist: number, x: number, y: number): boolean {
  const nearProps = props.filter((prop) => prop._s != null
    && Math.abs(prop._s - dist) < NEAR_ALONG_M);
  return solidsFromProps(nearProps).every((solid) =>
    Math.hypot(solid.x - x, solid.y - y) >= (solid.r || 0) + SOLID_CLEAR_M);
}

/**
 * Lays the street lights for road points [firstIdx, endIdx): one each time the road passes a
 * multiple of LAMP_GAP_M, on the side that multiple's parity gives (the same spots on every
 * build of the same seed), its arm toward the road.
 * @param ctx the dress context
 */
export function layRoadLamps(ctx: DressContext): void {
  const { level, state, road, firstIdx, endIdx, pointAt, halfWidth } = ctx;
  for (let i = firstIdx; i < endIdx; i++) {
    const dist = road[i].s, count = Math.floor(dist / LAMP_GAP_M);
    if (count === Math.floor((dist - STEP) / LAMP_GAP_M)) continue;
    const side = count % 2 ? 1 : -1, off = side * (halfWidth + STREET_OUT_M);
    // the side road runs along the left here
    if (road[i].sideOff && side < 0) continue;
    const pos = pointAt(i, off);
    if (!isClearOfRoad(ctx, i, pos.x, pos.y) || blocked(state.keep, pos.x, pos.y, ROAD_CLEAR_M))
      continue;
    if (!isClearOfScenery(level.props, dist, pos.x, pos.y)) continue;
    // the arm reaches back across the post's offset, toward the road
    const armX = side * Math.sin(pos.rot), armY = -side * Math.cos(pos.rot);
    level.lamps.push({ kind: 'streetlight', x: pos.x, y: pos.y, rot: Math.atan2(armY, armX),
      _s: dist });
  }
}

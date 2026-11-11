// highway/junctions.ts - A MOTORWAY JUNCTION (owner 11-11: exits leading up to the
// bridges, "Roundabouts", "A few"): now and then a drivable road bridge (highway/extras.ts
// buildBridge) is a dumbbell junction. An off-slip leaves the left edge LEAD_POINTS before the
// bridge and climbs to a small roundabout on the bridge's road past its left ramp; an on-slip
// leaves that roundabout and joins the motorway LEAD_POINTS after the bridge; a second roundabout
// sits past the far ramp. The bridge's road runs on from both into the country (the off-road
// guard's EXIT TAKEN past them, as a slip road's). All of it is lanes on the ground (tarmac, as
// the slips): the drivable deck is the bridge's own crossing.
import { SURFACES } from '../world/surfaces.ts';
import { FIX } from '../core/fixes.ts';
import { blocked, keepOut } from './cuts.ts';
import { RING_LANE_M, RING_OUTER_M, RING_R, ringCentre } from './ringgeo.ts';
import type { Lane, Point, Prop } from '../world/types.ts';
import type { HwLevel, HwPose, KeepRect } from './hwtypes.ts';

// road points from the off-slip's start to the bridge and from the bridge to the on-slip's end
// (4 m apart: 120 m - room to climb to the ring and to come down)
export const LEAD_POINTS = 30;
// the share of road bridges that are junctions ("A few")
export const JUNCTION_SHARE = 0.25;
// m: a slip's width (the existing slips' SLIP_W), how far inside the motorway's edge it starts
// (its round end under the motorway's ribbon, as the slips), its curve's samples, and the share of
// the chord its ends run straight on along their headings
const SLIP_WIDTH_M = 6, SLIP_INSIDE_M = 2.6, CURVE_SAMPLES = 24, HANDLE_SHARE = 0.4;
// samples of a ring's lane; samples of a slip between keep-out boxes; m a box reaches past a slip
const RING_SAMPLES = 32, KEEP_EVERY = 4, KEEP_PAD_M = 3;

/** Where the road is at an index and an offset (highway/dress.ts pointAt). */
type PointAt = (i: number, off: number) => HwPose;

/**
 * A cubic curve's points, from a start along its heading to an end arriving along its heading.
 * @param start the start point
 * @param startDir the start's heading, unit
 * @param end the end point
 * @param endDir the heading it arrives along, unit
 * @returns the samples, start to end
 */
function curveBetween(start: Point, startDir: Point, end: Point, endDir: Point): Point[] {
  const reach = Math.hypot(end[0] - start[0], end[1] - start[1]) * HANDLE_SHARE;
  const first: Point = [start[0] + startDir[0] * reach, start[1] + startDir[1] * reach];
  const second: Point = [end[0] - endDir[0] * reach, end[1] - endDir[1] * reach];
  const pts: Point[] = [];
  for (let step = 0; step <= CURVE_SAMPLES; step++) {
    const share = step / CURVE_SAMPLES, rest = 1 - share;
    const weights = [rest ** 3, 3 * rest * rest * share, 3 * rest * share * share, share ** 3];
    const mix = (axis: number) => weights[0] * start[axis] + weights[1] * first[axis]
      + weights[2] * second[axis] + weights[3] * end[axis];
    pts.push([mix(0), mix(1)]);
  }
  return pts;
}

/**
 * Keeps the scenery off a slip: a box over each few samples of it.
 * @param level the highway level
 * @param pts the slip's centre line
 * @param dist the road distance it belongs to, m
 */
function keepOffSlip(level: HwLevel, pts: Point[], dist: number) {
  for (let i = 0; i + KEEP_EVERY <= pts.length - 1; i += KEEP_EVERY) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + KEEP_EVERY];
    const length = Math.hypot(toX - fromX, toY - fromY) || 1;
    keepOut(level, { x: (fromX + toX) / 2, y: (fromY + toY) / 2, ax: (toX - fromX) / length,
      ay: (toY - fromY) / length, hu: length / 2 + KEEP_PAD_M,
      hv: SLIP_WIDTH_M / 2 + KEEP_PAD_M }, dist);
  }
}

/**
 * A roundabout: its ring lane round the centre (the island the ground inside it), the scenery
 * kept off it.
 * @param level the highway level
 * @param centre its centre, world m
 * @param dist the road distance it belongs to, m
 */
function layRing(level: HwLevel, centre: Point, dist: number) {
  const pts: Point[] = [];
  for (let step = 0; step <= RING_SAMPLES; step++) {
    const angle = (step / RING_SAMPLES) * 2 * Math.PI;
    pts.push([centre[0] + Math.cos(angle) * RING_R, centre[1] + Math.sin(angle) * RING_R]);
  }
  level.lanes.push({ pts, width: RING_LANE_M, surface: SURFACES.tarmac, _s: dist } as Lane);
  keepOut(level, { x: centre[0], y: centre[1], ax: 1, ay: 0, hu: RING_OUTER_M + KEEP_PAD_M,
    hv: RING_OUTER_M + KEEP_PAD_M }, dist);
}

/**
 * A slip lane along its centre line, the scenery kept off it.
 * @param level the highway level
 * @param pts its centre line
 * @param dist the road distance it belongs to, m
 */
function laySlip(level: HwLevel, pts: Point[], dist: number) {
  level.lanes.push({ pts, width: SLIP_WIDTH_M, surface: SURFACES.tarmac, _s: dist } as Lane);
  keepOffSlip(level, pts, dist);
}

/**
 * Lays a junction round a bridge already built at road point `bridgeIdx`: the off-slip from point
 * `fromIdx` up to the near (left) roundabout, the on-slip from it down to `bridgeIdx +
 * LEAD_POINTS`, both roundabouts, and the left verge opened where the slips leave and join.
 * @param level the highway level
 * @param fromIdx the road point the off-slip leaves at
 * @param bridge the bridge (its rings: the approaches part round them)
 * @param bridgeIdx the bridge's road point
 * @param pointAt where the road is at an index and an offset
 */
export function layJunction(level: HwLevel, fromIdx: number, bridge: Prop, bridgeIdx: number,
  pointAt: PointAt) {
  const state = level._hw, road = state.pts, halfWidth = state.geo.hw;
  const dist = road[fromIdx].s, toIdx = bridgeIdx + LEAD_POINTS;
  const near = ringCentre(bridge, -1), far = ringCentre(bridge, 1);
  const headingOf = (index: number): Point => {
    const rot = pointAt(index, 0).rot;
    return [Math.cos(rot), Math.sin(rot)];
  };
  const along = headingOf(bridgeIdx);
  const start = pointAt(Math.max(0, fromIdx - 3), -(halfWidth - SLIP_INSIDE_M));
  const end = pointAt(toIdx, -(halfWidth - SLIP_INSIDE_M));
  // into the ring at its back (the motorway's way behind), out of it at its front
  const entry: Point = [near[0] - along[0] * RING_R, near[1] - along[1] * RING_R];
  const exit: Point = [near[0] + along[0] * RING_R, near[1] + along[1] * RING_R];
  laySlip(level, curveBetween([start.x, start.y], headingOf(fromIdx), entry, along), dist);
  laySlip(level, curveBetween(exit, along, [end.x, end.y], headingOf(toIdx)), dist);
  layRing(level, near, dist);
  layRing(level, far, dist);
  // the left verge open where the slips leave and join (the Armco and the walled road's wall
  // break there: highway/dress.ts)
  // (?roadparity=1: Deaf Valley's rock walls open along all of it, both sides - its rings stand
  // where the rock's band would, canyon.ts; MEASURED _junctiondrive.mjs: with the right wall open
  // only at the bridge a car on the far ring met the rock)
  const isOpenAlong = FIX.roadparity && !!state.desert;
  for (let j = Math.max(0, fromIdx - 4); j < Math.min(road.length, toIdx + 4); j++) {
    if (isOpenAlong || j < fromIdx + 12 || j >= toIdx - 12) road[j].gapL = 1;
    if (isOpenAlong) road[j].gapR = 1;
  }
  clearJunctionGround(level, state.keep.filter((rect) => rect._s === dist
    || rect._s === road[bridgeIdx].s));
}
// m what stood there keeps off a junction's lanes (a street light's post and arm, a prop's body,
// a loose object)
const CLEAR_M = 1.5;
// what a junction laid there itself, kept
const OWN_KINDS = new Set(['bridge', 'slipcount', 'board']);

/**
 * Clears the road already dressed under a junction (it is laid back over it): the street lights,
 * the props (the keep-out boxes took only trees, rocks and fields - cuts.ts keepOut) and the loose
 * objects not yet handed to the game.
 * @param level the highway level
 * @param mine the junction's keep-out boxes
 */
function clearJunctionGround(level: HwLevel, mine: KeepRect[]) {
  const isClear = (spot: { x: number; y: number }) => !blocked(mine, spot.x, spot.y, CLEAR_M);
  // (a prop by its body: half its size, `s` - a butte's is 10-20 m)
  const isPropClear = (prop: Prop) => !blocked(mine, prop.x, prop.y, CLEAR_M
    + (prop.s || 0) / 2);
  const keepOnly = <T extends { x: number; y: number }>(list: T[] | undefined,
    keep: (item: T) => boolean) => {
    if (!list) return;
    const kept = list.filter(keep);
    list.length = 0;
    list.push(...kept);
  };
  keepOnly(level.lamps, isClear);
  keepOnly(level.props, (prop) => OWN_KINDS.has(prop.kind) || isPropClear(prop));
  keepOnly(level._hw.looseNew, isClear);
  keepOnly(level.cones, isClear);
  // (and those already handed to the game: game/sim.ts culls them)
  (level._hw.clearedGround ||= []).push(...mine);
}

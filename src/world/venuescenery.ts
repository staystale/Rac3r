// world/venuescenery.ts - A VENUE'S SCENERY, the same for every layout (world/venue.ts): from the
// real map at game scale - the pit lane, wall and garages, service roads, bridges over the track,
// gravel traps (each where the real one is, at its depth, with Armco and two rows of tyres behind
// it), catch fences, grandstands, buildings, paddocks with their trucks, the kart track and rally
// stages, woods, marshal posts and boards. Anything that would land on a road is moved off or left
// out (VENUE_DROPPED lists what was left out, for the tools).
import { alongTrack } from "./barriers.ts";
import { SURFACES } from "./surfaces.ts";
import { onTrack, querySubtrack } from "./tyrewall.ts";
import { parkMiller } from "../core/random.ts";
import type { VenueBox, VenueBuild } from "./venue.ts";
import type { Barrier, Cone, Lane, Point, Prop, Subtrack, Zone } from "./types.ts";

/** What buildVenueScenery returns: everything but the raced road. */
export interface VenueScenery {
  lanes: Lane[]; zones: Zone[]; cones: Cone[]; barriers: Barrier[]; props: Prop[];
  bounds: { x0: number; y0: number; x1: number; y1: number };
}

// m: the game's road on every circuit
export const VENUE_ROAD_M = 13;
// what the footprint check left out, per venue (tools read it)
export const VENUE_DROPPED: Record<string, string[]> = {};
const HALF_ROAD = VENUE_ROAD_M / 2;
// m (game) from a venue road beyond which nothing of the map is taken: the venue's reach
const REACH_M = 130;
// m: the pit lane's width, the wall's gap from it, and where it may meet the track (its ends)
// (the wall stands EDGE_TO_WALL past the road's edge, as the old Brands pit wall did, the lane just
// behind it)
const PIT_W = 9, PIT_WALL_GAP = 0.6, PIT_MERGE_M = 30, EDGE_TO_WALL = 3;
// m: a trap starts at least this far past the road's edge (the kerb and a strip of grass)
const TRAP_EDGE_M = 1.5;
// m (game) from the road's centre beyond which a mapped trap's outline is not counted
const TRAP_MAX_M = 60;
// m (game): a gravel trap's Armco stands this far behind it, its two tyre rows in front of that
const TRAP_ARMCO_M = 2.5, TRAP_TYRE_ROWS: [number, number][] = [[1.1, 0], [0.15, 0.475]];
// m: a piece of service road shorter than this once cut clear of the track is left out (a stub)
const MIN_ROAD_M = 30;
// m a prop touching a road is moved away from it per try, and the tries before it is left out
const NUDGE_STEP_M = 2, NUDGE_TRIES = 8;
// m: the garages' front stands at least this far behind the pit lane's edge
const GARAGE_GAP_M = 1.5;
// trees: how many at most, and the share of tries kept outside the woods
const MAX_TREES = 260, OPEN_TREE_SHARE = 0.06;
// building kinds that are homes, sheds and farm buildings (the venue's neighbours, not its own)
const NOT_VENUE = new Set(['house', 'residential', 'garage', 'barn', 'silo', 'shed', 'farm',
  'detached', 'semidetached_house', 'terrace', 'hotel', 'greenhouse']);
const ROOFS = ['#5b626b', '#6b6158', '#596372', '#6e6e66'];
const TRUCK_COLS = ['#c8302c', '#2b56b5', '#e2c13a', '#2e8b57'];

/** The venue roads, for "is this near a road" questions. */
interface RoadTest { near: (x: number, y: number, pad: number) => boolean; loops: Subtrack[] }

const scalePts = (pts: Point[], scale: number): Point[] =>
  pts.map(([x, y]) => [x * scale, y * scale] as Point);

/**
 * The nearest of the venue's layout roads to a point.
 * @param loops every layout's road
 * @param x world x
 * @param y world y
 * @returns that road and the hit (dist = metres from its centreline)
 */
function nearestLoop(loops: Subtrack[], x: number, y: number) {
  let best = { sub: loops[0], hit: querySubtrack(loops[0], x, y) };
  for (const sub of loops.slice(1)) {
    const hit = querySubtrack(sub, x, y);
    if (hit.dist < best.hit.dist) best = { sub, hit };
  }
  return best;
}

/**
 * Whether a point is within pad of a lane (beyond its half width).
 * @param lanes the lanes
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when on or near one
 */
function nearLane(lanes: Lane[], x: number, y: number, pad: number): boolean {
  for (const lane of lanes) {
    const reach = lane.width / 2 + pad;
    for (let i = 0; i < lane.pts.length - 1; i++) {
      const [fromX, fromY] = lane.pts[i], [toX, toY] = lane.pts[i + 1];
      const dx = toX - fromX, dy = toY - fromY, lenSq = dx * dx + dy * dy || 1e-9;
      const frac = Math.max(0, Math.min(1, ((x - fromX) * dx + (y - fromY) * dy) / lenSq));
      if ((x - fromX - dx * frac) ** 2 + (y - fromY - dy * frac) ** 2 <= reach * reach) return true;
    }
  }
  return false;
}

/**
 * Splits a line into the runs that stay clear of the roads.
 * @param pts the line
 * @param clear true where a point may stand
 * @param stepM resample spacing in metres
 * @returns the clear runs (2+ points each)
 */
function clearRuns(pts: Point[], clear: (x: number, y: number) => boolean, stepM = 2): Point[][] {
  const runs: Point[][] = [];
  let run: Point[] = [];
  for (const point of resample(pts, stepM)) {
    if (clear(point[0], point[1])) run.push(point);
    else {
      if (run.length > 1) runs.push(run);
      run = [];
    }
  }
  if (run.length > 1) runs.push(run);
  return runs;
}

/**
 * A line resampled every stepM metres (its corners kept).
 * @param pts the line
 * @param stepM metres between points
 * @returns the points
 */
function resample(pts: Point[], stepM: number): Point[] {
  const out: Point[] = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1];
    const count = Math.max(1, Math.ceil(Math.hypot(toX - fromX, toY - fromY) / stepM));
    for (let part = 1; part <= count; part++)
      out.push([fromX + (toX - fromX) * part / count, fromY + (toY - fromY) * part / count]);
  }
  return out;
}

/**
 * Whether a point lies inside a polygon.
 * @param poly the polygon's points
 * @param x world x
 * @param y world y
 * @returns true inside
 */
function insidePoly(poly: Point[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [thisX, thisY] = poly[i], [prevX, prevY] = poly[j];
    if ((thisY > y) !== (prevY > y)
      && x < (prevX - thisX) * (y - thisY) / (prevY - thisY) + thisX) inside = !inside;
  }
  return inside;
}

/**
 * The pit lane at game scale, pushed off the track where the 13 m road would reach it (the real
 * road is narrower), and the pit wall along its track side.
 * @param build the venue at game scale
 * @param loops every layout's road
 * @returns the lane and the wall
 */
function pitLane(build: VenueBuild, loops: Subtrack[]): { lane: Lane; wall: Barrier | null } {
  const data = build.spec.data.pitLanes.find((entry) => entry.name === build.spec.pitLane);
  if (!data) throw new Error(`venue: no pit lane ${build.spec.pitLane}`);
  const pts = resample(scalePts(data.pts, build.scale), 2);
  const need = HALF_ROAD + EDGE_TO_WALL + PIT_WALL_GAP + PIT_W / 2;
  const total = pts.length * 2;
  // where the lane runs alongside the road (not its two merges): the wall's stretch
  const alongside: { sub: Subtrack; dist: number; side: number }[] = [];
  const moved = pts.map(([x, y], i) => {
    const { sub, hit } = nearestLoop(loops, x, y);
    const fromEnd = Math.min(i, pts.length - 1 - i) * 2;
    if (fromEnd < PIT_MERGE_M || total < 2 * PIT_MERGE_M) return [x, y];
    alongside.push({ sub, dist: hit.trackDist, side: hit.side === 'left' ? 1 : -1 });
    if (hit.dist >= need) return [x, y];
    const centre = onTrack(sub, hit.trackDist, 0, {});
    const awayX = (x - centre.x) / (hit.dist || 1), awayY = (y - centre.y) / (hit.dist || 1);
    return [centre.x + awayX * need, centre.y + awayY * need];
  }) as Point[];
  return { lane: { pts: moved, width: PIT_W, surface: SURFACES.concrete },
    wall: pitWall(alongside) };
}

/**
 * The pit wall: parallel to the road, EDGE_TO_WALL past its edge on the pit side, over the
 * stretch the pit lane runs alongside (trimmed at each end so it never meets the lane's merge).
 * @param alongside the road distance and side of each pit-lane point beside the road, in order
 * @returns the wall, or null if the lane never runs alongside
 */
function pitWall(alongside: { sub: Subtrack; dist: number; side: number }[]): Barrier | null {
  if (alongside.length < 8) return null;
  const sub = alongside[0].sub, trim = 6;
  const sides = alongside.reduce((sum, spot) => sum + spot.side, 0);
  const from = alongside[0].dist + trim, end = alongside.at(-1)!.dist - trim;
  const offset = Math.sign(sides || 1) * (HALF_ROAD + EDGE_TO_WALL);
  return { kind: 'pitwall', pts: alongTrack(sub, from, end, offset, 2) };
}

/**
 * The service roads, rally stages and kart track as lanes (clear of the race roads; real widths),
 * and the bridges where a road or a footpath crosses a race road.
 * @param build the venue at game scale
 * @param roads the road test
 * @returns lanes and bridge props
 */
function venueRoads(build: VenueBuild, roads: RoadTest): { lanes: Lane[]; props: Prop[] } {
  const data = build.spec.data, scale = build.scale, lanes: Lane[] = [], props: Prop[] = [];
  const addLanes = (pts: Point[], width: number, surface: Lane['surface']) => {
    const clear = (x: number, y: number) => !nearRace(roads.loops, x, y, width / 2 + 1)
      && nearRace(roads.loops, x, y, REACH_M) && !roads.near(x, y, width / 2);
    for (const run of clearRuns(scalePts(pts, scale), clear))
      if (run.length * 2 >= MIN_ROAD_M) lanes.push({ pts: run, width, surface });
  };
  for (const road of data.roads) {
    if (road.bridge) bridgeOver(build, roads, road.pts, 'bridge', props);
    else addLanes(road.pts, road.width, road.kind === 'track' ? SURFACES.dirt : SURFACES.tarmac);
  }
  for (const path of data.footbridges) bridgeOver(build, roads, path.pts, 'footbridge', props);
  for (const stage of data.dirt) addLanes(stage.pts, 5, SURFACES.dirt);
  for (const kart of data.karting) addLanes(kart.pts, 7, SURFACES.tarmac);
  return { lanes, props };
}

/**
 * Whether a point is within pad of any race road's edge... measured from the centreline: within
 * half the road + pad.
 * @param loops every layout's road
 * @param x world x
 * @param y world y
 * @param pad metres past the road's half width
 * @returns true when that near
 */
function nearRace(loops: Subtrack[], x: number, y: number, pad: number): boolean {
  return nearestLoop(loops, x, y).hit.dist < HALF_ROAD + pad;
}

/**
 * A bridge prop where a mapped bridge crosses a race road (none if it does not).
 * @param build the venue at game scale
 * @param roads the road test
 * @param pts the bridge's line, real metres
 * @param kind 'bridge' (a road) or 'footbridge'
 * @param props props, appended to
 */
function bridgeOver(build: VenueBuild, roads: RoadTest, pts: Point[], kind: string,
  props: Prop[]): void {
  const line = scalePts(pts, build.scale);
  let best: { sub: Subtrack; dist: number; trackDist: number } | null = null;
  for (const [x, y] of resample(line, 1)) {
    const { sub, hit } = nearestLoop(roads.loops, x, y);
    if (!best || hit.dist < best.dist) best = { sub, dist: hit.dist, trackDist: hit.trackDist };
  }
  if (!best || best.dist > HALF_ROAD) return;
  const spot = onTrack(best.sub, best.trackDist, 0, {});
  const label = kind === 'footbridge' ? build.spec.bridgeLabel : undefined;
  props.push({ kind, x: spot.x, y: spot.y, rot: spot.rot + Math.PI / 2, wid: VENUE_ROAD_M + 20,
    seed: Math.round(spot.x), ...(label ? { label } : {}),
    ...(kind === 'bridge' ? { carries: 'road', quiet: true } : {}) } as Prop);
}

/**
 * The gravel traps where the real ones are: each mapped trap becomes a ribbon along the road it
 * sits beside, from its first to its last metre along that road and from its inner to its outer
 * edge (never nearer the road than the kerb and TRAP_EDGE_M of grass), with Armco and two rows of
 * tyres behind it.
 * @param build the venue at game scale
 * @param roads the road test
 * @returns trap lanes, the Armco and the tyre stacks
 */
function venueTraps(build: VenueBuild, roads: RoadTest):
  { lanes: Lane[]; barriers: Barrier[]; cones: Cone[] } {
  const lanes: Lane[] = [], barriers: Barrier[] = [], cones: Cone[] = [];
  for (const trap of build.spec.data.traps) {
    const fit = fitTrap(scalePts(trap.pts, build.scale), roads.loops);
    if (!fit) continue;
    const { sub, side, d0, d1, inner, outer } = fit;
    lanes.push({ out: side, pts: alongTrack(sub, d0, d1, side * (inner + outer) / 2, 2),
      width: outer - inner, surface: SURFACES.gravel, d0, d1 } as Lane);
    const behind = side * (outer + TRAP_ARMCO_M);
    const clear = (x: number, y: number) => !nearRace(roads.loops, x, y, 4)
      && !roads.near(x, y, 0.6);
    for (const run of clearRuns(alongTrack(sub, d0, d1, behind, 2), clear))
      barriers.push({ kind: 'armco', pts: run });
    for (const [back, shift] of TRAP_TYRE_ROWS)
      for (const [x, y] of alongTrack(sub, d0 + shift, d1, side * (outer + back), 0.95))
        if (clear(x, y)) cones.push({ x, y, kind: 'tyrestack' });
  }
  return { lanes, barriers, cones };
}

/**
 * Where a mapped trap lies along the road nearest it.
 * @param poly the trap's outline at game scale
 * @param loops every layout's road
 * @returns its road, side (+1 = the road's left), distances along it and edges from its centre
 */
function fitTrap(poly: Point[], loops: Subtrack[]) {
  const pts = resample(poly, 2);
  // the road most of the trap is nearest (a point past the road's lookup grid reads Infinity)
  const votes = new Map<Subtrack, number>();
  for (const [x, y] of pts) {
    const { sub: near, hit } = nearestLoop(loops, x, y);
    if (Number.isFinite(hit.dist)) votes.set(near, (votes.get(near) || 0) + 1);
  }
  if (!votes.size) return null;
  const sub = [...votes.entries()].sort((first, second) => second[1] - first[1])[0][0];
  const hits = pts.map(([x, y]) => querySubtrack(sub, x, y))
    .filter((hit) => Number.isFinite(hit.dist) && hit.dist < TRAP_MAX_M);
  if (hits.length < 3) return null;
  const lefts = hits.filter((hit) => hit.side === 'left').length;
  const side = lefts * 2 >= hits.length ? 1 : -1;
  const along = hits.map((hit) => hit.trackDist);
  // a trap across the start line: count its early part past the end
  if (Math.max(...along) - Math.min(...along) > sub.totalDist / 2)
    for (let i = 0; i < along.length; i++)
      if (along[i] < sub.totalDist / 2) along[i] += sub.totalDist;
  const offs = hits.map((hit) => hit.dist);
  const inner = Math.max(Math.min(...offs), HALF_ROAD + 2.4 + TRAP_EDGE_M);
  const outer = Math.max(...offs);
  if (outer - inner < 3) return null;
  return { sub, side, d0: Math.min(...along), d1: Math.max(...along), inner, outer };
}

/**
 * The mapped fences, walls and rails, kept off every road.
 * @param build the venue at game scale
 * @param roads the road test
 * @returns the barriers
 */
function venueFences(build: VenueBuild, roads: RoadTest): Barrier[] {
  const data = build.spec.data, out: Barrier[] = [];
  const clear = (x: number, y: number) => !nearRace(roads.loops, x, y, 3)
    && nearRace(roads.loops, x, y, REACH_M) && !roads.near(x, y, 0.8);
  const lines: [Barrier['kind'], Point[]][] = [
    ...data.fences.map((fence) => [fence.kind === 'wall' ? 'wall' : 'fence', fence.pts]),
    ...data.rails.map((rail) => ['armco', rail.pts]),
  ] as [Barrier['kind'], Point[]][];
  for (const [kind, pts] of lines)
    for (const run of clearRuns(scalePts(pts, build.scale), clear)) out.push({ kind, pts: run });
  return out;
}

/**
 * A mapped box at game scale, as a prop of a kind.
 * @param box the box (real m)
 * @param scale game m per real m
 * @param kind the prop kind
 * @returns the prop
 */
function boxProp(box: VenueBox, scale: number, kind: string): Prop {
  return { kind, x: box.x * scale, y: box.y * scale, w: box.w * scale, h: box.h * scale,
    rot: box.rot };
}

/**
 * The venue's own buildings (not the neighbours' homes): the pit garages as a garage row facing
 * the pit lane, grandstands, and every other building as a flat-roofed block.
 * @param build the venue at game scale
 * @param pit the pit lane
 * @param roads the road test
 * @returns the props
 */
function venueBuildings(build: VenueBuild, pit: Lane, roads: RoadTest): Prop[] {
  const data = build.spec.data, scale = build.scale, props: Prop[] = [];
  const homes = data.homes.map((home) => scalePts(home.pts, scale));
  for (const stand of data.stands) props.push(boxProp(stand, scale, 'grandstand'));
  data.buildings.forEach((building, i) => {
    const prop = boxProp(building, scale, 'block');
    if (!nearRace(roads.loops, prop.x, prop.y, REACH_M)) return;
    if (/pit garages/i.test(building.name)) { props.push(garageRow(prop, pit)); return; }
    if (NOT_VENUE.has(building.kind) || homes.some((home) => insidePoly(home, prop.x, prop.y)))
      return;
    if (!building.name && prop.w! * prop.h! < 40) return;
    props.push({ ...prop, roof: ROOFS[i % ROOFS.length] });
  });
  return props;
}

/**
 * How far a point is from a line's nearest segment.
 * @param pts the line
 * @param x world x
 * @param y world y
 * @returns metres
 */
function distToLine(pts: Point[], x: number, y: number): number {
  let best = Infinity;
  for (let i = 0; i < pts.length - 1; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1];
    const dx = toX - fromX, dy = toY - fromY, lenSq = dx * dx + dy * dy || 1e-9;
    const frac = Math.max(0, Math.min(1, ((x - fromX) * dx + (y - fromY) * dy) / lenSq));
    best = Math.min(best, Math.hypot(x - fromX - dx * frac, y - fromY - dy * frac));
  }
  return best;
}

/**
 * The pit garages as a garage row: its long side nearer the pit lane is the front, moved back
 * if it would stand on the lane (the lane is pushed out for the game's wider road).
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
  // sign: which side (-h/2 or +h/2) faces the lane
  const sign = mean(edge(0, -halfH)) <= mean(edge(0, halfH)) ? -1 : 1;
  // step back until the whole front clears the lane (the lane is not straight beside it)
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

/**
 * The paddocks (tarmac ones as zones) and the race trucks parked in them.
 * @param build the venue at game scale
 * @param rnd the venue's dice
 * @returns zones and truck props
 */
function venuePaddocks(build: VenueBuild, rnd: () => number): { zones: Zone[]; props: Prop[] } {
  const zones: Zone[] = [], props: Prop[] = [];
  for (const paddock of build.spec.data.paddocks) {
    const paved = /paddock/i.test(paddock.name) || /asphalt|paved|concrete/.test(paddock.surface);
    if (!paved) continue;
    const box = boxProp(paddock, build.scale, 'zone');
    zones.push({ x: box.x, y: box.y, w: box.w!, h: box.h!, rot: box.rot,
      surface: SURFACES.tarmac });
    const trucks = Math.min(6, Math.floor(box.w! * box.h! / 900));
    for (let i = 0; i < trucks; i++) {
      const along = (rnd() - 0.5) * (box.w! - 16), across = (rnd() - 0.5) * (box.h! - 6);
      const cosR = Math.cos(box.rot!), sinR = Math.sin(box.rot!);
      props.push({ kind: 'truck', x: box.x + cosR * along - sinR * across,
        y: box.y + sinR * along + cosR * across, rot: box.rot! + 0.1,
        col: TRUCK_COLS[props.length % TRUCK_COLS.length] });
    }
  }
  return { zones, props };
}

/**
 * Marshal posts outside the corners of every layout (one where two layouts share a corner), the
 * start gantry and the boards.
 * @param build the venue at game scale
 * @param sub the raced road
 * @returns the props
 */
function trackside(build: VenueBuild, sub: Subtrack): Prop[] {
  const props: Prop[] = [];
  const start = onTrack(sub, 2, 0, {});
  props.push({ kind: 'gantry', x: start.x, y: start.y, wid: 24, rot: start.rot + Math.PI / 2 });
  for (const loop of Object.values(build.loops))
    for (const kerb of loop.curvedKerbs) {
      if (kerb.side !== 'left' && kerb.side !== 'right') continue;
      const off = (kerb.side === 'left' ? -1 : 1) * -(HALF_ROAD + 30);
      const spot = onTrack(loop, (kerb.startDist + kerb.endDist) / 2, off, {});
      if (props.some((prop) => prop.kind === 'marshal'
        && Math.hypot(prop.x - spot.x, prop.y - spot.y) < 25)) continue;
      props.push({ kind: 'marshal', x: spot.x, y: spot.y, rot: spot.rot });
    }
  for (const board of build.spec.boards) {
    const x = board.at[0] * build.scale, y = board.at[1] * build.scale;
    const hit = querySubtrack(sub, x, y);
    props.push({ kind: 'board', label: board.label, x, y,
      rot: onTrack(sub, hit.trackDist, 0, {}).rot });
  }
  return props;
}

/**
 * Trees in the mapped woods (and a few in the open), clear of roads, lanes and buildings.
 * @param build the venue at game scale
 * @param bounds where to scatter
 * @param clear true where a tree of that reach may stand
 * @param rnd the venue's dice
 * @returns the tree props
 */
function venueTrees(build: VenueBuild, bounds: VenueScenery['bounds'],
  clear: (x: number, y: number, reach: number) => boolean, rnd: () => number): Prop[] {
  const woods = build.spec.data.woods.map((wood) => scalePts(wood.pts, build.scale));
  const trees: Prop[] = [];
  for (let i = 0; i < MAX_TREES * 16 && trees.length < MAX_TREES; i++) {
    const x = bounds.x0 + rnd() * (bounds.x1 - bounds.x0);
    const y = bounds.y0 + rnd() * (bounds.y1 - bounds.y0);
    const inWood = woods.some((wood) => insidePoly(wood, x, y));
    if ((inWood || rnd() < OPEN_TREE_SHARE) && clear(x, y, 10))
      trees.push({ kind: 'tree', x, y, s: 3.5 + rnd() * 3, seed: i });
  }
  return trees;
}

/**
 * The box round everything the venue keeps, plus a margin.
 * @param loops every layout's road
 * @param lanes the lanes
 * @param props the props
 * @returns the bounds
 */
function venueBounds(loops: Subtrack[], lanes: Lane[], props: Prop[]): VenueScenery['bounds'] {
  const allX: number[] = [], allY: number[] = [];
  for (const loop of loops)
    for (const point of loop.pts) { allX.push(point.x); allY.push(point.y); }
  for (const lane of lanes) for (const [x, y] of lane.pts) { allX.push(x); allY.push(y); }
  for (const prop of props) { allX.push(prop.x); allY.push(prop.y); }
  const margin = 30;
  return { x0: Math.min(...allX) - margin, y0: Math.min(...allY) - margin,
    x1: Math.max(...allX) + margin, y1: Math.max(...allY) + margin };
}

/**
 * Whether a prop's whole footprint (its box + 1.5 m) stays off the roads and lanes.
 * @param prop the prop
 * @param roads the road test
 * @returns true when clear
 */
function footprintClear(prop: Prop, roads: RoadTest): boolean {
  const size: Record<string, [number, number]> = { marshal: [2.4, 2], board: [18, 1.2],
    truck: [14, 2.5], tower: [prop.size || 9, prop.size || 9] };
  const [width, height] = size[prop.kind] || [prop.w || 0, prop.h || 0];
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  for (let across = -width / 2 - 1.5; across <= width / 2 + 1.5; across += 1.5)
    for (let deep = -height / 2 - 1.5; deep <= height / 2 + 1.5; deep += 1.5) {
      const x = prop.x + cosR * across - sinR * deep, y = prop.y + sinR * across + cosR * deep;
      if (nearRace(roads.loops, x, y, 0.5) || roads.near(x, y, 0)) return false;
    }
  return true;
}

/**
 * Moves a prop that touches a road straight away from the nearest race road until it is clear
 * (the game's road is wider than the real one, so a stand built at its edge needs a step back).
 * @param prop the prop (moved in place)
 * @param roads the road test
 * @returns true when it ends clear, false to leave it out
 */
function nudgeOff(prop: Prop, roads: RoadTest): boolean {
  for (let tries = 0; tries <= NUDGE_TRIES; tries++) {
    if (footprintClear(prop, roads)) return true;
    const { sub, hit } = nearestLoop(roads.loops, prop.x, prop.y);
    const centre = onTrack(sub, hit.trackDist, 0, {});
    const away = Math.hypot(prop.x - centre.x, prop.y - centre.y) || 1;
    prop.x += (prop.x - centre.x) / away * NUDGE_STEP_M;
    prop.y += (prop.y - centre.y) / away * NUDGE_STEP_M;
  }
  return false;
}

// props that stand over or beside the road toY design
const ON_ROAD_OK = new Set(['gantry', 'garagerow', 'footbridge', 'bridge']);

/**
 * Everything of the venue but the raced road, the same for each of its layouts.
 * @param build the venue at game scale
 * @param sub the raced road
 * @param closed the lanes of the pieces this layout does not race
 * @returns lanes, zones, cones, barriers, props and the bounds
 */
export function buildVenueScenery(build: VenueBuild, sub: Subtrack, closed: Lane[]): VenueScenery {
  const rnd = parkMiller(build.spec.seed), loops = Object.values(build.loops);
  const roadsLanes: Lane[] = [...closed];
  const roads: RoadTest = { loops, near: (x, y, pad) => nearLane(roadsLanes, x, y, pad) };
  const pit = pitLane(build, loops);
  roadsLanes.push(pit.lane);
  const service = venueRoads(build, roads);
  roadsLanes.push(...service.lanes);
  const traps = venueTraps(build, roads);
  roadsLanes.push(...traps.lanes);
  const paddocks = venuePaddocks(build, rnd);
  const props = [...venueBuildings(build, pit.lane, roads), ...service.props, ...paddocks.props,
    ...trackside(build, sub)];
  const kept = props.filter((prop) => ON_ROAD_OK.has(prop.kind) || nudgeOff(prop, roads));
  VENUE_DROPPED[build.spec.id] = props.filter((prop) => !kept.includes(prop))
    .map((prop) => prop.kind);
  const lanes = [pit.lane, ...service.lanes, ...traps.lanes];
  const bounds = venueBounds(loops, lanes, kept);
  const solidAt = (x: number, y: number, reach: number) => kept.some((prop) =>
    Math.abs(prop.x - x) < (Math.max(prop.w || 0, prop.h || 0) / 2 + reach)
    && Math.abs(prop.y - y) < (Math.max(prop.w || 0, prop.h || 0) / 2 + reach));
  const clear = (x: number, y: number, reach: number) => !nearRace(loops, x, y, reach)
    && !roads.near(x, y, reach * 0.6) && !solidAt(x, y, 2)
    && !paddocks.zones.some((zone) => Math.abs(zone.x - x) < zone.w / 2
      && Math.abs(zone.y - y) < zone.w / 2);
  kept.push(...venueTrees(build, bounds, clear, rnd));
  const barriers = [...(pit.wall ? [pit.wall] : []), ...traps.barriers,
    ...venueFences(build, roads)];
  const karting = build.spec.data.tyres.flatMap((line) =>
    resample(scalePts(line.pts, build.scale), 1).map(([x, y]) => ({ x, y, kind: 'tyrestack' })));
  return { lanes, zones: paddocks.zones, cones: [...traps.cones, ...karting], barriers,
    props: kept, bounds };
}

/**
 * The point a distance along an open line, with the line's left normal there.
 * @param line the points
 * @param distM metres from its first point
 * @returns the point and normal, or null past its end
 */
export function pointAlong(line: Point[], distM: number):
  { x: number; y: number; nx: number; ny: number } | null {
  let left = distM;
  for (let i = 0; i < line.length - 1; i++) {
    const [fromX, fromY] = line[i], [toX, toY] = line[i + 1];
    const len = Math.hypot(toX - fromX, toY - fromY);
    if (len > 0 && left <= len) {
      const frac = left / len;
      return { x: fromX + (toX - fromX) * frac, y: fromY + (toY - fromY) * frac,
        nx: -(toY - fromY) / len, ny: (toX - fromX) / len };
    }
    left -= len;
  }
  return null;
}

// world/venuescenery.ts - A VENUE'S SCENERY, the same for every layout (world/venue.ts), from the
// real map at game scale (each point through venuegeo.ts makePlacer, so the game's wider road
// keeps the real gaps). Inside the sealed edge (world/venueedge.ts: the Armco, traps, catch
// fences, marshal posts) there is only the track, its run-off and the pit lane; the only ways on
// and off are the pit lane's two ends. Outside it: the pit wall and garages, the paddocks (tarmac,
// race trucks in rows), the car parks (mown grass, parked cars in rows), the service roads (each
// piece at least MIN_ROAD_M - no stubs), bridges over the track carrying their road at its real
// angle with approaches meeting it, the tunnels' portals both sides, grandstands, buildings, the
// kart track and rally stages, woods, boards; and the pit lane's painted lines.
import { alongTrack } from "./barriers.ts";
import { SURFACES } from "./surfaces.ts";
import { onTrack } from "./tyrewall.ts";
import { insidePolygon } from "./zones.ts";
import { parkMiller } from "../core/random.ts";
import { HALF_ROAD, VENUE_ROAD_M, centreAt, clearRuns, distToLine, lineLength, makePlacer,
  nearestLoop, resample, roadDistance } from "./venuegeo.ts";
import { boardOnArmco, buildCatchFences, buildEdge, buildRims, inZones, marshalPosts,
  outlineZone, pastRim, trapZones } from "./venueedge.ts";
import type { Rim } from "./venueedge.ts";
import type { VenueBox, VenueBuild } from "./venue.ts";
import type { Barrier, Cone, Lane, Paint, Point, Prop, Subtrack, Zone } from "./types.ts";

/** What buildVenueScenery returns: everything but the raced road. */
export interface VenueScenery {
  lanes: Lane[]; zones: Zone[]; cones: Cone[]; barriers: Barrier[]; props: Prop[];
  paint: Paint[]; bounds: { x0: number; y0: number; x1: number; y1: number };
}

// m (game) from a venue road beyond which nothing of the map is taken: the venue's reach
const REACH_M = 130;
// m: the pit lane's width, the wall's gap from it, where it may meet the track (its ends) and the
// wall's distance past the road's edge
const PIT_W = 9, PIT_WALL_GAP = 0.6, PIT_MERGE_M = 30, EDGE_TO_WALL = 3;
// m: the garages' front stands at least this far behind the pit lane's edge
const GARAGE_GAP_M = 1.5;
// m: a service road keeps this far outside the edge; a piece of one shorter than MIN_ROAD_M once
// cut is left out (a stub)
const ROAD_OUT_M = 2, MIN_ROAD_M = 30;
// m: a road piece going nowhere is kept only this long; an end within JOIN_M of a lane meets it
const LONE_ROAD_M = 90, JOIN_M = 3;
// m: a bridge's approach and its width; a tunnel portal's distance outside the edge, its length
const APPROACH_M = 8, APPROACH_W = 6, PORTAL_OUT_M = 3, PORTAL_LEN_M = 9;
// m: a building stays this far outside the edge (moved out in NUDGE_STEP_M steps)
const BUILD_OUT_M = 2, NUDGE_STEP_M = 1.5, NUDGE_TRIES = 12;
// parked cars: m between cars along a row, between rows, the share of bays taken, the most
const BAY_M = 2.7, ROW_M = 6.5, BAY_FULL = 0.55, MAX_PARKED = 160;
// race trucks: m along and across their rows, the share of slots taken, the most per paddock
const TRUCK_ALONG_M = 17, TRUCK_ACROSS_M = 6, TRUCK_FULL = 0.6, MAX_TRUCKS = 12;
// trees: how many at most, the share of tries kept outside the woods, m outside the edge
const MAX_TREES = 260, OPEN_TREE_SHARE = 0.05, TREE_OUT_M = 6;
// building kinds that are homes, sheds and farm buildings (the venue's neighbours, not its own)
const NOT_VENUE = new Set(['house', 'residential', 'garage', 'barn', 'silo', 'shed', 'farm',
  'detached', 'semidetached_house', 'terrace', 'hotel', 'greenhouse']);
const ROOFS = ['#5b626b', '#6b6158', '#596372', '#6e6e66'];
const TRUCK_COLS = ['#c8302c', '#2b56b5', '#e2c13a', '#2e8b57', '#e8e6e0'];
const PARKED_COLS = ['#c8302c', '#2b56b5', '#e8e6e0', '#1d1f24', '#8f949c', '#2e8b57', '#d9a13a'];

/** What every builder here shares. */
interface Site {
  build: VenueBuild; loops: Subtrack[]; rims: Rim[]; place: (pt: Point) => Point;
  rnd: () => number; lanes: Lane[]; buildings: Prop[];
  armco: Set<string>;   // the 2 m cells the Armco runs through (roads keep out of them)
}

const placeAll = (site: Site, pts: Point[]): Point[] => pts.map(site.place);
const nearRace = (site: Site, x: number, y: number, pad: number) =>
  roadDistance(site.loops, x, y) < HALF_ROAD + pad;
const onLanes = (lanes: Lane[], x: number, y: number, pad: number) =>
  lanes.some((lane) => distToLine(lane.pts, x, y) < lane.width / 2 + pad);

/**
 * The pit lane at game scale, kept clear of the wall (the game's road is wider than the real
 * one), and the pit wall: parallel to the road, EDGE_TO_WALL past its edge, along the stretch the
 * lane runs beside it.
 * @param site the venue's builders' state
 * @returns the lane and the wall
 */
function pitLane(site: Site): { lane: Lane; wall: Barrier | null } {
  const spec = site.build.spec;
  const data = spec.data.pitLanes.find((entry) => entry.name === spec.pitLane);
  if (!data) throw new Error(`venue: no pit lane ${spec.pitLane}`);
  const dense = resample(placeAll(site, data.pts), 2);
  const need = HALF_ROAD + EDGE_TO_WALL + PIT_WALL_GAP + PIT_W / 2;
  const beside: { sub: Subtrack; dist: number; side: number }[] = [];
  const moved = dense.map(([x, y], i) => {
    const fromEnd = Math.min(i, dense.length - 1 - i) * 2;
    if (fromEnd < PIT_MERGE_M) return [x, y];
    const { sub, hit } = nearestLoop(site.loops, x, y);
    const side = hit.side === 'left' ? 1 : -1;
    beside.push({ sub, dist: hit.trackDist, side });
    if (hit.dist >= need) return [x, y];
    const centre = centreAt(sub, hit.trackDist);
    return [centre.x + centre.nx * side * need, centre.y + centre.ny * side * need];
  }) as Point[];
  let wall: Barrier | null = null;
  if (beside.length > 8) {
    const sides = beside.reduce((sum, spot) => sum + spot.side, 0), trim = 6;
    const offset = Math.sign(sides || 1) * (HALF_ROAD + EDGE_TO_WALL);
    wall = { kind: 'pitwall', pts: alongTrack(beside[0].sub, beside[0].dist + trim,
      beside[beside.length - 1].dist - trim, offset, 2) };
  }
  return { lane: { pts: moved, width: PIT_W, surface: SURFACES.concrete }, wall };
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
function pitLines(site: Site, pit: Lane): Paint[] {
  const mid = Math.floor(pit.pts.length / 2), [x, y] = pit.pts[mid];
  const [nextX, nextY] = pit.pts[mid + 1], len = Math.hypot(nextX - x, nextY - y) || 1;
  const { sub, hit } = nearestLoop(site.loops, x, y), centre = centreAt(sub, hit.trackDist);
  // the wall side: + when the track lies on the lane's left
  const across = (centre.x - x) * -(nextY - y) / len + (centre.y - y) * (nextX - x) / len;
  const wallSide = Math.sign(across) || 1;
  const divider = offsetLine(pit.pts.slice(15, -15), wallSide * (PIT_W / 2 - PIT_W / 3));
  const lines: Paint[] = [{ kind: 'line', x: 0, y: 0, pts: divider, lw: 0.15, tone: 0.75 }];
  for (const end of [pit.pts.slice(0, 16), pit.pts.slice(-16)]) {
    const edge = end.map(([endX, endY]) => {
      const near = nearestLoop(site.loops, endX, endY);
      const road = centreAt(near.sub, near.hit.trackDist), side = near.hit.side === 'left' ? 1 : -1;
      return [road.x + road.nx * side * (HALF_ROAD - 0.4),
        road.y + road.ny * side * (HALF_ROAD - 0.4)] as Point;
    });
    lines.push({ kind: 'line', x: 0, y: 0, pts: edge, lw: 0.3, tone: 0.9 });
  }
  return lines;
}

// m: the side of the cells the Armco is indexed by
const ARMCO_CELL_M = 2;
const cellKey = (x: number, y: number) =>
  `${Math.floor(x / ARMCO_CELL_M)},${Math.floor(y / ARMCO_CELL_M)}`;

/**
 * Whether an Armco run passes within about pad of a point (by its 2 m cells).
 * @param site the venue's builders' state
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when one is that near
 */
function nearArmco(site: Site, x: number, y: number, pad: number): boolean {
  const reach = Math.ceil(pad / ARMCO_CELL_M);
  const cellX = Math.floor(x / ARMCO_CELL_M), cellY = Math.floor(y / ARMCO_CELL_M);
  for (let stepX = -reach; stepX <= reach; stepX++)
    for (let stepY = -reach; stepY <= reach; stepY++)
      if (site.armco.has(`${cellX + stepX},${cellY + stepY}`)) return true;
  return false;
}

/**
 * Whether a point lies within pad of a building's turned box.
 * @param buildings the building props
 * @param x world x
 * @param y world y
 * @param pad metres
 * @returns true when in or that near one
 */
function inBuilding(buildings: Prop[], x: number, y: number, pad: number): boolean {
  return buildings.some((prop) => {
    // the garage row: its outline (front and back)
    if (prop.front && prop.back) {
      const outline = [...prop.front, ...prop.back.slice().reverse()];
      return insidePolygon(outline, x, y) || distToLine(prop.front, x, y) < pad
        || distToLine(prop.back, x, y) < pad;
    }
    if (!prop.w || !prop.h) return false;
    const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
    const along = (x - prop.x) * cosR + (y - prop.y) * sinR;
    const across = -(x - prop.x) * sinR + (y - prop.y) * cosR;
    return Math.abs(along) <= prop.w / 2 + pad && Math.abs(across) <= prop.h / 2 + pad;
  });
}

/**
 * The service roads, rally stages and kart track as lanes, all outside the edge (real widths);
 * each piece left after the cut must be at least MIN_ROAD_M long.
 * @param site the venue's builders' state
 * @returns the lanes
 */
function venueRoads(site: Site): Lane[] {
  const data = site.build.spec.data, lanes: Lane[] = [];
  const add = (pts: Point[], width: number, surface: Lane['surface']) => {
    const clear = (x: number, y: number) => pastRim(site.rims, x, y) > ROAD_OUT_M + width / 2
      && nearRace(site, x, y, REACH_M) && !onLanes(site.lanes, x, y, width / 2)
      && !inBuilding(site.buildings, x, y, width / 2 + 1) && !nearArmco(site, x, y, width / 2 + 1);
    for (const run of clearRuns(placeAll(site, pts), clear))
      if (lineLength(run) >= MIN_ROAD_M) lanes.push({ pts: run, width, surface });
  };
  // the venue's own roads: the village streets next door (residential) are not its
  for (const road of data.roads)
    if (!road.bridge && road.kind !== 'residential')
      add(road.pts, road.width, road.kind === 'track' ? SURFACES.dirt : SURFACES.tarmac);
  for (const stage of data.dirt) add(stage.pts, 5, SURFACES.dirt);
  for (const kart of data.karting) add(kart.pts, 7, SURFACES.tarmac);
  return joinedUp(site, lanes);
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
      || inBuilding(site.buildings, x, y, run.width / 2 + JOIN_M));
    const next = kept.filter((run) => lineLength(run.pts) >= LONE_ROAD_M || meets(run));
    if (next.length === kept.length) break;
    kept = next;
  }
  return kept;
}

/**
 * Where a mapped line crosses a race road: the road's centre sample there, the line's heading and
 * the sine of the angle between them (never below 0.35: a deck at a shallower angle is too long).
 * @param site the venue's builders' state
 * @param line the line at game scale
 * @returns the crossing, or null if it never meets a race road
 */
function crossing(site: Site, line: Point[]) {
  let best: { sub: Subtrack; dist: number; trackDist: number } | null = null;
  for (const [x, y] of resample(line, 1)) {
    const { sub, hit } = nearestLoop(site.loops, x, y);
    if (!best || hit.dist < best.dist) best = { sub, dist: hit.dist, trackDist: hit.trackDist };
  }
  if (!best || best.dist > HALF_ROAD + 4) return null;
  const [lastX, lastY] = line[line.length - 1];
  const head = Math.atan2(lastY - line[0][1], lastX - line[0][0]);
  const centre = centreAt(best.sub, best.trackDist);
  const sine = Math.abs(Math.cos(head) * centre.dirY - Math.sin(head) * centre.dirX);
  return { head, sine: Math.max(sine, 0.35), centre };
}

/**
 * The bridges over the track (roads and footpaths): each deck along the road it carries, at its
 * real angle, long enough to clear the edge both sides, a road bridge with an approach each end
 * meeting its road.
 * @param site the venue's builders' state
 * @returns the bridge props and the approach lanes
 */
function venueBridges(site: Site): { props: Prop[]; lanes: Lane[] } {
  const data = site.build.spec.data, props: Prop[] = [], lanes: Lane[] = [];
  const decks: [Point[], string][] = [
    ...data.roads.filter((road) => road.bridge).map((road): [Point[], string] =>
      [road.pts, 'bridge']),
    ...data.footbridges.map((path): [Point[], string] => [path.pts, 'footbridge']),
  ];
  for (const [pts, kind] of decks) {
    const cross = crossing(site, placeAll(site, pts));
    if (!cross) continue;
    const { centre } = cross, inside = -pastRim(site.rims, centre.x, centre.y);
    const span = Math.min(70, 2 * (inside + 3) / cross.sine);
    const label = kind === 'footbridge' ? site.build.spec.bridgeLabel : undefined;
    props.push({ kind, x: centre.x, y: centre.y, rot: cross.head, wid: span,
      seed: Math.round(centre.x), ...(label ? { label } : {}),
      ...(kind === 'bridge' ? { carries: 'road', quiet: true } : {}) } as Prop);
    if (kind !== 'bridge') continue;
    const dirX = Math.cos(cross.head), dirY = Math.sin(cross.head), end = span / 2;
    for (const side of [-1, 1])
      lanes.push({ width: APPROACH_W, surface: SURFACES.tarmac, pts: [
        [centre.x + dirX * side * (end + 0.5), centre.y + dirY * side * (end + 0.5)],
        [centre.x + dirX * side * (end + APPROACH_M), centre.y + dirY * side * (end + APPROACH_M)],
      ] });
  }
  return { props, lanes };
}

/**
 * The tunnels under the track: a portal each side, PORTAL_OUT_M outside the edge along the
 * tunnel's line, its ramp running down toward the track, with a road from its mouth out.
 * @param site the venue's builders' state
 * @returns the portal props and their roads
 */
function venueTunnels(site: Site): { props: Prop[]; lanes: Lane[] } {
  const props: Prop[] = [], lanes: Lane[] = [];
  for (const tunnel of site.build.spec.data.tunnels) {
    const cross = crossing(site, placeAll(site, tunnel.pts));
    if (!cross) continue;
    const { centre } = cross, width = tunnel.kind === 'footway' ? 3 : 6;
    const dirX = Math.cos(cross.head), dirY = Math.sin(cross.head);
    for (const side of [-1, 1]) {
      // walk out along the tunnel's line until past the edge
      let out = HALF_ROAD;
      while (out < 80 && pastRim(site.rims, centre.x + dirX * side * out,
        centre.y + dirY * side * out) < PORTAL_OUT_M) out += 1;
      const mouth = out + PORTAL_LEN_M / 2;
      const x = centre.x + dirX * side * mouth, y = centre.y + dirY * side * mouth;
      // the portal's ramp runs down toward the track: its rot points at the track
      props.push({ kind: 'tunnel', x, y, rot: cross.head + (side > 0 ? Math.PI : 0),
        w: PORTAL_LEN_M, h: width + 1.2 });
      // a vehicle tunnel's road out of the mouth, stopping short of any Armco (a footpath is not
      // drawn, here or anywhere)
      if (tunnel.kind === 'footway') continue;
      const far = PORTAL_LEN_M / 2 + 10;
      const [road] = clearRuns([[x, y], [x + dirX * side * far, y + dirY * side * far]],
        (pointX, pointY) => !nearArmco(site, pointX, pointY, width / 2 + 0.5), 1);
      if (road) lanes.push({ width, surface: SURFACES.tarmac, pts: road });
    }
  }
  return { props, lanes };
}

/**
 * A mapped box at game scale (its centre placed, its size scaled), as a prop of a kind.
 * @param site the venue's builders' state
 * @param box the box (real m)
 * @param kind the prop kind
 * @returns the prop
 */
function boxProp(site: Site, box: VenueBox, kind: string): Prop {
  const [x, y] = site.place([box.x, box.y]), scale = site.build.scale;
  return { kind, x, y, w: box.w * scale, h: box.h * scale, rot: box.rot };
}

/**
 * Moves a building straight out from the track until its whole box stands BUILD_OUT_M outside the
 * edge and off every lane.
 * @param site the venue's builders' state
 * @param prop the prop (moved in place)
 * @returns true when it ends clear, false to leave it out
 */
function standClear(site: Site, prop: Prop): boolean {
  const cosR = Math.cos(prop.rot || 0), sinR = Math.sin(prop.rot || 0);
  const halfW = (prop.w || 2) / 2, halfH = (prop.h || 2) / 2;
  const corners = () => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]].map(([along, across]) =>
    [prop.x + cosR * along * halfW - sinR * across * halfH,
      prop.y + sinR * along * halfW + cosR * across * halfH] as Point);
  for (let tries = 0; tries <= NUDGE_TRIES; tries++) {
    if (corners().every(([x, y]) => pastRim(site.rims, x, y) > BUILD_OUT_M
      && !onLanes(site.lanes, x, y, 0.5))) return true;
    const { sub, hit } = nearestLoop(site.loops, prop.x, prop.y);
    const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
    prop.x += centre.nx * side * NUDGE_STEP_M;
    prop.y += centre.ny * side * NUDGE_STEP_M;
  }
  return false;
}

/**
 * The venue's own buildings (not the neighbours' homes): grandstands, the pit garages as a garage
 * row facing the pit lane, and every other building a flat-roofed block; each outside the edge.
 * @param site the venue's builders' state
 * @param pit the pit lane
 * @returns the props
 */
function venueBuildings(site: Site, pit: Lane): Prop[] {
  const data = site.build.spec.data, props: Prop[] = [];
  const homes = data.homes.map((home) => outlineZone(placeAll(site, home.pts), SURFACES.grass));
  for (const stand of data.stands) {
    const prop = boxProp(site, stand, 'grandstand');
    if (standClear(site, prop)) props.push(prop);
  }
  data.buildings.forEach((building, i) => {
    const prop = boxProp(site, building, 'block');
    if (!nearRace(site, prop.x, prop.y, REACH_M)) return;
    if (/pit garages/i.test(building.name)) { props.push(garageRow(prop, pit)); return; }
    if (NOT_VENUE.has(building.kind) || inZones(homes, prop.x, prop.y)) return;
    if (!building.name && prop.w! * prop.h! < 40) return;
    if (standClear(site, prop)) props.push({ ...prop, roof: ROOFS[i % ROOFS.length] });
  });
  return props;
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

/**
 * An outline kept outside the edge: each of its points inside (or too near) it moved straight out.
 * @param site the venue's builders' state
 * @param poly the outline at game scale
 * @returns the outline
 */
function outsideEdge(site: Site, poly: Point[]): Point[] {
  return poly.map(([x, y]) => {
    const past = pastRim(site.rims, x, y);
    if (past >= BUILD_OUT_M) return [x, y] as Point;
    const { sub, hit } = nearestLoop(site.loops, x, y);
    const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
    const step = BUILD_OUT_M - past;
    return [x + centre.nx * side * step, y + centre.ny * side * step] as Point;
  });
}

/**
 * Slots in rows across a mapped box: along its long side every `along` m, across it every
 * `across` m, each kept by chance and only inside the outline and clear of every lane.
 * @param site the venue's builders' state
 * @param box the box at game scale
 * @param zone its outlined zone
 * @param spacing [along, across, share kept, the most]
 * @returns the slots
 */
function rowSlots(site: Site, box: Prop, zone: Zone,
  spacing: [number, number, number, number]): { x: number; y: number }[] {
  const [along, across, share, most] = spacing, slots: { x: number; y: number }[] = [];
  const cosR = Math.cos(box.rot!), sinR = Math.sin(box.rot!);
  for (let row = -box.h! / 2 + across / 2; row <= box.h! / 2 - across / 2; row += across)
    for (let bay = -box.w! / 2 + along / 2; bay <= box.w! / 2 - along / 2; bay += along) {
      if (slots.length >= most || site.rnd() > share) continue;
      const x = box.x + cosR * bay - sinR * row, y = box.y + sinR * bay + cosR * row;
      if (inZones([zone], x, y) && !onLanes(site.lanes, x, y, 2)
        && pastRim(site.rims, x, y) > BUILD_OUT_M + 2) slots.push({ x, y });
    }
  return slots;
}

/**
 * The paddocks (tarmac, the race trucks in rows) and the car parks (mown grass, parked cars in
 * rows), each outline kept outside the edge.
 * @param site the venue's builders' state
 * @returns zones and props
 */
function venuePaddocks(site: Site): { zones: Zone[]; props: Prop[] } {
  const zones: Zone[] = [], props: Prop[] = [];
  let parked = 0;
  for (const paddock of site.build.spec.data.paddocks) {
    const paved = /paddock/i.test(paddock.name) || /asphalt|paved|concrete/.test(paddock.surface);
    const poly = outsideEdge(site, placeAll(site, paddock.pts));
    if (!nearRace(site, poly[0][0], poly[0][1], REACH_M)) continue;
    const zone = outlineZone(poly, paved ? SURFACES.tarmac : SURFACES.grassShort);
    zones.push(zone);
    const box = boxProp(site, paddock, 'zone');
    if (paved) {
      for (const slot of rowSlots(site, box, zone,
        [TRUCK_ALONG_M, TRUCK_ACROSS_M, TRUCK_FULL, MAX_TRUCKS]))
        props.push({ kind: 'truck', ...slot, rot: box.rot!,
          col: TRUCK_COLS[props.length % TRUCK_COLS.length] });
      continue;
    }
    for (const slot of rowSlots(site, box, zone, [BAY_M, ROW_M, BAY_FULL, MAX_PARKED - parked])) {
      parked++;
      const facing = site.rnd() < 0.5 ? 0 : Math.PI;
      props.push({ kind: 'parkedcar', ...slot, rot: box.rot! + Math.PI / 2 + facing,
        col: PARKED_COLS[Math.floor(site.rnd() * PARKED_COLS.length)] });
    }
  }
  return { zones, props };
}

/**
 * Trees in the mapped woods (and a few in the open), outside the edge, clear of lanes, zones and
 * buildings.
 * @param site the venue's builders' state
 * @param bounds where to scatter
 * @param solids the props they keep clear of
 * @param zones the zones they keep out of
 * @returns the tree props
 */
function venueTrees(site: Site, bounds: VenueScenery['bounds'], solids: Prop[],
  zones: Zone[]): Prop[] {
  const woods = site.build.spec.data.woods.map((wood) => outlineZone(placeAll(site, wood.pts),
    SURFACES.grass));
  const trees: Prop[] = [];
  const nearSolid = (x: number, y: number) => solids.some((prop) => {
    const reach = Math.max(prop.w || 2, prop.h || 2) / 2 + 3;
    return Math.abs(prop.x - x) < reach && Math.abs(prop.y - y) < reach;
  });
  for (let i = 0; i < MAX_TREES * 16 && trees.length < MAX_TREES; i++) {
    const x = bounds.x0 + site.rnd() * (bounds.x1 - bounds.x0);
    const y = bounds.y0 + site.rnd() * (bounds.y1 - bounds.y0);
    if (!inZones(woods, x, y) && site.rnd() > OPEN_TREE_SHARE) continue;
    if (pastRim(site.rims, x, y) < TREE_OUT_M || onLanes(site.lanes, x, y, 4)
      || inZones(zones, x, y) || nearSolid(x, y)) continue;
    trees.push({ kind: 'tree', x, y, s: 3.5 + site.rnd() * 3, seed: i });
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
 * Where people stand: each grandstand's corners and centre, and the banks' points.
 * @param site the venue's builders' state
 * @param props the props
 * @returns the points
 */
function spectatorSpots(site: Site, props: Prop[]): Point[] {
  const spots: Point[] = [];
  for (const stand of props.filter((prop) => prop.kind === 'grandstand')) {
    const cosR = Math.cos(stand.rot || 0), sinR = Math.sin(stand.rot || 0);
    for (const [along, across] of [[0, 0], [-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]])
      spots.push([stand.x + cosR * along * stand.w! - sinR * across * stand.h!,
        stand.y + sinR * along * stand.w! + cosR * across * stand.h!]);
  }
  for (const bank of site.build.spec.banks)
    for (const point of bank.pts) spots.push(site.place(point));
  return spots;
}

/**
 * Everything of the venue but the raced road, the same for each of its layouts.
 * @param build the venue at game scale
 * @param sub the raced road
 * @param closed the lanes of the pieces this layout does not race
 * @returns lanes, zones, cones, barriers, props, paint and the bounds
 */
export function buildVenueScenery(build: VenueBuild, sub: Subtrack, closed: Lane[]): VenueScenery {
  const loops = Object.values(build.loops), spec = build.spec;
  const widen = (VENUE_ROAD_M - spec.realRoadM * build.scale) / 2;
  const place = makePlacer(build.scale, loops, widen);
  const traps = trapZones(spec.data.traps.map((trap) => trap.pts.map(place)), loops);
  const site: Site = { build, loops, rims: buildRims(loops, traps), place,
    rnd: parkMiller(spec.seed), lanes: [...closed], buildings: [], armco: new Set() };
  const pit = pitLane(site);
  site.lanes.push(pit.lane);
  const edge = buildEdge(site.rims, { loops, lanes: site.lanes }, traps);
  for (const rail of edge.barriers)
    for (const [x, y] of resample(rail.pts, 1)) site.armco.add(cellKey(x, y));
  const bridges = venueBridges(site), tunnels = venueTunnels(site);
  site.lanes.push(...bridges.lanes, ...tunnels.lanes);
  // the buildings first: the roads go round them
  site.buildings = venueBuildings(site, pit.lane);
  const roads = venueRoads(site);
  site.lanes.push(...roads);
  const paddocks = venuePaddocks(site);
  const start = onTrack(sub, 2, 0, {});
  const props: Prop[] = [...site.buildings, ...bridges.props, ...tunnels.props,
    ...paddocks.props, ...marshalPosts(site.rims),
    { kind: 'gantry', x: start.x, y: start.y, wid: 24, rot: start.rot + Math.PI / 2 }];
  for (const board of spec.boards) {
    const prop = boardOnArmco(edge.barriers, loops, place(board.at), board.label, site.rims);
    if (prop) props.push(prop);
  }
  const catchFences = buildCatchFences(edge.barriers, spectatorSpots(site, props), loops);
  const lanes = [pit.lane, ...bridges.lanes, ...tunnels.lanes, ...roads];
  const bounds = venueBounds(loops, lanes, props);
  const zones = [...traps, ...paddocks.zones];
  props.push(...venueTrees(site, bounds, props, zones));
  const karting = spec.data.tyres.flatMap((line) => resample(placeAll(site, line.pts), 1)
    .map(([x, y]) => ({ x, y, kind: 'tyrestack' })));
  return { lanes, zones, cones: [...edge.cones, ...karting],
    barriers: [...(pit.wall ? [pit.wall] : []), ...edge.barriers, ...catchFences],
    props, paint: pitLines(site, pit.lane), bounds };
}

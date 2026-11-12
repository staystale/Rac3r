// world/venuescenery.ts - A VENUE'S SCENERY, the same for every layout (world/venue.ts), from the
// real map at game scale (each point through venuegeo.ts makePlacer, so the game's wider road
// keeps the real gaps). Inside the sealed edge (world/venueedge.ts: the Armco, traps, catch
// fences, marshal posts) there is only the track, its run-off and the pit lane; the only ways on
// and off are the pit lane's two ends. Outside it: the pit wall and garages, the paddocks (tarmac,
// race trucks in rows), the car parks (mown grass, parked cars in rows), the service roads (each
// piece at least MIN_ROAD_M - no stubs), bridges over the track carrying their road at its real
// angle with approaches meeting it, the tunnels' portals both sides, grandstands, buildings, the
// kart track and rally stages, woods, boards (the pit lane, its wall and lines: world/venuepit.ts).
import { SURFACES } from "./surfaces.ts";
import { querySubtrack } from "./tyrewall.ts";
import { parkMiller } from "../core/random.ts";
import { isAnyPointInBox, isAnyPointWithin, makePointGrid } from "../core/pointgrid.ts";
import { HALF_ROAD, VENUE_ROAD_M, centreAt, distToLine, evenly, isNearLine, kerbOut,
  lineLength, makePlacer, nearestLoop, pointAlong, resample, smoothLine } from "./venuegeo.ts";
import { WALL_REACH_M, boxedLine, buildEdge, railLines, buildRims, inZones, outlineZone, pastRim,
  trapZones } from "./venueedge.ts";
import { boardOnArmco, marshalPosts, startGantry } from "./venueposts.ts";
import { venueAero, venuePlanes } from "./venueairfield.ts";
import { nearWater, onPatches, ovalWall, venueMown, venueWater } from "./venueoval.ts";
import type { EdgeNeeds, RealLines } from "./venueedge.ts";
import { REACH_M, cellKey, inBuilding, inSolid, nearArmco, nearRace, onLanes, placeAll }
  from "./venuesite.ts";
import type { Site } from "./venuesite.ts";
import { FOOT_REACH_M, handFinish, tidyRoads, venueRoads, withoutDuplicates }
  from "./venueroads.ts";
import { continueRoad, joinApproaches, joinFrom } from "./venuejoin.ts";
import type { VenueBox, VenueBuild } from "./venue.ts";
import { inRow, pitLane, pitLines, placeGarageRow } from "./venuepit.ts";
import { tunnelCover } from "./venuecross.ts";
import { venueParks } from "./venueparks.ts";
import type { Barrier, Cone, Cover, Lane, Paint, Patch, Point, Prop, Subtrack, Zone }
  from "./types.ts";

/** What buildVenueScenery returns: everything but the raced road. */
export interface VenueScenery {
  lanes: Lane[]; zones: Zone[]; cones: Cone[]; barriers: Barrier[]; props: Prop[]; covers: Cover[];
  patches: Patch[]; paint: Paint[]; bounds: { x0: number; y0: number; x1: number; y1: number };
}

// m the track's edge barriers keep off the pit wall
const PIT_WALL_CLEAR_M = 4;
// m past every layout's road edge a marshal post keeps (another layout's corners included)
const POST_ROAD_M = 5;
// m the track's edge barriers keep off an oval's outside wall (it is their barrier there)
const OVAL_WALL_CLEAR_M = 7;
// m behind an oval's wall a board stands (past the run-off's rim, which lies beyond the wall)
const WALL_BOARD_BACK_M = 6;
// m from the pit lane's centre a parked truck or car keeps (the apron in front of the garages)
const PIT_APRON_M = 16;
// m: a bridge's approach and its width; a tunnel portal's distance outside the edge, its length
const APPROACH_M = 8, APPROACH_W = 6, PORTAL_OUT_M = 3, PORTAL_LEN_M = 9, PORTAL_LOOK_M = 80;
// m a portal keeps off every road and building
const PORTAL_CLEAR_M = 2.5;
// m: a drivable tunnel's mouth opens onto this clear ground, APRON_RIM_M past any Armco line
const APRON_M = 6, APRON_RIM_M = 1.5;
// m: tunnels crossing the track this close together are one tunnel
const SAME_TUNNEL_M = 12;
// m: a bridge deck's width as a hazard box; how near a stand or bank puts a catch fence
const DECK_BOX_M = 12, SPECTATOR_REACH_M = 30;
// m from a marshal post's centre a board's face keeps (its 2.4 x 2 m hut and a margin)
const POST_CLEAR_M = 3;
// m: half a bridge approach's width (the roads it meets are 5-6 m)
const APPROACH_HALF_M = 3;
// m: a building stays this far outside the edge (moved out in NUDGE_STEP_M steps)
const BUILD_OUT_M = 2, NUDGE_STEP_M = 1.5, NUDGE_TRIES = 12;
// parked cars: m between cars along a row, between rows, the share of bays taken, the most
const BAY_M = 2.7, ROW_M = 6.5, BAY_FULL = 0.55, MAX_PARKED = 160;
// race trucks: m along and across their rows, the share of slots taken, the most per paddock
const TRUCK_ALONG_M = 17, TRUCK_ACROSS_M = 6, TRUCK_FULL = 0.6, MAX_TRUCKS = 12;
// trees: how many at most, the share of tries kept outside the woods, m outside the edge
const MAX_TREES = 260, OPEN_TREE_SHARE = 0.05, TREE_OUT_M = 6;
// hedgerow trees: m apart along a row, the share kept, the most
const ROW_TREE_M = 9, ROW_TREE_SHARE = 0.6, MAX_ROW_TREES = 90;
// m a tree's trunk keeps off a lake's shore and off a mown pattern (canopies clear of them)
const TREE_WATER_M = 3, TREE_MOWN_M = 6;
// m a tree's trunk keeps off a mapped tyre wall's line (the largest trunk's box and a tyre)
const TREE_TYRE_M = 2.5;
// m a marshal post's centre keeps from a tyre stack (its hut's half diagonal and a tyre)
const POST_TYRE_M = 2;
// m within which a mapped tyre wall's stack stands on the edge's own rows (a stack's width)
const MAP_WALL_CLEAR_M = 1;
// m a marshal post's centre keeps past a kerb's outer edge (its hut's half diagonal, 1.6, and a
// step: at 1.5 a turned hut's corner still stood on the National's kerb at Sillystone)
const POST_KERB_M = 2;
// m past a tree's trunk box a barrier keeps (tools/venueaudit.mjs: a prop on a barrier)
const TREE_RAIL_M = 0.3;
// m a tree's trunk keeps off a road piece's edge (a raced road the edge already keeps it off; an
// unraced one - an old line beside a chicane - has no edge): the largest canopy and its shadow
const TREE_PIECE_M = 6.5;
// building kinds that are homes, sheds and farm buildings (the venue's neighbours, not its own)
const NOT_VENUE = new Set(['house', 'residential', 'garage', 'barn', 'silo', 'shed', 'farm',
  'detached', 'semidetached_house', 'terrace', 'hotel', 'greenhouse']);
const ROOFS = ['#5b626b', '#6b6158', '#596372', '#6e6e66'];
const TRUCK_COLS = ['#c8302c', '#2b56b5', '#e2c13a', '#2e8b57', '#e8e6e0'];
const PARKED_COLS = ['#c8302c', '#2b56b5', '#e8e6e0', '#1d1f24', '#8f949c', '#2e8b57', '#d9a13a'];

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
  const data = site.build.spec.data, props: Prop[] = [], lanes: Lane[] = [], laid: Point[] = [];
  const decks: [Point[], string][] = [
    ...data.roads.filter((road) => road.bridge).map((road): [Point[], string] =>
      [road.pts, 'bridge']),
    ...data.footbridges.map((path): [Point[], string] => [path.pts, 'footbridge']),
  ];
  for (const [pts, kind] of decks) {
    const cross = crossing(site, placeAll(site, pts));
    if (!cross) continue;
    const { centre } = cross, inside = -pastRim(site.rims, centre.x, centre.y);
    // one bridge a crossing (a footbridge's stairs mapped as bridges stood a second deck on it)
    if (laid.some(([x, y]) => Math.hypot(x - centre.x, y - centre.y) < SAME_TUNNEL_M)) continue;
    laid.push([centre.x, centre.y]);
    const span = Math.min(70, 2 * (inside + 3) / cross.sine);
    const label = kind === 'footbridge' ? site.build.spec.bridgeLabel : undefined;
    props.push({ kind, x: centre.x, y: centre.y, rot: cross.head, wid: span,
      seed: Math.round(centre.x), ...(label ? { label } : {}),
      ...(kind === 'bridge' ? { carries: 'road', quiet: true, look: 'venue' } : {}) } as Prop);
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
 * How far along a tunnel's line from the track's centre a portal's centre goes: the first place
 * where its whole footprint is past the edge and off every road and building.
 * @param site the venue's builders' state
 * @param centre the track's centre where the tunnel passes under
 * @param dir the way out (unit)
 * @param width the tunnel's road
 * @returns metres, or -1 with no clear place within PORTAL_LOOK_M
 */
function clearMouth(site: Site, centre: { x: number; y: number }, dir: Point,
  width: number): number {
  const across: Point = [-dir[1], dir[0]], half = (width + 1.2) / 2 + 0.6;
  for (let out = HALF_ROAD + PORTAL_LEN_M / 2; out <= PORTAL_LOOK_M; out += 1) {
    const clear = [-PORTAL_LEN_M / 2, 0, PORTAL_LEN_M / 2].every((along) => [-half, 0, half]
      .every((side) => {
        const x = centre.x + dir[0] * (out + along) + across[0] * side;
        const y = centre.y + dir[1] * (out + along) + across[1] * side;
        return pastRim(site.rims, x, y) > PORTAL_OUT_M - PORTAL_LEN_M
          && !onLanes(site.lanes, x, y, PORTAL_CLEAR_M)
          && !inBuilding(site.buildings, x, y, PORTAL_CLEAR_M);
      }));
    if (clear && pastRim(site.rims, centre.x + dir[0] * (out - PORTAL_LEN_M / 2),
      centre.y + dir[1] * (out - PORTAL_LEN_M / 2)) >= PORTAL_OUT_M
      && roomToDriveOut(site, centre, dir, out + PORTAL_LEN_M / 2, half)) return out;
  }
  return -1;
}

/**
 * Whether a drivable tunnel's mouth (world/crossings.ts) opens onto room to drive out: APRON_M
 * of ground past it outside every Armco line and off every building (owner 11-08: the footpath
 * tunnel under Brabham came up 2.5 m from Cooper Straight's Armco - its portal walks on, past
 * Cooper Straight).
 * @param site the venue's builders' state
 * @param centre the track's centre where the tunnel passes under
 * @param dir the way out (unit)
 * @param mouth m from the centre to the mouth
 * @param half the portal's half width with its walls, m
 * @returns true with room
 */
function roomToDriveOut(site: Site, centre: { x: number; y: number }, dir: Point, mouth: number,
  half: number): boolean {
  for (let ahead = 0.5; ahead <= APRON_M; ahead += 1)
    for (const side of [-half, 0, half]) {
      const x = centre.x + dir[0] * (mouth + ahead) - dir[1] * side;
      const y = centre.y + dir[1] * (mouth + ahead) + dir[0] * side;
      if (pastRim(site.rims, x, y) < APRON_RIM_M || inBuilding(site.buildings, x, y, 0.5))
        return false;
    }
  return true;
}

/**
 * The tunnels under the track: a portal each side, PORTAL_OUT_M outside the edge along the
 * tunnel's line, its ramp running down toward the track, with a road from its mouth out.
 * @param site the venue's builders' state
 * @returns the portal props and their roads
 */
function venueTunnels(site: Site): { props: Prop[]; lanes: Lane[] } {
  const props: Prop[] = [], lanes: Lane[] = [], done: Point[] = [];
  for (const tunnel of site.build.spec.data.tunnels) {
    const cross = crossing(site, placeAll(site, tunnel.pts));
    if (!cross) continue;
    // one tunnel mapped as two ways (each direction) gets one pair of portals
    const { x: atX, y: atY } = cross.centre;
    if (done.some(([x, y]) => Math.hypot(x - atX, y - atY) < SAME_TUNNEL_M)) continue;
    done.push([atX, atY]);
    const { centre } = cross, width = tunnel.kind === 'footway' ? 3 : 6;
    const dirX = Math.cos(cross.head), dirY = Math.sin(cross.head);
    // each end walks out along the tunnel's line until its whole portal is past the edge and
    // clear of every road (the pit lane) and building (a grandstand); no clear end, no tunnel
    const mouths = [-1, 1].map((side) => clearMouth(site, centre, [dirX * side, dirY * side],
      width));
    if (mouths.some((mouth) => mouth < 0)) continue;
    for (const [index, side] of [-1, 1].entries()) {
      const mouth = mouths[index];
      const x = centre.x + dirX * side * mouth, y = centre.y + dirY * side * mouth;
      // the portal's ramp runs down toward the track: its rot points at the track
      props.push({ kind: 'tunnel', x, y, rot: cross.head + (side > 0 ? Math.PI : 0),
        w: PORTAL_LEN_M, h: width + 1.2 });
      // a vehicle tunnel's road starts at the portal's open end (joined to the roads later:
      // joinTunnels); a footpath is not drawn, here or anywhere
      if (tunnel.kind === 'footway') continue;
      const open = PORTAL_LEN_M / 2;
      lanes.push({ width, surface: SURFACES.tarmac,
        pts: [[x, y], [x + dirX * side * open, y + dirY * side * open]] });
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
 * The lane nearest a point.
 * @param lanes the lanes (one at least)
 * @param x world x
 * @param y world y
 * @returns the lane
 */
const nearestLane = (lanes: Lane[], x: number, y: number): Lane => lanes.reduce((best, lane) =>
  (distToLine(lane.pts, x, y) < distToLine(best.pts, x, y) ? lane : best));

/**
 * The venue's own buildings (not the neighbours' homes): grandstands, the pit garages as a garage
 * row facing the pit lane, the control tower with its cab, every other building a flat-roofed
 * block, each outside the edge (first the buildings over a race-road tunnel, venuecross.ts: one
 * mapped there is the same building); the landmarks the map does not carry where sources show.
 * @param site the venue's builders' state
 * @param pits the pit lanes (none: no garage row; the garages face the nearest)
 * @returns the props
 */
function venueBuildings(site: Site, pits: Lane[]): Prop[] {
  const data = site.build.spec.data, props: Prop[] = site.loops.flatMap(tunnelCover);
  const homes = data.homes.map((home) => outlineZone(placeAll(site, home.pts), SURFACES.grass));
  for (const stand of data.stands) {
    const prop = boxProp(site, stand, 'grandstand');
    // (one stand mapped twice - a stand and its bleachers - keeps the first)
    if (standClear(site, prop) && !overlapsAny(prop, props, 0)) props.push(prop);
  }
  data.buildings.forEach((building, i) => {
    const prop = boxProp(site, building, 'block');
    if (!nearRace(site, prop.x, prop.y, REACH_M)) return;
    if (pits.length && /pit garages/i.test(building.name)) {
      placeGarageRow(props, prop, nearestLane(pits, prop.x, prop.y));
      return;
    }
    if (NOT_VENUE.has(building.kind) || inZones(homes, prop.x, prop.y)) return;
    if (!building.name && prop.w! * prop.h! < 40) return;
    // one structure mapped twice (a stand and a building on it): keep the first
    if (overlapsAny(prop, props)) return;
    if (!standClear(site, prop)) return;
    // (nor moved out onto the garage row or a stand: one structure mapped twice)
    if (props.some((other) => other.kind === 'garagerow' && inRow(other, prop))) return;
    if (overlapsAny(prop, props.filter((other) => other.kind === 'grandstand'), 0)) return;
    props.push(/control tower/i.test(building.name) ? { ...prop, kind: 'tower' }
      : building.kind === 'hangar' ? { ...prop, kind: 'hangar' }
        : { ...prop, roof: ROOFS[i % ROOFS.length] });
  });
  for (const mark of site.build.spec.landmarks || []) {
    const [x, y] = site.place(mark.at), size = mark.size * site.build.scale, { rot, col } = mark;
    props.push({ kind: mark.kind, x, y, size, w: (mark.len || mark.size) * site.build.scale,
      h: size, ...(rot === undefined ? {} : { rot }), ...(col ? { col } : {}) });
  }
  return props;
}

/**
 * Whether a box overlaps any of a list of props (its corners and centre in one, or theirs in it).
 * @param prop the box (w, h, rot)
 * @param others the props
 * @returns true when they overlap
 */
function overlapsAny(prop: Prop, others: Prop[], pad = 0.5): boolean {
  const corners = (box: Prop): Point[] => {
    const cosR = Math.cos(box.rot || 0), sinR = Math.sin(box.rot || 0);
    return [[0, 0], [-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]) =>
      [box.x + cosR * along * (box.w || 0) / 2 - sinR * across * (box.h || 0) / 2,
        box.y + sinR * along * (box.w || 0) / 2 + cosR * across * (box.h || 0) / 2] as Point);
  };
  return others.some((other) => corners(prop).some(([x, y]) => inBuilding([other], x, y, pad))
    || corners(other).some(([x, y]) => inBuilding([prop], x, y, pad)));
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
function rowSlots(site: Site, box: Prop, zone: Zone, spacing: [number, number, number, number],
  item: { len: number; rot: number }): { x: number; y: number }[] {
  const [along, across, share, most] = spacing, slots: { x: number; y: number }[] = [];
  const cosR = Math.cos(box.rot!), sinR = Math.sin(box.rot!);
  const itemX = Math.cos(item.rot) * item.len / 2, itemY = Math.sin(item.rot) * item.len / 2;
  // the whole item fits: both ends and the middle in the outline, off every road and building
  const fits = (x: number, y: number) => [-1, 0, 1].every((end) => {
    const pointX = x + itemX * end, pointY = y + itemY * end;
    return inZones([zone], pointX, pointY) && !onLanes(site.lanes, pointX, pointY, 1.5)
      && !inSolid(site, pointX, pointY, 1.5)
      && pastRim(site.rims, pointX, pointY) > BUILD_OUT_M + 2;
  });
  for (let row = -box.h! / 2 + across / 2; row <= box.h! / 2 - across / 2; row += across)
    for (let bay = -box.w! / 2 + along / 2; bay <= box.w! / 2 - along / 2; bay += along) {
      if (slots.length >= most || site.rnd() > share) continue;
      const x = box.x + cosR * bay - sinR * row, y = box.y + sinR * bay + cosR * row;
      // never on the pit apron (between the pit lane and the garage doors)
      if (fits(x, y) && site.pitPts.every((line) => distToLine(line, x, y) > PIT_APRON_M))
        slots.push({ x, y });
    }
  return slots;
}

/**
 * The paddocks (tarmac, the race trucks in rows) and the car parks (mown grass, parked cars in
 * rows), each outline kept outside the edge.
 * @param site the venue's builders' state
 * @param fill true to park the trucks and cars (false: the outlines only)
 * @returns zones and props
 */
function venuePaddocks(site: Site, fill: boolean): { zones: Zone[]; props: Prop[] } {
  const zones: Zone[] = [], props: Prop[] = [];
  let parked = 0;
  for (const paddock of site.build.spec.data.paddocks) {
    const paved = /paddock/i.test(paddock.name) || /asphalt|paved|concrete/.test(paddock.surface);
    const poly = outsideEdge(site, placeAll(site, paddock.pts));
    if (!nearRace(site, poly[0][0], poly[0][1], REACH_M)) continue;
    const zone = outlineZone(poly, paved ? SURFACES.tarmac : SURFACES.grassShort);
    zones.push(zone);
    if (!fill) continue;
    const box = boxProp(site, paddock, 'zone');
    if (paved) {
      for (const slot of rowSlots(site, box, zone,
        [TRUCK_ALONG_M, TRUCK_ACROSS_M, TRUCK_FULL, MAX_TRUCKS], { len: 14, rot: box.rot! }))
        props.push({ kind: 'truck', ...slot, rot: box.rot!,
          col: TRUCK_COLS[props.length % TRUCK_COLS.length] });
      continue;
    }
    const carRot = box.rot! + Math.PI / 2;
    for (const slot of rowSlots(site, box, zone, [BAY_M, ROW_M, BAY_FULL, MAX_PARKED - parked],
      { len: 4.2, rot: carRot })) {
      parked++;
      const facing = site.rnd() < 0.5 ? 0 : Math.PI;
      props.push({ kind: 'parkedcar', ...slot, rot: carRot + facing,
        col: PARKED_COLS[Math.floor(site.rnd() * PARKED_COLS.length)] });
    }
  }
  return { zones, props };
}

/**
 * Trees in the mapped woods (and a few in the open), outside the edge, clear of lanes (their
 * canopies clear of a road piece), zones, buildings, the lakes and the mown patterns.
 * @param site the venue's builders' state
 * @param bounds where to scatter
 * @param solids the props they keep clear of
 * @param zones the zones they keep out of
 * @param ground the scenery water and the mown patterns they keep out of
 * @returns the tree props
 */
function venueTrees(site: Site, bounds: VenueScenery['bounds'], solids: Prop[],
  zones: Zone[], ground: { covers: Cover[]; patches: Patch[] }): Prop[] {
  const woods = site.build.spec.data.woods.map((wood) => outlineZone(placeAll(site, wood.pts),
    SURFACES.grass));
  const trees: Prop[] = [];
  const pieces = site.lanes.filter((lane) => lane.surface === SURFACES.racetarmac);
  const nearSolid = (x: number, y: number) => solids.some((prop) => {
    const reach = Math.max(prop.w || 2, prop.h || 2) / 2 + 3;
    return Math.abs(prop.x - x) < reach && Math.abs(prop.y - y) < reach;
  });
  // (a tree's trunk never in a mapped tyre wall)
  const tyreLines = site.build.spec.data.tyres.map((line) => placeAll(site, line.pts));
  const clear = (x: number, y: number) => !(pastRim(site.rims, x, y) < TREE_OUT_M
    || onLanes(site.lanes, x, y, 4) || onLanes(pieces, x, y, TREE_PIECE_M) || inZones(zones, x, y)
    || nearSolid(x, y) || nearWater(ground.covers, x, y, TREE_WATER_M)
    || onPatches(ground.patches, x, y, TREE_MOWN_M)
    || tyreLines.some((line) => isNearLine(line, x, y, TREE_TYRE_M)));
  const most = site.build.spec.trees ?? MAX_TREES;
  for (let i = 0; i < most * 16 && trees.length < most; i++) {
    const x = bounds.x0 + site.rnd() * (bounds.x1 - bounds.x0);
    const y = bounds.y0 + site.rnd() * (bounds.y1 - bounds.y0);
    if (!inZones(woods, x, y) && site.rnd() > OPEN_TREE_SHARE) continue;
    if (!clear(x, y)) continue;
    trees.push({ kind: 'tree', x, y, s: 3.5 + site.rnd() * 3, seed: i });
  }
  return [...trees, ...rowTrees(site, bounds, clear)];
}

/**
 * The hedgerows' trees (data.rows), ROW_TREE_M apart along each with some gaps, inside the map.
 * @param site the venue's builders' state
 * @param bounds the map
 * @param clear true where a tree may stand
 * @returns the tree props
 */
function rowTrees(site: Site, bounds: VenueScenery['bounds'],
  clear: (x: number, y: number) => boolean): Prop[] {
  const trees: Prop[] = [];
  for (const row of site.build.spec.data.rows || [])
    for (const [x, y] of resample(placeAll(site, row.pts), ROW_TREE_M)) {
      const inside = x > bounds.x0 && x < bounds.x1 && y > bounds.y0 && y < bounds.y1;
      if (trees.length >= MAX_ROW_TREES || !inside || site.rnd() > ROW_TREE_SHARE || !clear(x, y))
        continue;
      trees.push({ kind: 'tree', x, y, s: 3 + site.rnd() * 2.5, seed: 9001 + trees.length });
    }
  return trees;
}

/**
 * The surfaces laid by hand (spec.pads: a skid pan), placed and scaled as the map is.
 * @param site the venue's builders' state
 * @returns the zones
 */
function venuePads(site: Site): Zone[] {
  return (site.build.spec.pads || []).map((pad) => {
    const [x, y] = site.place(pad.at), scale = site.build.scale;
    const cosR = Math.cos(pad.rot), sinR = Math.sin(pad.rot);
    const halfW = pad.w * scale / 2, halfH = pad.h * scale / 2;
    // its corners as an outline (the zones the scenery keeps clear of are outlines)
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([along, across]): Point =>
      [x + cosR * along * halfW - sinR * across * halfH,
        y + sinR * along * halfW + cosR * across * halfH]);
    return outlineZone(corners, SURFACES[pad.surface]);
  });
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
 * Where people stand behind a catch fence: each grandstand's corners and centre, and the points
 * of the banks that have one.
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
  for (const bank of site.build.spec.banks.filter((entry) => entry.fenced !== false))
    for (const point of bank.pts) spots.push(site.place(point));
  return spots;
}

/**
 * What decides the edge: hazards (buildings, tunnel portals, a bridge's deck), where spectators
 * stand (the grandstands, the banks), the real tyre walls (spec.tyreWalls) and rails (followed).
 * @param site the venue's builders' state
 * @param bridges the bridge props
 * @param portals the tunnel portal props
 * @param lines the real tyre walls and rails at game scale
 * @returns the edge's needs
 */
function edgeNeeds(site: Site, bridges: Prop[], portals: Prop[],
  lines: RealLines): EdgeNeeds {
  const solids = [...site.buildings, ...portals];
  const decks = bridges.map((bridge) => ({ ...bridge, w: bridge.wid, h: DECK_BOX_M }));
  const spots = spectatorSpots(site, site.buildings);
  return {
    ...(lines.walls.length ? { walled: (x: number, y: number) =>
      lines.walls.some((wall) => distToLine(wall.pts, x, y) < WALL_REACH_M) } : {}),
    ...(lines.rails.length ? { rails: lines.rails, mix: lines.mix } : {}),
    hazard: (x, y) => inBuilding(solids, x, y, 1) || inBuilding(decks, x, y, 0),
    watched: (x, y) => spots.some(([spotX, spotY]) => Math.abs(spotX - x) < SPECTATOR_REACH_M
      && Math.abs(spotY - y) < SPECTATOR_REACH_M
      && Math.hypot(spotX - x, spotY - y) < SPECTATOR_REACH_M),
  };
}

/**
 * Each vehicle tunnel's portal roads joined to the road network (a straight run out of the open
 * end, then a smooth curve into a road, as a bridge's approach); a tunnel that cannot reach a
 * road at both ends is no tunnel - its portals and roads go.
 * @param site the venue's builders' state (its lanes lose the roads dropped)
 * @param tunnels the portals and their stub roads (two a tunnel, in order; changed)
 * @param roads the service roads (a dead end may be trimmed)
 */
function joinTunnels(site: Site, tunnels: { props: Prop[]; lanes: Lane[] }, roads: Lane[]): void {
  const blocked = (x: number, y: number) => inBuilding(site.buildings, x, y, 1 + APPROACH_HALF_M)
    || nearArmco(site, x, y, APPROACH_HALF_M + 0.5);
  const keepProps: Prop[] = [], keepLanes: Lane[] = [];
  for (let i = 0; i + 1 < tunnels.lanes.length; i += 2) {
    const pair = [tunnels.lanes[i], tunnels.lanes[i + 1]];
    // a join cuts the road it meets: put back when the tunnel goes
    const before = roads.map((road) => road.pts);
    const joined = pair.map((lane) => {
      const [from, out] = lane.pts, len = Math.hypot(out[0] - from[0], out[1] - from[1]) || 1;
      const dir: Point = [(out[0] - from[0]) / len, (out[1] - from[1]) / len];
      // the road that ends at the mouth runs on into the tunnel; else the nearest road is joined
      return continueRoad(roads, out, dir, blocked, FOOT_REACH_M)
        || joinFrom(roads, out, dir, blocked);
    });
    if (joined.some((pts) => !pts)) {
      roads.forEach((road, index) => { road.pts = before[index]; });
      continue;
    }
    pair.forEach((lane, side) => { lane.pts = [lane.pts[0], ...joined[side]!]; });
    keepLanes.push(...pair);
    keepProps.push(...tunnels.props.filter((prop) => pair.some((lane) =>
      Math.hypot(prop.x - lane.pts[0][0], prop.y - lane.pts[0][1]) < 1)));
  }
  const gone = new Set(tunnels.lanes.filter((lane) => !keepLanes.includes(lane)));
  site.lanes = site.lanes.filter((lane) => !gone.has(lane));
  tunnels.lanes.splice(0, tunnels.lanes.length, ...keepLanes);
  // portals of footpath tunnels stay (no road); those of vehicle tunnels only when joined
  tunnels.props.splice(0, tunnels.props.length, ...tunnels.props.filter((prop) =>
    keepProps.includes(prop) || prop.h! < 6));
}

/**
 * The venue's boards (spec.boards) on its barriers, each clear of the props, the roads and the
 * marshal posts (a post has no box: a board keeps POST_CLEAR_M off its centre).
 * @param site the venue's builders' state
 * @param edge the edge's barriers and tyres
 * @param outerWall an oval's outside wall (a board named to the wall stands only on it)
 * @param props the props standing
 * @returns the boards, each with its 18 m face as its box (nothing else stands on it)
 */
function venueBoards(site: Site, edge: { barriers: Barrier[]; cones: Cone[] },
  outerWall: Barrier | null, props: Prop[]): Prop[] {
  const posts = props.filter((prop) => prop.kind === 'marshal'), boards: Prop[] = [];
  for (const board of site.build.spec.boards) {
    const rails = board.on ? [...edge.barriers, ...(outerWall ? [outerWall] : [])]
      .filter((rail) => rail.kind === board.on) : edge.barriers;
    const prop = boardOnArmco(rails, edge.cones, site.loops, site.place(board.at), board.label,
      site.rims, (x, y) => inBuilding([...props, ...boards], x, y, 1.5)
        || onLanes(site.lanes, x, y, 1.5)
        || posts.some((post) => Math.hypot(post.x - x, post.y - y) < POST_CLEAR_M),
      board.on === 'wall' ? WALL_BOARD_BACK_M : undefined);
    if (prop) boards.push({ ...prop, w: 18, h: 1.2 });
  }
  return boards;
}

/**
 * Marshal posts kept clear: moved out from the track (2 m a try) off every barrier, tyre wall,
 * road and building, or left out.
 * @param site the venue's builders' state
 * @param posts the posts (moved in place)
 * @param barriers the edge's barriers
 * @param tyres the edge's tyre walls
 * @returns the posts that stand clear
 */
function clearPosts(site: Site, posts: Prop[], barriers: Barrier[], tyres: Cone[]): Prop[] {
  const railPts = barriers.flatMap((rail) => rail.pts);
  // (off every layout's road too: a corner's outside can be another layout's track)
  const clear = (post: Prop) => !onLanes(site.lanes, post.x, post.y, 2)
    && nearestLoop(site.loops, post.x, post.y).hit.dist > HALF_ROAD + POST_ROAD_M
    // (nor on a kerb: a wide one reaches past the 2 m)
    && site.loops.every((loop) => {
      const hit = querySubtrack(loop, post.x, post.y);
      return !(hit.dist < HALF_ROAD + kerbOut(loop, hit.trackDist, hit.side) + POST_KERB_M);
    })
    && !inSolid(site, post.x, post.y, 2)
    && railPts.every(([x, y]) => Math.abs(x - post.x) > 2.5 || Math.abs(y - post.y) > 2.5)
    // (nor on a tyre wall: a stack inside its hut)
    && tyres.every((tyre) => Math.hypot(tyre.x - post.x, tyre.y - post.y) > POST_TYRE_M);
  return posts.filter((post) => {
    for (let tries = 0; tries < 5; tries++) {
      if (clear(post)) return true;
      const { sub, hit } = nearestLoop(site.loops, post.x, post.y);
      const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
      post.x += centre.nx * side * 2;
      post.y += centre.ny * side * 2;
    }
    return false;
  });
}

/**
 * The venue's builders' state to start from: the map's placer, the traps, the real tyre walls and
 * rails, the pieces no layout races (an old line beside a chicane: inside the edge, as a trap)
 * and every layout's rim.
 * @param build the venue at game scale
 * @param closed the lanes of the pieces this layout does not race
 * @returns the site, the trap zones and the real lines
 */
function venueSite(build: VenueBuild, closed: Lane[]):
  { site: Site; traps: Zone[]; lines: RealLines } {
  const loops = Object.values(build.loops), spec = build.spec;
  const widen = (VENUE_ROAD_M - spec.realRoadM * build.scale) / 2;
  const place = makePlacer(build.scale, loops, widen);
  const traps = trapZones(spec.data.traps.map((trap) => trap.pts.map(place)), loops);
  const lines = { walls: (spec.tyreWalls || []).map((wall) => boxedLine(wall.map(place))),
    ...railLines(spec, place) };
  const pieces = closed.filter((lane) => {
    const mid = pointAlong(lane.pts, lineLength(lane.pts) / 2);
    return !!mid && !loops.some((loop) => querySubtrack(loop, mid.x, mid.y).dist < HALF_ROAD);
  });
  const site: Site = { build, loops, rims: buildRims(loops, traps,
    { walls: lines.walls, pieces, runoff: spec.runoffM }),
    place, rnd: parkMiller(spec.seed), lanes: [...closed], buildings: [], portals: [],
    armco: new Set(), pitPts: [] };
  return { site, traps, lines };
}

/**
 * The hand finish's moves (spec.finish): a building our placing pushed onto a road moved off it.
 * @param site the venue's builders' state (its buildings moved in place)
 */
function finishMoves(site: Site): void {
  const spec = site.build.spec;
  for (const { at, by } of spec.finish?.move || []) {
    const building = site.buildings.find((prop) => inBuilding([prop], at[0], at[1], 0));
    if (!building) console.warn(`venue ${spec.id}: finish move at ${at} meets no building`);
    else Object.assign(building, { x: building.x + by[0], y: building.y + by[1] });
  }
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
  const { site, traps, lines } = venueSite(build, closed);
  // (a venue with no pit lane mapped - a rallycross venue - has none, nor a pit wall)
  const pits = ([] as string[]).concat(spec.pitLane || []).map((name) => pitLane(site, name));
  const pitLanes = pits.map((pit) => pit.lane);
  const pitWalls = pits.flatMap((pit) => (pit.wall ? [pit.wall] : []));
  site.lanes.push(...pitLanes);
  site.pitPts = pitLanes.map((lane) => lane.pts);
  const bridges = venueBridges(site);
  site.lanes.push(...bridges.lanes);
  // the buildings first: the tunnels' portals and the edge keep off them, the roads go round them
  site.buildings = venueBuildings(site, pitLanes);
  finishMoves(site);
  const tunnels = venueTunnels(site);
  site.lanes.push(...tunnels.lanes);
  site.portals = tunnels.props;
  // the pit wall and an oval's outside wall (spec.ovalWall) are their stretches' barriers: the edge
  // keeps off them (with a rail mapped by the pit wall, Armco stood just behind it)
  const outerWall = ovalWall(site), walls = [...pitWalls, ...(outerWall ? [outerWall] : [])];
  const edge = buildEdge(site.rims, { loops, lanes: site.lanes,
    blocked: (x, y) => inBuilding(site.buildings, x, y, 1)
      || pitWalls.some((wall) => distToLine(wall.pts, x, y) < PIT_WALL_CLEAR_M)
      || (!!outerWall && distToLine(outerWall.pts, x, y) < OVAL_WALL_CLEAR_M),
    roads: pitLanes }, traps,
  edgeNeeds(site, bridges.props, tunnels.props, lines));
  for (const rail of edge.barriers)
    for (const [x, y] of resample(rail.pts, 1)) site.armco.add(cellKey(x, y));
  const roads = venueRoads(site);
  site.lanes.push(...roads);
  // the road network cleaned (no road doubled) and settled (every end meeting something - a road
  // ending at a bridge's ramp or a tunnel's mouth meets it), THEN the bridges and tunnels joined
  // to it, and no road changed after (a later change left an approach hooked to nothing)
  const cleanRoads = withoutDuplicates(site, roads, pitLanes);
  const fixedProps = [...site.buildings, ...bridges.props, ...tunnels.props];
  const roadBounds = venueBounds(loops, [...pitLanes, ...cleanRoads], fixedProps);
  const feet = [...bridges.lanes, ...tunnels.lanes].map((lane) => lane.pts[lane.pts.length - 1]);
  const goodRoads = tidyRoads(site, cleanRoads,
    { zones: venuePaddocks(site, false).zones, bounds: roadBounds, feet });
  // eased once more (a joint carried on can bend sharply where it meets the old end)
  for (const road of goodRoads) road.pts = smoothLine(road.pts, 2, 3, true);
  // the hand finish (spec.finish): the joints no rule makes cleanly
  const finished = handFinish(site, goodRoads);
  // an approach's edge keeps 1 m off every building (its centre half a road further)
  joinApproaches(bridges, finished,
    (x, y) => inBuilding(site.buildings, x, y, 1 + APPROACH_HALF_M));
  joinTunnels(site, tunnels, finished);
  const paddocks = venuePaddocks(site, true);
  const props: Prop[] = [...site.buildings, ...bridges.props, ...tunnels.props,
    ...paddocks.props, ...clearPosts(site, marshalPosts(site.rims), edge.barriers, edge.cones),
    startGantry(site, sub, pitWalls)];
  props.push(...venueBoards(site, edge, outerWall, props));
  const bounds = venueBounds(loops, [...pitLanes, ...bridges.lanes, ...tunnels.lanes,
    ...finished], props);
  const zones = [...traps, ...paddocks.zones, ...venuePads(site), ...venueAero(site)];
  const lanes = [...pitLanes, ...bridges.lanes, ...tunnels.lanes, ...finished];
  props.push(...venuePlanes(site, zones, props));
  const covers = venueWater(site), patches = venueMown(site);
  // (no tree whose trunk stands on a barrier: its solid box, a quarter of its size either way)
  const railGrid = makePointGrid([...walls, ...edge.barriers].flatMap((rail) => rail.pts));
  props.push(...venueTrees(site, bounds, props, zones, { covers, patches }).filter((tree) =>
    !isAnyPointInBox(railGrid, tree.x, tree.y, (tree.s || 4) / 4 + TREE_RAIL_M)));
  // the mapped tyre walls, spaced along each line, none on a road - nor where the edge already
  // stands its two rows along it (laid again, the wall stood three deep at Dongington)
  const edgeTyres = makePointGrid(edge.cones.map((tyre): Point => [tyre.x, tyre.y]));
  const karting = spec.data.tyres.flatMap((line) => evenly(placeAll(site, line.pts), 1)
    .filter(([x, y]) => !onLanes(site.lanes, x, y, 0.6)
      && !isAnyPointWithin(edgeTyres, x, y, MAP_WALL_CLEAR_M))
    .map(([x, y]) => ({ x, y, kind: 'tyrestack' })));
  return { lanes, zones: [...zones, ...venueParks(site)], cones: [...edge.cones, ...karting],
    barriers: [...walls, ...edge.barriers],
    props, paint: pitLanes.flatMap((lane) => pitLines(site, lane)), bounds, covers, patches };
}

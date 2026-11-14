// world/venue.ts - A REAL CIRCUIT AS ONE VENUE (owner 11-07: "one track like the real thing that
// can be modified simply to change like the real thing", "the same / similar decorations around
// the track for both" layouts). A venue's data (world/levels/venues/*.ts, written by
// tools/osmvenue.mjs from OpenStreetMap) holds every road piece of the real place in real metres;
// a LAYOUT is the ordered list of pieces it races. Every layout gets the same scenery, built from
// all the layouts together (world/venuescenery.ts); the pieces a layout does not race stay as
// road, closed by a row of tyres at each junction. Scaled to SHARE of real length (3/4, the
// game's 13 m road), calibrated on one layout's real lap: positions and the footprints of stands,
// buildings, paddocks, traps and woods scale with it; things sized to the cars do not.
import { autoKerbs, createSubtrack, traceTrack } from "./subtrack.ts";
import { SURFACES } from "./surfaces.ts";
import { prepBumps } from "./terrain.ts";
import { onTrack, querySubtrack } from "./tyrewall.ts";
import { splitLineDist } from "./splitstart.ts";
import { solidsFromProps } from "./barriers.ts";
import { venueCrossings } from "./crossings.ts";
import { markUnder } from "./trackunder.ts";
import { pitTunnelPortals, tunnelSpans, underParapets, underPortals, underSpans }
  from "./venuecross.ts";
import { tidyBarriers } from "./venuetidy.ts";
import { evenStadiumEdge } from "./stadiumtidy.ts";
import { CIRCUIT_BUSHES } from "./levels/bushes.ts";
import { buildVenueScenery } from "./venuescenery.ts";
import { VENUE_ROAD_M, distToLine, isNearLine, kerbOut, lineLength, pointAlong }
  from "./venuegeo.ts";
import { laneBehindPole, laneSpawn, venueJoker, venueStartLane } from "./venuejoker.ts";
import { nearWater } from "./venueoval.ts";
import type { Barrier, Bump, Camber, Cone, Cover, Lane, Level, Point, Subtrack } from "./types.ts";

/** A turned rectangle from the map (real m, the long side along w). */
export interface VenueBox { name: string; x: number; y: number; w: number; h: number; rot: number }

/** What tools/osmvenue.mjs writes for a venue (real metres, the game frame). */
export interface VenueData {
  // a piece with a surface is raced on it (a rallycross lap's gravel section: 'dirt')
  pieces: { name: string; surface?: keyof typeof SURFACES; pts: Point[] }[];
  layouts: Record<string, [string, number][]>;
  pitLanes: { name: string; pts: Point[] }[];
  roads: { kind: string; width: number; bridge: boolean; pts: Point[] }[];
  footbridges: { pts: Point[] }[];
  dirt: { name: string; pts: Point[] }[];
  karting: { pts: Point[] }[];
  tunnels: { kind: string; pts: Point[] }[];
  traps: { pts: Point[] }[];
  tyres: { pts: Point[] }[];
  stands: VenueBox[];
  buildings: (VenueBox & { kind: string })[];
  paddocks: (VenueBox & { surface: string; pts: Point[] })[];
  woods: { pts: Point[] }[];
  homes: { pts: Point[] }[];
  // the real circuit's rails (OSM guard rails and concrete barriers; written for venues since
  // Castle Kum): where spec.followRails is set the Armco stands where they do
  rails?: { kind: string; pts: Point[] }[];
  // an airfield's runways, taxiways (lines, width real m) and aprons (areas): Thruxton's infield
  aero?: { kind: string; surface: string; width: number; area: boolean; pts: Point[] }[];
  // hedgerows and tree rows along the field edges (trees stand along them)
  rows?: { pts: Point[] }[];
  // lakes and ponds (scenery water)
  water?: { name: string; pts: Point[] }[];
  // a paved town's parks, gardens, lawns and woods (outlines: world/venueparks.ts)
  parks?: { name: string; pts: Point[] }[];
}

/** One venue level's hand-set facts (real metres in the venue data's frame). */
export interface VenueSpec {
  id: string;   // the venue (VENUE_DROPPED's key)
  data: VenueData;
  share: number;   // of real length (1/2)
  realRoadM: number;   // the real road's width, m (the game's is 13: the map steps back)
  calibrate: { layout: string; realLapM: number };   // the layout whose real lap sets the scale
  start: Point;   // the start / finish line
  // the start / finish line where the spot's foot is on the line, between the map's points
  // (Donington draws its pit straight as two; the others start at the map's point nearest the spot)
  startOnLine?: boolean;
  starts?: Record<string, Point>;   // a layout's own start / finish line where it has another
  // m (game): the tightest radius its traced layouts keep, where the real hairpins are tighter
  // than VENUE_MIN_R at the venue's scale (eased wider, a hairpin's two legs were drawn together)
  minR?: number;
  // the trace's smoothing (world/subtrack.ts traceTrack passes / kern), stronger where the map's
  // line jogs a few metres along a fast banked bend (Dieatona's tri-oval)
  trace?: Record<string, { passes: number; kern: number }>;
  // the data's pit lanes in use (none: a venue with no pit lane; two: Silverstone's Wing and its
  // National pits, both standing for every layout)
  pitLane?: string | string[];
  // a pit lane that cuts inside a corner (Silverstone's into the Wing, inside Club): where it
  // stands inside a bend further off than the bend's radius it is laid as mapped (the road's
  // measure folds)
  pitCuts?: boolean;
  // a pit lane end that does not merge into the track: held at the lane's full clearance (Yass
  // Marina's pit lane runs on into its exit tunnel, its exit lane comes out of it)
  pitHeld?: Record<string, 'start' | 'end'>;
  hills: Bump[];   // the hills (r and d / h in real m: scaled with the map)
  // spectator earth banks; a catch fence in front of each unless fenced is false (the sources show
  // its viewers behind the circuit's rail, no fence)
  banks: { pts: Point[]; r: number; h: number; fenced?: boolean }[];
  // advertising boards (the road side nearest; on: only on that kind of barrier)
  boards: { at: Point; label: string; on?: Barrier['kind'] }[];
  bridgeLabel?: string;   // painted on the footbridge
  // the map warped before it is built: past a line (through at, normal dir) everything moves
  // shift m along dir, eased in over band m (more room where the real place is tight)
  warps?: { at: Point; dir: Point; band: number; shift: number }[];
  // the hand finish, game m (owner 11-07: "maybe if needs hand finish to get clean road
  // connections"): where the mapped roads cannot be joined cleanly by rule, a building our placing
  // pushed onto a road is moved off it, a generated road is cut short at a point (the side toward
  // keep kept) or dropped, and roads drawn by hand laid in (world/venueroads.ts handFinish)
  finish?: {
    move?: { at: Point; by: Point }[];   // the building standing on at moved by
    cut?: { at: Point; keep: Point }[];
    drop?: Point[];
    roads?: { pts: Point[]; width?: number }[];
  };
  // m (game) past the road's edge the edge's barrier stands where no trap, tyre wall or unraced
  // piece sets it (world/venueedge.ts RUNOFF_M when not given): Bathworst's walls stand hard by
  // the road
  runoffM?: number;
  // the real tyre walls where the run-off is grass, no trap (real m, each a line along the wall):
  // Armco there with the two tyre rows in front, as behind a trap (world/venueedge.ts)
  tyreWalls?: Point[][];
  // surfaces laid by hand that the map does not carry (real m: centre, size, turn; a surface
  // sample the owner keeps, as Castle Kum's skid pan)
  pads?: { at: Point; w: number; h: number; rot: number; surface: keyof typeof SURFACES }[];
  // the edge follows the real circuit's rails (data.rails, owner 11-08 for Castle Kum: "keep it
  // like the real track where possible"): Armco where they are, a catch fence there instead where
  // spectators stand - in place of open run-off away from traps and hazards
  followRails?: boolean;
  // rails seen on aerial photographs that the map does not carry (real m), followed as its own
  railsSeen?: Point[][];
  // a world circuit: its edge mixed - a mapped fence's chain link, a wooden fence on the open
  // run-off (world/venuefences.ts)
  mixFences?: boolean;
  // landmarks the map does not carry (a prop kind at its real spot, size m across, scaled with the
  // map): where the sources show them - a long one len m along, turned rot (Moanaco's yachts)
  // (a flag its colour)
  landmarks?: { at: Point; kind: string; size: number; len?: number; rot?: number; col?: string;
    seed?: number }[];
  // light aircraft parked on the airfield's grass stands (data.aero stands), one a colour
  planes?: string[];
  // an oval's: races start rolling; each layout's banking (world/terrain.ts camberTable: sections
  // by lap metre); the concrete wall round the named layout's outside, gapM past its edge
  rollingStart?: boolean;
  camber?: Record<string, Camber>;
  // a Race of Champions stadium's start: the cars side by side on the path's two halves, each
  // timed from its own line (Level.splitStart)
  splitStart?: boolean;
  ovalWall?: { layout: string; gapM: number; kind: Barrier['kind'] };
  // a rallycross layout's START LANE: its pieces in driving order from the dead end of the start
  // straight to where it meets the lap (the grid stands on it, off the lap; ai/line.ts startLane)
  startLane?: { layout: string; pieces: string[] };
  // a rallycross layout's JOKER: the part of another layout's loop (`loop`) round `near` (real m)
  // that this layout does not race, a lane a car must take once in a race (game/rules.ts)
  joker?: { layout: string; loop: string; near: Point };
  // patterns mown into the grass: pixel art in short grass ('#' a square pxM game m across, any
  // other character the grass left long), its middle at `at` (real m), the rows top to bottom
  mown?: { at: Point; pxM: number; rows: string[] }[];
  // the most trees in its woods (world/venuescenery.ts MAX_TREES, 260, for a venue that does not
  // say): a venue in a forest (Spa in the Ardennes, owner 11-09) has more
  trees?: number;
  // a figure of eight (Snoozuka): the piece whose stretch runs under the road where the layout's
  // loop crosses itself, in a cut and under the road over it (world/venuecross.ts)
  // (spareM: m wider its cut each side than the 0.6 m by the road - a stadium's, where a car on the
  // lane's edge still turning out of the bend met the portal wall's end; clearM: m further its
  // lintels stand from the road over - where the roads cross at a shallow angle the cut's corner
  // came within a metre of the bridge road's edge)
  crossover?: { under: string; spareM?: number; clearM?: number };
  // the race road's own tunnel under the ground, no road over it: the piece mapped as the tunnel
  // (Moanaco's under the shore's hotels; world/venuecross.ts tunnelSpans) - a drivable underpass
  // of the race road whose walls follow its bend
  tunnel?: { under: string };
  // a pit lane's tunnel under the track: its two open ends, game m (Yass Marina's pit exit, under
  // the first corner; world/venuecross.ts pitTunnelPortals)
  pitTunnel?: { a: Point; b: Point };
  // the ground off the road where it is not grass (a street circuit's pavements: Moanaco's
  // concrete, its parks laid as grass pads); grass when not given
  base?: keyof typeof SURFACES;
  // a street circuit's barriers tidied: loops cut out, stubs dropped, near ends joined
  // (world/venuetidy.ts; Moanaco's) - 'fences': an Armco end joined to a catch fence's too (Wobbly)
  tidyEdge?: boolean | 'fences';
  // a stadium's tidied edge made even (world/stadiumtidy.ts): its Armco and catch fences eased, a
  // free end carried on to the run beside it
  evenEdge?: boolean;
  // no bushes (a stadium's pitch: Wobbly Stadium)
  bushless?: boolean;
  // no kerbs (a track laid for a day on a stadium's pitch: Wobbly Stadium)
  kerbless?: boolean;
  // a stadium's own bowl (The Bird's Mess): its stands' seats (two tiers' colours) and its roof
  // ring's membrane with a steel lattice over it, in that colour (world/venuescenery.ts; drawn by
  // render/props/buildings.ts drawGrandstand, scenery.ts drawBlock) - the stands and roof only
  bowlLook?: { seats: [string, string]; roof: string; lattice: string };
  // loose objects laid by hand (real m; the highway's debris kinds - pallets, barrels, tarps -
  // and tyres): a venue's litter, kept off the road as every loose object is (tidyLoose)
  litter?: { at: Point; kind: string; col?: string; rot?: number }[];
  // a dressing pass's props (as landmarks) and loose objects (as litter), laid after the boards
  // and kept clear of them (world/venuebowl.ts venueDress)
  dress?: { props: NonNullable<VenueSpec['landmarks']>; litter: NonNullable<VenueSpec['litter']> };
  // the pit lane's surface where the venue's ground is concrete too (Moanaco's: tarmac); concrete
  // when not given
  pitSurface?: keyof typeof SURFACES;
  seed: number;
}

/** A venue at its game scale: the shared parts every layout's level is made from. */
export interface VenueBuild {
  spec: VenueSpec;
  scale: number;   // game m per real m
  loops: Record<string, Subtrack>;   // every layout's traced road, at game scale
  pieces: VenueData['pieces'];   // every road piece, at game scale
}

// m: the tightest radius a traced layout keeps (half the road + kerb + margin)
const VENUE_MIN_R = 15.5;
// m in from a junction where the tyre row closing an unraced piece stands
const CLOSE_IN_M = 14;
// m along an unraced piece the closing row may go to find a clear place
const CLOSE_LOOK_M = 120;
// m a closing row's tyres keep past the raced road's edge - past its kerb where it has one
const CLOSE_CLEAR_M = 1.5;
// m a closing row's tyres keep from another closing row's (two pieces forking at one junction
// had their rows crossed in an X at Sillystone)
const CLOSE_APART_M = 1.2;
const ROUND = (value: number) => Math.round(value * 100) / 100;

/**
 * A layout's centreline: its pieces end to end (a -1 piece run backwards), each joint once.
 * @param data the venue data
 * @param layout the layout id
 * @returns the closed centreline, real metres
 */
function layoutLine(data: VenueData, layout: string): Point[] {
  const line: Point[] = [];
  for (const [name, way] of data.layouts[layout]) {
    const piece = data.pieces.find((entry) => entry.name === name);
    if (!piece) throw new Error(`venue: no road piece ${name}`);
    const pts = way > 0 ? piece.pts : piece.pts.slice().reverse();
    line.push(...(line.length ? pts.slice(1) : pts));
  }
  if (Math.hypot(line[0][0] - line.at(-1)![0], line[0][1] - line.at(-1)![1]) < 0.5) line.pop();
  return line;
}

/**
 * A closed line's length.
 * @param line the points
 * @returns metres
 */
function loopLength(line: Point[]): number {
  let total = 0;
  for (let i = 0; i < line.length; i++) {
    const next = line[(i + 1) % line.length];
    total += Math.hypot(next[0] - line[i][0], next[1] - line[i][1]);
  }
  return total;
}

/**
 * Turns a closed line to start at the point nearest a spot (onSegment: at the spot's foot on the
 * line between its points - a start on a straight the map draws as two points).
 * @param line the points
 * @param spot where it should start
 * @param onSegment the foot on the line, not the nearest of its points
 * @returns the same loop from that point
 */
function startAt(line: Point[], spot: Point, onSegment = false): Point[] {
  let best = 0, bestSq = Infinity, foot: Point | null = null;
  line.forEach(([x, y], i) => {
    const [toX, toY] = line[(i + 1) % line.length], dx = toX - x, dy = toY - y;
    // (on a segment: the spot's foot on it, else the point itself)
    const frac = onSegment ? Math.max(0, Math.min(1,
      ((spot[0] - x) * dx + (spot[1] - y) * dy) / (dx * dx + dy * dy || 1))) : 0;
    const atX = x + dx * frac, atY = y + dy * frac;
    const distSq = (atX - spot[0]) ** 2 + (atY - spot[1]) ** 2;
    if (distSq < bestSq)
      [bestSq, best, foot] = [distSq, i, frac > 0 && frac < 1 ? [atX, atY] : null];
  });
  // the foot between two points starts the loop, the next point after it
  if (foot) return [foot, ...line.slice(best + 1), ...line.slice(0, best + 1)];
  return [...line.slice(best), ...line.slice(0, best)];
}

/**
 * A layout's road at game scale: traced (smoothed, the tightest corners eased to VENUE_MIN_R),
 * its kerbs found.
 * @param spec the venue
 * @param layout the layout id
 * @param scale game m per real m
 * @returns the subtrack
 */
function traceLayout(spec: VenueSpec, layout: string, scale: number): Subtrack {
  const line = startAt(layoutLine(spec.data, layout), spec.starts?.[layout] || spec.start,
    spec.startOnLine);
  const pts = traceTrack(line, { mpp: scale, cx: 0, cy: 0, rMin: spec.minR || VENUE_MIN_R,
    ...spec.trace?.[layout] });
  const loose = looseStretches(spec, layout, scale, pts);
  const sub = createSubtrack(pts, VENUE_ROAD_M, layoutSectors(loose), [], true);
  // no kerbs on a loose stretch (nor on a venue with none: spec.kerbless)
  sub.curvedKerbs = spec.kerbless ? [] : autoKerbs(sub,
    { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 })
    .filter((kerb) => !loose.some((run) => kerb.startDist < run.to && kerb.endDist > run.from));
  return sub;
}

/** A stretch of a layout's lap raced on a surface of its own (lap m, game scale). */
interface Stretch { from: number; to: number; surface: keyof typeof SURFACES }

/**
 * Where a layout runs over the pieces that have a surface of their own (a rallycross lap's gravel
 * section): each such piece's ends found on the traced line.
 * @param spec the venue
 * @param layout the layout id
 * @param scale game m per real m
 * @param pts the layout's traced line
 * @returns the stretches in lap order (none for an all-tarmac layout)
 */
function looseStretches(spec: VenueSpec, layout: string, scale: number,
  pts: Point[]): Stretch[] {
  const steps = spec.data.layouts[layout].map(([name, way]) =>
    ({ piece: spec.data.pieces.find((entry) => entry.name === name), way }))
    .filter((step) => step.piece?.surface);
  if (!steps.length) return [];
  const probe = createSubtrack(pts, VENUE_ROAD_M, [], [], true);
  const lapAt = ([x, y]: Point) => querySubtrack(probe, x * scale, y * scale).trackDist;
  return steps.flatMap(({ piece, way }): Stretch[] => {
    const ends = way > 0 ? piece!.pts : piece!.pts.slice().reverse();
    const from = lapAt(ends[0]), until = lapAt(ends.at(-1)!), surface = piece!.surface!;
    // (one over the line: its two parts)
    return until > from ? [{ from, to: until, surface }]
      : [{ from, to: probe.totalDist, surface }, { from: 0, to: until, surface }];
  }).sort((first, second) => first.from - second.from);
}

/**
 * A layout's sectors: race tarmac but for its loose stretches (none: all race tarmac, as ever).
 * @param loose the loose stretches in lap order
 * @returns the sectors
 */
function layoutSectors(loose: Stretch[]): Subtrack['sectors'] {
  const sectors: Subtrack['sectors'] = [];
  let upTo = 0;
  for (const run of loose) {
    if (run.from > upTo) sectors.push({ startDist: upTo, endDist: run.from,
      surface: SURFACES.racetarmac });
    sectors.push({ startDist: run.from, endDist: run.to, surface: SURFACES[run.surface] });
    upTo = run.to;
  }
  sectors.push({ startDist: upTo, endDist: 1e9, surface: SURFACES.racetarmac });
  return sectors;
}

/**
 * A venue's spec with its map warped (spec.warps): every point and every x / y in its data,
 * hills, banks, boards, tyre walls, rails seen, pads, landmarks and start moved by the warps.
 * @param spec the venue as mapped
 * @returns the venue warped (the same object with no warps)
 */
function warpSpec(spec: VenueSpec): VenueSpec {
  const warps = spec.warps || [];
  if (!warps.length) return spec;
  const move = ([x, y]: Point): Point => {
    let outX = x, outY = y;
    for (const warp of warps) {
      const past = (x - warp.at[0]) * warp.dir[0] + (y - warp.at[1]) * warp.dir[1];
      const frac = Math.max(0, Math.min(1, (past + warp.band / 2) / warp.band));
      const ease = frac * frac * (3 - 2 * frac);
      outX += warp.dir[0] * warp.shift * ease;
      outY += warp.dir[1] * warp.shift * ease;
    }
    return [outX, outY];
  };
  const walk = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      if (value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'number')
        return move(value as Point);
      return value.map(walk);
    }
    if (value && typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [key, entry] of Object.entries(value)) out[key] = walk(entry);
      const box = value as { x?: unknown; y?: unknown };
      if (typeof box.x === 'number' && typeof box.y === 'number')
        [out.x, out.y] = move([box.x, box.y]);
      return out;
    }
    return value;
  };
  return { ...spec, data: walk(spec.data) as VenueData, hills: walk(spec.hills) as Bump[],
    banks: walk(spec.banks) as VenueSpec['banks'], boards: walk(spec.boards) as VenueSpec['boards'],
    tyreWalls: walk(spec.tyreWalls) as VenueSpec['tyreWalls'],
    railsSeen: walk(spec.railsSeen) as VenueSpec['railsSeen'],
    pads: walk(spec.pads) as VenueSpec['pads'],
    landmarks: walk(spec.landmarks) as VenueSpec['landmarks'], start: move(spec.start),
    mown: walk(spec.mown) as VenueSpec['mown'],
    starts: walk(spec.starts) as VenueSpec['starts'] };
}

const builds = new Map<VenueSpec, VenueBuild>();
/**
 * The venue at game scale, built once and shared by its layouts' levels.
 * @param spec the venue
 * @returns the scale, every layout's road and every piece
 */
export function venueBuild(rawSpec: VenueSpec): VenueBuild {
  const cached = builds.get(rawSpec);
  if (cached) return cached;
  const spec = warpSpec(rawSpec);
  const realLap = loopLength(layoutLine(spec.data, spec.calibrate.layout));
  const scale = spec.share * spec.calibrate.realLapM / realLap;
  const loops: Record<string, Subtrack> = {};
  for (const layout of Object.keys(spec.data.layouts))
    loops[layout] = traceLayout(spec, layout, scale);
  const pieces = spec.data.pieces.map((piece) => ({ ...piece,
    pts: piece.pts.map(([x, y]) => [ROUND(x * scale), ROUND(y * scale)] as Point) }));
  // a figure of eight: the stretch that runs under the road over it (world/trackunder.ts)
  const under = spec.crossover && pieces.find((piece) => piece.name === spec.crossover!.under);
  const tunnel = spec.tunnel && pieces.find((piece) => piece.name === spec.tunnel!.under);
  for (const loop of Object.values(loops))
    markUnder(loop, [...underSpans(loop, under?.pts, spec.crossover?.spareM,
      spec.crossover?.clearM),
      ...tunnelSpans(loop, tunnel?.pts)]);
  const build = { spec, scale, loops, pieces };
  builds.set(rawSpec, build);
  return build;
}

/**
 * The pieces a layout does not race, as road lanes (on their own surface), and a tyre row across
 * each where it leaves the layout's road (as the real circuit closes them) - but the joker's and
 * the start lane's, which stay open: those lanes run over them.
 * @param build the venue at game scale
 * @param layout the layout raced
 * @param open the layout's joker and start lanes (null where it has none)
 * @returns the lanes and the tyre stacks
 */
function closedPieces(build: VenueBuild, layout: string,
  open: (Lane | null)[]): { lanes: Lane[]; cones: Cone[] } {
  const raced = new Set(build.spec.data.layouts[layout].map(([name]) => name));
  // (the start lane's pieces by name: the lane is held off the lap, apart from them)
  const start = build.spec.startLane;
  if (start && start.layout === layout) for (const name of start.pieces) raced.add(name);
  const sub = build.loops[layout], half = VENUE_ROAD_M / 2;
  const lanes: Lane[] = [], cones: Cone[] = [];
  for (const piece of build.pieces) {
    if (raced.has(piece.name)) continue;
    const mid = pointAlong(piece.pts, lineLength(piece.pts) / 2);
    if (mid && open.some((lane) => lane && distToLine(lane.pts, mid.x, mid.y) < half)) continue;
    lanes.push({ pts: piece.pts, width: VENUE_ROAD_M,
      surface: SURFACES[piece.surface || 'racetarmac'] });
    for (const end of [piece.pts, piece.pts.slice().reverse()]) {
      if (querySubtrack(sub, end[0][0], end[0][1]).dist > VENUE_ROAD_M) continue;
      const row = closureRow(end, sub, half, cones);
      if (row) cones.push(...row);
    }
  }
  return { lanes, cones };
}

// LOOSE OBJECTS TIDIED (owner 11-09 on Sillystone: "some sloppy place over lapping tyres and
// stuff"): each a disc of its radius (cones.ts) - one at no place, on a barrier's line, on the
// raced road's kerb, or overlapping one kept before it by more than STACKED_SHARE of their radii
// (rows stand 0.95 m apart, touching, by design), is left out (tools/venueaudit.mjs counts each).
// A tyre row laid in front of a curved Armco run folded back over itself, two runs' rows crossed,
// a closing row lay on the edge's. Nor one in the scenery's water (Gerard's inside tyre wall at
// Malarkey, laid along the lake's shore, stood its back row in the lake).
const LOOSE_R: Record<string, number> = { tyrestack: 0.48, tyre: 0.35, bale: 0.8, cone: 0.2 };
const STACKED_SHARE = 0.9, ON_RAIL_SHARE = 0.8, ON_KERB_SHARE = 0.5, LOOSE_CELL_M = 2;
/** A loose object's radius, m (0: one with no size, a tape post). */
export const looseRadius = (cone: Cone): number => LOOSE_R[cone.kind || 'cone'] || 0;
const looseCell = (x: number, y: number): number =>
  Math.floor(x / LOOSE_CELL_M) * 65536 + Math.floor(y / LOOSE_CELL_M);

/**
 * Whether a loose object lies on the raced road's kerb (the strip past its edge a kerb covers).
 * @param sub the raced road
 * @param cone the object
 * @returns true when on one
 */
function onKerb(sub: Subtrack, cone: Cone): boolean {
  const hit = querySubtrack(sub, cone.x, cone.y), half = sub.width / 2;
  if (!(hit.dist >= half)) return false;
  const width = kerbOut(sub, hit.trackDist, hit.side);
  return width > 0 && hit.dist < half + width + looseRadius(cone) * ON_KERB_SHARE;
}

/**
 * Whether a loose object overlaps one already kept.
 * @param grid the kept ones by LOOSE_CELL_M cell
 * @param cone the object
 * @returns true when it does
 */
function stackedOn(grid: Map<number, Cone[]>, cone: Cone): boolean {
  const cellX = Math.floor(cone.x / LOOSE_CELL_M), cellY = Math.floor(cone.y / LOOSE_CELL_M);
  for (let colX = cellX - 1; colX <= cellX + 1; colX++)
    for (let rowY = cellY - 1; rowY <= cellY + 1; rowY++)
      if ((grid.get(colX * 65536 + rowY) || []).some((other) => Math.hypot(other.x - cone.x,
        other.y - cone.y) < (looseRadius(cone) + looseRadius(other)) * STACKED_SHARE)) return true;
  return false;
}

/**
 * A venue's loose objects with none at no place, on a barrier, on a kerb, in water or on another
 * (the first kept). One with no size (a tape post) is kept as it is.
 * @param cones the objects, in the order they were laid (a closing row first)
 * @param barriers the barriers
 * @param sub the raced road
 * @param covers the scenery's covers (its lakes and rivers)
 * @returns the objects kept
 */
export function tidyLoose(cones: Cone[], barriers: Barrier[], sub: Subtrack,
  covers: Cover[] = []): Cone[] {
  const rails = barriers.filter((rail) => rail.kind !== 'line');
  const kept: Cone[] = [], grid = new Map<number, Cone[]>();
  for (const cone of cones) {
    if (!Number.isFinite(cone.x) || !Number.isFinite(cone.y)) continue;
    const reach = looseRadius(cone);
    if (!reach) { kept.push(cone); continue; }
    if (rails.some((rail) => isNearLine(rail.pts, cone.x, cone.y, reach * ON_RAIL_SHARE))
      || onKerb(sub, cone) || nearWater(covers, cone.x, cone.y, reach) || stackedOn(grid, cone))
      continue;
    kept.push(cone);
    const key = looseCell(cone.x, cone.y);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key)!.push(cone);
  }
  return kept;
}

/**
 * The tyre row across an unraced piece: the first place along it from CLOSE_IN_M where every
 * tyre stands CLOSE_CLEAR_M clear of the raced road, its kerb included (where the two part at a
 * shallow angle the piece is still beside the track for a while). A piece that never clears
 * (the old line beside a chicane, a few metres off its kerb all along) is closed in its own half
 * where the most of the row clears, the tyres too near the raced road left out. Every tyre
 * keeps CLOSE_APART_M from the rows already laid.
 * @param line the piece from its junction end
 * @param sub the raced road
 * @param half half the road's width
 * @param laid the closing rows' tyres already laid
 * @returns the tyre stacks, or null if none clears
 */
function closureRow(line: Point[], sub: Subtrack, half: number, laid: Cone[]): Cone[] | null {
  const clear = (tyre: Cone) => {
    const hit = querySubtrack(sub, tyre.x, tyre.y);
    return hit.dist > half + kerbOut(sub, hit.trackDist, hit.side) + CLOSE_CLEAR_M
      && laid.every((other) => Math.hypot(other.x - tyre.x, other.y - tyre.y) >= CLOSE_APART_M);
  };
  const rowAt = (along: number): Cone[] | null => {
    const spot = pointAlong(line, along);
    if (!spot) return null;
    const row: Cone[] = [];
    for (let across = -half + 0.5; across <= half - 0.5; across += 0.95)
      row.push({ x: spot.x + spot.nx * across, y: spot.y + spot.ny * across, kind: 'tyrestack' });
    return row;
  };
  for (let along = CLOSE_IN_M; along < CLOSE_LOOK_M; along += 2) {
    const row = rowAt(along);
    if (!row) break;
    if (row.every(clear)) return row;
  }
  let best: Cone[] | null = null;
  for (let along = CLOSE_IN_M; along <= lineLength(line) / 2; along += 2) {
    const kept = (rowAt(along) || []).filter(clear);
    if (kept.length > (best ? best.length : 0)) best = kept;
  }
  return best;
}

/**
 * The venue's hills and banks at game scale (reach and height scale with the map: same slopes).
 * @param build the venue at game scale
 * @returns the bumps
 */
function venueBumps(build: VenueBuild): Bump[] {
  const scale = build.scale, out: Bump[] = [];
  for (const hill of build.spec.hills)
    out.push({ ...hill, x: hill.x * scale, y: hill.y * scale, r: (hill.r || 0) * scale,
      ...(hill.d !== undefined ? { d: hill.d * scale } : {}),
      ...(hill.h !== undefined ? { h: hill.h * scale } : {}) });
  for (const bank of build.spec.banks) {
    const line = bank.pts.map(([x, y]) => [x * scale, y * scale] as Point);
    const radius = bank.r * scale, every = radius * 0.6;
    for (let along = 0; ; along += every) {
      const spot = pointAlong(line, along);
      if (!spot) break;
      out.push({ kind: 'hump', x: spot.x, y: spot.y, r: radius, h: bank.h * scale });
    }
  }
  return out;
}

/**
 * A venue layout's lap before its level is built: its traced road's length (the scenery is not
 * built; the menu's lap lengths, world/levels/category.ts lapOf).
 * @param spec the venue
 * @param layout the layout
 * @returns metres
 */
export function venueLap(spec: VenueSpec, layout: string): number {
  return venueBuild(spec).loops[layout].totalDist;
}

/**
 * A split start's second line, painted on the rival's lane where it starts and finishes
 * (world/splitstart.ts) - none for any other venue.
 * @param spec the venue
 * @param sub the race road
 * @returns its chequered mark, or none
 */
function splitLinePaint(spec: VenueSpec, sub: Subtrack) {
  if (!spec.splitStart) return [];
  const pos = onTrack(sub, splitLineDist(sub), 0, {});
  return [{ kind: 'chequered', x: pos.x, y: pos.y, len: 1.6, wid: VENUE_ROAD_M, rot: pos.rot }];
}

/**
 * A venue's barriers: the edge's and an underpass's parapets, tidied where the venue asks
 * (spec.tidyEdge) and made even (spec.evenEdge, a stadium's: world/stadiumtidy.ts).
 * @param spec the venue
 * @param sub the race road
 * @param laid the edge's barriers as laid
 * @param lanes the lanes (a join keeps off them)
 * @returns the barriers
 */
function venueBarriers(spec: VenueSpec, sub: Subtrack, laid: Barrier[], lanes: Lane[]): Barrier[] {
  const all = [...laid, ...underParapets(sub)];
  if (!spec.tidyEdge) return all;
  const tidied = tidyBarriers(all, sub, lanes, spec.tidyEdge === 'fences');
  return spec.evenEdge
    ? evenStadiumEdge(tidied, sub, lanes, underPortals(sub)) : tidied;
}

/**
 * One layout of a venue as a level: its road, the closed-off pieces, and the venue's shared
 * scenery.
 * @param spec the venue
 * @param layout the layout raced
 * @param levelId the level id
 * @param name the level's name
 * @returns the level
 */
export function venueLevel(spec: VenueSpec, layout: string, levelId: string,
  name: string): Level {
  const build = venueBuild(spec), sub = build.loops[layout];
  const joker = venueJoker(build, layout);
  const startLane = venueStartLane(build, layout);
  const closed = closedPieces(build, layout, [joker, startLane]);
  // the joker first among the lanes (world/joker.ts takes the first lane by its gate)
  const jokerLanes = [joker, startLane].filter((lane): lane is Lane => !!lane);
  const scenery = buildVenueScenery(build, sub, [...jokerLanes, ...closed.lanes]);
  // a figure of eight's underpass portals, first (world/crossings.ts pairs the portals in order)
  const props = [...underPortals(sub), ...pitTunnelPortals(spec.pitTunnel), ...scenery.props];
  // on the grid near the start lane's dead end, facing along it; else 15 m before the line
  const start = startLane ? laneSpawn(startLane) : onTrack(sub, sub.totalDist - 15, 0, {});
  const lanes = [...jokerLanes, ...scenery.lanes, ...closed.lanes];
  const barriers = venueBarriers(spec, sub, scenery.barriers, lanes);
  // (a closing row's tyre on another road - a pit lane easing in by the junction - left out;
  // none on another, on a barrier or on a kerb - an even edge's barriers as eased)
  const loose = tidyLoose([...closed.cones.filter((tyre) => !scenery.lanes.some((lane) =>
    distToLine(lane.pts, tyre.x, tyre.y) < lane.width / 2)), ...scenery.cones],
  spec.evenEdge ? barriers : scenery.barriers, sub, scenery.covers);
  return {
    id: levelId, name, base: SURFACES[spec.base || 'grass'], subtrack: sub,
    bounds: scenery.bounds,
    floor: Math.ceil(Math.max(-scenery.bounds.x0, scenery.bounds.x1, -scenery.bounds.y0,
      scenery.bounds.y1)),
    camber: spec.camber?.[layout] || { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    ...(spec.rollingStart ? { rollingStart: true } : {}),
    ...(spec.splitStart ? { splitStart: true } : {}),
    ...(startLane ? { startLine: laneBehindPole(startLane) } : {}),
    ...(scenery.patches.length ? { patches: scenery.patches } : {}),
    zones: scenery.zones, covers: scenery.covers, bumps: prepBumps(venueBumps(build)), boards: [],
    seams: false, cones: loose,
    ...(spec.bushless ? {} : { bushes: CIRCUIT_BUSHES }),
    lanes, barriers, props, solids: solidsFromProps(props), crossings: venueCrossings(props),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: VENUE_ROAD_M,
      rot: sub.pts[0].heading }, ...splitLinePaint(spec, sub), ...scenery.paint],
    spawn: { x: start.x, y: start.y, heading: start.rot },
  } as Level;
}

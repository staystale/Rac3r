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
import { solidsFromProps } from "./barriers.ts";
import { CIRCUIT_BUSHES } from "./levels/bushes.ts";
import { VENUE_ROAD_M, buildVenueScenery, pointAlong } from "./venuescenery.ts";
import type { Bump, Cone, Lane, Level, Point, Subtrack } from "./types.ts";

/** A turned rectangle from the map (real m, the long side along w). */
export interface VenueBox { name: string; x: number; y: number; w: number; h: number; rot: number }

/** What tools/osmvenue.mjs writes for a venue (real metres, the game frame). */
export interface VenueData {
  pieces: { name: string; pts: Point[] }[];
  layouts: Record<string, [string, number][]>;
  pitLanes: { name: string; pts: Point[] }[];
  roads: { kind: string; width: number; bridge: boolean; pts: Point[] }[];
  footbridges: { pts: Point[] }[];
  dirt: { name: string; pts: Point[] }[];
  karting: { pts: Point[] }[];
  traps: { pts: Point[] }[];
  fences: { kind: string; pts: Point[] }[];
  rails: { pts: Point[] }[];
  tyres: { pts: Point[] }[];
  stands: VenueBox[];
  buildings: (VenueBox & { kind: string })[];
  paddocks: (VenueBox & { surface: string })[];
  woods: { pts: Point[] }[];
  homes: { pts: Point[] }[];
}

/** One venue level's hand-set facts (real metres in the venue data's frame). */
export interface VenueSpec {
  id: string;   // the venue (VENUE_DROPPED's key)
  data: VenueData;
  share: number;   // of real length (0.75)
  calibrate: { layout: string; realLapM: number };   // the layout whose real lap sets the scale
  start: Point;   // the start / finish line
  pitLane: string;   // the data's pit lane in use
  hills: Bump[];   // the hills (r and d / h in real m: scaled with the map)
  banks: { pts: Point[]; r: number; h: number }[];   // spectator earth banks
  boards: { at: Point; label: string }[];   // advertising boards (the road side nearest)
  bridgeLabel?: string;   // painted on the footbridge
  seed: number;
}

/** A venue at its game scale: the shared parts every layout's level is made from. */
export interface VenueBuild {
  spec: VenueSpec;
  scale: number;   // game m per real m
  loops: Record<string, Subtrack>;   // every layout's traced road, at game scale
  pieces: { name: string; pts: Point[] }[];   // every road piece, at game scale
}

// m: the tightest radius a traced layout keeps (half the road + kerb + margin)
const VENUE_MIN_R = 15.5;
// m in from a junction where the tyre row closing an unraced piece stands
const CLOSE_IN_M = 14;
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
 * Turns a closed line to start at the point nearest a spot.
 * @param line the points
 * @param spot where it should start
 * @returns the same loop from that point
 */
function startAt(line: Point[], spot: Point): Point[] {
  let best = 0, bestSq = Infinity;
  line.forEach(([x, y], i) => {
    const distSq = (x - spot[0]) ** 2 + (y - spot[1]) ** 2;
    if (distSq < bestSq) { bestSq = distSq; best = i; }
  });
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
  const line = startAt(layoutLine(spec.data, layout), spec.start);
  const sub = createSubtrack(
    traceTrack(line, { mpp: scale, cx: 0, cy: 0, rMin: VENUE_MIN_R }), VENUE_ROAD_M,
    [{ startDist: 0, endDist: 1e9, surface: SURFACES.racetarmac }], [], true);
  sub.curvedKerbs = autoKerbs(sub, { maxR: 70, exitR: 30, heavyR: 22, minTurn: 20, mergeGap: 12 });
  return sub;
}

const builds = new Map<VenueSpec, VenueBuild>();
/**
 * The venue at game scale, built once and shared by its layouts' levels.
 * @param spec the venue
 * @returns the scale, every layout's road and every piece
 */
export function venueBuild(spec: VenueSpec): VenueBuild {
  const cached = builds.get(spec);
  if (cached) return cached;
  const realLap = loopLength(layoutLine(spec.data, spec.calibrate.layout));
  const scale = spec.share * spec.calibrate.realLapM / realLap;
  const loops: Record<string, Subtrack> = {};
  for (const layout of Object.keys(spec.data.layouts))
    loops[layout] = traceLayout(spec, layout, scale);
  const pieces = spec.data.pieces.map((piece) => ({ name: piece.name,
    pts: piece.pts.map(([x, y]) => [ROUND(x * scale), ROUND(y * scale)] as Point) }));
  const build = { spec, scale, loops, pieces };
  builds.set(spec, build);
  return build;
}

/**
 * The pieces a layout does not race, as road lanes, and a tyre row across each where it leaves
 * the layout's road (as the real circuit closes them).
 * @param build the venue at game scale
 * @param layout the layout raced
 * @returns the lanes and the tyre stacks
 */
function closedPieces(build: VenueBuild, layout: string): { lanes: Lane[]; cones: Cone[] } {
  const raced = new Set(build.spec.data.layouts[layout].map(([name]) => name));
  const sub = build.loops[layout], half = VENUE_ROAD_M / 2;
  const lanes: Lane[] = [], cones: Cone[] = [];
  for (const piece of build.pieces) {
    if (raced.has(piece.name)) continue;
    lanes.push({ pts: piece.pts, width: VENUE_ROAD_M, surface: SURFACES.racetarmac });
    for (const end of [piece.pts, piece.pts.slice().reverse()]) {
      if (querySubtrack(sub, end[0][0], end[0][1]).dist > VENUE_ROAD_M) continue;
      const spot = pointAlong(end, CLOSE_IN_M);
      if (!spot) continue;
      for (let across = -half + 0.5; across <= half - 0.5; across += 0.95)
        cones.push({ x: spot.x + spot.nx * across, y: spot.y + spot.ny * across,
          kind: 'tyrestack' });
    }
  }
  return { lanes, cones };
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
  const closed = closedPieces(build, layout);
  const scenery = buildVenueScenery(build, sub, closed.lanes);
  const start = onTrack(sub, sub.totalDist - 15, 0, {});
  return {
    id: levelId, name, base: SURFACES.grass, subtrack: sub, bounds: scenery.bounds,
    floor: Math.ceil(Math.max(-scenery.bounds.x0, scenery.bounds.x1, -scenery.bounds.y0,
      scenery.bounds.y1)),
    camber: { maxDeg: 3, refR: 70, crown: 0.02, edge: 6, sections: [] },
    zones: scenery.zones, covers: [], bumps: prepBumps(venueBumps(build)), boards: [],
    seams: false, cones: [...closed.cones, ...scenery.cones], bushes: CIRCUIT_BUSHES,
    lanes: [...scenery.lanes, ...closed.lanes], barriers: scenery.barriers,
    props: scenery.props, solids: solidsFromProps(scenery.props),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: VENUE_ROAD_M,
      rot: sub.pts[0].heading }],
    spawn: { x: start.x, y: start.y, heading: start.rot },
  } as Level;
}

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
import { venueCrossings } from "./crossings.ts";
import { CIRCUIT_BUSHES } from "./levels/bushes.ts";
import { buildVenueScenery } from "./venuescenery.ts";
import { VENUE_ROAD_M, lineLength, pointAlong } from "./venuegeo.ts";
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
  tunnels: { kind: string; pts: Point[] }[];
  traps: { pts: Point[] }[];
  tyres: { pts: Point[] }[];
  stands: VenueBox[];
  buildings: (VenueBox & { kind: string })[];
  paddocks: (VenueBox & { surface: string; pts: Point[] })[];
  woods: { pts: Point[] }[];
  homes: { pts: Point[] }[];
  // the real circuit's rails (OSM guard rails and concrete barriers; written for venues since
  // Castle Cum): where spec.followRails is set the Armco stands where they do
  rails?: { kind: string; pts: Point[] }[];
}

/** One venue level's hand-set facts (real metres in the venue data's frame). */
export interface VenueSpec {
  id: string;   // the venue (VENUE_DROPPED's key)
  data: VenueData;
  share: number;   // of real length (1/2)
  realRoadM: number;   // the real road's width, m (the game's is 13: the map steps back)
  calibrate: { layout: string; realLapM: number };   // the layout whose real lap sets the scale
  start: Point;   // the start / finish line
  pitLane: string;   // the data's pit lane in use
  hills: Bump[];   // the hills (r and d / h in real m: scaled with the map)
  banks: { pts: Point[]; r: number; h: number }[];   // spectator earth banks
  boards: { at: Point; label: string }[];   // advertising boards (the road side nearest)
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
  // the real tyre walls where the run-off is grass, no trap (real m, each a line along the wall):
  // Armco there with the two tyre rows in front, as behind a trap (world/venueedge.ts)
  tyreWalls?: Point[][];
  // surfaces laid by hand that the map does not carry (real m: centre, size, turn; a surface
  // sample the owner keeps, as Castle Cum's skid pan)
  pads?: { at: Point; w: number; h: number; rot: number; surface: keyof typeof SURFACES }[];
  // the edge follows the real circuit's rails (data.rails, owner 11-08 for Castle Cum: "keep it
  // like the real track where possible"): Armco where they are, a catch fence there instead where
  // spectators stand - in place of open run-off away from traps and hazards
  followRails?: boolean;
  // rails seen on aerial photographs that the map does not carry (real m), followed as its own
  railsSeen?: Point[][];
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
// m along an unraced piece the closing row may go to find a clear place
const CLOSE_LOOK_M = 120;
// m a closing row's tyres keep past the raced road's edge - past its kerb where it has one
const CLOSE_CLEAR_M = 1.5;
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

/**
 * A venue's spec with its map warped (spec.warps): every point and every x / y in its data,
 * hills, banks, boards, tyre walls, rails seen, pads and start moved by the warps.
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
    pads: walk(spec.pads) as VenueSpec['pads'], start: move(spec.start) };
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
  const pieces = spec.data.pieces.map((piece) => ({ name: piece.name,
    pts: piece.pts.map(([x, y]) => [ROUND(x * scale), ROUND(y * scale)] as Point) }));
  const build = { spec, scale, loops, pieces };
  builds.set(rawSpec, build);
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
      const row = closureRow(end, sub, half);
      if (row) cones.push(...row);
    }
  }
  return { lanes, cones };
}

/**
 * How far the raced road's kerb reaches past its edge at a spot (0 where it has none there).
 * @param sub the raced road
 * @param trackDist metres along it
 * @param side the side of it
 * @returns metres
 */
function kerbOut(sub: Subtrack, trackDist: number, side: string): number {
  let out = 0;
  for (const kerb of sub.curvedKerbs || []) {
    if (kerb.side !== side) continue;
    const onKerb = (dist: number) => dist >= kerb.startDist && dist <= kerb.endDist;
    if (onKerb(trackDist) || onKerb(trackDist + sub.totalDist)) out = Math.max(out, kerb.width);
  }
  return out;
}

/**
 * The tyre row across an unraced piece: the first place along it from CLOSE_IN_M where every
 * tyre stands CLOSE_CLEAR_M clear of the raced road, its kerb included (where the two part at a
 * shallow angle the piece is still beside the track for a while). A piece that never clears
 * (the old line beside a chicane, a few metres off its kerb all along) is closed in its own half
 * where the most of the row clears, the tyres too near the raced road left out.
 * @param line the piece from its junction end
 * @param sub the raced road
 * @param half half the road's width
 * @returns the tyre stacks, or null if none clears
 */
function closureRow(line: Point[], sub: Subtrack, half: number): Cone[] | null {
  const clear = (tyre: Cone) => {
    const hit = querySubtrack(sub, tyre.x, tyre.y);
    return hit.dist > half + kerbOut(sub, hit.trackDist, hit.side) + CLOSE_CLEAR_M;
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
    crossings: venueCrossings(scenery.props),
    paint: [{ kind: 'chequered', x: sub.pts[0].x, y: sub.pts[0].y, len: 1.6, wid: VENUE_ROAD_M,
      rot: sub.pts[0].heading }, ...scenery.paint],
    spawn: { x: start.x, y: start.y, heading: start.rot },
  } as Level;
}

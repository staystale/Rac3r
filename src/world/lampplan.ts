// THE LAMP PLAN (owner: "lamps / lighting on all levels ... test levels included, have
// fun / be logical"): where each level's lights stand, by its kind (world/levels/category.ts),
// worked out once when the level is first lit. Every spot must be clear: inside the floor, off
// the track and the lanes, away from solids, barriers, loose objects, zones and other lamps.
//   circuits  street lights both sides of the start / finish straight; floodlight pylons every
//             ~140 m round the outside (dark stretches between: what headlights are for)
//   ovals     a ring of floodlights every ~70 m outside, street lights on the start straight
//   rx        floodlights every ~110 m outside
//   rally     floodlights at the start and the finish only (the stage itself stays dark)
//   test      floodlights round the floor's edge, and a LAMP ALLEY: two rows of street lights
//             down an open stretch, to knock over
//   roads     none here (the endless highway lays its own as the road grows:
//             highway/roadlamps.ts)
import { FLOOR } from './bounds.ts';
import { catOf } from './levels/category.ts';
import { eventLightsOn } from './eventlights.ts';
import { smoothOnTrack } from './barriers.ts';
import type { Level, Point, Prop, Subtrack, TrackPoint } from './types.ts';

// street lights: how far out from the track edge their posts stand, spacing, and the stretch of
// the lap round the start / finish line (m before, m after)
const STREET_OUT_M = 2.5, STREET_GAP_M = 34, STRAIGHT_BEFORE_M = 150, STRAIGHT_AFTER_M = 110;
// floodlight pylons: how far out from the track edge, and their spacing by kind, m
const FLOOD_OUT_M = 16;
const FLOOD_GAP_M: Record<string, number> = { circuits: 140, ovals: 70, rx: 110 };
// clearances, m: a street light's post and a pylon's base; lamps apart
const STREET_REACH_M = 1, FLOOD_REACH_M = 2.5, LAMP_APART_M = 8;
// a test ground: the floodlight ring's inset from the floor edge and spacing; the lamp alley's
// length, half width and post spacing
const RING_INSET_M = 24, RING_GAP_M = 90;
const ALLEY_LONG_M = 100, ALLEY_HALF_M = 7, ALLEY_GAP_M = 20;
// zones smaller than this are panels / patches to keep off, m^2 (80 x 80 m)
const PANEL_MAX_M2 = 6400;
// a rally stage's end pylons: tried this far out from the road, then nearby along it, m
const END_OUTS_M = [8, 12, 16], END_SHIFTS_M = [0, -10, 10, -20, 20];

type Spot = { x: number; y: number };
type CornerSpot = { x: number; y: number; rot: number };

// THE BUSY CORNERS (?eventlights=1; owner F1): a floodlight inside each of the tightest corners
// (CORNER_COUNT by kind), off the racing line, on a ring of TYRE_RING_COUNT tyre stacks
// TYRE_RING_M round its base; corners are read as the heading change across CORNER_SPAN_M either
// side, sampled every CORNER_STEP_M, picked CORNER_APART_M apart; the spot is tried CORNER_OUTS_M
// out from the inside edge
const CORNER_COUNT: Record<string, number> = { circuits: 3, rx: 2 };
const CORNER_SPAN_M = 20, CORNER_STEP_M = 5, CORNER_APART_M = 120;
const CORNER_OUTS_M = [14, 18, 11, 22];
const TYRE_RING_M = 2.8, TYRE_RING_COUNT = 10;
const cornerCache = new WeakMap<Level, CornerSpot[]>();
// a generated stage's villages: a building block this near the road, m, gets street lights
// every VILLAGE_GAP_M over VILLAGE_LEN_M of road beside it
const VILLAGE_REACH_M = 40, VILLAGE_GAP_M = 30, VILLAGE_LEN_M = 60;
// a rally stage's fairy-light strings: their length and how far off the road edge, m
const FAIRY_LEN_M = 30, FAIRY_OUT_M = 5;
// a fairy-light string's bulb spacing along the road, and how far off any road a bulb must be, m
const FAIRY_STEP_M = 1.6, FAIRY_CLEAR_M = 2;
const fairyCache = new WeakMap<Level, Point[][]>();

/**
 * The track sample at a distance along it (wrapping), for offsets from the centreline.
 * @param sub the subtrack
 * @param dist distance along the lap, m
 * @returns the sample before that distance
 */
function sampleAt(sub: Subtrack, dist: number): TrackPoint {
  const wrapped = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
  let low = 0, high = sub.pts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (sub.pts[mid].dist <= wrapped) low = mid; else high = mid - 1;
  }
  return sub.pts[low];
}

/**
 * How far a point is from the track's centreline, m (nearest sample; a build-time check).
 * @param sub the subtrack
 * @param spot the point
 * @returns the distance
 */
function trackGap(sub: Subtrack, spot: Spot): number {
  let best = Infinity;
  for (const point of sub.pts)
    best = Math.min(best, Math.hypot(point.x - spot.x, point.y - spot.y));
  return best;
}

/**
 * The distance from a point to a polyline, m.
 * @param pts the polyline
 * @param spot the point
 * @returns the distance
 */
function lineGap(pts: [number, number][], spot: Spot): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[i + 1];
    const dx = toX - fromX, dy = toY - fromY, len2 = dx * dx + dy * dy || 1e-6;
    const along = Math.max(0, Math.min(1, ((spot.x - fromX) * dx + (spot.y - fromY) * dy) / len2));
    best = Math.min(best, Math.hypot(spot.x - fromX - dx * along, spot.y - fromY - dy * along));
  }
  return best;
}

/**
 * Whether a zone is a test panel or patch a lamp must keep off (boxed, or smaller than
 * PANEL_MAX_M2); a floor-sized zone (the Lab's four quarters) is ground to stand on.
 * @param zone the zone
 * @param zone.w its width
 * @param zone.h its height
 * @param zone.boxed a boxed test panel
 * @returns true for a panel
 */
function isPanel(zone: { w: number; h: number; boxed?: boolean }): boolean {
  return !!zone.boxed || zone.w * zone.h < PANEL_MAX_M2;
}

/**
 * Whether a point lies in a zone (a rotated box) grown by a margin.
 * @param zone the zone
 * @param zone.x its centre
 * @param zone.y its centre
 * @param zone.w its width
 * @param zone.h its height
 * @param zone.rot its rotation, radians
 * @param spot the point
 * @param pad the margin, m
 * @returns true inside
 */
function inZone(zone: { x: number; y: number; w: number; h: number; rot?: number }, spot: Spot,
    pad: number): boolean {
  const cos = Math.cos(zone.rot || 0), sin = Math.sin(zone.rot || 0);
  const dx = spot.x - zone.x, dy = spot.y - zone.y;
  return Math.abs(dx * cos + dy * sin) < zone.w / 2 + pad
    && Math.abs(-dx * sin + dy * cos) < zone.h / 2 + pad;
}

/**
 * Whether a lamp may stand here: inside the floor, off the track and its lanes, clear of solids,
 * barriers, loose objects, zones and the lamps already placed.
 * @param level the level
 * @param spot the post's foot
 * @param reach the post's clearance, m
 * @param placed the lamps placed so far
 * @returns true when clear
 */
function isClear(level: Level, spot: Spot, reach: number, placed: Prop[]): boolean {
  if (Math.abs(spot.x) > FLOOR - 6 - reach || Math.abs(spot.y) > FLOOR - 6 - reach) return false;
  if (level.subtrack && trackGap(level.subtrack, spot) < level.subtrack.width / 2 + 1.5)
    return false;
  return isFreeOfThings(level, spot, reach)
    && placed.every((lamp) => Math.hypot(lamp.x - spot.x, lamp.y - spot.y) >= LAMP_APART_M);
}

/**
 * Whether a point is clear of the level's solids, barriers, lanes, loose objects and zones.
 * @param level the level
 * @param spot the point
 * @param reach the clearance, m
 * @returns true when clear
 */
function isFreeOfThings(level: Level, spot: Spot, reach: number): boolean {
  const near = (x: number, y: number, gap: number) => Math.hypot(x - spot.x, y - spot.y) < gap;
  return !(level.solids || []).some((solid) => near(solid.x, solid.y, (solid.r || 1) + reach))
    && !(level.barriers || []).some((barrier) =>
      lineGap(barrier.pts as [number, number][], spot) < reach + 0.8)
    && !(level.lanes || []).some((lane) =>
      lineGap(lane.pts as [number, number][], spot) < lane.width / 2 + reach)
    && !(level.cones || []).some((cone) => near(cone.x, cone.y, reach + 0.8))
    && !(level.zones || []).some((zone) => isPanel(zone) && inZone(zone, spot, reach));
}

/**
 * A lamp at an offset from the track, its arm (or face) toward the track.
 * @param sub the subtrack
 * @param dist distance along the lap, m
 * @param side +1 or -1 (the side of the track normal)
 * @param out metres out from the track edge
 * @param kind streetlight or floodlight
 * @returns the lamp entry
 */
function besideTrack(sub: Subtrack, dist: number, side: number, out: number,
    kind: string): Prop {
  const point = sampleAt(sub, dist), off = side * (sub.width / 2 + out);
  return { kind, x: point.x + point.nx * off, y: point.y + point.ny * off,
    rot: Math.atan2(-point.ny * side, -point.nx * side) };
}

/**
 * Adds a lamp when its spot is clear.
 * @param level the level
 * @param placed the lamps so far (added to)
 * @param lamp the candidate
 */
function tryPlace(level: Level, placed: Prop[], lamp: Prop): void {
  const reach = lamp.kind === 'floodlight' ? FLOOD_REACH_M : STREET_REACH_M;
  if (isClear(level, lamp, reach, placed)) placed.push(lamp);
}

/**
 * Which side of the track is the outside here: the side farther from the track's middle.
 * @param sub the subtrack
 * @param point the sample
 * @returns +1 or -1
 */
function outsideOf(sub: Subtrack, point: TrackPoint): number {
  let midX = 0, midY = 0;
  for (const sample of sub.pts) {
    midX += sample.x;
    midY += sample.y;
  }
  midX /= sub.pts.length;
  midY /= sub.pts.length;
  return (point.x - midX) * point.nx + (point.y - midY) * point.ny >= 0 ? 1 : -1;
}

/**
 * Street lights both sides of the start / finish straight, and pylons round the outside.
 * @param level the level (with a subtrack)
 * @param placed the lamps so far (added to)
 * @param floodGap the pylons' spacing, m (0: none)
 * @param withStraight street lights on the straight
 */
function lightLap(level: Level, placed: Prop[], floodGap: number, withStraight: boolean): void {
  const sub = level.subtrack!;
  if (withStraight) {
    for (let along = -STRAIGHT_BEFORE_M; along <= STRAIGHT_AFTER_M; along += STREET_GAP_M) {
      tryPlace(level, placed, besideTrack(sub, along, 1, STREET_OUT_M, 'streetlight'));
      tryPlace(level, placed, besideTrack(sub, along + STREET_GAP_M / 2, -1, STREET_OUT_M,
        'streetlight'));
    }
  }
  if (!floodGap) return;
  for (let dist = floodGap / 2; dist < sub.totalDist; dist += floodGap) {
    const side = outsideOf(sub, sampleAt(sub, dist));
    tryPlace(level, placed, besideTrack(sub, dist, side, FLOOD_OUT_M, 'floodlight'));
  }
}

/**
 * A rally stage: two pylons at the start and two at the finish; the stage itself dark.
 * @param level the level (with a subtrack)
 * @param placed the lamps so far (added to)
 */
function lightStageEnds(level: Level, placed: Prop[]): void {
  const sub = level.subtrack!, finish = level.stage ? level.stage.finish : sub.totalDist - 20;
  for (const dist of [12, finish]) {
    for (const side of [1, -1]) placeNear(level, placed, sub, dist, side);
  }
}

/**
 * One end pylon on a side of a rally stage: the first clear spot out from the road, then a little
 * along it (trees crowd a forest stage's roadside).
 * @param level the level
 * @param placed the lamps so far (added to)
 * @param sub the subtrack
 * @param dist distance along the stage, m
 * @param side +1 or -1
 */
function placeNear(level: Level, placed: Prop[], sub: Subtrack, dist: number, side: number): void {
  const before = placed.length;
  for (const shift of END_SHIFTS_M) {
    for (const out of END_OUTS_M) {
      tryPlace(level, placed, besideTrack(sub, dist + shift, side, out, 'floodlight'));
      if (placed.length > before) return;
    }
  }
}

/**
 * A generated stage's villages (?eventlights=1; owner F9: public-road stages get street lights
 * where they pass buildings; closed stages - Sweaty Lamb, Killder - stay dark): beside the road
 * nearest each building block within VILLAGE_REACH_M, a street light on the buildings' side
 * every VILLAGE_GAP_M over VILLAGE_LEN_M of road.
 * @param level the level (a generated stage, with a subtrack)
 * @param placed the lamps so far (added to)
 */
function lightVillages(level: Level, placed: Prop[]): void {
  if (!eventLightsOn()) return;
  const sub = level.subtrack!;
  for (const village of villageStretches(level)) {
    for (let along = -VILLAGE_LEN_M / 2; along <= VILLAGE_LEN_M / 2; along += VILLAGE_GAP_M) {
      tryPlace(level, placed, besideTrack(sub, village.dist + along, village.side, STREET_OUT_M,
        'streetlight'));
    }
  }
}

/**
 * A rally stage's fairy lights (?eventlights=1; owner: multi-coloured, on rally stages too):
 * strings beside the road, FAIRY_OUT_M off the edge, both sides over FAIRY_LEN_M at the start
 * and the finish, and on the buildings' side through each village of a generated stage. Worked
 * out once per stage; render/eventglows.ts hangs the bulbs on them.
 * @param level the level
 * @returns each string's bulbs, following the road edge (none off a rally stage or with the
 *   event lights off)
 */
export function stageFairyLights(level: Level): Point[][] {
  if (!eventLightsOn() || catOf(level) !== 'rally' || !level.subtrack) return [];
  let strings = fairyCache.get(level);
  if (strings) return strings;
  const sub = level.subtrack;
  const finish = level.stage ? level.stage.finish : sub.totalDist - 20;
  // a string follows the road edge bulb by bulb (a straight line between its ends cut across the
  // road on a bend); a bulb that would hang over any road (a hairpin's other leg) is left out
  const along = (from: number, side: number): Point[] => {
    const bulbs: Point[] = [];
    for (let dist = from; dist <= from + FAIRY_LEN_M; dist += FAIRY_STEP_M) {
      const bulb = smoothOnTrack(sub, dist, side * (sub.width / 2 + FAIRY_OUT_M));
      if (trackGap(sub, bulb) >= sub.width / 2 + FAIRY_CLEAR_M) bulbs.push([bulb.x, bulb.y]);
    }
    return bulbs;
  };
  strings = [];
  for (const from of [5, finish - FAIRY_LEN_M / 2]) {
    for (const side of [1, -1]) strings.push(along(from, side));
  }
  for (const village of villageStretches(level)) {
    strings.push(along(village.dist - FAIRY_LEN_M / 2, village.side));
  }
  fairyCache.set(level, strings);
  return strings;
}

/**
 * The stretches of a generated stage's road that pass a building block: the nearest road
 * distance and the buildings' side.
 * @param level the level (a generated stage)
 * @returns the stretches
 */
function villageStretches(level: Level): { dist: number; side: number }[] {
  if (!level.gen || !level.subtrack) return [];
  const sub = level.subtrack, out: { dist: number; side: number }[] = [];
  for (const block of (level.props || []).filter((prop) => prop.kind === 'block')) {
    let nearest = sub.pts[0], best = Infinity;
    for (const point of sub.pts) {
      const gap = Math.hypot(point.x - block.x, point.y - block.y);
      if (gap < best) {
        best = gap;
        nearest = point;
      }
    }
    if (best > VILLAGE_REACH_M) continue;
    const side = (block.x - nearest.x) * nearest.nx + (block.y - nearest.y) * nearest.ny >= 0
      ? 1 : -1;
    out.push({ dist: nearest.dist, side });
  }
  return out;
}

/**
 * A test ground: pylons round the floor's edge, and the lamp alley down the first clear stretch
 * nearest the spawn.
 * @param level the level
 * @param placed the lamps so far (added to)
 */
function lightTestGround(level: Level, placed: Prop[]): void {
  const edge = FLOOR - RING_INSET_M;
  for (let along = -edge; along <= edge; along += RING_GAP_M) {
    for (const [x, y] of [[along, -edge], [along, edge], [-edge, along], [edge, along]])
      tryPlace(level, placed, { kind: 'floodlight', x, y, rot: Math.atan2(-y, -x) });
  }
  const spawn = level.spawn, candidates: Spot[] = [];
  for (let y = -edge + 30; y <= edge - 30; y += 20)
    for (let x = -edge + 60; x <= edge - 60; x += 20) candidates.push({ x, y });
  candidates.sort((first, second) => Math.hypot(first.x - spawn.x, first.y - spawn.y)
    - Math.hypot(second.x - spawn.x, second.y - spawn.y));
  for (const middle of candidates) {
    const posts: Prop[] = [];
    for (let along = -ALLEY_LONG_M / 2; along <= ALLEY_LONG_M / 2; along += ALLEY_GAP_M) {
      posts.push({ kind: 'streetlight', x: middle.x + along, y: middle.y - ALLEY_HALF_M,
        rot: Math.PI / 2 });
      posts.push({ kind: 'streetlight', x: middle.x + along, y: middle.y + ALLEY_HALF_M,
        rot: -Math.PI / 2 });
    }
    const laneClear = [-1, -0.5, 0, 0.5, 1].every((share) => isClear(level,
      { x: middle.x + share * ALLEY_LONG_M / 2, y: middle.y }, ALLEY_HALF_M - 1, placed));
    if (laneClear && posts.every((post) => isClear(level, post, STREET_REACH_M, placed))) {
      placed.push(...posts);
      return;
    }
  }
}

/**
 * How sharply the track turns at a distance: the heading change across CORNER_SPAN_M either side.
 * @param sub the subtrack
 * @param dist distance along the lap, m
 * @returns the turn, radians (unsigned)
 */
function turnAt(sub: Subtrack, dist: number): number {
  const before = sampleAt(sub, dist - CORNER_SPAN_M), here = sampleAt(sub, dist);
  const after = sampleAt(sub, dist + CORNER_SPAN_M);
  const headIn = Math.atan2(here.y - before.y, here.x - before.x);
  const headOut = Math.atan2(after.y - here.y, after.x - here.x);
  return Math.abs(Math.atan2(Math.sin(headOut - headIn), Math.cos(headOut - headIn)));
}

/**
 * The lap distances of the track's tightest corners, CORNER_APART_M apart at least.
 * @param sub the subtrack
 * @param count how many
 * @returns their apex distances, m
 */
function tightestCorners(sub: Subtrack, count: number): number[] {
  const turns: [number, number][] = [];
  for (let dist = 0; dist < sub.totalDist; dist += CORNER_STEP_M) {
    turns.push([dist, turnAt(sub, dist)]);
  }
  turns.sort((first, second) => second[1] - first[1]);
  const picked: number[] = [];
  const apart = (first: number, second: number) => {
    const gap = Math.abs(first - second) % sub.totalDist;
    return Math.min(gap, sub.totalDist - gap) >= CORNER_APART_M;
  };
  for (const [dist] of turns) {
    if (picked.length >= count) break;
    if (picked.every((other) => apart(other, dist))) picked.push(dist);
  }
  return picked;
}

/**
 * A clear spot inside a corner, off the racing line, for a floodlight on a ring of tyres: tried
 * at CORNER_OUTS_M out from the track edge on the inside (the side the chord bends toward).
 * @param level the level
 * @param sub its subtrack
 * @param dist the apex's distance, m
 * @returns the spot and the way it faces (toward the apex), or null
 */
function cornerSpot(level: Level, sub: Subtrack, dist: number): CornerSpot | null {
  const apex = sampleAt(sub, dist), before = sampleAt(sub, dist - CORNER_SPAN_M);
  const after = sampleAt(sub, dist + CORNER_SPAN_M);
  const chordX = (before.x + after.x) / 2, chordY = (before.y + after.y) / 2;
  const side = (chordX - apex.x) * apex.nx + (chordY - apex.y) * apex.ny >= 0 ? 1 : -1;
  for (const out of CORNER_OUTS_M) {
    const off = side * (sub.width / 2 + out);
    const spot = { x: apex.x + apex.nx * off, y: apex.y + apex.ny * off };
    const inFloor = Math.abs(spot.x) < FLOOR - 12 && Math.abs(spot.y) < FLOOR - 12;
    if (inFloor && trackGap(sub, spot) >= sub.width / 2 + TYRE_RING_M + 3
      && isFreeOfThings(level, spot, TYRE_RING_M + 1)) {
      return { ...spot, rot: Math.atan2(apex.y - spot.y, apex.x - spot.x) };
    }
  }
  return null;
}

/**
 * The busy corners' floodlight spots of a circuit or rallycross (?eventlights=1; owner F1): its
 * tightest corners, each with a clear spot inside it. Worked out once per level.
 * @param level the level
 * @returns the spots (none elsewhere, or with the event lights off)
 */
export function cornerSpots(level: Level): CornerSpot[] {
  const count = CORNER_COUNT[catOf(level)];
  if (!eventLightsOn() || !count || !level.subtrack || level.endless) return [];
  let spots = cornerCache.get(level);
  if (!spots) {
    const sub = level.subtrack;
    spots = tightestCorners(sub, count).map((dist) => cornerSpot(level, sub, dist))
      .filter((spot): spot is CornerSpot => !!spot);
    cornerCache.set(level, spots);
  }
  return spots;
}

/**
 * The ring of tyre stacks round each corner floodlight's base: the level's ordinary, knockable
 * tyre stacks (cones.js adds them to the level's loose objects at a reset).
 * @param level the level
 * @returns the tyre stack entries
 */
export function cornerTyres(level: Level): Prop[] {
  const tyres: Prop[] = [];
  for (const spot of cornerSpots(level)) {
    for (let i = 0; i < TYRE_RING_COUNT; i++) {
      const angle = (i / TYRE_RING_COUNT) * Math.PI * 2;
      tyres.push({ kind: 'tyrestack', x: spot.x + Math.cos(angle) * TYRE_RING_M,
        y: spot.y + Math.sin(angle) * TYRE_RING_M });
    }
  }
  return tyres;
}

/**
 * The lamps a level gets by its kind (none for the endless highway: it streams its own).
 * @param level the level
 * @returns the lamp entries (streetlight / floodlight; x, y the foot; rot toward the track)
 */
export function planLamps(level: Level): Prop[] {
  const placed: Prop[] = [...(level.lamps || [])], kind = catOf(level);
  if (level.endless) return [];
  if (kind === 'test') lightTestGround(level, placed);
  else if (!level.subtrack) return placed;
  else if (kind === 'rally') {
    lightStageEnds(level, placed);
    lightVillages(level, placed);
  }
  else lightLap(level, placed, FLOOD_GAP_M[kind] || FLOOD_GAP_M.circuits, kind !== 'rx');
  // the busy corners' floodlights, each inside its ring of tyres
  for (const spot of cornerSpots(level)) placed.push({ kind: 'floodlight', ...spot });
  return placed;
}

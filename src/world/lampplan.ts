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
//   roads     none here (the endless highway builds its own as the road grows: a later step)
import { FLOOR } from './bounds.ts';
import { catOf } from './levels/category.ts';
import type { Level, Prop, Subtrack, TrackPoint } from './types.ts';

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
 * The lamps a level gets by its kind (none on the endless highway yet).
 * @param level the level
 * @returns the lamp entries (streetlight / floodlight; x, y the foot; rot toward the track)
 */
export function planLamps(level: Level): Prop[] {
  const placed: Prop[] = [...(level.lamps || [])], kind = catOf(level);
  if (level.endless) return [];
  if (kind === 'test') lightTestGround(level, placed);
  else if (!level.subtrack) return placed;
  else if (kind === 'rally') lightStageEnds(level, placed);
  else lightLap(level, placed, FLOOD_GAP_M[kind] || FLOOD_GAP_M.circuits, kind !== 'rx');
  return placed;
}

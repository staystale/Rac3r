// STRAIGHT OUTTA SWINDON - the new highway, step 1 (owner, 2026-10-15: build a new highway from the
// ground up, phone-tested at every step). The old endless highway hitches about every 140-170 m of
// new road on the owner's iPhone (?report=1; the 10-13 hunt found the same with drawing off), and
// its streaming does everything at once (road, fields, armco, trees, extras, traffic), so the cause
// cannot be pulled apart. This level is the bare minimum: ONE straight road on grass, built once at
// load, nothing streamed. Contents: a STRAIGHT_KM straight, two lanes' width, grass either side,
// the terrain's own gentle noise. Intended failure: none - it is a measuring stick. If it hitches
// every ~150 m too, the cause is in driving into new ground (renderer or Safari); if not, it is in
// the old highway's generation, and step 2 adds streaming back piece by piece.
// WORK IN PROGRESS - NOT REGISTERED in levels/index.ts: on the first try (CPU x1, phone size,
// ?gpupaint=1) the road was not drawn beyond the first ~100 m and the game ran at 10 fps, so the
// road drawing does not cope with a 30 km subtrack yet; and the AI drove ~60 km/h near the start
// (the ghost return segment reads as a 180 deg turn). See docs/foreman-handover.md.
import { SURFACES } from "../surfaces.ts";
import { createSubtrack, ghostSegment } from "../subtrack.ts";
import type { Level, Point } from "../types.ts";

const STRAIGHT_KM = 30;          // km of road (13 min at 140 km/h)
const POINT_SPACING_M = 10;      // m between centreline points
const ROAD_WIDTH_M = 12;         // two motorway lanes and a margin

/**
 * The straight centreline: from the origin due east, one point every POINT_SPACING_M.
 * @returns the points
 */
function straightPoints(): Point[] {
  const count = Math.round((STRAIGHT_KM * 1000) / POINT_SPACING_M) + 1;
  const points: Point[] = [];
  for (let i = 0; i < count; i++) points.push([i * POINT_SPACING_M, 0]);
  return points;
}

/**
 * The road: the straight as a point-to-point track, its closing segment (end back to start) a
 * ghost, never drawn or driven (as a rally stage's).
 * @returns the subtrack
 */
function straightRoad() {
  const points = straightPoints();
  return ghostSegment(createSubtrack(points, ROAD_WIDTH_M, [], [], true), points.length - 1);
}

export const STRAIGHT_OUTTA_LEVEL: Level = {
  id: 'straight-outta',
  name: 'Straight Outta Swindon',
  base: SURFACES.grass,
  floor: STRAIGHT_KM * 1000 + 1000,
  subtrack: straightRoad(),
  zones: [],
  bumps: [],
  covers: [],
  paint: [],
  boards: [],
  props: [],
  seams: false,
  cones: [],
  spawn: { x: 60, y: -2, heading: 0 },
};

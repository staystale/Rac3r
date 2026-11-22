// world/pitlane.ts - THE PIT LANE AS THE RACE USES IT (?pitstops; owner 11-15 / 11-22, TODO 16):
// from a venue's laid pit lane (world/venuepit.ts) - the lane in the race's direction, where it
// leaves and rejoins the track (track m), and the BOXES: one per grid slot along the working half
// of the lane (the garages' side), your box your grid slot's. A venue with no pit lane has none: no
// stops.
import { distToLine, lineLength, pointAlong } from "./venuegeo.ts";
import { querySubtrack } from "./tyrewall.ts";
import type { Lane, Level, Point, Subtrack } from "./types.ts";

/** One box: its middle, the lane's heading there, its size (m). */
export interface PitBox { x: number; y: number; heading: number; len: number; wid: number }

/** A level's pit lane as raced. */
export interface Pits {
  pts: Point[];   // the lane's middle, entry first
  width: number;   // m
  entryD: number; exitD: number;   // track m where it leaves / rejoins the lap
  boxes: PitBox[];   // by grid slot
}

/** A level with its pit lane (?pitstops: world/venue.ts sets it). */
export type PitLevel = Level & { pits?: Pits };

// the most boxes (the largest field: MAX_AI + you), a box's size, the gap between boxes, and the
// shares of the lane the boxes keep off at its two ends (its easing in and out)
const BOX_COUNT = 21, BOX_LEN = 5, BOX_WID = 2.6, BOX_GAP = 1.5, END_SHARE = 0.2;

/**
 * Where a point lies round the lap, m.
 * @param sub the lap
 * @param point the point
 * @returns track m
 */
const lapAt = (sub: Subtrack, [x, y]: Point) => querySubtrack(sub, x, y).trackDist;

/**
 * The lane in the race's direction: its end nearer forward of its start round the lap is its exit.
 * @param sub the lap
 * @param pts the lane
 * @returns the lane, entry first
 */
function raceWay(sub: Subtrack, pts: Point[]): Point[] {
  const total = sub.totalDist;
  const ahead = ((lapAt(sub, pts[pts.length - 1]) - lapAt(sub, pts[0])) % total + total) % total;
  return ahead < total / 2 ? pts : pts.slice().reverse();
}

/**
 * The boxes along the lane's middle stretch, each on the half of the lane away from the track.
 * @param sub the lap
 * @param pts the lane, entry first
 * @param width its width, m
 * @returns the boxes, by grid slot
 */
function laneBoxes(sub: Subtrack, pts: Point[], width: number): PitBox[] {
  const length = lineLength(pts), from = length * END_SHARE, until = length * (1 - END_SHARE);
  const step = Math.min(BOX_LEN + BOX_GAP, (until - from) / BOX_COUNT);
  const boxes: PitBox[] = [];
  for (let slot = 0; slot < BOX_COUNT; slot++) {
    const mid = pointAlong(pts, from + step * (slot + 0.5)), ahead = pointAlong(pts,
      from + step * (slot + 0.5) + 1);
    if (!mid || !ahead) break;
    // (the garages' side: the half further from the track)
    const quarter = width / 4;
    const side = querySubtrack(sub, mid.x + mid.nx * quarter, mid.y + mid.ny * quarter).dist
      >= querySubtrack(sub, mid.x - mid.nx * quarter, mid.y - mid.ny * quarter).dist ? 1 : -1;
    boxes.push({ x: mid.x + mid.nx * quarter * side, y: mid.y + mid.ny * quarter * side,
      heading: Math.atan2(ahead.y - mid.y, ahead.x - mid.x), len: Math.min(BOX_LEN, step - 0.5),
      wid: BOX_WID });
  }
  return boxes;
}

/**
 * The race's pit lane from a laid one.
 * @param sub the lap
 * @param lane the laid pit lane
 * @returns the pit lane, or null when too short for a box
 */
export function racePits(sub: Subtrack, lane: Lane): Pits | null {
  if (!lane || lane.pts.length < 2) return null;
  const pts = raceWay(sub, lane.pts);
  const boxes = laneBoxes(sub, pts, lane.width);
  if (!boxes.length) return null;
  return { pts, width: lane.width, entryD: lapAt(sub, pts[0]),
    exitD: lapAt(sub, pts[pts.length - 1]), boxes };
}

/**
 * Whether a place is on the pit lane - on it and off the lap's road (where they merge, the road).
 * @param level the level
 * @param x m
 * @param y m
 * @returns true on the pit lane
 */
export function onPitLane(level: PitLevel, x: number, y: number): boolean {
  const pits = level.pits, sub = level.subtrack;
  if (!pits || !sub) return false;
  return distToLine(pits.pts, x, y) < pits.width / 2
    && querySubtrack(sub, x, y).dist > sub.width / 2;
}

// s: a stop's own part (after the menu), fitting a set of tyres, a repair's floor and its growth
// with the damage squared (worse damage takes longer: 100 % ~22 s); m/s: the pit lane's limit
// (60 km/h)
const STOP_S = 0.5, TYRES_S = 4, REPAIR_S = 2, REPAIR_GROW_S = 20;
export const PIT_LIMIT_V = 60 / 3.6;

/**
 * A stop's work in s: the jobs overlap (the longest counts), a repair longer the worse the damage;
 * + STOP_S. The same for you and the AI.
 * @param tyres fresh tyres fitted
 * @param repair a repair done
 * @param damage the car's damage, 0..1
 * @returns s
 */
export function pitWorkTime(tyres: boolean, repair: boolean, damage: number): number {
  return STOP_S + Math.max(tyres ? TYRES_S : 0, repair ? REPAIR_S + REPAIR_GROW_S * damage * damage
    : 0);
}

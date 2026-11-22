// world/pitlane.ts - THE PIT LANE AS THE RACE USES IT (?pitstops; owner 11-15 / 11-22, TODO 16):
// from a venue's laid pit lane (world/venuepit.ts) - the lane in the race's direction, where it
// leaves and rejoins the track (track m), and the BOXES: one per grid slot along the working half
// of the lane (the garages' side), your box your grid slot's. A venue with no pit lane has none: no
// stops.
import { distToLine, lineLength, pointAlong } from "./venuegeo.ts";
import { onTrack, querySubtrack } from "./tyrewall.ts";
import type { Lane, Level, Paint, Point, Subtrack } from "./types.ts";

/** One box: its middle, the lane's heading there, its size (m). */
// (side: the garages' side of the lane, across the box's heading - +1 its left)
export interface PitBox {
  x: number; y: number; heading: number; len: number; wid: number; side: number;
}

/** An arrow painted on the road as the joker lane's are (render/road.ts drawArrows). */
export interface PitArrow { x: number; y: number; rot: number; len: number }

/** A level's pit lane as raced. */
export interface Pits {
  pts: Point[];   // the lane's middle, entry first
  width: number;   // m
  entryD: number; exitD: number;   // track m where it leaves / rejoins the lap
  boxes: PitBox[];   // by grid slot
  // the arrows into the pit lane (on the lap before its entrance, then along it), as the joker's
  arrows: PitArrow[];
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
      wid: BOX_WID, side });
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
  const entryD = lapAt(sub, pts[0]);
  return { pts, width: lane.width, entryD, exitD: lapAt(sub, pts[pts.length - 1]), boxes,
    arrows: pitArrows(sub, pts, entryD) };
}

// the joker's arrows' size (m), the track m before the entrance the lap's arrows stand at, how far
// in from the road's edge, their turn toward the lane (rad), and the m between the lane's arrows
const ARROW_LEN = 7, ENTRY_ARROWS_M = [60, 40, 20], ARROW_IN_M = 2.5, ARROW_TURN = 0.3;
const LANE_ARROW_GAP_M = 40;

/**
 * The arrows into the pit lane as the joker's: three on the lap before its entrance, on the lane's
 * side and turned toward it, then one every LANE_ARROW_GAP_M along the lane up to the boxes.
 * @param sub the lap
 * @param pts the lane, entry first
 * @param entryD its entrance, track m
 * @returns the arrows
 */
function pitArrows(sub: Subtrack, pts: Point[], entryD: number): PitArrow[] {
  const hit = querySubtrack(sub, pts[0][0], pts[0][1]), side = hit.side === 'left' ? 1 : -1;
  const total = sub.totalDist, arrows: PitArrow[] = [];
  for (const back of ENTRY_ARROWS_M) {
    const spot = onTrack(sub, ((entryD - back) % total + total) % total,
      side * (sub.width / 2 - ARROW_IN_M), {});
    arrows.push({ x: spot.x, y: spot.y, rot: spot.rot + side * ARROW_TURN, len: ARROW_LEN });
  }
  const length = lineLength(pts);
  for (let along = LANE_ARROW_GAP_M; along < length * END_SHARE + 1; along += LANE_ARROW_GAP_M) {
    const mid = pointAlong(pts, along), ahead = pointAlong(pts, along + 1);
    if (mid && ahead) arrows.push({ x: mid.x, y: mid.y,
      rot: Math.atan2(ahead.y - mid.y, ahead.x - mid.x), len: ARROW_LEN });
  }
  return arrows;
}

// m: how far before your box's middle its arrow stands (on the lane's middle line)
const BOX_ARROW_BACK_M = 5;

/**
 * The arrow into your box: on the lane's middle a little before it, pointing at its middle.
 * @param box your box
 * @param width the lane's width, m
 * @returns the arrow
 */
export function boxArrow(box: PitBox, width: number): PitArrow {
  const cos = Math.cos(box.heading), sin = Math.sin(box.heading), inset = width / 4 * box.side;
  const x = box.x - cos * BOX_ARROW_BACK_M + sin * inset;
  const y = box.y - sin * BOX_ARROW_BACK_M - cos * inset;
  return { x, y, rot: Math.atan2(box.y - y, box.x - x), len: ARROW_LEN };
}

// m: the box lines' width (a painted line)
const BOX_LINE_W = 0.12;

/**
 * Every box's lines on the pit lane (a real pit box: its outline), as painted lines.
 * @param pits the pit lane
 * @returns the paint
 */
export function boxLines(pits: Pits): Paint[] {
  return pits.boxes.map((box) => {
    const cos = Math.cos(box.heading), sin = Math.sin(box.heading);
    const corner = (along: number, across: number): Point => [box.x + cos * along - sin * across,
      box.y + sin * along + cos * across];
    const halfLen = box.len / 2, halfWid = box.wid / 2;
    return { kind: 'line', x: 0, y: 0, lw: BOX_LINE_W, tone: 0.9,
      pts: [corner(-halfLen, -halfWid), corner(halfLen, -halfWid), corner(halfLen, halfWid),
        corner(-halfLen, halfWid), corner(-halfLen, -halfWid)] };
  });
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

// ai/gapPick.ts - GAP SPOTTING (the AI rework R8 stage 4, one AI, passed 11-04; owner: "mostly
// drivers need to pick their path with dodging and gap spotting"; "make sure ai don't wait and
// swim thru traffic correctly like they're racing, not slowing down or only using the hard
// shoulder"). The circuit driver went round ONE car at a time - each car it saw overwrote the
// side the last one chose, fine with a car or two on a circuit, wrong in a wall of traffic
// (MEASURED: on the highway it hit the traffic in 29-30 of 45 weavecheck scenarios). This is the
// old highway driver's line scoring (ai/weaverLine.ts, deleted; every cost MEASURED with
// weavecheck / pacesuite) for every driver: lines across the room it has, each scored by the
// free road along it
// - the nearest car whose body (+ margin) is on it, as far as the driver reads ahead (by skill) -
// less the swerve to it, with a bonus for the line already chosen; a line whose way across is
// blocked halfway, or that a faster car behind is about to arrive on, is out; past the usual edge
// only when it is clearly quicker.
import { reachOf } from './dodge.ts';
import type { AiCar } from './types.ts';
import { FIX } from '../core/fixes.ts';

/** A car as the gap picker sees it, in my path's frame. */
export interface SeenCar { fwd: number; lat: number; v: number; across: number; along: number;
  dec?: number }   // dec: how fast it slows (m/s/s), as read (ai/dodge.ts readBraking)

// lines tried across the room, the bonus for the line already chosen, the swerve cost (a m, + a m
// per m/s), the verge's cost and the room's step to it (m), the m beside a car that is alongside,
// a blocked way across or the mirror's cost, the mirror's s, the most m across in one think
const LINES = 11, COMMIT = 25, MOVE_K = 1.5, MOVE_SPEED_K = 0.05, VERGE = 40, OUT = 400;
// the cost a m off the racing line (MEASURED _wide.mjs, the stock car oval: a driver
// went round a pack by the outside wall, 11 m off the line, then kept that free line - nothing
// said the line itself is quicker - 20 % of its race > 2 m outside the line, a lone car 2 %)
const LINE_COST = 3;
const MIRROR_S = 1.5, REACH_M = 4.5, MARGIN = 0.55, FREE_BONUS = 60, KEPT_V = 1.2;
// m between the lines a rejoining car checks on its way across
const REJOIN_STEP_M = 1;

/**
 * The car ahead on a line (or one beside it: no way through).
 * @param seen the cars seen
 * @param off the line, m off my path
 * @param half my half width, m
 * @param len my length, m
 * @returns its gap (m) and speed (m/s), side = beside me, or null
 */
export function blockOn(seen: SeenCar[], off: number, half: number, len: number) {
  let block: { gap: number; v: number; dec?: number; side?: boolean } | null = null;
  for (const car of seen) {
    const reach = (len / 2 + car.along) + 1;
    if (car.fwd < -reach || Math.abs(car.lat - off) >= car.across + half + MARGIN) continue;
    if (car.fwd < reach) return { gap: 0, v: car.v, side: true };
    const gap = car.fwd - reach + 1;
    if (!block || gap < block.gap) block = { gap, v: car.v, dec: car.dec };
  }
  return block;
}

/**
 * Whether a faster car behind would arrive on a line before I am across.
 * @param seen the cars seen
 * @param off the line
 * @param half my half width
 * @param speed my m/s
 * @returns true when it is coming
 */
function inMirror(seen: SeenCar[], off: number, half: number, speed: number) {
  for (const car of seen) {
    if (car.fwd >= 0 || car.v <= speed + 0.5) continue;
    if (Math.abs(car.lat - off) >= car.across + half + MARGIN) continue;
    if ((-car.fwd - car.along) / (car.v - speed) < MIRROR_S) return true;
  }
  return false;
}

/**
 * Whether a car coming back onto the track may cross from where it is to its line -
 * no car on the track arriving (MIRROR_S) on, or alongside on, the lines it would cross (owner
 * 11-04: "make cars look before pulling onto the track"; a car on the track has priority).
 * @param seen the cars seen (my path's frame)
 * @param from where I am, m off my path
 * @param dest where I am going, m off my path
 * @param half my half width, m
 * @param len my length, m
 * @param speed my m/s
 * @returns true when it is clear
 */
export function rejoinClear(seen: SeenCar[], from: number, dest: number, half: number,
  len: number, speed: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.abs(dest - from) / REJOIN_STEP_M));
  for (let i = 1; i <= steps; i++) {
    const off = from + (dest - from) * i / steps;
    if (inMirror(seen, off, half, speed)) return false;
    const block = blockOn(seen, off, half, len);
    if (block && block.side) return false;
  }
  return true;
}

/**
 * What a line costs for where it is: past the usual edge (the verge), and for every m
 * off the racing line - the fast way round.
 * @param off the line, m off my path
 * @param centre my path's m off the road's middle
 * @param edge the usual room's edge, m from the road's middle
 * @param lanes the line's lanes, m off it (the highway), if it has them
 * @returns the cost
 */
function placeCost(off: number, centre: number, edge: number, lanes?: number[]) {
  // (from the nearest lane - every lane is as good as the line)
  const fromLine = lanes ? Math.min(...lanes.map((lane) => Math.abs(off - lane))) : Math.abs(off);
  return (Math.abs(centre + off) > edge ? VERGE : 0) + LINE_COST * fromLine;
}

/**
 * The free road along a line up to the car on it: its gap, or - one coming at me -
 * what I cover before we meet (a two-way road's other lane: read as its gap, a car 150 m off at a
 * 55 m/s closing speed looked as free as an empty lane).
 * @param block the car on the line: its gap (m) and m/s along my way
 * @param speed my m/s
 * @returns m
 */
function freeTo(block: { gap: number; v: number }, speed: number): number {
  if (block.v >= 0) return block.gap;
  return block.gap * speed / Math.max(1, speed - block.v);
}

/**
 * The line to take through the cars: the best scored across the room.
 * @param seen the cars seen (my path's frame)
 * @param mine my place: lat (m off the path), base (the line chosen last), half width, length,
 *   speed (m/s), look (s ahead it reads), lo / hi (the room), edge (the usual room's edge, m
 *   from the road's middle) and centre (my path's m off the road's middle)
 * @returns the line, m off my path
 */
export function gapLine(seen: SeenCar[], mine: { lat: number; base: number; half: number;
  len: number; speed: number; look: number; lo: number; hi: number; edge: number;
  centre: number; lanes?: number[] }): number {
  const { base, lo, hi } = mine;
  let best = base, bestScore = -Infinity;
  const tries: number[] = [base];
  for (let i = 0; i < LINES; i++) tries.push(lo + (hi - lo) * i / (LINES - 1));
  for (const want of tries) {
    const parts = lineScore(seen, want, mine);
    if (parts && parts.total > bestScore) { bestScore = parts.total; best = parts.off; }
  }
  return best;
}

/**
 * Whether the gap picker reads the room on the line itself (passed 11-22): on a line with lanes -
 * the highway's - only.
 * MEASURED (tools/scratch/_aibase.mjs, 4 seeds): on the motorway the racers' speed 110.9 -> 122.1
 * km/h and their braking for traffic 838 -> 505 car-s, the crashes the same; on the circuits more
 * incidents (Brands 129 -> 151, Moanaco 112 -> 128, Croughed RX 91 -> 118) and no faster - a
 * roomier line there is often across the racing line - and weighing the racing line 4x for such a
 * line still left them above off (136 / 118 / 119): owner 11-21, "only if we have to".
 * @param lanes the line's lanes, if it has them
 * @returns on
 */
const destOn = (lanes?: number[]) => !!lanes;

/**
 * The car on a line out of one swerve's reach, as its room ahead (one beside me there
 * counts as no room: its gap 0, not a side - I am not there yet).
 * @param seen the cars seen
 * @param dest the line, m off my path
 * @param half my half width, m
 * @param len my length, m
 * @returns its gap and speed, or null
 */
function destBlock(seen: SeenCar[], dest: number, half: number, len: number) {
  const block = blockOn(seen, dest, half, len);
  return block && block.side ? { gap: 0, v: block.v } : block;
}

/**
 * The swerve's cost to a line (a m across from the line chosen and a share from where I am, more
 * at speed), less COMMIT for the line already chosen.
 * @param dest the line, m off my path
 * @param from the line chosen last, where I am (m) and my m/s
 * @param from.base m
 * @param from.lat m
 * @param from.speed m/s
 * @returns the cost
 */
function moveCost(dest: number, from: { base: number; lat: number; speed: number }): number {
  const { base, lat, speed } = from;
  return (Math.abs(dest - base) + 0.3 * Math.abs(dest - lat)) * (MOVE_K + speed * MOVE_SPEED_K)
    - (Math.abs(dest - base) < 0.6 ? COMMIT : 0);
}

/** A line's score as the gap picker reckons it, by its parts (lineScore). */
export interface LineParts {
  off: number;     // the line scored, m off my path (no further across than a swerve makes)
  ahead: number;   // the room ahead on it (its free road, or the reading + FREE_BONUS)
  kept: number;    // the speed of the car on it, x KEPT_V
  move: number;    // the swerve's cost, less COMMIT for the line already chosen
  place: number;   // the verge's and the off-the-racing-line cost
  outMid: number;  // OUT: a car beside the way across (half way)
  outMirror: number;   // OUT: a faster car behind arriving on it or half way
  contact: number;   // ?contactcost: the contact risk's cost (rear-end, side rub, cut-off)
  total: number;
}

// ?contactcost, the first settings. REAR-END: per s the line's car ahead is reached in under
// REAR_T s at the closing speed, at most REAR_MAX; SIDE RUB: per m under SIDE_ROOM_M of side gap a
// car alongside is left on the way across - one I move closer to - at most SIDE_MAX (close
// running stays cheap); CUT-OFF:
// per s a car behind on the line (not already behind me on mine) reaches me in under CUT_T s, at
// most CUT_MAX - and CUT_MAX for one within CUT_CLOSE_M of me, however fast
const REAR_T = 2, REAR_K = 40, REAR_MAX = 80;
const SIDE_ROOM_M = 1, SIDE_K = 20, SIDE_MAX = 20;
const CUT_T = 3, CUT_K = 30, CUT_MAX = 90, CUT_CLOSE_M = 3;
// m past our bodies' overlap a car still counts as alongside
const SIDE_REACH_M = 2;

/**
 * Rear-end: running into the car ahead on the line - the s to reach it at the closing speed.
 * @param block the car ahead on the line (its gap, m; m/s along my way), or null
 * @param speed my m/s
 * @returns the cost
 */
function rearCost(block: { gap: number; v: number } | null, speed: number): number {
  if (!block) return 0;
  const closing = speed - block.v;
  if (closing <= 0) return 0;
  return Math.min(REAR_MAX, REAR_K * Math.max(0, REAR_T - block.gap / closing));
}

/**
 * Side rub: the least side gap a car alongside is left as I cross from where I am to the line -
 * one I move closer to (one I am already close to and move away from costs nothing).
 * @param seen the cars seen
 * @param off the line, m off my path
 * @param mine where I am (m), my half width and length (m), my m/s
 * @param mine.lat m
 * @param mine.half m
 * @param mine.len m
 * @param mine.speed m/s
 * @returns the cost
 */
function sideCost(seen: SeenCar[], off: number, mine: { lat: number; half: number; len: number;
  speed: number }): number {
  const { lat, half, len } = mine;
  const low = Math.min(lat, off), high = Math.max(lat, off);
  let worst = 0;
  for (const car of seen) {
    const reach = len / 2 + car.along + SIDE_REACH_M;
    if (Math.abs(car.fwd) > reach) continue;
    const apart = car.lat < low ? low - car.lat : car.lat > high ? car.lat - high : 0;
    if (apart >= Math.abs(car.lat - lat)) continue;
    const gap = apart - (car.across + half + MARGIN);
    worst = Math.max(worst, Math.min(SIDE_MAX, SIDE_K * Math.max(0, SIDE_ROOM_M - gap)));
  }
  return worst;
}

/**
 * Cut-off: a car behind on the line - one not already behind me on my own - the s before it
 * reaches me (a car right behind costs CUT_MAX, however fast).
 * @param seen the cars seen
 * @param off the line, m off my path
 * @param mine where I am (m), my half width and length (m), my m/s
 * @param mine.lat m
 * @param mine.half m
 * @param mine.len m
 * @param mine.speed m/s
 * @returns the cost
 */
function cutCost(seen: SeenCar[], off: number, mine: { lat: number; half: number; len: number;
  speed: number }): number {
  const { lat, half, len, speed } = mine;
  let worst = 0;
  for (const car of seen) {
    const width = car.across + half + MARGIN;
    if (car.fwd >= 0 || Math.abs(car.lat - off) >= width || Math.abs(car.lat - lat) < width) {
      continue;
    }
    const gap = -car.fwd - car.along - len / 2;
    if (gap < -1) continue;
    const closing = car.v - speed;
    const cost = gap < CUT_CLOSE_M ? CUT_MAX
      : closing > 0 ? CUT_K * Math.max(0, CUT_T - gap / closing) : 0;
    worst = Math.max(worst, Math.min(CUT_MAX, cost));
  }
  return worst;
}

/**
 * ?contactcost: what a line costs for the contact it risks, by kind - running into the car ahead
 * on it, rubbing a car alongside on the way across, cutting off a car behind on it.
 * @param seen the cars seen
 * @param off the line, m off my path
 * @param block the car ahead on it, or null
 * @param mine where I am (m), my half width and length (m), my m/s
 * @param mine.lat m
 * @param mine.half m
 * @param mine.len m
 * @param mine.speed m/s
 * @returns the cost
 */
function contactCost(seen: SeenCar[], off: number, block: { gap: number; v: number } | null,
  mine: { lat: number; half: number; len: number; speed: number }): number {
  return rearCost(block, mine.speed) + sideCost(seen, off, mine) + cutCost(seen, off, mine);
}

/**
 * One line's score, by its parts - gapLine's own reckoning (the BOXED trace reads it too:
 * ai/boxedTrace.ts).
 * @param seen the cars seen (my path's frame)
 * @param want the line, m off my path
 * @param mine as gapLine's
 * @returns the parts, or null when a car is beside me on it (no way through)
 */
export function lineScore(seen: SeenCar[], want: number, mine: { lat: number; base: number;
  half: number; len: number; speed: number; look: number; edge: number; centre: number;
  lanes?: number[] }): LineParts | null {
  const { lat, base, half, len, speed, look, edge, centre, lanes } = mine;
  // no further across in one think than a swerve makes
  const off = Math.abs(want - lat) > REACH_M ? lat + Math.sign(want - lat) * REACH_M : want;
  const near = blockOn(seen, off, half, len);
  if (near && near.side) return null;
  // (on the highway: the room and the move read on the line itself - the car still steers there one
  // swerve a think; else on the part-way point)
  const dest = destOn(lanes) ? want : off;
  const block = dest === off ? near : destBlock(seen, dest, half, len);
  const ahead = block ? Math.min(freeTo(block, speed), speed * look) : speed * look + FREE_BONUS;
  const kept = block ? Math.max(0, block.v) * KEPT_V : 0;
  const move = moveCost(dest, { base, lat, speed });
  const place = placeCost(dest, centre, edge, lanes);
  let outMid = 0, outMirror = 0;
  if (Math.abs(off - lat) > 1.2) {
    const mid = blockOn(seen, (off + lat) / 2, half, len);
    if (mid && mid.gap < 1) outMid = OUT;
    if (inMirror(seen, off, half, speed) || inMirror(seen, (off + lat) / 2, half, speed)) {
      outMirror = OUT;
    }
  }
  const contact = FIX.contactcost ? contactCost(seen, off, block, mine) : 0;
  let total = block ? ahead + kept : ahead;
  total -= move;
  total -= place;
  total -= outMid;
  total -= outMirror;
  total -= contact;
  return { off, ahead, kept, move, place, outMid, outMirror, contact, total };
}

/**
 * A car as the gap picker sees it.
 * @param other the car
 * @param fwd m ahead of me along my heading
 * @param lat m off my path
 * @param vAlong its m/s along my way
 * @param pathH my path's heading by it
 * @returns the seen car
 */
export function seeCar(other: AiCar, fwd: number, lat: number, vAlong: number,
  pathH: number): SeenCar {
  const reach = reachOf(other, pathH);
  return { fwd, lat, v: vAlong, across: reach.across, along: reach.along };
}

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
  const { lat, base, half, len, speed, look, lo, hi, edge, centre, lanes } = mine;
  let best = base, bestScore = -Infinity;
  const tries: number[] = [base];
  for (let i = 0; i < LINES; i++) tries.push(lo + (hi - lo) * i / (LINES - 1));
  for (const want of tries) {
    // no further across in one think than a swerve makes
    const off = Math.abs(want - lat) > REACH_M ? lat + Math.sign(want - lat) * REACH_M : want;
    const block = blockOn(seen, off, half, len);
    if (block && block.side) continue;
    let score = block ? Math.min(freeTo(block, speed), speed * look)
      + Math.max(0, block.v) * KEPT_V : speed * look + FREE_BONUS;
    score -= (Math.abs(off - base) + 0.3 * Math.abs(off - lat)) * (MOVE_K + speed * MOVE_SPEED_K)
      - (Math.abs(off - base) < 0.6 ? COMMIT : 0);
    score -= placeCost(off, centre, edge, lanes);
    if (Math.abs(off - lat) > 1.2) {
      const mid = blockOn(seen, (off + lat) / 2, half, len);
      if (mid && mid.gap < 1) score -= OUT;
      if (inMirror(seen, off, half, speed) || inMirror(seen, (off + lat) / 2, half, speed)) {
        score -= OUT;
      }
    }
    if (score > bestScore) { bestScore = score; best = off; }
  }
  return best;
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

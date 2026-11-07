// ai/cornerLine.ts - A LINE OF ITS OWN THROUGH EACH CORNER (passed 11-04; owner: "can ai pick
// different lines for corners to benefit them / pick bad lines if unskilled? ... they shouldn't
// [all follow the same line]"; "shouldn't it vary every lap / corner depending on the track in
// front of them a bit too, especially for more skilled drivers?"; "it can vary but can be similar
// if that's best"; "keep it computationally cheap").
// Through each corner a driver takes the racing line SHIFTED ALONG the track by ONE number, b: how
// late (b > 0) or early (b < 0) it apexes - it holds the line's own offset from SHIFT_M x b metres
// back (or on), tapering to nothing at the corner's ends. (A sideways nudge was tried first: the
// line already sits by the edge in at the entry, apex and exit, so the road clamped it to nothing
// - MEASURED _lines.mjs, 0.1 -> 0.2 m.) A shift stays inside the road: it only reuses offsets the
// line has.
// b = the driver's HABIT for that corner (dealt from its seed: small for a good driver, big for a
// weak one; a good driver leans to the apex that suits its car - late for a car with power to
// spare over its grip, earlier for one that must carry speed) + a fresh draw each time it arrives
// (small for a good driver: consistent; bigger for a weak one). The corner speed already reads the
// line it will really be on (ai/rejoin.ts, driverSteps.ts), so a poor line costs its own time.
// Cheap: each racing-line point's corner window and place in it are worked out once per line; a
// driver's step is a lookup and a cosine.
import { carGrip } from './line.ts';
import { GRAVITY } from '../cars.ts';
import { CAR_STATS } from '../carstats.ts';
import type { Drv } from './driverCtx.ts';
import type { AiCar, RacingLine } from './types.ts';
import { WEAR_CELL, groundAt, wearKey, wearMap } from '../world/wear.ts';

// m of approach before a corner's first bend, and of exit after its last, that its line spans
const ENTRY_M = 35, EXIT_M = 35;
// m along the track the apex moves at b = 1
const SHIFT_M = 20;
// the spread of the habit and of the draw on arrival: skill 1 / extra at skill 0
const HABIT_TOP = 0.15, HABIT_WEAK = 0.75, DRAW_TOP = 0.08, DRAW_WEAK = 0.35;
// a good driver's lean to the apex that suits its car (b), and the power-over-grip (accel / grip
// g) that is neutral and that gives the full lean
const CAR_LEAN = 0.35, POWER_MID = 0.35, POWER_SPAN = 0.2;
// b is kept inside this
const B_MAX = 1.2;
// A LINE CLEAR OF FRESH OIL AND GLASS (passed 11-04; owner: "the different way approach sounds
// like a good idea"). Steering round a patch like a cone put the field on the oil MORE in every
// version tried (TODO 11-04); instead, on arriving at a corner a driver checks the line it chose
// through it for oil / glass cells (its middle and its wheels) and, if it would cross some, takes
// the nearest earlier or later apex that misses them - decided once a corner, on a line that stays
// on the road. A good driver always sees it; a weak one may not (NOTICE_WEAK at skill 0). Cheap: a
// few dozen map reads once a corner. The covers checked, the b steps tried, the wheels read (m).
const HAZARD_COVERS = new Set(["oil", "glass"]), B_STEP = 0.3, B_TRIES = 2;
const WHEELS = [0, -0.9, 0.9], NOTICE_WEAK = 0.5;

/** Each line point's corner window: the corner (-1 none) and its place (-1 .. 0 apex .. 1). */
interface Windows { cid: Int32Array; place: Float32Array }
const WINDOWS = new WeakMap<RacingLine, Windows>();

/**
 * The corner windows of a racing line, worked out once: a point belongs to the corner whose apex
 * is nearest among the windows it is in.
 * @param line the racing line
 * @returns the windows
 */
function windowsOf(line: RacingLine): Windows {
  const known = WINDOWS.get(line);
  if (known) return known;
  const count = line.n, cid = new Int32Array(count).fill(-1), place = new Float32Array(count);
  const best = new Float32Array(count).fill(Infinity);
  const entry = Math.round(ENTRY_M / line.sp), exit = Math.round(EXIT_M / line.sp);
  line.corners.forEach((corner, cornerId) => {
    let last = corner.apex;
    for (let step = 1; step < count; step++) {
      if (line.cid[(corner.apex + step) % count] !== cornerId) break;
      last = (corner.apex + step) % count;
    }
    const before = ((corner.apex - corner.start + count) % count) + entry;
    const after = ((last - corner.apex + count) % count) + exit;
    for (let off = -before; off <= after; off++) {
      const pos = (corner.apex + off + count) % count, gap = Math.abs(off);
      if (gap >= best[pos]) continue;
      best[pos] = gap; cid[pos] = cornerId;
      place[pos] = off < 0 ? off / before : off / after;
    }
  });
  const windows = { cid, place };
  WINDOWS.set(line, windows);
  return windows;
}

/**
 * Whether a line through a corner, at a given b, crosses fresh oil or glass.
 * @param line the racing line
 * @param windows its corner windows
 * @param from the line point to look from
 * @param cornerId the corner
 * @param apexB the b tried
 * @param lineQ the driver's share of the line's width (traits.lineQ)
 * @returns true when it would cross a hazard
 */
function lineHitsHazard(line: RacingLine, windows: Windows, from: number, cornerId: number,
  apexB: number, lineQ: number): boolean {
  const count = line.n, pts = line.pts;
  for (let pos = from, steps = 0; windows.cid[pos] === cornerId && steps < count; steps += 2) {
    const taper = 0.5 * (1 + Math.cos(Math.PI * windows.place[pos]));
    const src = (pos - Math.round(apexB * SHIFT_M * taper / line.sp) + count) % count;
    // m off the racing line here: its own line (the shifted offset) and its share of the width
    const lat = pts[src].off! - pts[pos].off! * (2 - lineQ);
    for (const wheel of WHEELS) {
      const off = lat + wheel, point = pts[pos];
      const x = point.x - Math.sin(point.h) * off, y = point.y + Math.cos(point.h) * off;
      const cell = wearMap.get(wearKey(Math.floor(x / WEAR_CELL), Math.floor(y / WEAR_CELL)));
      if (cell && cell.cover && HAZARD_COVERS.has(cell.cover)) return true;
      // (standing water too - gone round if there is a way, never slowed for here)
      if (groundAt(x, y).surface?.id === 'puddle') return true;
    }
    pos = (pos + 2) % count;
  }
  return false;
}

/**
 * The b to take through a corner - the one chosen, or the nearest that misses fresh oil
 * and glass on it (if the driver sees it).
 * @param drv the driver context
 * @param windows the corner windows
 * @param from the line point it arrives at
 * @param cornerId the corner
 * @param chosen the b it chose
 * @param weak 1 - skill
 * @returns b
 */
function clearOfHazards(drv: Drv, windows: Windows, from: number, cornerId: number,
  chosen: number, weak: number): number {
  const { line, traits, rnd } = drv;
  if (!lineHitsHazard(line, windows, from, cornerId, chosen, traits.lineQ)) return chosen;
  if (rnd() > 1 - NOTICE_WEAK * weak) return chosen;
  for (let tries = 1; tries <= B_TRIES; tries++) {
    for (const sign of [1, -1]) {
      const apexB = Math.max(-B_MAX, Math.min(B_MAX, chosen + sign * tries * B_STEP));
      if (!lineHitsHazard(line, windows, from, cornerId, apexB, traits.lineQ)) return apexB;
    }
  }
  return chosen;
}

/**
 * A good driver's lean for its car: late (+) for power to spare over grip, earlier (-) for one
 * that must carry its speed.
 * @param car the car
 * @returns b
 */
function carLean(car: AiCar): number {
  const carId = String(car.spec.id).split('#')[0], stats = CAR_STATS[carId];
  if (!stats || !stats.zeroTo100) return 0;
  const power = (27.78 / stats.zeroTo100) / (carGrip(car.spec).gripG * GRAVITY);
  return CAR_LEAN * Math.max(-1, Math.min(1, (power - POWER_MID) / POWER_SPAN));
}

/**
 * A number in -1..1 from a seed and a corner (the habit's deal: the same each lap).
 * @param seed the driver's seed
 * @param corner the corner
 * @returns -1..1, about evenly
 */
function dealt(seed: number, corner: number): number {
  const mixed = Math.sin(seed * 12.9898 + corner * 78.233) * 43758.5453;
  return (mixed - Math.floor(mixed)) * 2 - 1;
}

/**
 * The m this driver's line sits off the racing line here (+ left), and the same at any point.
 * @param drv the driver context (traits, rnd, line; state.clCorner / clB, the corner it is on)
 * @param car the car
 * @param nearIdx its place on the racing line
 * @returns the nudge here and at a point (for the corner speed ahead)
 */
export function cornerNudge(drv: Drv, car: AiCar, nearIdx: number) {
  const { line, traits, rnd, state } = drv, windows = windowsOf(line);
  const weak = 1 - Math.max(0, Math.min(1, traits.skill));
  const here = windows.cid[nearIdx];
  if (here >= 0 && here !== state.clCorner) {
    // arriving at a corner: the habit (+ the car's lean, a good driver's) and a fresh draw
    const habit = dealt(traits.seed, here) * (HABIT_TOP + HABIT_WEAK * weak)
      + carLean(car) * (1 - weak);
    const draw = (rnd() + rnd() - 1) * (DRAW_TOP + DRAW_WEAK * weak) * 1.7;
    state.clCorner = here;
    state.clB = Math.max(-B_MAX, Math.min(B_MAX, habit + draw));
    // the nearest line that misses fresh oil / glass on it
    state.clB = clearOfHazards(drv, windows, nearIdx, here, state.clB, weak);
  }
  const apexB = state.clB ?? 0, count = line.n, pts = line.pts;
  const nudgeAt = (pos: number) => {
    const cornerId = windows.cid[pos];
    if (cornerId < 0 || cornerId !== state.clCorner) return 0;
    // the line's offset from back (late) or on (early) along the track, all of it at the apex
    const taper = 0.5 * (1 + Math.cos(Math.PI * windows.place[pos]));
    const from = (pos - Math.round(apexB * SHIFT_M * taper / line.sp) + count) % count;
    return pts[from].off! - pts[pos].off!;
  };
  return { here: nudgeAt(nearIdx), nudgeAt };
}

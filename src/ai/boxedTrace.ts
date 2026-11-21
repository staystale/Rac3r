// ai/boxedTrace.ts - THE "BOXED" TRACE (the owner's 11-21 item 7, read only): when the gap picker
// (ai/driverTraffic.ts gapStep) finds a car still on the line it picked and caps the speed to
// arrive behind it, what that looked like - the car's distance and speed, how far across it is,
// whether my own lane is blocked too, and whether any way round was free across the room the
// picker had. Recorded only while a tool sets globalThis.__AI_WHY (tools/scratch/_boxed.mjs); the
// game never computes it.
import { blockOn, lineScore } from './gapPick.ts';
import type { LineParts, SeenCar } from './gapPick.ts';
import { debugValue } from '../core/debug.ts';

/** One boxed moment, as the driver saw it. */
export interface BoxedNote {
  gap: number;          // m to the blocking car (its tail to my nose, about)
  v: number;            // its m/s along my way
  myV: number;          // my m/s
  lat: number;          // its m off my path
  line: number;         // the line picked, m off my path
  myLat: number;        // where I am, m off my path
  ownBlocked: boolean;  // my own lane blocked too
  freeAt: number | null;   // the nearest fully free line across the room (m off my path), or none
  bestGap: number;      // the most room ahead on any line across the room, m (Infinity: free)
  bestAt: number;       // that line, m off my path
  room: [number, number];  // the room the picker had, m off my path
  picked: LineParts | null;   // the picked line's score, by its parts (ai/gapPick.ts lineScore)
  roomiest: LineParts | null;   // the score of the line with the most room ahead
}

/** The gap picker's view at a boxed moment (its gapLine input) and the line it picked. */
type Pick = Parameters<typeof lineScore>[2] & { line: number; myLat: number; lo: number;
  hi: number };

// m between the lines tried for a free way round
const STEP_M = 0.5;

/**
 * The note for a boxed moment.
 * @param seen the cars seen (the gap picker's)
 * @param mine the gap picker's input (ai/gapPick.ts gapLine), the line picked and where I am
 * @param block the car on the picked line: m to it, its m/s
 * @returns the note
 */
export function boxedNote(seen: SeenCar[], mine: Pick, block: { gap: number; v: number }):
  BoxedNote {
  const { line, myLat, half, len, speed, lo, hi } = mine;
  let lat = line, best = Infinity;
  for (const other of seen) {
    const far = Math.abs(other.fwd - block.gap) + Math.abs(other.lat - line);
    if (other.fwd > 0 && far < best) { best = far; lat = other.lat; }
  }
  let freeAt: number | null = null, bestGap = -Infinity, bestAt = line;
  for (let off = lo; off <= hi + 1e-6; off += STEP_M) {
    const there = blockOn(seen, off, half, len);
    const roomAhead = !there ? Infinity : there.side ? 0 : there.gap;
    if (roomAhead > bestGap) { bestGap = roomAhead; bestAt = off; }
    if (there) continue;
    if (freeAt == null || Math.abs(off - myLat) < Math.abs(freeAt - myLat)) freeAt = off;
  }
  return { gap: block.gap, v: block.v, myV: speed, lat, line, myLat,
    ownBlocked: !!blockOn(seen, myLat, half, len), freeAt, bestGap, bestAt, room: [lo, hi],
    picked: lineScore(seen, line, mine), roomiest: lineScore(seen, bestAt, mine) };
}

/**
 * Keeps the boxed note on the driver, only while a tool sets __AI_WHY: the note when the picked
 * line is blocked ahead (not alongside), else none.
 * @param state the driver's state
 * @param seen the cars seen
 * @param mine as boxedNote
 * @param block the car on the picked line, if any
 */
export function traceBoxed(state: { boxedNote?: BoxedNote | null }, seen: SeenCar[],
  mine: Parameters<typeof boxedNote>[1], block: { gap: number; v: number; side?: boolean } | null) {
  if (!debugValue('AI_WHY')) return;
  state.boxedNote = block && !block.side ? boxedNote(seen, mine, block) : null;
}

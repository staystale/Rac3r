// world/venuefences.ts - WHAT STANDS AT A VENUE'S EDGE, sample by sample round each side of a
// road's rim (world/venueedge.ts edgeKinds picks it, buildEdge lays it): Armco, a catch fence
// where spectators are, or nothing (open run-off). On a world circuit (VenueSpec.mixFences) with
// ?fences=1 (owner 11-10: "maybe use wooden fences or chain link fences and mix it up so it's not
// always Armco", "mostly Armco is ok if the track is like that irl just mix it up a bit") also a
// CHAIN LINK fence where the rail it follows is a fence on the map (not Armco), and a WOODEN FENCE
// set back on the open run-off (Le Manky's, where the map carries none). MEASURED: every rail a
// world circuit followed was built as Armco, whatever the map calls it - real m, both sides: Spa
// walls 10.1 km, fences 2.9, guard rail 0.8; the Nordschleife guard rail 41.2, fences 11.7; Le
// Mans walls 23.8, fences 5.4, guard rail 0.2. The walls stay Armco.
import { FIX } from "../core/fixes.ts";
import type { Barrier, Point } from "./types.ts";

/** What stands at a rim sample. */
export const EDGE_NONE = 0, EDGE_ARMCO = 1, EDGE_CATCH = 2, EDGE_MESH = 3, EDGE_WOOD = 4;
/** Each kind's barrier: by spectators a catch fence set back, a mapped fence's where it stands. */
export const EDGE_BARRIERS: [number, Barrier['kind']][] = [[EDGE_ARMCO, 'armco'],
  [EDGE_CATCH, 'catchfence'], [EDGE_MESH, 'catchfence'], [EDGE_WOOD, 'woodfence']];
/** The fences (an Armco end meeting one is carried on to it, not flared across it). */
export const FENCE_KINDS = [EDGE_CATCH, EDGE_MESH, EDGE_WOOD];
// m past the road's edge a wooden fence on the open run-off stands (three times the Armco's 5)
export const WOOD_RUNOFF_M = 15;

/**
 * Whether a venue's edge is mixed: a world circuit's, with ?fences=1.
 * @param mixFences the venue's VenueSpec.mixFences
 * @returns true to mix it
 */
export const mixesFences = (mixFences?: boolean): boolean => !!mixFences && FIX.fences;

/**
 * The kind at a sample beside a real rail: a mapped fence's chain link on a mixed edge (where
 * no trap or tyre wall wants the Armco), else Armco.
 * @param railKind the map's kind of the nearest rail (barrier=fence, wall, guard_rail ...)
 * @param mixed the edge is mixed
 * @returns EDGE_MESH or EDGE_ARMCO
 */
export const railEdge = (railKind: string | undefined, mixed: boolean): number =>
  mixed && railKind === 'fence' ? EDGE_MESH : EDGE_ARMCO;

/**
 * A mixed edge's open run-off closed by a wooden fence (set back: venueedge.ts setFenceBack).
 * @param kinds the kinds round the loop (changed)
 */
export function woodOnOpen(kinds: Uint8Array): void {
  for (let i = 0; i < kinds.length; i++) if (kinds[i] === EDGE_NONE) kinds[i] = EDGE_WOOD;
}

/**
 * Fills each gap of nothing no longer than most samples between two runs of the same kind (no
 * random short gaps).
 * @param kinds the kinds round the loop (changed)
 * @param most samples
 */
export function fillGaps(kinds: Uint8Array, most: number): void {
  const count = kinds.length;
  for (let i = 0; i < count; i++) {
    if (kinds[i] === EDGE_NONE || kinds[(i + 1) % count] !== EDGE_NONE) continue;
    let gap = 1;
    while (gap <= most && kinds[(i + gap) % count] === EDGE_NONE) gap++;
    if (gap <= most && kinds[(i + gap) % count] === kinds[i])
      for (let fill = 1; fill < gap; fill++) kinds[(i + fill) % count] = kinds[i];
  }
}

/**
 * Grows every run into the nothing either side of it by up to grow samples.
 * @param kinds the kinds round the loop (changed)
 * @param grow samples
 */
export function growRuns(kinds: Uint8Array, grow: number): void {
  const count = kinds.length, before = kinds.slice();
  for (let i = 0; i < count; i++) {
    if (before[i] !== EDGE_NONE) continue;
    for (let reach = 1; reach <= grow; reach++) {
      const ahead = before[(i + reach) % count], behind = before[(i - reach + count) % count];
      if (ahead !== EDGE_NONE || behind !== EDGE_NONE) {
        kinds[i] = ahead !== EDGE_NONE ? ahead : behind;
        break;
      }
    }
  }
}

/**
 * The runs of one kind round a rim side, as point lists (a run across the loop's start joined).
 * @param pts the rim line's points (one a sample)
 * @param kinds the kinds
 * @param kind the kind wanted
 * @returns the runs
 */
export function kindRuns(pts: Point[], kinds: Uint8Array, kind: number): Point[][] {
  const count = kinds.length, runs: Point[][] = [];
  const first = kinds.findIndex((value) => value !== kind);
  if (first < 0) return [pts.slice(0, count).concat([pts[0]])];
  let run: Point[] = [];
  for (let step = 1; step <= count; step++) {
    const i = (first + step) % count;
    if (kinds[i] === kind) run.push(pts[i]);
    else if (run.length) { runs.push(run); run = []; }
  }
  if (run.length) runs.push(run);
  return runs.filter((line) => line.length > 1);
}

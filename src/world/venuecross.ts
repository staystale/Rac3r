// world/venuecross.ts - A VENUE'S ROAD THAT CROSSES ITSELF (owner 11-10 for Snoozuka: "keep the
// figure-of-eight as a drivable bridge, the back straight over the Degners-to-hairpin leg"). Where
// a layout's loop meets itself, the stretch on the piece the spec names (spec.crossover.under)
// dips into a cut and runs under the road over it: the race road's own tunnel crossing
// (world/crossings.ts, Crossing.track) between two portals, its cut walls the barriers there, the
// road over it on the ground with its own edge across the top. The stretch is marked under
// (world/trackunder.ts): a lookup for a car on the ground never takes it for the road below.
import { HALF_ROAD, VENUE_ROAD_M, centreAt } from './venuegeo.ts';
import { querySubtrack } from './tyrewall.ts';
import { PORTAL_LINTEL_M } from './crossinggeo.ts';
import { underSpan, underground } from './trackunder.ts';
import type { Barrier, Point, Prop, Subtrack } from './types.ts';
export { underSpan, underground };

// m (game): a portal's length (as a road tunnel's, venuescenery.ts PORTAL_LEN_M), the cut's width
// over the road's, the bridge's parapets past the road over it (its Armco: no run-off on the real
// bridge, ESRI World Imagery) and the lintel's clearance past them
const PORTAL_LEN_M = 9, CUT_SPARE_M = 1.2, PARAPET_M = 3, LINTEL_CLEAR_M = 3;
// m along the road over it its parapets run on past the cut (the eased Armco line meets the cap)
const PARAPET_RUN_M = 10;
// m along the loop two stretches lie apart at least to count as a crossing (not a joint)
const APART_M = 100;

/** Where a loop runs under itself: m along the stretch under and over, the sine between them. */
interface SelfCross {
  under: number;
  over: number;
  sine: number;
}

/**
 * Where two segments meet: the share along each, or null.
 * @param from1 the first's start
 * @param to1 its end
 * @param from2 the second's start
 * @param to2 its end
 * @returns [share along the first, share along the second], or null
 */
function meet(from1: Point, to1: Point, from2: Point, to2: Point): [number, number] | null {
  const dirX1 = to1[0] - from1[0], dirY1 = to1[1] - from1[1];
  const dirX2 = to2[0] - from2[0], dirY2 = to2[1] - from2[1];
  const den = dirX1 * dirY2 - dirY1 * dirX2;
  if (Math.abs(den) < 1e-9) return null;
  const gapX = from2[0] - from1[0], gapY = from2[1] - from1[1];
  const along = (gapX * dirY2 - gapY * dirX2) / den, across = (gapX * dirY1 - gapY * dirX1) / den;
  return along >= 0 && along <= 1 && across >= 0 && across <= 1 ? [along, across] : null;
}

/**
 * Where the loop crosses itself on the named piece: the piece's stretch of the loop (its points'
 * places along it) tested against every other segment.
 * @param sub the loop
 * @param piece the piece that runs under, at game scale
 * @returns the crossings
 */
function selfCrosses(sub: Subtrack, piece: Point[]): SelfCross[] {
  const along = piece.map(([x, y]) => querySubtrack(sub, x, y)).filter((hit) => hit.dist < 2)
    .map((hit) => hit.trackDist);
  if (along.length < 2) return [];
  const first = Math.min(...along), last = Math.max(...along), pts = sub.pts, count = pts.length;
  const found: SelfCross[] = [];
  for (let i = 0; i < count; i++) {
    const start = pts[i], end = pts[(i + 1) % count];
    if (start.dist < first || start.dist > last) continue;
    for (let j = 0; j < count; j++) {
      const other = pts[j], otherEnd = pts[(j + 1) % count];
      const apart = Math.abs(other.dist - start.dist);
      if (Math.min(apart, sub.totalDist - apart) < APART_M) continue;
      const hit = meet([start.x, start.y], [end.x, end.y], [other.x, other.y],
        [otherEnd.x, otherEnd.y]);
      if (!hit) continue;
      const len = Math.hypot(end.x - start.x, end.y - start.y);
      const otherLen = Math.hypot(otherEnd.x - other.x, otherEnd.y - other.y);
      const cross = ((end.x - start.x) * (otherEnd.y - other.y)
        - (end.y - start.y) * (otherEnd.x - other.x)) / (len * otherLen);
      found.push({ under: start.dist + hit[0] * len, over: other.dist + hit[1] * otherLen,
        sine: Math.abs(cross) });
    }
  }
  return found;
}

/**
 * The half-length of the underpass along the road under: from the crossing out past the road over
 * it and its parapet to the lintel, then the portal itself.
 * @param sine the sine of the angle between the two roads
 * @returns m
 */
const halfLength = (sine: number) => (HALF_ROAD + PARAPET_M + LINTEL_CLEAR_M)
  / Math.max(sine, 0.5) + PORTAL_LEN_M;
/**
 * The half-length of the bridge along the road over it: across the cut below and its walls, with a
 * margin (no wide run-off over the cut).
 * @param sine the sine of the angle between the two roads
 * @returns m
 */
const overHalf = (sine: number) => ((VENUE_ROAD_M + CUT_SPARE_M) / 2 + LINTEL_CLEAR_M + 1)
  / Math.max(sine, 0.5) + PARAPET_RUN_M;

/**
 * The stretches of a layout's loop that pass under it (m along), for spec.crossover.
 * @param sub the loop
 * @param piece the piece that runs under, at game scale (none: the venue has no crossover)
 * @returns the stretches
 */
export function underSpans(sub: Subtrack, piece: Point[] | undefined):
  NonNullable<Subtrack['under']> {
  if (!piece) return [];
  return selfCrosses(sub, piece).map((cross) => {
    const half = halfLength(cross.sine);
    return { d0: cross.under - half, d1: cross.under + half, over: cross.over,
      overHalf: overHalf(cross.sine), cut: PORTAL_LEN_M - PORTAL_LINTEL_M };
  });
}

/**
 * The most a rim stands out at a distance along: the bridge's parapet over a crossover (the road
 * over it, its Armco at its edge across the cut below), else no cap.
 * @param sub the loop
 * @param dist m along
 * @returns m from the centre, or Infinity
 */
export function overCap(sub: Subtrack, dist: number): number {
  for (const span of sub.under || []) {
    if (span.over === undefined) continue;
    const apart = Math.abs(dist - span.over);
    if (Math.min(apart, sub.totalDist - apart) <= (span.overHalf || 0))
      return HALF_ROAD + PARAPET_M;
  }
  return Infinity;
}

/**
 * The two portals of each underpass (kind 'tunnel', laid in pairs facing each other: world/
 * crossings.ts venueCrossings makes the pair one crossing): on the road under, each with its ramp
 * running down toward the crossing, as wide as the race road and a little more.
 * @param sub the loop
 * @returns the portals
 */
export function underPortals(sub: Subtrack): Prop[] {
  const props: Prop[] = [];
  for (const span of sub.under || []) {
    const first = centreAt(sub, span.d0), last = centreAt(sub, span.d1);
    const head = Math.atan2(last.y - first.y, last.x - first.x);
    const dirX = Math.cos(head), dirY = Math.sin(head), mid = (span.d1 - span.d0) / 2;
    const centre = centreAt(sub, (span.d0 + span.d1) / 2), out = mid - PORTAL_LEN_M / 2;
    for (const side of [-1, 1])
      props.push({ kind: 'tunnel', x: centre.x + dirX * side * out, y: centre.y + dirY * side * out,
        rot: head + (side > 0 ? Math.PI : 0), w: PORTAL_LEN_M, h: VENUE_ROAD_M + CUT_SPARE_M,
        track: true } as Prop);
  }
  return props;
}


/**
 * Whether a distance along is on a crossover: under (the cut) or over it (the bridge, its
 * parapets laid by underParapets) - the edge stands neither there.
 * @param sub the loop
 * @param dist m along
 * @returns true when it is
 */
export function crossoverAt(sub: Subtrack, dist: number): boolean {
  return !!underSpan(sub, dist) || overCap(sub, dist) < Infinity;
}

/**
 * The bridge's two parapets over each crossover: Armco along the road over it, PARAPET_M past its
 * edges, the bridge's length and its approaches (the venue's edge stands neither side there).
 * @param sub the loop
 * @returns the barriers
 */
export function underParapets(sub: Subtrack): Barrier[] {
  const barriers: Barrier[] = [];
  for (const span of sub.under || []) {
    if (span.over === undefined || !span.overHalf) continue;
    for (const side of [1, -1]) {
      const pts: Point[] = [];
      for (let along = -span.overHalf; along <= span.overHalf + 0.01; along += 2) {
        const centre = centreAt(sub, span.over + along), off = side * (HALF_ROAD + PARAPET_M);
        pts.push([centre.x + centre.nx * off, centre.y + centre.ny * off]);
      }
      barriers.push({ kind: 'armco', pts });
    }
  }
  return barriers;
}

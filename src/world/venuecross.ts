// world/venuecross.ts - A VENUE'S ROAD THAT CROSSES ITSELF (owner 11-10 for Snoozuka: "keep the
// figure-of-eight as a drivable bridge, the back straight over the Degners-to-hairpin leg"). Where
// a layout's loop meets itself, the stretch on the piece the spec names (spec.crossover.under)
// dips into a cut and runs under the road over it: the race road's own tunnel crossing
// (world/crossings.ts, Crossing.track) between two portals, its cut walls the barriers there, the
// road over it on the ground with its own edge across the top. The stretch is marked under
// (world/trackunder.ts): a lookup for a car on the ground never takes it for the road below.
import { HALF_ROAD, VENUE_ROAD_M, centreAt, centreBetween } from './venuegeo.ts';
import { querySubtrack } from './tyrewall.ts';
import { PORTAL_LINTEL_M, PORTAL_WALL_M } from './crossinggeo.ts';
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
 * The stretch of a layout's loop under the ground (VenueSpec.tunnel: Moanaco's tunnel under the
 * shore's hotels): the mapped tunnel is its covered part, between the portals' lintels - each
 * portal's open cut runs on before it.
 * @param sub the loop
 * @param piece the piece mapped as the tunnel, at game scale (none: the venue has no tunnel)
 * @returns the stretch (no road over it)
 */
export function tunnelSpans(sub: Subtrack, piece: Point[] | undefined):
  NonNullable<Subtrack['under']> {
  if (!piece) return [];
  const ends = [piece[0], piece[piece.length - 1]].map(([x, y]) => querySubtrack(sub, x, y)
    .trackDist);
  const cut = PORTAL_LEN_M - PORTAL_LINTEL_M;
  return [{ d0: Math.min(...ends) - cut, d1: Math.max(...ends) + cut, cut }];
}

// m along the road between a bent tunnel's path points (its walls follow them)
const PATH_STEP_M = 2;

/**
 * The two portals of a stretch of the race road under the ground (a race-road tunnel's, a
 * crossover's underpass): each on the road at its end, turned along it, the first carrying the
 * road's centre through (Prop.path: world/crossings.ts lays the walls along it) - so a portal's
 * walls meet its road square where the road bends under (a crossover's S).
 * @param sub the loop
 * @param span the stretch under the ground
 * @param span.d0 m along where it starts (the first portal's open end)
 * @param span.d1 m along where it ends
 * @param span.cut m in from each end its open cut runs
 * @param covered a tunnel's slatted cover over it (none under a crossover's bridge)
 * @returns the two portals
 */
function roadPortals(sub: Subtrack, span: { d0: number; d1: number; cut?: number },
  covered: boolean): Prop[] {
  const path: Point[] = [];
  const count = Math.max(2, Math.round((span.d1 - span.d0) / PATH_STEP_M));
  for (let i = 0; i <= count; i++) {
    const centre = centreBetween(sub, span.d0 + (span.d1 - span.d0) * i / count);
    path.push([centre.x, centre.y]);
  }
  const portal = (dist: number, back: boolean): Prop => {
    const centre = centreBetween(sub, dist), head = Math.atan2(-centre.nx, centre.ny);
    return { kind: 'tunnel', x: centre.x, y: centre.y, rot: head + (back ? Math.PI : 0),
      w: PORTAL_LEN_M, h: VENUE_ROAD_M + CUT_SPARE_M, track: true } as Prop;
  };
  // (and the slats' outlines: a car below is hidden under each, seen between; under a bridge the
  // whole stretch between the lintels)
  const slats = covered ? { slats: tunnelSlats(sub, span).map(slatCorners) } : {};
  return [{ ...portal(span.d0 + PORTAL_LEN_M / 2, false), path, ...slats },
    portal(span.d1 - PORTAL_LEN_M / 2, true)];
}

// m (game): THE TUNNEL'S COVER IN SLATS (owner 11-11: "in thin sections with gaps so you can see
// through but vision is obscured"): each slat's length along the road, the gap between two (a car
// is glimpsed through it; narrower than a car, so none drives down into one), its width (past the
// edge's barriers either side: the ground over the tunnel is not reached from the track)
const SLAT_M = 3.2, SLAT_GAP_M = 1.4, SLAT_W_M = 26;

/** One slat of a tunnel's cover: its middle, turn along the road, length and width (game m). */
interface Slat { x: number; y: number; rot: number; w: number; h: number }

/**
 * The slats over a race-road tunnel's underground stretch (from one portal's lintel to the
 * other's), turned along the road beneath, the first and last at the lintels.
 * @param sub the loop
 * @param span the stretch under the ground
 * @param span.d0 m along where it starts
 * @param span.d1 m along where it ends
 * @param span.cut m in from each end its open cut runs
 * @returns the slats
 */
function tunnelSlats(sub: Subtrack, span: { d0: number; d1: number; cut?: number }): Slat[] {
  const from = span.d0 + (span.cut || 0), upTo = span.d1 - (span.cut || 0);
  const count = Math.max(1, Math.round((upTo - from + SLAT_GAP_M) / (SLAT_M + SLAT_GAP_M)));
  const pitch = count > 1 ? (upTo - from - SLAT_M) / (count - 1) : 0, slats: Slat[] = [];
  for (let i = 0; i < count; i++) {
    const centre = centreBetween(sub, from + SLAT_M / 2 + pitch * i);
    slats.push({ x: centre.x, y: centre.y, rot: Math.atan2(-centre.nx, centre.ny), w: SLAT_M,
      h: SLAT_W_M });
  }
  return slats;
}

/**
 * A slat's corners (the stretch of the tunnel it hides: world/crossings.ts Crossing.hidden).
 * @param slat the slat
 * @returns its four corners
 */
const slatCorners = (slat: Slat): Point[] => [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(
  ([along, across]): Point => [
    slat.x + Math.cos(slat.rot) * along * slat.w / 2 - Math.sin(slat.rot) * across * slat.h / 2,
    slat.y + Math.sin(slat.rot) * along * slat.w / 2 + Math.cos(slat.rot) * across * slat.h / 2]);

/**
 * The cover over each race-road tunnel with no road over it (VenueSpec.tunnel: Moanaco's): its
 * slats - solid on the ground, not in the tunnel; between them a car below is seen.
 * @param sub the loop
 * @returns the slat props
 */
export function tunnelCover(sub: Subtrack): Prop[] {
  return (sub.under || []).filter((span) => span.over === undefined)
    .flatMap((span) => tunnelSlats(sub, span)).map((slat) => ({ kind: 'slat', ...slat }));
}

/**
 * The two portals of each underpass (kind 'tunnel', laid in pairs: world/crossings.ts
 * venueCrossings makes the pair one crossing): on the road under, each turned along the road at
 * its end with its ramp running down toward the crossing, as wide as the race road and a little
 * more, the crossing's walls along the road between (roadPortals) - a crossover's under its
 * bridge, a tunnel with no road over it (VenueSpec.tunnel) under its slats.
 * @param sub the loop
 * @returns the portals
 */
export function underPortals(sub: Subtrack): Prop[] {
  return (sub.under || []).flatMap((span) => roadPortals(sub, span, span.over === undefined));
}


/**
 * Whether a distance along is on a crossover: under (the cut) or over it (the bridge, its
 * parapets laid by underParapets) - the edge stands neither there; a tunnel with no road over it,
 * under the ground.
 * @param sub the loop
 * @param dist m along
 * @returns true when it is
 */
export function crossoverAt(sub: Subtrack, dist: number): boolean {
  // (a tunnel with no road over it: only its underground stretch - the edge runs on past its
  // portals' walls to the lintels, the buildings over it beyond)
  const span = underSpan(sub, dist);
  if (span && span.over === undefined) return underground(sub, dist);
  return !!span || overCap(sub, dist) < Infinity;
}

// m a parapet's end keeps off an underpass portal's walls (it stops at their outer face)
const PARAPET_CLEAR_M = 0.5;

/**
 * Whether a point lies on an underpass portal's footprint (its cut and side walls, and a margin).
 * @param portal the portal (w its length along its road, h its width between the walls)
 * @param point the point
 * @returns true when it does
 */
function onPortal(portal: Prop, [x, y]: Point): boolean {
  const cosR = Math.cos(portal.rot || 0), sinR = Math.sin(portal.rot || 0);
  const along = (x - portal.x) * cosR + (y - portal.y) * sinR;
  const across = -(x - portal.x) * sinR + (y - portal.y) * cosR;
  return Math.abs(along) <= portal.w! / 2 + PARAPET_CLEAR_M
    && Math.abs(across) <= portal.h! / 2 + PORTAL_WALL_M + PARAPET_CLEAR_M;
}

/**
 * The bridge's two parapets over each crossover: Armco along the road over it, PARAPET_M past its
 * edges, the bridge's length and its approaches (the venue's edge stands neither side there) -
 * the stretch that runs along a portal's side wall (the roads' X, where they part slowly) left
 * out, so the Armco stops at the portal's walls each side and never runs over its cut.
 * @param sub the loop
 * @returns the barriers
 */
export function underParapets(sub: Subtrack): Barrier[] {
  const barriers: Barrier[] = [], portals = underPortals(sub);
  const onAny = (point: Point) => portals.some((portal) => onPortal(portal, point));
  for (const span of sub.under || []) {
    if (span.over === undefined || !span.overHalf) continue;
    for (const side of [1, -1]) {
      const pts: Point[] = [];
      for (let along = -span.overHalf; along <= span.overHalf + 0.01; along += 2) {
        const centre = centreAt(sub, span.over + along), off = side * (HALF_ROAD + PARAPET_M);
        pts.push([centre.x + centre.nx * off, centre.y + centre.ny * off]);
      }
      // (in runs: the stretch along a portal's footprint left out)
      let run: Point[] = [];
      for (const point of [...pts, null]) {
        if (point && !onAny(point)) {
          run.push(point);
          continue;
        }
        if (run.length >= 2) barriers.push({ kind: 'armco', pts: run });
        run = [];
      }
    }
  }
  return barriers;
}

// m (game): a pit tunnel's portal (shorter than a road tunnel's: room by the first corner) and its
// cut's width over the pit lane's (venuepit.ts PIT_W 9)
const PIT_PORTAL_M = 7, PIT_TUNNEL_W = 10.2;

/**
 * A pit lane's tunnel under the track (VenueSpec.pitTunnel: Yass Marina's pit exit): its two
 * portals, each at one open end with its ramp running down toward the other (world/crossings.ts
 * venueCrossings makes the pair one crossing).
 * @param tunnel the open ends, game m (none: no pit tunnel)
 * @param tunnel.a the end the pit lane goes in by
 * @param tunnel.b the end the exit comes out of
 * @returns the portals
 */
export function pitTunnelPortals(tunnel?: { a: Point; b: Point }): Prop[] {
  if (!tunnel) return [];
  const { a, b } = tunnel, head = Math.atan2(b[1] - a[1], b[0] - a[0]);
  const dirX = Math.cos(head), dirY = Math.sin(head), half = PIT_PORTAL_M / 2;
  return [
    { kind: 'tunnel', x: a[0] + dirX * half, y: a[1] + dirY * half, rot: head, w: PIT_PORTAL_M,
      h: PIT_TUNNEL_W } as Prop,
    { kind: 'tunnel', x: b[0] - dirX * half, y: b[1] - dirY * half, rot: head + Math.PI,
      w: PIT_PORTAL_M, h: PIT_TUNNEL_W } as Prop,
  ];
}

// world/trackunder.ts - A ROAD THAT CROSSES ITSELF (a figure of eight: Snoozuka's back straight
// over the Degner-to-hairpin leg; owner 11-10: "keep the figure-of-eight as a drivable bridge").
// The stretch that dips under is the race road's own tunnel crossing (world/crossings.ts,
// Crossing.track): a car in it is on another level - no contact with a car over it, no barrier but
// the cut's walls - and keeps its race progress along the road below (game/order.ts). Its
// segments are marked under (Subtrack.under): a lookup for a car on the ground (tyrewall.ts
// QUERY_GROUND) never takes the road below for the road it is on, one for a car in the underpass
// (QUERY_UNDER) only that road - the race order, the ground under its wheels, a reset, the AI's
// place on its line, the minimap. Every other question (the venue's build, the AI's line) sees
// the whole road, as on every level whose road never crosses itself.
import { crossingOf } from './crossinggeo.ts';
import { QUERY_ALL, QUERY_GROUND, QUERY_UNDER, findNearestSubtrackPoint, onGroundQuery }
  from './tyrewall.ts';
import type { Crossing, Subtrack, TrackPoint } from './types.ts';

// m behind a stretch under the track a car is put back (clear of its cut, on the ground)
const BACK_M = 10;

/**
 * Marks the stretches of a road that pass under it (each m along, d0 < d1, inside one lap).
 * @param sub the road
 * @param spans the stretches
 */
export function markUnder(sub: Subtrack, spans: NonNullable<Subtrack['under']>): void {
  if (!spans.length) return;
  sub.under = spans;
  const pts = sub.pts;
  for (let i = 0; i < sub.segs.length; i++) {
    const from = pts[i].dist, upTo = pts[(i + 1) % pts.length].dist || sub.totalDist;
    if (spans.some((span) => upTo > span.d0 && from < span.d1)) sub.segs[i].under = true;
  }
}

/**
 * The stretch under the track a distance along lies in.
 * @param sub the road
 * @param dist m along
 * @returns the stretch, or null
 */
export function underSpan(sub: Subtrack, dist: number):
  NonNullable<Subtrack['under']>[number] | null {
  if (!sub.under) return null;
  const along = ((dist % sub.totalDist) + sub.totalDist) % sub.totalDist;
  return sub.under.find((span) => along >= span.d0 && along <= span.d1) || null;
}

/**
 * Whether a distance along lies under the ground of an underpass: between its portals' lintels
 * (the road over it carries its edge there and is drawn whole; over the open cuts nothing stands).
 * @param sub the road
 * @param dist m along
 * @returns true when it does
 */
export function underground(sub: Subtrack, dist: number): boolean {
  return (sub.under || []).some((span) => dist >= span.d0 + (span.cut || 0)
    && dist <= span.d1 - (span.cut || 0));
}

/**
 * A distance along moved back out of a stretch under the track (a reset never lands in its cut).
 * @param sub the road
 * @param dist m along
 * @returns the distance, or BACK_M before the stretch it lay in
 */
export function clearOfUnder(sub: Subtrack, dist: number): number {
  const span = underSpan(sub, dist);
  return span ? (span.d0 - BACK_M + sub.totalDist) % sub.totalDist : dist;
}

/**
 * Whether a car is in the race road's own underpass.
 * @param car the car
 * @param car.crossing the crossing it is on (world/crossings.ts)
 * @returns true when it is
 */
export function inTrackUnderpass(car: { crossing?: number }): boolean {
  const way: Crossing | null = crossingOf(car);
  return !!way && !!way.track;
}

/**
 * The level a car's lookups are made at: the ground's, the track underpass's, or (on another
 * crossing - a road's bridge or tunnel) all.
 * @param car the car
 * @param car.crossing the crossing it is on
 * @returns QUERY_GROUND, QUERY_UNDER or QUERY_ALL
 */
export function queryLevelOf(car: { crossing?: number }): number {
  const way = crossingOf(car);
  return !way ? QUERY_GROUND : way.track ? QUERY_UNDER : QUERY_ALL;
}

/**
 * The centre point at a distance along.
 * @param sub the road
 * @param dist m along
 * @returns the last point at or before it
 */
function pointAt(sub: Subtrack, dist: number): TrackPoint {
  const pts = sub.pts;
  let low = 0, high = pts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (pts[mid].dist <= dist) low = mid; else high = mid - 1;
  }
  return pts[low];
}

/**
 * Where a car is put back on the road: the nearest centre point to it on the ground (never the
 * road below it at a crossover), or, for a car in the track's underpass, the road BACK_M before
 * the underpass it is in.
 * @param sub the road
 * @param x world x
 * @param y world y
 * @param car the car (its level), if any
 * @param car.crossing the crossing it is on
 * @param maxProgressDist never a point past this far along (findNearestSubtrackPoint)
 * @returns the point, or null
 */
export function trackSpotOf(sub: Subtrack, x: number, y: number, car?: { crossing?: number },
  maxProgressDist = Infinity): TrackPoint | null {
  if (car && sub.under && inTrackUnderpass(car)) {
    let best: TrackPoint | null = null, bestD = Infinity;
    for (let i = 0; i < sub.pts.length; i++) {
      if (!sub.segs[i]?.under) continue;
      const point = sub.pts[i], dist = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (dist < bestD) { bestD = dist; best = point; }
    }
    if (best) return pointAt(sub, clearOfUnder(sub, best.dist));
  }
  return onGroundQuery(() => findNearestSubtrackPoint(sub, x, y, maxProgressDist));
}

// world/venueparks.ts - A PAVED VENUE'S GRASS (owner 11-11 on Moanaco: the parks "in their real
// outlines"): the mapped parks, gardens, lawns and woods (VenueData.parks, written by
// tools/osmvenue.mjs "parks") as outlined grass zones on a venue's paved ground. Each outline is
// held PARK_CLEAR_M off every race road (a tunnel's too) - a point nearer is moved out along the
// road's normal to that line, so the park's edge follows the road there (an inset, not a shrunk
// box) - and a park the road runs through (a hairpin across a garden), or one between two roads
// with no room for it, is left out. Bushes grow
// on them (world/bushplan.ts: grass only). Only a venue whose data carries parks has any.
import { SURFACES } from "./surfaces.ts";
import { centreAt, nearestLoop, resample } from "./venuegeo.ts";
import { outlineZone } from "./venuetraps.ts";
import { placeAll } from "./venuesite.ts";
import { insidePolygon } from "./zones.ts";
import type { Site } from "./venuesite.ts";
import type { Point, Zone } from "./types.ts";

// m (game): a park's edge off a race road's centre (the road's half, its run-off and the edge's
// barrier, its kerb and a margin: as the boxed pads kept), m between its outline's points, the
// least share of its mapped area a park keeps (less: left out), m two points stay apart and the
// sharpest turn (cos) an outline keeps (a point pushed out past its neighbours folds back)
const PARK_CLEAR_M = 13, PARK_STEP_M = 2, PARK_KEEP = 0.3, PARK_APART_M = 0.5;
const PARK_FOLD_COS = -0.85;

/**
 * A closed outline's area.
 * @param pts the outline
 * @returns m2
 */
function areaOf(pts: Point[]): number {
  let twice = 0;
  for (let i = 0; i < pts.length; i++) {
    const [fromX, fromY] = pts[i], [toX, toY] = pts[(i + 1) % pts.length];
    twice += fromX * toY - toX * fromY;
  }
  return Math.abs(twice / 2);
}

/**
 * A point held PARK_CLEAR_M off the nearest race road (a tunnel's too: its road is seen between
 * its cover's slats).
 * @param site the venue's builders' state
 * @param point the point
 * @returns the point, or moved out along the road's normal
 */
function holdOff(site: Site, point: Point): Point {
  const { sub, hit } = nearestLoop(site.loops, point[0], point[1]);
  if (!(hit.dist < PARK_CLEAR_M)) return point;
  const centre = centreAt(sub, hit.trackDist), side = hit.side === 'left' ? 1 : -1;
  return [centre.x + centre.nx * side * PARK_CLEAR_M, centre.y + centre.ny * side * PARK_CLEAR_M];
}

/**
 * Whether a point keeps PARK_CLEAR_M (less a little: the held line itself) off every race road.
 * @param site the venue's builders' state
 * @param point the point
 * @returns true when it does
 */
function isClear(site: Site, point: Point): boolean {
  return !(nearestLoop(site.loops, point[0], point[1]).hit.dist < PARK_CLEAR_M - 0.5);
}

/**
 * An outline without its bunched points and folds (a point whose neighbours turn back on it).
 * @param pts the outline
 * @returns the points kept
 */
function withoutFolds(pts: Point[]): Point[] {
  const kept: Point[] = [];
  for (const point of pts) {
    const last = kept[kept.length - 1];
    if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) >= PARK_APART_M)
      kept.push(point);
  }
  return kept.filter((point, i) => {
    const before = kept[(i - 1 + kept.length) % kept.length], after = kept[(i + 1) % kept.length];
    const inX = point[0] - before[0], inY = point[1] - before[1];
    const outX = after[0] - point[0], outY = after[1] - point[1];
    const lens = Math.hypot(inX, inY) * Math.hypot(outX, outY) || 1;
    return (inX * outX + inY * outY) / lens > PARK_FOLD_COS;
  });
}

/**
 * Whether a race road runs through an outline (a point of it inside).
 * @param site the venue's builders' state
 * @param outline the outline
 * @returns true when one does
 */
function crossedByRoad(site: Site, outline: Point[]): boolean {
  return site.loops.some((sub) => sub.pts.some((point) => insidePolygon(outline, point.x,
    point.y)));
}

/**
 * The venue's parks as grass zones, held off the race roads.
 * @param site the venue's builders' state
 * @returns the zones (none for a venue whose data has no parks)
 */
export function venueParks(site: Site): Zone[] {
  return (site.build.spec.data.parks || []).flatMap((park) => {
    const outline = resample(placeAll(site, park.pts), PARK_STEP_M);
    if (outline.length < 3 || crossedByRoad(site, outline)) return [];
    const held = withoutFolds(outline.map((point) => holdOff(site, point)));
    if (held.length < 3 || areaOf(held) < PARK_KEEP * areaOf(outline)) return [];
    // (a strip between two roads, held off one onto the other: no room for it)
    if (held.some((point) => !isClear(site, point))) return [];
    return [outlineZone(held, SURFACES.grass)];
  });
}

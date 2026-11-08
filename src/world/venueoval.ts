// world/venueoval.ts - A SPEEDWAY'S OWN PARTS (world/venuescenery.ts builds the rest; Dieatona's):
// the concrete wall round the oval's outside right at its edge, the lakes in the infield as
// scenery water, and the surfaces laid by hand as outlines (a mown pattern in the infield grass).
import { alongTrack, smoothOnTrack } from "./barriers.ts";
import { SURFACES } from "./surfaces.ts";
import { HALF_ROAD, centreAt, nearestLoop } from "./venuegeo.ts";
import { querySubtrack } from "./tyrewall.ts";
import { outlineZone, pastRim } from "./venueedge.ts";
import { onLanes, placeAll } from "./venuesite.ts";
import { insidePolygon } from "./zones.ts";
import type { Site } from "./venuesite.ts";
import type { Barrier, Cover, Point, Zone } from "./types.ts";

// m (game) between the slices a lake is laid in as overlapping ellipses, and how far each runs
const LAKE_SLICE_M = 5, LAKE_OVERLAP = 2.4;
// m a lake keeps from the edge's rim and from a road (its shore never on the tarmac)
const LAKE_CLEAR_M = 2;

/**
 * The oval's outside wall (spec.ovalWall): one closed barrier gapM past the outer edge of the
 * layout it names, all the way round (the real speedway's wall, a SAFER barrier on concrete).
 * @param site the venue's builders' state
 * @returns the wall, or null with none asked for
 */
export function ovalWall(site: Site): Barrier | null {
  const wall = site.build.spec.ovalWall, sub = wall && site.build.loops[wall.layout];
  if (!wall || !sub) return null;
  // which side is outside: the +normal side's point beyond the road lies outside the loop's outline
  const outline = sub.pts.map((point): Point => [point.x, point.y]);
  const probe = smoothOnTrack(sub, 0, 30);
  const side = insidePolygon(outline, probe.x, probe.y) ? -1 : 1;
  // held gapM off every layout's road (the road course's trace of the shared banking wanders a
  // metre from the oval's)
  const loops = Object.values(site.build.loops), offset = side * (HALF_ROAD + wall.gapM);
  const pts = alongTrack(sub, 0, sub.totalDist, offset, 2).map(([x, y]): Point => {
    const { hit } = nearestLoop(loops, x, y);
    const short = HALF_ROAD + wall.gapM - hit.dist;
    if (!(short > 0)) return [x, y];
    const centre = centreAt(sub, querySubtrack(sub, x, y).trackDist);
    return [x + centre.nx * side * short, y + centre.ny * side * short];
  });
  return { kind: wall.kind, pts };
}

/**
 * The lakes (data.water) as scenery water: each laid in slices across its long axis, an ellipse
 * over each stretch of water the slice crosses, the ellipses overlapping into one shore; none on a
 * road or inside the edge's rim.
 * @param site the venue's builders' state
 * @returns the covers
 */
export function venueWater(site: Site): Cover[] {
  const covers: Cover[] = [];
  for (const lake of site.build.spec.data.water || []) {
    const pts = placeAll(site, lake.pts);
    // the long axis: the widest pair of points' direction
    let best = 0, axis = 0;
    for (const [fromX, fromY] of pts) for (const [toX, toY] of pts) {
      const span = Math.hypot(toX - fromX, toY - fromY);
      if (span > best) [best, axis] = [span, Math.atan2(toY - fromY, toX - fromX)];
    }
    const cosA = Math.cos(axis), sinA = Math.sin(axis);
    const toAxis = ([x, y]: Point): Point => [x * cosA + y * sinA, -x * sinA + y * cosA];
    const local = pts.map(toAxis), alongs = local.map(([along]) => along);
    for (let along = Math.min(...alongs) + LAKE_SLICE_M / 2; along < Math.max(...alongs);
      along += LAKE_SLICE_M) {
      // where the slice line crosses the shore, paired into stretches of water
      const crossings: number[] = [];
      for (let i = 0; i < local.length; i++) {
        const [fromU, fromV] = local[i], [toU, toV] = local[(i + 1) % local.length];
        if ((fromU - along) * (toU - along) < 0)
          crossings.push(fromV + (toV - fromV) * (along - fromU) / (toU - fromU));
      }
      crossings.sort((first, second) => first - second);
      for (let pair = 0; pair + 1 < crossings.length; pair += 2) {
        const across = (crossings[pair] + crossings[pair + 1]) / 2;
        const high = crossings[pair + 1] - crossings[pair];
        const x = along * cosA - across * sinA, y = along * sinA + across * cosA;
        const ends = [-1, 1].map((end): Point =>
          [x - sinA * end * high / 2, y + cosA * end * high / 2]);
        if ([[x, y], ...ends].some(([atX, atY]) => pastRim(site.rims, atX, atY) < LAKE_CLEAR_M
          || onLanes(site.lanes, atX, atY, LAKE_CLEAR_M))) continue;
        covers.push({ x, y, w: LAKE_SLICE_M * LAKE_OVERLAP, h: high, cover: 'wet', water: true,
          shape: 'ellipse', rot: axis });
      }
    }
  }
  return covers;
}

/**
 * The surfaces laid by hand as outlines (spec.patches, real m), placed as the map is.
 * @param site the venue's builders' state
 * @returns the zones
 */
export function venuePatches(site: Site): Zone[] {
  return (site.build.spec.patches || []).map((patch) =>
    outlineZone(placeAll(site, patch.pts), SURFACES[patch.surface]));
}

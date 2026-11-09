// world/venuetraps.ts - A VENUE'S GRAVEL TRAPS: the real ones' outlines as zones of gravel, only
// those beside the track (world/venueedge.ts sets the edge's Armco behind them).
import { SURFACES } from "./surfaces.ts";
import { insidePolygon } from "./zones.ts";
import { HALF_ROAD, centreAt, nearestLoop } from "./venuegeo.ts";
import type { Point, Subtrack, Zone } from "./types.ts";

// m past the road's edge within which a mapped trap must come to count as one (and its gravel
// must start, beside each point)
export const TRAP_NEAR_M = 6;
// the share of a mapped trap's outline that must lie that near (it sits against the track)
const TRAP_SHARE = 0.15;
// m along the road between the samples a trap is looked for beside (twice the rim's step)
const TRAP_SCAN_M = 4;

/**
 * Whether a point lies in any of a list of outlined zones.
 * @param zones the zones (with poly)
 * @param x world x
 * @param y world y
 * @returns true inside one
 */
export function inZones(zones: Zone[], x: number, y: number): boolean {
  return zones.some((zone) => Math.abs(x - zone.x) <= zone.w / 2
    && Math.abs(y - zone.y) <= zone.h / 2 && insidePolygon(zone.poly!, x, y));
}

/**
 * An outline as a zone of a surface (its bounding box as x / y / w / h).
 * @param poly the outline at game scale
 * @param surface the surface
 * @returns the zone
 */
export function outlineZone(poly: Point[], surface: Zone['surface']): Zone {
  const allX = poly.map(([x]) => x), allY = poly.map(([, y]) => y);
  const minX = Math.min(...allX), maxX = Math.max(...allX);
  const minY = Math.min(...allY), maxY = Math.max(...allY);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, w: maxX - minX, h: maxY - minY, surface,
    poly };
}

/**
 * The real gravel traps as outlined zones (only those beside the track).
 * @param traps the outlines at game scale
 * @param loops every layout's road
 * @returns the zones
 */
export function trapZones(traps: Point[][], loops: Subtrack[]): Zone[] {
  // a trap is beside the track: its nearest point within TRAP_NEAR_M of a race road's edge (a
  // mapped gravel patch off in the paddock is not a trap)
  const beside = (poly: Point[]) => poly.filter(([x, y]) =>
    nearestLoop(loops, x, y).hit.dist < HALF_ROAD + TRAP_NEAR_M).length >= poly.length * TRAP_SHARE;
  const zones = traps.filter((poly) => poly.length > 2 && beside(poly))
    .map((poly) => outlineZone(poly, SURFACES.gravel));
  return zones.filter((zone) => touchesRunoff(zone, loops));
}

/**
 * Whether a trap's gravel starts at the run-off somewhere: within TRAP_NEAR_M of a road's edge
 * at one of its samples (a patch beyond the grass is not a trap).
 * @param zone the trap zone
 * @param loops every layout's road
 * @returns true when it touches
 */
function touchesRunoff(zone: Zone, loops: Subtrack[]): boolean {
  for (const sub of loops)
    for (let dist = 0; dist < sub.totalDist; dist += TRAP_SCAN_M) {
      const centre = centreAt(sub, dist);
      const far = Math.abs(centre.x - zone.x) > zone.w / 2 + 25
        || Math.abs(centre.y - zone.y) > zone.h / 2 + 25;
      if (far) continue;
      for (const side of [1, -1])
        for (let out = HALF_ROAD + 0.5; out <= HALF_ROAD + TRAP_NEAR_M; out += 1)
          if (inZones([zone], centre.x + centre.nx * side * out, centre.y + centre.ny * side * out))
            return true;
    }
  return false;
}

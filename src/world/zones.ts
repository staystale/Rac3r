// zones.js - the ZONES section.
import { blockAt } from "./fieldblocks.ts";
import { LEVEL } from "./state.ts";
import { SURFACES } from "./surfaces.ts";
import type { Subtrack, SubtrackHit, Surface, Zone } from "./types.ts";
import { querySubtrackInto } from "./tyrewall.ts";

// ---------------------------------------------------------------------------------------------
// ZONES — every patch of surface on the floor, as ONE mechanism. A zone is a centred rectangle with
// a surface on it; first hit wins, and anything uncovered is the level's base surface. The lab's
// four quadrants and its low-friction panels are now the same kind of object with different
// numbers, which is what lets a second level lay its surfaces out completely differently for free.
//
// `boxed` only affects DRAWING — a rim and a painted name, for a test panel you are meant to aim
// at.
// m of tarmac round a rounded test pad (drawn by render.ts drawZones)
export const PAD_APRON = 1.2;
// |dx|, |dy| from the centre inside a rectangle of half-size hw x hh with corner radius R
function inRoundRect(dx: number, dy: number, halfW: number, halfH: number,
  radius: number): boolean {
  if (dx > halfW || dy > halfH) return false;
  const insetX = dx - (halfW - radius), insetY = dy - (halfH - radius);
  return insetX <= 0 || insetY <= 0 || insetX * insetX + insetY * insetY <= radius * radius;
}
// LANES (Thruston pit lane): LEVEL.lanes [{ pts: [[x,y]...] open polyline, width,
// surface }] — a ribbon of one surface along a path, for pit lanes and access roads. Drawn by
// render.ts drawLanes from the same pts and width.
export function laneAt(x: number, y: number): Surface | null {
  const list = LEVEL.lanes;
  if (!list) return null;
  for (const lane of list) {
    if (!lane._segs) {
      lane._segs = []; let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < lane.pts.length - 1; i++) {
        const [startX, startY] = lane.pts[i], [endX, endY] = lane.pts[i + 1], dx = endX - startX,
          dy = endY - startY;
        lane._segs.push({ ax: startX, ay: startY, dx, dy, l2: dx * dx + dy * dy || 1e-6 });
        minX = Math.min(minX, startX, endX);
        minY = Math.min(minY, startY, endY);
        maxX = Math.max(maxX, startX, endX);
        maxY = Math.max(maxY, startY, endY);
      }
      const halfWidth = lane.width / 2;
      lane._bb = [minX - halfWidth, minY - halfWidth, maxX + halfWidth, maxY + halfWidth];
    }
    const box = lane._bb!;   // set above on first visit
    if (x < box[0] || x > box[2] || y < box[1] || y > box[3]) continue;
    const halfWidthSq = (lane.width / 2) ** 2;
    for (const seg of lane._segs) {
      let frac = ((x - seg.ax) * seg.dx + (y - seg.ay) * seg.dy) / seg.l2;
      frac = frac < 0 ? 0 : frac > 1 ? 1 : frac;
      const perpX = x - seg.ax - seg.dx * frac, perpY = y - seg.ay - seg.dy * frac;
      if (perpX * perpX + perpY * perpY <= halfWidthSq) return lane.surface;
    }
  }
  return null;
}
// subtrackSurfaceAt's subtrack hit, reused (no allocation per lookup)
const SURFACE_HIT: SubtrackHit = { dist: Infinity, side: 'left', trackDist: 0, seg: null };
/**
 * The surface of the road ribbon (sector texturing) or its curved kerbs at a point.
 * @param subtrack the level's subtrack (with sectors)
 * @param x world x
 * @param y world y
 * @returns the ribbon / kerb surface, or null when the point is off both
 */
function subtrackSurfaceAt(subtrack: Subtrack, x: number, y: number): Surface | null {
  const hit = querySubtrackInto(subtrack, x, y, SURFACE_HIT);
  const halfW = subtrack.width / 2;
  if (hit.dist <= halfW) {
    const sec = subtrack.sectorAt ? subtrack.sectorAt(hit.trackDist) : null;
    return (sec && sec.surface) ? sec.surface : SURFACES.tarmac;
  }
  // Check curved kerbs on corner apexes and exits
  if (subtrack.curvedKerbs) {
    for (let i = 0; i < subtrack.curvedKerbs.length; i++) {
      const kerb = subtrack.curvedKerbs[i];
      if (kerb.side === hit.side && hit.trackDist >= kerb.startDist
        && hit.trackDist <= kerb.endDist) {
        if (hit.dist <= halfW + (kerb.width || 2.4)) return SURFACES.kerb;
      }
    }
  }
  return null;
}
/**
 * The surface a single zone gives a point (rounded pad + apron, rotated zone or plain rectangle).
 * @param zone the zone
 * @param x world x
 * @param y world y
 * @returns the zone's surface (or the pad apron's tarmac), or null when the point misses it
 */
function zoneSurfaceAt(zone: Zone, x: number, y: number): Surface | null {
  if (zone.rounded) {
    // ROUNDED PADS, exactly as render.ts drawZones draws them: corner radius min(5, 0.15 w) and a
    // PAD_APRON of tarmac round the outside. MEASURED BUG, (tools/visualcheck.mjs):
    // physics was the plain rectangle, so the drawn tarmac apron drove as grass and the
    // rounded-off corners drove as the pad's surface.
    const dx = Math.abs(x - zone.x), dy = Math.abs(y - zone.y),
      radius = Math.min(5, zone.w * 0.15);
    if (inRoundRect(dx, dy, zone.w / 2, zone.h / 2, radius)) return zone.surface;
    if (inRoundRect(dx, dy, zone.w / 2 + PAD_APRON, zone.h / 2 + PAD_APRON,
      radius + PAD_APRON)) return SURFACES.tarmac;
    return null;
  }
  if (zone.rot) {
    // ROTATED zone (Thruston's diagonal airfield runways, traced from the real map).
    // Cheap reject + cached trig (
    // the highway's fields put ~80 rotated zones in the window, tested for every wheel off the
    // road)
    const dx = x - zone.x, dy = y - zone.y;
    if (zone._r === undefined) {
      zone._r = Math.hypot(zone.w, zone.h) / 2;
      zone._co = Math.cos(zone.rot);
      zone._si = Math.sin(zone.rot);
    }
    if (dx * dx + dy * dy > zone._r * zone._r) return null;
    const cosRot = zone._co!, sinRot = zone._si!;   // set just above
    const localU = dx * cosRot + dy * sinRot, localV = -dx * sinRot + dy * cosRot;
    if (Math.abs(localU) > zone.w / 2 || Math.abs(localV) > zone.h / 2) return null;
    if (!zone.blocks) return zone.surface;
    // a ploughed field drying in blocks (?mudwater=1, fieldblocks.ts)
    const block = blockAt(zone.blocks, localU, localV);
    return block ? block.surface : zone.surface;
  }
  if (Math.abs(x - zone.x) <= zone.w / 2 && Math.abs(
    y - zone.y) <= zone.h / 2) return zone.surface;
  return null;
}
export function zoneAt(x: number, y: number): Surface {
  // 1. The road ribbon (sector surfaces) and its curved kerbs. A road with no sectors is tarmac,
  // as render/road.ts draws it: the physics must drive what the player sees (a sector-less road
  // drove as the level's base, grass, under a tarmac picture).
  if (LEVEL.subtrack) {
    const trackSurface = subtrackSurfaceAt(LEVEL.subtrack, x, y);
    if (trackSurface) return trackSurface;
  }

  // 1b. LANES (pit lanes, access roads): the track wins where they overlap (render draws lanes
  // UNDER the ribbon to match)
  const laneSurface = laneAt(x, y);
  if (laneSurface) return laneSurface;

  // 2. Dedicated proving ground test pads (Wet, Ice, Snow, Mud, Gravel)
  const z = LEVEL.zones;
  for (let i = 0; i < z.length; i++) {
    const zoneSurface = zoneSurfaceAt(z[i], x, y);
    if (zoneSurface) return zoneSurface;
  }
  return LEVEL.base!;   // every level sets base
}

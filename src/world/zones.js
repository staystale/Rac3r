// zones.js - the ZONES section. Moved verbatim out of lab.js.
import { LEVEL } from "./state.ts";
import { SURFACES } from "./surfaces.js";
import { querySubtrack } from "./tyrewall.js";

// ---------------------------------------------------------------------------------------------
// ZONES — every patch of surface on the floor, as ONE mechanism. A zone is a centred rectangle with a
// surface on it; first hit wins, and anything uncovered is the level's base surface. The lab's four
// quadrants and its low-friction panels are now the same kind of object with different numbers, which
// is what lets a second level lay its surfaces out completely differently for free.
//
// `boxed` only affects DRAWING — a rim and a painted name, for a test panel you are meant to aim at.
export const PAD_APRON = 1.2;   // m of tarmac round a rounded test pad (drawn by render.js drawZones)
// |dx|, |dy| from the centre inside a rectangle of half-size hw x hh with corner radius R
function inRoundRect(dx, dy, hw, hh, R) {
  if (dx > hw || dy > hh) return false;
  const ix = dx - (hw - R), iy = dy - (hh - R);
  return ix <= 0 || iy <= 0 || ix * ix + iy * iy <= R * R;
}
// LANES (2026-10-04, Thruston pit lane): LEVEL.lanes [{ pts: [[x,y]...] open polyline, width, surface }] — a ribbon of one surface
// along a path, for pit lanes and access roads. Drawn by render.js drawLanes from the same pts and width.
export function laneAt(x, y) {
  const list = LEVEL.lanes;
  if (!list) return null;
  for (const ln of list) {
    if (!ln._segs) {
      ln._segs = []; let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < ln.pts.length - 1; i++) {
        const [ax, ay] = ln.pts[i], [bx, by] = ln.pts[i + 1], dx = bx - ax, dy = by - ay;
        ln._segs.push({ ax, ay, dx, dy, l2: dx * dx + dy * dy || 1e-6 });
        x0 = Math.min(x0, ax, bx); y0 = Math.min(y0, ay, by); x1 = Math.max(x1, ax, bx); y1 = Math.max(y1, ay, by);
      }
      const h = ln.width / 2; ln._bb = [x0 - h, y0 - h, x1 + h, y1 + h];
    }
    const b = ln._bb; if (x < b[0] || x > b[2] || y < b[1] || y > b[3]) continue;
    const h2 = (ln.width / 2) ** 2;
    for (const g of ln._segs) {
      let t = ((x - g.ax) * g.dx + (y - g.ay) * g.dy) / g.l2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - g.ax - g.dx * t, ey = y - g.ay - g.dy * t;
      if (ex * ex + ey * ey <= h2) return ln.surface;
    }
  }
  return null;
}
export function zoneAt(x, y) {
  // 1. If on a circuit with defined track sectors: road ribbon has continuous sector texturing & curved kerbs
  if (LEVEL.subtrack && LEVEL.subtrack.sectors && LEVEL.subtrack.sectors.length > 0) {
    const q = querySubtrack(LEVEL.subtrack, x, y);
    const halfW = LEVEL.subtrack.width / 2;
    if (q.dist <= halfW) {
      const sec = LEVEL.subtrack.sectorAt ? LEVEL.subtrack.sectorAt(q.trackDist) : null;
      return (sec && sec.surface) ? sec.surface : SURFACES.tarmac;
    }
    // Check curved kerbs on corner apexes and exits
    if (LEVEL.subtrack.curvedKerbs) {
      for (let i = 0; i < LEVEL.subtrack.curvedKerbs.length; i++) {
        const k = LEVEL.subtrack.curvedKerbs[i];
        if (k.side === q.side && q.trackDist >= k.startDist && q.trackDist <= k.endDist) {
          if (q.dist <= halfW + (k.width || 2.4)) return SURFACES.kerb;
        }
      }
    }
  }

  // 1b. LANES (pit lanes, access roads): the track wins where they overlap (render draws lanes UNDER the ribbon to match)
  const ln = laneAt(x, y);
  if (ln) return ln;

  // 2. Dedicated proving ground test pads (Wet, Ice, Snow, Mud, Gravel)
  const z = LEVEL.zones;
  for (let i = 0; i < z.length; i++) {
    const q = z[i];
    if (q.rounded) {
      // ROUNDED PADS, exactly as render.js drawZones draws them: corner radius min(5, 0.15 w) and a PAD_APRON of tarmac
      // round the outside. MEASURED BUG, 2026-10-03 (tools/visualcheck.mjs): physics was the plain rectangle, so the
      // drawn tarmac apron drove as grass and the rounded-off corners drove as the pad's surface.
      const dx = Math.abs(x - q.x), dy = Math.abs(y - q.y), R = Math.min(5, q.w * 0.15);
      if (inRoundRect(dx, dy, q.w / 2, q.h / 2, R)) return q.surface;
      if (inRoundRect(dx, dy, q.w / 2 + PAD_APRON, q.h / 2 + PAD_APRON, R + PAD_APRON)) return SURFACES.tarmac;
      continue;
    }
    if (q.rot) {
      // ROTATED zone (2026-10-03: Thruston's diagonal airfield runways, traced from the real map). Cheap reject + cached trig (2026-10-06:
      // the highway's fields put ~80 rotated zones in the window, tested for every wheel off the road)
      const dx = x - q.x, dy = y - q.y;
      if (q._r === undefined) { q._r = Math.hypot(q.w, q.h) / 2; q._co = Math.cos(q.rot); q._si = Math.sin(q.rot); }
      if (dx * dx + dy * dy > q._r * q._r) continue;
      const co = q._co, si = q._si;
      if (Math.abs(dx * co + dy * si) <= q.w / 2 && Math.abs(-dx * si + dy * co) <= q.h / 2) return q.surface;
      continue;
    }
    if (Math.abs(x - q.x) <= q.w / 2 && Math.abs(y - q.y) <= q.h / 2) return q.surface;
  }
  return LEVEL.base;
}

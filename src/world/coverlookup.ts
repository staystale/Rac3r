// coverlookup.ts - the covers lying at a point: the level's own (LEVEL.covers: snow, ice and
// puddles of any shape over any surface) and, with the cover field (coverfield.ts), the weather's.
import { LEVEL } from "./state.ts";
import { coversNear } from "./covergrid.ts";
import { fieldCoverAt } from "./coverfield.ts";
import type { Cover, CoverId } from "./types.ts";

export const COVER_SQ = 0.5;   // m, the cover grid (render.ts coverCells uses the same 0.5)
/**
 * The level's own cover at a point (LEVEL.covers), or null.
 * @param x world x, m
 * @param y world y, m
 * @returns the cover
 */
export function staticCoverAt(x: number, y: number): CoverId | null {
  // only the covers that can hold the point (world/covergrid.ts: same answers, fewer tests)
  const list = coversNear(LEVEL.covers, x, y);
  for (let i = 0; i < list.length; i++) {
    const coverArea = list[i];
    // the SAME 0.5 m world-grid squares render.ts coverCells draws (user rule: visuals accurate to
    // their effects): the point is tested at the centre of its square, so a cover's grip edge is
    // exactly its drawn stepped edge
    let dx = Math.floor(x / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - coverArea.x,
      dy = Math.floor(y / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - coverArea.y;
    // CHEAP REJECT before any trig (profiled: Sweaty Lamb's 40-puddle stream made
    // coverAt 3.4 % of a lap); rotation cached
    const halfW = coverArea.w / 2, halfH = coverArea.h / 2, reach = halfW > halfH ? halfW : halfH;
    if (dx > reach || dx < -reach || dy > reach || dy < -reach) continue;
    if (coverArea.rot) {
      if (coverArea._co === undefined) {
        coverArea._co = Math.cos(coverArea.rot);
        coverArea._si = Math.sin(coverArea.rot);
      }
      const cosRot = coverArea._co, sinRot = coverArea._si!;   // _si is set together with _co
      const localU = dx * cosRot + dy * sinRot; dy = -dx * sinRot + dy * cosRot; dx = localU;
    }
    if (coverArea.shape === 'ellipse'
      ? (dx * dx) / (halfW * halfW) + (dy * dy) / (halfH * halfH) <= 1
      : Math.abs(dx) <= halfW && Math.abs(dy) <= halfH) {
      if (coverArea.cut && coverCut(coverArea, x, y)) continue;
      return coverArea.cover;
    }
  }
  return null;
}
// a cover's CUT-OUT (highway.js river: no water where the motorway crosses on its parapets): in the
// frame of (cut.ox, cut.oy) along c.rot, the band |u - v tan| < e is dry. Tested at the 0.5 m
// square's centre, like the cover itself (render.ts coverCells agrees).
export function coverCut(coverArea: Cover, x: number, y: number): boolean {
  const cut = coverArea.cut!, cosRot = Math.cos(coverArea.rot || 0),
    sinRot = Math.sin(coverArea.rot || 0);
  const offX = Math.floor(x / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - cut.ox,
    offY = Math.floor(y / COVER_SQ) * COVER_SQ + COVER_SQ / 2 - cut.oy;
  const localU = offX * cosRot + offY * sinRot, localV = -offX * sinRot + offY * cosRot;
  return Math.abs(localU - localV * cut.tn) < cut.e;
}

/**
 * The cover at a point: the level's own, else the weather's by the cover field (?coverfield=1).
 * @param x world x, m
 * @param y world y, m
 * @returns the cover, or null
 */
export function coverAt(x: number, y: number): CoverId | null {
  return staticCoverAt(x, y) ?? fieldCoverAt(x, y);
}

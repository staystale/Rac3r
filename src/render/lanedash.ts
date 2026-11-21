// render/lanedash.ts - ?dashphase: THE HIGHWAY'S LANE DASHES LAID BY THE ROAD'S DISTANCE. The
// canvas dash pattern (render/road.ts drawLaneDashes) runs along the stroked line's own length
// from the road window's first point; on a bend a lane line off the centre is longer or shorter
// than the road, so each time the window drops points behind, a spot's dashes move along it. A
// ground tile is painted once and kept (render/tiles.ts): tiles painted before and after a move
// did not line up - the dashes "skipping about". MEASURED (tools/scratch/_dashphase.mjs, motorway,
// 6 km): a spot's dash phase moved 2.37 m median (p95 4.28 m) per window move; 0 on the single
// lane (its only dashed line is the centre line). Here a dash stands wherever the road's absolute
// distance (sub.sBase + the point's dist) is in the first DASH_ON_M of each DASH_PATTERN_M: the
// same spot in every window.
import type { Subtrack } from '../world/types.ts';

// m: a dash and the pattern it repeats in (the canvas pattern's 3 m on, 6 m off)
const DASH_ON_M = 3, DASH_PATTERN_M = 9;

/** What the dashes are drawn with: the canvas and the world-to-screen helpers. */
export interface DashPainter {
  ctx: CanvasRenderingContext2D;
  toScreenX: (worldX: number) => number;
  toScreenY: (worldY: number) => number;
}

/**
 * Strokes one lane line's dashes at a lateral offset, each laid by the road's distance (stopping
 * at the ghost segment), in the stroke style already set.
 * @param painter the canvas and helpers
 * @param sub the road's subtrack
 * @param off the line's lateral offset, m
 */
export function strokeRoadDashes(painter: DashPainter, sub: Subtrack, off: number) {
  const { ctx, toScreenX, toScreenY } = painter;
  const pts = sub.pts, ghost = sub.ghost, base = sub.sBase || 0;
  ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1], point = pts[i];
    if (ghost && point.dist >= ghost.d0) break;
    const from = base + prev.dist, span = point.dist - prev.dist;
    if (span <= 0) continue;
    const prevX = prev.x + prev.nx * off, prevY = prev.y + prev.ny * off;
    const deltaX = point.x + point.nx * off - prevX, deltaY = point.y + point.ny * off - prevY;
    // every dash that overlaps this piece of road
    for (let dashAt = Math.floor(from / DASH_PATTERN_M) * DASH_PATTERN_M; dashAt < from + span;
      dashAt += DASH_PATTERN_M) {
      const startShare = Math.max(0, (dashAt - from) / span);
      const endShare = Math.min(1, (dashAt + DASH_ON_M - from) / span);
      if (endShare <= startShare) continue;
      ctx.moveTo(toScreenX(prevX + deltaX * startShare), toScreenY(prevY + deltaY * startShare));
      ctx.lineTo(toScreenX(prevX + deltaX * endShare), toScreenY(prevY + deltaY * endShare));
    }
  }
  ctx.stroke();
}

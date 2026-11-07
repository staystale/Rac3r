// render/paintline.ts - a painted LINE on the ground (Paint kind 'line': a venue's pit lane
// divider and entry / exit lines, world/venuescenery.ts): white, mark.lw wide, through its points.
// render/road.ts drawPaint calls it with the stroke width and tone already set.
import type { Paint } from '../world/types.ts';
import type { View } from './types.ts';

/** What the line drawer needs of the road context. */
interface LineCtx {
  view: View; toScreenX: (x: number) => number; toScreenY: (y: number) => number;
}

/**
 * Strokes one painted line through its points.
 * @param ctx the view and the world-to-screen helpers
 * @param mark the line (kind 'line', with pts)
 */
export function drawPaintLine(ctx: LineCtx, mark: Paint): void {
  if (!mark.pts || mark.pts.length < 2) return;
  const { view, toScreenX, toScreenY } = ctx;
  view.ctx.strokeStyle = '#eef0f2';
  view.ctx.beginPath();
  mark.pts.forEach(([x, y], i) => (i ? view.ctx.lineTo(toScreenX(x), toScreenY(y))
    : view.ctx.moveTo(toScreenX(x), toScreenY(y))));
  view.ctx.stroke();
}

// A TUNNEL'S SLATS TAKE NO LIGHT FROM BELOW THEM OR BESIDE THEM: a car outside a slatted (bent)
// tunnel - on the road before its mouth, past its far one, or beside its walls - does not light
// its cover's slats, which stand over the tunnel road (a car in the tunnel lights only its cut:
// render/light.ts clipToCut). Its light map is clipped off every slat of a cover within its
// light's reach; a cover out of reach costs one box test.
import { LEVEL } from '../world/state.ts';
import { lineBox, isBeyondBox } from '../world/venuegeo.ts';
import type { LineBox } from '../world/venuegeo.ts';
import type { Crossing } from '../world/types.ts';
import type { RenderCar } from './types.ts';

const COVER_BOXES = new WeakMap<Crossing, LineBox>();

/**
 * The box round a tunnel's cover: every slat's outline, cached per crossing.
 * @param way the tunnel (its hidden outlines)
 * @returns the box
 */
function coverBox(way: Crossing): LineBox {
  let box = COVER_BOXES.get(way);
  if (!box) {
    box = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
    for (const outline of way.hidden || []) {
      const slat = lineBox(outline);
      box.minX = Math.min(box.minX, slat.minX);
      box.minY = Math.min(box.minY, slat.minY);
      box.maxX = Math.max(box.maxX, slat.maxX);
      box.maxY = Math.max(box.maxY, slat.maxY);
    }
    COVER_BOXES.set(way, box);
  }
  return box;
}

/**
 * Clips a light map off the slats of every slatted cover a car outside it could light. Saves the
 * context when it clips (the caller restores it).
 * @param ctx the light map's context (identity transform after)
 * @param car the car, not in a tunnel
 * @param toX world x to the map's px
 * @param toY world y to the map's px
 * @param reachM how far its light reaches from its centre, m
 * @returns true when it clipped
 */
export function clipOffCovers(ctx: CanvasRenderingContext2D, car: RenderCar,
  toX: (x: number) => number, toY: (y: number) => number, reachM: number): boolean {
  let isClipping = false;
  for (const way of LEVEL.crossings || []) {
    if (!way.hidden || isBeyondBox(coverBox(way), car.x, car.y, reachM)) continue;
    if (!isClipping) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.beginPath();
      ctx.rect(0, 0, ctx.canvas.width, ctx.canvas.height);
      isClipping = true;
    }
    for (const outline of way.hidden) {
      outline.forEach(([x, y], i) => {
        if (i) ctx.lineTo(toX(x), toY(y));
        else ctx.moveTo(toX(x), toY(y));
      });
      ctx.closePath();
    }
  }
  // (the map less the slats: each slat's outline inside the map's rectangle)
  if (isClipping) ctx.clip('evenodd');
  return isClipping;
}

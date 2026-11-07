// render/carparts.ts - a part knocked off a car (world/debris.ts) is CUT FROM THE CAR'S
// OWN SPRITE, so it is that car's bumper / wing / panel - an F1 car's arched front wing, its rear
// wing, a sidepod - in its own paint, shape and accents, a little damaged; and the car is drawn
// without it from then on (owner 11-07, a shot of an F1 with its wing still on beside the bar it
// had shed: "the emitted part ... doesn't match what's on the car ... the emitted parts can be
// damaged slightly").
import { SPRITE_PPM } from "./shared.ts";
import type { CarSprite, RenderCarSpec } from "./types.ts";

// an open car - the single-seaters, the autograss buggy: its wings / nose and its side pods come
// off, not bumpers and door skins, and nothing is under them
const isBare = (spec: RenderCarSpec) => spec.kind === 'track' || spec.kind === 'grass';

/** A part's place on a sprite, sprite rgba (x rear 0 -> front, y the car's side), inclusive. */
interface Region { x0: number; x1: number; y0: number; y1: number }

/**
 * Where a part sits on a car's sprite.
 * @param spec the car as drawn
 * @param sprite its sprite
 * @param kind the part (bumper / wing / panel)
 * @param corner the damage corner (0, 1 front; odd = +y)
 * @returns the region
 */
export function partRegion(spec: RenderCarSpec, sprite: CarSprite, kind: string,
  corner: number): Region {
  const len = sprite.Lp, wid = sprite.Wp, mid = (wid - 1) / 2, front = corner < 2,
    plus = corner % 2 === 1;
  const side = (inner: number) => (plus ? { y0: wid - 1 - inner, y1: wid + 1 }
    : { y0: -2, y1: inner });
  if (isBare(spec)) {
    if (kind === 'bumper') return front ? { x0: len - 8, x1: len + 1, y0: -2, y1: wid + 1 }
      : { x0: -2, x1: 5, y0: -2, y1: wid + 1 };
    return { x0: Math.round(len * 0.22), x1: Math.round(len * 0.52),
      ...(plus ? { y0: Math.ceil(mid) + 3, y1: wid + 1 } : { y0: -2, y1: Math.floor(mid) - 3 }) };
  }
  // (a bumper ~0.25-0.3 m deep from above: 5 px with the lamps in it)
  if (kind === 'bumper') return front ? { x0: len - 5, x1: len + 1, y0: -2, y1: wid + 1 }
    : { x0: -2, x1: 4, y0: -2, y1: wid + 1 };
  if (kind === 'wing') {
    const axle = Math.round(len / 2 + (front ? spec.lf : -spec.lr) * SPRITE_PPM);
    return { x0: axle - 7, x1: axle + 7, ...side(3) };
  }
  return { x0: Math.round(len * 0.36), x1: Math.round(len * 0.62), ...side(2) };
}

/**
 * A small seeded random stream (each part dented its own way, the same every frame).
 * @param seed the seed
 * @returns 0..1 draws
 */
function seeded(seed: number) {
  let state = (seed * 2654435761) >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}

/**
 * The part itself: its region copied out of the clean sprite, lightly damaged - chipped edges,
 * scuffs and dents, a bent end (seeded).
 * @param sprite the car's clean sprite
 * @param region the part's region
 * @param seed its seed
 * @returns the part's canvas (its centre is the part's centre)
 */
export function cutPart(sprite: CarSprite, region: Region, seed: number): HTMLCanvasElement {
  const width = region.x1 - region.x0 + 1, height = region.y1 - region.y0 + 1;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(sprite.c, -(region.x0 + 2), -(region.y0 + 2));
  const img = ctx.getImageData(0, 0, width, height), rgba = img.data, rnd = seeded(seed);
  const bend = rnd() < 0.5 ? 0 : width - 1 - Math.floor(rnd() * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (rgba[i + 3] === 0) continue;
    const solidNear = (dx: number, dy: number) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < width && ny < height && rgba[(ny * width + nx) * 4 + 3] > 0;
    };
    const edge = !solidNear(1, 0) || !solidNear(-1, 0) || !solidNear(0, 1) || !solidNear(0, -1);
    const roll = rnd();
    if (edge && roll < 0.18) { rgba[i + 3] = 0; continue; }   // a chip off the edge
    const dent = roll > 0.9 ? 0.6 : roll > 0.86 ? 1.35 : (x >= bend && bend > 0) ? 0.8 : 1;
    for (const chan of [0, 1, 2]) rgba[i + chan] = Math.min(255, rgba[i + chan] * dent);
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/**
 * The car without the parts it has lost: each region darkened to the bare structure (a closed
 * car's bumper / wing / panel) or cleared (an open-wheeler's wing or sidepod - nothing under it).
 * @param spec the car as drawn
 * @param sprite its sprite (damaged or not)
 * @param lost the parts gone: "kind:corner" each, joined by ","
 * @returns a new sprite
 */
export function withoutParts(spec: RenderCarSpec, sprite: CarSprite, lost: string): CarSprite {
  const canvas = document.createElement('canvas');
  canvas.width = sprite.c.width; canvas.height = sprite.c.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(sprite.c, 0, 0);
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height), rgba = img.data;
  for (const entry of lost.split(',').filter(Boolean)) {
    const [kind, corner] = entry.split(':'), region = partRegion(spec, sprite, kind, +corner);
    for (let y = region.y0 + 2; y <= region.y1 + 2; y++) for (let x = region.x0 + 2;
      x <= region.x1 + 2; x++) {
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      const i = (y * canvas.width + x) * 4;
      if (isBare(spec)) { rgba[i + 3] = 0; continue; }
      for (const chan of [0, 1, 2]) rgba[i + chan] = Math.round(rgba[i + chan] * 0.3 + 18);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { ...sprite, c: canvas };
}

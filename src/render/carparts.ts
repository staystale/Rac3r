// render/carparts.ts - a part knocked off a car (world/debris.ts) is CUT FROM THE CAR'S
// OWN SPRITE, so it is that car's bumper / wing / panel - an F1 car's arched front wing, its rear
// wing, a sidepod - in its own paint, shape and accents, a little damaged; and the car is drawn
// without it from then on (owner 11-07, a shot of an F1 with its wing still on beside the bar it
// had shed: "the emitted part ... doesn't match what's on the car ... the emitted parts can be
// damaged slightly").
import { SPRITE_PPM } from "./shared.ts";
import { FIX } from "../core/fixes.ts";
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)

// a loose part's fixed colours: chrome, a stock car's steel, the lamps
const CHROME = '#c9ccd4', STEEL_GREY = '#3a3d45', HEAD_LAMP = '#fff3c4', TAIL_LAMP = '#c8342a';
import type { CarSprite, RenderCarSpec } from "./types.ts";

// an open car - the single-seaters, the autograss buggy: its wings / nose and its side pods come
// off, not bumpers and door skins, and nothing is under them
export const isBare = (spec: RenderCarSpec) => spec.kind === 'track' || spec.kind === 'grass';

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
 * A part's light damage: chipped edges, scuffs and dents, a bent end (seeded, the same each frame).
 * @param ctx the part's canvas
 * @param width px
 * @param height px
 * @param seed its seed
 */
function damage(ctx: CanvasRenderingContext2D, width: number, height: number, seed: number) {
  const img = ctx.getImageData(0, 0, width, height), rgba = img.data, rnd = seeded(seed);
  const bend = rnd() < 0.5 ? 0 : width - 1 - Math.floor(rnd() * 3);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4;
    if (rgba[i + 3] === 0) continue;
    const solidNear = (dx: number, dy: number) => {
      const nx = x + dx, ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < width && ny < height
        && rgba[(ny * width + nx) * 4 + 3] > 0;
    };
    const edge = !solidNear(1, 0) || !solidNear(-1, 0) || !solidNear(0, 1) || !solidNear(0, -1);
    const roll = rnd();
    // (light: owner "the emitted parts can be damaged slightly")
    if (edge && roll < 0.08) { rgba[i + 3] = 0; continue; }   // a chip off the edge
    const dent = roll > 0.96 ? 0.65 : roll > 0.94 ? 1.3 : (x >= bend && bend > 0) ? 0.85 : 1;
    for (const chan of [0, 1, 2]) rgba[i + chan] = Math.min(255, rgba[i + chan] * dent);
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * An open car's part (an F1 wing, a sidepod, the buggy's nose): its region copied out of the clean
 * sprite - seen from above it IS the part lying flat - lightly damaged.
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
  damage(ctx, width, height, seed);
  return canvas;
}

/** A flat part's drawing: its canvas and a block painter (px). */
interface FlatCanvas {
  canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D;
  block: (x: number, y: number, wide: number, tall: number, col: string) => void;
}

/**
 * A part's canvas, outlined and filled in its colour with the top light band.
 * @param wide px
 * @param tall px
 * @param col its colour
 * @returns the canvas and its painter
 */
function flatCanvas(wide: number, tall: number, col: string): FlatCanvas {
  const canvas = document.createElement('canvas');
  canvas.width = wide; canvas.height = tall;
  const ctx = canvas.getContext('2d')!;
  const block = (x: number, y: number, across: number, down: number, fill: string) => {
    ctx.fillStyle = fill; ctx.fillRect(x, y, across, down);
  };
  block(0, 0, wide, tall, shade(col, 0.4));
  block(1, 1, wide - 2, tall - 2, col);
  block(1, 1, wide - 2, 1, shade(col, 1.3));
  return { canvas, ctx, block };
}

// px of a part's size in metres (at least 3)
const partPx = (metres: number) => Math.max(3, Math.round(metres * SPRITE_PPM));

/**
 * A BUMPER lying flat: as wide as the car, ~0.3 m; its lamps, grille or tail lamps, the plate.
 * @param spec the car as drawn
 * @param front the front one
 * @returns the drawing
 */
function flatBumper(spec: RenderCarSpec, front: boolean): FlatCanvas {
  const col = spec.kind === 'muscle' ? CHROME : spec.kind === 'banger' ? spec.third || STEEL_GREY
    : spec.paint;
  const flat = flatCanvas(partPx(spec.wid), partPx(0.3), col), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height, lamp = front ? HEAD_LAMP : TAIL_LAMP;
  block(1, 1, 4, tall - 2, lamp);
  block(wide - 5, 1, 4, tall - 2, lamp);
  if (front) block(Math.round(wide / 2) - 5, 1, 10, tall - 2, '#16181d');
  block(Math.round(wide / 2) - 3, tall - 3, 6, 2, front ? '#f2f2ee' : '#f2c94c');
  return flat;
}

/**
 * A WING (fender) lying flat: ~0.95 x 0.6 m, the wheel arch out of its lower edge, the indicator.
 * @param spec the car as drawn
 * @param front a front one
 * @returns the drawing
 */
function flatWing(spec: RenderCarSpec, front: boolean): FlatCanvas {
  const flat = flatCanvas(partPx(0.95), partPx(0.6), spec.paint), { ctx, block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height, archR = partPx(0.33), mid = wide / 2;
  for (let y = 0; y < tall; y++) for (let x = 0; x < wide; x++)
    if ((x + 0.5 - mid) ** 2 + (y + 0.5 - tall) ** 2 < archR * archR) ctx.clearRect(x, y, 1, 1);
  block(front ? wide - 4 : 2, 2, 2, 2, front ? '#f2a900' : TAIL_LAMP);
  return flat;
}

/**
 * A DOOR lying flat: ~1.0 x 0.95 m, its window frame and glass, the crease, the handle, a
 * pinstripe in the third colour.
 * @param spec the car as drawn
 * @param front a front one (the handle at its back edge)
 * @returns the drawing
 */
function flatDoor(spec: RenderCarSpec, front: boolean): FlatCanvas {
  const flat = flatCanvas(partPx(1.0), partPx(0.95), spec.paint), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height, glassH = Math.round(tall * 0.4);
  const dark = shade(spec.paint, 0.7);
  block(2, 2, wide - 4, glassH - 2, '#15171d');
  block(3, 3, wide - 6, 1, '#3d4658');
  block(1, glassH, wide - 2, 1, dark);
  block(1, Math.round(tall * 0.62), wide - 2, 1, dark);
  block(1, Math.round(tall * 0.75), wide - 2, 1, spec.third || dark);
  block(front ? wide - 6 : 3, glassH + 2, 3, 1, CHROME);
  return flat;
}

/**
 * A closed car's part LYING FLAT on its face (owner 11-07: "doors should be drawn laying flat when
 * emitted ... like all parts, other than wheels"): what you see of it on the ground, at its real
 * size, in the car's paint (a muscle car's bumpers chrome, a stock car's steel), lightly damaged.
 * @param spec the car as drawn
 * @param kind the part (bumper / wing / panel)
 * @param corner its corner (0, 1 front)
 * @param seed its seed
 * @returns the part's canvas
 */
export function flatPart(spec: RenderCarSpec, kind: string, corner: number,
  seed: number): HTMLCanvasElement {
  const front = corner < 2, flat = kind === 'bumper' ? flatBumper(spec, front)
    : kind === 'wing' ? flatWing(spec, front) : flatDoor(spec, front);
  damage(flat.ctx, flat.canvas.width, flat.canvas.height, seed);
  return flat.canvas;
}

/**
 * Whether a sprite px is on a lost part's INNER edge - where the bare structure shows: a bumper's
 * row nearest the car's middle, a wing's or panel's line nearest its centreline.
 * @param region the part's region
 * @param kind the part
 * @param corner its corner
 * @param x sprite px
 * @param y sprite px
 * @returns true on that edge
 */
function atInner(region: Region, kind: string, corner: number, x: number, y: number): boolean {
  if (kind === 'bumper') return x === (corner < 2 ? region.x0 : region.x1);
  return y === (corner % 2 === 1 ? region.y0 : region.y1);
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
      // (?partsoff: GONE - the part cleared, only the bare structure left along its inner edge)
      if (FIX.partsoff) {
        if (rgba[i + 3] && atInner(region, kind, +corner, x - 2, y - 2)) {
          rgba[i] = 42; rgba[i + 1] = 45; rgba[i + 2] = 52;
        } else rgba[i + 3] = 0;
        continue;
      }
      for (const chan of [0, 1, 2]) rgba[i + chan] = Math.round(rgba[i + chan] * 0.3 + 18);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { ...sprite, c: canvas };
}

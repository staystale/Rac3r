// render/carparts.ts - a part knocked off a car (world/debris.ts) is CUT FROM THE CAR'S
// OWN SPRITE, so it is that car's bumper / wing / panel - an F1 car's arched front wing, its rear
// wing, a sidepod - in its own paint, shape and accents, a little damaged; and the car is drawn
// without it from then on (owner 11-07, a shot of an F1 with its wing still on beside the bar it
// had shed: "the emitted part ... doesn't match what's on the car ... the emitted parts can be
// damaged slightly").
import { SPRITE_PPM } from "./shared.ts";
import { spriteToWork } from "./spritepixels.ts";
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { bitsOf, doorAt, doorShape, doorsOf, type CarBits } from "../carbits.ts";

// a loose part's fixed colours: chrome, a stock car's steel, the lamps
const CHROME = '#c9ccd4', STEEL_GREY = '#3a3d45', HEAD_LAMP = '#fff3c4', TAIL_LAMP = '#c8342a';
const WISHBONE_STEEL = '#4a4f58';
import type { CarSprite, RenderCarSpec } from "./types.ts";
import { trackCanvas } from '../core/memorybudget.ts';
import { FIX } from '../core/fixes.ts';
import { drawHanging, tornPixel } from './torncut.ts';

// m a lost wing's well reaches in from the car's side with ?underskin (render/underskin.ts): past
// the tyre to the strut and the drive shaft (the old hole, 3 px, was all tyre)
const WELL_DEPTH_M = 0.68;
// px a lost wing reaches in from the side (3 without ?underskin)
const WING_DEPTH_PX = FIX.underskin ? Math.round(WELL_DEPTH_M * SPRITE_PPM) : 3;

// an open car - the single-seaters, the autograss buggy: its wings / nose and its side pods come
// off, not bumpers and door skins, and nothing is under them
export const isBare = (spec: RenderCarSpec) => spec.kind === 'track' || spec.kind === 'grass';

/** A part's place on a sprite, sprite rgba (x rear 0 -> front, y the car's side), inclusive. */
export interface Region { x0: number; x1: number; y0: number; y1: number }

/**
 * Where a mirror sits: just outside the body's side, along a car's doors - or where its own
 * mirrors are (carbits.ts mirror: the bus's at the cab's front corners).
 * @param spec the car as drawn
 * @param len the sprite's length, px
 * @param wid its width, px
 * @param plus the +y side
 * @returns the region
 */
function mirrorRegion(spec: RenderCarSpec, len: number, wid: number, plus: boolean): Region {
  const own = FIX.carparts ? doorsOf(String(spec.id))?.mirrors : undefined;
  if (own && own !== 'none') {
    // (?carparts: where its painter draws them - on the edge rows, or just outside)
    const fromX = Math.round(len * own.at), span = { x0: fromX, x1: fromX + (own.big ? 3 : 2) };
    if (own.rim) return { ...span, ...(plus ? { y0: wid - 2, y1: wid - 1 } : { y0: 0, y1: 1 }) };
    return { ...span, ...(plus ? { y0: wid, y1: wid + 1 } : { y0: -2, y1: -1 }) };
  }
  const place = bitsOf(String(spec.id)).mirror ?? { from: 0.45, until: 0.75 };
  return { x0: Math.round(len * place.from), x1: Math.round(len * place.until),
    ...(plus ? { y0: wid, y1: wid + 1 } : { y0: -2, y1: -1 }) };
}

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
  // (the horizontal panels - lying flat, as seen from above; the outside bits)
  if (kind === 'bonnet') return { x0: Math.round(len * 0.71), x1: len - 6, y0: 2, y1: wid - 3 };
  if (kind === 'boot') return bootRegion(spec, len, wid, corner);
  if (kind === 'spoiler') return { x0: -4, x1: 6, y0: -4, y1: wid + 3 };
  if (kind === 'mirror') return mirrorRegion(spec, len, wid, plus);
  if (kind === 'exhaust') return { x0: -2, x1: -1, y0: -2, y1: wid + 1 };
  if (kind === 'wing') {
    const axle = Math.round(len / 2 + (front ? spec.lf : -spec.lr) * SPRITE_PPM);
    return { x0: axle - 7, x1: axle + 7, ...side(WING_DEPTH_PX) };
  }
  return { ...doorSpan(spec, len, corner), ...side(2) };
}

/**
 * Where a boot lid sits: across the tail; ?carparts a van's twin rear doors each their half.
 * @param spec the car as drawn
 * @param len the sprite's length, px
 * @param wid its width, px
 * @param corner the damage corner (2 the -y door, 3 the +y)
 * @returns the region
 */
function bootRegion(spec: RenderCarSpec, len: number, wid: number, corner: number): Region {
  const lid = { x0: 4, x1: Math.round(len * 0.16), y0: 2, y1: wid - 3 };
  if (!FIX.carparts || !doorsOf(String(spec.id))?.twinRear) return lid;
  const half = Math.floor((wid - 1) / 2);
  return corner % 2 === 1 ? { ...lid, y0: half + 1 } : { ...lid, y1: half };
}

/**
 * Where a door sits along the sprite: ?carparts its own place, else the doors' middle.
 * @param spec the car as drawn
 * @param len the sprite's length, px
 * @param corner the damage corner
 * @returns its x0, x1, px
 */
function doorSpan(spec: RenderCarSpec, len: number, corner: number) {
  const door = FIX.carparts ? doorAt(String(spec.id), corner) : null;
  return { x0: Math.round(len * (door ? door[0] : 0.36)),
    x1: Math.round(len * (door ? door[1] : 0.62)) };
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
  const canvas = trackCanvas(document.createElement('canvas'));
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(sprite.c, -(region.x0 + 2), -(region.y0 + 2));
  damage(ctx, width, height, seed);
  return canvas;
}

/** A flat part's drawing: its canvas and a block painter (px). */
export interface FlatCanvas {
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
  const canvas = trackCanvas(document.createElement('canvas'));
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
  const own = FIX.carparts ? doorsOf(String(spec.id))?.bumpers : undefined;
  if (own) return front ? flatGrille() : flatStaircase(spec);
  const material = FIX.carparts ? doorsOf(String(spec.id))?.bumper : undefined;
  if (material) return flatOwnBumper(spec, front, material);
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

// ?carparts: the bumpers' own materials - black and grey plastic, black-painted steel
const BUMPER_COL: Record<string, string> = { black: '#1c1e22', grey: '#5a5f69', steel: '#202226' };

/**
 * ?carparts: a bumper of its own material lying flat - plastic or steel the car's width with its
 * lamps, a steel TUBE bumper (two bars on their uprights), the tractor's front WEIGHT (its block of
 * plates on the linkage's frame).
 * @param spec the car as drawn
 * @param front the front one
 * @param material its material
 * @returns the drawing
 */
function flatOwnBumper(spec: RenderCarSpec, front: boolean, material: string): FlatCanvas {
  if (material === 'tube') {
    const flat = bitCanvas(partPx(spec.wid), partPx(0.3)), { block } = flat;
    const wide = flat.canvas.width, tall = flat.canvas.height;
    for (const y of [0, tall - 2]) block(0, y, wide, 2, STEEL_GREY);
    for (const x of [2, Math.round(wide / 2) - 1, wide - 4]) block(x, 0, 2, tall, STEEL_GREY);
    return flat;
  }
  if (material === 'weight') {
    const flat = flatCanvas(partPx(0.9), partPx(0.5), '#2a2d34'), { block } = flat;
    const wide = flat.canvas.width, tall = flat.canvas.height;
    for (let x = 2; x < wide - 1; x += 3) block(x, 1, 1, tall - 2, '#16181d');
    return flat;
  }
  const flat = flatCanvas(partPx(spec.wid), partPx(0.3), BUMPER_COL[material]), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height;
  if (front) for (const x of [1, wide - 5]) block(x, 1, 4, tall - 2, HEAD_LAMP);
  else for (const x of [1, wide - 5]) block(x, 1, 2, tall - 2, TAIL_LAMP);
  block(Math.round(wide / 2) - 3, tall - 3, 6, 2, front ? '#f2f2ee' : '#f2c94c');
  return flat;
}

/**
 * The bus's RADIATOR GRILLE lying flat: ~0.9 x 0.75 m, its frame, the chrome bars, the badge.
 * @returns the drawing
 */
function flatGrille(): FlatCanvas {
  const flat = flatCanvas(partPx(0.9), partPx(0.75), '#5a5f69'), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height;
  block(1, 1, wide - 2, tall - 2, '#2a2d34');
  for (let y = 2; y < tall - 1; y += 2) block(2, y, wide - 4, 1, CHROME);
  block(Math.round(wide / 2) - 1, 1, 3, 2, TAIL_LAMP);
  return flat;
}

/**
 * The bus's STAIRCASE PANEL from the rear platform lying flat: ~1.2 x 0.7 m in its paint, the
 * route number's box, the cream band, the chrome grab pole along its edge.
 * @param spec the bus as drawn
 * @returns the drawing
 */
function flatStaircase(spec: RenderCarSpec): FlatCanvas {
  const flat = flatCanvas(partPx(1.2), partPx(0.7), spec.paint), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height;
  block(2, 2, Math.round(wide * 0.4), Math.round(tall * 0.45), '#16181d');
  block(3, 3, Math.round(wide * 0.4) - 2, 1, '#f2c94c');
  block(1, tall - 3, wide - 2, 1, spec.third || '#e8dcb0');
  block(wide - 4, 0, 1, tall, CHROME);
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
function flatDoor(spec: RenderCarSpec, corner: number): FlatCanvas {
  // (?carparts: its own length and drawing - a stock car's welded skin with no window, the bus's
  // cab door and riveted skirt panels, a van's sliding door)
  const front = corner < 2, door = FIX.carparts ? doorAt(String(spec.id), corner) : null;
  const shape = door ? doorShape(String(spec.id), corner) : 'door';
  if (shape === 'skirt' || shape === 'sliding') return flatSidePanel(spec, door!, shape);
  const flat = flatCanvas(partPx(door ? (door[1] - door[0]) * spec.len : 1.0),
    partPx(shape === 'cab' ? 1.5 : 0.95), spec.paint), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height, glassH = Math.round(tall * 0.4);
  const dark = shade(spec.paint, 0.7);
  if (shape !== 'sheet') {
    block(2, 2, wide - 4, glassH - 2, '#15171d');
    block(3, 3, wide - 6, 1, '#3d4658');
  }
  block(1, glassH, wide - 2, 1, dark);
  block(1, Math.round(tall * 0.62), wide - 2, 1, dark);
  block(1, Math.round(tall * 0.75), wide - 2, 1, spec.third || dark);
  block(front ? wide - 6 : 3, glassH + 2, 3, 1, CHROME);
  return flat;
}

/**
 * ?carparts: a panel with no window lying flat - the bus's lower-deck skirt panel (~0.55 m tall,
 * its cream band and rivets), a van's sliding door (~1.3 m tall, its rail and handle).
 * @param spec the car as drawn
 * @param door its span, shares of the length
 * @param shape the drawing
 * @returns the drawing
 */
function flatSidePanel(spec: RenderCarSpec, door: [number, number],
  shape: 'skirt' | 'sliding'): FlatCanvas {
  const skirt = shape === 'skirt';
  const flat = flatCanvas(partPx((door[1] - door[0]) * spec.len), partPx(skirt ? 0.55 : 1.3),
    spec.paint), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height, dark = shade(spec.paint, 0.6);
  if (skirt) {
    block(1, 1, wide - 2, 1, spec.third || '#e8dcb0');
    for (let x = 2; x < wide - 1; x += 4) block(x, tall - 2, 1, 1, dark);
  } else {
    block(1, Math.round(tall * 0.3), wide - 2, 1, dark);
    block(3, Math.round(tall * 0.5), 3, 1, CHROME);
  }
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
    : kind === 'wing' ? flatWing(spec, front) : flatDoor(spec, corner);
  damage(flat.ctx, flat.canvas.width, flat.canvas.height, seed);
  return flat.canvas;
}

/**
 * A drawn bit's canvas (no outline fill): a transparent canvas and its painter.
 * @param wide px
 * @param tall px
 * @returns the canvas and its painter
 */
function bitCanvas(wide: number, tall: number): FlatCanvas {
  const canvas = trackCanvas(document.createElement('canvas'));
  canvas.width = wide; canvas.height = tall;
  const ctx = canvas.getContext('2d')!;
  const block = (x: number, y: number, across: number, down: number, fill: string) => {
    ctx.fillStyle = fill; ctx.fillRect(x, y, across, down);
  };
  return { canvas, ctx, block };
}

/**
 * an EXHAUST lying flat - its silencer, the pipe, the car's own tailpipes (carbits.ts:
 * how many; a tractor's stack is a short chimney with its cap).
 * @param bits the car's bits
 * @returns the drawing
 */
function flatExhaust(bits: CarBits): FlatCanvas {
  if (bits.pipesAt === 'stack') {
    const flat = bitCanvas(partPx(0.9), partPx(0.2)), { block } = flat, wide = flat.canvas.width;
    block(0, 0, wide, 3, '#2b2b2b'); block(wide - 2, 0, 2, 3, '#777');
    return flat;
  }
  const flat = bitCanvas(partPx(1.4), Math.max(5, partPx(0.12) * bits.pipes + 2)), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height, box = partPx(0.5);
  block(0, 0, box, tall, '#3a3d45');
  block(1, 1, box - 2, tall - 2, '#5a5f69');
  block(1, 1, box - 2, 1, '#7a7f89');
  for (let pipe = 0; pipe < bits.pipes; pipe++) {
    const y = Math.round((pipe + 0.5) * tall / bits.pipes) - 1;
    block(box, y, wide - box - 2, 2, '#4a4f57');
    block(wide - 2, y, 2, 2, CHROME);
  }
  return flat;
}

/**
 * a door MIRROR - its housing in the car's paint, the glass.
 * @param spec the car as drawn
 * @returns the drawing
 */
function flatMirror(spec: RenderCarSpec): FlatCanvas {
  const place = bitsOf(String(spec.id)).mirror;
  if (place) {
    // a big mirror on its arm (the bus's): the steel arm, the black head, its glass
    const [wide, tall] = place.px, flat = bitCanvas(wide, tall), { block } = flat;
    block(0, Math.floor(tall / 2), wide - 4, 1, '#5a5f69');
    block(wide - 4, 0, 4, tall, '#16181d'); block(wide - 3, 1, 2, tall - 2, '#9aa3b0');
    return flat;
  }
  // (?carparts: in its own colour, a van's big)
  const own = FIX.carparts ? doorsOf(String(spec.id))?.mirrors : undefined;
  const col = own && own !== 'none' && own.col !== 'paint'
    ? (own.col === 'black' ? '#16181d' : spec.third || '#16181d') : spec.paint;
  const big = own && own !== 'none' && own.big;
  const flat = bitCanvas(big ? 6 : 4, big ? 4 : 3), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height;
  block(0, 0, wide, tall, shade(col, 0.4)); block(1, 0, wide - 1, tall - 1, col);
  block(1, tall - 1, wide - 2, 1, '#9aa3b0');
  return flat;
}

/**
 * a WISHBONE - the A-arm: two tubes from their bushes to the ball joint.
 * @returns the drawing
 */
function flatWishbone(): FlatCanvas {
  const flat = bitCanvas(partPx(0.45), partPx(0.35)), { block } = flat;
  const wide = flat.canvas.width, tall = flat.canvas.height;
  for (let x = 0; x < wide - 1; x++) {
    const reach = Math.round((tall - 1) / 2 * (1 - x / (wide - 1)));
    block(x, Math.round((tall - 1) / 2) - reach, 1, 1, WISHBONE_STEEL);
    block(x, Math.round((tall - 1) / 2) + reach, 1, 1, WISHBONE_STEEL);
  }
  block(0, 0, 2, 2, '#16181d'); block(0, tall - 2, 2, 2, '#16181d');
  block(wide - 2, Math.round(tall / 2) - 1, 2, 2, '#16181d');
  return flat;
}

/**
 * a STRUT - the damper body and its coil spring, the top mount.
 * @returns the drawing
 */
function flatStrut(): FlatCanvas {
  const flat = bitCanvas(partPx(0.55), 5), { block } = flat, wide = flat.canvas.width;
  block(0, 1, wide, 3, '#3a3d45');
  for (let x = 2; x < wide - 3; x += 2) {
    block(x, 0, 1, 5, '#a9aeb6');
    block(x + 1, 0, 1, 1, '#a9aeb6');
  }
  block(wide - 2, 0, 2, 5, '#5a5f69');
  return flat;
}

/**
 * a DRIVE SHAFT - the steel bar (the car's own drawing's colours, render/cars.ts) with its
 * joint at each end.
 * @returns the drawing
 */
function flatShaft(): FlatCanvas {
  const flat = bitCanvas(partPx(0.7), 3), { block } = flat, wide = flat.canvas.width;
  block(0, 1, wide, 1, '#4a4f57');
  block(0, 0, 3, 3, '#16181d');
  block(wide - 3, 0, 3, 3, '#16181d');
  return flat;
}

/**
 * an ENGINE BLOCK - its size by its cylinders, the plugs in one row (inline), two
 * banks (a V) or two outer rows (a flat), the pulley at the front, the manifold's rust.
 * @param bits the car's bits
 * @returns the drawing
 */
function flatEngine(bits: CarBits): FlatCanvas {
  const inline = bits.layout === 'inline', long = partPx(Math.max(0.4, bits.cyl
    * (inline ? 0.11 : 0.06) + 0.1));
  const flat = bitCanvas(long + 3, partPx(inline ? 0.35 : bits.layout === 'flat' ? 0.7 : 0.55));
  const { block } = flat, tall = flat.canvas.height, rows = inline ? 1 : 2;
  block(0, 0, long, tall, '#3a3d45'); block(1, 1, long - 2, tall - 2, '#6a7077');
  block(1, 1, long - 2, 1, '#8a9099');
  const per = Math.ceil(bits.cyl / rows), gap = (long - 4) / per;
  for (let row = 0; row < rows; row++) for (let cyl = 0; cyl < per; cyl++) {
    const y = rows === 1 ? Math.round(tall / 2) - 1 : row === 0 ? 2 : tall - 4;
    block(2 + Math.round(cyl * gap), y, 2, 2, '#2a2d34');
  }
  block(long, Math.round(tall / 2) - 2, 3, 4, '#2a2d34');
  block(2, rows === 1 ? 1 : Math.round(tall / 2), long - 4, 1, '#8a4a2a');
  return flat;
}

/**
 * a bad crash's DRAWN bit (the exhaust, a mirror, a wishbone, a strut, a drive shaft, the
 * engine) for its car, lightly damaged; null for the bits cut from the car's sprite (bonnet,
 * boot, spoiler).
 * @param spec the car as drawn
 * @param kind the bit
 * @param seed its seed
 * @returns the canvas, or null
 */
export function drawnBit(spec: RenderCarSpec, kind: string,
  seed: number): HTMLCanvasElement | null {
  const flat = bitDrawing(spec, kind);
  if (!flat) return null;
  damage(flat.ctx, flat.canvas.width, flat.canvas.height, seed);
  return flat.canvas;
}

/**
 * A drawn bit as it sits on the car, undamaged (the under-skin layer, render/underskin.ts).
 * @param spec the car as drawn
 * @param kind the bit (exhaust, mirror, wishbone, strut, shaft, engine)
 * @returns its drawing, or null
 */
export function bitDrawing(spec: RenderCarSpec, kind: string): FlatCanvas | null {
  const bits = bitsOf(String(spec.id));
  return kind === 'exhaust' ? flatExhaust(bits) : kind === 'mirror' ? flatMirror(spec)
    : kind === 'wishbone' ? flatWishbone() : kind === 'strut' ? flatStrut()
      : kind === 'shaft' ? flatShaft() : kind === 'engine' ? flatEngine(bits) : null;
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
 * a bonnet's or boot lid's place with it gone - the dark bay, the engine block in it
 * (its rocker cover light, a row of plugs) unless the engine has gone too.
 * @param rgba the sprite's pixels
 * @param i the pixel's index
 * @param engine an engine to show
 * @param x px into the region
 * @param y px into the region
 * @param region the region
 */
function bayPixel(rgba: Uint8ClampedArray, i: number, engine: boolean, x: number, y: number,
  region: Region): void {
  if (!rgba[i + 3]) return;
  const wide = region.x1 - region.x0, tall = region.y1 - region.y0;
  const inBlock = engine && x > wide * 0.2 && x < wide * 0.85 && y > tall * 0.25 && y < tall * 0.75;
  const plug = inBlock && Math.abs(y - tall / 2) < 0.6 && x % 2 === 0;
  const col = plug ? [26, 28, 33] : inBlock ? [90, 95, 105] : [30, 32, 38];
  rgba[i] = col[0]; rgba[i + 1] = col[1]; rgba[i + 2] = col[2];
}

/**
 * ?carparts: a mirror drawn on the body's edge rows, gone - the edge it stood on, in its outline
 * and its light (top) or dark (bottom) band.
 * @param rgba the sprite's pixels
 * @param i the pixel's index
 * @param part the lost part
 * @param y sprite px
 * @returns painted (a rim mirror's pixel)
 */
function rimMirrorPixel(rgba: Uint8ClampedArray, i: number, part: LostPart, y: number): boolean {
  const { spec, kind, region } = part;
  if (kind !== 'mirror' || !isRimMirror(spec)) return false;
  if (!rgba[i + 3]) return true;
  const top = region.y0 === 0, outer = top ? y === 0 : y === region.y1;
  const factor = outer ? 0.4 : top ? 1.3 : 0.7, packed = parseInt(spec.paint.slice(1), 16);
  for (let channel = 0; channel < 3; channel++)
    rgba[i + channel] = Math.min(255, Math.round(((packed >> (16 - channel * 8)) & 255) * factor));
  return true;
}

/**
 * ?carparts: whether a car's mirrors stand on its body's edge rows (their hole is the edge).
 * @param spec the car as drawn
 * @returns on the rim
 */
function isRimMirror(spec: RenderCarSpec): boolean {
  const own = FIX.carparts ? doorsOf(String(spec.id))?.mirrors : undefined;
  return !!own && own !== 'none' && !!own.rim;
}

/**
 * A cleared part's pixel: gone, or (?carparts) a rim mirror's the body's edge again.
 * @param rgba the sprite's pixels
 * @param i the pixel's index
 * @param part the lost part
 * @param y sprite px
 */
function clearedPixel(rgba: Uint8ClampedArray, i: number, part: LostPart, y: number): void {
  if (!rimMirrorPixel(rgba, i, part, y)) rgba[i + 3] = 0;
}

/** One lost part, as the car shows it. */
interface LostPart { spec: RenderCarSpec; kind: string; corner: number; region: Region;
  lost: string; underSkin: boolean }

// the parts that leave nothing behind on the sprite (a mirror, the pipes)
const CLEARED_PARTS = new Set(['mirror', 'exhaust']);

/**
 * A sprite px on a lost part: an open car's part, a mirror or the pipes cleared; a bonnet's or
 * boot lid's place the bay; else (?partsoff) cleared to its bare structure line, or darkened.
 * @param rgba the sprite's pixels
 * @param i the pixel's index
 * @param part the lost part
 * @param x sprite px
 * @param y sprite px
 */
function lostPixel(rgba: Uint8ClampedArray, i: number, part: LostPart, x: number, y: number) {
  const { spec, kind, corner, region, lost, underSkin } = part;
  if (isBare(spec) || CLEARED_PARTS.has(kind)) { clearedPixel(rgba, i, part, y); return; }
  // (?underskin: the hole in the panel's own outline, its edge torn - render/torncut.ts)
  if (underSkin && tornPixel(rgba, i, part, [x, y])) return;
  if (kind === 'bonnet' || kind === 'boot') {
    // (the engine shows under a front-engined car's bonnet, not a mid-engined car's front lid)
    // (with ?underskin the bay is left empty: render/underskin.ts draws the engine in it)
    const bits = bitsOf(String(spec.id));
    const engine = !underSkin && kind === 'bonnet' && bits.engine === 'front' && !bits.electric
      && !lost.includes('engine');
    bayPixel(rgba, i, engine, x - region.x0,
      y - region.y0, region);
    return;
  }
  // GONE - the part cleared, only the bare structure left along its inner edge (?underskin: a
  // wing's opening clear to the road - nothing under the arch but its arms, wheel and strut)
  if (rgba[i + 3] && atInner(region, kind, corner, x, y) && !(underSkin && kind === 'wing')) {
    rgba[i] = 42; rgba[i + 1] = 45; rgba[i + 2] = 52;
  } else rgba[i + 3] = 0;
}

/**
 * ?underskin: the sprite's pixels and a copy of them as they were, for the torn panels' hanging
 * pieces (render/torncut.ts); none on an open car.
 * @param spec the car as drawn
 * @param underSkin the switch's state
 * @param rgba the pixels
 * @param canvas their canvas
 * @returns the pixels, or null
 */
function tornPixels(spec: RenderCarSpec, underSkin: boolean, rgba: Uint8ClampedArray,
  canvas: { width: number; height: number }) {
  if (!underSkin || isBare(spec)) return null;
  return { rgba, from: rgba.slice(), width: canvas.width, height: canvas.height };
}

/**
 * The car without the parts it has lost: each region darkened to the bare structure (a closed
 * car's bumper / wing / panel) or cleared (an open-wheeler's wing or sidepod - nothing under it).
 * @param spec the car as drawn
 * @param sprite its sprite (damaged or not)
 * @param lost the parts gone: "kind:corner" each, joined by ","
 * @param underSkin the bays left empty for the under-skin layer (render/underskin.ts)
 * @returns a new sprite
 */
export function withoutParts(spec: RenderCarSpec, sprite: CarSprite, lost: string,
  underSkin = false): CarSprite {
  const { canvas, ctx, img } = spriteToWork(sprite.c), rgba = img.data;
  // (?underskin: the panels as they were, for the pieces left hanging - render/torncut.ts)
  const torn = tornPixels(spec, underSkin, rgba, canvas);
  for (const entry of lost.split(',').filter(Boolean)) {
    const [kind, corner] = entry.split(':');
    // (the wing is left out by the painters - spec.noWing; the engine shows in the bay)
    if (kind === 'spoiler' || kind === 'engine') continue;
    const region = partRegion(spec, sprite, kind, +corner);
    for (let y = region.y0 + 2; y <= region.y1 + 2; y++) for (let x = region.x0 + 2;
      x <= region.x1 + 2; x++) {
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      const i = (y * canvas.width + x) * 4;
      lostPixel(rgba, i, { spec, kind, corner: +corner, region, lost, underSkin }, x - 2, y - 2);
    }
    if (torn) drawHanging(torn, { kind, corner: +corner, region });
  }
  ctx.putImageData(img, 0, 0);
  return { ...sprite, c: canvas };
}

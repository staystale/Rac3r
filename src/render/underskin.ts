// render/underskin.ts - UNDER THE SKIN (?underskin): what a lost panel shows, by the car's own
// layout (carbits.ts: where the engine sits and how it lies, where the radiator is; its driven
// wheels): the bonnet's bay its engine and radiator (a mid-engined car's front lid its radiators);
// a boot's bay the engine when it sits behind; a wing's well that corner's strut, arms and - on a
// driven wheel - drive shaft; behind a bumper the crash bar and, where it sits, the radiator. An
// open car's sidepod its radiator, its nose and tail their crash structures; the buggy's panels and
// bars its frame tubes. The engine, strut and arms are the drawings the crash throws and the open
// cars wear (render/carparts.ts bitDrawing, render/cars.ts drawFixedArms), so they match.
// Painted once onto the car's lost-parts sprite (render/cars.ts lostSprite), not each frame.
import { bitsOf, type CarBits } from "../carbits.ts";
import { partRegion, isBare, bitDrawing, type Region } from "./carparts.ts";
import { SPRITE_PPM } from "./shared.ts";
import type { CarSprite, RenderCarSpec } from "./types.ts";

// the bare metal's colours (render/carparts.ts's bits and the open cars' arms share them)
const FRAME_DARK = '#16181d', STEEL = '#3a3d45', STEEL_LIGHT = '#5a5f69';
const CORE = '#6f7782', FIN = '#4d545e', CARBON = '#1e2026', CARBON_LIGHT = '#2e3138';
const TUBE = '#4a4f58', SPRING = '#a9aeb6';
// the inside of a wing's well: the inner arch and the chassis leg, a road-grimed grey (the arms
// and drive shaft, dark, read against it)
const WELL = '#6e7178';
// px a strut's top sits off the axle line, toward the car's middle
const STRUT_OFFSET_PX = 3;
// m: a radiator's depth from above, a crash bar's
const RADIATOR_DEPTH_M = 0.12, CRASH_BAR_M = 0.1;

/** Where the wheels sit and how a corner's fixed arms are drawn (render/cars.ts). */
export interface UnderWheels {
  halfWidth: number;   // px from the middle to the wheel
  tyreWidth: (rear: boolean) => number;   // px
  arms: (ctx: CanvasRenderingContext2D, axleX: number, side: number) => void;
}

/** What each painter needs: the canvas, the car, its sprite, its bits. */
interface SkinCtx {
  ctx: CanvasRenderingContext2D; spec: RenderCarSpec; sprite: CarSprite; bits: CarBits;
  wheels: UnderWheels; lost: string;
}

// px of a size in metres (at least 2)
const pxOf = (metres: number) => Math.max(2, Math.round(metres * SPRITE_PPM));

/**
 * A block on the sprite's grid (sprite px; the canvas keeps a 2 px margin).
 * @param ctx the sprite's canvas
 * @param x sprite px, rear (0) -> front
 * @param y sprite px across
 * @param wide px along the car
 * @param tall px across it
 * @param col the colour
 */
function block(ctx: CanvasRenderingContext2D, x: number, y: number, wide: number, tall: number,
  col: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(2 + Math.round(x), 2 + Math.round(y), Math.round(wide), Math.round(tall));
}

/**
 * Keeps the painting inside a part's hole.
 * @param ctx the sprite's canvas
 * @param region the part's place, sprite px inclusive
 */
function clipTo(ctx: CanvasRenderingContext2D, region: Region): void {
  ctx.beginPath();
  ctx.rect(2 + region.x0, 2 + region.y0, region.x1 - region.x0 + 1, region.y1 - region.y0 + 1);
  ctx.clip();
}

/**
 * A RADIATOR from above: its dark frame, the core and its fins.
 * @param ctx the sprite's canvas
 * @param x sprite px of its rear edge
 * @param y sprite px of its first side
 * @param along px along the car
 * @param across px across it
 */
function radiator(ctx: CanvasRenderingContext2D, x: number, y: number, along: number,
  across: number): void {
  block(ctx, x, y, along, across, FRAME_DARK);
  block(ctx, x, y + 1, along, across - 2, CORE);
  const finsAcross = along <= across;
  for (let fin = 1; fin < (finsAcross ? across - 1 : along); fin += 2) {
    if (finsAcross) block(ctx, x, y + fin, along, 1, FIN);
    else block(ctx, x + fin, y + 1, 1, across - 2, FIN);
  }
}

/**
 * A CRASH BAR across the car: the steel beam, its light top edge, a bolt at each end.
 * @param ctx the sprite's canvas
 * @param x sprite px of its rear edge
 * @param fromY sprite px of one end
 * @param toY of the other
 * @param front the front one (its outer edge to the front)
 */
function crashBar(ctx: CanvasRenderingContext2D, x: number, fromY: number, toY: number,
  front: boolean): void {
  const deep = pxOf(CRASH_BAR_M);
  block(ctx, x, fromY, deep, toY - fromY + 1, STEEL);
  // (its outer edge catches the light)
  block(ctx, front ? x + deep - 1 : x, fromY, 1, toY - fromY + 1, STEEL_LIGHT);
  block(ctx, x, fromY, deep, 1, FRAME_DARK);
  block(ctx, x, toY, deep, 1, FRAME_DARK);
}

/**
 * The ENGINE in a bay: the thrown engine's drawing, lying along the car or across it, centred
 * at (centreX, centreY) sprite px, its pulley to the front (or the car's right when across).
 * @param skin the painter's context
 * @param centreX sprite px
 * @param centreY sprite px
 */
function engineAt(skin: SkinCtx, centreX: number, centreY: number): void {
  if (skin.lost.includes('engine')) return;
  const drawing = bitDrawing(skin.spec, 'engine');
  if (!drawing) return;
  const { ctx } = skin, canvas = drawing.canvas;
  ctx.save();
  ctx.translate(2 + Math.round(centreX), 2 + Math.round(centreY));
  if (skin.bits.mount === 'trans') ctx.rotate(Math.PI / 2);
  ctx.drawImage(canvas, -Math.round(canvas.width / 2), -Math.round(canvas.height / 2));
  ctx.restore();
}

/**
 * A lost BONNET's bay (or a mid-engined car's front lid): the radiator across its front, the
 * engine behind it where it sits at the front; two radiators in a mid-engined car's front corners.
 * @param skin the painter's context
 * @param region the bay
 */
function bonnetBay(skin: SkinCtx, region: Region): void {
  const { ctx, bits } = skin, deep = pxOf(RADIATOR_DEPTH_M);
  const tall = region.y1 - region.y0 + 1, front = region.x1 - deep + 1;
  if (bits.radiator === 'front') {
    if (bits.engine === 'front') {
      const across = Math.round(tall * 0.8);
      radiator(ctx, front, region.y0 + Math.round((tall - across) / 2), deep, across);
    } else {
      const across = Math.round(tall * 0.3);
      radiator(ctx, front - deep, region.y0, deep * 2, across);
      radiator(ctx, front - deep, region.y1 - across + 1, deep * 2, across);
    }
  }
  if (bits.engine === 'front')
    engineAt(skin, (region.x0 + front) / 2, (region.y0 + region.y1) / 2);
}

/**
 * A lost wing's WELL: that corner's arms and (driven) drive shaft, as an open car's, and its
 * strut, inboard of the tyre on the well's dark inside (the tyre, drawn under the body, shows
 * where it is).
 * @param skin the painter's context
 * @param region the well
 * @param corner the corner (0, 1 front; odd = +y)
 */
function wheelWell(skin: SkinCtx, region: Region, corner: number): void {
  const { ctx, spec, sprite, wheels } = skin, front = corner < 2, side = corner % 2 ? 1 : -1;
  const midY = sprite.Wp / 2, tyreIn = wheels.halfWidth - wheels.tyreWidth(!front) / 2;
  // (clip to inboard of the tyre: its inner edge, sprite px)
  const edge = Math.round(midY + side * tyreIn);
  clipTo(ctx, side > 0 ? { ...region, y1: Math.min(region.y1, edge - 1) }
    : { ...region, y0: Math.max(region.y0, edge) });
  // the well's inside, dark (the inner arch and the chassis leg)
  block(ctx, region.x0, region.y0, region.x1 - region.x0 + 1, region.y1 - region.y0 + 1, WELL);
  const axleX = front ? spec.lf : -spec.lr;
  ctx.save();
  ctx.translate(2 + Math.round(sprite.Lp / 2), 2 + Math.round(midY));
  wheels.arms(ctx, axleX, side);
  ctx.restore();
  // the strut stands upright beside the wheel: from above, its top - the spring's coil round
  // the damper's mount (the thrown strut's own colours, render/carparts.ts flatStrut) - set
  // toward the car's middle of the axle line, so the drive shaft shows past it
  const toMiddle = front ? -STRUT_OFFSET_PX : STRUT_OFFSET_PX;
  strutTop(ctx, sprite.Lp / 2 + axleX * SPRITE_PPM + toMiddle, edge - side * 3);
}

/**
 * A STRUT seen from above, centred at (centreX, centreY) sprite px: the coil spring's ring, the
 * top mount, its nut.
 * @param ctx the sprite's canvas
 * @param centreX sprite px
 * @param centreY sprite px
 */
function strutTop(ctx: CanvasRenderingContext2D, centreX: number, centreY: number): void {
  const x = Math.round(centreX) - 2, y = Math.round(centreY) - 2;
  block(ctx, x + 1, y, 3, 5, SPRING);
  block(ctx, x, y + 1, 5, 3, SPRING);
  block(ctx, x + 1, y + 1, 3, 3, STEEL_LIGHT);
  block(ctx, x + 2, y + 2, 1, 1, FRAME_DARK);
}

/**
 * Behind a lost BUMPER: the crash bar, and the radiator where it sits at that end.
 * @param skin the painter's context
 * @param corner 0, 1 the front; 2, 3 the rear
 */
function behindBumper(skin: SkinCtx, corner: number): void {
  const { ctx, sprite, bits } = skin, front = corner < 2, wid = sprite.Wp;
  const bar = pxOf(CRASH_BAR_M), deep = pxOf(RADIATOR_DEPTH_M);
  const region = partRegion(skin.spec, sprite, 'bumper', corner);
  // the radiator against the body where it sits at this end, the crash bar outside it
  const cooled = front ? bits.radiator === 'front' && bits.engine === 'front'
    : bits.radiator === 'rear';
  const across = Math.round(wid * 0.6), y = Math.round((wid - across) / 2);
  const inner = front ? region.x0 : region.x1 - deep + 1;
  if (cooled) radiator(ctx, inner, y, deep, across);
  const outerOf = (body: number) => (front ? body : body - bar);
  const barX = cooled ? outerOf(front ? inner + deep : inner)
    : outerOf(front ? inner : region.x1 + 1);
  crashBar(ctx, barX, 3, wid - 4, front);
}

/**
 * An open car's lost part: a single-seater's sidepod its radiator, its front or rear wing the
 * nose's or tail's crash structure; the buggy's panel or bar its frame tubes.
 * @param skin the painter's context
 * @param kind 'panel' or 'bumper'
 * @param corner its corner
 * @param region its place
 */
function openCarPart(skin: SkinCtx, kind: string, corner: number, region: Region): void {
  const { ctx, spec, sprite } = skin, mid = Math.round((sprite.Wp - 1) / 2);
  const buggy = spec.kind === 'grass', side = corner % 2 ? 1 : -1;
  if (kind === 'panel') {
    const inner = side > 0 ? region.y0 : region.y1, along = region.x1 - region.x0 + 1;
    if (buggy) {
      for (const step of [0, 3]) block(ctx, region.x0, inner + side * step, along, 1, TUBE);
      return;
    }
    const across = pxOf(0.2);
    radiator(ctx, region.x0 + Math.round(along * 0.2), side > 0 ? inner : inner - across + 1,
      Math.round(along * 0.6), across);
    return;
  }
  const front = corner < 2;
  if (buggy) {
    block(ctx, front ? region.x0 + 2 : region.x1 - 3, 2, 1, sprite.Wp - 4, TUBE);
    return;
  }
  const half = front ? 2 : 1, startX = front ? region.x0 : region.x0 + 2;
  const along = front ? region.x1 - region.x0 - 1 : region.x1 - region.x0 - 2;
  block(ctx, startX, mid - half, along, half * 2 + 1, CARBON);
  block(ctx, startX, mid - half + 1, along, half * 2 - 1, CARBON_LIGHT);
}

/**
 * Paints what each lost part shows onto the car's lost-parts sprite (withoutParts' copy).
 * @param sprite the sprite without its lost parts (its canvas is painted)
 * @param spec the car as drawn
 * @param lost the parts gone: "kind:corner" each, joined by ","
 * @param wheels where its wheels sit and its arms' painter
 */
export function drawUnderSkin(sprite: CarSprite, spec: RenderCarSpec, lost: string,
  wheels: UnderWheels): void {
  const ctx = sprite.c.getContext('2d') as CanvasRenderingContext2D | null;
  if (!ctx) return;
  const skin: SkinCtx = { ctx, spec, sprite, bits: bitsOf(String(spec.id)), wheels, lost };
  // (the wells first: a bay's radiators and engine, and a bumper's bar, lie over their corners)
  const entries = lost.split(',').filter(Boolean)
    .sort((one, two) => Number(two.startsWith('wing')) - Number(one.startsWith('wing')));
  for (const entry of entries) {
    const [kind, cornerText] = entry.split(':'), corner = +cornerText;
    if (!['bonnet', 'boot', 'wing', 'bumper', 'panel'].includes(kind)) continue;
    const region = partRegion(spec, sprite, kind, corner);
    ctx.save();
    if (isBare(spec)) {
      // (an open car loses only its wings and nose - its 'bumpers' - and its sidepods)
      if (kind !== 'panel' && kind !== 'bumper') { ctx.restore(); continue; }
      clipTo(ctx, region);
      openCarPart(skin, kind, corner, region);
    } else if (kind === 'bonnet') {
      clipTo(ctx, region);
      bonnetBay(skin, region);
    } else if (kind === 'boot' && skin.bits.engine !== 'front') {
      clipTo(ctx, region);
      engineAt(skin, (region.x0 + region.x1) / 2, (region.y0 + region.y1) / 2);
    } else if (kind === 'wing') {
      wheelWell(skin, region, corner);
    } else if (kind === 'bumper') {
      clipTo(ctx, region);
      behindBumper(skin, corner);
    }
    ctx.restore();
  }
}

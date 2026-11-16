// render/underskin.ts - UNDER THE SKIN (?underskin): what a lost panel shows, by the car's own
// layout (carbits.ts: where the engine sits and how it lies, where the radiator is; its driven
// wheels): the bonnet's bay its engine and radiator (a mid-engined car's front lid its radiators);
// a boot's bay the engine when it sits behind; a wing's well that corner's strut, arms and - on a
// driven wheel - drive shaft; behind a bumper the crash bar and, where it sits, the radiator. An
// open car's sidepod its radiator, its nose and tail their crash structures; the buggy's panels and
// bars its frame tubes. The engine, strut and arms are the drawings the crash throws and the open
// cars wear (render/carparts.ts bitDrawing, render/cars.ts drawFixedArms), so they match.
// A DOOR's hole its sill and the floor; a front-engined car's BOOT its floor and the spare wheel.
// Painted once onto the car's lost-parts sprite (render/cars.ts lostSprite), not each frame, and
// only where the crushed body still is (the damaged sprite's own pixels): a crumpled corner's
// structure is crumpled with it, never left standing past the dented edge.
// Sized and lit to read at a phone's size: the well a dark cavity, the arms, drive shaft and
// spring bright steel two pixels wide, the crash beam light against the dark under-tray.
import { bitsOf, type CarBits } from "../carbits.ts";
import { partRegion, isBare, bitDrawing, type Region } from "./carparts.ts";
import { SPRITE_PPM } from "./shared.ts";
import type { CarSprite, RenderCarSpec } from "./types.ts";
import { shade } from "../render.ts";   // hoisted, only called at draw time (no cycle)
import { endCrushPx, sideCrushPx } from "./cardamage.ts";

// the bare metal's colours (render/carparts.ts's bits and the open cars' arms share them)
const FRAME_DARK = '#16181d', STEEL = '#3a3d45', STEEL_LIGHT = '#5a5f69';
const CORE = '#6f7782', FIN = '#4d545e', CARBON = '#1e2026', CARBON_LIGHT = '#2e3138';
const TUBE = '#4a4f58';
// the bumper beam's steel, light; the under-tray behind a bumper, in shadow; a door's floor and
// carpet; a boot's floor; the spare wheel's tyre and its rim
const BEAM = '#9aa0aa', UNDERTRAY = '#1e2026', FLOOR = '#2b2e35', CARPET = '#3a3d45';
const BOOT_FLOOR = '#3a3d45', SPARE_TYRE = '#16181d', SPARE_RIM = '#8a9099';
// m: a spare wheel's diameter from above
const SPARE_M = 0.6;
// m: a radiator's depth from above, a crash bar's
const RADIATOR_DEPTH_M = 0.12, CRASH_BAR_M = 0.1;
// an electric car's frunk: its plastic tub and lip; the front motor's casing, its orange
// high-voltage cable
const TUB = '#25282e', TUB_LIP = '#4a4f58', MOTOR = '#8a9099', HV_CABLE = '#e07a1f';

/** What each painter needs: the canvas, the car, its sprite, its bits. */
interface SkinCtx {
  ctx: CanvasRenderingContext2D; spec: RenderCarSpec; sprite: CarSprite; bits: CarBits;
  lost: string;
  // px each end's crush has pushed its structure in (the radiator, the beam, the cross-member
  // go back with the crumpled front, as in a real crash)
  push: { front: number; rear: number; minus: number; plus: number };
}
// px past an end's crush its structure stands (behind the crumpled skin, not in it)
const PUSH_MARGIN_PX = 1;

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
  block(ctx, x, fromY, deep, toY - fromY + 1, BEAM);
  // (its inner edge in shadow, its ends bolted)
  block(ctx, front ? x : x + deep - 1, fromY, 1, toY - fromY + 1, STEEL);
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
  const tall = region.y1 - region.y0 + 1, push = pushAt(skin, true);
  const front = Math.max(region.x0, region.x1 - deep + 1 - push);
  if (bits.radiator === 'front') {
    // (one radiator across the front: a front-engined car's, and the 911's central one)
    if (bits.engine !== 'mid') {
      const across = Math.round(tall * 0.8);
      radiator(ctx, front, region.y0 + Math.round((tall - across) / 2), deep, across);
    } else {
      const across = Math.round(tall * 0.3);
      radiator(ctx, front - deep, region.y0, deep * 2, across);
      radiator(ctx, front - deep, region.y1 - across + 1, deep * 2, across);
    }
  }
  if (bits.electric) frunkBay(skin, region, front);
  else if (bits.engine === 'front')
    engineAt(skin, Math.min((region.x0 + region.x1 - deep + 1) / 2, front - engineHalf(skin)),
      (region.y0 + region.y1) / 2);
}

/**
 * An ELECTRIC car's bay (carbits.ts electric): the frunk's tub behind the radiator, and behind
 * the tub the front motor's casing across the car with its orange high-voltage cable.
 * @param skin the painter's context
 * @param region the bay
 * @param front sprite px of the radiator's rear edge
 */
function frunkBay(skin: SkinCtx, region: Region, front: number): void {
  const { ctx } = skin, tall = region.y1 - region.y0 + 1, room = front - region.x0;
  const tubFrom = region.x0 + Math.round(room * 0.4), tubAcross = Math.round(tall * 0.72);
  const tubY = region.y0 + Math.round((tall - tubAcross) / 2);
  block(ctx, tubFrom, tubY, front - tubFrom, tubAcross, TUB_LIP);
  block(ctx, tubFrom + 1, tubY + 1, front - tubFrom - 2, tubAcross - 2, TUB);
  const motorAcross = Math.round(tall * 0.5), motorLong = Math.max(2, tubFrom - region.x0 - 2);
  const motorY = region.y0 + Math.round((tall - motorAcross) / 2);
  block(ctx, region.x0 + 1, motorY, motorLong, motorAcross, STEEL);
  block(ctx, region.x0 + 1, motorY + 1, motorLong, motorAcross - 2, MOTOR);
  block(ctx, region.x0, motorY + 2, motorLong + 1, 1, HV_CABLE);
}

/**
 * px an end's structure is pushed in by its crush (none with no crush).
 * @param skin the painter's context
 * @param front the front end
 * @returns px
 */
const pushAt = (skin: SkinCtx, front: boolean) => {
  const push = front ? skin.push.front : skin.push.rear;
  return push > 0 ? Math.ceil(push) + PUSH_MARGIN_PX : 0;
};

/**
 * px a side's structure is pushed in by its crush (none with no crush).
 * @param skin the painter's context
 * @param plus the +y side
 * @returns px
 */
const sidePushAt = (skin: SkinCtx, plus: boolean) => {
  const push = plus ? skin.push.plus : skin.push.minus;
  return push > 0 ? Math.ceil(push) + PUSH_MARGIN_PX : 0;
};

/**
 * Half the engine's length along the car as it sits (across: half its width), px.
 * @param skin the painter's context
 * @returns px
 */
function engineHalf(skin: SkinCtx): number {
  const drawing = bitDrawing(skin.spec, 'engine');
  if (!drawing) return 0;
  const along = skin.bits.mount === 'trans' ? drawing.canvas.height : drawing.canvas.width;
  return Math.ceil(along / 2);
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
  // the under-tray across the bumper's place, in shadow (the body's own pixels keep it inside)
  block(ctx, region.x0, region.y0, region.x1 - region.x0 + 1, region.y1 - region.y0 + 1,
    UNDERTRAY);
  // the radiator against the body where it sits at this end
  const cooled = front ? bits.radiator === 'front' && bits.engine === 'front'
    : bits.radiator === 'rear';
  const across = Math.round(wid * 0.6), y = Math.round((wid - across) / 2);
  const push = pushAt(skin, front);
  const inner = front ? region.x0 - push : region.x1 - deep + 1 + push;
  if (cooled) radiator(ctx, inner, y, deep, across);
  // the beam just inside the bumper's skin (a px in from the car's end), on its two crash cans;
  // a crushed end's pushed in with it
  const barX = front ? sprite.Lp - 1 - bar - push : 1 + push;
  for (const canY of [Math.round(wid * 0.22), Math.round(wid * 0.78) - 1]) {
    const fromX = front ? region.x0 : barX + bar, toX = front ? barX : region.x1 + 1;
    block(ctx, fromX, canY, toX - fromX, 2, STEEL_LIGHT);
  }
  crashBar(ctx, barX, 3, wid - 4, front);
}

/**
 * A lost DOOR's hole: the sill along the car's edge (the body's own metal, in its paint, a little
 * dark), the floor and carpet inside it.
 * @param skin the painter's context
 * @param region the door's place
 * @param corner its corner (odd = +y)
 */
function doorHole(skin: SkinCtx, region: Region, corner: number): void {
  const { ctx, spec, sprite } = skin, plus = corner % 2 === 1, along = region.x1 - region.x0 + 1;
  // (a caved-in side's sill pushed in with it)
  const push = sidePushAt(skin, plus);
  const sill = plus ? sprite.Wp - 1 - push : push, step = plus ? -1 : 1;
  block(ctx, region.x0, sill, along, 1, shade(spec.paint || '#888888', 0.72));
  block(ctx, region.x0, sill + step, along, 1, FLOOR);
  block(ctx, region.x0, sill + step * 2, along, 1, CARPET);
}

/**
 * A front-engined car's lost BOOT lid: the boot floor and the spare wheel in its well.
 * @param skin the painter's context
 * @param region the boot's place
 */
function bootFloor(skin: SkinCtx, region: Region): void {
  const { ctx } = skin, wide = region.x1 - region.x0 + 1, tall = region.y1 - region.y0 + 1;
  block(ctx, region.x0, region.y0, wide, tall, BOOT_FLOOR);
  const size = Math.min(pxOf(SPARE_M), wide - 2, tall - 2);
  const x = region.x0 + Math.round((wide - size) / 2);
  const y = region.y0 + Math.round((tall - size) / 2);
  block(ctx, x + 1, y, size - 2, size, SPARE_TYRE);
  block(ctx, x, y + 1, size, size - 2, SPARE_TYRE);
  const rim = Math.max(2, Math.round(size / 2)), rimAt = Math.round((size - rim) / 2);
  block(ctx, x + rimAt, y + rimAt, rim, rim, SPARE_RIM);
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
 * What a closed car's lost part shows, clipped to its hole (a bumper's and a door's reaching in as
 * far as the crush pushed their structure).
 * @param skin the painter's context
 * @param kind the part
 * @param corner its corner
 * @param region its place
 */
function closedCarPart(skin: SkinCtx, kind: string, corner: number, region: Region): void {
  const { ctx } = skin;
  if (kind === 'bonnet') {
    clipTo(ctx, region);
    bonnetBay(skin, region);
  } else if (kind === 'boot') {
    clipTo(ctx, region);
    if (skin.bits.engine !== 'front')
      engineAt(skin, (region.x0 + region.x1) / 2, (region.y0 + region.y1) / 2);
    else bootFloor(skin, region);
  } else if (kind === 'panel') {
    const push = sidePushAt(skin, corner % 2 === 1);
    clipTo(ctx, corner % 2 === 1 ? { ...region, y0: region.y0 - push }
      : { ...region, y1: region.y1 + push });
    doorHole(skin, region, corner);
  } else if (kind === 'bumper') {
    const push = pushAt(skin, corner < 2);
    clipTo(ctx, corner < 2 ? { ...region, x0: region.x0 - push }
      : { ...region, x1: region.x1 + push });
    behindBumper(skin, corner);
  }
}

/**
 * Paints what each lost part shows onto the car's lost-parts sprite (withoutParts' copy), only
 * where the crushed body still is, its structure pushed in by the crush.
 * @param sprite the sprite without its lost parts (its canvas is painted)
 * @param spec the car as drawn
 * @param lost the parts gone: "kind:corner" each, joined by ","
 * @param body the crushed sprite's canvas, parts on (its pixels are where the body still is)
 * @param crush the end-on and side-on crush per corner (damage.ts crushL, crushS)
 */
export function drawUnderSkin(sprite: CarSprite, spec: RenderCarSpec, lost: string,
  body: HTMLCanvasElement,
  crush: { ends: number[]; sides: number[] } = { ends: [0, 0, 0, 0], sides: [0, 0, 0, 0] }): void {
  const out = sprite.c.getContext('2d') as CanvasRenderingContext2D | null;
  const ctx = scratchFor(sprite.c);
  if (!out || !ctx) return;
  const skin: SkinCtx = { ctx, spec, sprite, bits: bitsOf(String(spec.id)), lost,
    push: { front: endCrushPx(sprite.Lp, crush.ends, true),
      rear: endCrushPx(sprite.Lp, crush.ends, false),
      minus: sideCrushPx(sprite.Wp, crush.sides, false),
      plus: sideCrushPx(sprite.Wp, crush.sides, true) } };
  // (the wells first: a bay's radiators and engine, and a bumper's bar, lie over their corners)
  const entries = lost.split(',').filter(Boolean)
    .sort((one, two) => Number(two.startsWith('wing')) - Number(one.startsWith('wing')));
  for (const entry of entries) {
    const [kind, cornerText] = entry.split(':'), corner = +cornerText;
    if (!['bonnet', 'boot', 'wing', 'bumper', 'panel'].includes(kind)) continue;
    const region = partRegion(spec, sprite, kind, corner);
    // (an open car loses only its wings and nose - its 'bumpers' - and its sidepods)
    if (isBare(spec) && kind !== 'panel' && kind !== 'bumper') continue;
    ctx.save();
    if (isBare(spec)) {
      clipTo(ctx, region);
      openCarPart(skin, kind, corner, region);
    } else closedCarPart(skin, kind, corner, region);
    ctx.restore();
  }
  // (only where the crushed body still is)
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(body, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  out.drawImage(ctx.canvas, 0, 0);
}

// the one scratch canvas the under-skin is painted on before its mask (sized as each sprite)
let scratch: HTMLCanvasElement | null = null;

/**
 * The scratch canvas, cleared and sized as a sprite's canvas.
 * @param like the sprite's canvas
 * @returns its context, or null
 */
function scratchFor(like: HTMLCanvasElement): CanvasRenderingContext2D | null {
  scratch ??= document.createElement('canvas');
  scratch.width = like.width;
  scratch.height = like.height;
  return scratch.getContext('2d');
}

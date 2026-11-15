// render/props/cushions.ts - A HIGHWAY CRASH-CUSHION BARREL seen from above (
// highway/cushions.ts lays them, cones/coneCushion.ts pops them): a round plastic drum 0.9 m
// across in its paint (blue on the countryside, yellow on Deaf Valley), its lid a shade darker with
// its filler cap, lit from the top-left with its shadow down-right as every other prop's; popped, a
// flat split shell (torn pieces of the drum lying round the spot).
import { shade } from '../../render.ts';   // read only at draw time (no load-time cycle)

const SHADOW = 'rgba(10,12,16,0.32)', CAP = '#1c1d20', GLINT = 'rgba(255,255,255,0.28)';
// m: the drum's radius, its lid's, the shadow's drop down-right
const DRUM_R = 0.45, LID_R = 0.3, SHADOW_M = 0.16;
// the lid's and the shell's shades of the paint
const LID_SHADE = 0.78, SHELL_SHADE = 0.85, SPLIT_SHADE = 0.55;
// pieces a popped drum lies in
const SHELL_PIECES = 5;
// each paint's shades, made once
const SHADES = new Map<string, string>();

/**
 * A paint's shade, made once.
 * @param paint the colour
 * @param factor the shade
 * @returns the shaded colour
 */
function shadeOnce(paint: string, factor: number) {
  const key = paint + factor;
  let col = SHADES.get(key);
  if (!col) SHADES.set(key, col = shade(paint, factor));
  return col;
}

/**
 * A pixel disc: two crossed rects (an octagon at the art's size).
 * @param ctx the canvas, at the barrel's centre
 * @param x its centre's x, m
 * @param y its centre's y, m
 * @param radius m
 * @param ppm pixels per metre
 */
function disc(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, ppm: number) {
  const side = radius * 2 * ppm, inset = radius * 2 * ppm * (2 / 3);
  ctx.fillRect((x - radius) * ppm, y * ppm - inset / 2, side, inset);
  ctx.fillRect(x * ppm - inset / 2, (y - radius) * ppm, inset, side);
}

/**
 * A popped drum: its torn pieces lying flat round the spot, their split edges dark.
 * @param ctx the canvas
 * @param paint the drum's paint
 * @param seed its look (from its home spot)
 * @param ppm pixels per metre
 */
function paintShell(ctx: CanvasRenderingContext2D, paint: string, seed: number, ppm: number) {
  let state = seed;
  const rand = () => (state = (state * 16807) % 2147483647) / 2147483647;
  for (let piece = 0; piece < SHELL_PIECES; piece++) {
    const angle = rand() * 6.283, radius = 0.15 + rand() * 0.5;
    const wide = (0.25 + rand() * 0.35) * ppm, high = (0.15 + rand() * 0.2) * ppm;
    const x = Math.cos(angle) * radius * ppm - wide / 2, y = Math.sin(angle) * radius * ppm
      - high / 2;
    ctx.fillStyle = shadeOnce(paint, piece === 0 ? LID_SHADE : SHELL_SHADE);
    ctx.fillRect(x, y, Math.max(1, wide), Math.max(1, high));
    ctx.fillStyle = shadeOnce(paint, SPLIT_SHADE);
    ctx.fillRect(x, y + high - Math.max(1, high * 0.2), Math.max(1, wide),
      Math.max(1, high * 0.2));
  }
}

/**
 * Draws a crash-cushion barrel or its popped shell, when the loose object is one.
 * @param ctx the canvas, translated to the object
 * @param cone the loose object (its kind, paint and home spot)
 * @param ppm pixels per metre
 * @returns whether it was one
 */
export function drawLooseCushion(ctx: CanvasRenderingContext2D,
  cone: { kind: string; paint?: string; hx?: number; hy?: number }, ppm: number): boolean {
  if (cone.kind !== 'cushion' && cone.kind !== 'cushionpop') return false;
  const paint = cone.paint || '#2b56b5';
  if (cone.kind === 'cushionpop') {
    paintShell(ctx, paint, Math.abs(Math.round((cone.hx || 0) * 7 + (cone.hy || 0) * 13))
      % 997 + 1, ppm);
    return true;
  }
  ctx.fillStyle = SHADOW;
  disc(ctx, SHADOW_M, SHADOW_M, DRUM_R, ppm);
  ctx.fillStyle = paint;
  disc(ctx, 0, 0, DRUM_R, ppm);
  ctx.fillStyle = shadeOnce(paint, LID_SHADE);
  disc(ctx, 0, 0, LID_R, ppm);
  ctx.fillStyle = GLINT;
  ctx.fillRect(-0.4 * ppm, -0.12 * ppm, Math.max(1, 0.08 * ppm), 0.24 * ppm);
  ctx.fillStyle = CAP;
  ctx.fillRect(-0.08 * ppm, -0.08 * ppm, Math.max(1, 0.16 * ppm), Math.max(1, 0.16 * ppm));
  return true;
}

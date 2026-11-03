// hud/widgets.ts — shared HUD drawing primitives: margins, time format, panel, label, button.
// Pure moves out of hud.ts.

import { COL } from '../world/colours.ts';

export const MARGIN = 12;              // minimum margin
export const BTN_H = 34;          // >= 30px touch target; the repeated ones (pedals) are 72px
export const DIAGRAM_H = 50;      // css px: the tyre / damage diagram under the speedo

/** A HUD rectangle (css px), maybe a button with its label. */
export interface HudRect { x: number; y: number; w: number; h: number; label?: string }
/** A HUD label's style. */
export interface LabelStyle { size?: number; col?: string; align?: 'left' | 'center' | 'right';
  weight?: number; maxW?: number }
/** What a top-row button reads of the audio (it greys MUTE). */
interface MuteAudio { muted: boolean; volume: number }

/**
 * A time as m:ss.cc.
 * @param seconds the time
 * @returns the text
 */
export function fmtTime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00.00';
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  return `${minutes}:${String(sec).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/**
 * Draw a rounded HUD panel.
 * @param ctx the HUD context
 * @param rect where
 * @param style its fill and outline (null: none)
 */
export function drawHudPanel(ctx: CanvasRenderingContext2D, rect: HudRect,
  { fill = 'rgba(27,29,34,0.88)', stroke = 'rgba(255,255,255,0.14)' }:
  { fill?: string; stroke?: string | null } = {}): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  const rad = 8;
  ctx.moveTo(rect.x + rad, rect.y);
  ctx.arcTo(rect.x + rect.w, rect.y, rect.x + rect.w, rect.y + rect.h, rad);
  ctx.arcTo(rect.x + rect.w, rect.y + rect.h, rect.x, rect.y + rect.h, rad);
  ctx.arcTo(rect.x, rect.y + rect.h, rect.x, rect.y, rad);
  ctx.arcTo(rect.x, rect.y, rect.x + rect.w, rect.y, rad);
  ctx.closePath();
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

/**
 * Draw one line of HUD text, shrinking the font to fit maxW when given.
 * @param ctx the HUD context
 * @param text the text
 * @param x where, css px
 * @param y its middle, css px
 * @param style size, col, align, weight, maxW
 */
// maxW: shrink the font until the text fits (long car names: "Lamburghini Hurrikan" ran into TUNE
// and the drive tag)
export function drawHudLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number,
  { size = 12, col = COL.hudText, align = 'left', weight = 600, maxW = 0 }: LabelStyle = {}): void {
  ctx.fillStyle = col;
  ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  if (maxW) while (size > 7 && ctx.measureText(text).width > maxW) {
    size -= 0.5;
    ctx.font = `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;
  }
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/**
 * One button of the top-centre row.
 * @param ctx the HUD context
 * @param rects the layout rectangles (vol, help)
 * @param audio the audio engine (may be missing)
 * @param button the button rectangle
 */
export function drawHudButton(ctx: CanvasRenderingContext2D,
  rects: { vol?: HudRect; help?: HudRect }, audio: MuteAudio | null | undefined,
  button: HudRect): void {
  drawHudPanel(ctx, button);
  const isMuted = button === rects.vol && audio && (audio.muted || audio.volume <= 0.001);
  drawHudLabel(ctx, button.label || '', button.x + button.w / 2, button.y + button.h / 2, {
    size: button === rects.help ? 14 : 10.5, align: 'center', weight: button === rects.help
      ? 700 : 600,
    col: isMuted ? COL.danger : COL.hudText,
  });
}

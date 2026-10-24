// hud/widgets.js — shared HUD drawing primitives: margins, time format, panel, label, button.
// Pure moves out of hud.js.

import { COL } from '../world/colours.ts';
import { fittedSize, setFontOnce, stampLabel, textStateOn } from './textcache.ts';

export const MARGIN = 12;              // minimum margin
export const BTN_H = 34;          // >= 30px touch target; the repeated ones (pedals) are 72px
export const DIAGRAM_H = 50;      // css px: the tyre / damage diagram under the speedo

export function fmtTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00.00';
  const minutes = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  const centis = Math.floor((seconds % 1) * 100);
  return `${minutes}:${String(sec).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

/**
 * Draw a rounded HUD panel.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @param {{fill?:string,stroke?:string|null}} [style]
 * @returns {void}
 */
export function drawHudPanel(ctx, rect,
  { fill = 'rgba(27,29,34,0.88)', stroke = 'rgba(255,255,255,0.14)' } = {}) {
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
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {object} [style] size, col, align, weight, maxW
 * @returns {void}
 */
// maxW: shrink the font until the text fits (long car names: "Lamburghini Hurrikan" ran into TUNE
// and the drive tag)
export function drawHudLabel(ctx, text, x, y,
  { size = 12, col = COL.hudText, align = 'left', weight = 600, maxW = 0 } = {}) {
  // ?hudtext=1: a label seen before is stamped from its own bitmap (hud/textcache.ts)
  if (stampLabel(ctx, text, x, y, size, col, align, weight, maxW)) return;
  if (textStateOn()) {
    drawLabelLean(ctx, text, x, y, size, col, align, weight, maxW);
    return;
  }
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

const labelFont = (weight, size) =>
  `${weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;

/**
 * drawHudLabel under ?hudtext=2: the font set only when it changes, the shrink-to-fit size
 * measured once per label (hud/textcache.ts).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string|number} text
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @param {string} col
 * @param {string} align
 * @param {number} weight
 * @param {number} maxW
 * @returns {void}
 */
function drawLabelLean(ctx, text, x, y, size, col, align, weight, maxW) {
  if (maxW) {
    size = fittedSize(text + '|' + weight + '|' + size + '|' + maxW, () => {
      let fit = size;
      ctx.font = labelFont(weight, fit);
      while (fit > 7 && ctx.measureText(text).width > maxW) {
        fit -= 0.5;
        ctx.font = labelFont(weight, fit);
      }
      setFontOnce(ctx, labelFont(weight, fit));
      return fit;
    });
  }
  ctx.fillStyle = col;
  setFontOnce(ctx, labelFont(weight, size));
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

/**
 * One button of the top-centre row.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} rects the layout rectangles
 * @param {object} audio the audio engine (may be missing)
 * @param {object} button the button rectangle
 * @returns {void}
 */
export function drawHudButton(ctx, rects, audio, button) {
  drawHudPanel(ctx, button);
  const isMuted = button === rects.vol && audio && (audio.muted || audio.volume <= 0.001);
  drawHudLabel(ctx, button.label, button.x + button.w / 2, button.y + button.h / 2, {
    size: button === rects.help ? 14 : 10.5, align: 'center', weight: button === rects.help
      ? 700 : 600,
    col: isMuted ? COL.danger : COL.hudText,
  });
}

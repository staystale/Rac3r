// HUD TEXT CACHE (?hudtext=1; owner-approved "HUD text fix": "make sure it makes it better not
// worse"). MEASURED before (tools/scratch/_hudcost.mjs, Castle Cum, 5 AI, CPU x4): hud.draw
// 2.7 ms a frame (p95 5 ms), 12-13 % of the drawing, 27 text draws a frame - every label set its
// font and rasterised its glyphs every frame. A label seen twice is drawn once into a small
// bitmap at the screen's density and stamped from then on; a label seen once (a timer's
// hundredths) is drawn directly, as before, so it never costs more. Both maps are capped.
//
// The bitmap is the text alone (the label's font, colour and weight), its anchor where
// drawHudLabel would have put it (hud/widgets.js).

/** A label drawn into its own bitmap. */
interface CachedLabel {
  canvas: HTMLCanvasElement;
  widthCss: number;     // the bitmap's size, css px
  heightCss: number;
  textCss: number;      // the text's width, css px (for the alignment)
}

/** How drawHudLabel styles a label. */
export interface LabelStyle {
  size: number;
  col: string;
  align: string;
  weight: number;
  maxW: number;
}

// the space round the text in a bitmap, css px (the glyphs' overhang), and the line height
const PAD = 2, LINE = 1.5;
// labels kept, and labels counted on their first sighting
const CACHE_CAP = 300, SEEN_CAP = 600;

// ?hudtext=1: the bitmap stamps; ?hudtext=2: the font set only when it changes and the
// shrink-to-fit size remembered (no bitmaps)
let hudTextMode = 0, scale = 1;
const cache = new Map<string, CachedLabel>(), seen = new Map<string, number>();
let measureCtx: CanvasRenderingContext2D | null = null;

/**
 * Turns the HUD text cache on or off (?hudtext=1).
 * @param isOn true to cache the labels
 */
export function setHudText(mode: number): void {
  hudTextMode = mode;
}

// ?hudtext=2: the font last set on the HUD's context (cleared at each frame and by any other font
// set on it), and each label's shrink-to-fit size
let fontSet = '';
const fitSize = new Map<string, number>();

/** Whether the HUD sets the font only when it changes (?hudtext=2). */
export function textStateOn(): boolean {
  return hudTextMode === 2;
}

/** The HUD context's font was set elsewhere (hud/overlays.js): set it again on the next label. */
export function forgetFont(): void {
  fontSet = '';
}

/**
 * Sets the HUD context's font unless it is already that font (?hudtext=2).
 * @param ctx the HUD's context
 * @param font the CSS font
 */
export function setFontOnce(ctx: CanvasRenderingContext2D, font: string): void {
  if (font === fontSet) return;
  ctx.font = font;
  fontSet = font;
}

/**
 * A label's shrink-to-fit size, measured once (?hudtext=2).
 * @param key the label and its style
 * @param measure measures it: the fitted size
 * @returns the size, css px
 */
export function fittedSize(key: string, measure: () => number): number {
  let size = fitSize.get(key);
  if (size === undefined) {
    size = measure();
    fitSize.set(key, size);
    trim(fitSize, CACHE_CAP);
  }
  return size;
}

/**
 * The screen's density for this frame's labels (device px per css px); a change drops the cache.
 * @param deviceScale device px per css px
 */
export function setHudTextScale(deviceScale: number): void {
  fontSet = '';
  if (deviceScale === scale) return;
  scale = deviceScale;
  cache.clear();
}

const fontOf = (style: LabelStyle, size: number) =>
  `${style.weight} ${size}px ui-sans-serif, system-ui, -apple-system, sans-serif`;

/**
 * Drops the oldest entry of a map over its cap.
 * @param map the map
 * @param cap its cap
 */
function trim<T>(map: Map<string, T>, cap: number): void {
  if (map.size <= cap) return;
  const oldest = map.keys().next().value;
  if (oldest !== undefined) map.delete(oldest);
}

/**
 * Draws a label's bitmap: the font shrunk to fit maxW as drawHudLabel does.
 * @param text the label
 * @param style its style
 * @returns the bitmap
 */
function makeLabel(text: string, style: LabelStyle): CachedLabel {
  measureCtx ??= document.createElement('canvas').getContext('2d')!;
  let size = style.size;
  measureCtx.font = fontOf(style, size);
  if (style.maxW) while (size > 7 && measureCtx.measureText(text).width > style.maxW) {
    size -= 0.5;
    measureCtx.font = fontOf(style, size);
  }
  const textCss = measureCtx.measureText(text).width;
  const widthCss = Math.ceil(textCss) + 2 * PAD, heightCss = Math.ceil(size * LINE) + 2 * PAD;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(widthCss * scale);
  canvas.height = Math.ceil(heightCss * scale);
  const labelCtx = canvas.getContext('2d')!;
  labelCtx.scale(scale, scale);
  labelCtx.font = fontOf(style, size);
  labelCtx.fillStyle = style.col;
  labelCtx.textAlign = 'left';
  labelCtx.textBaseline = 'middle';
  labelCtx.fillText(text, PAD, heightCss / 2);
  return { canvas, widthCss, heightCss, textCss };
}

/**
 * Stamps a cached label where drawHudLabel would draw it, if it is cached or seen before.
 * @param ctx the HUD's context (css px)
 * @param text the label (a number is drawn as its text)
 * @param x its x, css px (by the alignment)
 * @param y its middle, css px
 * @param size font size, css px
 * @param col its colour
 * @param align 'left', 'center' or 'right'
 * @param weight font weight
 * @param maxW the width to shrink the font to fit, css px (0: none)
 * @returns true when stamped; false: draw it directly (the cache is off, or a first sighting)
 */
export function stampLabel(ctx: CanvasRenderingContext2D, text: string | number, x: number,
    y: number, size: number, col: string, align: string, weight: number, maxW: number): boolean {
  if (hudTextMode !== 1 || text === '') return false;
  const key = text + '|' + size + '|' + col + '|' + weight + '|' + maxW;
  let label = cache.get(key);
  if (!label) {
    const count = (seen.get(key) || 0) + 1;
    seen.set(key, count);
    trim(seen, SEEN_CAP);
    if (count < 2) return false;
    label = makeLabel(String(text), { size, col, align, weight, maxW });
    cache.set(key, label);
    trim(cache, CACHE_CAP);
  }
  const left = align === 'center' ? x - label.textCss / 2
    : align === 'right' ? x - label.textCss : x;
  // whole device px: a fractional stamp blurs the glyphs
  const drawX = Math.round((left - PAD) * scale) / scale;
  const drawY = Math.round((y - label.heightCss / 2) * scale) / scale;
  ctx.drawImage(label.canvas, drawX, drawY, label.widthCss, label.heightCss);
  return true;
}

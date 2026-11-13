// render/spritepixels.ts: a sprite's pixels to work on (a dent, a crumple, a lost part), read back
// from its canvas ONCE and copied after. A read back (getImageData) waits for all the drawing
// queued before it: in a 20-car pile-up the cars were re-dented several times a frame and the
// reads were ~22 % of the frame (tools/scratch/_benchprof.mjs). A sprite canvas is never painted
// again once it is built (a new look is a new canvas), so its pixels stay what was read.
import { trackCanvas } from '../core/memorybudget.ts';

// the pixels a copy of each sprite canvas read back as
const READ = new WeakMap<HTMLCanvasElement, ImageData>();
// sprites made and not read yet, read one a frame (readNextSprite): a crash dents a whole field
// in a quarter second, and their first reads all landed in its frames
const WAITING: HTMLCanvasElement[] = [];

/**
 * Read a sprite back now: drawn onto a fresh canvas and read there, kept.
 * @param source the sprite's canvas (never painted again)
 * @returns its pixels
 */
function readSprite(source: HTMLCanvasElement): ImageData {
  const copy = trackCanvas(document.createElement('canvas'));
  copy.width = source.width;
  copy.height = source.height;
  const copyCtx = copy.getContext('2d')!;
  copyCtx.drawImage(source, 0, 0);
  const read = copyCtx.getImageData(0, 0, copy.width, copy.height);
  READ.set(source, read);
  return read;
}

/**
 * A sprite just built that may be dented later: read it on a quiet frame (readNextSprite).
 * @param source the sprite's canvas (never painted again)
 */
export function readSoon(source: HTMLCanvasElement) {
  if (!READ.has(source)) WAITING.push(source);
}

/**
 * Read the oldest sprite waiting, if any (the game loop calls it once a frame).
 * @returns true when one was read
 */
export function readNextSprite(): boolean {
  while (WAITING.length) {
    const source = WAITING.shift()!;
    if (READ.has(source)) continue;
    readSprite(source);
    return true;
  }
  return false;
}

/**
 * A sprite just made by putting pixels (nothing drawn on it after): keep what reading it back
 * will give, so it is never read back (a dented car's sprite is made again at each step of its
 * damage; then the parts it lost are taken off it). Only when every pixel is opaque or clear:
 * those are stored exactly (a clear one reads back as transparent black); a partly clear one is
 * left to be read.
 * @param canvas the sprite's canvas, as put
 * @param img the pixels put on it
 */
export function notePutPixels(canvas: HTMLCanvasElement, img: ImageData) {
  const data = img.data, read = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i += 4) {
    const alpha = data[i + 3];
    if (alpha === 0) continue;
    if (alpha !== 255) return;
    read[i] = data[i]; read[i + 1] = data[i + 1]; read[i + 2] = data[i + 2]; read[i + 3] = 255;
  }
  READ.set(canvas, new ImageData(read, img.width, img.height));
}

/**
 * A sprite's pixels to read, not change (read back once, kept).
 * @param source the sprite's canvas (never painted again)
 * @returns its pixels
 */
export function spritePixels(source: HTMLCanvasElement): ImageData {
  return READ.get(source) || readSprite(source);
}

/** A fresh canvas the size of a sprite, its context, and the sprite's pixels to change and put. */
export interface SpriteWork {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  img: ImageData;
}

/**
 * A fresh canvas the size of a sprite and a copy of the sprite's pixels - what drawing the sprite
 * onto the canvas and reading it back gives - to change and put back with putImageData (the whole
 * canvas).
 * @param source the sprite's canvas (never painted again)
 * @returns the canvas, its context and the pixels
 */
export function spriteToWork(source: HTMLCanvasElement): SpriteWork {
  const canvas = trackCanvas(document.createElement('canvas'));
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!, read = READ.get(source) || readSprite(source);
  return { canvas, ctx, img: new ImageData(new Uint8ClampedArray(read.data), read.width,
    read.height) };
}

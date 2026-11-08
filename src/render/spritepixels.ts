// render/spritepixels.ts: a sprite's pixels to work on (a dent, a crumple, a lost part), read back
// from its canvas ONCE and copied after. A read back (getImageData) waits for all the drawing
// queued before it: in a 20-car pile-up the cars were re-dented several times a frame and the
// reads were ~22 % of the frame (tools/scratch/_benchprof.mjs). A sprite canvas is never painted
// again once it is built (a new look is a new canvas), so its pixels stay what was read.

// the pixels a copy of each sprite canvas read back as
const READ = new WeakMap<HTMLCanvasElement, ImageData>();

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
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d')!;
  let read = READ.get(source);
  if (!read) {
    ctx.drawImage(source, 0, 0);
    read = ctx.getImageData(0, 0, canvas.width, canvas.height);
    READ.set(source, read);
  }
  return { canvas, ctx, img: new ImageData(new Uint8ClampedArray(read.data), read.width,
    read.height) };
}

// tools/lib/thumbwebp.mjs - A TRACK THUMBNAIL AS LOSSLESS WEBP (tools/thumbs.mjs): the browser
// encodes a PNG's pixels as WebP at quality 1 (lossless in Chromium), decodes it back and keeps it
// only if every pixel matches; menu/thumbfiles.ts reads these (?thumbfill=1). MEASURED
// (tools/scratch/_thumbwebp.mjs): the 52 thumbnails 1871 -> 1221 KB, every pixel the same.

/**
 * Encodes PNGs as lossless WebP in the page, each checked pixel for pixel.
 * @param page a Playwright page on the game's server
 * @param pngs level id -> the PNG's base64
 * @returns level id -> the WebP's base64 (one whose pixels did not match is left out)
 */
export async function encodeThumbsWebp(page, pngs) {
  return page.evaluate(async (files) => {
    const read = async (blob) => {
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none',
        premultiplyAlpha: 'none' });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return { canvas, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
    };
    const toBase64 = async (blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return btoa(binary);
    };
    const out = {};
    for (const [levelId, b64] of Object.entries(files)) {
      const source = await read(await (await fetch(`data:image/png;base64,${b64}`)).blob());
      const webp = await source.canvas.convertToBlob({ type: 'image/webp', quality: 1 });
      if (webp.type !== 'image/webp') continue;
      const back = await read(webp);
      if (back.data.length !== source.data.length) continue;
      let isSame = true;
      for (let i = 0; i < back.data.length && isSame; i++) isSame = back.data[i] === source.data[i];
      if (isSame) out[levelId] = await toBase64(webp);
    }
    return out;
  }, pngs);
}

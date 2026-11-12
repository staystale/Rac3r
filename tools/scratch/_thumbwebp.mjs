// _thumbwebp.mjs - HOW SMALL THE TRACK THUMBNAILS GET AS WEBP (scratch): each shipped PNG encoded
// in the browser as WebP at quality 1 (lossless where the browser does that) and 0.9, decoded back,
// and its pixels compared with the PNG's: the bytes and the pixels that differ.
// node tools/scratch/_thumbwebp.mjs   (CHECK_PORT; one browser)
import fs from 'node:fs';
import { startServer, launchBrowser } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext()).newPage();
  await page.goto(`${server.url}/assets/thumbs/index.json`);
  const ids = JSON.parse(fs.readFileSync('assets/thumbs/index.json', 'utf8')).ids;
  const rows = await page.evaluate(async (list) => {
    const read = async (blob) => {
      const bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none',
        premultiplyAlpha: 'none' });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(bitmap, 0, 0);
      return { canvas, data: ctx.getImageData(0, 0, bitmap.width, bitmap.height).data };
    };
    const out = [];
    for (const id of list) {
      const png = await (await fetch(`/assets/thumbs/${id}.png`)).blob();
      const source = await read(png);
      const row = { id, png: png.size };
      for (const quality of [1, 0.9]) {
        const webp = await source.canvas.convertToBlob({ type: 'image/webp', quality });
        const back = await read(webp);
        let differ = 0;
        for (let i = 0; i < back.data.length; i += 4) {
          if (back.data[i] !== source.data[i] || back.data[i + 1] !== source.data[i + 1]
            || back.data[i + 2] !== source.data[i + 2] || back.data[i + 3] !== source.data[i + 3]) {
            differ++;
          }
        }
        row[`q${quality}`] = { bytes: webp.size, type: webp.type, differ };
      }
      out.push(row);
    }
    return out;
  }, ids);
  const sum = (pick) => rows.reduce((total, row) => total + pick(row), 0);
  console.log(`png ${(sum((row) => row.png) / 1024).toFixed(0)} KB; webp q1 `
    + `${(sum((row) => row.q1.bytes) / 1024).toFixed(0)} KB (${rows[0].q1.type}), pixels differing in `
    + `${rows.filter((row) => row.q1.differ).length} files; webp q0.9 `
    + `${(sum((row) => row['q0.9'].bytes) / 1024).toFixed(0)} KB, differing pixels `
    + `${sum((row) => row['q0.9'].differ)}`);
} finally {
  await browser.close();
  server.stop();
}

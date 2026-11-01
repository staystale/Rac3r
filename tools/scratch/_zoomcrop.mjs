// _zoomcrop.mjs - enlarges a part of a photo x4 (nearest) for a close look.
// node tools/scratch/_zoomcrop.mjs <in.png> <x> <y> <w> <h> <out.png>
import { launchBrowser } from '../lib/browser.mjs';
import { readFileSync } from 'node:fs';
const [file, x, y, w, h, out] = process.argv.slice(2);
const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: w * 4, height: h * 4 } });
const data = 'data:image/png;base64,' + readFileSync(file).toString('base64');
await page.setContent(`<body style="margin:0"><canvas id=c width=${w * 4} height=${h * 4}></canvas></body>`);
await page.evaluate(async ({ data, x, y, w, h }) => {
  const img = new Image(); img.src = data; await img.decode();
  const ctx = document.getElementById('c').getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, w, h, 0, 0, w * 4, h * 4);
}, { data, x: +x, y: +y, w: +w, h: +h });
await page.screenshot({ path: out });
await browser.close();

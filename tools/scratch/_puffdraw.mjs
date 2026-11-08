// _puffdraw.mjs - the draw cost of N puffs as renderPuffs draws them (a square each, save /
// setTransform / restore), on a phone-sized canvas at 3x, in the test browser: ms a frame.
import { launchBrowser } from '../lib/browser.mjs';
const browser = await launchBrowser();
const page = await browser.newPage();
const out = await page.evaluate(() => {
  const canvas = document.createElement('canvas'); canvas.width = 1170; canvas.height = 2532;
  document.body.appendChild(canvas);
  const g2d = canvas.getContext('2d'), res = {};
  for (const count of [320, 640, 1060]) {
    const puffs = Array.from({ length: count }, () => ({ x: Math.random() * 1170, y: Math.random() * 2532,
      r: 6 + Math.random() * 30, a: Math.random() }));
    const t0 = performance.now();
    for (let frame = 0; frame < 200; frame++) {
      for (const puff of puffs) {
        g2d.fillStyle = 'rgb(222,210,184)'; g2d.globalAlpha = puff.a * 0.5;
        g2d.save(); g2d.setTransform(1, 0, 0, 1, 0, 0);
        g2d.fillRect(puff.x - puff.r, puff.y - puff.r, puff.r * 2, puff.r * 2); g2d.restore();
      }
      g2d.getImageData(0, 0, 1, 1);   // flush the frame
    }
    res[count] = +((performance.now() - t0) / 200).toFixed(3);
  }
  return res;
});
console.log('ms a frame by puffs:', JSON.stringify(out));
await browser.close();

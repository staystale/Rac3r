// _zoomshots.mjs - THE GROUND ACROSS A ZOOM-OUT AND BACK IN (scratch, ?tiledensity=1): the real
// game in the browser (GPU), a level started (no loading screen), the car standing; the zoom
// pinned from 1 down to 0.3 and back up in small steps, FRAMES real frames each, the screen
// photographed at each step (and a strip of every frame round a step change with STRIP=1).
// Compare two runs' folders with tools/shotdiff.mjs.
// [W=844] [H=390] [FRAMES=6] node tools/scratch/_zoomshots.mjs <level> <out dir> [extra query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'thruston', outDir = 'zoomshots', extra = ''] = process.argv.slice(2);
const W = +(process.env.W || 844), H = +(process.env.H || 390);
const FRAMES = +(process.env.FRAMES || 6);
// the zooms: 1 -> 0.3 -> 1, ~4 % a step (the speed zoom's own glide moves ~1-2 % a frame)
const DOWN = [];
for (let zoom = 1; zoom > 0.3; zoom *= 0.96) DOWN.push(+zoom.toFixed(3));
DOWN.push(0.3);
const ZOOMS = [...DOWN, ...DOWN.slice(0, -1).reverse()];

mkdirSync(outDir, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: W, height: H },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&loadscreen=0&noaudio=1`
    + `&level=${levelId}${extra ? '&' + extra : ''}`);
  await page.touchscreen.tap(W / 2, H / 2);
  await page.waitForTimeout(6000);
  const frames = (count) => page.evaluate((n) => new Promise((done) => {
    let left = n;
    const tick = () => (--left > 0 ? requestAnimationFrame(tick) : done());
    requestAnimationFrame(tick);
  }), count);
  let index = 0;
  for (const zoom of ZOOMS) {
    await page.evaluate((z) => window.__game.renderer.debugZoom(z), zoom);
    await frames(FRAMES);
    await page.screenshot({ path: `${outDir}/${levelId}-${W}x${H}-${String(index++).padStart(3, '0')}`
      + `-z${zoom.toFixed(3)}.png` });
  }
  console.log(`${ZOOMS.length} photos in ${outDir}`);
  console.log(errors.length ? `page errors: ${errors.slice(0, 3).join(' | ')}` : 'page errors: none');
} finally {
  await browser.close();
  server.stop();
}

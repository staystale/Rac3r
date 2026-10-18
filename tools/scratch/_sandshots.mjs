// _sandshots.mjs - photographs sand dents in the real game (GPU ground): The Rough Patch's sand,
// a band of passes across it (wear.ts recordWearAt over a 30 m x 4 m strip, 8 passes), before and
// after, at 390x844 (?sanddig=1). Prints how deep the strip went.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&sanddig=1`
    + (process.argv[2] || ''));
  await page.touchscreen.tap(195, 422);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__game.launch('rough-patch', 'hatch-rwd', { ai: 0 }));
  await page.waitForTimeout(4000);
  const centre = { x: 196, y: 598 };
  await page.evaluate((where) => {
    const game = window.__game;
    game.car.x = where.x - 14; game.car.y = where.y - 12; game.car.vx = game.car.vy = 0;
    game.renderer.snap(game.car);
  }, centre);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(tmpdir(), 'sand-before.png') });
  const depth = await page.evaluate(async (where) => {
    const wear = await import('/src/world/wear.ts');
    let clock = performance.now();
    for (let pass = 0; pass < 8; pass++) {
      for (let x = where.x - 15; x < where.x + 15; x += 0.5) {
        for (let y = where.y - 2; y < where.y + 2; y += 0.5) {
          wear.recordWearAt(x, y, null, (clock += 400));
        }
      }
    }
    return wear.rutAt(where.x, where.y);
  }, centre);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: join(tmpdir(), 'sand-after.png') });
  console.log('dent at the strip centre, m:', depth.toFixed(3));
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

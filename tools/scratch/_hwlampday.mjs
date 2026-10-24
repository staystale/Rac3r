// _hwlampday.mjs - by day, zoomed out (debugZoom 0.45) at 844x390 and 390x844: are
// the highway's street lights there and readable by day. node tools/scratch/_hwlampday.mjs <out>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
      hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0`);
    await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.waitForTimeout(3000);
    await page.evaluate(() => window.__game.renderer.debugZoom(0.45));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(out, `hwlamps-dayzoom-${viewport.width}.png`) });
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

// _lampflood.mjs - _lampmaps.mjs with the camera on a planned floodlight's pool (zoom 0.3). Temp folder.
// the spawn), to see where the lamp plan put its lights (844x390). Temp folder.
// node tools/scratch/_lampmaps.mjs [level ...]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const levels = process.argv.slice(2).length ? process.argv.slice(2)
  : ['lab', 'brands-snatch', 'naffcar', 'killder', 'knobhill'];
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const level of levels) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&lamps=1&night=0.85`);
    await page.touchscreen.tap(422, 195);
    await page.waitForTimeout(400);
    await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd', { ai: 0 }), level);
    await page.waitForTimeout(4000);
    const count = await page.evaluate(async () => {
      const lamps = (await import('/src/world/lamps.ts')).activeLamps();
      const flood = lamps.find((lamp) => lamp.ownDraw); const car = window.__game.car; car.x = flood.x + 25; car.y = flood.y; car.vx = car.vy = 0; window.__game.renderer.snap(car); window.__game.renderer.debugZoom(0.3);
      return lamps.length;
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(tmpdir(), `lampflood-${level}.png`) });
    console.log(level, 'lamps', count);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

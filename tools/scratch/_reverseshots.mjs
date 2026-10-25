// _reverseshots.mjs - reversing light photos: the player's car held in reverse gear, parked on
// Castle Cum's start straight, by day and at ?night=0.8 (844x390, 390x844), zoomed in.
// node tools/scratch/_reverseshots.mjs <out folder>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const night of [false, true]) {
    for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
        hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('ERROR ' + error));
      await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0`
        + (night ? '&night=0.8' : ''));
      await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
        { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
      await page.waitForTimeout(3000);
      // held in reverse, still (the lamps follow the gear)
      await page.evaluate(() => {
        const car = window.__game.car;
        setInterval(() => { car.gear = -1; car.vx = 0; car.vy = 0; }, 5);
        window.__game.renderer.debugZoom(1.6);
      });
      await page.waitForTimeout(1500);
      const name = `reverse-${night ? 'night' : 'day'}-${viewport.width}.png`;
      await page.screenshot({ path: join(out, name) });
      console.log('photo', name);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}

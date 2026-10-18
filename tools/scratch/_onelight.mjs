// _onelight.mjs - the headlights with and without ?onelight=1, the player's LIGHTS on, Castle Cum,
// at a fixed darkness: 0 (day: the car picture's old yellow cone vs lamps only), 0.05 and 0.15
// (the first dusk: the night layer's beam fading in). 844x390, a close-up of the player's car.
// Prints page errors. Photos in the temp folder. node tools/scratch/_onelight.mjs
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const viewport = { width: 844, height: 390 };
  for (const [mode, query] of [['old', ''], ['one', '&onelight=1']]) {
    for (const darkness of ['0', '0.05', '0.15']) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
        hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('ERROR ' + error));
      await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&seed=3`
        + `&night=${darkness}${query}`);
      await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
        { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
      await page.waitForTimeout(3000);
      await page.evaluate(() => { window.__game.car.lightsOn = true; });
      await page.waitForTimeout(500);
      const name = `onelight-${mode}-${darkness}.png`;
      await page.screenshot({ path: join(tmpdir(), name),
        clip: { x: viewport.width / 2 - 200, y: viewport.height / 2 - 90, width: 400, height: 180 } });
      console.log(name);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}

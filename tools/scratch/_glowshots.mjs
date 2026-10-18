// _glowshots.mjs - the indicator glow at ?night=0.8: the player's indicator on, four photos a
// blink apart (844x390, Castle Cum, no AI). Temp folder.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const viewport = { width: 844, height: 390 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
    hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&night=0.8`);
  await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(5000);
  for (let shot = 0; shot < 4; shot++) {
    const state = await page.evaluate(() => {
      const car = window.__game.car;
      car.indicator = 1; car.indT = 0; car.lightsOn = true;
      return { indicator: car.indicator, hazard: !!car.hazard };
    });
    await page.waitForTimeout(170);
    await page.screenshot({ path: join(tmpdir(), `glow-${shot}.png`) });
    console.log('shot', shot, JSON.stringify(state));
  }
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

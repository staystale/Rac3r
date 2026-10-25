// _sparkshots.mjs - sparks (owner: "I don't see sparks"; "sparks should be a light source at
// night"): the autopilot up to speed on Castle Cum, then the front +y wheel on its rim; photos at
// race zoom by day and at night (?night=0.85), 844x390, and a crop round the car.
// node tools/scratch/_sparkshots.mjs <out folder>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [tag, query] of [['day', ''], ['night', '&night=0.85']]) {
    const context = await browser.newContext({ viewport: { width: 844, height: 390 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1${query}`);
    await page.touchscreen.tap(422, 195);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.waitForTimeout(9000);
    await page.evaluate(() => {
      const car = window.__game.car;
      car.tyreP = [1, 0, 1, 1]; car.onRim = [false, true, false, false];
      car.tyreLeak = [0, 1, 0, 0];
    });
    await page.waitForTimeout(900);
    await page.screenshot({ path: join(out, `sparks-${tag}.png`) });
    await page.screenshot({ path: join(out, `sparks-${tag}-close.png`),
      clip: { x: 422 - 150, y: 195 - 90, width: 300, height: 180 } });
    console.log(tag, await page.evaluate(() => JSON.stringify(window.__game.car.rimSparks)));
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

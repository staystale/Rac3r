// _lamppools.mjs - the lamp pools at ?night=0.85 (844x390): Castle Cum's start straight (street
// lights) at the spawn, and the camera on a floodlight pylon of each level given (zoom 0.3).
// Photos named by the label argv[2] (e.g. old / new). Temp folder.
// node tools/scratch/_lamppools.mjs <label> [level ...]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const label = process.argv[2] || 'now';
const levels = process.argv.slice(3).length ? process.argv.slice(3) : ['castle-cum', 'naffcar'];
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const level of levels) {
    for (const where of (process.env.SPOTS || 'spawn,pylon,street').split(',')) {
      const context = await browser.newContext({ viewport: { width: 844, height: 390 },
        deviceScaleFactor: 2, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('ERROR ' + error));
      await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&night=0.85&seed=3`);
      await page.touchscreen.tap(422, 195);
      await page.waitForTimeout(400);
      await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
        { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
      await page.waitForTimeout(3500);
      const count = await page.evaluate(async (spot) => {
        const lamps = (await import('/src/world/lamps.ts')).activeLamps();
        const flood = lamps.find((lamp) => lamp.kind === 'flood');
        const street = lamps.find((lamp) => lamp.kind === 'street');
        const target = spot === 'pylon' ? flood : spot === 'street' ? street : null;
        if (target) {
          const car = window.__game.car;
          car.x = target.headX + (spot === 'pylon' ? 25 : 6); car.y = target.headY;
          car.vx = car.vy = 0;
          window.__game.renderer.snap(car);
          window.__game.renderer.debugZoom(spot === 'pylon' ? 0.3 : 1);
        }
        return lamps.length;
      }, where);
      await page.waitForTimeout(2500);
      const name = `lamppools-${label}-${level}-${where}.png`;
      await page.screenshot({ path: join(tmpdir(), name) });
      console.log(name, 'lamps', count);
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}

// _hedgeshots.mjs - photos of the highway's hedgerows (?hedges=1): the autopilot drives, then
// shots at two zooms, 844x390 and 390x844. node tools/scratch/_hedgeshots.mjs <out folder>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const tag = size.width > size.height ? 'land' : 'port';
    const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&hedges=1`
      + '&autopilot=90');
    await page.touchscreen.tap(size.width / 2, size.height / 2);
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
    await page.waitForTimeout(25000);
    // park beside the nearest hedge ahead (off the road, still)
    await page.evaluate(async () => {
      const game = window.__game, car = game.car, { shared } = await import('/src/game/state.js');
      const { LEVEL } = await import('/src/world/state.ts');
      shared.settings.autopilot = false;
      shared.settings.autopilotKmh = 0;
      let best = null, bestD = Infinity;
      for (const bush of LEVEL._bushes || []) {
        const dist = Math.hypot(bush.x - car.x, bush.y - car.y);
        if (dist > 20 && dist < bestD) { bestD = dist; best = bush; }
      }
      if (best) { car.x = best.x + 6; car.y = best.y + 6; }
      car.vx = 0; car.vy = 0; car.yawRate = 0;
    });
    for (const zoom of [0.3, 1.0]) {
      await page.evaluate((level) => window.__game.renderer.debugZoom(level), zoom);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: join(out, `hedges-${zoom}-${tag}.png`) });
    }
    const count = await page.evaluate(async () => {
      const { LEVEL } = await import('/src/world/state.ts');
      return (LEVEL._bushes || []).length;
    });
    console.log(tag, 'bushes loaded', count);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

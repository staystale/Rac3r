// _coverlook.mjs - photographs ?coverlook=0 vs =1 at 390x844: the Lab's ice / snow / wet panels
// in a row (cold, weather), and the snow stage Ikeaflatpack's packed-snow road with the weather's
// ice and water beside it. Temp folder.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const look of ['0', '1']) {
    for (const [level, x, y, field] of [
      ['lab', -175, 74, { water: 0, snow: 0, ice: 0, packed: 0 }],
      ['stage-ikeaflatpack', null, null, { water: 0.35, snow: 0, ice: 0.45, packed: 0 }],
    ]) {
      const context = await browser.newContext({ viewport: level === 'lab' ? { width: 844, height: 390 } : { width: 390, height: 844 },
        deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('ERROR ' + error));
      await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&coverlook=${look}`);
      const size = page.viewportSize();
      await page.touchscreen.tap(size.width / 2, size.height / 2);
      await page.waitForTimeout(400);
      await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
        { ai: 0, weather: { mode: 'dry', season: 0, seed: 4 } }), level);
      await page.waitForTimeout(3000);
      await page.evaluate(async ([px, py, set]) => {
        const field = await import('/src/world/coverfield.ts');
        const weather = await import('/src/world/weather.ts');
        weather.WEATHER.trackC = -0.5;
        Object.assign(field.FIELD, set);
        const game = window.__game;
        if (px !== null) { game.car.x = px; game.car.y = py; }
        game.car.vx = game.car.vy = 0;
        game.renderer.snap(game.car);
        if (px !== null) game.renderer.debugZoom(0.3);
      }, [x, y, field]);
      await page.waitForTimeout(2000);
      await page.screenshot({ path: join(tmpdir(), `coverlook-${level}-${look}.png`) });
      await context.close();
    }
  }
  console.log('photos taken');
} finally {
  await browser.close();
  server.stop();
}

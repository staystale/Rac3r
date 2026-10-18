// _snowmix.mjs - the snow stage Ikeaflatpack (the level's own snow ground and packed-snow road):
// photographs with no weather snow, then with the weather's snow at 0.5 and packed snow, and
// prints what the tyres feel at points on the ground and road (the level's snow vs the weather's).
// 390x844, temp folder.
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
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0`);
  await page.touchscreen.tap(195, 422);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.launch('stage-ikeaflatpack', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 0, seed: 4 } }));
  await page.waitForTimeout(3500);
  const report = async (name, levels) => {
    const info = await page.evaluate(async (set) => {
      const field = await import('/src/world/coverfield.ts');
      const wear = await import('/src/world/wear.ts');
      const weather = await import('/src/world/weather.ts');
      weather.WEATHER.trackC = -4;
      Object.assign(field.FIELD, set);
      const { x, y } = window.__game.car;
      const feel = (dx, dy) => {
        const g = wear.groundAt(x + dx, y + dy), l = wear.layersAt(x + dx, y + dy);
        return `${(g.surface && g.surface.id) || g.id} (base ${l.base}, cover ${l.cover}, area ${l.area})`;
      };
      return `road ${feel(0, 0)} | verge ${feel(0, 9)} | ground ${feel(0, 20)}`;
    }, levels);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: join(tmpdir(), `snowmix-${name}.png`) });
    console.log(name, '|', info);
  };
  await report('level-only', { water: 0, snow: 0, ice: 0, packed: 0 });
  await report('weather-snow', { water: 0, snow: 0.5, ice: 0, packed: 0 });
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

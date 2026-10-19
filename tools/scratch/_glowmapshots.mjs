// _glowmapshots.mjs - the lamp glows drawn on the screen (old) vs in the light map (?glowmap=1):
// Castle Cum at ?night=0.8 in the rain with 3 AI, the player's lights and hazards on (amber
// indicators, red tail + rain lights), at 844x390 and 390x844, a full photo and a close-up of the
// player's car each. Temp folder. node tools/scratch/_glowmapshots.mjs
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [mode, query] of [['now', '']]) {
    for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
        hasTouch: true });
      const page = await context.newPage();
      page.on('pageerror', (error) => console.log('ERROR ' + error));
      await gotoGame(page,
        `${server.url}/?touch=1&guide=0&menu=0&rules=0&night=0.8&rain=0.6&seed=3${query}`);
      await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
      await page.waitForTimeout(400);
      await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
        { ai: 3, weather: { mode: 'rain', season: 2, seed: 4 } }));
      await page.waitForTimeout(4000);
      // the indicator blink: shoot in its lit half (two photos a blink apart, keep both)
      for (let shot = 0; shot < 4; shot++) {
        await page.evaluate(() => {
          const car = window.__game.car;
          car.lightsOn = true; car.hazard = true; car.indT = 0;
        });
        await page.waitForTimeout(170 + shot * 130);
        const base = `glowmap-${mode}-${viewport.width}x${viewport.height}-${shot}`;
        await page.screenshot({ path: join(tmpdir(), base + '.png') });
        await page.screenshot({ path: join(tmpdir(), base + '-close.png'), clip: {
          x: viewport.width / 2 - 110, y: viewport.height / 2 - 70, width: 220, height: 140 } });
        const where = await page.evaluate(() => {
          const game = window.__game;
          return { x: game.render?.toScreenX?.(game.car.x), y: game.render?.toScreenY?.(game.car.y),
            rain: game.car.rainLight, hazard: game.car.hazard };
        });
        console.log(base, JSON.stringify(where));
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}

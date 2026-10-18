// _onelook.mjs - photographs a strip of TYRE-MADE ice / snow / water next to the weather's ice
// (Castle Cum, cold, the field's ice at 0.5), with ?onelook=0 and =1, at 390x844. Temp folder.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const look of ['0', '1']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&onelook=${look}`);
    await page.touchscreen.tap(195, 422);
    await page.waitForTimeout(400);
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 0, weather: { mode: 'dry', season: 0, seed: 4 } }));
    await page.waitForTimeout(3000);
    await page.evaluate(async () => {
      const wear = await import('/src/world/wear.ts');
      const field = await import('/src/world/coverfield.ts');
      const weather = await import('/src/world/weather.ts');
      const game = window.__game;
      weather.WEATHER.trackC = -4;
      Object.assign(field.FIELD, { water: 0, snow: 0, ice: 0.45, packed: 0 });
      const { x, y } = game.car;
      let clock = performance.now();
      // three strips across the view, 4 cells wide: tyre ice, tyre snow, tyre water
      [['ice', -10], ['snow', 0], ['wet', 10]].forEach(([cover, dy]) => {
        for (let dx = -18; dx <= 18; dx += 1.5) {
          for (let k = 0; k < 4; k++) {
            wear.recordWearAt(x + dx, y + dy + k * 1.5, null, (clock += 500));
          }
        }
        for (const cell of wear.wearMap.values()) {
          const cy = (cell.cy + 0.5) * wear.WEAR_CELL;
          if (cy >= y + dy && cy < y + dy + 6) {
            cell.cover = cover; cell.laid = null; cell.standing = true; cell.current = cover;
            wear.wearDirty.push(cell);
          }
        }
      });
      game.car.y -= 40;
      game.renderer.snap(game.car);
      game.car.y += 40;
    });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(tmpdir(), `onelook-${look}.png`) });
    console.log('onelook', look, 'photo');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

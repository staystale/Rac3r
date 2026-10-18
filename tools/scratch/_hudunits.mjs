// _hudunits.mjs - photographs ?hudunits=1: the track temperature gauge in a race at 390x844 and
// 844x390 (in °C, then °F with the tyre diagram on), and the pause menu's HUD list; prints page
// errors. Photos in the temp folder.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&hudunits=1`);
    await page.touchscreen.tap(width / 2, height / 2);
    await page.waitForTimeout(500);
    const state = await page.evaluate(async () => {
      const weather = await import('/src/world/weather.ts');
      window.__game.launch('castle-cum', 'hatch-rwd',
        { ai: 0, weather: { mode: 'snow', season: 0, seed: 4 } });
      return { runs: weather.weatherRuns(), trackC: weather.WEATHER.trackC };
    });
    await page.waitForTimeout(4000);
    const shot = (name) => page.screenshot({ path: join(tmpdir(), `hudunits-${width}x${height}-${name}.png`) });
    await shot('celsius');
    await page.evaluate(() => {
      localStorage.setItem('carsim.tempUnits', 'F');
      localStorage.setItem('carsim.tyreHud', '1');
    });
    console.log(`${width}x${height}: weather runs ${state.runs}, track ${state.trackC.toFixed(1)} C`);
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

// _menusky.mjs - ?daytime=1: the race behind the menu follows the global clock and its season.
// The saved clock is set to autumn day 2, 21:00; prints the sky and the weather's season, photo.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await page.addInitScript(() => {
    localStorage.setItem('carsim.clock.v1', String((22 * 24 + 21) * 3600));
  });
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&daytime=1&lamps=1`);
  await page.waitForTimeout(5000);
  const state = await page.evaluate(async () => {
    const day = await import('/src/world/daylight.ts');
    const weather = await import('/src/world/weather.ts');
    const clock = await import('/src/world/clock.ts');
    return { dark: day.DAYLIGHT.darkness.toFixed(2), season: weather.WEATHER.season,
      kind: weather.WEATHER.kind,
      line: clock.clockLine(clock.CLOCK.eventS, weather.SEASON_NAMES) };
  });
  console.log(JSON.stringify(state));
  await page.screenshot({ path: join(tmpdir(), 'menusky.png') });
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

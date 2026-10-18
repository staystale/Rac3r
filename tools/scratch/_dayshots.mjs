// _dayshots.mjs - ?daytime=1&lamps=1: Castle Cum with 3 AI started at 19:00 / 20:00 / 22:00 of
// the game clock's day (an autumn start: sunset ~19:30), 844x390, after 6 s; then the TEST MODE
// setup's TIME rows (390x844). Temp folder.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const hour of [19, 20, 22]) {
    const viewport = { width: 844, height: 390 };
    const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
      hasTouch: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&daytime=1&lamps=1`);
    await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
    await page.waitForTimeout(400);
    await page.evaluate((time) => window.__game.launch('castle-cum', 'hatch-rwd',
      { ai: 3, time, weather: { mode: 'dry', season: 3, seed: 4 } }), hour);
    await page.waitForTimeout(6000);
    const sky = await page.evaluate(async () => {
      const day = await import('/src/world/daylight.ts');
      const clock = await import('/src/world/clock.ts');
      return { dark: day.DAYLIGHT.darkness.toFixed(2), rgb: day.DAYLIGHT.rgb,
        line: clock.clockLine(clock.CLOCK.eventS, ['WINTER', 'SPRING', 'SUMMER', 'AUTUMN']) };
    });
    await page.screenshot({ path: join(tmpdir(), `day-${hour}.png`) });
    console.log(hour, JSON.stringify(sky));
    await context.close();
  }
  const viewport = { width: 390, height: 844 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
    hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  const tap = async (text) => {
    await page.waitForTimeout(400);
    await page.locator('#menu button', { hasText: text }).first().tap();
  };
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&daytime=1&lamps=1`);
  await page.waitForTimeout(3500);
  await tap('TEST MODE'); await tap('OVALS'); await tap('Naffcar'); await tap('▶');
  await page.waitForTimeout(800);
  await page.getByText('TIME OF DAY').first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: join(tmpdir(), 'day-setup.png') });
  console.log('setup photo');
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

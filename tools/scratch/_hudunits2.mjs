// _hudunits2.mjs - ?hudunits=1 photos: 844x390 with the tyre diagram on and °F, then the pause
// menu's HUD list (menus on). Temp folder.
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
    localStorage.setItem('carsim.tempUnits', 'F');
    localStorage.setItem('carsim.tyreHud', '1');
  });
  const tap = async (text) => {
    await page.waitForTimeout(400);
    await page.locator('#menu button', { hasText: text }).first().tap();
  };
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&hudunits=1`);
  await page.waitForTimeout(3500);
  await tap('TEST MODE'); await tap('OVALS'); await tap('Naffcar'); await tap('▶');
  await tap('LAUNCH');
  await page.waitForTimeout(4000);
  await page.screenshot({ path: join(tmpdir(), 'hudunits-844x390-fahrenheit.png') });
  const pause = await page.evaluate(() => window.__game.hudLayout().help);
  await page.touchscreen.tap(pause.x + pause.w / 2, pause.y + pause.h / 2);
  await page.waitForTimeout(800);
  await tap('HUD');
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(tmpdir(), 'hudunits-844x390-hudlist.png') });
  console.log('photos taken');
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

// _themeshot.mjs - the endless road's THEME choice (menu/setup.ts addRoadTypeRow) at
// phone size: the setup on COUNTRYSIDE, on DEAF VALLEY, then a launch on it - the setup rows'
// buttons, the road type and ground it launched with, photos, page errors.
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const [width, height] = [390, 844];
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&noaudio=1`);
  await page.waitForTimeout(2500);
  const tap = async (text) => {
    await page.locator('#menu button', { hasText: text }).first().tap();
    await page.waitForTimeout(900);
  };
  const rows = () => page.evaluate(() => [...document.querySelectorAll('#menu .row')].slice(0, 2)
    .map((row) => [...row.querySelectorAll('button')].map((button) => button.textContent.trim()
      + (button.classList.contains('on') ? '*' : '')).join(' | ')));
  await tap('TEST MODE');
  await tap('ENDLESS ROADS');
  await tap('Highway to Hull');
  console.log('countryside', JSON.stringify(await rows()));
  await page.screenshot({ path: `tools/scratch/_themeshot-countryside-${width}x${height}.png` });
  await tap('DEAF VALLEY');
  console.log('deaf valley', JSON.stringify(await rows()));
  await page.screenshot({ path: `tools/scratch/_themeshot-deafvalley-${width}x${height}.png` });
  await tap('LAUNCH');
  await page.waitForTimeout(4000);
  console.log('launched', JSON.stringify(await page.evaluate(() => { const level = window.__game.level;
    return { id: level.id, road: level.roadType, base: level.base?.name || level.base?.id,
      walls: level.barriers.filter((bar) => bar.kind === 'rock').length }; })));
  await page.screenshot({ path: `tools/scratch/_themeshot-drive-${width}x${height}.png` });
  console.log(errors.length ? `ERRORS ${errors.join(' | ')}` : 'errors none');
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

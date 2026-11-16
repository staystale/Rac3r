// _newcargarage.mjs - a new car in the TEST GARAGE at 844x390 and 390x844: main menu > TEST MODE
// > OVALS > Naffcar > GARAGE, the CLASS row stepped to the class named; photos into the folder.
// node tools/scratch/_newcargarage.mjs <out dir> <class name, e.g. GT>   (RAC3R_QUERY=<switch>=1)
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery, gotoGame } from '../lib/browser.mjs';
const [OUT = 'tools/scratch/_newcargarage', CLASS_NAME = 'GT'] = process.argv.slice(2);
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    const tap = async (text) => {
      await page.waitForTimeout(600);
      const button = page.locator('#menu button', { hasText: text }).first();
      await button.waitFor({ state: 'visible', timeout: 60000 });
      await button.tap({ timeout: 60000 });
    };
    await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0${extraQuery()}`);
    await page.waitForFunction(() => window.__game.mode === 'menu', null, { timeout: 60000,
      polling: 250 });
    await tap('TEST MODE'); await tap('OVALS'); await tap('Naffcar'); await tap('GARAGE');
    const classes = [];
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(500);
      const shown = await page.locator('#menu .prow .val').first().innerText();
      classes.push(shown);
      if (shown.trim() === CLASS_NAME) break;
      await page.locator('#menu .prow').first().locator('button', { hasText: '▶' }).tap();
    }
    await page.waitForTimeout(800);
    await page.screenshot({ path: `${OUT}/garage-${width}x${height}.png` });
    console.log(`${width}x${height}: classes stepped ${classes.join(' > ')};`,
      errors.join('; ') || 'no page errors');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

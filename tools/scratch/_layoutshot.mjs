// _layoutshot.mjs - TEST MODE's layout step (?layouts=1, menu/tracks.ts showLayoutList) at phone
// size: the CIRCUITS and TEST GROUNDS track lists (their card names), Snotterton's layouts, a
// layout's setup and BACK from it; shots _layoutshot-<step>-<w>x<h>.png, page errors.
// node tools/scratch/_layoutshot.mjs [query]   (default layouts=1&dieatona=1)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'layouts=1&dieatona=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const [width, height] = [390, 844];
  const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&noaudio=1&${query}`);
  await page.waitForTimeout(2500);
  const tap = async (text) => {
    await page.locator('#menu button', { hasText: text }).first().tap();
    await page.waitForTimeout(900);
  };
  const shot = async (step) => {
    const seen = await page.evaluate(() => ({
      title: document.querySelector('#menu h2')?.textContent,
      cards: [...document.querySelectorAll('#menu .card')].map((card) =>
        [...card.querySelectorAll('span')].map((span) => span.textContent).join(' / ')) }));
    await page.screenshot({ path: `tools/scratch/_layoutshot-${step}-${width}x${height}.png` });
    console.log(step, JSON.stringify(seen));
  };
  await tap('TEST MODE');
  await tap('TEST GROUNDS');
  await shot('test');
  await tap('TYPES');
  await tap('OVALS');
  await shot('ovals');
  await tap('TYPES');
  await tap('CIRCUITS');
  await shot('circuits');
  await tap('Snotterton');
  await shot('snotterton');
  await tap('Snotterton 200');
  console.log('setup', await page.evaluate(() => document.querySelector('#menu h2')?.textContent));
  await page.screenshot({ path: `tools/scratch/_layoutshot-setup-${width}x${height}.png` });
  await tap('BACK');
  await shot('back');
  console.log(errors.length ? `ERRORS ${errors.join(' | ')}` : 'errors none');
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

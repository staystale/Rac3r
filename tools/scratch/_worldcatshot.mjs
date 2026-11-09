// _worldcatshot.mjs - TEST MODE's categories with the WORLD CIRCUITS category (?worldcat=1):
// the types screen, the WORLD CIRCUITS list and CIRCUITS (Spa listed once), at 390x844 and
// 844x390; shots _worldcatshot-<step>-<w>x<h>.png, the cards and page errors printed.
// node tools/scratch/_worldcatshot.mjs [query]   (default worldcat=1)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'worldcat=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
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
        cards: [...document.querySelectorAll('#menu .card, #menu .cat')].map((card) =>
          [...card.querySelectorAll('span')].map((span) => span.textContent).join(' / ')) }));
      await page.screenshot({ path: `tools/scratch/_worldcatshot-${step}-${width}x${height}.png` });
      console.log(width, step, JSON.stringify(seen));
    };
    await tap('TEST MODE');
    await shot('types');
    await tap('WORLD CIRCUITS');
    await shot('world');
    await tap('TYPES');
    await tap('CIRCUITS');
    await shot('circuits');
    console.log(errors.length ? `ERRORS ${errors.join(' | ')}` : 'errors none');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

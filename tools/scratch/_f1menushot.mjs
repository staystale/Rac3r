// _f1menushot.mjs - TEST MODE with F1 vs WORLD (?f1menu=1): the types screen, the F1 CIRCUITS,
// WORLD CIRCUITS and CIRCUITS lists (Spa once; Sillystone GP under F1, National under
// CIRCUITS), at 390x844 and
// 844x390; shots <dir>/f1menu-<step>-<w>x<h>.png, the cards and page errors printed.
// node tools/scratch/_f1menushot.mjs <dir> [query]   (default f1menu=1)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [dir = 'tools/scratch', query = 'f1menu=1'] = process.argv.slice(2);
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
      await page.locator('#menu button', { hasText: new RegExp('^(◀ )?' + text) }).first().tap();
      await page.waitForTimeout(900);
    };
    const shot = async (step) => {
      const seen = await page.evaluate(() => ({
        title: document.querySelector('#menu h2')?.textContent,
        cards: [...document.querySelectorAll('#menu .card, #menu .cat')].map((card) =>
          [...card.querySelectorAll('span')].map((span) => span.textContent).join(' / ')) }));
      await page.screenshot({ path: `${dir}/f1menu-${step}-${width}x${height}.png` });
      console.log(width, step, JSON.stringify(seen));
    };
    await tap('TEST MODE');
    await shot('types');
    if (query.includes('f1menu=1')) {
      await tap('F1 CIRCUITS');
      await shot('f1');
      await tap('TYPES');
    }
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

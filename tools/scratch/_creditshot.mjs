// _creditshot.mjs - the main menu and the CREDITS screen at both phone sizes (?credits=1): shots
// _creditshot-<menu|credits>-<w>x<h>.png, whether the buttons fit, page errors.
// node tools/scratch/_creditshot.mjs [query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [query = 'credits=1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&noaudio=1&${query}`);
    await page.waitForTimeout(2500);
    const inView = () => page.evaluate(() => [...document.querySelectorAll('#menu button')]
      .map((button) => { const box = button.getBoundingClientRect();
        return `${button.textContent.trim().slice(0, 12)} ${box.top >= 0 && box.bottom <= innerHeight
          && box.left >= 0 && box.right <= innerWidth ? 'in' : 'OUT'}`; }).join(', '));
    await page.screenshot({ path: `tools/scratch/_creditshot-menu-${width}x${height}.png` });
    console.log(`${width}x${height} menu: ${await inView()}`);
    const credits = page.locator('#menu button', { hasText: 'CREDITS' });
    if (await credits.count()) {
      await page.waitForTimeout(600);
      await credits.first().tap();
      await page.waitForTimeout(800);
      const pane = await page.evaluate(() => { const el = document.querySelector('#menu .pane');
        return { scrollH: el.scrollHeight, clientH: el.clientHeight,
          links: document.querySelectorAll('#menu .pane a').length }; });
      await page.screenshot({ path: `tools/scratch/_creditshot-credits-${width}x${height}.png` });
      console.log(`${width}x${height} credits: ${JSON.stringify(pane)}`);
      await page.locator('#menu button', { hasText: 'BACK' }).first().tap();
      await page.waitForTimeout(800);
      console.log(`${width}x${height} back: ${await inView()}`);
    }
    console.log(errors.length ? `ERRORS ${errors.join(' | ')}` : 'errors none');
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

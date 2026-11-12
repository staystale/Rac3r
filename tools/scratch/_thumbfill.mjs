// _thumbfill.mjs - THE MENU'S TRACK PICTURES ON A SLOW LINK (scratch): every shipped thumbnail held
// DELAY_MS (as over the tunnel on a phone), TEST MODE opened at once, and the category cards'
// pictures counted - drawn (any pixel not the empty place's) and empty - just after and once they
// have all come. node tools/scratch/_thumbfill.mjs [query]   (CHECK_PORT; one browser)
import fs from 'node:fs';
import { startServer, launchBrowser } from '../lib/browser.mjs';

const [query = ''] = process.argv.slice(2);
// ms each thumbnail is held back; ms after TEST MODE opens the first count is taken
const DELAY_MS = 3000, EARLY_MS = 600;
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 440, height: 738 } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message).split('\n')[0]));
  await page.route('**/assets/thumbs/*.*', async (route) => {
    await new Promise((done) => setTimeout(done, DELAY_MS));
    await route.continue();
  });
  await page.goto(`${server.url}/?menu=1&guide=0&noaudio=1&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 90000 });
  await page.waitForTimeout(500);
  await page.getByText('TEST MODE', { exact: false }).first().click();
  await page.waitForSelector('#menu .cat .strip', { state: 'attached', timeout: 10000 });
  const count = () => page.evaluate(() => {
    let drawn = 0, empty = 0, cards = 0;
    for (const strip of document.querySelectorAll('#menu .cat .strip')) {
      cards++;
      for (const canvas of strip.querySelectorAll('canvas')) {
        const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let isDrawn = false;
        for (let i = 3; i < data.length; i += 4 * 97) if (data[i]) { isDrawn = true; break; }
        if (isDrawn) drawn++; else empty++;
      }
    }
    return { cards, drawn, empty };
  });
  await page.waitForTimeout(EARLY_MS);
  const early = await count();
  await page.screenshot({ path: 'tools/scratch/_thumbfill-early.png' });
  await page.waitForTimeout(DELAY_MS + 3000);
  const late = await count();
  await page.screenshot({ path: 'tools/scratch/_thumbfill-late.png' });
  console.log(`query '${query}': just after ${JSON.stringify(early)}, once they came`
    + ` ${JSON.stringify(late)}; errors ${errors.length ? errors.slice(0, 3).join(' | ') : 'none'}`);
  fs.writeFileSync('tools/scratch/_thumbfill-last.json', JSON.stringify({ early, late }));
} finally {
  await browser.close();
  server.stop();
}

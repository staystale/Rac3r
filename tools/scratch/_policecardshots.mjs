// _policecardshots.mjs - THE POLICE CARD of the highway's rules walkthrough (?hwparked=1, guide.ts
// POLICE_CARD) photographed at 390x844 and 844x390: the endless road (solo) with ?rules=1, NEXT
// tapped to the last card; prints the card count. Writes <OUT>/police-card-<W>x<H>.png.
// [OUT=dir] [QUERY=&hwparked=1] CHECK_PORT=8092 node tools/scratch/_policecardshots.mjs
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const OUT = process.env.OUT || 'tools/scratch/_policecard';
const QUERY = process.env.QUERY ?? '&hwparked=1';
mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [width, height] of [[390, 844], [844, 390]]) {
    const page = await (await browser.newContext({ viewport: { width, height },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=1&rules=1&noaudio=1${QUERY}`);
    await page.waitForTimeout(2500);
    await page.evaluate(() => window.__game.menu.hide());
    await page.evaluate(() => window.__game.launch('highway', 'saloon-rwd', { ai: 0,
      traffic: 0.6 }));
    await page.waitForTimeout(4000);
    const count = await page.evaluate(() => window.__game.guide.count);
    for (let card = 0; card < count; card++) {
      if (card === count - 1) break;
      const next = await page.evaluate(() => window.__game.guide.last?.nextB);
      if (!next) break;
      await page.touchscreen.tap(next.x + next.w / 2, next.y + next.h / 2);
      await page.waitForTimeout(350);
    }
    await page.screenshot({ path: `${OUT}/police-card-${width}x${height}.png` });
    console.log(`${width}x${height}: ${count} cards, the last photographed; page errors: `
      + (errors.length ? errors.slice(0, 2).join(' | ') : 'none'));
  }
} finally {
  await browser.close();
  server.stop();
}

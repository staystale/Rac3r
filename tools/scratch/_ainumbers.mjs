// _ainumbers.mjs - K10 (owner 11-01): AI race numbers random 2-99, never yours, painted on.
// Castle Cum, 5 AI, your car #7: the numbers dealt in 3 launches; a photo of the grid. ?ainumbers=1.
// node tools/scratch/_ainumbers.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const [w, h] of [[844, 390], [390, 844]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
    await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&ainumbers=1`);
    const deals = [];
    for (let k = 0; k < 3; k++) {
      await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
        { ai: 5, livery: { num: 7 } }));
      await page.mouse.click(w / 2, h / 2);
      await page.waitForTimeout(1500);
      deals.push(await page.evaluate(() => 'you ' + window.__game.car.spec.num + ': '
        + window.__game.ai.map((e) => e.car.num + '/' + e.car.spec.num).join(' ')));
    }
    console.log(w + 'x' + h, deals.join(' | '));
    await page.waitForTimeout(2500);
    await page.evaluate(() => { window.__game.renderer.debugZoom?.(0.9); });
    await page.waitForTimeout(800);
    await page.screenshot({ path: `tools/scratch/_ainumbers-${w}.png` });
    await page.close();
  }
} finally { await browser.close(); server.stop(); }

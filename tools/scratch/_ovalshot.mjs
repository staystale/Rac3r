// _ovalshot.mjs - photos of an oval race with a full grid (owner 11-04: grooves worn in the grass of
// the stock car oval): the real game, the player on autopilot, the camera zoomed out, a shot at each
// time given (s after launch), the phone's portrait size. Saved to tools/scratch/_ovalshot-<t>.png.
// node tools/scratch/_ovalshot.mjs [level] [ai] [zoom] [times,comma] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [level = 'stock-car', aiArg = '20', zoomArg = '0.22', timesArg = '35,70', query = ''] = process.argv.slice(2);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await gotoGame(page, srv.url + '/?pc=1&guide=0&menu=0&noaudio=1&autopilot=1' + (query ? '&' + query : ''));
  await page.mouse.click(200, 400);
  await page.waitForTimeout(2500);
  await page.evaluate(([lv, ai]) => window.__game.launch(lv, window.__game.car.spec.id, { ai, diff: 2 }), [level, +aiArg]);
  for (const at of timesArg.split(',').map(Number)) {
    await page.waitForFunction((tt) => window.__game.start.t >= tt, at, { timeout: 300000, polling: 500 });
    await page.evaluate((z) => window.__game.renderer.debugZoom(z), +zoomArg);
    await page.waitForTimeout(600);
    const path = `tools/scratch/_ovalshot-${at}.png`;
    await page.screenshot({ path });
    console.log('saved', path);
    await page.evaluate(() => window.__game.renderer.debugZoom(null));
  }
} finally {
  await browser.close();
  srv.stop();
}

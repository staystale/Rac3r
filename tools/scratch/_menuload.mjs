// _menuload.mjs - THE MENU'S FIRST LOAD (owner's phone after every update: no saved thumbnails):
// a fresh page at phone size, ms from opening it to the main menu's TEST MODE button, then from
// the TEST MODE tap to the category list (OVALS), then the game's own load time (shared.loadMs) and
// the thumbnails painted. CPU x4 (CPU=1 for none). The laptop's other load counts too.
// [CPU=4] [RUNS=1] node tools/scratch/_menuload.mjs
import { startServer, launchBrowser } from '../lib/browser.mjs';
const CPU = +(process.env.CPU || 4), RUNS = +(process.env.RUNS || 1);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (let run = 0; run < RUNS; run++) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    const t0 = Date.now();
    await page.goto(`${server.url}/?touch=1&menu=1&guide=0&noaudio=1`);
    await page.locator('#menu button', { hasText: 'TEST MODE' }).first()
      .waitFor({ state: 'visible', timeout: 300000 });
    const menuAt = Date.now() - t0;
    await page.waitForTimeout(800);
    const t1 = Date.now();
    await page.locator('#menu button', { hasText: 'TEST MODE' }).first().tap();
    await page.locator('#menu button', { hasText: 'OVALS' }).first()
      .waitFor({ state: 'visible', timeout: 300000 });
    const catsAt = Date.now() - t1;
    const game = await page.evaluate(() => ({ levels: (window.__game.levels || []).length }));
    console.log(`run ${run + 1} (CPU x${CPU}): menu up ${menuAt} ms, TEST MODE -> types ${catsAt} ms`
      + (game.levels ? `, ${game.levels} levels` : ''));
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

// _rainrepaint.mjs - why the highway repaints more ground tiles in the rain: 20 s of the highway
// autopilot, dry vs rain, counting tiles painted, stale repaints (worn ground changed under them)
// and the wear cells marked changed, and by what (a dry line, a cover, a base change).
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const query of ['rain=0', 'rain=0.45']) {
    const context = await browser.newContext({ viewport: { width: 440, height: 732 },
      deviceScaleFactor: 3, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    page.on('pageerror', (error) => console.log('ERROR ' + error));
    await gotoGame(page, `${server.url}/?menu=0&guide=0&rules=0&level=highway&autopilot=1&${query}`);
    await page.waitForTimeout(1500);
    await page.touchscreen.tap(220, 366);
    await page.waitForTimeout(6000);
    const result = await page.evaluate(async () => {
      const wear = await import('/src/world/wear.ts');
      const renderer = window.__game.renderer;
      const counts = { dirty: 0, cells: wear.wearMap.size };
      const push = wear.wearDirty.push.bind(wear.wearDirty);
      wear.wearDirty.push = (...cells) => { counts.dirty += cells.length; return push(...cells); };
      const before = { painted: renderer.groundRenders, stale: renderer.staleRepaints };
      await new Promise((done) => setTimeout(done, 20000));
      return { painted: renderer.groundRenders - before.painted,
        stale: renderer.staleRepaints - before.stale, dirtyCells: counts.dirty,
        wearCells: wear.wearMap.size, km: Math.round((window.__game.hwDist || 0)) };
    });
    console.log(query.padEnd(10), JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

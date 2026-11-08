// _benchwatch.mjs - the Festival of Splat opened as the owner will (?level=crash-bench&menu=0):
// photos as the field hits the wall, the frame counter, page errors.
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '390x844').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&noaudio=1&menu=0&level=crash-bench${extraQuery()}`);
  await page.waitForTimeout(1500);
  // the 'tap to drive' card, as on the phone
  await page.touchscreen.tap(viewW / 2, viewH / 2);
  await page.evaluate(() => window.__game.restart());
  let last = 0;
  for (const at of [0.8, 1.6, 2.4, 4, 7]) {
    await page.waitForTimeout((at - last) * 1000);
    last = at;
    const state = await page.evaluate(() => {
      const game = window.__game;
      return `level ${game.level.id}, ${game.ai.length} AI, you ${Math.hypot(game.car.vx, game.car.vy)
        .toFixed(0)} m/s at ${game.car.y.toFixed(0)}, loose ${game.cones.list.length}`;
    });
    await page.screenshot({ path: `tools/scratch/_benchwatch-${at}s-${viewW}x${viewH}${process.env.TAG || ''}.png` });
    console.log(`+${at} s: ${state}`);
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

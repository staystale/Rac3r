// _smokeshot.mjs - the player's car sliding sideways on the track under a bridge, smoking its
// tyres: the smoke must stay under the deck. node tools/scratch/_smokeshot.mjs [level] [bridge]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [level = 'brands-snatch', pick = '1'] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}&crossings=1`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate((lv) => window.__game.launch(lv, window.__game.car.spec.id, { ai: 0 }), level);
  await page.waitForTimeout(2500);
  await page.evaluate((index) => {
    const game = window.__game, way = game.level.crossings.filter((c) => c.kind === 'bridge')[+index];
    const sub = game.level.subtrack, midX = way.ax + way.dirX * way.length / 2;
    const midY = way.ay + way.dirY * way.length / 2;
    const near = sub.pts.reduce((best, p) => (Math.hypot(p.x - midX, p.y - midY)
      < Math.hypot(best.x - midX, best.y - midY) ? p : best), sub.pts[0]);
    // across the track under the deck, sliding sideways with the tyres hot
    const car = game.car;
    Object.assign(car, { x: near.x - Math.cos(near.heading) * 8, y: near.y - Math.sin(near.heading) * 8,
      heading: near.heading + 1.2, vx: Math.cos(near.heading) * 18, vy: Math.sin(near.heading) * 18,
      yawRate: 1.5, crossing: -1 });
    if (car.tyreT) car.tyreT = car.tyreT.map(() => 150);
  }, pick);
  await page.evaluate(() => window.__game.renderer.debugZoom(0.8));
  for (const at of [0.35, 0.8]) {
    await page.waitForTimeout(at === 0.35 ? 350 : 450);
    await page.screenshot({ path: `tools/scratch/_smokeshot-${level}-${pick}-${at}s.png` });
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

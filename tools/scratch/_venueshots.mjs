// _venueshots.mjs - a venue level's overview picture plus close shots at phone size, with the page
// errors and the load time: _venueshot-<level>-*.png. node tools/scratch/_venueshots.mjs <level>
// [query] [spots: "dist,dist,..." metres along the lap for close shots]
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const [level = 'brands-snatch', query = 'bigbrands=1', spotList = ''] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.45);
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const t0 = Date.now();
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate((lv) => window.__game.launch(lv, window.__game.car.spec.id, { ai: 0 }), level);
  await page.waitForTimeout(2500);
  console.log('ready in', Date.now() - t0, 'ms');
  const url = await page.evaluate(() => {
    window.__game.selectLevel(window.__game.level.id);
    return window.__game.renderer.thumbnail(1600).toDataURL();
  });
  fs.writeFileSync(`tools/scratch/_venueshot-${level}-overview.png`, Buffer.from(url.split(',')[1], 'base64'));
  const info = await page.evaluate(() => {
    const lv = window.__game.level;
    return { lap: lv.subtrack.totalDist, props: lv.props.length, cones: lv.cones.length };
  });
  console.log(JSON.stringify(info));
  // a spot is metres along the lap, or x:y in the world
  for (const spot of spotList ? spotList.split(',') : []) {
    await page.evaluate((where) => {
      const game = window.__game, sub = game.level.subtrack;
      let best = sub.pts[0];
      if (where.includes(':')) {
        const [wx, wy] = where.split(':').map(Number);
        best = { x: wx, y: wy, heading: 0 };
      } else for (const point of sub.pts) if (point.dist <= +where) best = point;
      Object.assign(game.car, { x: best.x, y: best.y, heading: best.heading, vx: 0, vy: 0 });
    }, spot);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    await page.waitForTimeout(+(process.env.WAIT || 1500));
    await page.screenshot({ path: `tools/scratch/_venueshot-${level}-d${spot.replace(":", "_")}-${viewW}x${viewH}.png` });
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

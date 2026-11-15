// _hjfirshots.mjs - HOLY JEEZ MOSTLY FIRS photographed: the level launched with no AI in a fixed
// season (dry), the car parked at lap spots, the view zoomed out; summer and autumn by day, and
// night (?night=0.94), each off and on (?hjfirs=1), at the screen size of VIEW. Also a far view of
// the forest round the car (FAR_ZOOM) and of the whole level (WHOLE_ZOOM).
// Writes <out>/<view>-<light>-<spot>-<off|on>.png.
// node tools/scratch/_hjfirshots.mjs <out dir> [spots "dist,dist" m along the lap]  (env VIEW,
// ZOOM, FAR_ZOOM, FAR_SPOT, WHOLE_ZOOM)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [outDir, spotList = '300,700'] = process.argv.slice(2);
const ZOOM = +(process.env.ZOOM || 0.45);
const FAR_ZOOM = +(process.env.FAR_ZOOM || 0.14);
const FAR_SPOT = process.env.FAR_SPOT || '500';
const WHOLE_ZOOM = +(process.env.WHOLE_ZOOM || 0.05);
// the lights: [name, the season (2 summer, 3 autumn), query]
const LIGHTS = [['summer', 2, 'night=0'], ['autumn', 3, 'night=0'], ['night', 2, 'night=0.94']];
const SIDES = [['off', ''], ['on', '&hjfirs=1']];
fs.mkdirSync(outDir, { recursive: true });

/**
 * Parks the car at a lap distance and zooms the view.
 * @param {import('playwright').Page} page the game page
 * @param {number} dist m along the lap
 * @param {number} zoom the view's zoom
 */
async function parkAt(page, dist, zoom) {
  await page.evaluate(([where, view]) => {
    const game = window.__game, sub = game.level.subtrack;
    let best = sub.pts[0];
    for (const point of sub.pts) if (point.dist <= where) best = point;
    Object.assign(game.car, { x: best.x, y: best.y, heading: best.heading, vx: 0, vy: 0 });
    game.renderer.debugZoom(view);
  }, [dist, zoom]);
  await page.waitForTimeout(1500);
}

const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  for (const [light, season, lightQuery] of LIGHTS) {
    for (const [side, sideQuery] of SIDES) {
      const context = await browser.newContext({ viewport: { width: viewW, height: viewH } });
      const page = await context.newPage();
      page.on('pageerror', (err) => errors.push(`${light}/${side}: ${err.message}`));
      await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=holyjeez`
        + `&${lightQuery}${sideQuery}`);
      await page.mouse.click(viewW / 2, viewH / 2);
      await page.waitForTimeout(1200);
      await page.evaluate((plan) => window.__game.launch('holyjeez', window.__game.car.spec.id,
        { ai: 0, weather: plan }), { mode: 'dry', season });
      await page.waitForTimeout(3000);
      const tag = `${viewW}x${viewH}-${light}`;
      for (const spot of spotList.split(',')) {
        await parkAt(page, +spot, ZOOM);
        await page.screenshot({ path: `${outDir}/${tag}-d${spot}-${side}.png` });
      }
      await parkAt(page, +FAR_SPOT, FAR_ZOOM);
      await page.screenshot({ path: `${outDir}/${tag}-far-${side}.png` });
      await parkAt(page, +FAR_SPOT, WHOLE_ZOOM);
      await page.screenshot({ path: `${outDir}/${tag}-whole-${side}.png` });
      await context.close();
    }
  }
  console.log(errors.length ? `ERRORS ${errors.slice(0, 5).join(' | ')}` : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

// _crosswatch.mjs - THE FIELD AT A CROSSOVER (scratch): a race with the full field, the player
// parked beside the lap's underpass (Subtrack.under) - every AI car within REACH m of it logged
// each WATCH_MS (its crossing, its lap distance, which leg its lap distance says), and a photo
// whenever a car is on the under leg there. OUT/<level>-watch-<n>-<view>.png
// node tools/scratch/_crosswatch.mjs level [query]   (env VIEW, OUT, ZOOM, SECONDS)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [level = 'suzuka', query = ''] = process.argv.slice(2);
const OUT = process.env.OUT || 'shots/watch', ZOOM = +(process.env.ZOOM || 0.5);
const SECONDS = +(process.env.SECONDS || 90), REACH = 30, WATCH_MS = 250;
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const page = await (await browser.newContext({ viewport: { width: viewW, height: viewH } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate(([lv, hour]) => window.__game.launch(lv, window.__game.car.spec.id,
    { ai: 7, laps: 9, ...(hour ? { time: +hour } : {}) }), [level, process.env.HOUR || '']);
  await page.waitForTimeout(2500);
  const mid = await page.evaluate(async (zoom) => {
    const game = window.__game, way = (game.level.crossings || []).find((one) => one.track);
    const x = way.ax + way.dirX * way.length / 2, y = way.ay + way.dirY * way.length / 2;
    const { reset } = await import('/src/vehicle.ts');
    // the player parked 30 m off to the side of the underpass's middle (out of the way)
    reset(game.car, x - way.dirY * 30, y + way.dirX * 30, 0);
    game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 1, reverse: 0,
      shiftUp: false, shiftDown: false });
    game.renderer.debugZoom(zoom);
    return [x, y];
  }, ZOOM);
  let shots = 0, logged = 0;
  for (let tick = 0; tick < SECONDS * 1000 / WATCH_MS; tick++) {
    await page.waitForTimeout(WATCH_MS);
    const near = await page.evaluate(([x, y, reach]) => window.__game.ai.map((entry) => entry.car)
      .filter((car) => Math.hypot(car.x - x, car.y - y) < reach)
      .map((car) => ({ crossing: car.crossing ?? -1, prog: Math.round(((car._prog ?? 0) %
        window.__game.level.subtrack.totalDist)), at: [Math.round(car.x), Math.round(car.y)],
        z: +(car.z ?? 0).toFixed(1) })), [...mid, REACH]);
    if (!near.length) continue;
    if (logged++ < 60) console.log(tick, JSON.stringify(near));
    if (near.some((car) => car.crossing >= 0) && shots < 6)
      await page.screenshot({ path: `${OUT}/${level}-watch-${shots++}-${viewW}x${viewH}.png` });
  }
  console.log('photos', shots);
  console.log('darkness', await page.evaluate(async () => (await import('/src/world/daylight.ts')).DAYLIGHT.darkness), 'gl', await page.evaluate(() => !!document.getElementById('glground')));
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

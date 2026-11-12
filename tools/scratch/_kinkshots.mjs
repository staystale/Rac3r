// _kinkshots.mjs - A LAP'S SHARPEST KINKS (scratch): the heading change from one lap point to the
// next (sub.pts, no smoothing - kerbside.mjs reads the smoothed turn and misses a sharp join), the
// worst KINKS of them at least 40 m apart, each photographed at phone size with the car parked on
// it (as _birdsmessshots.mjs parks it). Owner 11-12: "some dodgey line / track tarmac corner" on a
// stadium. node tools/scratch/_kinkshots.mjs <level> [query]  (env KINKS, ZOOM, OUT; CHECK_PORT)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [level = 'stadeprance', query = 'x=0'] = process.argv.slice(2);
const KINKS = +(process.env.KINKS || 5), ZOOM = +(process.env.ZOOM || 0.6);
const OUT = process.env.OUT || `shots/kinks-${level}`;
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=${level}&${query}`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(1500);
  await page.evaluate((lv) => window.__game.launch(lv, window.__game.car.spec.id,
    { ai: 0, laps: 1 }), level);
  await page.waitForTimeout(2500);
  const kinks = await page.evaluate((count) => {
    const pts = window.__game.level.subtrack.pts, found = [];
    const turns = pts.slice(1).map((point, index) => {
      const before = pts[index];
      const turn = Math.atan2(Math.sin(point.heading - before.heading),
        Math.cos(point.heading - before.heading));
      const stepM = Math.hypot(point.x - before.x, point.y - before.y);
      return { dist: point.dist, x: point.x, y: point.y, heading: point.heading, stepM,
        degPerM: Math.abs(turn) * 180 / Math.PI / Math.max(stepM, 0.01),
        deg: Math.abs(turn) * 180 / Math.PI };
    });
    turns.sort((first, second) => second.deg - first.deg);
    for (const turn of turns) {
      if (found.length >= count) break;
      if (found.every((other) => Math.hypot(other.x - turn.x, other.y - turn.y) > 40)) found.push(turn);
    }
    return found;
  }, KINKS);
  for (const kink of kinks) {
    console.log(`kink at ${kink.dist.toFixed(0)} m (${kink.x.toFixed(1)}, ${kink.y.toFixed(1)}):`
      + ` ${kink.deg.toFixed(1)} deg over ${kink.stepM.toFixed(1)} m`);
    await page.evaluate(async (where) => {
      const game = window.__game, { reset } = await import('/src/vehicle.ts');
      game.car.crossing = -1;
      reset(game.car, where.x, where.y, where.heading);
      game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
        shiftUp: false, shiftDown: false });
    }, kink);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/${level}-kink-${kink.dist.toFixed(0)}-844x390.png` });
  }
  console.log('errors', errors.length ? errors.join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

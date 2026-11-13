// _jokermouthshots.mjs - THE JOKER'S WAY IN AND OUT, photographed (scratch): the car parked on the
// joker lane's first and last points and a third of the way in, zoomed out, so bales or tyres
// across the branch show. node tools/scratch/_jokermouthshots.mjs <level> [query] (env ZOOM, OUT;
// AT: the lane's point indexes to park on, comma separated, instead)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [level = 'xgayms', query = 'x=0'] = process.argv.slice(2);
const AT = (process.env.AT || '').split(',').filter(Boolean).map(Number);
const ZOOM = +(process.env.ZOOM || 0.45), OUT = process.env.OUT || `shots/jokermouth-${level}`;
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
  const spots = await page.evaluate((indexes) => {
    const pts = window.__game.level.lanes[0].pts, count = pts.length;
    const at = (index, name) => {
      const point = pts[index], next = pts[Math.min(index + 1, count - 1)];
      const before = pts[Math.max(index - 1, 0)];
      return { name, x: point[0], y: point[1],
        heading: Math.atan2(next[1] - before[1], next[0] - before[0]) };
    };
    if (indexes.length) return indexes.map((index) => at(index, `p${index}`));
    return [at(4, 'in'), at(Math.floor(count / 3), 'third'), at(count - 5, 'out')];
  }, AT);
  for (const spot of spots) {
    await page.evaluate(async (where) => {
      const game = window.__game, { reset } = await import('/src/vehicle.ts');
      game.car.crossing = -1;
      reset(game.car, where.x, where.y, where.heading);
      game.input.update = () => ({ throttle: 0, brake: 1, steer: 0, handbrake: 0, reverse: 0,
        shiftUp: false, shiftDown: false });
    }, spot);
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    await page.waitForTimeout(900);
    const file = `${OUT}/${level}-joker-${spot.name}-844x390.png`;
    await page.screenshot({ path: file });
    console.log(spot.name, spot.x.toFixed(1), spot.y.toFixed(1), file);
  }
  console.log('errors', errors.length ? errors.join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

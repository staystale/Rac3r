// _underdrive.mjs - THE LAP'S OWN UNDERPASS DRIVEN THROUGH (scratch): the player put on the lap 40 m
// before each underpass span (Subtrack.under) and driven on by the demo driver; a photo every
// SHOT_S while it is in the cut / under the road over, its level printed - and the same from the
// road over (40 m before the crossing point). OUT/<level>-under-<n>-<view>.png
// node tools/scratch/_underdrive.mjs level [query]   (env VIEW, OUT, ZOOM)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [level = 'suzuka', query = ''] = process.argv.slice(2);
const OUT = process.env.OUT || 'shots/under', ZOOM = +(process.env.ZOOM || 0.55);
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
    { ai: 0, laps: 1, ...(hour ? { time: +hour } : {}) }), [level, process.env.HOUR || '']);
  await page.waitForTimeout(2500);
  const spans = await page.evaluate(() => (window.__game.level.subtrack.under || []).map((span) =>
    ({ d0: span.d0, d1: span.d1, over: span.over })));
  console.log(level, 'underpass spans', JSON.stringify(spans.map((s) => [Math.round(s.d0), Math.round(s.d1), Math.round(s.over)])));
  for (const [leg, distOf] of [['under', (s) => s.d0 - 40], ['over', (s) => s.over - 40]]) {
    const span = spans[0];
    if (!span) break;
    await page.evaluate(async (at) => {
      const game = window.__game, sub = game.level.subtrack;
      let best = sub.pts[0];
      for (const point of sub.pts) if (point.dist <= at) best = point;
      const { reset } = await import('/src/vehicle.ts');
      reset(game.car, best.x, best.y, best.heading);
      game.car.lightsOn = true;
      Object.assign(game.car, { vx: 14 * Math.cos(best.heading), vy: 14 * Math.sin(best.heading) });
      const auto = await import('/src/ai/autodrive.ts');
      const driver = auto.createAutoDriver(sub);
      game.input.update = () => ({ ...driver.drive(game.car), throttle: 0.5, reverse: 0,
        shiftUp: false, shiftDown: false });
    }, distOf(span));
    await page.evaluate((zoom) => window.__game.renderer.debugZoom(zoom), ZOOM);
    for (let shot = 0; shot < 6; shot++) {
      await page.waitForTimeout(700);
      const state = await page.evaluate(() => ({ crossing: window.__game.car.crossing ?? -1,
        at: [Math.round(window.__game.car.x), Math.round(window.__game.car.y)] }));
      console.log(leg, shot, JSON.stringify(state));
      await page.screenshot({ path: `${OUT}/${level}-${leg}-${shot}-${viewW}x${viewH}.png` });
    }
  }
  console.log('darkness', await page.evaluate(async () => (await import('/src/world/daylight.ts')).DAYLIGHT.darkness), 'gl', await page.evaluate(() => !!document.getElementById('glground')));
  console.log(errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

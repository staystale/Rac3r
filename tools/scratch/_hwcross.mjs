// _hwcross.mjs - THE ENDLESS ROAD'S UNDERPASSES AT NIGHT (scratch): the highway driven by the demo
// driver at night with the lights on; whenever a straight tunnel crossing (an underpass under the
// motorway, streamed: highway/bridgeways.ts) has its middle within REACH m, a photo (one each).
// node tools/scratch/_hwcross.mjs tag query   (env VIEW, OUT, SECONDS, HOUR)
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [tag = 'x', query = ''] = process.argv.slice(2);
const OUT = process.env.OUT || 'shots/hwcross', SECONDS = +(process.env.SECONDS || 150);
const REACH = 25;
fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
  const page = await (await browser.newContext({ viewport: { width: viewW, height: viewH } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&noaudio=1&level=highway&traffic=0&${query}`);
  await page.mouse.click(viewW / 2, viewH / 2);
  await page.waitForTimeout(1500);
  await page.evaluate((hour) => window.__game.launch('highway', window.__game.car.spec.id,
    { ai: 0, traffic: 0, time: hour }), +(process.env.HOUR || 23));
  await page.waitForTimeout(2500);
  await page.evaluate(async () => {
    const game = window.__game, auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(game.level.subtrack);
    game.car.lightsOn = true;
    game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false,
      shiftDown: false });
  });
  const seen = new Set();
  for (let tick = 0; tick < SECONDS * 4; tick++) {
    await page.waitForTimeout(250);
    // (on a rail: the car put 12 m on along the streamed road each tick, at speed)
    await page.evaluate(() => {
      const game = window.__game, pts = game.level.subtrack.pts;
      let best = 0, bestD = Infinity;
      for (let i = 0; i < pts.length; i++) {
        const dist = (pts[i].x - game.car.x) ** 2 + (pts[i].y - game.car.y) ** 2;
        if (dist < bestD) { bestD = dist; best = i; }
      }
      let next = best;
      while (next + 1 < pts.length && pts[next].dist - pts[best].dist < 12) next++;
      const point = pts[next], lane = 5;
      Object.assign(game.car, { x: point.x + point.nx * lane, y: point.y + point.ny * lane,
        heading: point.heading, vx: 30 * Math.cos(point.heading), vy: 30 * Math.sin(point.heading),
        yawRate: 0 });
    });
    const near = await page.evaluate((reach) => {
      const game = window.__game;
      return (game.level.crossings || []).map((way, i) => ({ i, kind: way.kind,
        x: way.ax + way.dirX * way.length / 2, y: way.ay + way.dirY * way.length / 2,
        under: way.kind === 'tunnel' && !way.hidden && way.length > 2 * way.cut }))
        .filter((way) => Math.hypot(way.x - game.car.x, way.y - game.car.y) < reach)
        .map((way) => `${way.kind}${way.under ? '-underground' : ''}@${Math.round(way.x)},${Math.round(way.y)}`);
    }, REACH);
    for (const key of near) {
      if (seen.has(key) || seen.size >= 6) continue;
      seen.add(key);
      await page.screenshot({ path: `${OUT}/hw-${seen.size}-${tag}-${viewW}x${viewH}.png` });
      console.log(tag, seen.size, key);
    }
  }
  console.log('drove to', await page.evaluate(() => [Math.round(window.__game.car.x), Math.round(window.__game.car.y), (window.__game.level.crossings || []).map((way) => way.kind + Math.round(way.length)).join(' ')]));
  console.log('seen', seen.size, errors.length ? 'ERRORS ' + errors.slice(0, 2).join(' | ') : 'errors none');
} finally {
  await browser.close();
  server.stop();
}

// _impactsparks.mjs - sparks from a big metal-on-metal crash (?impactsparks=1): the car driven
// head-on into the nearest armco on a level at 20 m/s (&hitspeed=N); did the hit read as metal, photos burst
// just after the impact. node tools/scratch/_impactsparks.mjs <out> [level] [query]
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const out = process.argv[2] || '.', level = process.argv[3] || 'castle-cum';
const query = process.argv[4] ?? '&impactsparks=1';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(300);
  const res = await page.evaluate(async (id) => {
    const game = window.__game;
    game.launch(id, 'hatch-rwd', { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } });
    await new Promise((done) => setTimeout(done, 2500));
    const car = game.car;
    let best = null, bestD = Infinity;
    const LEVEL = game.level;
    for (const barrier of LEVEL.barriers) {
      if (barrier.kind !== 'armco') continue;
      for (const [x, y] of barrier.pts) {
        const dist = Math.hypot(x - car.x, y - car.y);
        if (dist > 20 && dist < bestD) { bestD = dist; best = [x, y]; }
      }
    }
    if (!best) return { error: 'no armco', kinds: [...new Set(LEVEL.barriers.map((b) => b.kind))] };
    const heading = Math.atan2(best[1] - car.y, best[0] - car.x);
    car.x = best[0] - Math.cos(heading) * 12; car.y = best[1] - Math.sin(heading) * 12;
    car.heading = heading; const hitSpeed = +(new URLSearchParams(location.search).get("hitspeed") || 20);
    car.vx = Math.cos(heading) * hitSpeed; car.vy = Math.sin(heading) * hitSpeed;
    car.yawRate = 0;
    game.renderer.debugZoom(1.4);
    // every damage event the crash queues, as the particles get it
    const queue = []; window.__impacts = [];
    queue.push = function (event) { window.__impacts.push({ ...event }); return Array.prototype.push.call(this, event); };
    car.dmgEvents = queue;
    return { at: best };
  }, level);
  for (const [i, wait] of [[0, 600], [1, 70], [2, 70], [3, 120]]) {
    await page.waitForTimeout(wait);
    await page.screenshot({ path: join(out, `impact-sparks-${i}.png`) });
  }
  const dmg = await page.evaluate(() => window.__game.car.dmg.map((d) => +d.toFixed(2)));
  const impacts = await page.evaluate(() => window.__impacts.filter((e) => !e.scrape).map((e) =>
    ({ amt: +e.amt.toFixed(3), metal: e.metal, kmh: Math.round((e.speed || 0) * 3.6) })));
  console.log(JSON.stringify(res), 'dmg', JSON.stringify(dmg), 'impacts', JSON.stringify(impacts));
  await context.close();
} finally { await browser.close(); server.stop(); }

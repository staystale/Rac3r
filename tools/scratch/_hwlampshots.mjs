// _hwlampshots.mjs - ?hwlamps=1: photographs the highway's street lights at ?night=0.8 and by day
// (844x390, 390x844) at the start and after 25 s of autopilot (the lamps streamed in ahead), then
// drives the car into a street light at 50 km/h and prints what the post did (lean / down) and
// the lamps loaded. node tools/scratch/_hwlampshots.mjs <out folder>
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const out = process.argv[2] || '.';
const server = await startServer();
const browser = await launchBrowser();

async function openHighway(query, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
    hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&${query}`);
  await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(4000);
  return { context, page };
}

try {
  for (const query of ['hwlamps=1&night=0.8', 'hwlamps=1']) {
    for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
      const { context, page } = await openHighway(query + '&autopilot=1', viewport);
      const tag = `${query.includes('night') ? 'night' : 'day'}-${viewport.width}`;
      await page.screenshot({ path: join(out, `hwlamps-${tag}-start.png`) });
      await page.waitForTimeout(25000);
      await page.screenshot({ path: join(out, `hwlamps-${tag}-25s.png`) });
      const count = await page.evaluate(async () =>
        (await import('/src/world/lamps.ts')).activeLamps().length);
      console.log('photos', tag, 'lamps loaded', count);
      await context.close();
    }
  }
  const { context, page } = await openHighway('hwlamps=1&night=0.8', { width: 844, height: 390 });
  const hit = await page.evaluate(async () => {
    const lamps = (await import('/src/world/lamps.ts')).activeLamps();
    const car = window.__game.car;
    const lamp = lamps.filter((item) => item.y < car.y - 30).sort((a, b) => b.y - a.y)[0];
    // 12 m short of the post, heading straight at it, 50 km/h
    car.x = lamp.x; car.y = lamp.y + 12; car.heading = -Math.PI / 2; car.vx = 0; car.vy = -13.9;
    car.yawRate = 0;
    await new Promise((done) => setTimeout(done, 2500));
    return { down: lamp.down, lean: Math.hypot(lamp.leanX, lamp.leanY).toFixed(2), level: lamp.level,
      speedAfter: Math.hypot(car.vx, car.vy).toFixed(1) };
  });
  console.log('hit at 50 km/h:', JSON.stringify(hit));
  await page.screenshot({ path: join(out, 'hwlamps-hit.png') });
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

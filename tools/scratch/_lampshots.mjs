// _lampshots.mjs - ?lamps=1: photographs Castle Cum's start straight by day and at ?night=0.8
// (844x390, 390x844), then drives the car into the first street light and the first Stock Car
// pylon at 40 km/h and prints where it stopped (a solid stops it). Temp folder.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();

async function openLevel(query, viewport, level) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 3, isMobile: true,
    hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&${query}`);
  await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
  await page.waitForTimeout(400);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
  await page.waitForTimeout(4000);
  return { context, page };
}

async function crash(level, pick) {
  const { context, page } = await openLevel('lamps=1', { width: 844, height: 390 }, level);
  const out = await page.evaluate(async (which) => {
    const lamps = (await import('/src/world/lamps.ts')).activeLamps();
    const lamp = lamps.find((item) => item.kind === which);
    const car = window.__game.car;
    // 12 m short of the post, heading straight at it, 40 km/h
    car.x = lamp.x - 12; car.y = lamp.y; car.heading = 0; car.vx = 11.1; car.vy = 0;
    car.yawRate = 0;
    await new Promise((done) => setTimeout(done, 2500));
    return { lampX: lamp.x, carX: car.x, gap: lamp.x - car.x, speed: Math.hypot(car.vx, car.vy) };
  }, pick);
  console.log(level, pick, JSON.stringify(out));
  await context.close();
}

try {
  for (const query of ['lamps=1', 'lamps=1&night=0.8']) {
    for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
      const { context, page } = await openLevel(query, viewport, 'castle-cum');
      await page.evaluate(() => window.__game.renderer.debugZoom(0.45));
      await page.waitForTimeout(1500);
      const name = `lamps-${query.includes('night') ? 'night' : 'day'}-${viewport.width}.png`;
      await page.screenshot({ path: join(tmpdir(), name) });
      console.log('photo', name);
      await context.close();
    }
  }
  await crash('castle-cum', 'street');
  await crash('stock-car', 'flood');
} finally {
  await browser.close();
  server.stop();
}

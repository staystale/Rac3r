// _sparkphone.mjs - sparks as the owner's phone shows them: 440x751 css at dpr 3 (the phone
// reports), Castle Cum at race speed on the autopilot, the front +y wheel on its rim; a burst of
// full-resolution crops round the car, 80 ms apart. node tools/scratch/_sparkphone.mjs <out> [query]
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const out = process.argv[2] || '.', query = process.argv[3] || '';
const server = await startServer();
const browser = await launchBrowser();
try {
  const size = { width: 440, height: 751 };
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=1${query}`);
  await page.touchscreen.tap(220, 375);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(9000);
  await page.evaluate(() => {
    const car = window.__game.car;
    car.tyreP = [1, 0, 1, 1]; car.onRim = [false, true, false, false]; car.tyreLeak = [0, 1, 0, 0];
  });
  await page.waitForTimeout(600);
  const info = [];
  for (let frame = 0; frame < 4; frame++) {
    const where = await page.evaluate(async () => {
      const game = window.__game, car = game.car, r = game.renderer;
      const { shared } = await import('/src/game/state.js');
      const keys = Object.keys(r).filter((k) => /chip|partic|PPM|art|block/i.test(k));
      const chips = r.chips || (r.particles && r.particles.chips) || [];
      return { sparks: JSON.stringify(car.rimSparks), speed: Math.hypot(car.vx, car.vy).toFixed(1),
        chips: chips.length, sparkChips: chips.filter((c) => c.spark).length,
        x: r.toScreenX ? r.toScreenX(car.x) : null, y: r.toScreenY ? r.toScreenY(car.y) : null,
        ppm: r.PPMz ? r.PPMz() : null, auto: shared.settings.autopilot, keys };
    });
    info.push(where);
    await page.screenshot({ path: join(out, `phone-sparks-${frame}.png`),
      clip: { x: 220 - 110, y: 375 - 110, width: 220, height: 220 } });
    await page.waitForTimeout(80);
  }
  console.log(JSON.stringify(info));
  await context.close();
} finally { await browser.close(); server.stop(); }

// _oilgrip.mjs - is the car's own surface oil when its rear axle stands on a spill?
// node tools/scratch/_oilgrip.mjs [level] [photo folder]   (the autopilot at 25 km/h: moving);
// with a folder, photos of a patch beside the stopped car at 844x390 and 390x844
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'castle-cum';
const shots = process.argv[3] || '';
const server = await startServer();
const browser = await launchBrowser();

async function open(size) {
  const context = await browser.newContext({ viewport: size, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page,
    `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=25`);
  await page.touchscreen.tap(size.width / 2, size.height / 2);
  await page.waitForTimeout(300);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
  await page.waitForTimeout(6000);
  return { context, page };
}

try {
  const { context, page } = await open({ width: 844, height: 390 });
  const res = await page.evaluate(async () => {
    const car = window.__game.car, oil = await import('/src/world/oil.ts');
    const wear = await import('/src/world/wear.ts');
    const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
    const rearX = car.x - cosH * car.spec.lr, rearY = car.y - sinH * car.spec.lr;
    for (let dx = -3; dx <= 9; dx += 1) for (let dy = -3; dy <= 3; dy += 1) {
      oil.spillOil(rearX + cosH * dx - sinH * dy, rearY + sinH * dx + cosH * dy, 3);
    }
    await new Promise((done) => setTimeout(done, 500));
    return { rear: wear.groundAt(rearX, rearY).surface.id, car: car.surface.id,
      mu: car.surface.mu, speed: Math.hypot(car.vx, car.vy).toFixed(2) };
  });
  console.log(JSON.stringify(res));
  await context.close();
  if (shots) {
    mkdirSync(shots, { recursive: true });
    for (const size of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
      const run = await open(size);
      // a crash-sized spill beside the car, which stops
      await run.page.evaluate(async () => {
        const game = window.__game, car = game.car, oil = await import('/src/world/oil.ts');
        const { shared } = await import('/src/game/state.js');
        shared.settings.autopilot = false;
        car.vx = 0; car.vy = 0;
        const cosH = Math.cos(car.heading), sinH = Math.sin(car.heading);
        for (const [along, side] of [[4, 0], [5.5, 0], [4, 1.5], [5.5, -1.5], [7, 0], [2.5, 1.5]]) {
          oil.spillOil(car.x + cosH * along - sinH * side, car.y + sinH * along + cosH * side, 3);
        }
        game.renderer.debugZoom(2.2);
      });
      await run.page.waitForTimeout(1500);
      await run.page.screenshot({ path: join(shots, `oil-${size.width}x${size.height}.png`) });
      await run.context.close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}

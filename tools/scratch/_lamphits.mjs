// _lamphits.mjs - ?lamps=1&night=0.8: a car driven into Castle Cum's first street light at 4, 9
// and 17 m/s (nudge / hard / snap), then three passes over the fallen post at 15 m/s. Prints the
// lamp (lean, light, down, solidity) and the car's speed after each; photos of the wonked, the
// fallen and the flattened post. Temp folder.
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('ERROR ' + error));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&lamps=1&night=0.8`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(4000);
  const drive = (speed, across) => page.evaluate(async ([metres, side]) => {
    const lamps = (await import('/src/world/lamps.ts')).activeLamps();
    const lamp = lamps.find((item) => item.kind === 'street');
    const car = window.__game.car;
    // from 6 m short, along the lamp's arm direction turned 90 degrees (along the road)
    const dirX = Math.cos(lamp.rot + Math.PI / 2), dirY = Math.sin(lamp.rot + Math.PI / 2);
    const aimX = lamp.down ? lamp.x + lamp.fallX * 4 : lamp.x;
    const aimY = lamp.down ? lamp.y + lamp.fallY * 4 : lamp.y;
    car.x = aimX - dirX * 6 + side; car.y = aimY - dirY * 6;
    car.heading = Math.atan2(dirY, dirX); car.vx = dirX * metres; car.vy = dirY * metres;
    car.yawRate = 0;
    await new Promise((done) => setTimeout(done, 2200));
    car.vx = 0; car.vy = 0; car.x = lamp.x - 10 * Math.cos(lamp.rot); car.y = lamp.y - 10 * Math.sin(lamp.rot);
    window.__game.renderer.snap(car);
    return { lean: Math.hypot(lamp.leanX, lamp.leanY).toFixed(2), level: lamp.level.toFixed(2),
      flicker: lamp.flicker, down: lamp.down, solidity: lamp.solidity.toFixed(2),
      mangle: lamp.mangle, carSpeed: Math.hypot(car.vx, car.vy).toFixed(1) };
  }, [speed, across]);
  for (const [label, speed] of [['nudge 4', 4], ['hard 9', 9], ['snap 17', 17]]) {
    const state = await drive(speed, 0);
    console.log(label, JSON.stringify(state));
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(tmpdir(), `lamphit-${speed}.png`) });
  }
  for (let pass = 1; pass <= 3; pass++) {
    const state = await drive(15, 0);
    console.log('over fallen pass', pass, JSON.stringify(state));
  }
  await page.screenshot({ path: join(tmpdir(), 'lamphit-flat.png') });
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

// _rimsoft.mjs - do rims spark only on hard ground? A car on one rim (rear +y) under the autopilot
// at 60 km/h; every 100 ms: is it sparking, and is the ground the physics reads under that wheel
// hard? Counts sparks over soft ground (the bug: snow / water / verges).
// node tools/scratch/_rimsoft.mjs [level] [weather mode]   (e.g. castle-cum snow)
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'castle-cum';
const mode = process.argv[3] || 'snow';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page,
    `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=60`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(300);
  await page.evaluate(([id, wx]) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: wx, season: 0, seed: 4 } }), [level, mode]);
  await page.waitForTimeout(5000);
  const res = await page.evaluate(async () => {
    const car = window.__game.car, wear = await import('/src/world/wear.ts');
    const wheels = await import('/src/world/wheels.ts');
    const tally = { samples: 0, sparkHard: 0, sparkSoft: 0, softKinds: {}, quietHard: 0 };
    for (let i = 0; i < 600; i++) {
      car.onRim = [false, false, false, true];
      car.tyreP = [1, 1, 1, 0];
      await new Promise((done) => setTimeout(done, 100));
      if (Math.hypot(car.vx, car.vy) < 3) continue;
      const wheel = wheels.carWheels(car)[wheels.CORNER_OF_WHEEL[3]];
      const ground = wear.groundAt(wheel.x, wheel.y).surface;
      const sparking = !!(car.rimSparks && car.rimSparks[3]);
      tally.samples++;
      if (sparking && ground.hard) tally.sparkHard++;
      else if (sparking) {
        tally.sparkSoft++;
        tally.softKinds[ground.id + '/' + (ground.under || '')] =
          (tally.softKinds[ground.id + '/' + (ground.under || '')] || 0) + 1;
      } else if (ground.hard) tally.quietHard++;
    }
    return tally;
  });
  console.log(`${level} ${mode}: ` + JSON.stringify(res));
} finally {
  await browser.close();
  server.stop();
}

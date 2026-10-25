// _rimsoft2.mjs - a car on one rim (rear +y) placed on each soft ground near the start (grass,
// gravel, sand, dirt, long grass) rolling at 10 m/s: does that rim spark? What do the physics'
// ground (groundAt) and the spark check's sources (wear cell, static ground) say there?
// node tools/scratch/_rimsoft2.mjs [level]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const level = process.argv[2] || 'castle-cum';
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=25`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(300);
  await page.evaluate((id) => window.__game.launch(id, 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }), level);
  await page.waitForTimeout(5000);
  const res = await page.evaluate(async () => {
    const car = window.__game.car, wear = await import('/src/world/wear.ts');
    const wheels = await import('/src/world/wheels.ts');
    const { shared } = await import('/src/game/state.js');
    shared.settings.autopilot = false;
    const found = {}, out = [];
    for (let r = 4; r < 200 && Object.keys(found).length < 5; r += 2) {
      for (let a = 0; a < 6.28; a += 0.2) {
        const x = car.x + Math.cos(a) * r, y = car.y + Math.sin(a) * r;
        const id = wear.groundAt(x, y).surface.id;
        if (['grass', 'gravel', 'sand', 'dirt', 'grassLong', 'grassShort'].includes(id)
          && !found[id]) found[id] = [x, y];
      }
    }
    for (const [id, [x, y]] of Object.entries(found)) {
      car.x = x; car.y = y; car.yawRate = 0;
      let sparked = 0;
      for (let i = 0; i < 10; i++) {
        car.vx = Math.cos(car.heading) * 10; car.vy = Math.sin(car.heading) * 10;
        car.onRim = [false, false, false, true]; car.tyreP = [1, 1, 1, 0];
        await new Promise((done) => setTimeout(done, 50));
        if (car.rimSparks && car.rimSparks[3]) sparked++;
      }
      const wheel = wheels.carWheels(car)[wheels.CORNER_OF_WHEEL[3]];
      const cell = wear.getWornSurface(wheel.x, wheel.y);
      out.push(`${id}: sparked ${sparked}/10; under the rim groundAt `
        + `${wear.groundAt(wheel.x, wheel.y).surface.id}, cell ${cell ? cell.id : '-'}, static `
        + `${wear.groundSurfaceAt(wheel.x, wheel.y).id}`);
    }
    return out;
  });
  for (const line of res) console.log(line);
} finally {
  await browser.close();
  server.stop();
}

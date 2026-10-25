// _punctures.mjs - A13 (owner: punctures too easy, e.g. on grass; "objects should have a chance to
// cause puncture ... relevant to the object hit"): the real game, VS AI x5 with your car on
// autopilot, sampled every 0.1 s. Every new puncture on any car (damage.ts car.punct) is tagged
// with what was beside it at that moment: the nearest loose object within 4 m (its kind: tyre
// stacks, bales, cones, debris), another car within 5 m, else nothing (a barrier, a hot / worn
// tyre burst, a landing), with the speed lost since the last sample.
// node tools/scratch/_punctures.mjs [levels,comma] [seconds each]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const levels = (process.argv[2] || 'grass-track,stock-car').split(',');
const seconds = +(process.argv[3] || 180);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1`);
  await page.mouse.click(422, 195);
  await page.waitForTimeout(2000);
  for (const levelId of levels) {
    const events = await page.evaluate(watch, [levelId, seconds]);
    const byCause = {};
    for (const event of events) byCause[event.cause] = (byCause[event.cause] || 0) + 1;
    console.log(`${levelId}: ${events.length} punctures in ${seconds} s (6 cars) by what was`
      + ` beside them: ${JSON.stringify(byCause)}`);
    for (const event of events.slice(0, 12)) {
      console.log(`  t ${event.t.toFixed(1)} car ${event.car} ${event.cause} lost`
        + ` ${event.lost.toFixed(1)} m/s at ${event.speed.toFixed(1)} m/s on ${event.surface}`);
    }
  }
} finally {
  await browser.close();
  server.stop();
}

/**
 * Page side: launch with 5 AI, the autopilot on, and watch every car's punctures.
 * @param {[string, number]} args the level and seconds
 * @returns {Promise<object[]>} the punctures
 */
async function watch([levelId, secs]) {
  const game = window.__game, { shared } = await import('/src/game/state.js');
  game.launch(levelId, game.car.spec.id, { ai: 5, diff: 2 });
  shared.settings.autopilot = true;
  const cars = () => [game.car, ...game.ai.map((entry) => entry.car)];
  const was = new Map(), events = [];
  const near = (car) => {
    let best = null, bestD = 16;
    for (const obj of game.cones.list) {
      const dist2 = (obj.x - car.x) ** 2 + (obj.y - car.y) ** 2;
      if (dist2 < bestD) { bestD = dist2; best = obj.kind; }
    }
    if (best) return 'object:' + best;
    const other = cars().some((o) => o !== car && (o.x - car.x) ** 2 + (o.y - car.y) ** 2 < 25);
    return other ? 'car' : 'nothing near';
  };
  const start = performance.now();
  while (performance.now() - start < secs * 1000) {
    await new Promise((done) => setTimeout(done, 100));
    cars().forEach((car, i) => {
      const speed = Math.hypot(car.vx, car.vy), count = (car.tyreLeak || []).map((leak) => leak > 0).filter(Boolean).length;
      const before = was.get(car) || { count, speed };
      if (count > before.count) {
        events.push({ t: (performance.now() - start) / 1000, car: i ? 'AI' + i : 'YOU',
          cause: near(car), lost: before.speed - speed, speed,
          surface: car.surface ? car.surface.id : '?' });
      }
      was.set(car, { count, speed });
    });
  }
  return events;
}

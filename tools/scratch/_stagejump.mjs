// _stagejump.mjs - CAN YOU JUMP A STAGE'S START? (owner 11-22: "shouldn't be possible, like all
// other events - the car is held until its green"). A stage VS AI, the throttle held down (W) from
// before the lights through the green; every 20 ms: the start clock, your speed and place - when
// you first move against your green. Also every AI's first move against its own green
// (game/order.ts startAtOf). [LEVEL=sweaty-lamb] [SOLO=1: no AI] node tools/scratch/_stagejump.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const LEVEL_ID = process.env.LEVEL || 'sweaty-lamb', AI_COUNT = process.env.SOLO ? 0 : 5;
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1` + extraQuery());
  await page.evaluate(([id, count]) => window.__game.launch(id, 'saloon-rwd', { ai: count, diff: 2,
    laps: 1, weather: { mode: 'dry', season: 2, seed: 4 } }), [LEVEL_ID, AI_COUNT]);
  await page.waitForTimeout(1500);
  await page.mouse.click(422, 195);
  await page.keyboard.down('KeyW');
  // (sampled in the page: a 20 ms poll from node misses the step it moves on)
  const result = await page.evaluate(() => new Promise((done) => {
    const game = window.__game, gap = 30, moved = {}, began = performance.now();
    const greenOf = (car) => (game.start.tGreen0 ?? game.start.tGreen) + (car === game.car ? 0
      : (car._slot || 0) * gap);
    const tick = () => {
      const cars = [game.car, ...game.ai.map((entry) => entry.car)];
      for (const car of cars) {
        const key = car === game.car ? 'YOU' : '#' + car.num;
        if (moved[key] || Math.hypot(car.vx, car.vy) < 0.3) continue;
        moved[key] = { atS: +game.start.t.toFixed(3), greenS: +greenOf(car).toFixed(3),
          early: +(greenOf(car) - game.start.t).toFixed(3), slot: car === game.car ? 0
            : car._slot };
      }
      if (performance.now() - began > 40000) done({ on: game.start.on, moved,
        flowStart: game.flow ? game.flow.entries.find((entry) => entry.player).start : null });
      else setTimeout(tick, 5);
    };
    tick();
  }));
  await page.keyboard.up('KeyW');
  console.log(JSON.stringify(result));
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

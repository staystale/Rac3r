// _stageline.mjs - A STAGE'S START QUEUE (?stageline; game/stagequeue.ts): Sweaty Lamb VS AI with
// you first (launched again until every car queues behind you), you on the autopilot. Every 50 ms
// in the page, for each queued car: its progress and speed. Reports each car's first move, where
// it stands and how fast at its own green (the start spot is the spawn's, ~-6 m), the start its
// race entry has (k x 30 s under the switch, the crossing time without), the closest two queued
// cars come, and the start gantry's lights (world/startlights.ts) round the first queued green.
// RAC3R_QUERY carries switches. [SECONDS=100] node tools/scratch/_stageline.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const SECONDS = +(process.env.SECONDS || 100), AI_COUNT = +(process.env.AI || 4);
const LEVEL_ID = process.env.LEVEL || 'sweaty-lamb';
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&autopilot=1` + extraQuery());
  let levelId = LEVEL_ID;
  if (LEVEL_ID === 'gen') levelId = await page.evaluate(async () => {
    const { LEVELS } = await import('/src/world/levels/index.ts');
    return LEVELS.find((level) => level.gen && !level.fixed).id;
  });
  for (let tries = 0; tries < 25; tries++) {
    await page.evaluate(([id, count]) => window.__game.launch(id, 'saloon-rwd', { ai: count, diff: 2,
      laps: 1, weather: { mode: 'dry', season: 2, seed: 4 } }), [levelId, AI_COUNT]);
    await page.waitForTimeout(1500);
    await page.mouse.click(422, 195);
    await page.waitForTimeout(800);
    const front = await page.evaluate(() => Math.min(...window.__game.ai.map((entry) =>
      entry.car._slot)));
    if (front > 0) break;
  }
  const result = await page.evaluate((seconds) => new Promise((done) => {
    const game = window.__game, began = performance.now(), cars = {}, lights = [];
    let closest = Infinity, closeAt = null;
    const green0 = game.start.tGreen0 ?? game.start.tGreen;
    const tick = async () => {
      const { START_LIGHTS } = await import('/src/world/startlights.ts');
      const t = game.start.t, queued = game.ai.map((entry) => entry.car)
        .filter((car) => car._slot > 0).sort((one, two) => one._slot - two._slot);
      for (const car of queued) {
        const row = cars[car.num] || (cars[car.num] = { slot: car._slot, green: green0
          + car._slot * 30 });
        const speed = Math.hypot(car.vx, car.vy);
        if (row.firstMove == null && speed > 0.3) row.firstMove = { t: +t.toFixed(2),
          prog: +(car._prog ?? NaN).toFixed(1) };
        if (row.atGreen == null && t >= row.green) row.atGreen = { prog: +(car._prog ?? NaN)
          .toFixed(1), kmh: +(speed * 3.6).toFixed(1) };
        const entry = game.flow && game.flow.entries.find((one) => one.car === car);
        if (entry) row.start = entry.start == null ? null : +entry.start.toFixed(2);
      }
      for (let i = 1; i < queued.length; i++) {
        const gap = Math.hypot(queued[i].x - queued[i - 1].x, queued[i].y - queued[i - 1].y);
        if ((queued[i - 1]._prog ?? -1) < 0 && (queued[i]._prog ?? -1) < 0 && gap < closest) {
          closest = gap;
          closeAt = { t: +t.toFixed(2), slots: [queued[i - 1]._slot, queued[i]._slot],
            progs: [queued[i - 1]._prog ?? null, queued[i]._prog ?? null].map((v) => v == null ? null
              : +v.toFixed(1)), kmh: [queued[i - 1], queued[i]].map((c) => +(Math.hypot(c.vx, c.vy)
              * 3.6).toFixed(1)) };
        }
      }
      const first = green0 + 30;
      if (t > first - 4 && t < first + 4 && (!lights.length || lights[lights.length - 1].key
        !== `${START_LIGHTS.reds}${START_LIGHTS.green}`)) lights.push({ t: +t.toFixed(2),
        key: `${START_LIGHTS.reds}${START_LIGHTS.green}`, reds: START_LIGHTS.reds,
        green: START_LIGHTS.green });
      if (performance.now() - began > seconds * 1000) done({ cars, closest: +closest.toFixed(1), closeAt,
        lights: lights.map(({ t: at, reds, green }) => ({ at, reds, green })) });
      else setTimeout(tick, 50);
    };
    tick();
  }), SECONDS);
  console.log(JSON.stringify(result.cars));
  console.log('closest queued cars (centre to centre, m)', result.closest, JSON.stringify(result.closeAt));
  console.log('gantry round the first queued green', JSON.stringify(result.lights));
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

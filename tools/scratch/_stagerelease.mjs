// _stagerelease.mjs - HOW A RALLY STAGE'S STARTS RELEASE TODAY (owner 11-22: "multiple cars
// release at once and it doesn't seem like a real start"): Sweaty Lamb VS AI, you on the
// autopilot; every 0.25 s for SECONDS s each car's speed, stage progress and distance from you -
// when it first moves (over 0.5 m/s), from where, and whether it is in your view (60 m). Photos at
// the green and 2 s after. RAC3R_QUERY carries switches.
// [AI=5] [SECONDS=80] [OUT=file] node tools/scratch/_stagerelease.mjs
import { appendFileSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const AI_COUNT = +(process.env.AI || 5), SECONDS = +(process.env.SECONDS || 80);
const OUT = process.env.OUT || 'tools/scratch/_stagerelease.txt';
const report = (row) => appendFileSync(OUT, JSON.stringify(row) + '\n');
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&autopilot=1` + extraQuery());
  await page.evaluate((aiCount) => window.__game.launch('sweaty-lamb', 'saloon-rwd', { ai: aiCount,
    diff: 2, laps: 1, weather: { mode: 'dry', season: 2, seed: 4 } }), AI_COUNT);
  await page.waitForTimeout(1500);
  await page.mouse.click(195, 422);
  const moved = {};
  let shotGreen = false, shotAfter = false;
  const wallStart = Date.now();
  while ((Date.now() - wallStart) / 1000 < SECONDS) {
    await page.waitForTimeout(250);
    const now = await page.evaluate(() => {
      const game = window.__game, me = game.car;
      const cars = [me, ...game.ai.map((entry) => entry.car), ...(game.aiDone || [])];
      return { t: +game.start.t.toFixed(2), green: game.start.tGreen,
        cars: cars.map((car) => ({ num: car.num, me: car === me, slot: car === me ? 0 : car._slot,
          speed: +Math.hypot(car.vx, car.vy).toFixed(1),
          prog: car._prog == null ? null : Math.round(car._prog),
          fromMe: Math.round(Math.hypot(car.x - me.x, car.y - me.y)) })) };
    });
    for (const car of now.cars) {
      if (moved[car.num] || car.speed <= 0.5) continue;
      moved[car.num] = { atS: now.t, slot: car.slot, prog: car.prog, fromMe: car.fromMe,
        inView: car.fromMe < 60 };
    }
    if (!shotGreen && now.t >= now.green) {
      shotGreen = true;
      await page.screenshot({ path: 'tools/scratch/_stagerelease-green.png' });
      report({ atGreen: now });
    }
    if (shotGreen && !shotAfter && now.t >= now.green + 2) {
      shotAfter = true;
      await page.screenshot({ path: 'tools/scratch/_stagerelease-green2s.png' });
    }
  }
  report({ firstMove: moved, errors: errors.slice(0, 3) });
} finally {
  await browser.close();
  server.stop();
}

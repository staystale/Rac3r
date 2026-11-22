// _stagebehind.mjs - THE CARS QUEUED BEHIND YOU AT A STAGE START (owner on round205: "I didn't see
// any other AI racers on rally start behind me and I couldn't see any on the minimap"): a stage VS
// AI 5, launched again until you start first (everyone queues behind you); at your green each
// queued car's slot, place, distance from you, whether it is on the road (a ghost segment is not
// road: world/subtrack.ts ghostSegment), and in the minimap's reach; a photo at the green.
// RAC3R_QUERY carries switches. [LEVEL=sweaty-lamb] [VIEW=390x844]
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const LEVEL_ID = process.env.LEVEL || 'sweaty-lamb';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1` + extraQuery());
  let levelId = LEVEL_ID;
  if (LEVEL_ID === 'gen') levelId = await page.evaluate(async () => {
    const { LEVELS } = await import('/src/world/levels/index.ts');
    return LEVELS.find((level) => level.gen && !level.fixed).id;
  });
  let front = 0;
  for (let tries = 0; tries < 25; tries++) {
    await page.evaluate((id) => window.__game.launch(id, 'saloon-rwd', { ai: 5, diff: 2,
      laps: 1, weather: { mode: 'dry', season: 2, seed: 4 } }), levelId);
    await page.waitForTimeout(1500);
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(500);
    front = await page.evaluate(() => Math.min(...window.__game.ai.map((entry) =>
      entry.car._slot)));
    if (front > 0) break;
  }
  await page.waitForFunction(() => window.__game.start.t >= (window.__game.start.tGreen0
    ?? window.__game.start.tGreen), null, { polling: 50, timeout: 20000 });
  const report = await page.evaluate(async () => {
    const { querySubtrack } = await import('/src/world/tyrewall.ts');
    const game = window.__game, sub = game.level.subtrack, me = game.car;
    return { level: game.level.id, inAi: game.ai.length, home: (game.aiDone || []).length,
      cars: game.ai.map((entry) => {
        const car = entry.car, hit = querySubtrack(sub, car.x, car.y);
        return { slot: car._slot, prog: car._prog == null ? null : Math.round(car._prog),
          fromMeM: Math.round(Math.hypot(car.x - me.x, car.y - me.y)),
          onRoad: Number.isFinite(hit.dist) && hit.dist < sub.width / 2 + 2,
          x: Math.round(car.x), y: Math.round(car.y) };
      }) };
  });
  await page.screenshot({ path: `tools/scratch/_stagebehind-${LEVEL_ID}-${width}x${height}.png` });
  console.log(JSON.stringify(report));
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

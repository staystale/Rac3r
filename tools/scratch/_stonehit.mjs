// _stonehit.mjs - A CAR INTO A MOVABLE STONE (?spikerocks; cones/stones.ts): on SPIKES PEAK, for
// each stone size, the car put 8 m before a stone of that size heading straight at it at SPEED
// m/s (no driver input), 2 s later: how far the stone was pushed, its drive-over chance (up when
// hit), whether the car ran over it (no contact), and whether a tyre burst. RAC3R_QUERY switches.
// [SPEED=10]
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const SPEED = +(process.env.SPEED || 10);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&spikespeak=1` + extraQuery());
  await page.evaluate(() => window.__game.launch('spikes-peak', 'saloon-rwd', { ai: 0, laps: 1,
    weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForFunction(() => window.__game.mode === 'session', null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.mouse.click(422, 195);
  for (const kind of ['stone', 'stonemid', 'stonebig']) {
    for (let run = 0; run < 3; run++) {
      const before = await page.evaluate(([want, nth, speed]) => {
        const game = window.__game, stones = game.cones.list.filter((obj) => obj.kind === want);
        const obj = stones[nth * 5 % stones.length], car = game.car, ang = Math.random() * 6.28;
        car.x = obj.x - Math.cos(ang) * 8;
        car.y = obj.y - Math.sin(ang) * 8;
        car.heading = ang;
        car.vx = Math.cos(ang) * speed;
        car.vy = Math.sin(ang) * speed;
        car.yawRate = 0;
        window.__stone = obj;
        return { x: obj.x, y: obj.y, over: obj.overChance };
      }, [kind, run, SPEED]);
      await page.waitForTimeout(2000);
      const after = await page.evaluate(() => {
        const obj = window.__stone, car = window.__game.car;
        return { x: obj.x, y: obj.y, over: obj.overChance, hitT: obj._stoneT ?? null,
          burst: car.burstTyre ?? null };
      });
      console.log(kind, `run ${run}`, JSON.stringify({ movedM: +Math.hypot(after.x - before.x,
        after.y - before.y).toFixed(2), over: [before.over, +(after.over ?? 0).toFixed(3)],
      hit: after.hitT != null, burst: after.burst }));
    }
  }
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

// _hwstart.mjs - the HIGHWAY's START (owner 11-07: "does the ai need a racing line on highway? ...
// it's causing all the ai to swarm to the centre upon start and it's a mess"): the real game, VS AI
// x N, sampled every 0.1 s from the green for SECS s. Per window: the AI's spread across the road
// (sd of their place across it, m), their share within 1.5 m of the road's middle, the pairs
// closer than 2.5 m (box gap), and the closest pair.
// node tools/scratch/_hwstart.mjs [ai] [secs] [runs] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [aiArg = '9', secArg = '12', runArg = '2', query = ''] = process.argv.slice(2);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, srv.url + '/?pc=1&guide=0&menu=0&noaudio=1&autopilot=1' + (query ? '&' + query : ''));
  await page.mouse.click(400, 200);
  await page.waitForTimeout(2500);
  const totals = [];
  for (let run = 0; run < +runArg; run++) {
    const res = await page.evaluate(async ([ai, secs]) => {
      const game = window.__game, lab = await import('/src/lab.js');
      game.launch('highway', game.car.spec.id, { ai, diff: 2, traffic: 1 });
      for (let k = 0; k < 400 && !game.start.green; k++) await new Promise((done) => setTimeout(done, 100));
      const windows = [];
      for (let tick = 0; tick < secs * 10; tick++) {
        await new Promise((done) => setTimeout(done, 100));
        const sub = lab.LEVEL.subtrack, cars = game.ai.map((entry) => entry.car);
        const lats = cars.map((car) => {
          const hitInfo = lab.querySubtrack(sub, car.x, car.y);
          return (hitInfo.side === 'left' ? -1 : 1) * hitInfo.dist;
        });
        const mean = lats.reduce((a, b) => a + b, 0) / lats.length;
        const sd = Math.sqrt(lats.reduce((a, b) => a + (b - mean) ** 2, 0) / lats.length);
        const middle = lats.filter((lat) => Math.abs(lat) < 1.5).length / lats.length;
        let close = 0, closest = 99;
        const all = [game.car, ...cars];
        for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
          const gap = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) - 4.4;
          closest = Math.min(closest, gap);
          if (gap < 2.5) close++;
        }
        const w = Math.floor(tick / 40);
        const row = windows[w] ??= { sd: 0, middle: 0, close: 0, n: 0, closest: 99 };
        row.sd += sd; row.middle += middle; row.close += close; row.n++;
        row.closest = Math.min(row.closest, closest);
      }
      return windows.map((row, w) => ({ from: w * 4, sd: row.sd / row.n, middle: row.middle / row.n,
        close: row.close / row.n, closest: row.closest }));
    }, [+aiArg, +secArg]);
    totals.push(res);
    console.log(`run ${run + 1}: ` + res.map((row) => `${row.from}-${row.from + 4} s: spread ${row.sd.toFixed(1)} m, middle ${(100 * row.middle).toFixed(0)}%, close pairs ${row.close.toFixed(1)}, closest ${row.closest.toFixed(1)} m`).join(' | '));
  }
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 3));
} finally {
  await browser.close();
  srv.stop();
}

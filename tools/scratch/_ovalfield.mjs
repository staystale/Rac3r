// _ovalfield.mjs - the REAL GAME with a full grid (owner 11-04: AI wore grooves in the grass of the
// stock car oval "after 1 lap", 21 cars): the rolling start and the race, the player on autopilot,
// sampled every 0.2 s. Per 10 s: AI car-time off the track (past the edge + 0.5 m), spins (sliding
// > 70 deg above 4 m/s), and the most off-track car.
// node tools/scratch/_ovalfield.mjs [level] [ai] [diff] [seconds] [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [level = 'stock-car', aiArg = '20', diffArg = '2', secArg = '90', query = ''] = process.argv.slice(2);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 844, height: 390 } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, srv.url + '/?pc=1&guide=0&menu=0&noaudio=1&autopilot=1' + (query ? '&' + query : ''));
  await page.mouse.click(400, 200);
  await page.waitForTimeout(2500);
  const res = await page.evaluate(async ([lv, ai, diff, secs]) => {
    const game = window.__game, lab = await import('/src/lab.js');
    game.launch(lv, game.car.spec.id, { ai, diff });
    await new Promise((done) => setTimeout(done, 300));
    const sub = lab.LEVEL.subtrack, half = sub.width / 2, rows = [];
    let greenAt = null;
    const spinT = new Map();
    for (let tick = 0; tick < secs * 5; tick++) {
      await new Promise((done) => setTimeout(done, 200));
      if (greenAt === null && game.start.green) greenAt = game.start.t;
      const t = game.start.t, b = Math.floor(t / 10) * 10;
      const row = rows[b / 10] ??= { t: b, n: 0, off: 0, spins: 0, worst: 0 };
      for (const entry of game.ai) {
        const car = entry.car, q = lab.querySubtrack(sub, car.x, car.y), past = q.dist - half;
        row.n++;
        if (past > 0.5) { row.off++; row.worst = Math.max(row.worst, past); }
        const v = Math.hypot(car.vx, car.vy);
        let slip = Math.atan2(car.vy, car.vx) - car.heading;
        slip = Math.abs(Math.atan2(Math.sin(slip), Math.cos(slip)));
        if (v > 4 && slip > 1.22 && t - (spinT.get(car) ?? -99) > 3) { spinT.set(car, t); row.spins++; }
      }
    }
    return { greenAt, rows: rows.filter(Boolean), lap: sub.totalDist, width: sub.width };
  }, [level, +aiArg, +diffArg, +secArg]);
  console.log(`${level} ${aiArg} AI diff ${diffArg} ${query || '(plain)'}: green at ${res.greenAt?.toFixed(1)} s, lap ${res.lap.toFixed(0)} m, width ${res.width} m`);
  let off = 0, n = 0, spins = 0;
  for (const row of res.rows) {
    off += row.off; n += row.n; spins += row.spins;
    console.log(`  ${String(row.t).padStart(3)} s: off the track ${(100 * row.off / Math.max(1, row.n)).toFixed(1)}% | spins ${row.spins} | furthest ${row.worst.toFixed(1)} m past`);
  }
  console.log(`  TOTAL off the track ${(100 * off / Math.max(1, n)).toFixed(1)}% of AI car-time | spins ${spins}`);
  if (errors.length) console.log('PAGE ERRORS', errors.slice(0, 3));
} finally {
  await browser.close();
  srv.stop();
}

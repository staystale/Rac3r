// _gridstart.mjs - THE START (?stopdodge=1's start check; measure only): the real game,
// deterministic, nothing drawn, your car on ?autopilot. From the green (game.start.green; at once
// where there is no start), for each AI racer: the time it takes to cover 100 m and 250 m; the
// field's spread at 10 s (the first car's distance - the last's); racer-on-racer touches in the
// first 30 s. RUNS=brands,knobhill,dual (default), SEED=1; the switch through RAC3R_QUERY.
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  brands: { level: 'brands-snatch', opts: { ai: 19, laps: 30 } },
  knobhill: { level: 'knobhill', opts: { ai: 19, rx: true, laps: 30 } },
  dual: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'dual', scenery: 'canyon' } },
};
const RUN_IDS = (process.env.RUNS || 'brands,knobhill,dual').split(',');
const SEED = Number(process.env.SEED || 1), AFTER_S = 30, MAX_WAIT_S = 60;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame. */
function tickStart() {
  const run = window.__start, game = window.__game, racers = game.ai;
  run.t += 1 / 60;
  const green = !game.start || !game.start.on || game.start.green;
  if (run.green == null && green) run.green = run.t;
  if (run.green == null) return;
  const since = run.t - run.green;
  racers.forEach((entry, i) => {
    run.dist[i] = (run.dist[i] || 0) + Math.hypot(entry.car.vx, entry.car.vy) / 60;
    if (run.at100[i] == null && run.dist[i] >= 100) run.at100[i] = since;
    if (run.at250[i] == null && run.dist[i] >= 250) run.at250[i] = since;
  });
  if (run.spread10 == null && since >= 10) {
    run.spread10 = Math.max(...run.dist) - Math.min(...run.dist);
  }
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const one = racers[i].car, two = racers[j].car;
      if (Math.abs(one.x - two.x) > 12 || Math.abs(one.y - two.y) > 12) continue;
      if (!window.__startTouch(one, two)) continue;
      const key = i * 100 + j, last = run.touching.get(key);
      if (last === undefined || run.t - last > 0.5) run.touches++;
      run.touching.set(key, run.t);
    }
  }
}

/** Page side: whether two bodies touch (each on the first's axes, no margin). */
function touchStart(car, other) {
  const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
  const dx = other.x - car.x, dy = other.y - car.y, turn = other.heading - car.heading;
  const along = dx * cos + dy * sin, across = -dx * sin + dy * cos;
  const reachAlong = other.spec.len / 2 * Math.abs(Math.cos(turn))
    + other.spec.wid / 2 * Math.abs(Math.sin(turn));
  const reachAcross = other.spec.len / 2 * Math.abs(Math.sin(turn))
    + other.spec.wid / 2 * Math.abs(Math.cos(turn));
  return Math.abs(along) < car.spec.len / 2 + reachAlong
    && Math.abs(across) < car.spec.wid / 2 + reachAcross;
}

/** Page side: step until AFTER_S past the green (or MAX_WAIT_S without one). */
function stepStart(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__startTick();
  }
  const run = window.__start;
  return run.green != null ? run.t - run.green >= 30 : run.t >= 60;
}

/** One run. */
async function runOne(browser, base, id) {
  const errors = [], run = ALL_RUNS[id];
  const page = await openPage(browser, base, run.level, errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [run.level, { car: 'hatch-rwd', ...run.opts }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(`window.__start = { t: 0, green: null, dist: [], at100: [], at250: [],
    spread10: null, touches: 0, touching: new Map() };
    window.__startTick = ${tickStart.toString()}; window.__startTouch = ${touchStart.toString()};`);
  let done = false;
  for (let guard = 0; !done && guard < (AFTER_S + MAX_WAIT_S) * 60 / 300 + 2; guard++) {
    done = await page.evaluate(stepStart, 300);
  }
  const out = await page.evaluate(() => window.__start);
  await page.context().close();
  return { ...out, errors };
}

const mean = (list) => list.reduce((sum, value) => sum + value, 0) / Math.max(1, list.length);
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const id of RUN_IDS) {
    const out = await runOne(browser, server.url, id);
    const at100 = out.at100.filter((value) => value != null);
    const at250 = out.at250.filter((value) => value != null);
    console.log(`${id} seed ${SEED}: green at ${out.green?.toFixed(1)} s | ${out.dist.length} AI |`
      + ` 100 m mean ${mean(at100).toFixed(2)} s, last ${Math.max(...at100).toFixed(2)} s`
      + ` (${at100.length} made it) | 250 m mean ${mean(at250).toFixed(2)} s, last`
      + ` ${Math.max(...at250).toFixed(2)} s (${at250.length}) | spread at 10 s`
      + ` ${(out.spread10 ?? 0).toFixed(0)} m | touches in 30 s ${out.touches}`
      + `${out.errors.length ? ' ERR ' + out.errors[0] : ''}`);
  }
} finally {
  await browser.close();
  server.stop();
}

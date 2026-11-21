// _hbdriftgame.mjs - _hbdrift.mjs IN THE REAL GAME (the owner's 11-21 item 11, read only), for a
// level the headless tool cannot drive - Moanaco: its tunnel and crossings need the game's own world
// (headless, a lone hatch wedged at 750 m and was put back 113 times). Two AI cars of the car under
// test (the AI drive the player's car), seeded, nothing drawn, your car on ?autopilot; per car,
// over SEEDS: flying laps by the game's own race order (car._prog), handbrake PULLS a lap (the
// driver's handbrake going on), DRIFT s a lap (state.driftT), off-road s a lap.
// LEVEL=moanaco CARS=hatch-fwd,hatch-rwd,rally-4x4,track-rwd SEEDS=1,2,3,4 LAPS=3
// node tools/scratch/_hbdriftgame.mjs
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const LEVEL_ID = process.env.LEVEL || 'moanaco';
const CARS = (process.env.CARS || 'hatch-fwd,hatch-rwd,rally-4x4,track-rwd').split(',');
const SEEDS = (process.env.SEEDS || '1,2,3,4').split(',').map(Number);
const LAPS = Number(process.env.LAPS || 3), CHUNK = 600, LIMIT_S = 900;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame - each AI's laps, pulls, drift and off-road on its flying laps. */
function tickHb() {
  const hb = window.__hb, game = window.__game, L = window.__L;
  hb.t += 1 / 60;
  const sub = L.LEVEL.subtrack, total = sub.totalDist;
  for (const entry of game.ai) {
    const car = entry.car;
    if (!entry.drv.__wrapped) {
      const drive = entry.drv.drive;
      entry.drv.drive = (...args) => (entry.__want = drive(...args));
      entry.drv.__wrapped = true;
    }
    const rec = hb.cars.get(entry) || { lap: null, lapT: 0, laps: [], pulls: 0, offS: 0,
      driftFrom: null, driftS: 0, pulled: false };
    hb.cars.set(entry, rec);
    const lap = car._prog === undefined ? null : Math.floor(car._prog / total);
    if (lap != null && rec.lap != null && lap > rec.lap) {
      // (flying laps: from the second racing lap on)
      if (rec.lap >= 1) rec.laps.push(hb.t - rec.lapT);
      if (rec.lap === 0) rec.driftFrom = entry.drv.state.driftT || 0;
      rec.lapT = hb.t;
    }
    if (lap != null) rec.lap = lap;
    const flying = rec.lap != null && rec.lap >= 1 && rec.laps.length < hb.laps;
    const pulled = !!entry.__want?.handbrake;
    if (flying && pulled && !rec.pulled) rec.pulls++;
    rec.pulled = pulled;
    const query = L.querySubtrack(sub, car.x, car.y);
    if (flying && Number.isFinite(query.dist) && query.dist > sub.width / 2 + 0.5) rec.offS += 1 / 60;
    if (rec.laps.length === hb.laps && rec.driftEnd == null) rec.driftEnd = entry.drv.state.driftT || 0;
  }
}

/** Page side: step frames; true once every AI has its flying laps. */
function stepHb(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__hbTick();
  }
  const hb = window.__hb;
  return hb.cars.size > 0 && [...hb.cars.values()].every((rec) => rec.laps.length >= hb.laps);
}

/** One run: two AI of a car on the level. */
async function runOne(browser, base, carId, seed) {
  const errors = [];
  const page = await openPage(browser, base, LEVEL_ID, errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((value) => window.__rt.seed(value), seed);
  await page.evaluate(launchLevel, [LEVEL_ID, { car: carId, ai: 2, laps: 30 }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(async (laps) => {
    window.__L = await import('/src/lab.ts');
    window.__hb = { t: 0, cars: new Map(), laps };
  }, LAPS);
  await page.evaluate(`window.__hbTick = ${tickHb.toString()};`);
  let done = false;
  for (let frames = 0; !done && frames < LIMIT_S * 60; frames += CHUNK) {
    done = await page.evaluate(stepHb, CHUNK);
  }
  const out = await page.evaluate(() => [...window.__hb.cars.values()].map((rec) => ({
    laps: rec.laps, pulls: rec.pulls, offS: rec.offS,
    driftS: rec.driftFrom == null ? 0 : (rec.driftEnd ?? 0) - rec.driftFrom })));
  await page.context().close();
  return { cars: out, errors: errors.slice(0, 3) };
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const carId of CARS) {
    let laps = [], pulls = 0, driftS = 0, offS = 0;
    const errs = [];
    for (const seed of SEEDS) {
      const out = await runOne(browser, server.url, carId, seed);
      for (const rec of out.cars) {
        laps = laps.concat(rec.laps);
        pulls += rec.pulls;
        driftS += Math.max(0, rec.driftS);
        offS += rec.offS;
      }
      errs.push(...out.errors);
    }
    const count = Math.max(1, laps.length);
    const mean = laps.length ? laps.reduce((sum, lap) => sum + lap, 0) / laps.length : NaN;
    console.log(`${LEVEL_ID.padEnd(12)} ${carId.padEnd(10)} ${laps.length} flying laps, mean`
      + ` ${mean.toFixed(1)} s | handbrake pulls ${(pulls / count).toFixed(2)} a lap | drift`
      + ` ${(driftS / count).toFixed(1)} s a lap (${(100 * driftS / Math.max(1, mean * count))
        .toFixed(1)} %) | off ${(offS / count).toFixed(1)} s a lap${errs.length ? ' | ERR '
        + errs[0] : ''}`);
  }
} finally {
  await browser.close();
  server.stop();
}

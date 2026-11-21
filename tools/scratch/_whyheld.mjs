// _whyheld.mjs - THE OWNER'S 11-21 "WHY HELD" TRACE (item 7, measure only): why a racer sits
// behind a car instead of going round - the highway behind traffic AND the circuits behind racers
// (the owner: it affects the track AI too). The real game, deterministic, nothing drawn, your car
// on ?autopilot. Every racer frame held to a follow cap (state.follow) above 8 m/s after the first
// 15 s, by the driver's own reason for the cap kept (state.followWhy, set where the cap is:
// ai/driverTraffic.ts) and the kind of car it is held behind (the nearest ahead within 40 m and
// 2.5 m across): CLOSE (a side chosen, still too close behind to go - fwd under the follow gap),
// NO-ROOM (no side with room on the road), KEEP-SIDE (a side, but my own side of the road rules
// it out), SWERVE (going round, slowed to get across in time), SWERVE-GAP (the gap picker's way
// round, slowed the same), BOXED (the gap picker found no way round: arrive behind it), YIELD
// (a car leads by half a length on my line), ATTACK (overlapping the car I attack), STOPPED
// (a stopped car's cap). The speeders (the same driver in the traffic) beside the racers on the
// highway. BINDS=1 counts only a cap below the plan (state.capBinds: the cap really holding the car).
// RUNS=motorway,thruston,brands SEEDS=1,2 SECONDS=180; a switch through RAC3R_QUERY.
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  motorway: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'motorway' } },
  thruston: { level: 'thruston', opts: { ai: 19, laps: 30 } },
  brands: { level: 'brands-snatch', opts: { ai: 19, laps: 30 } },
};
const RUN_IDS = (process.env.RUNS || Object.keys(ALL_RUNS).join(',')).split(',');
const SEEDS = (process.env.SEEDS || '1,2').split(',').map(Number);
const SECONDS = Number(process.env.SECONDS || 180), CHUNK = 600;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame - each driver held, by its reason and what it is behind. */
function tickWhy() {
  const why = window.__why, game = window.__game;
  why.t += 1 / 60;
  if (why.t < 15) return;
  const traffic = game.traffic ? game.traffic.cars : [];
  const drivers = [...game.ai.map((entry) => ({ car: entry.car, drv: entry.drv, who: 'racer' })),
    ...(game.traffic ? game.traffic.list.filter((slot) => slot.racer && !slot.parked)
      .map((slot) => ({ car: slot.car, drv: slot.racer, who: 'speeder' })) : [])];
  const everyone = [{ car: game.car, kind: 'PLAYER' },
    ...game.ai.map((entry) => ({ car: entry.car, kind: 'RACER' })),
    ...traffic.map((car) => ({ car, kind: 'TRAFFIC' }))];
  for (const one of drivers) {
    const car = one.car, speed = Math.hypot(car.vx, car.vy), tally = why[one.who];
    tally.s += 1 / 60;
    if (!one.drv.state.follow || speed < 8) continue;
    // (BINDS=1: only a cap that holds me below my plan - state.capBinds)
    if (window.__whyBinds && !one.drv.state.capBinds) continue;
    const cos = Math.cos(car.heading), sin = Math.sin(car.heading);
    let near = null, nearFwd = Infinity;
    for (const other of everyone) {
      if (other.car === car) continue;
      const dx = other.car.x - car.x, dy = other.car.y - car.y;
      const fwd = dx * cos + dy * sin, across = -dx * sin + dy * cos;
      if (fwd > 0 && fwd < 40 && Math.abs(across) < 2.5 && fwd < nearFwd) {
        near = other;
        nearFwd = fwd;
      }
    }
    const key = `${(one.drv.state.followWhy || 'none').toUpperCase()} behind ${near
      ? near.kind : 'NONE'}`;
    tally.held += 1 / 60;
    tally.by[key] = (tally.by[key] || 0) + 1 / 60;
  }
}

/** Page side: step frames. */
function stepWhy(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__whyTick();
  }
}

/** One run. */
async function runOne(browser, base, id, seed) {
  const errors = [], run = ALL_RUNS[id];
  const page = await openPage(browser, base, run.level, errors, SKIP);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((value) => window.__rt.seed(value), seed);
  await page.evaluate(launchLevel, [run.level, { car: 'hatch-rwd', ...run.opts }]);
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(`window.__why = { t: 0, racer: { s: 0, held: 0, by: {} },
    speeder: { s: 0, held: 0, by: {} } }; window.__whyTick = ${tickWhy.toString()};
    window.__whyBinds = ${process.env.BINDS ? 1 : 0};`);
  for (let done = 0; done < SECONDS * 60; done += CHUNK) {
    await page.evaluate(stepWhy, Math.min(CHUNK, SECONDS * 60 - done));
  }
  const out = await page.evaluate(() => window.__why);
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

/** One driver kind's line: held share, then the reasons by share of its held time. */
function tallyLine(name, tally) {
  if (tally.s < 1) return `${name}: none`;
  const reasons = Object.entries(tally.by).sort((one, two) => two[1] - one[1]).slice(0, 8)
    .map(([key, secs]) => `${key} ${(100 * secs / Math.max(0.01, tally.held)).toFixed(0)} %`);
  return `${name} held ${(100 * tally.held / tally.s).toFixed(1)} % of ${tally.s.toFixed(0)} car-s:`
    + ` ${reasons.join(', ')}`;
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const id of RUN_IDS) {
    for (const seed of SEEDS) {
      const out = await runOne(browser, server.url, id, seed);
      console.log(`${id} seed ${seed}: ${tallyLine('racers', out.racer)}`
        + `${out.speeder.s >= 1 ? ' | ' + tallyLine('speeders', out.speeder) : ''}`
        + `${out.errors.length ? ' | ERR ' + out.errors[0] : ''}`);
    }
  }
} finally {
  await browser.close();
  server.stop();
}

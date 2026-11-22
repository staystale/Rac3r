// _rejoinharsh.mjs - THE OWNER'S 11-22 "RETURNING TO THE RACING LINE TOO HARSHLY" (measure only):
// the real game, seeded, nothing drawn, your car on ?autopilot, a full field. Every racer think on
// the road above 15 m/s: whether its steering's error is CAPPED (the soft rejoin, ai/rejoin.ts:
// 0.7-1.2 m) or UNCAPPED ("making a move": ai/driverDrive.ts moving = conflict || attack || cover),
// how far off its target it is, and - the snaps - an uncapped error of 1.5 m+ with the target
// moving back toward the racing line. By why it was uncapped: CONFLICT only, ATTACK, COVER.
// RUNS=brands,motorway SEEDS=1 SECONDS=120; switches through RAC3R_QUERY.
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  brands: { level: 'brands-snatch', opts: { ai: 19, laps: 30 } },
  moanaco: { level: 'moanaco', opts: { ai: 19, laps: 30 } },
  motorway: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'motorway' } },
};
const RUN_IDS = (process.env.RUNS || 'brands,motorway').split(',');
const SEEDS = (process.env.SEEDS || '1').split(',').map(Number);
const SECONDS = Number(process.env.SECONDS || 120), CHUNK = 600;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame. */
function tickHarsh() {
  const rec = window.__harsh, game = window.__game;
  rec.t += 1 / 60;
  if (rec.t < 15) return;
  for (const entry of game.ai) {
    const car = entry.car, state = entry.drv.state, hold = state.steerHold;
    if (!hold || Math.hypot(car.vx, car.vy) < 15) continue;
    const point = hold.path.pts[hold.nearIdx];
    if (!point) continue;
    const actual = (car.x - point.x) * -Math.sin(point.h) + (car.y - point.y) * Math.cos(point.h);
    const error = Math.abs(actual - hold.latT), capped = Number.isFinite(hold.crossMax);
    const why = capped ? 'CAPPED' : state.atk ? 'ATTACK' : state.cover ? 'COVER' : 'CONFLICT';
    rec.s[why] = (rec.s[why] || 0) + 1 / 60;
    // (a snap: uncapped, 1.5 m+ off target, the target heading back toward the line)
    const prev = entry.__lastLat;
    entry.__lastLat = hold.latT;
    const towardLine = prev != null && Math.abs(hold.latT) < Math.abs(prev) - 0.01;
    if (!capped && error > 1.5 && towardLine) {
      rec.snap[why] = (rec.snap[why] || 0) + 1 / 60;
      rec.steer.push(Math.abs(car.delta || 0));
    }
  }
}

/** Page side: step frames. */
function stepHarsh(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__harshTick();
  }
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const id of RUN_IDS) {
    for (const seed of SEEDS) {
      const errors = [], run = ALL_RUNS[id];
      const page = await openPage(browser, server.url, run.level, errors, SKIP);
      await page.evaluate(() => {
        dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
        window.__rt.step(10);
      });
      await page.evaluate((value) => window.__rt.seed(value), seed);
      await page.evaluate(launchLevel, [run.level, { car: 'hatch-rwd', ...run.opts }]);
      await page.waitForTimeout(SETTLE_MS);
      await page.evaluate(`window.__harsh = { t: 0, s: {}, snap: {}, steer: [] };
        window.__harshTick = ${tickHarsh.toString()};`);
      for (let done = 0; done < SECONDS * 60; done += CHUNK) {
        await page.evaluate(stepHarsh, Math.min(CHUNK, SECONDS * 60 - done));
      }
      const out = await page.evaluate(() => window.__harsh);
      await page.context().close();
      const total = Object.values(out.s).reduce((sum, secs) => sum + secs, 0);
      const share = (obj) => Object.entries(obj).sort((one, two) => two[1] - one[1])
        .map(([key, secs]) => `${key} ${(100 * secs / Math.max(0.01, total)).toFixed(1)} %`).join(', ');
      const steer = out.steer.sort((one, two) => one - two);
      console.log(`${id} seed ${seed} ${process.env.RAC3R_QUERY || '(off)'}: steering error ${share(out.s)}`
        + ` | SNAPS (uncapped, 1.5 m+ off, target heading back to the line) ${share(out.snap)}`
        + ` | their steer median ${steer.length ? steer[steer.length >> 1].toFixed(3) : '-'} rad`
        + `${errors.length ? ' | ERR ' + errors[0] : ''}`);
    }
  }
} finally {
  await browser.close();
  server.stop();
}

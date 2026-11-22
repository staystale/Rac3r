// _revcount.mjs - HOW OFTEN THE AI REVERSE (owner 11-22: "reverse-if-not-clear-in-front ... should
// only kick in if it's stuck still"), measure only: the real game, seeded, nothing drawn, your car on
// ?autopilot, a full field. Per run: the AI's drive-outs (ai/driveOut.ts state.nOut: a reverse of
// ~1-1.5 s), how many of them came while the driver was held to a car ahead (state.follow, the cap
// holding it), its give-ups (three drive-outs in 15 s), and the game's put-backs of a stuck AI (a jump
// of 15 m+ in one frame) - stuck cars still freed. RUNS=brands,moanaco SEEDS=1,2 SECONDS=180; a
// switch through RAC3R_QUERY. node tools/scratch/_revcount.mjs
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  brands: { level: 'brands-snatch', opts: { ai: 19, laps: 30 } },
  moanaco: { level: 'moanaco', opts: { ai: 19, laps: 30 } },
  croughedrx: { level: 'croughedrx', opts: { ai: 19, laps: 30 } },
  motorway: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'motorway' } },
};
const RUN_IDS = (process.env.RUNS || 'brands,moanaco').split(',');
const SEEDS = (process.env.SEEDS || '1,2').split(',').map(Number);
const SECONDS = Number(process.env.SECONDS || 180), CHUNK = 600;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame. */
function tickRev() {
  const rev = window.__rev, game = window.__game;
  rev.t += 1 / 60;
  for (const entry of game.ai) {
    const state = entry.drv.state, car = entry.car, seen = rev.cars.get(entry) || { out: 0, x: car.x,
      y: car.y, give: false };
    if ((state.nOut || 0) > seen.out) {
      rev.outs += state.nOut - seen.out;
      if (state.follow && state.capBinds) rev.outsHeld += state.nOut - seen.out;
      seen.out = state.nOut;
    }
    if (state.giveUp && !seen.give) rev.giveUps++;
    seen.give = !!state.giveUp;
    if (Math.hypot(car.x - seen.x, car.y - seen.y) > 15 && rev.t > 1) rev.putBacks++;
    seen.x = car.x;
    seen.y = car.y;
    rev.cars.set(entry, seen);
  }
}

/** Page side: step frames. */
function stepRev(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__revTick();
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
      await page.evaluate(`window.__rev = { t: 0, outs: 0, outsHeld: 0, giveUps: 0, putBacks: 0,
        cars: new Map() }; window.__revTick = ${tickRev.toString()};`);
      for (let done = 0; done < SECONDS * 60; done += CHUNK) {
        await page.evaluate(stepRev, Math.min(CHUNK, SECONDS * 60 - done));
      }
      const out = await page.evaluate(() => {
        const rev = window.__rev;
        return { outs: rev.outs, outsHeld: rev.outsHeld, giveUps: rev.giveUps,
          putBacks: rev.putBacks };
      });
      await page.context().close();
      console.log(`${id} seed ${seed} ${process.env.RAC3R_QUERY || '(off)'}: drive-outs (reverses)`
        + ` ${out.outs} (while held to a car ahead ${out.outsHeld}), give-ups ${out.giveUps},`
        + ` put-backs ${out.putBacks}${errors.length ? ' | ERR ' + errors[0] : ''}`);
    }
  }
} finally {
  await browser.close();
  server.stop();
}

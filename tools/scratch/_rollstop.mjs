// _rollstop.mjs - ROLLING STARTS AND THE STOPPED-CAR BRAKE (?rollfix=1's check; measure only):
// the real game,
// deterministic, nothing drawn, your car on ?autopilot. From the launch through the formation to
// 10 s past the green: the car-seconds the AI racers spend judging a car ahead as stopped (the
// stopped-car brake, ai/stopDodge.ts: drv.state.stopCar) before the green and in the 10 s after;
// the field's spread (first racer's race progress - the last's: _prog, the highway's _hwf.s) and
// its largest gap between two racers, at the green and 10 s after; the racers' mean speed in those
// 10 s; racer-on-racer touches (a new touch after 0.5 s apart) over the whole run. THE CASCADE, from
// the green to RACE_S (default 60) after it: a BRAKE EVENT is a racer starting to judge a car ahead
// as stopped at over 8 m/s; CHAINED when the car it judges had one of its own in the 2 s before;
// the events, the chained ones, the longest chain, and the car-s judging over that time.
// RUNS=twisty,dual,motorway,deaf,deafdual,naffcar,stockcar,dieatona (default all), SEED=1; the
// switch under test through RAC3R_QUERY (rollfix=1).
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  twisty: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'twisty' } },
  dual: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'dual' } },
  motorway: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'motorway' } },
  deaf: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'twisty', scenery: 'canyon' } },
  deafdual: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'dual', scenery: 'canyon' } },
  naffcar: { level: 'naffcar', opts: { ai: 19, laps: 30 } },
  stockcar: { level: 'stock-car', opts: { ai: 19, laps: 30 } },
  dieatona: { level: 'dieatona', opts: { ai: 19, laps: 30 } },
};
const RUN_IDS = (process.env.RUNS || Object.keys(ALL_RUNS).join(',')).split(',');
const SEED = Number(process.env.SEED || 1), AFTER_S = Number(process.env.RACE_S || 60);
const MAX_WAIT_S = 90;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: the field's spread and largest gap by race progress now. */
function fieldSpread() {
  const game = window.__game, endless = !!game.level.endless;
  const progs = game.ai.map((entry) => (endless ? entry.car._hwf?.s : entry.car._prog))
    .filter((value) => Number.isFinite(value)).sort((first, second) => second - first);
  if (progs.length < 2) return { spread: null, gap: null };
  let gap = 0;
  for (let i = 1; i < progs.length; i++) gap = Math.max(gap, progs[i - 1] - progs[i]);
  return { spread: progs[0] - progs[progs.length - 1], gap };
}

/** Page side: one frame. */
function tickRoll() {
  const run = window.__roll, game = window.__game, racers = game.ai;
  run.t += 1 / 60;
  const green = !game.start || !game.start.on || game.start.green;
  if (run.green == null && green) {
    run.green = run.t;
    run.atGreen = window.__rollSpread();
  }
  const since = run.green == null ? -1 : run.t - run.green;
  for (const entry of racers) {
    const judged = entry.drv.state.stopCar, was = run.judging.get(entry);
    run.judging.set(entry, judged || null);
    if (judged && judged !== was && run.green != null && since < AFTER_S_PAGE
      && Math.hypot(entry.car.vx, entry.car.vy) > 8) {
      const theirs = run.events.get(judged);
      const chain = theirs && run.t - theirs.t < 2 ? theirs.chain + 1 : 1;
      run.events.set(entry.car, { t: run.t, chain });
      run.brakes++;
      if (chain > 1) run.chained++;
      run.longest = Math.max(run.longest, chain);
    }
    if (!judged) continue;
    if (run.green == null) run.heldPre += 1 / 60;
    else if (since < 10) run.heldPost += 1 / 60;
    if (run.green != null && since < AFTER_S_PAGE) run.heldRace += 1 / 60;
  }
  if (run.green != null && since < 10) {
    for (const entry of racers) run.vSum += Math.hypot(entry.car.vx, entry.car.vy) / 60;
    run.vN += racers.length / 60;
  }
  if (run.green != null && run.after == null && since >= 10) run.after = window.__rollSpread();
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const one = racers[i].car, two = racers[j].car;
      if (Math.abs(one.x - two.x) > 12 || Math.abs(one.y - two.y) > 12) continue;
      if (!window.__rollTouch(one, two)) continue;
      const key = i * 100 + j, last = run.touching.get(key);
      if (last === undefined || run.t - last > 0.5) run.touches++;
      run.touching.set(key, run.t);
    }
  }
}

/** Page side: whether two bodies touch (each on the first's axes, no margin). */
function touchRoll(car, other) {
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

/** Page side: step frames; true once 10 s past the green (or past the wait). */
function stepRoll(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__rollTick();
  }
  const run = window.__roll;
  return run.green != null ? run.t - run.green >= window.__rollAfter + 0.5 : run.t >= 90;
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
  await page.evaluate(`const AFTER_S_PAGE = ${AFTER_S};
    window.__rollAfter = AFTER_S_PAGE;
    window.__roll = { t: 0, green: null, heldPre: 0, heldPost: 0, heldRace: 0, vSum: 0, vN: 0,
      touches: 0, touching: new Map(), atGreen: null, after: null, judging: new Map(),
      events: new Map(), brakes: 0, chained: 0, longest: 0 };
    window.__rollSpread = ${fieldSpread.toString()};
    window.__rollTick = ${tickRoll.toString()}; window.__rollTouch = ${touchRoll.toString()};`);
  let done = false;
  for (let guard = 0; !done && guard < (MAX_WAIT_S + AFTER_S) * 60 / 300 + 2; guard++) {
    done = await page.evaluate(stepRoll, 300);
  }
  const out = await page.evaluate(() => ({ ...window.__roll, touching: null, judging: null,
    events: null,
    racers: window.__game.ai.length }));
  await page.context().close();
  return { ...out, errors };
}

const fixed = (value, digits = 0) => (value == null ? '-' : value.toFixed(digits));
const server = await startServer();
const browser = await launchBrowser();
try {
  for (const id of RUN_IDS) {
    const out = await runOne(browser, server.url, id);
    console.log(`${id} seed ${SEED}: ${out.racers} AI | green at ${fixed(out.green, 1)} s |`
      + ` judging a stopped car: before the green ${fixed(out.heldPre, 1)} car-s, 10 s after`
      + ` ${fixed(out.heldPost, 1)} | spread / largest gap at the green ${fixed(out.atGreen?.spread)}`
      + ` / ${fixed(out.atGreen?.gap)} m, 10 s after ${fixed(out.after?.spread)} /`
      + ` ${fixed(out.after?.gap)} m | mean speed 10 s after ${fixed(out.vSum / Math.max(1e-6,
        out.vN) * 3.6)} km/h | touches ${out.touches} | to ${AFTER_S} s: brake events`
      + ` ${out.brakes}, chained ${out.chained}, longest chain ${out.longest}, judging`
      + ` ${fixed(out.heldRace, 1)} car-s`
      + `${out.errors.length ? ' ERR ' + out.errors[0] : ''}`);
  }
} finally {
  await browser.close();
  server.stop();
}

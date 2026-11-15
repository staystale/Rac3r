// _pileups.mjs - PILE-UPS IN A FIELD (?stopdodge=1's measure; measure only): the real game,
// deterministic, nothing drawn, your car on ?autopilot. Every racer-on-racer touch (bodies touching,
// no margin; a pair touching again after 0.5 s apart is a new one), its closing speed, and whether
// the racer behind had a STOPPED or much slower racer ahead (the one hit going under 3 m/s, or under
// half the hitter's speed); touches within 3 s and 60 m of an incident's last touch join it. Pace:
// the racers' mean speed, and (circuits) their mean lap from the game's own lap count.
// RUNS=brands,spa,knobhill,dual,twisty (default all), SECONDS=180, SEED=1, OUT=<file.json>;
// the switch under test through RAC3R_QUERY (stopdodge=1).
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, launchLevel, SETTLE_MS } from '../lib/determinism.mjs';

const ALL_RUNS = {
  brands: { level: 'brands-snatch', opts: { ai: 19, laps: 30 } },
  spa: { level: 'spa', opts: { ai: 19, laps: 30 } },
  knobhill: { level: 'knobhill', opts: { ai: 19, rx: true, laps: 30 } },
  dual: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'dual', scenery: 'canyon' } },
  twisty: { level: 'highway', opts: { ai: 5, traffic: 1.5, road: 'twisty' } },
};
const RUN_IDS = (process.env.RUNS || Object.keys(ALL_RUNS).join(',')).split(',');
const SECONDS = Number(process.env.SECONDS || 180), SEED = Number(process.env.SEED || 1);
const OUT = process.env.OUT || '', CHUNK = 600;
const SKIP = '&skip=world,ground,car&autopilot=1' + extraQuery();

/** Page side: one frame - distances, laps and new touches. */
function tickPile() {
  const pile = window.__pile, racers = window.__game.ai;
  pile.t += 1 / 60;
  for (const entry of racers) {
    const car = entry.car, speed = Math.hypot(car.vx, car.vy);
    pile.m += speed / 60;
    const lap = entry.drv.state.lap ?? 0, was = pile.laps.get(entry);
    if (was && lap > was.lap) {
      if (was.lap >= 1) pile.lapTimes.push(pile.t - was.t);
      pile.laps.set(entry, { lap, t: pile.t });
    } else if (!was) pile.laps.set(entry, { lap, t: pile.t });
  }
  for (let i = 0; i < racers.length; i++) {
    for (let j = i + 1; j < racers.length; j++) {
      const one = racers[i].car, two = racers[j].car;
      if (Math.abs(one.x - two.x) > 12 || Math.abs(one.y - two.y) > 12) continue;
      if (!window.__pileTouch(one, two)) continue;
      const key = i * 100 + j, last = pile.touching.get(key);
      if (last === undefined || pile.t - last > 0.5) {
        pile.hits.push(window.__pileRecord(racers[i], racers[j]));
      }
      pile.touching.set(key, pile.t);
    }
  }
}

/** Page side: whether two bodies touch (each on the first's axes, no margin). */
function touchPile(car, other) {
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

/** Page side: one touch - where, when, closing speed, and whether it was into a stopped car. */
function recordPile(entryOne, entryTwo) {
  const pile = window.__pile, one = entryOne.car, two = entryTwo.car;
  const speedOne = Math.hypot(one.vx, one.vy), speedTwo = Math.hypot(two.vx, two.vy);
  // the hitter: the one moving toward the other faster
  const toward = (car, other) => ((other.x - car.x) * car.vx + (other.y - car.y) * car.vy)
    / Math.max(0.01, Math.hypot(other.x - car.x, other.y - car.y));
  const oneHits = toward(one, two) >= toward(two, one);
  const hitter = oneHits ? speedOne : speedTwo, hit = oneHits ? speedTwo : speedOne;
  // what the hitter's driver was doing: braking for a stopped car (?stopdodge=1's judgement set),
  // its target speed, its brake light
  const state = (oneHits ? entryOne : entryTwo).drv.state, car = oneHits ? one : two;
  return { t: pile.t, x: one.x, y: one.y, closing: Math.hypot(one.vx - two.vx, one.vy - two.vy),
    stopped: hit < 3 || hit < 0.5 * hitter, hitter, hit, judging: !!state.stopCar,
    targetV: state.vT, brake: car.brakeLight || 0, think: state.t };
}

/** Node side: touches grouped into incidents. */
function incidentsOf(hits) {
  const groups = [];
  for (const hit of hits) {
    const open = groups.find((group) => hit.t - group.last.t <= 3
      && Math.hypot(hit.x - group.last.x, hit.y - group.last.y) <= 60);
    if (open) {
      open.n++;
      open.last = hit;
    } else groups.push({ n: 1, last: hit });
  }
  return groups;
}

/** Page side: step frames. */
function stepPile(count) {
  for (let frame = 0; frame < count; frame++) {
    window.__rt.step(1);
    window.__pileTick();
  }
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
  await page.evaluate(`window.__pile = { t: 0, m: 0, hits: [], touching: new Map(),
    laps: new Map(), lapTimes: [] };
    window.__pileTick = ${tickPile.toString()}; window.__pileTouch = ${touchPile.toString()};
    window.__pileRecord = ${recordPile.toString()};`);
  for (let done = 0; done < SECONDS * 60; done += CHUNK) {
    await page.evaluate(stepPile, Math.min(CHUNK, SECONDS * 60 - done));
  }
  const out = await page.evaluate(() => ({ hits: window.__pile.hits, m: window.__pile.m,
    racers: window.__game.ai.length, lapTimes: window.__pile.lapTimes }));
  await page.context().close();
  out.errors = errors.slice(0, 3);
  return out;
}

const server = await startServer();
const browser = await launchBrowser();
const report = {};
try {
  for (const id of RUN_IDS) {
    const out = await runOne(browser, server.url, id);
    report[id] = out;
    const km = out.m / 1000, groups = incidentsOf(out.hits);
    const into = out.hits.filter((hit) => hit.stopped).length;
    const hard = out.hits.filter((hit) => hit.closing >= 15 / 3.6).length;
    const lap = out.lapTimes.length
      ? (out.lapTimes.reduce((sum, time) => sum + time, 0) / out.lapTimes.length).toFixed(1) : '-';
    console.log(`${id} seed ${SEED}: ${out.racers} racers ${km.toFixed(1)} km`
      + ` (${(km * 3600 / SECONDS / out.racers).toFixed(1)} km/h) | touches ${out.hits.length}`
      + ` (into a stopped / much slower racer ${into}, 15 km/h+ ${hard}) | incidents`
      + ` ${groups.length} (${(10 * groups.length / Math.max(0.1, km)).toFixed(2)} per 10 km,`
      + ` ${(out.hits.length / Math.max(1, groups.length)).toFixed(2)} touches each, 5+:`
      + ` ${groups.filter((group) => group.n >= 5).length}) | laps ${out.lapTimes.length} mean`
      + ` ${lap} s${out.errors.length ? ' ERR ' + out.errors[0] : ''}`);
  }
} finally {
  await browser.close();
  server.stop();
}
if (OUT) writeFileSync(OUT, JSON.stringify(report, null, 1));

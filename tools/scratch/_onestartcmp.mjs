// _onestartcmp.mjs - A START ON A NEW LEVEL, THE RESTART ONCE OR TWICE (scratch): simhash's way (the
// determinism script: seeded Math.random, a fake clock, frames stepped by hand) with the page
// opened on one level and the race launched on ANOTHER - the path ?onestart=1 changes (simhash and
// renderhash open the page on the level they launch, so their launch switches no level). Run with
// the switch off and on (and both again with ?loadscreen=1 when LOADSCREEN=1), the player's
// controls held (full throttle, straight on), and compared STEP BY STEP OF SIM TIME (the lights'
// clock x 120): every car's pose, speeds, gear, rpm, damage, lap, the AI driver's state and its car,
// the lights and the loose objects' hash. Also counts the Math.random draws from the launch to the
// race's first step, and the lights armed (seen a frame at a time). SAME or the first difference.
// Then the switch-on run again with the seeded stream first advanced by the draws the switch-off
// run made more (the field line-up the switch drops draws the grid slot and the AI's cars from
// Math.random): SAME there shows that stream's place is the whole difference.
// [FRAMES=600] [LOADSCREEN=1] node tools/scratch/_onestartcmp.mjs [from>to[:rx] ...]
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel } from '../lib/determinism.mjs';

const SPECS = process.argv.slice(2).length ? process.argv.slice(2)
  : ['lab>thruston', 'thruston>knobhill:rx'];
const FRAMES = +(process.env.FRAMES || 600), SEED = 0x5eed;
const LOADSCREEN = process.env.LOADSCREEN === '1' ? '&loadscreen=1' : '';
const SKIP = '&skip=world,ground,car';
// frames stepped at the most while waiting for the race's first step
const WAIT_FRAMES = 2400;

/**
 * Page side: the state of every car, the start and the loose objects, numbers to 1e-6.
 * @returns {Record<string, unknown>} the state
 */
function snapshot() {
  const num = (value) => (Number.isFinite(value) ? Math.round(value * 1e6) / 1e6 : String(value));
  const game = window.__game;
  const carOf = (car) => [car.x, car.y, car.heading, car.vx, car.vy, car.yawRate, car.rpm,
    car.dmgBill || 0, car._prog ?? 0].map(num).concat([car.gear, car.dmgHits || 0]);
  const out = { start: [num(game.start.t), game.start.green], player: carOf(game.car),
    lap: [game.lap.lap, num(game.lap.lapTime), num(game.race.t)] };
  game.ai.forEach((entry, index) => {
    const drv = entry.drv.state || {};
    out['ai' + index] = carOf(entry.car).concat([drv.lap ?? -1, drv.i ?? -1, num(drv.vT ?? 0),
      entry.car.spec.id]);
  });
  let hash = 2166136261;
  for (const item of game.cones.list) {
    const text = num(item.x) + ',' + num(item.y) + ';';
    for (let at = 0; at < text.length; at++) hash = Math.imul(hash ^ text.charCodeAt(at), 16777619);
  }
  out.objects = [game.cones.list.length, hash >>> 0];
  return out;
}

/**
 * Page side: counts Math.random draws, and the restarts / field line-ups (the frame log of the
 * lights being armed: a new start object each line-up).
 * @returns {void}
 */
function installCounters() {
  const game = window.__game, draw = Math.random;
  window.__draws = 0;
  Math.random = () => {
    window.__draws++;
    return draw();
  };
  window.__lineUps = 0;
  let lastStart = game.start;
  window.__watchStart = () => {
    if (game.start !== lastStart) {
      lastStart = game.start;
      window.__lineUps++;
    }
  };
}

/**
 * Steps one frame, letting the page's own tasks (timers) run after it.
 * @param {import('playwright').Page} page the page
 */
async function stepOne(page) {
  await page.evaluate(() => {
    window.__rt.step(1);
    window.__watchStart();
  });
  await page.waitForTimeout(2);
}

/**
 * One run: the page on `from`, the race on `to` with 5 AI, stepped to the race's first step, then
 * sampled every frame.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base the server
 * @param {string} spec from>to[:rx]
 * @param {boolean} isOn ?onestart=1
 * @param {number} [preDraws] Math.random draws made after seeding, before the launch
 * @returns {Promise<{draws: number, lineUps: number, raceAt: number, samples: Map}>} the run
 */
async function runOne(browser, base, spec, isOn, preDraws = 0) {
  const [from, target] = spec.split('>');
  const [level, kind] = target.split(':');
  const errors = [];
  const page = await openPage(browser, base, from, errors,
    SKIP + LOADSCREEN + (isOn ? '&onestart=1' : ''));
  await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })));
  for (let frame = 0; frame < 120; frame++) await page.evaluate(() => window.__rt.step(1));
  await page.evaluate(([seed, count]) => {
    window.__rt.seed(seed);
    for (let draw = 0; draw < count; draw++) Math.random();
  }, [SEED, preDraws]);
  await page.evaluate(installCounters);
  await page.evaluate(launchLevel, [level, { ai: 5, rx: kind === 'rx' }]);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__game.input.update = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: 0,
      reverse: 0, shiftUp: false, shiftDown: false });
  });
  let raceAt = 0;
  while (!await page.evaluate('window.__game.start.on && window.__game.start.t > 0')) {
    if (++raceAt > WAIT_FRAMES) throw new Error(`${spec}: the race never started`);
    await stepOne(page);
  }
  const { draws, lineUps } = await page.evaluate(() => ({ draws: window.__draws,
    lineUps: window.__lineUps }));
  const samples = new Map();
  await page.evaluate(`window.__snap = ${snapshot.toString()}`);
  for (let frame = 0; frame < FRAMES; frame++) {
    const state = await page.evaluate(() => {
      const now = window.__snap();
      window.__rt.step(1);
      return now;
    });
    samples.set(Math.round(state.start[0] * 120), state);
  }
  await page.context().close();
  if (errors.length) throw new Error(`${spec} ${isOn ? 'on' : 'off'}: ${errors[0]}`);
  return { draws, lineUps, raceAt, samples };
}

/**
 * The steps both runs sampled, and the first where they differ.
 * @param {Map<number, object>} off the switch-off samples by step
 * @param {Map<number, object>} on the switch-on samples by step
 * @returns {{common: number, diff: string|null}} steps compared, the first difference or null
 */
function compareRuns(off, on) {
  const steps = [...off.keys()].filter((step) => on.has(step)).sort((one, two) => one - two);
  for (const step of steps) {
    const was = off.get(step), now = on.get(step);
    for (const key of Object.keys({ ...was, ...now })) {
      if (JSON.stringify(was[key]) !== JSON.stringify(now[key]))
        return { common: steps.length, diff: `step ${step}, ${key}: off ${JSON.stringify(was[key])}`
          + ` on ${JSON.stringify(now[key])}` };
    }
  }
  return { common: steps.length, diff: null };
}

const server = await startServer();
const browser = await launchBrowser();
let bad = 0;
try {
  for (const spec of SPECS) {
    const off = await runOne(browser, server.url, spec, false);
    const on = await runOne(browser, server.url, spec, true);
    const { common, diff } = compareRuns(off.samples, on.samples);
    const extra = off.draws - on.draws;
    const aligned = await runOne(browser, server.url, spec, true, extra);
    const lined = compareRuns(off.samples, aligned.samples);
    if (lined.diff || lined.common < FRAMES / 2) bad++;
    const fieldOf = (run) => Object.keys(run.samples.values().next().value)
      .filter((key) => key.startsWith('ai')).length;
    console.log(`${spec}${LOADSCREEN ? ' (loadscreen)' : ''}: launch to the race's first step -`
      + ` off ${off.draws} random draws, ${off.lineUps} line-ups, ${off.raceAt} frames, ${fieldOf(off)}`
      + ` AI; on ${on.draws} draws, ${on.lineUps} line-ups, ${on.raceAt} frames, ${fieldOf(on)} AI;`
      + ` ${common} sim steps compared: ${diff ? 'DIFFERENT ' + diff : 'SAME'};`
      + ` on with the stream ${extra} draws on: ${lined.common} steps,`
      + ` ${lined.diff ? 'DIFFERENT ' + lined.diff : 'SAME'}`);
  }
  console.log(bad ? `onestartcmp: DIFFERENT (${bad})` : 'onestartcmp: SAME');
  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
  server.stop();
}

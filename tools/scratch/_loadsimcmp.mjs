// _loadsimcmp.mjs - THE RACE IS THE SAME BEHIND THE LOADING SCREEN (scratch): simhash's way (the
// determinism script: seeded Math.random, a fake clock, frames stepped by hand; the demo driver on
// the player's controls held, as simhash's crash run: full throttle, straight on) run twice per
// level, switch off and ?loadscreen=1, and compared STEP BY STEP OF SIM TIME: the switch holds the
// sim through the screen and the fly-in, so the same race starts later in frames (simhash samples
// at fixed frames from the launch and cannot line the two up). The switch-on run goes first; the
// switch-off run is then launched on the same frame and held under the guide card (which, as the
// switch's hold, drops the accumulator) until the frame the switch-on race first stepped, so both
// races start on the same frame with the same clock: the frame pacer splits the steps over the
// frames alike (2 a frame, now and then 1 or 3 - a different split moves a race, as the player's
// release at the green is read once a frame, as uneven real frames do anyway). After every frame:
// every car's pose, speeds, gear, rpm, damage, lap and the AI driver's state, the lights' clock and
// the loose objects' hash, filed by sim step (the lights' clock x 120); compared at every step both
// runs sampled. SAME or the first difference. Held controls, not the demo driver: its input is read
// once a frame, so a different split of steps over frames would steer the player differently.
// [FRAMES=900] [SKIP=0: draw everything] node tools/scratch/_loadsimcmp.mjs [level[:rx] ...]
import { startServer, launchBrowser } from '../lib/browser.mjs';
import { openPage, launchLevel } from '../lib/determinism.mjs';

const LEVELS = process.argv.slice(2).length ? process.argv.slice(2) : ['thruston', 'knobhill:rx'];
const FRAMES = +(process.env.FRAMES || 900), SEED = 0x5eed;
const SKIP = process.env.SKIP === '0' ? '' : '&skip=world,ground,car';
// frames stepped at the most while waiting for a load or the sim's first step
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
    out['ai' + index] = carOf(entry.car).concat([drv.lap ?? -1, drv.i ?? -1, num(drv.vT ?? 0)]);
  });
  let hash = 2166136261;
  for (const item of game.cones.list) {
    const text = num(item.x) + ',' + num(item.y) + ';';
    for (let at = 0; at < text.length; at++) hash = Math.imul(hash ^ text.charCodeAt(at), 16777619);
  }
  out.objects = [game.cones.list.length, hash >>> 0];
  return out;
}

// frames stepped on the page so far (every frame goes through stepOne)
let frameNo = 0;

/**
 * Steps one frame, letting the page's own tasks (timers) run after it.
 * @param {import('playwright').Page} page the page
 */
async function stepOne(page) {
  await page.evaluate(() => window.__rt.step(1));
  frameNo++;
  await page.waitForTimeout(2);
}

/**
 * Steps one frame at a time until a test holds, or until frame `until` when given.
 * @param {import('playwright').Page} page the page
 * @param {string} test a page-side expression
 * @param {number} [until] the frame number to step to instead
 * @returns {Promise<void>}
 */
async function stepUntil(page, test, until = -1) {
  for (let count = 0; count < WAIT_FRAMES; count++) {
    if (until >= 0 ? frameNo >= until : await page.evaluate(test)) return;
    await stepOne(page);
  }
  throw new Error(`never: ${test}`);
}

const IDLE = "(() => { const el = document.getElementById('loadscreen');"
  + " return (!el || el.className === 'gone') && !window.__game.renderer.flying; })()";

/**
 * One run: the level launched with 5 AI, stepped to the race's first step, then sampled. The
 * switch-off run (plan given) launches on the switch-on run's frame and is held under the guide
 * card until the frame before the switch-on race's first step.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} base the server
 * @param {string} spec level[:rx]
 * @param {{launchAt: number, raceAt: number}|null} plan the switch-on run's frames, or null (on)
 * @returns {Promise<{launchAt: number, raceAt: number, samples: Map<number, object>}>} the frame
 * of the launch and of the race's first step, the samples by sim step
 */
async function runOne(browser, base, spec, plan) {
  const [level, kind] = spec.split(':');
  const errors = [], isOn = !plan;
  const page = await openPage(browser, base, level, errors, SKIP + (isOn ? '&loadscreen=1' : ''));
  frameNo = 0;
  await page.evaluate(() => dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })));
  await stepUntil(page, IDLE);
  if (plan) await stepUntil(page, '', plan.launchAt);
  const launchAt = frameNo;
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [level, { ai: 5, rx: kind === 'rx' }]);
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__game.input.update = () => ({ steer: 0, throttle: 1, brake: 0, handbrake: 0,
      reverse: 0, shiftUp: false, shiftDown: false });
  });
  if (plan) {
    await page.evaluate(() => window.__game.guide.open());
    await stepUntil(page, '', plan.raceAt - 1);
    await page.evaluate(() => window.__game.guide.close());
  }
  await stepUntil(page, 'window.__game.start.on && window.__game.start.t > 0');
  const raceAt = frameNo;
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
  return { launchAt, raceAt, samples };
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
  for (const spec of LEVELS) {
    const on = await runOne(browser, server.url, spec, null);
    const off = await runOne(browser, server.url, spec, on);
    const { common, diff } = compareRuns(off.samples, on.samples);
    if (diff || common < FRAMES / 2) bad++;
    console.log(`${spec}: launched on frame ${on.launchAt} (off ${off.launchAt}), the race's`
      + ` first step on frame ${on.raceAt} (off ${off.raceAt});`
      + ` ${common} sim steps compared over ${FRAMES} frames: ${diff ? 'DIFFERENT ' + diff
        : 'SAME'}`);
  }
  console.log(bad ? `loadsimcmp: DIFFERENT (${bad})` : 'loadsimcmp: SAME');
  if (bad) process.exitCode = 1;
} finally {
  await browser.close();
  server.stop();
}

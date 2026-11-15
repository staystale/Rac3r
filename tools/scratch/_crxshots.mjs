// _crxshots.mjs - CROUGHED RX IN THE REAL GAME, PHOTOGRAPHED (scratch): the menu's setup for the
// level (TEST MODE -> RALLYCROSS -> Croughed RX: its rows' buttons read, and a photo), then a race
// with 20 AI launched as the game launches one, your car driven by the racing AI (as _crxrace).
// Photos on the grid, just after the green, and each lap at the chicane's turn onto the gravel,
// the gravel hairpin and the infield's return leg (where the joker loop was); a last one of the
// infield from above the return leg with the race paused. Read: the level's joker (none), the race
// flag and laps, each lap counted, page errors.
// SHOTS=<folder> VIEW=844x390 node tools/scratch/_crxshots.mjs [laps] [seed]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const [lapsArg = '2', seedArg = '1'] = process.argv.slice(2);
const SHOTS = process.env.SHOTS || 'crxshots';
const [VIEW_W, VIEW_H] = (process.env.VIEW || '844x390').split('x').map(Number);
const TAG = `${VIEW_W}x${VIEW_H}`;
// lap m windows photographed each lap (the lap starts where the start lane meets it)
const SPOTS = [['gravel-turn', 560], ['hairpin', 930], ['infield', 1150]];
// s: the most the race may take
const DEADLINE_S = 420;

const wait = (page, ms) => page.waitForTimeout(ms);
const shot = (page, name) => page.screenshot({ path: `${SHOTS}/crx-${name}-${TAG}.png` });

/**
 * In the page: launches the race, your car driven by the racing AI.
 * @param {[number]} args laps
 * @returns {Promise<object>} what the level and the race say
 */
async function startRace([laps]) {
  const game = window.__game;
  const circuit = await import('/src/ai/circuit.ts'), traits = await import('/src/ai/traits.ts');
  const lab = await import('/src/lab.ts');
  const shared = (await import('/src/game/state.ts')).shared;
  game.menu.hide();
  game.launch('croughedrx', 'rx-super', { ai: 20, diff: 2, laps, aiCars: 'class' });
  // (the launch runs behind the loading screen: the level and its field come a moment later)
  for (let tries = 0; tries < 300 && !(lab.LEVEL.id === 'croughedrx' && game.ai.length === 20);
    tries++) await new Promise((done) => setTimeout(done, 100));
  const driver = circuit.createAIDriver(lab.LEVEL, traits.aiTraits(2, 0, 1, 99));
  game.input.update = () => ({ ...driver.drive(game.car, 1 / 60, { cars: game.ai.map((entry) =>
    entry.car), lap: 1, laps }), reverse: 0, shiftUp: false, shiftDown: false });
  return { level: lab.LEVEL.id, joker: lab.LEVEL.joker ?? null, raceOn: shared.race.on,
    lanes: (lab.LEVEL.lanes || []).length, ai: game.ai.length };
}

/**
 * In the page: the race now - your lap m and lap, the flow's state and laps, each car's laps.
 * @returns {object} the state
 */
async function readRace() {
  const game = window.__game, lab = await import('/src/lab.ts');
  const hit = lab.querySubtrack(lab.LEVEL.subtrack, game.car.x, game.car.y);
  const flow = game.flow;
  return { dist: hit.trackDist, off: hit.dist, x: game.car.x, y: game.car.y,
    green: !!game.start?.green, state: flow && flow.state, laps: flow && flow.laps,
    t: flow ? flow.t : 0, shown: !!game.flowShown,
    done: flow ? flow.entries.map((entry) => entry.lapDone) : [],
    finished: flow ? flow.entries.filter((entry) => entry.finish != null).length : 0,
    penalties: flow && flow.results ? flow.results.map((row) => row.penalty).filter(Boolean) : [] };
}

/**
 * Opens the level's setup through the menu and reads its buttons.
 * @param {import('playwright').Page} page the page
 * @returns {Promise<string[]>} the setup's button texts
 */
async function readSetup(page) {
  await page.getByText('TEST MODE', { exact: true }).click();
  await wait(page, 800);
  await page.locator('button.cat', { hasText: 'RALLYCROSS' }).click();
  await wait(page, 800);
  await page.locator('button.card', { hasText: 'Croughed RX' }).click();
  await wait(page, 800);
  return page.locator('#menu button').allInnerTexts();
}

mkdirSync(SHOTS, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
const errors = [];
try {
  const ctx = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H },
    deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&rules=0&noaudio=1&seed=${seedArg}`
    + extraQuery());
  await page.waitForFunction(() => window.__game.mode === 'menu', null, { timeout: 60000,
    polling: 250 });
  await wait(page, 1500);
  const buttons = await readSetup(page);
  console.log('setup buttons:', buttons.map((text) => text.replace(/\s+/g, ' ').trim())
    .filter(Boolean).join(' | '));
  await shot(page, 'setup');
  const info = await page.evaluate(startRace, [+lapsArg]);
  console.log('launched:', JSON.stringify(info));
  await wait(page, 2500);
  await shot(page, 'grid');
  const lastAt = {};
  let count = 0;
  const started = Date.now();
  let state = null, greenShot = false;
  while (Date.now() - started < DEADLINE_S * 1000) {
    await wait(page, 100);
    state = await page.evaluate(readRace);
    if (state.shown || state.state === 'done') break;
    if (state.green && !greenShot) {
      await wait(page, 2500);
      await shot(page, 'green');
      greenShot = true;
      continue;
    }
    if (!state.green || state.off > 12) continue;
    for (const [name, at] of SPOTS) {
      if (state.dist < at || state.dist >= at + 25 || Date.now() - (lastAt[name] ?? 0) < 20000)
        continue;
      lastAt[name] = Date.now();
      count++;
      await shot(page, `${name}-${count}`);
      console.log(`shot ${name}-${count} at lap m ${state.dist.toFixed(0)} (${state.x.toFixed(0)},`
        + `${state.y.toFixed(0)}) race ${Number(state.t).toFixed(1)}`);
    }
  }
  console.log('race end:', JSON.stringify(state));
  // the infield from the return leg, the results put away: your car set down on the leg beside
  // where the joker loop was, held still
  await page.evaluate(() => {
    const game = window.__game, car = game.car;
    game.menu.hide();
    game.input.update = () => ({ steer: 0, throttle: 0, brake: 1, handbrake: 0, reverse: 0,
      shiftUp: false, shiftDown: false });
    Object.assign(car, { x: 108, y: -70, heading: -Math.PI / 2, vx: 0, vy: 0, _p: null });
    game.renderer.snap(car);
  });
  await wait(page, 1200);
  await shot(page, 'infield-still');
  console.log('page errors:', errors.length ? errors.slice(0, 5).join(' / ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

// carlapshot.mjs - ONE CAR RACING, photographed at both phone sizes: a race on LEVEL with 5 AI in
// the same car (the setup's "same car" field), your car on ?autopilot, deterministic (seeded, fake
// clock, tools/lib/determinism.mjs); at each of AT seconds after the launch a shot at 844x390 and
// at 390x844, the camera on your car, with its speed and place. Page errors fail the run.
// node tools/carlapshot.mjs <car> [level] [out folder]     (tools/newcar.mjs runs it)
// AT=8,30 (seconds), SEED=1, AI=5, CHECK_PORT=<port> (the dev server, tools/lib/browser.mjs)
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser, gotoGame, extraQuery } from './lib/browser.mjs';
import { installDeterminism, launchLevel, SETTLE_MS } from './lib/determinism.mjs';

const [CAR = 'hatch-rwd', LEVEL = 'thruston', OUT = 'shots/carlapshot'] = process.argv.slice(2);
const AT = (process.env.AT || '8,30').split(',').map(Number);
const SEED = Number(process.env.SEED || 1), AI = Number(process.env.AI || 5);
// the two phone sizes every visual change is checked at (CLAUDE.md 4)
const VIEWS = [[844, 390], [390, 844]];
// frames a second of the fake clock
const FPS = 60;

/** Page side: your car's speed, gear and place in the race now. */
function readCar() {
  const game = window.__game, car = game.car;
  return { kph: +(Math.hypot(car.vx, car.vy) * 3.6).toFixed(0), gear: car.gear,
    racers: game.ai.length, offRoad: !!(car.surface && !car.surface.hard),
    surface: car.surface ? car.surface.id : null };
}

/**
 * One phone size: launch the race, step to each time in AT, photograph it.
 * @param {object} browser the Playwright browser
 * @param {string} base the server's URL
 * @param {number[]} view [width, height] in CSS px
 * @returns {Promise<string[]>} the page errors
 */
async function shootView(browser, base, [width, height]) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.addInitScript(installDeterminism);
  await gotoGame(page, `${base}/?touch=1&guide=0&menu=0&rules=0&loadscreen=0&noaudio=1`
    + `&level=${LEVEL}&autopilot=1${extraQuery()}`, 'window.__rt');
  await page.waitForTimeout(SETTLE_MS);
  await page.evaluate(() => {
    dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    window.__rt.step(10);
  });
  await page.evaluate((seed) => window.__rt.seed(seed), SEED);
  await page.evaluate(launchLevel, [LEVEL, { car: CAR, ai: AI }]);
  await page.waitForTimeout(SETTLE_MS);
  let now = 0;
  for (const seconds of AT) {
    await page.evaluate((frames) => window.__rt.step(frames), Math.max(0, (seconds - now) * FPS));
    now = seconds;
    const file = `${OUT}/lap-${CAR}-${LEVEL}-${seconds}s-${width}x${height}.png`;
    await page.screenshot({ path: file });
    console.log(`${file} ${JSON.stringify(await page.evaluate(readCar))}`);
  }
  await context.close();
  return errors;
}

mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
let failed = false;
try {
  for (const view of VIEWS) {
    const errors = await shootView(browser, server.url, view);
    if (errors.length) {
      failed = true;
      console.log(`PAGE ERRORS ${view.join('x')}: ${errors.slice(0, 3).join(' | ')}`);
    }
  }
} finally {
  await browser.close();
  server.stop();
}
process.exit(failed ? 1 : 0);

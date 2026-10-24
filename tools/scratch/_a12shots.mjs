// _a12shots.mjs - photographs A1 and A2 at 844x390, each switch off then on, into the scratch
// folder given (default the OS temp folder).
// A2 (?decklight=1): night (?night=0.9), your car just short of a Castle Cum footbridge, lights
//   on, the sim paused: off the beams light the deck's top, on they stop at its edge.
// A1 (?skyblend=1): Castle Cum in heavy rain at the first minute of the golden hour (where the
//   colour switched in one step: off orange, on still the cloud's) and mid golden hour; and dry
//   mid golden hour (the sunset colour itself, unchanged in clear air).
// node tools/scratch/_a12shots.mjs [folder]
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const folder = process.argv[2] || tmpdir();
const viewport = { width: 844, height: 390 };
const server = await startServer();
const browser = await launchBrowser();

/**
 * Opens the game with a query and launches Castle Cum solo in a weather mode.
 * @param {string} query the extra page query
 * @param {string} weather the weather mode (dry, heavy)
 * @returns {Promise<import('playwright').Page>} the page, racing
 */
async function openRace(query, weather) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.log('PAGE ERROR ' + error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&menu=0&rules=0&noaudio=1${query}`);
  await page.mouse.click(viewport.width / 2, viewport.height / 2);
  await page.waitForTimeout(500);
  await page.evaluate((mode) => window.__game.launch('castle-cum', 'hatch-rwd',
    { ai: 0, weather: { mode, season: 2, seed: 4 } }), weather);
  await page.waitForTimeout(6000);
  return page;
}

/**
 * A2: the car 9 m short of the first footbridge, facing it, lights on, the sim paused.
 * @param {import('playwright').Page} page the page
 */
async function parkAtFootbridge(page) {
  await page.evaluate(async () => {
    const game = window.__game, lab = await import('/src/lab.js');
    const { shared } = await import('/src/game/state.js');
    const bridge = lab.LEVEL.props.find((prop) => prop.kind === 'footbridge');
    const sub = lab.LEVEL.subtrack, near = lab.querySubtrack(sub, bridge.x, bridge.y);
    const heading = sub.pts[near.seg].heading;
    game.car.x = bridge.x - Math.cos(heading) * 9;
    game.car.y = bridge.y - Math.sin(heading) * 9;
    game.car.heading = heading;
    game.car.vx = game.car.vy = 0;
    game.car.lightsOn = true;
    shared.paused = true;
  });
  await page.waitForTimeout(800);
}

/**
 * A1: the event clock set to an hour relative to sunset and the sky put up at once.
 * @param {import('playwright').Page} page the page
 * @param {number} beforeSunsetH hours before sunset
 */
async function skyAt(page, beforeSunsetH) {
  await page.evaluate(async (hoursBefore) => {
    const clock = await import('/src/world/clock.ts');
    const { setSky } = await import('/src/world/daylight.ts');
    const { WEATHER } = await import('/src/world/weather.ts');
    const { shared } = await import('/src/game/state.js');
    shared.paused = true;
    const dayStart = Math.floor(clock.CLOCK.eventS / 86400) * 86400;
    const sun = clock.sunTimes(clock.calendarAt(dayStart + 12 * 3600).yearFraction);
    clock.CLOCK.eventS = dayStart + (sun.sunset - hoursBefore) * 3600;
    setSky(clock.skyNow(WEATHER.rain));
  }, beforeSunsetH);
  await page.waitForTimeout(600);
}

try {
  for (const isOn of [false, true]) {
    const tag = isOn ? 'on' : 'off';
    const night = await openRace('&night=0.9' + (isOn ? '&decklight=1' : ''), 'dry');
    await parkAtFootbridge(night);
    await night.screenshot({ path: join(folder, `a2-deck-${tag}.png`) });
    await night.context().close();
    for (const [weather, hours] of [['heavy', 0.99], ['heavy', 0.5], ['dry', 0.5]]) {
      const page = await openRace(isOn ? '&skyblend=1' : '', weather);
      await skyAt(page, hours);
      const sky = await page.evaluate(async () => {
        const { DAYLIGHT } = await import('/src/world/daylight.ts');
        return DAYLIGHT.darkness.toFixed(3) + ' ' + DAYLIGHT.rgb;
      });
      const name = `a1-${weather}-${hours}h-${tag}.png`;
      await page.screenshot({ path: join(folder, name) });
      console.log(name, 'sky', sky);
      await page.context().close();
    }
  }
} finally {
  await browser.close();
  server.stop();
}

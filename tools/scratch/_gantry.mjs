// _gantry.mjs - THE START GANTRY'S LIGHTS (?gantrylights; world/startlights.ts): a race VS AI on a
// level with a start gantry, you held on the line (no throttle); photos as the start clock passes
// each moment - before the reds, 1 red, 3 reds, the green, after it. The lights the game set are
// read with each photo. tools/scratch/_gantry-<level>-<moment>-<view>.png. RAC3R_QUERY: switches.
// [LEVEL=sweaty-lamb] [VIEW=390x844] node tools/scratch/_gantry.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const LEVEL_ID = process.env.LEVEL || 'sweaty-lamb';
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
// start-clock seconds to photo at, and their names (the green is at 4 s)
const MOMENTS = [[0.5, 'dark'], [1.5, 'red1'], [3.5, 'red3'], [4.4, 'green'], [8, 'after']];
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1` + extraQuery());
  await page.evaluate((id) => window.__game.launch(id, 'saloon-rwd', { ai: 3, diff: 2, laps: 1,
    weather: { mode: 'dry', season: 2, seed: 4 } }), LEVEL_ID);
  await page.waitForTimeout(1500);
  await page.mouse.click(width / 2, height / 2);
  for (const [atS, name] of MOMENTS) {
    await page.waitForFunction((at) => window.__game.start.t >= at, atS,
      { polling: 16, timeout: 30000 });
    const lights = await page.evaluate(async () => {
      const { START_LIGHTS } = await import('/src/world/startlights.ts');
      return { t: +window.__game.start.t.toFixed(2), ...START_LIGHTS };
    });
    await page.screenshot({ path: `tools/scratch/_gantry-${LEVEL_ID}-${name}-${width}x${height}.png` });
    console.log(name, JSON.stringify(lights));
  }
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

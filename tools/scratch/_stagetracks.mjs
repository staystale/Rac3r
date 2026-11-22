// _stagetracks.mjs - A STAGE'S TYRE TRACKS (?stagetracks; game/stagetracks.ts): a stage VS AI
// with cars started before you (launched again until one is MINSLOT ahead), you on the autopilot.
// Reads the ms the tracks took and the marks laid; photos at your green (the start line) and as
// you reach where each car ahead was placed (its painted tracks should run into its own marks).
// Photos tools/scratch/_stagetracks-<what>-<view>.png. RAC3R_QUERY carries the switches.
// [LEVEL=sweaty-lamb] [VIEW=390x844] [MINSLOT=-3] node tools/scratch/_stagetracks.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const LEVEL_ID = process.env.LEVEL || 'sweaty-lamb', MIN_SLOT = +(process.env.MINSLOT || -3);
const [width, height] = (process.env.VIEW || '390x844').split('x').map(Number);
const LIMIT_S = 120;
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width, height } })).newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&autopilot=1` + extraQuery());
  let field = null;
  for (let tries = 0; tries < 20; tries++) {
    await page.evaluate((levelId) => window.__game.launch(levelId, 'saloon-rwd', { ai: 5, diff: 2,
      laps: 1, weather: { mode: 'dry', season: 2, seed: 4 } }), LEVEL_ID);
    await page.waitForTimeout(1500);
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(1500);
    field = await page.evaluate(() => {
      const game = window.__game;
      return { tracksMs: game.stageTracksMs ?? null, stamps: game.marks.stamps,
        green: game.start.tGreen, ahead: game.ai.map((entry) => entry.car)
          .filter((car) => car._slot < 0).map((car) => ({ num: car.num, slot: car._slot,
            prog: Math.round(car._prog) })),
        home: (game.aiDone || []).map((car) => car.num) };
    });
    if (Math.min(0, ...field.ahead.map((car) => car.slot)) <= MIN_SLOT) break;
  }
  console.log('field', JSON.stringify(field));
  const shot = (what) => page.screenshot({ path:
    `tools/scratch/_stagetracks-${LEVEL_ID}-${what}-${width}x${height}.png` });
  await page.waitForFunction(() => window.__game.start.t >= window.__game.start.tGreen, null,
    { polling: 100, timeout: 20000 });
  await shot('start');
  const spots = [...field.ahead].sort((one, two) => one.prog - two.prog);
  const began = Date.now();
  for (const spot of spots) {
    // (the camera leads the car: photo a little before the spot, so it is in view ahead)
    const reached = await page.waitForFunction((target) => (window.__game.car._prog ?? -1e9)
      >= target, spot.prog - 25, { polling: 100, timeout: Math.max(1000, LIMIT_S * 1000
      - (Date.now() - began)) }).then(() => true, () => false);
    if (!reached) break;
    await shot(`at${spot.prog}m`);
  }
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

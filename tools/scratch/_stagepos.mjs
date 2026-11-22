// _stagepos.mjs - A STAGE'S LIVE POSITION (?stagepos; game/stagepos.ts): a stage VS AI with cars
// ahead and behind (launched again until one is MINSLOT ahead), you on the autopilot. Every 2 s
// the place the HUD shows (P n/N: game.position, the field) and where you are; at your finish the
// live place against your place in the results. RAC3R_QUERY carries the switches.
// [LEVEL=sweaty-lamb] [MINSLOT=-3] node tools/scratch/_stagepos.mjs
import { startServer, launchBrowser, gotoGame, extraQuery } from '../lib/browser.mjs';

const LEVEL_ID = process.env.LEVEL || 'sweaty-lamb', MIN_SLOT = +(process.env.MINSLOT || -3);
const server = await startServer();
const browser = await launchBrowser();
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } }))
    .newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await gotoGame(page, `${server.url}/?pc=1&guide=0&rules=0&noaudio=1&autopilot=1` + extraQuery());
  let field = null;
  for (let tries = 0; tries < 20; tries++) {
    await page.evaluate((levelId) => window.__game.launch(levelId, 'saloon-rwd', { ai: 5, diff: 2,
      laps: 1, weather: { mode: 'dry', season: 2, seed: 4 } }), LEVEL_ID);
    await page.waitForTimeout(1500);
    await page.mouse.click(195, 422);
    await page.waitForTimeout(1500);
    field = await page.evaluate(() => window.__game.flow.entries.filter((entry) => !entry.player)
      .map((entry) => entry.car._slot));
    if (Math.min(0, ...field) <= MIN_SLOT && Math.max(0, ...field) > 0) break;
  }
  console.log('slots', JSON.stringify(field));
  const timeline = [];
  let atFinish = null;
  const began = Date.now();
  while (Date.now() - began < 200000) {
    await page.waitForTimeout(2000);
    const now = await page.evaluate(() => {
      const game = window.__game, flow = game.flow, me = flow.entries.find((entry) => entry.player);
      return { t: Math.round(flow.t), pos: game.position, ai: game.ai.length,
        field: flow.entries.length, prog: Math.round(game.car._prog ?? -1), state: flow.state,
        mineDone: me.finish != null, results: flow.results ? flow.results.map((row) => [row.pos,
          row.player ? 'YOU' : row.num, +row.time.toFixed(1)]) : null };
    });
    timeline.push(`${now.t}s P${now.pos}/${now.field} (ai on road ${now.ai}) at ${now.prog} m`);
    if (now.mineDone && !atFinish) atFinish = now.pos;
    if (now.state === 'done') {
      const mine = now.results.find((row) => row[1] === 'YOU');
      for (let i = 0; i < timeline.length; i += 6) console.log(timeline.slice(i, i + 6).join(' | '));
      console.log('live place at your finish', atFinish, '; your result', mine[0],
        '; results', JSON.stringify(now.results));
      break;
    }
  }
  console.log('errors', errors.length ? errors.slice(0, 3).join(' | ') : 'none');
} finally {
  await browser.close();
  server.stop();
}

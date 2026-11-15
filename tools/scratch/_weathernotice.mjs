// _weathernotice.mjs - THE WEATHER'S NOTICES BY DIFFICULTY (scratch, ?weathermobile=1): Thruston
// with SEASON weather (SEASON, default 0: winter, the most changeable), deterministic
// (tools/lib/determinism.mjs, nothing drawn, its random stream seeded by each of SEEDS - so each
// seed deals its own weather), the player on the demo driver, stepped SECONDS of game time at each
// difficulty mode in MODES; every 0.5 s it reads the weather (its kind) and the notice line.
// Prints per mode the weather's changes and the notices shown, so a mode with the switch can be set against the same mode without it: the
// weather must change the same way, the notices only on MOBILE (mode 0).
// [RAC3R_QUERY=weathermobile=1] [SECONDS=600] [MODES=0,2,4] [SEEDS=1,2] [SEASON=0]
//   node tools/scratch/_weathernotice.mjs
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, installDriver, SETTLE_MS } from '../lib/determinism.mjs';

const SECONDS = Number(process.env.SECONDS || 600);
const MODES = (process.env.MODES || '0,2,4').split(',').map(Number);
const SEEDS = (process.env.SEEDS || '1,2').split(',').map(Number);
const SEASON = Number(process.env.SEASON || 0);
// frames of 1/60 s between reads
const READ_EVERY = 30;

/**
 * Page side: one read - the weather and the notice line now.
 * @returns {{kind: string, rain: number, notice: string | null, at: number}} the read
 */
async function readNow() {
  const game = window.__game, weather = (await import('/src/world/weather.ts')).WEATHER;
  return { kind: weather.kind, rain: Math.round(weather.rain * 100) / 100,
    notice: game.notice ? game.notice.text : null, at: game.notice ? game.notice.at : 0 };
}

const server = await startServer();
const browser = await launchBrowser();
try {
  for (const seed of SEEDS) for (const mode of MODES) {
    const errors = [];
    const page = await openPage(browser, server.url, 'thruston', errors,
      '&skip=world,ground,car' + extraQuery());
    // (a key, as renderhash: the game waits for one before it runs)
    await page.evaluate(() => {
      dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      window.__rt.step(10);
    });
    await page.evaluate((value) => window.__rt.seed(value), seed);
    await page.evaluate(([diff, season]) => window.__game.launch('thruston', 'hatch-rwd',
      { ai: 0, diff, weather: { mode: 'season', season } }), [mode, SEASON]);
    await page.waitForTimeout(SETTLE_MS);
    await page.evaluate(installDriver);
    const changes = [], notices = [];
    let lastKind = null, lastAt = 0;
    for (let frame = 0; frame < SECONDS * 60; frame += READ_EVERY) {
      await page.evaluate((count) => window.__rt.step(count), READ_EVERY);
      const now = await page.evaluate(readNow);
      if (now.kind !== lastKind) changes.push(`${(frame / 60).toFixed(0)}s ${now.kind}`);
      lastKind = now.kind;
      if (now.notice && now.at !== lastAt) notices.push(`${(frame / 60).toFixed(0)}s ${now.notice}`);
      lastAt = now.at;
    }
    console.log(`seed ${seed} mode ${mode}: weather ${changes.join(', ')}`);
    console.log(`seed ${seed} mode ${mode}: notices ${notices.join(', ') || 'none'}`
      + (errors.length ? ` | page errors: ${errors[0]}` : ''));
    await page.context().close();
  }
} finally {
  await browser.close();
  server.stop();
}

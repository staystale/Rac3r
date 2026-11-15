// _weathernotice.mjs - THE WEATHER'S NOTICES BY DIFFICULTY (scratch, ?weathermobile=1): Thruston
// with SEASON weather, deterministic (tools/lib/determinism.mjs, nothing drawn), the player on the
// demo driver, stepped SECONDS of game time at each difficulty mode in MODES; every 0.5 s it reads
// the weather (its kind, rain) and the notice line. Prints per mode the weather's changes and the
// notices shown, so a mode with the switch can be set against the same mode without it: the
// weather must change the same way, the notices only on MOBILE (mode 0).
// [RAC3R_QUERY=weathermobile=1] [SECONDS=600] [MODES=0,2,4] node tools/scratch/_weathernotice.mjs
import { startServer, launchBrowser, extraQuery } from '../lib/browser.mjs';
import { openPage, installDriver, SETTLE_MS } from '../lib/determinism.mjs';

const SECONDS = Number(process.env.SECONDS || 600);
const MODES = (process.env.MODES || '0,2,4').split(',').map(Number);
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
  for (const mode of MODES) {
    const errors = [];
    const page = await openPage(browser, server.url, 'thruston', errors,
      '&skip=world,ground,car' + extraQuery());
    await page.evaluate((seed) => window.__rt.seed(seed), 0x5eed);
    await page.evaluate((diff) => window.__game.launch('thruston', 'hatch-rwd',
      { ai: 0, diff, weather: { mode: 'season', season: 3 } }), mode);
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
    console.log(`mode ${mode}: weather ${changes.join(', ')}`);
    console.log(`mode ${mode}: notices ${notices.join(', ') || 'none'}`
      + (errors.length ? ` | page errors: ${errors[0]}` : ''));
    await page.context().close();
  }
} finally {
  await browser.close();
  server.stop();
}

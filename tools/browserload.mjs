// browserload.mjs - HOW LONG A LEVEL TAKES TO LOAD IN THE BROWSER, at phone-ish CPU (CDP x4): from
// the page opening ?level=<id> to the level built (window.__game.level is it) and to its first 30
// frames drawn (the ground tiles, sprites and images the first frames paint), and the worst frame
// in the 3 s after (the load's tail: tiles still painting). One browser, a fresh page per level.
// node tools/browserload.mjs [level ...] [--cpu 4] [--ai 0]   (no level: every registered level;
// env RAC3R_QUERY: switches on the page)
import { startServer, launchBrowser, extraQuery } from './lib/browser.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const at = args.indexOf(name);
  if (at < 0) return fallback;
  const value = args[at + 1];
  args.splice(at, 2);
  return value;
};
const cpuRate = +option('--cpu', '4'), aiCount = +option('--ai', '0');
// frames counted as the first ones drawn; s the tail is watched after them
const FIRST_FRAMES = 30, TAIL_S = 3;
// ms a level may take before it counts as stuck
const LEVEL_TIMEOUT_MS = 120000;

/**
 * Times one level's load in a fresh page.
 * @param browser the browser
 * @param url the server's url
 * @param levelId the level
 * @returns its times, ms
 */
async function timeLevel(browser, url, levelId) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  try {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error.message).split('\n')[0]));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.__frames = [];
      window.requestAnimationFrame = (callback) => raf((stamp) => {
        window.__frames.push(performance.now());
        callback(stamp);
      });
    });
    const started = Date.now();
    // (RAC3R_QUERY: switches on the page, e.g. fastbuild=1)
    await page.goto(`${url}/?touch=1&guide=0&ai=${aiCount}&level=${levelId}&car=track-rwd`
      + extraQuery());
    await page.waitForFunction((id) => window.__game?.level?.id === id, levelId,
      { timeout: LEVEL_TIMEOUT_MS, polling: 50 });
    const builtMs = Date.now() - started;
    const builtAt = await page.evaluate(() => performance.now());
    await page.waitForFunction(({ at, count }) => window.__frames.filter((time) => time > at)
      .length >= count, { at: builtAt, count: FIRST_FRAMES }, { timeout: LEVEL_TIMEOUT_MS });
    const drawnMs = Date.now() - started;
    await page.waitForTimeout(TAIL_S * 1000);
    const worst = await page.evaluate((at) => {
      const times = window.__frames.filter((time) => time > at);
      let most = 0;
      for (let i = 1; i < times.length; i++) most = Math.max(most, times[i] - times[i - 1]);
      return most;
    }, builtAt);
    return { levelId, builtMs, drawnMs, worstFrameMs: Math.round(worst), errors };
  } finally {
    await context.close();
  }
}

const server = await startServer();
let browser;
try {
  browser = await launchBrowser();
  let ids = args;
  if (!ids.length) {
    const lab = await import('../src/lab.ts');
    ids = lab.LEVELS.map((level) => level.id);
  }
  const rows = [];
  for (const levelId of ids) {
    try {
      const row = await timeLevel(browser, server.url, levelId);
      rows.push(row);
      console.log(`${levelId.padEnd(28)} built ${String(row.builtMs).padStart(6)} ms   drawn`
        + ` ${String(row.drawnMs).padStart(6)} ms   worst frame after ${row.worstFrameMs} ms`
        + (row.errors.length ? `   ERRORS ${row.errors.slice(0, 2).join(' | ')}` : ''));
    } catch (error) {
      console.log(`${levelId.padEnd(28)} FAILED ${String(error.message).split('\n')[0]}`);
    }
  }
  rows.sort((first, second) => second.drawnMs - first.drawnMs);
  console.log(`slowest: ${rows.slice(0, 5).map((row) => `${row.levelId} ${row.drawnMs} ms`)
    .join(', ')}  (CPU x${cpuRate}, ${aiCount} AI)`);
} finally {
  await browser?.close();
  server.stop();
}

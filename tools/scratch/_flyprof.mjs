// _flyprof.mjs - WHAT A FLY-IN FRAME COSTS (scratch): the real game at phone size, a race launched
// as the menu launches it behind the loading screen (?loadscreen=1), and only the fly-in under the
// CPU profiler: its frames' intervals and the profile's top functions by self time. The phone
// showed Spa's fly-in at ~4 fps with our JS ~23 ms a frame; this finds where a desktop spends it.
// [CPU=4] [AI=20] [VIEW=440x738] [OUT=dir] node tools/scratch/_flyprof.mjs [level] [extra query]
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const levelId = process.argv[2] || 'spa';
const extra = process.argv[3] ? `&${process.argv[3]}` : '';
const CPU = Number(process.env.CPU || 4), AI = Number(process.env.AI || 20);
const [viewW, viewH] = (process.env.VIEW || '440x738').split('x').map(Number);
const OUT = process.env.OUT || 'shots/flyprof';
// ms between looks at the game while waiting
const POLL_MS = 20;

/**
 * Waits until a page-side test holds (or gives up after limitMs).
 * @param {import('playwright').Page} page the page
 * @param {string} test a page-side expression
 * @param {number} limitMs the most to wait
 * @returns {Promise<boolean>} whether it held
 */
async function waitFor(page, test, limitMs) {
  const began = Date.now();
  while (Date.now() - began < limitMs) {
    if (await page.evaluate(test)) return true;
    await page.waitForTimeout(POLL_MS);
  }
  return false;
}

fs.mkdirSync(OUT, { recursive: true });
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=1${extra}`);
  await page.touchscreen.tap(viewW / 2, viewH / 2);
  await waitFor(page, '!window.__game.renderer.flying', 30000);
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  await page.evaluate(() => {
    window.__flyGaps = [];
    let last = performance.now();
    const tick = (now) => {
      if (window.__game.renderer.flying) window.__flyGaps.push(Math.round(now - last));
      last = now;
      if (window.__flyGaps.length < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate(([level, count]) => window.__game.launch(level, 'hatch-rwd', { ai: count }),
    [levelId, AI]);
  await waitFor(page, 'window.__game.renderer.flying', 120000);
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
  await cdp.send('Profiler.start');
  await waitFor(page, '!window.__game.renderer.flying', 120000);
  const { profile } = await cdp.send('Profiler.stop');
  const file = `${OUT}/${levelId}-x${CPU}.cpuprofile`;
  fs.writeFileSync(file, JSON.stringify(profile));
  const gaps = await page.evaluate(() => window.__flyGaps);
  const sorted = [...gaps].sort((left, right) => left - right);
  console.log(`${levelId} x${CPU}: fly-in ${gaps.length} frames, ${gaps.reduce((s, g) => s + g, 0)} ms;`
    + ` median ${sorted[sorted.length >> 1]} ms, worst ${sorted[sorted.length - 1]} ms`);
  console.log(`gaps: ${gaps.join(' ')}`);
  console.log(`profile: ${file}; ${errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ')
    : 'no page errors'}`);
} finally {
  await browser.close();
  server.stop();
}

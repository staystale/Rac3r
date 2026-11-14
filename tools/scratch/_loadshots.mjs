// _loadshots.mjs - THE LOADING SCREEN IN PHOTOS (scratch, ?loadscreen=1): at phone size, a race
// launched as the menu launches it, photographed with the screen up (CPU x4, so the build holds
// it), at the fly-in's start (the screen gone or fading), and on the grid when the countdown has
// begun; then a RESTART's screen. Into OUT (default shots/loadscreen).
// [CPU=4] [AI=20] [VIEW=844x390] node tools/scratch/_loadshots.mjs [level]
import fs from 'node:fs';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const [levelId = 'spa'] = process.argv.slice(2);
const OUT = process.env.OUT || 'shots/loadscreen', CPU = +(process.env.CPU || 4);
const AI = +(process.env.AI || 20);
const [viewW, viewH] = (process.env.VIEW || '844x390').split('x').map(Number);
// ms between looks at the game while waiting for a moment
const POLL_MS = 40;
fs.mkdirSync(OUT, { recursive: true });

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

const SCREEN_UP = "(() => { const el = document.getElementById('loadscreen');"
  + " return !!el && el.className === ''; })()";
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0&noaudio=1&loadscreen=1`);
  await page.touchscreen.tap(viewW / 2, viewH / 2);
  await waitFor(page, `!(${SCREEN_UP}) && !window.__game.renderer.flying`, 30000);
  await page.waitForTimeout(1500);
  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  const name = `${levelId}-${viewW}x${viewH}`;
  await page.evaluate(([level, count]) => window.__game.launch(level, 'hatch-rwd', { ai: count }),
    [levelId, AI]);
  console.log(`screen up: ${await page.evaluate(SCREEN_UP)}`);
  await page.screenshot({ path: `${OUT}/${name}-1-screen.png` });
  await waitFor(page, `!(${SCREEN_UP}) && window.__game.renderer.flying`, 120000);
  await page.screenshot({ path: `${OUT}/${name}-2-flyin.png` });
  await waitFor(page, 'window.__game.start.on && window.__game.start.t > 1.2', 120000);
  await page.screenshot({ path: `${OUT}/${name}-3-lights.png` });
  await page.evaluate(() => window.__game.restart());
  await page.screenshot({ path: `${OUT}/${name}-4-restart-screen.png` });
  console.log(`photos in ${OUT}; ${errors.length ? 'ERRORS ' + errors.slice(0, 3).join(' | ')
    : 'no page errors'}`);
} finally {
  await browser.close();
  server.stop();
}

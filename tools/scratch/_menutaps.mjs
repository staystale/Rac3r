// _menutaps.mjs - WHICH MENU BUTTONS ARE SLOW (scratch, measuring only): the real menu at phone
// size, walked screen by screen - every button of the screen it is on pressed in turn (then BACK
// to that screen), down to DEPTH screens, never LAUNCH / START / RACE (a race) or a reset. For
// each press: the button's own handler (the long task after the press blink, PerformanceObserver
// 'longtask') and the next frames' gaps. The phone report (11-14) showed menu taps answered in
// 120-230 ms; this names the buttons.
// [CPU=4] [DEPTH=3] [VIEW=440x738] node tools/scratch/_menutaps.mjs
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const CPU = Number(process.env.CPU || 4), DEPTH = Number(process.env.DEPTH || 3);
const [viewW, viewH] = (process.env.VIEW || '440x738').split('x').map(Number);
// buttons never pressed: they start a race, leave the menu or wipe something
const SKIP = /launch|start|race|go!|reset|delete|clear|wipe|quit|drive|play/i;
// ms after a press for its handler and the frames after it (the blink is 160 ms)
const SETTLE_MS = 900;

/**
 * The visible, enabled menu buttons' labels.
 * @param {import('playwright').Page} page the page
 * @returns {Promise<string[]>} their labels
 */
function buttonLabels(page) {
  return page.evaluate(() => [...document.querySelectorAll('#menu button')]
    .filter((btn) => !btn.disabled && btn.offsetParent !== null)
    .map((btn) => btn.innerText.replace(/\s+/g, ' ').trim()).filter(Boolean));
}

/**
 * Presses the button with a label and measures what follows.
 * @param {import('playwright').Page} page the page
 * @param {string} label its label
 * @returns {Promise<{longest: number, worstGap: number}>} the longest task and frame gap, ms
 */
async function pressAndTime(page, label) {
  await page.evaluate(() => {
    window.__tap = { tasks: [], gaps: [] };
    const watch = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__tap.tasks.push(Math.round(entry.duration));
    });
    watch.observe({ type: 'longtask' });
    window.__tap.watch = watch;
    let last = performance.now();
    const tick = (now) => {
      window.__tap.gaps.push(Math.round(now - last));
      last = now;
      if (window.__tap.gaps.length < 60) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  await page.evaluate((text) => {
    const btn = [...document.querySelectorAll('#menu button')].find((cand) =>
      cand.innerText.replace(/\s+/g, ' ').trim() === text && cand.offsetParent !== null);
    if (btn) btn.click();
  }, label);
  await page.waitForTimeout(SETTLE_MS);
  return page.evaluate(() => {
    window.__tap.watch.disconnect();
    return { longest: Math.max(0, ...window.__tap.tasks), worstGap: Math.max(0, ...window.__tap.gaps) };
  });
}

const server = await startServer();
const browser = await launchBrowser();
const results = [];
try {
  const context = await browser.newContext({ viewport: { width: viewW, height: viewH },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await gotoGame(page, `${server.url}/?touch=1&menu=1&guide=0&noaudio=1`);
  await page.waitForTimeout(3000);
  const cdp = await context.newCDPSession(page);
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  // a walk: the path of labels from the main menu to a screen; each screen's buttons pressed once
  const queue = [[]], seen = new Set();
  while (queue.length) {
    const path = queue.shift();
    for (const label of await buttonLabels(page)) {
      if (SKIP.test(label) || seen.has(path.join(' > ') + ' > ' + label)) continue;
      seen.add(path.join(' > ') + ' > ' + label);
      const timing = await pressAndTime(page, label);
      results.push({ where: [...path, label].join(' > '), ...timing });
      if (path.length + 1 < DEPTH) queue.push([...path, label]);
      // back to the screen this walk is on: reload and replay its path
      await page.goto(`${server.url}/?touch=1&menu=1&guide=0&noaudio=1`);
      await page.waitForTimeout(2500);
      for (const step of path) await pressAndTime(page, step);
    }
    if (queue.length) {
      await page.goto(`${server.url}/?touch=1&menu=1&guide=0&noaudio=1`);
      await page.waitForTimeout(2500);
      for (const step of queue[0]) await pressAndTime(page, step);
    }
  }
  results.sort((left, right) => right.longest - left.longest);
  for (const row of results.slice(0, 30))
    console.log(`${String(row.longest).padStart(5)} ms task  ${String(row.worstGap).padStart(5)} ms gap  ${row.where}`);
  console.log(`${results.length} presses (CPU x${CPU})`);
} finally {
  await browser.close();
  server.stop();
}

// _bootbarshots.mjs - PHOTOS OF THE BOOT BAR (?bootbar=1) at a phone's two sizes, as the phone loads
// the page (the bundle and the menu: the automation flag hidden): (1) before its fonts have come
// (the font files held back 2.5 s), (2) the bar part-full while the code downloads (the bundle held
// back 1.5 s), (3) the blue flash, (4) the menu after. Writes tools/scratch/_bootbar-<n>-<size>.png.
// node tools/scratch/_bootbarshots.mjs   (CHECK_PORT; one browser)
import { writeFileSync } from 'node:fs';
import { startServer, launchBrowser } from '../lib/browser.mjs';

const SIZES = [[844, 390], [390, 844]];
const OUT = 'tools/scratch/_bootbar';

/**
 * Opens the page in a fresh context, holding back the files matched for ms.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} url the page
 * @param {number[]} size width, height
 * @param {Record<string, number>} holds glob -> ms held
 * @returns {Promise<{page: import('playwright').Page, context: object, errors: string[]}>}
 */
async function openHeld(browser, url, size, holds) {
  const context = await browser.newContext({ viewport: { width: size[0], height: size[1] },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  for (const [glob, ms] of Object.entries(holds)) {
    await page.route(glob, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue();
    });
  }
  await page.goto(url, { waitUntil: 'commit' });
  return { page, context, errors };
}

/**
 * A photo straight from the browser (Playwright's own waits for the page's fonts first, and this
 * must show the page before they come).
 * @param {import('playwright').Page} page the page
 * @param {string} path the PNG
 */
async function rawShot(page, path) {
  const cdp = await page.context().newCDPSession(page);
  const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(path, Buffer.from(data, 'base64'));
  await cdp.detach();
}

const server = await startServer();
await fetch(`${server.url}/__bundle.js`).then((res) => res.arrayBuffer());
const browser = await launchBrowser({ args: ['--disable-blink-features=AutomationControlled'] });
const url = `${server.url}/?touch=1&guide=0&noaudio=1&bootbar=1`;
try {
  for (const size of SIZES) {
    const tag = `${size[0]}x${size[1]}`;
    let run = await openHeld(browser, url, size, { '**/*.woff2': 2500, '**/__bundle.js': 2500 });
    await run.page.waitForTimeout(600);
    await rawShot(run.page, `${OUT}-1-nofonts-${tag}.png`);
    await run.context.close();
    // (the fonts come, the logo held back: the name in words, its 3 big and blue)
    run = await openHeld(browser, url, size, { '**/logo.jpg': 4000, '**/__bundle.js': 4000 });
    await run.page.waitForTimeout(1500);
    await rawShot(run.page, `${OUT}-1b-words-${tag}.png`);
    await run.context.close();
    run = await openHeld(browser, url, size, { '**/__bundle.js': 1500 });
    await run.page.waitForTimeout(1200);
    const share = await run.page.evaluate(() => getComputedStyle(document
      .querySelector('#bootbar .fill')).transform);
    await rawShot(run.page, `${OUT}-2-partfull-${tag}.png`);
    await run.page.waitForFunction(() => document.querySelector('#bootbar .fill.done'), null,
      { polling: 5, timeout: 60000 });
    await rawShot(run.page, `${OUT}-3-flash-${tag}.png`);
    await run.page.waitForFunction(() => document.querySelector('#bootbar.gone'), null,
      { polling: 20, timeout: 60000 });
    await run.page.waitForTimeout(600);
    await rawShot(run.page, `${OUT}-4-menu-${tag}.png`);
    const after = await run.page.evaluate(() => ({ boot: document.getElementById('boot').className,
      loadscreen: !!document.getElementById('loadscreen'), mode: window.__game.mode }));
    console.log(`${tag}: part-full transform ${share}; after: ${JSON.stringify(after)}`
      + (run.errors.length ? `; ERRORS ${run.errors.join(' | ')}` : ''));
    await run.context.close();
  }
} finally {
  await browser.close();
  server.stop();
}

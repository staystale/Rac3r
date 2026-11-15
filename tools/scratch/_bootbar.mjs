// _bootbar.mjs - THE FIRST PAGE LOAD, boot bar off vs on (?bootbar=1): a cold page (a new browser
// context, empty cache) at phone size, as the phone loads it (the bundle and the menu: the
// automation flag hidden), ms from the page opening to: the first paint, the bundle downloaded,
// the menu shown (the boot screen gone), the menu's first frame, the menu complete (its fonts, the
// logo and the first thumbnails in), and with the switch on the bar's flash, its fade and its end.
// The menu is SEEN at the first frame off, at the fade's start on. Runs alternate off / on.
// [CPU=1,4] [RUNS=3] [SEED=7] [NET=100,500] node tools/scratch/_bootbar.mjs   (CHECK_PORT; one browser)
import { startServer, launchBrowser } from '../lib/browser.mjs';

const CPUS = (process.env.CPU || '1,4').split(',').map(Number);
const RUNS = +(process.env.RUNS || 3);
const MODES = ['', 'bootbar=1'];
// the menu race's draws (SEED=7: a seeded Math.random, the same race both ways)
const SEED = +(process.env.SEED || 7);
// NET=100,500: a line of that latency (ms) and speed (KB/s) - _pageload.mjs's 4G-like one
const NET = process.env.NET ? process.env.NET.split(',').map(Number) : null;

// page side: the times things happen, from the page's own clock (0 = the page opening)
const WATCH = (seed) => {
  // the same menu race both ways (enterMenu picks the level and field with Math.random)
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6D2B79F5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  const marks = {};
  window.__bootMarks = marks;
  const mark = (key) => {
    if (!(key in marks)) marks[key] = Math.round(performance.now());
  };
  const look = () => {
    const boot = document.getElementById('boot');
    if (boot && boot.classList.contains('gone') && !('menuShown' in marks)) {
      mark('menuShown');
      requestAnimationFrame(() => setTimeout(() => mark('menuFrame'), 0));
    }
    const bar = document.getElementById('bootbar');
    if (!bar) return;
    mark('barIn');
    const fill = bar.querySelector('.fill');
    if (fill && fill.classList.contains('done')) mark('barFlash');
    if (bar.classList.contains('fading')) mark('barFade');
    if (bar.classList.contains('gone')) mark('barGone');
  };
  new MutationObserver(look).observe(document, { subtree: true, childList: true,
    attributes: true, attributeFilter: ['class'] });
};

// page side: the menu complete - its logo decoded, no font still loading
const COMPLETE = `(() => {
  const logo = document.querySelector('#menu .logo');
  return !!logo && logo.complete && logo.naturalWidth > 0 && document.fonts.status === 'loaded';
})()`;

/**
 * One cold load.
 * @param {import('playwright').Browser} browser the browser
 * @param {string} url the server
 * @param {number} cpu the CPU slow-down
 * @param {string} query the switch ('' = off)
 * @returns {Promise<Record<string, number>>} the marks
 */
async function coldLoad(browser, url, cpu, query) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  try {
    await context.addInitScript(WATCH, SEED);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: false });
    if (cpu > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    if (NET) {
      await cdp.send('Network.enable');
      await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: NET[0],
        downloadThroughput: NET[1] * 1000, uploadThroughput: NET[1] * 250 });
    }
    await page.goto(`${url}/?touch=1&guide=0&noaudio=1${query ? '&' + query : ''}`);
    const done = query ? 'window.__bootMarks && "barGone" in window.__bootMarks'
      : 'window.__bootMarks && "menuFrame" in window.__bootMarks';
    await page.waitForFunction(done, null, { polling: 20, timeout: 120000 });
    await page.waitForFunction(COMPLETE, null, { polling: 20, timeout: 120000 });
    const marks = await page.evaluate(`(() => {
      const marks = { ...window.__bootMarks, complete: Math.round(performance.now()) };
      const thumbs = [];
      for (const entry of performance.getEntriesByType('paint'))
        if (entry.name === 'first-paint') marks.firstPaint = Math.round(entry.startTime);
      for (const entry of performance.getEntriesByType('resource')) {
        if (/__bundle|main\\.ts/.test(entry.name)) marks.code = Math.round(entry.responseEnd);
        if (/logo\\.jpg/.test(entry.name)) marks.logo = Math.round(entry.responseEnd);
        if (/\\.woff2/.test(entry.name)) marks.fonts = Math.max(marks.fonts || 0,
          Math.round(entry.responseEnd));
        if (/\\.woff2/.test(entry.name)) marks.fontFiles = (marks.fontFiles || 0) + 1;
        if (/thumbs\\/index/.test(entry.name)) marks.thumbList = Math.round(entry.responseEnd);
        if (/\\.webp/.test(entry.name)) thumbs.push(Math.round(entry.responseEnd));
      }
      marks.level = window.__game.level.id;
      thumbs.sort((one, two) => one - two);
      if (thumbs.length) Object.assign(marks, { thumb1: thumbs[0], thumb12: thumbs[11] });
      marks.bundled = performance.getEntriesByType('resource')
        .some((entry) => /__bundle/.test(entry.name)) ? 1 : 0;
      return marks;
    })()`);
    if (errors.length) marks.errors = errors.join(' | ').slice(0, 200);
    return marks;
  } finally {
    await context.close();
  }
}

const server = await startServer();
// the bundle built once first (the server keeps it), as the test server has it for the phone
await fetch(`${server.url}/__bundle.js`).then((res) => res.arrayBuffer());
const browser = await launchBrowser({ args: ['--disable-blink-features=AutomationControlled'] });
const KEYS = ['firstPaint', 'code', 'menuShown', 'menuFrame', 'barFlash', 'barFade', 'barGone',
  'fonts', 'logo', 'thumbList', 'thumb1', 'thumb12', 'complete'];
try {
  for (const cpu of CPUS) {
    const all = { off: [], on: [] };
    for (let run = 0; run < RUNS; run++) {
      for (const query of MODES) {
        const marks = await coldLoad(browser, server.url, cpu, query);
        const side = query ? 'on' : 'off';
        all[side].push(marks);
        console.log(`x${cpu} ${side.padEnd(3)} run ${run + 1}: `
          + KEYS.filter((key) => key in marks).map((key) => `${key} ${marks[key]}`).join(', ')
          + `, font files ${marks.fontFiles || 0}, bundle ${marks.bundled}, level ${marks.level}`
          + (marks.errors ? `, ERRORS ${marks.errors}` : ''));
      }
    }
    for (const side of ['off', 'on']) {
      const median = (key) => {
        const values = all[side].map((marks) => marks[key]).filter((value) => value != null)
          .sort((one, two) => one - two);
        return values.length ? values[Math.floor(values.length / 2)] : '-';
      };
      console.log(`x${cpu} ${side} MEDIAN: ` + KEYS.map((key) => `${key} ${median(key)}`).join(', '));
    }
  }
} finally {
  await browser.close();
  server.stop();
}

// _thumbtime.mjs - HOW SOON THE MENU'S TRACK PICTURES ARRIVE ON A PHONE LINK (scratch): the network
// held to a 4G-like line (CDP: DOWN_BPS down, LATENCY_MS), the page opened, and from the page's
// start: when the TEST MODE category list's pictures are all in (menu/tracks.ts categoryThumbIds)
// and when every one is. node tools/scratch/_thumbtime.mjs [query]   (CHECK_PORT; one browser)
import { startServer, launchBrowser } from '../lib/browser.mjs';

const [query = ''] = process.argv.slice(2);
// bytes/s down and up, ms each request waits: a fair phone 4G line
const DOWN_BPS = 500000, UP_BPS = 125000, LATENCY_MS = 100;
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 440, height: 738 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCY_MS,
    downloadThroughput: DOWN_BPS, uploadThroughput: UP_BPS });
  // each thumbnail's arrival, ms from the page's start (the test's clock)
  const arrived = new Map();
  let bytes = 0;
  page.on('requestfinished', async (request) => {
    const url = request.url();
    if (!url.includes('/assets/thumbs/') || url.endsWith('.json')) return;
    arrived.set(url.split('/').pop().split('.')[0], Date.now() - started);
    const sizes = await request.sizes().catch(() => null);
    bytes += sizes ? sizes.responseBodySize : 0;
  });
  const started = Date.now();
  await page.goto(`${server.url}/?menu=1&guide=0&noaudio=1&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 180000 });
  const menuMs = Date.now() - started;
  const ids = JSON.parse((await (await fetch(`${server.url}/assets/thumbs/index.json`)).text()))
    .ids;
  for (let waited = 0; arrived.size < ids.length && waited < 180000; waited += 250) {
    await page.waitForTimeout(250);
  }
  const first = await page.evaluate(async () => (await import('/src/menu/tracks.ts'))
    .categoryThumbIds());
  const shipped = first.filter((levelId) => ids.includes(levelId));
  const times = { firstDone: Math.max(...shipped.map((levelId) => arrived.get(levelId) ?? Infinity)),
    allDone: Math.max(...arrived.values()), files: arrived.size, kb: Math.round(bytes / 1024),
    firstCount: shipped.length, menuMs };
  console.log(`query '${query}': menu up at ${times.menuMs} ms; the first screen's `
    + `${times.firstCount} pictures in by `
    + `${times.firstDone} ms, all ${times.files} by ${times.allDone} ms (${times.kb} KB)`);
} finally {
  await browser.close();
  server.stop();
}

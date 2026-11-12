// _pageload.mjs - WHAT A FIRST VISIT DOWNLOADS BEFORE THE MENU (scratch): every request from the
// page's open to the menu up, on a 4G-like line (CDP), by kind: count and KB, the biggest files.
// node tools/scratch/_pageload.mjs [query]   (CHECK_PORT; one browser)
import { startServer, launchBrowser } from '../lib/browser.mjs';

const [query = ''] = process.argv.slice(2);
const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 440, height: 738 } });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100,
    downloadThroughput: 500000, uploadThroughput: 125000 });
  const files = [];
  page.on('requestfinished', async (request) => {
    const sizes = await request.sizes().catch(() => null);
    files.push({ url: request.url().replace(server.url, ''), kb: sizes ? sizes.responseBodySize / 1024 : 0 });
  });
  const started = Date.now();
  await page.goto(`${server.url}/?menu=1&guide=0&noaudio=1&${query}`);
  await page.waitForFunction(() => window.__game && window.__game.menu, null, { timeout: 180000 });
  console.log(`menu up at ${Date.now() - started} ms after ${files.length} requests,`
    + ` ${files.reduce((sum, file) => sum + file.kb, 0).toFixed(0)} KB`);
  const kinds = {};
  for (const file of files) {
    const kind = file.url.split('?')[0].split('.').pop().slice(0, 8);
    kinds[kind] = kinds[kind] || { count: 0, kb: 0 };
    kinds[kind].count++;
    kinds[kind].kb += file.kb;
  }
  for (const [kind, sum] of Object.entries(kinds)) console.log(`  ${kind}: ${sum.count} files, ${sum.kb.toFixed(0)} KB`);
  for (const file of files.sort((one, two) => two.kb - one.kb).slice(0, 6)) console.log(`  ${file.kb.toFixed(0)} KB ${file.url.slice(0, 70)}`);
} finally {
  await browser.close();
  server.stop();
}

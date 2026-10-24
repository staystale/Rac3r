// _staticcheck.mjs <folder> - the static build as itch.io serves it: a plain file server over the
// folder (no bundler, no test server), the page opened at 844x390 and 390x844, the menu shown,
// then a level launched and driven 6 s; page errors and console errors printed, photos to the
// temp folder. node tools/scratch/_staticcheck.mjs dist
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { launchBrowser } from '../lib/browser.mjs';

const folder = resolve(process.argv[2] || 'dist');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json',
  '.webmanifest': 'application/manifest+json' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  try {
    const body = await readFile(join(folder, path === '/' ? 'index.html' : path));
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'text/html' });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end('missing');
  }
});
await new Promise((done) => server.listen(8097, done));
const browser = await launchBrowser();
try {
  for (const [width, height] of [[844, 390], [390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 3,
      isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const notes = [], missing = [];
    page.on('pageerror', (error) => notes.push('ERROR ' + error));
    page.on('console', (message) => { if (message.type() === 'error') notes.push('console ' + message.text()); });
    page.on('response', (response) => { if (response.status() >= 400) missing.push(response.url()); });
    await page.goto('http://localhost:8097/?touch=1&menu=1');
    await page.waitForFunction(() => window.__game && window.__game.mode === 'menu', null,
      { timeout: 60000, polling: 250 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: join(tmpdir(), `static-menu-${width}x${height}.png`) });
    await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd', { ai: 3 }));
    await page.waitForTimeout(6000);
    const state = await page.evaluate(() => ({ mode: window.__game.mode,
      level: window.__game.level.id, kmh: Math.round(Math.hypot(window.__game.car.vx,
        window.__game.car.vy) * 3.6) }));
    await page.screenshot({ path: join(tmpdir(), `static-race-${width}x${height}.png`) });
    console.log(`${width}x${height}: ${JSON.stringify(state)} | missing ${missing.join(', ') || 'none'}`
      + ` | ${notes.length ? notes.slice(0, 4).join(' || ') : 'no errors'}`);
    await context.close();
  }
} finally {
  await browser.close();
  server.close();
}

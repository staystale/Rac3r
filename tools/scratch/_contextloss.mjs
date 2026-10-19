// _contextloss.mjs - the GPU ground losing its WebGL context and getting it back, as Safari can do
// (WEBGL_lose_context): Castle Cum by day, a photo before, while lost and after the restore, and
// the GPU ground's state (active, tiles drawn, uploads) at each. Prints page errors.
// Photos in the temp folder. node tools/scratch/_contextloss.mjs
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';

const server = await startServer();
const browser = await launchBrowser();
try {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  await gotoGame(page, `${server.url}/?touch=1&guide=0&menu=0&rules=0`);
  await page.touchscreen.tap(422, 195);
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__game.launch('castle-cum', 'hatch-rwd',
    { ai: 2, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await page.waitForTimeout(4000);
  const look = (name) => page.evaluate((label) => {
    const canvas = document.getElementById('glground');
    const gl = canvas.getContext('webgl2');
    const counts = window.__game.renderer.gpuCounts;
    return `${label}: lost ${gl.isContextLost()}, uploads ${counts.uploads}`;
  }, name);
  await page.screenshot({ path: join(tmpdir(), 'ctxloss-0-before.png') });
  console.log(await look('before'));
  await page.evaluate(() => {
    const gl = document.getElementById('glground').getContext('webgl2');
    window.__loseExt = gl.getExtension('WEBGL_lose_context');
    window.__loseExt.loseContext();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(tmpdir(), 'ctxloss-1-lost.png') });
  console.log(await look('lost'));
  await page.evaluate(() => window.__loseExt.restoreContext());
  await page.waitForTimeout(3000);
  await page.screenshot({ path: join(tmpdir(), 'ctxloss-2-restored.png') });
  console.log(await look('restored'));
  console.log('page errors:', errors.length ? errors.join(' | ') : 'none');
  await context.close();
} finally {
  await browser.close();
  server.stop();
}

// _cullshots.mjs - phone-size photos of a race with a query (default ?ribboncull=1). node tools/scratch/_cullshots.mjs <outDir> [query]
import { mkdirSync } from 'node:fs';
import { startServer, launchBrowser } from '../lib/browser.mjs';
const out = process.argv[2], query = process.argv[3] ?? '&ribboncull=1';
mkdirSync(out, { recursive: true });
const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const level of ['brands-snatch', 'castle-cum']) {
    for (const [w, h] of [[844, 390], [390, 844]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const page = await ctx.newPage();
      const errors = []; page.on('pageerror', (err) => errors.push(String(err)));
      await page.goto(srv.url + '/?menu=0&guide=0&rules=0&ai=3&autopilot=1&level=' + level + query);
      await page.waitForFunction(() => window.__game && window.__game.renderer, null, { timeout: 60000 });
      await page.touchscreen.tap(w / 2, h / 2);
      await page.waitForTimeout(9000);
      await page.screenshot({ path: `${out}/${level}-${w}x${h}.png` });
      console.log(level, w + 'x' + h, errors.length ? errors[0] : 'no errors');
      await ctx.close();
    }
  }
} finally { await browser.close(); srv.stop(); }

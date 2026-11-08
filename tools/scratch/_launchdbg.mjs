// _launchdbg.mjs - menucheck's landscape steps one by one, with shots: setup > GARAGE > ▶ > SELECT > LAUNCH
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&menu=1&guide=0');
  await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1200);
  const tap = async (t, n) => { await page.waitForTimeout(400); const b = page.locator('#menu button', { hasText: t }).first(); await b.tap(); await page.waitForTimeout(500);
    console.log(n, 'after', t, '->', await page.evaluate(() => (document.querySelector('#menu h2') || {}).textContent + ' | mode ' + window.__game.mode)); await page.screenshot({ path: `tools/scratch/_ld-${n}.png` }); };
  await tap('TEST MODE', 1); await tap('OVALS', 2); await tap('Naffcar', 3); await tap('GARAGE', 4); await tap('▶', 5); await tap('SELECT', 6); await tap('LAUNCH', 7);
  await page.waitForTimeout(2000); console.log('mode', await page.evaluate(() => window.__game.mode));
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

// _menushot.mjs - phone-size shots of the menus with ?menustyle=1: main, garage, tyres, test mode
import { startServer, launchBrowser } from '../lib/browser.mjs';
const extra = process.argv[2] ?? '&menustyle=1'; const W = +(process.argv[3] || 390), H = +(process.argv[4] || 844);
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('carsim.profile.v1', JSON.stringify({ active: 'muscle-rwd' })));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('requestfailed', (r) => errs.push('failed ' + r.url()));
  await page.goto(srv.url + '/?touch=1&menu=1&guide=0' + extra);
  await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1500);
  const tap = async (t) => { await page.locator('#menu button', { hasText: t }).first().click(); await page.waitForTimeout(700); };
  await page.screenshot({ path: 'tools/scratch/_menu-main-' + W + '.png' });
  await tap('GARAGE'); await page.screenshot({ path: 'tools/scratch/_menu-garage.png' });
  await tap('BACK'); await tap('TEST MODE'); await page.screenshot({ path: 'tools/scratch/_menu-test.png' });
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

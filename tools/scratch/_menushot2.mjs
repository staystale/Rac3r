// _menushot2.mjs - phone shots of every menu screen with ?menustyle=1 (the colour sweep)
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => localStorage.setItem('carsim.profile.v1', JSON.stringify({ active: 'muscle-rwd' })));
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&menu=1&guide=0&menustyle=1');
  await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1500);
  const tap = async (t) => { await page.locator('#menu button', { hasText: t }).first().click(); await page.waitForTimeout(800); };
  const shot = async (n) => page.screenshot({ path: `tools/scratch/_sweep-${n}.png` });
  await tap('GARAGE'); await tap('TYRES'); await shot('tyres');
  await tap('BACK'); await tap('PAINT'); await shot('paint');
  await tap('BACK'); await tap('BACK'); await tap('SETTINGS'); await shot('settings');
  await tap('BACK'); await tap('TEST MODE'); await tap('CIRCUITS'); await shot('tracks');
  await page.locator('#menu button.card').first().click(); await page.waitForTimeout(900); await shot('setup');
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

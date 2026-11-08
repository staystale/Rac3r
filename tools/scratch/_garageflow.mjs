// _garageflow.mjs - ?testgarage: setup -> GARAGE, browse + BACK keeps your car, browse + SELECT
// changes it and returns to setup; the main menu has no GARAGE. Phone shots.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { if (!localStorage.getItem('carsim.profile.v1')) localStorage.setItem('carsim.profile.v1', JSON.stringify({ active: 'muscle-rwd' })); });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&menu=1&guide=0&testgarage=1');
  await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1200);
  const tap = async (t) => { await page.locator('#menu button', { hasText: t }).first().click(); await page.waitForTimeout(700); };
  const active = () => page.evaluate(() => JSON.parse(localStorage.getItem('carsim.profile.v1')).active);
  const buttons = await page.evaluate(() => [...document.querySelectorAll('#menu button')].map((b) => b.textContent.trim()).join(' | '));
  console.log('main menu:', buttons);
  await tap('TEST MODE'); await tap('CIRCUITS'); await page.locator('#menu button.card').first().click(); await page.waitForTimeout(900);
  await tap('GARAGE'); await page.screenshot({ path: 'tools/scratch/_gf-1-garage.png' });
  console.log('in garage, yours:', await active());
  await page.locator('#menu .picker .prow').nth(2).locator('button').nth(1).click(); await page.waitForTimeout(600);
  await page.screenshot({ path: 'tools/scratch/_gf-2-browsed.png' });
  console.log('browsed, yours still:', await active());
  await tap('BACK'); console.log('BACK -> screen:', await page.evaluate(() => document.querySelector('#menu h2').textContent), '| yours:', await active());
  await tap('GARAGE'); await page.locator('#menu .picker .prow').nth(2).locator('button').nth(1).click(); await page.waitForTimeout(600);
  await tap('SELECT'); console.log('SELECT -> screen:', await page.evaluate(() => document.querySelector('#menu h2').textContent), '| yours:', await active());
  await page.screenshot({ path: 'tools/scratch/_gf-3-setup.png' });
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

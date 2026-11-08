// _trialshot.mjs - ?testgarage: the Chevvy tries the ET Streat - the shop's bars against its
// Polyglass, then the garage's GRIP line (stock + the difference in ember). Phone shots.
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
  await tap('TEST MODE'); await tap('CIRCUITS'); await page.locator('#menu button.card').first().click(); await page.waitForTimeout(900);
  await tap('GARAGE'); await tap('TYRES'); await tap('ET STREAT');
  await page.evaluate(() => [...document.querySelectorAll('#menu .sub')].find((e) => /white line/.test(e.textContent)).scrollIntoView({ block: 'start' }));
  await page.waitForTimeout(300); await page.screenshot({ path: 'tools/scratch/_trial-bars.png' });
  await tap('TRY');
  const grip = await page.evaluate(() => { const s = [...document.querySelectorAll('#menu .stats span')].find((e) => e.textContent === 'GRIP'); return s.nextElementSibling.textContent; });
  console.log('garage GRIP after trying ET Streat:', grip);
  await page.evaluate(() => document.querySelector('#menu .stats').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/scratch/_trial-garage.png' });
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

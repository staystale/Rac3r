// _garageflow2.mjs - ?testgarage round 2: main menu order; setup has no car picker, one GARAGE
// button; VS AI + 3 laps survive a garage SELECT; the shops show TRY + BUY (greyed). Phone shots.
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
  const btns = () => page.evaluate(() => [...document.querySelectorAll('#menu button')].map((b) => b.textContent.trim() + (b.classList.contains('on') ? '*' : '') + (b.disabled ? '(off)' : '')).join(' | '));
  console.log('main:', await btns());
  await page.screenshot({ path: 'tools/scratch/_gf2-main.png' });
  await tap('TEST MODE'); await tap('CIRCUITS'); await page.locator('#menu button.card').first().click(); await page.waitForTimeout(900);
  await tap('VS AI');
  console.log('setup has picker:', await page.evaluate(() => !!document.querySelector('#menu .picker')));
  await tap('GARAGE'); await page.locator('#menu .picker .prow').nth(2).locator('button').nth(1).click(); await page.waitForTimeout(600);
  await tap('SELECT');
  console.log('back in setup:', (await btns()).split(' | ').filter((b) => /SOLO|VS AI|GARAGE/.test(b)).join(' | '));
  console.log('shown:', await page.evaluate(() => document.querySelector('#menu .selcar').textContent));
  await page.evaluate(() => document.querySelector('#menu .selcar').scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
  await page.screenshot({ path: 'tools/scratch/_gf2-setup.png' });
  await tap('GARAGE'); await tap('TYRES'); console.log('tyres:', (await btns()).split(' | ').slice(-3).join(' | '));
  await page.screenshot({ path: 'tools/scratch/_gf2-tyres.png' });
  await tap('BACK'); await tap('PAINT'); console.log('paint:', (await btns()).split(' | ').slice(-4).join(' | '));
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

// _ai10shot.mjs - ?ai10: setup's ticker nudged to 10, LAUNCH; the race has 10 AI, ten liveries.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&menu=1&guide=0');
  await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1200);
  const tap = async (t, exact) => { await page.waitForTimeout(600); await page.locator('#menu button', exact ? { hasText: new RegExp('^' + t + '$') } : { hasText: t }).first().click(); };
  await tap('TEST MODE'); await tap('CIRCUITS'); await page.waitForTimeout(600); await page.locator('#menu button.card').nth(4).click();
  await tap('VS AI');
  for (let i = 0; i < 6; i++) { await page.waitForTimeout(600); await page.locator('#menu .row', { has: page.locator('.val', { hasText: 'AI CAR' }) }).locator('button').last().click(); }
  console.log('ticker:', await page.evaluate(() => [...document.querySelectorAll('#menu .val')].map((e) => e.textContent).find((t) => /AI CAR/.test(t))));
  await page.screenshot({ path: 'tools/scratch/_ai10-setup.png' });
  await tap('LAUNCH'); await page.waitForTimeout(3000);
  console.log('race AI:', await page.evaluate(() => window.__game.ai.length), '| liveries:', await page.evaluate(() => new Set(window.__game.ai.map((r) => r.car.spec.paint)).size));
  await page.mouse.click(195, 422); await page.waitForTimeout(1500); await page.screenshot({ path: 'tools/scratch/_ai10-grid.png' });
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

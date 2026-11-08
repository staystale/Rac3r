// the garage with ?realcars=1: the active car's name (the Muscle -> Chevvy Shovelle SS 454)
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer(); process.on('exit', srv.stop);
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('carsim.profile.v1', JSON.stringify({ active: 'muscle-rwd' })));
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(srv.url + '/?touch=1&menu=1&guide=0');
await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(800);
const tap = async (t) => { await page.locator('#menu button', { hasText: t }).first().click(); await page.waitForTimeout(600); };
await tap('GARAGE');
await page.screenshot({ path: 'tools/scratch/_plain-garage.png' });
console.log(await page.evaluate(() => document.querySelector('#menu').innerText.split('\n').slice(0, 8).join(' | ')));
console.log(errs.join('; ') || 'no errors');
await browser.close();

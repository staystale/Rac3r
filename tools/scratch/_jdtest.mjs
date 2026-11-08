import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer(); process.on('exit', srv.stop);
const browser = await launchBrowser();
const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const page = await ctx.newPage(); const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(srv.url + '/?touch=1&dev=1&guide=0&level=knobhill&jokerhint=1&aidust=1');
await page.waitForFunction(() => window.__game && window.__game.car, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'tools/scratch/_jd1.png' });
for (let i = 0; i < 14; i++) { await page.mouse.click(600, 300); await page.waitForTimeout(250); }
await page.keyboard.down('w'); await page.waitForTimeout(1500); await page.keyboard.up('w');
await page.screenshot({ path: 'tools/scratch/_jd2.png' });
const audio = await page.evaluate(() => { const a = window.__game.audio; return a ? { state: a.state, vol: a.volume } : null; });
console.log(JSON.stringify(audio), errs.join(' | ') || 'no errors');
await browser.close();

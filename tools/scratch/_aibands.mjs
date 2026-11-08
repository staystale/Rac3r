// _aibands.mjs - ?aibands: the setup's AI rows with and without ?dev (AI DRIVERS only with dev),
// and the field a 6-AI Real race deals (skill / risk / aggression).
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  for (const q of ['&aibands=1', '&aibands=1&dev=1']) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    await page.goto(srv.url + '/?touch=1&menu=1&guide=0' + q);
    await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1200);
    const tap = async (t) => { await page.locator('#menu button', { hasText: t }).first().click(); await page.waitForTimeout(700); };
    await tap('TEST MODE'); await tap('CIRCUITS'); await page.locator('#menu button.card').first().click(); await page.waitForTimeout(900);
    await tap('VS AI'); await page.locator('#menu button', { hasText: /^REAL$/ }).first().click(); await page.waitForTimeout(500);
    const has = await page.evaluate(() => [...document.querySelectorAll('#menu button')].some((b) => b.textContent.includes('AI DRIVERS')));
    await tap('LAUNCH');
    await page.waitForFunction(() => window.__game && window.__game.ai && window.__game.ai.length > 0, null, { timeout: 60000 });
    const field = await page.evaluate(() => window.__game.ai.map((e) => `s${e.drv.traits.skill.toFixed(2)} r${e.drv.traits.risk.toFixed(2)} a${e.drv.traits.aggression.toFixed(2)}`).join(' | '));
    console.log(`${q}: AI DRIVERS ${has ? 'shown' : 'hidden'} | Real field ${field}`, errs[0] || '');
    await ctx.close();
  }
} finally { await browser.close(); srv.stop(); }

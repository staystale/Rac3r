// _aisliders.mjs - ?aisliders round trip: setup -> AI DRIVERS -> move SKILL and RISK -> BACK ->
// the setup line -> LAUNCH 6 AI; the field's traits as the race dealt them. Phone shots.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&menu=1&guide=0&aisliders=1');
  await page.waitForSelector('#menu button', { timeout: 30000 }); await page.waitForTimeout(1200);
  const tap = async (t) => { await page.locator('#menu button', { hasText: t }).first().click(); await page.waitForTimeout(700); };
  await tap('TEST MODE'); await tap('CIRCUITS'); await page.locator('#menu button.card').first().click(); await page.waitForTimeout(900);
  await tap('VS AI'); await tap('AI DRIVERS');
  await page.screenshot({ path: 'tools/scratch/_aisliders-1-panel.png' });
  const setRange = (i, v) => page.evaluate(([i, v]) => { const r = document.querySelectorAll('#menu input[type=range]')[i]; r.value = v; r.dispatchEvent(new Event('input')); }, [i, v]);
  await setRange(0, 0.85); await setRange(2, 0.8); await page.waitForTimeout(300);
  console.log('panel:', await page.evaluate(() => [...document.querySelectorAll('#menu button.on')].map((b) => b.textContent).join(',') + ' | ' + [...document.querySelectorAll('#menu .sub')].map((s) => s.textContent).find((t) => t.startsWith('THE FIELD'))));
  await page.screenshot({ path: 'tools/scratch/_aisliders-2-moved.png' });
  await tap('BACK');
  console.log('setup line:', await page.evaluate(() => [...document.querySelectorAll('#menu .sub')].map((s) => s.textContent).find((t) => /SKILL/.test(t))));
  await tap('LAUNCH');
  await page.waitForFunction(() => window.__game && window.__game.ai && window.__game.ai.length > 0, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const field = await page.evaluate(() => window.__game.ai.map((e) => `${e.drv.traits.persona} s${e.drv.traits.skill.toFixed(2)} r${(e.drv.traits.risk ?? -1).toFixed(2)} kb${e.drv.traits.kBrake} p${(e.drv.traits.power ?? 1).toFixed(3)} pace${e.drv.traits.pace.toFixed(3)}`));
  console.log('field:', field.join(' | '));
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

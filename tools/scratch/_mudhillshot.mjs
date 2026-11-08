// phone shot of the Rough Patch's mud hills under ?k12 (a Subaroo on the mud hill)
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&level=rough-patch&k12=1');
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(() => window.__game.launch('rough-patch', 'wrz-awd', { ai: 0 }));
  await page.waitForTimeout(1200); await page.mouse.click(195, 422); await page.waitForTimeout(300);
  await page.evaluate(() => { const game = window.__game; Object.assign(game.car, { x: -92, y: 688, heading: 0, vx: 0, vy: 0 });
    game.input.update = () => ({ steer: 0, throttle: 0.7, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false }); });
  await page.waitForTimeout(3500); await page.screenshot({ path: 'tools/scratch/_mudhill.png' });
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

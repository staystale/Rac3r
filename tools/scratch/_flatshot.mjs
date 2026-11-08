// _flatshot.mjs - photograph a car's soft / flat tyres off and with ?flatsize=1 (phone size, crop
// round the car): front left 50 %, front right 30 %, rear left 10 %, rear right 0 % air.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const srv = await startServer();
const browser = await launchBrowser();
const errors = [];
for (const [name, q] of [['_flat-off', ''], ['_flat-on', '&flatsize=1']]) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  await page.goto(srv.url + '/?dev=1&car=hatch-fwd' + q, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__game && window.__game.car, null, { timeout: 30000 });
  await page.mouse.click(422, 195); await page.waitForTimeout(600);
  await page.evaluate(() => { const c = window.__game.car; c.tyreP = [0.5, 0.3, 0.1, 0.0]; c.tyreLeak = [0, 0, 0, 0]; });
  // roll slowly so the lumps / wobble show
  await page.keyboard.down('w'); await page.waitForTimeout(500); await page.keyboard.up('w');
  await page.evaluate(() => { const c = window.__game.car; c.tyreP = [0.5, 0.3, 0.1, 0.0]; });
  await page.waitForTimeout(300);
  const box = await page.evaluate(() => { const g = window.__game; return { kph: Math.hypot(g.car.vx, g.car.vy) * 3.6, p: g.car.tyreP }; });
  console.log(name, JSON.stringify(box));
  await page.screenshot({ path: `tools/scratch/${name}.png`, clip: { x: 357, y: 180, width: 80, height: 48 } });
  await ctx.close();
}
await browser.close(); srv.stop();
console.log(errors.length ? errors.join('\n') : 'no page errors');

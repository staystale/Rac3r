// _fxpools.mjs - the other effect pools under a 19-AI race (owner 11-04: "smoke dust and other
// things still seem to pop out"): crash CHIPS (near = ON THE SCREEN, the renderer's own transform) (lying debris, life 5-12 s) and SPARKS dropped by a
// full pool (Array shift) while young, near you or anywhere; 60 s, the player on the demo driver.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const level = process.argv[2] || 'knobhill', n = +(process.argv[3] || 19), q = process.argv[4] || '';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    const log = window.__fxLog = { chip: 0, chipNear: 0, spark: 0, sparkNear: 0, chipMax: 0 };
    const shift0 = Array.prototype.shift, push0 = Array.prototype.push;
    const kind = (o) => !o || typeof o !== 'object' ? null : ('sz' in o && 'col' in o && 'life' in o && !('trail' in o) ? 'chip' : ('col' in o && 'life' in o ? 'spark' : null));
    Array.prototype.push = function (...items) { if (kind(items[0]) === 'chip') log.chipMax = Math.max(log.chipMax, this.length + 1); return push0.apply(this, items); };
    const splice0 = Array.prototype.splice;
    Array.prototype.splice = function (...args) {
      const out = splice0.apply(this, args), o = out[0];
      if (kind(o) === 'chip' && o.age < o.life - 0.05 && !o.out) {
        const g = window.__game, r = g && g.renderer, sx = r ? r.toScreenX(o.x) : -1, sy = r ? r.toScreenY(o.y) : -1, near = !!r && sx >= 0 && sy >= 0 && sx <= r.W && sy <= r.H;
        log.chip++; if (near) log.chipNear++;
      }
      return out;
    };
    Array.prototype.shift = function () {
      const o = shift0.apply(this);
      const k = kind(o);
      if (k && o.age < o.life - 0.05) {
        const g = window.__game, r = g && g.renderer, sx = r ? r.toScreenX(o.x) : -1, sy = r ? r.toScreenY(o.y) : -1, near = !!r && sx >= 0 && sy >= 0 && sx <= r.W && sy <= r.H;
        log[k]++; if (near) log[k + 'Near']++;
      }
      return o;
    };
  });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + `/?touch=1&guide=0&menu=0&rules=0&level=${level}${q}`);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(([lv, c]) => window.__game.launch(lv, 'rally-4x4', { ai: c, rx: true }), [level, n]);
  await page.waitForTimeout(1500); await page.mouse.click(195, 422); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(window.__game.level.subtrack);
    window.__game.input.update = () => ({ ...driver.drive(window.__game.car), reverse: 0, shiftUp: false, shiftDown: false });
  });
  await page.waitForTimeout(60000);
  console.log(`${level} ${n} AI ${q || 'plain'}:`, JSON.stringify(await page.evaluate(() => window.__fxLog)), errs[0] || 'no errors');
} finally { await browser.close(); srv.stop(); }

// _puffwatch.mjs - the REAL game: every puff that leaves a pool before its life ran out (where:
// on screen or off, the pool's size), and any frame the puffs drop by many at once. Knobhill RX,
// 5 AI, the player on the demo driver, ?puffpool=1 (args: extra query), 60 s.
import { startServer, launchBrowser } from '../lib/browser.mjs';
const extra = process.argv[2] ?? '&puffpool=1', level = process.argv[3] || 'knobhill';
const srv = await startServer();
const browser = await launchBrowser();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => {
    const log = window.__puffLog = { early: [], drops: [], maxLen: 0, pools: new Set() };
    const isPuff = (p) => p && typeof p === 'object' && 'r0' in p && 'grow' in p && 'age' in p;
    const splice0 = Array.prototype.splice, push0 = Array.prototype.push;
    Array.prototype.push = function (...items) {
      if (isPuff(items[0])) { log.pools.add(this); log.maxLen = Math.max(log.maxLen, this.length + 1); }
      return push0.apply(this, items);
    };
    Array.prototype.splice = function (...args) {
      const out = splice0.apply(this, args);
      if (isPuff(out[0]) && out[0].age < out[0].life - 0.05) {
        const p = out[0], g = window.__game, r = g && g.renderer;
        log.early.push({ age: +p.age.toFixed(2), life: +p.life.toFixed(2), ai: !!p.ai, rgb: p.rgb, len: this.length,
          dx: g ? Math.round(p.x - g.car.x) : 0, dy: g ? Math.round(p.y - g.car.y) : 0 });
      }
      return out;
    };
    let prev = 0;
    const tick = () => {
      let n = 0; for (const pool of log.pools) n += pool.length;
      if (prev - n > 25) log.drops.push({ t: +(performance.now() / 1000).toFixed(1), from: prev, to: n });
      prev = n; requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(srv.url + '/?touch=1&guide=0&menu=0&rules=0&level=' + level + extra);
  await page.waitForFunction(() => window.__game && window.__game.launch, null, { timeout: 60000 });
  await page.evaluate(([lv, n]) => window.__game.launch(lv, 'rally-4x4', { ai: n, rx: true }), [level, +(process.env.AIN || 5)]);
  await page.waitForTimeout(1500); await page.mouse.click(195, 422); await page.waitForTimeout(800);
  await page.evaluate(async () => {
    const game = window.__game, auto = await import('/src/ai/autodrive.ts');
    const driver = auto.createAutoDriver(game.level.subtrack);
    game.input.update = () => ({ ...driver.drive(game.car), reverse: 0, shiftUp: false, shiftDown: false });
  });
  // RATE=n: CPU x n (a phone stand-in); the draw ms (game.drawMs, smoothed) sampled each second
  if (+process.env.RATE > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +process.env.RATE }); }
  const draws = [], sims = [];
  for (let t = 0; t < 60; t++) { await page.waitForTimeout(1000); if (t >= 10) { const m = await page.evaluate(() => [window.__game.drawMs, window.__game.simMs]); draws.push(m[0]); sims.push(m[1]); } }
  const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)].toFixed(1); };
  const p95 = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length * 0.95)].toFixed(1); };
  console.log(`draw ms median ${med(draws)} p95 ${p95(draws)} | sim ms median ${med(sims)}`);
  const log = await page.evaluate(() => {
    const l = window.__puffLog; let live = 0; for (const p of l.pools) live += p.length;
    return { early: l.early, drops: l.drops, maxLen: l.maxLen, pools: l.pools.size, live };
  });
  const near = log.early.filter((e) => Math.abs(e.dx) < 30 && Math.abs(e.dy) < 55);
  console.log(`pools ${log.pools}, biggest ${log.maxLen}, live at end ${log.live}`);
  console.log(`early removals ${log.early.length}, near you (on a phone screen) ${near.length}`);
  console.log('near, first 12:', JSON.stringify(near.slice(0, 12)));
  console.log('frames dropping >25 puffs at once:', JSON.stringify(log.drops.slice(0, 20)));
  console.log(errs.join('; ') || 'no errors');
} finally { await browser.close(); srv.stop(); }

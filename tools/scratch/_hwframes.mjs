// _hwframes.mjs - frame work on the highway at CPU x4 with the autopilot driving (framecheck's
// autodriver does not drive the highway): 15 s of race after launch, our rAF work per frame and
// tiles painted, for an A/B of a switch. node tools/scratch/_hwframes.mjs [extra query]
import { startServer, launchBrowser, gotoGame } from '../lib/browser.mjs';
const srv = await startServer();
const b = await launchBrowser();
try {
  const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3,
    isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.addInitScript(() => {
    const raf = window.requestAnimationFrame.bind(window); window.__work = [];
    window.requestAnimationFrame = (cb) => raf((t) => {
      const t0 = performance.now(); try { cb(t); } finally { window.__work.push(performance.now() - t0); }
    });
  });
  await gotoGame(p, srv.url + '/?touch=1&guide=0&menu=0&rules=0&noaudio=1&autopilot=110'
    + (process.argv[2] || ''));
  await p.touchscreen.tap(400, 200);
  await p.waitForTimeout(300);
  await p.evaluate(() => window.__game.launch('highway', 'hatch-rwd',
    { ai: 0, weather: { mode: 'dry', season: 2, seed: 4 } }));
  await p.waitForTimeout(6000);
  const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const r = await p.evaluate(async () => {
    const g = window.__game, w0 = window.__work.length, t0 = g.renderer.groundRenders;
    const x0 = g.car.x, y0 = g.car.y;
    await new Promise((done) => setTimeout(done, 15000));
    return { work: window.__work.slice(w0), tiles: g.renderer.groundRenders - t0,
      moved: Math.hypot(g.car.x - x0, g.car.y - y0) };
  });
  const wk = r.work.sort((a, c) => a - c), q = (f) => wk[Math.floor(f * (wk.length - 1))].toFixed(1);
  console.log(`[${process.argv[2] || 'plain'}] moved ${r.moved.toFixed(0)} m, frames ${wk.length},`
    + ` work median ${q(0.5)} p95 ${q(0.95)} worst ${wk[wk.length - 1].toFixed(1)} ms,`
    + ` over 14 ms ${wk.filter((x) => x > 14).length}; tiles ${r.tiles}; errors ${errors.length}`);
} finally { await b.close(); srv.stop(); }

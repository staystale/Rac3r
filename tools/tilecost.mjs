// tilecost.mjs - phase 6 (tile cost): WHY do ground tiles cost so much? Per level, on the same fast lap as
// tools/framecheck.mjs (CPU x4, autodrive lap, 600 frames), it counts the tiles painted by reason (new ground,
// wear repaint, camera prefetch), per zoom step, and the ms per tile split by stage (layers, paletteSnap, hillShade).
// node tools/tilecost.mjs [level ...]   (default: test-track thruston killder stage-llanfairsheepdip highway)
// Measuring only: the counters live in src/render/tiles.ts, read through renderer.tileStats.
import { startServer, launchBrowser } from './lib/browser.mjs';
const levels = process.argv.length > 2 ? process.argv.slice(2)
  : ['test-track', 'thruston', 'killder', 'stage-llanfairsheepdip', 'highway'];
const srv = await startServer();
let b;
try {
  b = await launchBrowser();
  for (const lv of levels) {
    const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await p.goto(srv.url + '/?touch=1&guide=0&level=' + lv + '&car=track-rwd');
    await p.tap?.('body').catch?.(() => {}); await p.touchscreen.tap(400, 200); await p.waitForTimeout(4000);
    const s = await p.evaluate(() => new Promise(async (res) => {
      const g = window.__game;
      const A = await import('/src/ai/autodrive.ts');
      const drv = A.createAutoDriver(g.level.subtrack);
      g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false });
      const t0 = g.renderer.tileStats; let n = 0;
      function f() { if (++n < 600) requestAnimationFrame(f); else res({ a: t0, z: g.renderer.tileStats }); }
      requestAnimationFrame(f);
    }));
    const d = (k) => s.z[k] - s.a[k], N = d('tilesPainted'), per = (k) => (N ? d(k) / N : 0).toFixed(1);
    const steps = {};
    for (const k of Object.keys(s.z.perStep)) { const v = s.z.perStep[k] - (s.a.perStep[k] || 0); if (v) steps[k] = v; }
    console.log(`${lv}: tiles ${N} (new ${d('newTiles')}, wear ${d('staleRepaints')}, prefetch ${d('prefetched')}) | ` +
      `per zoom step ${JSON.stringify(steps)} | ms per tile: layers ${per('msLayers')}, snap ${per('msSnap')}, ` +
      `shade ${per('msShade')}, total ${per('tileMs')}`);
    await ctx.close();
  }
} finally {
  await b?.close();
  srv.stop();
}

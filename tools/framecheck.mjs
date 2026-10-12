// framecheck.mjs — frame times on a fast lap at phone-ish CPU speed (CDP CPU throttle x4), the lap driven by src/ai/autodrive.ts.
// node tools/framecheck.mjs <level> [extra query, e.g. &noshade=1]. Reports median / p95 / worst frame, frames over 33 ms and the
// cost of a ground tile. Built 2026-10-03 for "still seeing lag at high speeds".
// Work line: ms the game's own rAF callbacks take per frame (not the display gap).
import { startServer, launchBrowser } from './lib/browser.mjs';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
await p.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window); window.__raf = raf; window.__work = [];
  window.requestAnimationFrame = (cb) => raf((t) => {
    const t0 = performance.now(); try { cb(t); } finally { window.__work.push(performance.now() - t0); }
  });
});
const extra = process.argv[3] || '';
await p.goto(srv.url + '/?touch=1&guide=0&level=' + (process.argv[2] || 'test-track') + '&car=track-rwd' + extra); await p.tap?.('body').catch?.(() => {}); await p.touchscreen.tap(400, 200); await p.waitForTimeout(4000);
const lv = process.argv[2] || 'test-track';
// launch a session, then let the demo driver drive it (the same driver as the menu demo lap)
const r = await p.evaluate((lv) => new Promise(async (res) => {
  const g = window.__game;
  const A = await import('/src/ai/autodrive.ts');
  const drv = A.createAutoDriver(g.level.subtrack);
  g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false });
  const w0 = window.__work.length; const times = []; let last = performance.now(), n = 0;
  function f(now) { times.push(now - last); last = now; if (++n < 600) window.__raf(f); else res({ work: window.__work.slice(w0), times, tiles: g.renderer.groundRenders, tileMs: g.renderer.tileMs }); }
  window.__raf(f);
}), lv);
const t = r.times.slice(30).sort((a, b) => a - b);
const pct = (q) => t[Math.floor(q * (t.length - 1))].toFixed(1);
console.log(`${lv} (CPU x4, autodrive lap): frame ms median ${pct(0.5)} | p95 ${pct(0.95)} | worst ${t[t.length - 1].toFixed(1)} | frames over 33 ms: ${t.filter((x) => x > 33).length} of ${t.length} | tiles painted ${r.tiles}, ${(r.tileMs / r.tiles).toFixed(1)} ms each`);
const wk = r.work.slice(30).sort((a, b) => a - b);
const wp = (q) => wk[Math.floor(q * (wk.length - 1))].toFixed(1);
console.log(`${lv} work ms median ${wp(0.5)} | p95 ${wp(0.95)} | worst ${wk[wk.length - 1].toFixed(1)} ` +
  `| over 8 ms: ${wk.filter((x) => x > 8).length} ` +
  `| over 14 ms: ${wk.filter((x) => x > 14).length} of ${wk.length} frames`);
await b.close();
} finally {
  await b?.close();
  srv.stop();
}

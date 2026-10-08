// framecheck.mjs — frame times on a fast lap at phone-ish CPU speed (CDP CPU throttle x4), the lap driven by src/autodrive.js.
// node tools/framecheck.mjs <level> [extra query, e.g. &noshade=1]. Reports median / p95 / worst frame, frames over 33 ms and the
// cost of a ground tile. Built 2026-10-03 for "still seeing lag at high speeds".
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const extra = process.argv[3] || '';
await p.goto('http://localhost:8080/?touch=1&guide=0&level=' + (process.argv[2] || 'test-track') + '&car=track-rwd' + extra); await p.tap?.('body').catch?.(() => {}); await p.touchscreen.tap(400, 200); await p.waitForTimeout(4000);
const lv = process.argv[2] || 'test-track';
// launch a session, then let the demo driver drive it (the same driver as the menu demo lap)
const r = await p.evaluate((lv) => new Promise(async (res) => {
  const g = window.__game;
  const A = await import('/src/autodrive.js');
  const drv = A.createAutoDriver(g.level.subtrack);
  g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false });
  const times = []; let last = performance.now(), n = 0;
  function f(now) { times.push(now - last); last = now; if (++n < 600) requestAnimationFrame(f); else res({ times, tiles: g.renderer.groundRenders, tileMs: g.renderer.tileMs }); }
  requestAnimationFrame(f);
}), lv);
const t = r.times.slice(30).sort((a, b) => a - b);
const pct = (q) => t[Math.floor(q * (t.length - 1))].toFixed(1);
console.log(`${lv} (CPU x4, autodrive lap): frame ms median ${pct(0.5)} | p95 ${pct(0.95)} | worst ${t[t.length - 1].toFixed(1)} | frames over 33 ms: ${t.filter((x) => x > 33).length} of ${t.length} | tiles painted ${r.tiles}, ${(r.tileMs / r.tiles).toFixed(1)} ms each`);
await b.close();

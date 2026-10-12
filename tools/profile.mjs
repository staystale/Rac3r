// profile.mjs — CPU profile of an autodrive lap at CPU x4; prints self-time per function (top 25). node tools/profile.mjs <level>
// Built 2026-10-04 when four A/B guesses in a row failed to find a frame-cost regression on Thruston: measure, don't guess.
import { startServer, launchBrowser } from './lib/browser.mjs';
const lv = process.argv[2] || 'thruston';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const extra = process.argv[3] || '';
await p.goto(srv.url + '/?touch=1&guide=0&menu=0&level=' + lv + '&car=track-rwd' + extra); await p.touchscreen.tap(400, 200); await p.waitForTimeout(4000);
await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 200 }); await cdp.send('Profiler.start');
await p.evaluate(() => new Promise(async (res) => { const g = window.__game; const A = await import('/src/ai/autodrive.ts'); const drv = A.createAutoDriver(g.level.subtrack);
  g.input.update = () => ({ ...drv.drive(g.car), reverse: 0, shiftUp: false, shiftDown: false }); setTimeout(res, 10000); }));
const { profile } = await cdp.send('Profiler.stop');
const dt = {}; const byId = new Map(profile.nodes.map((n) => [n.id, n]));
for (let i = 0; i < profile.samples.length; i++) { const n = byId.get(profile.samples[i]); const k = (n.callFrame.functionName || '(anon)') + ' ' + (n.callFrame.url.split('/').pop() || '') + ':' + n.callFrame.lineNumber; dt[k] = (dt[k] || 0) + (profile.timeDeltas[i] || 0); }
const tot = Object.values(dt).reduce((a, x) => a + x, 0);
for (const [k, v] of Object.entries(dt).sort((a, c) => c[1] - a[1]).slice(0, 25)) console.log((100 * v / tot).toFixed(1).padStart(5) + '%  ' + k);
await b.close();
} finally {
  await b?.close();
  srv.stop();
}

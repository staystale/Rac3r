// solidcheck.mjs — drive a car into one of each SOLID prop kind in the live game (user: "trees, planes etc collidable"). Pass =
// the car never ends up overlapping the box and is stopped or bounced. Case 'side': a thin tree hits the car's SIDE between its
// corners (what the corner-only barrier test would miss). Needs the server. node tools/solidcheck.mjs [level]
import { startServer, launchBrowser } from './lib/browser.mjs';
const lv = process.argv[2] || 'thruston';
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.goto(srv.url + '/?pc=1&guide=0&menu=0&level=' + lv); await p.mouse.click(400, 200); await p.waitForTimeout(2000);
const fails = [];
for (const [kind, mode] of [['tree', 'head'], ['tree', 'side'], ['plane', 'head'], ['truck', 'head'], ['hangar', 'head'], ['marshal', 'head'], ['board', 'head']]) {
  const r = await p.evaluate(([kind, mode]) => new Promise((res) => {
    const g = window.__game, list = g.level.solids, sb = list.find((q) => q.kind === kind);
    if (!sb) return res({ skip: true });
    const c = g.car, spd = 15;
    g.input.update = () => ({ steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
    if (mode === 'head') { const h = 0.3; c.x = sb.x - Math.cos(h) * 14; c.y = sb.y - Math.sin(h) * 14; c.heading = h; c.vx = Math.cos(h) * spd; c.vy = Math.sin(h) * spd; }
    else { const h = 0.3, px = -Math.sin(h), py = Math.cos(h); c.x = sb.x - px * 3.2; c.y = sb.y - py * 3.2; c.heading = h; c.vx = px * spd * 1.4; c.vy = py * spd * 1.4; }   // sliding SIDEWAYS into it from 3.2 m (from 10 m the tyres stopped the slide first)
    c.yawRate = 0; g.renderer.snap(c);
    const overlap = () => { const s = c.spec, hl = s.len * 0.48, hw = s.wid * 0.48, cc = Math.cos(c.heading), cs = Math.sin(c.heading), bc = Math.cos(sb.rot), bs = Math.sin(sb.rot), dx = c.x - sb.x, dy = c.y - sb.y; let m = Infinity;
      for (const [ux, uy] of [[cc, cs], [-cs, cc], [bc, bs], [-bs, bc]]) { const ov = hl * Math.abs(cc * ux + cs * uy) + hw * Math.abs(-cs * ux + cc * uy) + sb.w / 2 * Math.abs(bc * ux + bs * uy) + sb.h / 2 * Math.abs(-bs * ux + bc * uy) - Math.abs(dx * ux + dy * uy); m = Math.min(m, ov); } return m; };
    let worst = -Infinity; const t0 = performance.now();
    (function f() { worst = Math.max(worst, overlap()); if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res({ worst, end: overlap(), speed: Math.hypot(c.vx, c.vy) }); })();
  }), [kind, mode]);
  if (r.skip) { console.log('skip', kind); continue; }
  const ok = r.end <= 0.05 && r.worst < 0.6;
  if (!ok) fails.push(kind + '/' + mode);
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${kind.padEnd(8)} ${mode.padEnd(4)} worst overlap ${r.worst.toFixed(2)} m, at the end ${r.end.toFixed(2)} m, speed after ${r.speed.toFixed(1)} m/s (hit at 15)`);
}
if (errs.length) { console.log('PAGE ERRORS', errs); fails.push('errors'); }
console.log(fails.length ? 'FAILED: ' + fails.join(' ') : 'solids: all OK');
if (fails.length) process.exitCode = 1;
await b.close();
} finally {
  await b?.close();
  srv.stop();
}

// cutcheck.mjs — TRACK CUTS (2026-10-04) in the real game: in a race, after the green, the player is SHOVED (velocity set every frame)
// straight across the infield from a centreline point A to a point B much further round the lap; then checks the outcome:
//   circuit race -> put back where it left (progress restored, notice 'PUT BACK');  RX race -> a time penalty (_cutPen), notice;
//   and a control: the same speed along the track (no cut) -> nothing. Photo of the notice: shots/look/cut-<level>.png
// node tools/cutcheck.mjs [level] [rx 0|1]
import { startServer, launchBrowser } from './lib/browser.mjs';
const [lv = 'thruston', rx = '0'] = process.argv.slice(2);
const srv = await startServer();
let b;
try {
b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.text().startsWith('dbg')) console.log(m.text()); });
await p.goto(srv.url + '/?menu=1&guide=0'); await p.waitForTimeout(3000);
await p.evaluate(([lv, rx]) => { const g = window.__game; g.menu.hide(); g.launch(lv, 'hatch-rwd', { ai: 1, diff: 0, laps: 3, rx: !!rx });
  g.input.update = () => ({ steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false }); }, [lv, +rx]);
await p.waitForTimeout(5500);   // lights
// pick A (a little ahead of the car) and B: the point >= 60 m further round with the SHORTEST straight line, the line mostly off-road
const plan = await p.evaluate(async () => {
  const L = await import('/src/lab.js'), g = window.__game, sub = L.LEVEL.subtrack, P = sub.pts, n = P.length;
  const q0 = L.querySubtrack(sub, g.car.x, g.car.y).trackDist; let ia = P.findIndex((pt) => pt.dist > q0 + 40); if (ia < 0) ia = 0;
  let best = null;
  for (let k = 1; k < n; k++) { const B = P[(ia + k) % n], ahead = ((B.dist - P[ia].dist) + sub.totalDist) % sub.totalDist; if (ahead < 70 || ahead > 400) continue;
    const e = Math.hypot(B.x - P[ia].x, B.y - P[ia].y), save = ahead - e;
    let off = 0; for (let s = 0.2; s <= 0.8; s += 0.1) { const x = P[ia].x + (B.x - P[ia].x) * s, y = P[ia].y + (B.y - P[ia].y) * s; if (L.querySubtrack(sub, x, y).dist > sub.width / 2 + 2) off++; }
    if (off >= 6 && (!best || save > best.save)) best = { ib: (ia + k) % n, save, e }; }
  return { A: { x: P[ia].x, y: P[ia].y, d: P[ia].dist }, B: best && { x: P[best.ib].x, y: P[best.ib].y, d: P[best.ib].dist }, save: best && best.save, straight: best && best.e };
});
console.log('plan', JSON.stringify(plan));
const shove = async (to, ms) => p.evaluate(([to, ms]) => new Promise((res) => { const g = window.__game, t0 = performance.now();
  const f = () => { const dx = to.x - g.car.x, dy = to.y - g.car.y, d = Math.hypot(dx, dy); if (d < 2 || performance.now() - t0 > ms || (g.notice && performance.now() - g.notice.at < 300)) return res(d);
    g.car.heading = Math.atan2(dy, dx); g.car.vx = dx / d * 22; g.car.vy = dy / d * 22; g.car.yawRate = 0; requestAnimationFrame(f); }; f(); }), [to, ms]);
// to A (on the road), then across to B
const A = plan.A, B = plan.B;
await p.evaluate((A) => { const g = window.__game; g.car.x = A.x - 5; g.car.y = A.y; }, A);
await shove(A, 3000);
const before = await p.evaluate(() => ({ prog: window.__game.car._prog, pen: window.__game.car._cutPen || 0 }));
await shove(B, 30000);
await p.waitForTimeout(400);
await p.screenshot({ path: `shots/look/cut-${lv}.png` });
const after = await p.evaluate(() => { const g = window.__game, c = g.car; return { prog: c._prog, pen: c._cutPen || 0, cuts: c._cuts || 0, notice: g.notice && g.notice.text }; });
console.log('before', JSON.stringify(before), 'after', JSON.stringify(after));
const ok = +rx ? after.pen >= 2 && /CUT/.test(after.notice || '') : after.cuts >= 1 && after.prog - before.prog < 60 && /PUT BACK/.test(after.notice || '');
console.log(ok && !errs.length ? 'CUT CHECK: OK' : 'FAILED', errs);
await b.close();
} finally {
  await b?.close();
  srv.stop();
}

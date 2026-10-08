// resetcheck.mjs — RESET on circuits (user, 2026-10-04): put back BEHIND / in line with where the car LEFT the road, half on /
// half off on the side it left by, nose 5-15 deg back toward the road, never on the racing line. Needs the server.
// node tools/resetcheck.mjs [level ...]
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const levels = process.argv.slice(2).length ? process.argv.slice(2) : ['thruston', 'test-track', 'naffcar', 'grass-track'];
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 } })).newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
const fails = [];
for (const lv of levels) {
  await p.goto('http://localhost:8080/?pc=1&guide=0&menu=0&level=' + lv); await p.mouse.click(400, 200); await p.waitForTimeout(500);
  const sub = await p.evaluate(() => ({ total: window.__game.level.subtrack.totalDist, w: window.__game.level.subtrack.width }));
  for (const [frac, side] of [[0.3, 1], [0.55, -1], [0.8, 1], [0.97, -1]]) {
    const d0 = sub.total * frac;
    // on the road at d0 (a little off-centre on the exit side), let the tracker see it, then 6 m on and 9 m past the edge
    const put = (d, off) => p.evaluate(([d, off]) => {
      const g = window.__game, st = g.level.subtrack; let q = st.pts[0]; for (const pt of st.pts) if (pt.dist <= d) q = pt;
      Object.assign(g.car, { x: q.x + q.nx * off, y: q.y + q.ny * off, heading: q.heading, vx: 0, vy: 0, yawRate: 0 });
    }, [d, off]);
    await put(d0, side * 2); await p.waitForTimeout(150);
    await put(d0 + 6, side * (sub.w / 2 + 9)); await p.waitForTimeout(150);
    const r = await p.evaluate(() => {
      const g = window.__game; g.reset(); const c = g.car, st = g.level.subtrack;
      let q = st.pts[0], bd = Infinity; for (const pt of st.pts) { const dd = (c.x - pt.x) ** 2 + (c.y - pt.y) ** 2; if (dd < bd) { bd = dd; q = pt; } }
      const off = (c.x - q.x) * q.nx + (c.y - q.y) * q.ny;
      let dh = c.heading - q.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      return { dist: q.dist, off, dh: dh * 180 / Math.PI };
    });
    // behind the exit, by at most ~15 m (wrapping at the line; onTrack snaps to the sample point BEFORE d, and long straights
    // are sampled sparsely — Naffcar 12.6 m measured)
    const behind = ((d0 - r.dist) + sub.total) % sub.total;
    const okBehind = behind >= 0 && behind <= 15;
    const okEdge = Math.sign(r.off) === side && Math.abs(Math.abs(r.off) - sub.w / 2) < 1;
    const okAng = Math.sign(r.dh) === -side && Math.abs(r.dh) >= 4.5 && Math.abs(r.dh) <= 15.5;
    const ok = okBehind && okEdge && okAng;
    if (!ok) fails.push(`${lv}@${frac}`);
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${lv.padEnd(12)} exit ${d0.toFixed(0).padStart(5)} m side ${side > 0 ? '+' : '-'} -> ${behind.toFixed(1)} m behind, offset ${r.off.toFixed(1)} (edge ${(sub.w / 2).toFixed(1)}), nose ${r.dh.toFixed(1)} deg`);
  }
}
if (errs.length) { console.log('PAGE ERRORS', errs); fails.push('errors'); }
console.log(fails.length ? 'FAILED: ' + fails.join(' ') : 'ALL OK');
await b.close();

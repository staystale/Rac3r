// wideshot.mjs — 1800x1100 PC-size photos at track distance + offset: node tools/wideshot.mjs '[[d, off, name], ...]' <level> -> shots/look/wide-<name>.png
import { startServer, launchBrowser } from './lib/browser.mjs';
const srv = await startServer();
process.on('exit', srv.stop);
const shots = JSON.parse(process.argv[2]);
const b = await launchBrowser();
const p = await (await b.newContext({ viewport: { width: 1800, height: 1100 }, deviceScaleFactor: 1 })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto(srv.url + '/?pc=1&guide=0&menu=0&level=' + (process.argv[3] || 'thruston')); await p.mouse.click(400, 300); await p.waitForTimeout(2800);
for (const [d, off, n] of shots) {
  await p.evaluate(([d, off]) => { const g = window.__game, st = g.level.subtrack; let q = st.pts[0]; for (const pt of st.pts) if (pt.dist <= d) q = pt; const c = g.car; c.x = q.x + q.nx * off; c.y = q.y + q.ny * off; c.heading = q.heading; c.vx = 0; c.vy = 0; g.renderer.snap(c); }, [d, off]);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `shots/look/wide-${n}.png` });
}
await b.close();
srv.stop();

// thrustonshots.mjs — photographs Thruston's kerbed corners at 844x390 into shots/look/ (distances: 2026-10-04 re-trace) (needs the server).
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
p.on('pageerror', e => console.log('ERR', e.message));
await p.goto('http://localhost:8080/?pc=1&guide=0&menu=0&level=thruston'); await p.mouse.click(400, 200); await p.waitForTimeout(2800);
for (const [d, n] of [[1212, 'startline'], [1195, 'pitentry'], [25, 'pitexit'], [62, 'allard'], [228, 'campbell'], [258, 'cobb'], [305, 'seagrave'], [455, 'noble'], [575, 'goodwood'], [812, 'church'], [1092, 'woodham'], [1140, 'club']]) {
  await p.evaluate((d) => { const g = window.__game, st = g.level.subtrack; let q = st.pts[0]; for (const pt of st.pts) if (pt.dist <= d) q = pt; const c = g.car; c.x = q.x; c.y = q.y; c.heading = q.heading; c.vx = 0; c.vy = 0; g.renderer.snap(c); }, d);
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'shots/look/kerb-' + n + '.png' });
}
await b.close();

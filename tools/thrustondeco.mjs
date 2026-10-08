// thrustondeco.mjs — photographs Thruston's surroundings at 844x390 into shots/look/ (tyre walls, pits, paddock, aircraft,
// hangars, woods). Positions are world x,y (not track distances) so infield items can be framed. Needs the server.
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto('http://localhost:8080/?pc=1&guide=0&menu=0&level=thruston'); await p.mouse.click(400, 200); await p.waitForTimeout(2800);
// [name, track distance | null, offset | world x, world y]
const SHOTS = [['tyres-goodwood', 650, -9], ['tyres-allard', 90, -10], ['pits', 1212, 17], ['paddock', null, -126, 95], ['planes', null, 75, 50], ['hangars', null, -122, -6]];
for (const [n, d, a, bY] of SHOTS) {
  await p.evaluate(([d, a, bY]) => {
    const g = window.__game, c = g.car, st = g.level.subtrack;
    if (d === null) { c.x = a; c.y = bY; c.heading = 0; }
    else { let q = st.pts[0]; for (const pt of st.pts) if (pt.dist <= d) q = pt; c.x = q.x + q.nx * a; c.y = q.y + q.ny * a; c.heading = q.heading; }
    c.vx = 0; c.vy = 0; g.renderer.snap(c);
  }, [d, a, bY]);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `shots/look/deco-${n}.png` });
}
await b.close();

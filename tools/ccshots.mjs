// ccshots.mjs — photographs Castle Cum at 844x390 into shots/look/cc-*.png (corners, chicanes, pits, scenery). Needs the server.
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
const LV = process.argv[3] || 'castle-cum';   // node tools/ccshots.mjs '<json shots>' <level>
await p.goto('http://localhost:8080/?pc=1&guide=0&menu=0&level=' + LV); await p.mouse.click(400, 200); await p.waitForTimeout(2800);
const SHOTS = process.argv[2] ? JSON.parse(process.argv[2]) : [['start', 1330, 0], ['pits', 1300, -20], ['paddock', 20, -45], ['folly', 130, 0], ['avonrise', 300, 0], ['quarry', 384, 0], ['esses', 580, 0], ['oldpaddock', 680, 0], ['tower', 904, 0], ['bobbies', 1010, 0], ['camp', 1255, 0], ['kart', 740, -50]];
for (const [n, d, off] of SHOTS) {
  await p.evaluate(([d, off]) => { const g = window.__game, st = g.level.subtrack, c = g.car; let q = st.pts[0]; for (const pt of st.pts) if (pt.dist <= d) q = pt;
    c.x = q.x + q.nx * off; c.y = q.y + q.ny * off; c.heading = q.heading; c.vx = 0; c.vy = 0; g.renderer.snap(c); }, [d, off]);
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `shots/look/${LV === 'castle-cum' ? 'cc' : LV}-${n}.png` });
}
await b.close();

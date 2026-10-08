// spotshots.mjs — photographs chosen [level, x, y, name] spots (edit the list) at 844x390 into the scratch g/ folder; reports fps.
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const p = await (await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 })).newPage();
p.on('pageerror', e => console.log('ERR', e.message)); p.on('console', m => { if (m.type() === 'error') console.log('CONSOLE', m.text()); });
for (const [lv, x, y, name] of [['thruston', -150, 0, 'inc-grass'], ['sandbox', 0, 0, 'inc-sandbox'], ['test-track', 30, 25, 'inc-gravelpad']]) {
  await p.goto('http://localhost:8080/?pc=1&guide=0&level=' + lv); await p.mouse.click(400, 200); await p.waitForTimeout(2600);
  await p.evaluate(([x, y]) => { const c = window.__game.car; c.x = x; c.y = y; c.vx = 0; c.vy = 0; window.__game.renderer.snap(c); }, [x, y]);
  await p.waitForTimeout(600);
  await p.screenshot({ path: 'C:/Users/Admin/AppData/Local/Temp/claude/C--Users-Admin-Desktop-G-car-sim/fae5219a-2e3f-4303-a8c3-6d8ea38659f0/scratchpad/g/shade-' + name + '.png' });
}
console.log('fps', await p.evaluate(() => window.__game.fps.toFixed(0)));
await b.close();

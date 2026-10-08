import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
const ctx = await b.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', e => errs.push(e.message));
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
// MEASURED BUG IN THIS HARNESS, 2026-09-28: it warped to (-52,-38.5), which after the floor was
// quartered is GRASS. The car managed 17 km/h in 4.2 s and never reached a cone, so it reported 0
// knocked and looked like a cone regression. Aim at the slalom where it actually is, on the lab floor.
await p.goto('http://localhost:8080/?dev=1');
await p.mouse.click(422, 195);
await p.waitForTimeout(150);
const before = await p.evaluate(() => window.__game.cones.knocked);
// aim the car at the slalom and plough through it
await p.evaluate(() => { const g = window.__game; g.car.x = -168; g.car.y = 234.5; g.car.heading = 0; });
await p.keyboard.down('w'); await p.waitForTimeout(4200); await p.keyboard.up('w');
await p.waitForTimeout(600);
const after = await p.evaluate(() => ({ knocked: window.__game.cones.knocked,
  moved: window.__game.cones.list.filter(c => c.moved).length,
  carKph: +(Math.hypot(window.__game.car.vx, window.__game.car.vy) * 3.6).toFixed(1) }));
await p.screenshot({ path: 'shots/10-cones.png' });
console.log('before', before, 'after', JSON.stringify(after));
// RESTART must stand them back up
await p.evaluate(() => window.__game.restart()); await p.waitForTimeout(200);
const post = await p.evaluate(() => window.__game.cones.knocked);
console.log('after RESTART:', post);
await b.close();
console.log(errs.length ? 'ERRORS: ' + errs.join(' | ') : 'no console errors');

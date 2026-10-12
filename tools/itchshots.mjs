// itchshots.mjs — store-page screenshots for itch.io (1280x720, desktop: no touch pedals) + a 630x500 cover, into
// ../ready-to-play/rac3r-page/ (NOT the build folder). Scenes: the menu race, a 6-car pack, rallycross, the rally stage, a crash,
// the podium. node tools/itchshots.mjs
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
import { mkdirSync } from 'node:fs';
const OUT = 'C:/Users/Admin/Desktop/G/GamesStudio/ready-to-play/rac3r-page/'; mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ channel: 'msedge' });
const page = async () => { const p = await (await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage(); await p.goto('http://localhost:8080/?menu=1&guide=0'); await p.waitForTimeout(3500); return p; };
const race = async (p, lv, car, opts, driveDiff = 3) => p.evaluate(async ([lv, car, opts, dd]) => {
  const g = window.__game; g.menu.hide(); g.launch(lv, car, opts);
  const A = { ...await import('/src/ai/circuit.js'), ...await import('/src/ai/traits.ts') }, L = await import('/src/lab.js'); const drv = A.createAIDriver(L.LEVEL, A.aiTraits(dd, 0, 1, 7));
  g.input.update = () => ({ ...drv.drive(g.car, 1 / 60, { cars: g.ai.map((a) => a.car), lap: 1, laps: 3 }), reverse: 0, shiftUp: false, shiftDown: false });
}, [lv, car, opts, driveDiff]);
// 1. the menu with the AI race behind it
{ const p = await page(); await p.waitForTimeout(6000); await p.screenshot({ path: OUT + '1-menu.png' }); await p.close(); }
// 2. a pack of six at Thruston, a few seconds after the green
{ const p = await page(); await race(p, 'thruston', 'hatch-rwd', { ai: 5, diff: 3, laps: 3 }); await p.waitForTimeout(9500); await p.screenshot({ path: OUT + '2-pack-thruston.png' }); await p.waitForTimeout(6000); await p.screenshot({ path: OUT + '2b-battle.png' }); await p.close(); }
// 3. rallycross at Slidden Hill
{ const p = await page(); await race(p, 'slidden-hill', 'rally-4x4', { ai: 5, diff: 3, laps: 3, rx: true }); await p.waitForTimeout(11000); await p.screenshot({ path: OUT + '3-rallycross.png' }); await p.close(); }
// 4. the rally stage
{ const p = await page(); await race(p, 'sweaty-lamb', 'rally-4x4', { ai: 0 }); await p.waitForTimeout(16000); await p.screenshot({ path: OUT + '4-rally-stage.png' }); await p.close(); }
// 5. a crash: a damaged car against a wall, paint everywhere
{ const p = await page();
  await p.evaluate(() => { const g = window.__game; g.menu.hide(); g.launch('brands-snatch', 'muscle-rwd', { ai: 0 }); g.input.update = () => ({ steer: 0, throttle: 0, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false }); });
  await p.waitForTimeout(1500);
  await p.evaluate(async () => { const L = await import('/src/lab.js'), g = window.__game, c = g.car, S = L.LEVEL.solids || [], big = S.filter((s) => s.w > 6 && s.h > 6)[0] || S[0];
    for (const [kph, ang] of [[65, 0.35], [40, 2.6]]) { const d = 20, x = big.x - Math.cos(ang) * d, y = big.y - Math.sin(ang) * d; c.x = x; c.y = y; c.heading = ang; c.yawRate = 0; c.vx = Math.cos(ang) * kph / 3.6; c.vy = Math.sin(ang) * kph / 3.6; await new Promise((r) => setTimeout(r, 1600)); } });
  await p.waitForTimeout(300); await p.screenshot({ path: OUT + '5-crash.png' }); await p.close(); }
// 6. the podium at the end of a one-lap race
{ const p = await page(); await race(p, 'castle-cum', 'hatch-rwd', { ai: 5, diff: 2, laps: 1 }, 4);
  for (let k = 0; k < 120; k++) { await p.waitForTimeout(1000); if (await p.evaluate(() => !!window.__game.flowShown)) break; }
  await p.waitForTimeout(700); await p.screenshot({ path: OUT + '6-podium.png' }); await p.waitForTimeout(2600); await p.screenshot({ path: OUT + '7-results.png' }); await p.close(); }
// cover 630x500: a crop of the pack shot, scaled
{ const p = await (await b.newContext({ viewport: { width: 630, height: 500 }, deviceScaleFactor: 1 })).newPage();
  await p.goto('http://localhost:8080/?menu=1&guide=0'); await p.waitForTimeout(3500); await race(p, 'thruston', 'hatch-rwd', { ai: 5, diff: 3, laps: 3 }); await p.waitForTimeout(9500);
  await p.screenshot({ path: OUT + 'cover-630x500.png' }); }
await b.close();
console.log('done', OUT);

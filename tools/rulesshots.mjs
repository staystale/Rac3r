// rulesshots.mjs — photographs the EVENT RULES walkthrough (guide.js RULES, forced with ?rules=1) for a highway VS AI race at phone
// portrait + landscape, checks the sim is paused while it shows (the lights must not run), then ends the race and photographs the
// PODIUM. Output: shots/look/rules-<W>-<n>.png, podium-<W>.png. node tools/rulesshots.mjs
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
for (const [W, H] of [[390, 844], [844, 390]]) {
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  const errs = []; p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/?touch=1&guide=0&menu=1&rules=1'); await p.waitForTimeout(2500);
  await p.evaluate(() => window.__game.menu.hide());
  await p.evaluate(() => window.__game.launch('highway', 'saloon-rwd', { ai: 3, diff: 2, traffic: 0.6 }));
  await p.waitForTimeout(4000);   // the fly-in, then the rules open
  const g0 = await p.evaluate(() => ({ active: window.__game.guide.active, kind: window.__game.guide.kind, n: window.__game.guide.count, t: window.__game.start.t }));
  const tap = async (r) => p.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
  for (let k = 0; k < g0.n; k++) {
    await p.screenshot({ path: `shots/look/rules-${W}-${k + 1}.png` });
    const L = await p.evaluate(() => window.__game.guide.last); if (!L) break; await tap(L.nextB); await p.waitForTimeout(350);
  }
  const t1 = await p.evaluate(() => window.__game.start.t);
  await p.waitForTimeout(1500);
  const g1 = await p.evaluate(() => ({ active: window.__game.guide.active, t: window.__game.start.t }));
  console.log(`${W}x${H} rules`, JSON.stringify(g0), '| lights clock while open', g0.t.toFixed(2), '->', t1.toFixed(2), '| after close', JSON.stringify(g1));
  // end the race -> the flag, then the podium (1.6 s), photographed before it moves on to the table (2.5 s)
  await p.waitForTimeout(6000);
  await p.evaluate(() => window.__game.flow && window.__game.flow.end());
  await p.waitForTimeout(2300); await p.screenshot({ path: `shots/look/podium-${W}.png` });
  await p.waitForTimeout(2800); await p.screenshot({ path: `shots/look/results-${W}.png` });
  console.log(`${W}x${H} errors`, errs.length ? errs.slice(0, 3).join(' || ') : 'none');
}
await b.close();

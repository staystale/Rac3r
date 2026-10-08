// S-C (2026-10-07): PHOTOGRAPH cows + sheep in the real game on :8080 (portrait + landscape). The lab: the sheep lane (y 450) and the cow
// lane (y 436) before, then DRIVEN into at speed (after: popped fluff / tipped cows). The highway: a pasture of animals (now loose objects).
// Reports kinds after the hits, fps, page errors. node tools/_animalshots.mjs [base, e.g. shots/next/]  -> shots/look/sc-<what>-<size>.png
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const base = process.argv[2] || '';
const b = await chromium.launch({ channel: 'msedge' });
let fails = 0;
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:8080/${base}index.html?touch=1&guide=0&menu=0&level=lab&car=saloon-rwd`); await p.touchscreen.tap(w / 2, h / 2); await p.waitForTimeout(3000);
  const put = async (x, y, hd, z, ms = 1000) => {
    await p.evaluate(([x, y, hd, z]) => { const g = window.__game, c = g.car; c.x = x; c.y = y; c.heading = hd; c.vx = c.vy = 0; c._p = null; c.prevWheels = null;
      if (g.renderer.debugZoom) g.renderer.debugZoom(z); if (g.renderer.snap) g.renderer.snap(c); }, [x, y, hd, z]);
    await p.waitForTimeout(ms);
  };
  await put(160, 443, 0, 1.0); await p.screenshot({ path: `shots/look/sc-lab-before-${tag}.png` });
  const drive = async (y, kmh) => {
    await put(110, y, 0, 0.9, 300);
    await p.evaluate((v) => { const c = window.__game.car; c.vx = v; c.vy = 0; c.gear = 4; c.rpm = 5000; }, kmh / 3.6);
    await p.keyboard.down('w'); await p.waitForTimeout(3200); await p.keyboard.up('w'); await p.waitForTimeout(300);
  };
  await drive(450, 90);   // the sheep lane
  await put(172, 450, 0, 1.0, 400); await p.screenshot({ path: `shots/look/sc-lab-sheep-hit-${tag}.png` });
  await drive(436, 100);  // the cow lane
  await put(180, 436, 0, 0.9, 400); await p.screenshot({ path: `shots/look/sc-lab-cow-hit-${tag}.png` });
  const lab = await p.evaluate(() => { const by = {}; for (const k of window.__game.cones.list) if (['sheep', 'fluff', 'cow'].includes(k.kind)) { const n = k.kind + (k.tipped ? '-tipped' : ''); by[n] = (by[n] || 0) + 1; } return by; });
  // the HIGHWAY: launch, then find a field animal and look at it
  await p.evaluate(() => window.__game.launch('highway', 'saloon-rwd', { road: 'motorway' })); await p.waitForTimeout(2500);
  const an = await p.evaluate(() => { const g = window.__game, a = g.cones.list.filter((k) => k.kind === 'sheep' || k.kind === 'cow');
    return { n: a.length, sheep: a.filter((k) => k.kind === 'sheep').length, cows: a.filter((k) => k.kind === 'cow').length, at: a.length ? [a[0].x, a[0].y] : null }; });
  if (an.at) { await put(an.at[0] - 6, an.at[1] - 4, 0, 0.8, 1200); await p.screenshot({ path: `shots/look/sc-hw-pasture-${tag}.png` }); }
  const fps = await p.evaluate(() => window.__game.fps.toFixed(0));
  console.log(`${tag}: lab after the hits ${JSON.stringify(lab)} | highway first window animals ${JSON.stringify(an)} | fps ${fps} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  if (errs.length || !lab.fluff || !lab['cow-tipped'] || !an.n) fails++;
  await ctx.close();
}
await b.close();
console.log(fails ? 'FAIL' : 'ALL OK');

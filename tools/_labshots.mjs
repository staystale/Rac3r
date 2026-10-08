// S-B (2026-10-06): PHOTOGRAPH the lab extension in the real game on :8080 (portrait + landscape): the crash lanes' object ends, the
// lane starts with their labels, the off-road area, the new south edge; then DRIVE a car down the cone lane into the cones and down the
// banger lane, and report what moved + fps + page errors. node tools/_labshots.mjs [base]  -> shots/look/sb-<what>-<size>.png
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const base = process.argv[2] || '';
const b = await chromium.launch({ channel: 'msedge' });
let fails = 0;
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(`http://localhost:8080/${base}index.html?touch=1&guide=0&menu=0&level=lab&car=saloon-rwd`); await p.touchscreen.tap(w / 2, h / 2); await p.waitForTimeout(3000);
  const put = async (x, y, hd, z, ms = 1200) => {
    await p.evaluate(([x, y, hd, z]) => { const g = window.__game, c = g.car; c.x = x; c.y = y; c.heading = hd; c.vx = c.vy = 0; c._p = null; c.prevWheels = null;
      if (g.renderer.debugZoom) g.renderer.debugZoom(z); if (g.renderer.snap) g.renderer.snap(c); }, [x, y, hd, z]);
    await p.waitForTimeout(ms);
  };
  const shots = [['lanes-objects', 175, 410, 0, 0.32], ['lanes-start', -225, 330, 0, 0.45], ['lanes-cold', 170, 500, 0, 0.45],
    ['offroad', 0, 640, -Math.PI / 2, 0.22], ['offroad-hills', 90, 670, 0, 0.4], ['south-edge', 150, 725, Math.PI / 2, 0.5], ['old-join', 0, 262, Math.PI / 2, 0.4]];
  for (const [k, x, y, hd, z] of shots) { await put(x, y, hd, z); await p.screenshot({ path: `shots/look/sb-${k}-${tag}.png` }); }
  // DRIVE: full throttle down the cone lane (y 296) and the banger lane (y 324) from x 60
  const drive = async (y, secs) => {
    await put(60, y, 0, 0.5, 300);
    await p.evaluate(() => { const c = window.__game.car; c.vx = 20; c.vy = 0; c.gear = 3; c.rpm = 4000; });   // a rolling start: 72 km/h
    const moved0 = await p.evaluate(() => window.__game.cones.list.filter((k) => k.moved).length);
    await p.keyboard.down('w'); await p.waitForTimeout(secs * 1000); await p.keyboard.up('w'); await p.waitForTimeout(600);
    return p.evaluate(([m0, y]) => { const g = window.__game, near = g.cones.list.filter((k) => Math.abs(k.y - y) < 7 && k.x > 150);
      return { moved: g.cones.list.filter((k) => k.moved).length - m0, nearMoved: near.filter((k) => k.moved || Math.hypot(k.x - k.hx, k.y - k.hy) > 0.3).length, near: near.length,
        kinds: [...new Set(near.map((k) => k.kind))].join('/'), car: [g.car.x.toFixed(0), g.car.y.toFixed(0)], kmh: (Math.hypot(g.car.vx, g.car.vy) * 3.6).toFixed(0), fps: g.fps.toFixed(0) }; }, [moved0, y]);
  };
  const cone = await drive(296, 5); await p.screenshot({ path: `shots/look/sb-hit-cones-${tag}.png` });
  const bang = await drive(324, 5); await p.screenshot({ path: `shots/look/sb-hit-bangers-${tag}.png` });
  const fps = await p.evaluate(() => window.__game.fps.toFixed(0));
  console.log(`${tag}: cone lane ${JSON.stringify(cone)}`);
  console.log(`${tag}: banger lane ${JSON.stringify(bang)}`);
  console.log(`${tag}: fps ${fps} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  if (errs.length || cone.nearMoved < 3 || bang.nearMoved < 1) fails++;
  await ctx.close();
}
await b.close();
console.log(fails ? 'FAIL' : 'ALL OK');

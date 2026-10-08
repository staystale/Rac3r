// scratch: the SPEED CAMERA in the real game: the car is put 60 m short of the next gantry at 160 km/h, driven straight; the card must
// appear (game.camCaught) and is photographed at both phone sizes; then the rules deck for 'endless' must include SPEED CAMERAS.
import { chromium } from 'file:///C:/Users/Admin/Desktop/G/GamesStudio/BitterTrade/node_modules/playwright/index.mjs';
const b = await chromium.launch({ channel: 'msedge' });
for (const [w, h, tag] of [[390, 844, 'port'], [844, 390, 'land']]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(), errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto('http://localhost:8080/?touch=1&guide=0&menu=0&level=highway&car=saloon-rwd&traffic=0'); await p.touchscreen.tap(w / 2, h / 2); await p.waitForTimeout(3500);
  let setup = 'hop'; for (let hop = 0; hop < 12 && setup === 'hop'; hop++) { await p.waitForTimeout(400); setup = await p.evaluate(async () => {
    const g = window.__game, H = await import('/src/highway.js'), lv = g.level, car = g.car, f = H.roadFrame(lv, car.x, car.y, null);
    let best = null; for (const pr of lv.props) { if (pr.kind !== 'gantry') continue; const q = H.roadFrame(lv, pr.x, pr.y, null); if (q && q.s > f.s + 80 && (!best || q.s < best)) best = q.s; }
    if (best == null) { const P = H.roadPose(lv, Math.min(f.s + 900, lv._hw.pts[lv._hw.pts.length - 1].s - 400), lv._hw.geo.centres[1]); car.x = P.x; car.y = P.y; car.heading = P.h; car.vx = Math.cos(P.h) * 30; car.vy = Math.sin(P.h) * 30; return 'hop'; }
    const P = H.roadPose(lv, best - 60, lv._hw.geo.centres[1]); car.x = P.x; car.y = P.y; car.heading = P.h; const v = 160 / 3.6; car.vx = Math.cos(P.h) * v; car.vy = Math.sin(P.h) * v;
    if (g.renderer.snap) g.renderer.snap(car);
    g.input.update = () => ({ steer: 0, throttle: 0.6, brake: 0, handbrake: 0, reverse: 0, shiftUp: false, shiftDown: false });
    return 'gantry ' + (best - f.s).toFixed(0) + ' m ahead';
  }); }
  let caught = null; for (let i = 0; i < 40 && !caught; i++) { await p.waitForTimeout(100); caught = await p.evaluate(() => window.__game.camCaught); }
  await p.waitForTimeout(250); await p.screenshot({ path: `shots/look/cam-${tag}.png` });
  console.log(`${tag}: ${setup} | caught ${caught ? JSON.stringify({ kmh: caught.kmh, mph: caught.mph, fine: caught.fine }) : 'NO (FAIL)'} | page errors: ${errs.length ? errs.join(' / ') : 'none'}`);
  await ctx.close();
}
const pg = await (await b.newContext()).newPage(); await pg.goto('http://localhost:8080/?menu=0&guide=0');
console.log('rules endless:', await pg.evaluate(async () => (await import('/src/guide.js')).RULES.endless.map((c) => c.title).join(' | ')));
await b.close();
